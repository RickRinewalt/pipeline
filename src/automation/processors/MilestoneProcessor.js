const { Octokit } = require('@octokit/rest');

/**
 * MilestoneProcessor
 * Handles GitHub milestone and issue workflow automation
 */
class MilestoneProcessor {
  constructor(config, logger) {
    if (!config.github?.owner || !config.github?.repo || !config.github?.token) {
      throw new Error('GitHub configuration required (owner, repo, token)');
    }

    this.config = config;
    this.logger = logger;
    this.github = new Octokit({
      auth: config.github.token
    });
    this.processedMilestones = new Map();
  }

  /**
   * Process milestone and analyze for WCP breakdown
   * @param {number} milestoneId - GitHub milestone ID
   * @returns {Object} Processing result
   */
  async processMilestone(milestoneId) {
    try {
      this.logger.info(`Processing milestone ${milestoneId}`);

      // Get milestone details
      const milestone = await this.github.rest.issues.getMilestone({
        owner: this.config.github.owner,
        repo: this.config.github.repo,
        milestone_number: milestoneId
      });

      // Get all issues for this milestone
      const issues = await this.github.rest.issues.listForRepo({
        owner: this.config.github.owner,
        repo: this.config.github.repo,
        milestone: milestoneId,
        state: 'all',
        per_page: 100
      });

      const milestoneData = milestone.data;
      const issueData = issues.data;

      // Analyze milestone complexity
      const analysis = this.analyzeMilestone(milestoneData, issueData);

      // Generate WCP suggestions
      const wcpSuggestions = this.generateWCPSuggestions(analysis);

      const result = {
        success: true,
        milestoneId,
        title: milestoneData.title,
        description: milestoneData.description,
        state: milestoneData.state,
        dueDate: milestoneData.due_on,
        issuesAnalyzed: issueData.length,
        openIssues: milestoneData.open_issues,
        closedIssues: milestoneData.closed_issues,
        complexity: analysis.complexity,
        suggestedBreakdown: wcpSuggestions,
        recommendedFeatureCount: wcpSuggestions.features,
        analysisTimestamp: Date.now()
      };

      // Cache processed milestone
      this.processedMilestones.set(milestoneId, result);

      this.logger.info(`Milestone ${milestoneId} processed successfully`, {
        issues: issueData.length,
        complexity: analysis.complexity,
        features: wcpSuggestions.features
      });

      return result;

    } catch (error) {
      this.logger.error(`Error processing milestone ${milestoneId}`, { error: error.message });
      
      if (error.message.includes('Not Found')) {
        return {
          success: false,
          error: `Milestone ${milestoneId} not found`
        };
      }

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create sub-issues with proper GitHub hierarchy
   * @param {Object} parentIssue - Parent issue data
   * @param {Array} subIssues - Sub-issue specifications
   * @returns {Object} Creation result
   */
  async createSubIssues(parentIssue, subIssues) {
    try {
      this.logger.info(`Creating ${subIssues.length} sub-issues for parent #${parentIssue.number}`);

      // Validate sub-issue data
      const validation = this.validateSubIssues(subIssues);
      if (!validation.valid) {
        return {
          success: false,
          error: `Invalid sub-issue data: ${validation.errors.join(', ')}`
        };
      }

      const createdIssues = [];
      const errors = [];

      for (const [index, subIssue] of subIssues.entries()) {
        try {
          // Create enhanced issue body with parent reference
          const enhancedBody = this.enhanceIssueBody(subIssue.body, parentIssue);

          const createdIssue = await this.github.rest.issues.create({
            owner: this.config.github.owner,
            repo: this.config.github.repo,
            title: subIssue.title,
            body: enhancedBody,
            labels: [
              ...(subIssue.labels || []),
              'sub-issue',
              `parent:${parentIssue.number}`
            ],
            milestone: parentIssue.milestone?.number,
            assignees: subIssue.assignees || []
          });

          createdIssues.push({
            number: createdIssue.data.number,
            title: createdIssue.data.title,
            id: createdIssue.data.id
          });

          this.logger.debug(`Created sub-issue #${createdIssue.data.number}: ${subIssue.title}`);

        } catch (error) {
          this.logger.error(`Error creating sub-issue ${index + 1}`, { error: error.message });
          errors.push(`Sub-issue ${index + 1}: ${error.message}`);
        }
      }

      // Try to establish GitHub sub-issue relationships using GraphQL
      try {
        await this.establishSubIssueRelationships(parentIssue, createdIssues);
      } catch (error) {
        this.logger.warn('Could not establish GraphQL sub-issue relationships', {
          error: error.message
        });
        // Not a fatal error, continue
      }

      if (errors.length > 0 && createdIssues.length === 0) {
        return {
          success: false,
          error: errors.join('; ')
        };
      }

      return {
        success: true,
        subIssuesCreated: createdIssues.length,
        issues: createdIssues,
        errors: errors.length > 0 ? errors : undefined
      };

    } catch (error) {
      this.logger.error('Error in createSubIssues', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get comprehensive milestone status
   * @param {number} milestoneId - Milestone ID
   * @returns {Object} Milestone status
   */
  async getMilestoneStatus(milestoneId) {
    try {
      // Check cache first
      const cached = this.processedMilestones.get(milestoneId);
      
      // Get fresh data from GitHub
      const milestone = await this.github.rest.issues.getMilestone({
        owner: this.config.github.owner,
        repo: this.config.github.repo,
        milestone_number: milestoneId
      });

      const issues = await this.github.rest.issues.listForRepo({
        owner: this.config.github.owner,
        repo: this.config.github.repo,
        milestone: milestoneId,
        state: 'all',
        per_page: 100
      });

      const milestoneData = milestone.data;
      const issueData = issues.data;
      
      // Calculate progress
      const totalIssues = issueData.length;
      const closedIssues = issueData.filter(issue => issue.state === 'closed').length;
      const progress = totalIssues > 0 ? Math.round((closedIssues / totalIssues) * 100) : 0;

      // Analyze assignee distribution
      const assigneeDistribution = this.analyzeAssigneeDistribution(issueData);

      // Estimate completion based on current velocity
      const estimatedCompletion = this.estimateCompletion(issueData, milestoneData);

      const status = {
        milestoneId,
        title: milestoneData.title,
        state: milestoneData.state,
        progress,
        openIssues: milestoneData.open_issues,
        closedIssues: milestoneData.closed_issues,
        totalIssues,
        isEmpty: totalIssues === 0,
        dueDate: milestoneData.due_on,
        assigneeDistribution,
        estimatedCompletion,
        lastUpdated: Date.now(),
        complexity: cached?.complexity || 'unknown'
      };

      return status;

    } catch (error) {
      this.logger.error(`Error getting milestone status ${milestoneId}`, {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Generate EPIC template following WCP structure
   * @param {Object} epicData - EPIC data
   * @returns {string} Generated template
   */
  generateEpicTemplate(epicData) {
    const title = epicData.title || '[EPIC Title]';
    const objective = epicData.objective || '[To be defined]';
    const features = epicData.features || [];
    const requirements = epicData.requirements || [];

    let template = `# EPIC: ${title}

## Business Objective
${objective}

## Technical Requirements`;

    if (requirements.length > 0) {
      requirements.forEach(req => {
        template += `\n- [ ] ${req}`;
      });
    } else {
      template += '\n- [ ] [To be defined]';
    }

    template += '\n\n## Features (Linked)';
    if (features.length > 0) {
      features.forEach((feature, index) => {
        template += `\n- [ ] ${feature}: #[num] - [Status]`;
      });
    } else {
      template += '\n- [ ] [Features to be created]';
    }

    template += `

## Success Criteria
- [ ] All features completed and tested
- [ ] CI/CD: 100% success rate maintained
- [ ] Code review approved
- [ ] Documentation updated

## CI Protocol
Per CLAUDE.md: 100% CI before progression, implementation-first, swarm coordination

## Dependencies
${epicData.dependencies ? epicData.dependencies.join('\n') : '[List external dependencies]'}

## WCP Compliance
- Max Features per EPIC: ${this.config.wcp?.maxFeaturesPerEpic || 7}
- Max Issues per Feature: ${this.config.wcp?.maxIssuesPerFeature || 3}
- Execution Strategy: ONE feature at a time to production

---
*Generated by YOLO-WARP Automation Engine*`;

    return template;
  }

  /**
   * Generate feature template with WCP structure
   * @param {Object} featureData - Feature data
   * @returns {string} Generated template
   */
  generateFeatureTemplate(featureData) {
    const title = featureData.title || '[Feature Title]';
    const description = featureData.description || '[Feature description]';
    const epicNumber = featureData.epicNumber || '[EPIC]';
    const subIssues = featureData.subIssues || [];
    const acceptanceCriteria = featureData.acceptanceCriteria || [];

    let template = `# Feature: ${title}
**Parent**: #${epicNumber}

## Description
${description}

## Sub-Issues (Proper GitHub hierarchy)`;

    if (subIssues.length > 0) {
      subIssues.forEach(issue => {
        template += `\n- [ ] ${issue.title}: #${issue.number || '[num]'} - [Status]`;
      });
    } else {
      template += '\n- [ ] [Sub-issues to be created]';
    }

    template += '\n\n## Acceptance Criteria';
    if (acceptanceCriteria.length > 0) {
      acceptanceCriteria.forEach(criteria => {
        template += `\n- [ ] ${criteria}`;
      });
    } else {
      template += '\n- [ ] [Acceptance criteria to be defined]';
    }

    template += `

## Definition of Done
- [ ] Feature implemented and tested
- [ ] CI passing (100% success required)
- [ ] Code review approved and merged
- [ ] Documentation updated
- [ ] Feature deployed to production

## CI Integration
- Branch: feature/${title.toLowerCase().replace(/\s+/g, '-')}
- Required Checks: build, test, lint, security
- Quality Gates: Test coverage ≥80%, No lint errors
- Deployment: Automatic after PR merge

---
*Generated by YOLO-WARP Automation Engine*`;

    return template;
  }

  /**
   * Update milestone with progress information
   * @param {number} milestoneId - Milestone ID
   * @param {Object} progressData - Progress data
   * @returns {Object} Update result
   */
  async updateMilestoneProgress(milestoneId, progressData) {
    try {
      const milestone = await this.github.rest.issues.getMilestone({
        owner: this.config.github.owner,
        repo: this.config.github.repo,
        milestone_number: milestoneId
      });

      const currentDescription = milestone.data.description || '';
      const progressSection = this.generateProgressSection(progressData);
      
      // Update or append progress section
      const updatedDescription = this.updateDescriptionWithProgress(
        currentDescription, 
        progressSection
      );

      await this.github.rest.issues.updateMilestone({
        owner: this.config.github.owner,
        repo: this.config.github.repo,
        milestone_number: milestoneId,
        description: updatedDescription
      });

      return {
        success: true,
        milestoneId,
        progressData
      };

    } catch (error) {
      this.logger.error(`Error updating milestone progress ${milestoneId}`, {
        error: error.message
      });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Analyze milestone complexity and structure
   * @param {Object} milestone - Milestone data
   * @param {Array} issues - Issue data
   * @returns {Object} Analysis result
   */
  analyzeMilestone(milestone, issues) {
    const totalIssues = issues.length;
    const openIssues = issues.filter(issue => issue.state === 'open').length;
    const assignedIssues = issues.filter(issue => issue.assignee).length;
    const labelDistribution = this.analyzeLabelDistribution(issues);

    // Determine complexity based on various factors
    let complexity = 'low';
    let complexityScore = 0;

    // Factor 1: Number of issues
    if (totalIssues > 15) complexityScore += 3;
    else if (totalIssues > 8) complexityScore += 2;
    else if (totalIssues > 3) complexityScore += 1;

    // Factor 2: Issue labels indicating complexity
    const complexityLabels = ['enhancement', 'feature', 'epic', 'breaking-change'];
    const complexIssues = issues.filter(issue =>
      issue.labels.some(label =>
        complexityLabels.includes(label.name.toLowerCase())
      )
    ).length;
    
    complexityScore += Math.min(complexIssues, 3);

    // Factor 3: Long descriptions or many comments
    const complexDescriptions = issues.filter(issue =>
      (issue.body && issue.body.length > 500) || issue.comments > 5
    ).length;
    
    complexityScore += Math.min(complexDescriptions, 2);

    // Determine final complexity
    if (complexityScore >= 6) complexity = 'high';
    else if (complexityScore >= 3) complexity = 'medium';

    return {
      complexity,
      complexityScore,
      totalIssues,
      openIssues,
      assignedIssues,
      unassignedIssues: totalIssues - assignedIssues,
      labelDistribution,
      hasEpicStructure: issues.some(issue =>
        issue.labels.some(label => label.name.toLowerCase().includes('epic'))
      )
    };
  }

  /**
   * Generate WCP breakdown suggestions
   * @param {Object} analysis - Milestone analysis
   * @returns {Object} WCP suggestions
   */
  generateWCPSuggestions(analysis) {
    const maxFeaturesPerEpic = this.config.wcp?.maxFeaturesPerEpic || 7;
    const maxIssuesPerFeature = this.config.wcp?.maxIssuesPerFeature || 3;

    let suggestedFeatures;

    if (analysis.complexity === 'high') {
      // Complex milestones should be broken down into more features
      suggestedFeatures = Math.min(
        Math.ceil(analysis.totalIssues / maxIssuesPerFeature),
        maxFeaturesPerEpic
      );
    } else if (analysis.complexity === 'medium') {
      // Medium complexity can have fewer features with more issues each
      suggestedFeatures = Math.max(
        2,
        Math.ceil(analysis.totalIssues / (maxIssuesPerFeature + 1))
      );
    } else {
      // Simple milestones can be 1-2 features
      suggestedFeatures = Math.max(1, Math.ceil(analysis.totalIssues / maxIssuesPerFeature));
    }

    const issuesPerFeature = Math.ceil(analysis.totalIssues / suggestedFeatures);

    return {
      features: suggestedFeatures,
      issuesPerFeature: Math.min(issuesPerFeature, maxIssuesPerFeature),
      recommendsBreakdown: analysis.complexity === 'high' && analysis.totalIssues > 12,
      swarmRecommended: analysis.complexity === 'high' || 
                       (analysis.complexity === 'medium' && suggestedFeatures > 3),
      estimatedDuration: this.estimateDurationDays(analysis.totalIssues, analysis.complexity)
    };
  }

  /**
   * Validate sub-issue data
   * @param {Array} subIssues - Sub-issues to validate
   * @returns {Object} Validation result
   */
  validateSubIssues(subIssues) {
    const errors = [];

    if (!Array.isArray(subIssues)) {
      errors.push('Sub-issues must be an array');
      return { valid: false, errors };
    }

    subIssues.forEach((subIssue, index) => {
      if (!subIssue.title || subIssue.title.trim() === '') {
        errors.push(`Sub-issue ${index + 1} missing title`);
      }
      if (!subIssue.body && !subIssue.description) {
        errors.push(`Sub-issue ${index + 1} missing description`);
      }
    });

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Enhance issue body with parent references and WCP structure
   * @param {string} originalBody - Original issue body
   * @param {Object} parentIssue - Parent issue data
   * @returns {string} Enhanced body
   */
  enhanceIssueBody(originalBody, parentIssue) {
    let enhancedBody = `**Parent**: #${parentIssue.number}\n\n`;
    
    if (originalBody) {
      enhancedBody += originalBody;
    }

    enhancedBody += `\n\n---
**WCP Structure**: Sub-issue of #${parentIssue.number}
**Part of**: ${parentIssue.milestone?.title || 'Parent milestone'}

## Definition of Done
- [ ] Implementation complete
- [ ] Tests pass (CI 100% success)
- [ ] Code review approved
- [ ] Documentation updated

*Generated by YOLO-WARP Automation Engine*`;

    return enhancedBody;
  }

  /**
   * Establish GitHub sub-issue relationships using GraphQL API
   * @param {Object} parentIssue - Parent issue
   * @param {Array} subIssues - Created sub-issues
   */
  async establishSubIssueRelationships(parentIssue, subIssues) {
    // Note: This requires GitHub Enterprise or beta features
    // Fallback to label-based relationships for now
    try {
      for (const subIssue of subIssues) {
        await this.github.rest.issues.createComment({
          owner: this.config.github.owner,
          repo: this.config.github.repo,
          issue_number: parentIssue.number,
          body: `📋 Sub-issue created: #${subIssue.number} - ${subIssue.title}`
        });
      }
    } catch (error) {
      this.logger.debug('Could not create parent issue comments', { error: error.message });
      // Non-critical error
    }
  }

  /**
   * Helper methods for analysis and formatting
   */
  analyzeLabelDistribution(issues) {
    const labelCounts = {};
    issues.forEach(issue => {
      issue.labels.forEach(label => {
        labelCounts[label.name] = (labelCounts[label.name] || 0) + 1;
      });
    });
    return labelCounts;
  }

  analyzeAssigneeDistribution(issues) {
    const assigneeCounts = {};
    issues.forEach(issue => {
      if (issue.assignee) {
        const login = issue.assignee.login;
        assigneeCounts[login] = (assigneeCounts[login] || 0) + 1;
      }
    });
    return assigneeCounts;
  }

  estimateCompletion(issues, milestone) {
    // Simple estimation based on current velocity
    const closedIssues = issues.filter(issue => issue.state === 'closed');
    const openIssues = issues.filter(issue => issue.state === 'open');
    
    if (closedIssues.length === 0 || openIssues.length === 0) {
      return milestone.due_on || null;
    }

    // Calculate average time to close issues (simplified)
    const avgDaysToClose = 7; // Default estimate
    const estimatedDays = openIssues.length * avgDaysToClose;
    
    return Date.now() + (estimatedDays * 24 * 60 * 60 * 1000);
  }

  estimateDurationDays(totalIssues, complexity) {
    const baseIssueTime = {
      'low': 1,
      'medium': 2,
      'high': 3
    };

    return totalIssues * baseIssueTime[complexity];
  }

  generateProgressSection(progressData) {
    const { completedIssues, totalIssues, blockers, nextSteps } = progressData;
    const progress = totalIssues > 0 ? Math.round((completedIssues / totalIssues) * 100) : 0;

    let section = `\n## Progress Report
**Progress**: ${progress}% (${completedIssues}/${totalIssues} issues completed)
**Last Updated**: ${new Date().toISOString().split('T')[0]}`;

    if (blockers && blockers.length > 0) {
      section += '\n\n### 🚫 Blockers\n';
      blockers.forEach(blocker => {
        section += `- ${blocker}\n`;
      });
    }

    if (nextSteps && nextSteps.length > 0) {
      section += '\n### 📋 Next Steps\n';
      nextSteps.forEach(step => {
        section += `- ${step}\n`;
      });
    }

    return section;
  }

  updateDescriptionWithProgress(description, progressSection) {
    // Remove existing progress section if present
    const progressRegex = /\n## Progress Report[\s\S]*?(?=\n##|\n---|\n$|$)/;
    let updatedDescription = description.replace(progressRegex, '');
    
    // Add new progress section
    return updatedDescription + progressSection;
  }
}

module.exports = { MilestoneProcessor };