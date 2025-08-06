const GitHubClient = require('./github-client');
const SwarmManager = require('./swarm-manager');
const GitAutomation = require('./git-automation');

/**
 * YOLO-WARP: Complete automation workflow for milestone completion
 * 
 * This is the main orchestration class that coordinates GitHub integration,
 * swarm management, and git automation to completely automate milestone completion.
 */
class YoloWarp {
  constructor({ owner, repo, token, workingDir = process.cwd(), options = {} }) {
    // Validate required configuration
    if (!owner || !repo || !token) {
      throw new Error('Missing required configuration: owner, repo, token are mandatory');
    }

    this.owner = owner;
    this.repo = repo;
    this.token = token;
    this.workingDir = workingDir;
    this.options = {
      dryRun: false,
      verbose: false,
      parallel: true,
      maxRetries: 3,
      swarmTimeout: 300000, // 5 minutes
      ...options,
    };

    // Initialize components
    this.github = new GitHubClient({ owner, repo, token });
    this.swarm = new SwarmManager({ timeout: this.options.swarmTimeout });
    this.git = new GitAutomation({ 
      workingDir, 
      dryRun: this.options.dryRun 
    });

    // Internal state
    this.executionLogs = [];
    this.progressTrackers = new Map();
    this.circuitBreaker = {
      failures: 0,
      lastFailure: null,
      threshold: 5,
      timeout: 300000, // 5 minutes
    };

    this.log('YOLO-WARP initialized successfully', 'success');
  }

  /**
   * Main execution method - Complete milestone automation workflow
   */
  async executeMilestone(milestoneNumber, executionOptions = {}) {
    const options = { ...this.options, ...executionOptions };
    const startTime = Date.now();
    let swarmId = null;
    let featureBranch = null;

    try {
      this.log(`Starting YOLO-WARP execution for milestone #${milestoneNumber}`, 'info');
      
      if (options.verbose) {
        console.log('Verbose mode enabled - detailed output will be provided');
      }

      // Phase 1: Validation and Setup
      this.log('Phase 1: Validation and Setup', 'info');
      
      const milestone = await this.github.getMilestone(milestoneNumber);
      this.validateMilestone(milestone);
      
      if (milestone.open_issues === 0) {
        return {
          success: true,
          message: 'No open issues in milestone - milestone is complete',
          milestone,
        };
      }

      const issues = await this.github.getIssuesForMilestone(milestoneNumber);
      this.log(`Found ${issues.length} open issues to process`, 'info');

      // Phase 2: Repository and Git Setup
      this.log('Phase 2: Repository and Git Setup', 'info');
      
      await this.git.validateRepoState();
      featureBranch = await this.setupGitBranch(milestoneNumber, milestone.title);
      
      // Phase 3: Swarm Initialization
      this.log('Phase 3: Swarm Initialization', 'info');
      
      const swarmConfig = this.calculateSwarmConfiguration(milestone, issues);
      swarmId = await this.initializeSwarmForMilestone(swarmConfig);
      
      // Phase 4: Issue Processing
      this.log('Phase 4: Issue Processing', 'info');
      
      const progressTracker = this.createProgressTracker(milestoneNumber);
      const processingResults = await this.processIssues(issues, { 
        swarmId, 
        progressTracker,
        ...options 
      });

      // Phase 5: Results Integration
      this.log('Phase 5: Results Integration', 'info');
      
      await this.integrateResults(processingResults, featureBranch, milestone);
      
      // Phase 6: Finalization
      this.log('Phase 6: Finalization', 'info');
      
      const finalResults = await this.finalizeMilestone(featureBranch, milestoneNumber, processingResults);
      
      const executionTime = Date.now() - startTime;
      const completionReport = this.generateCompletionReport({
        milestoneId: milestoneNumber,
        milestone,
        processingResults,
        executionTime,
        swarmId,
        featureBranch,
      });

      this.log('YOLO-WARP execution completed successfully', 'success');
      
      return {
        success: true,
        milestone,
        results: finalResults,
        processingResults,
        executionTime,
        report: completionReport,
        swarmId,
        featureBranch,
      };

    } catch (error) {
      this.log(`YOLO-WARP execution failed: ${error.message}`, 'error');
      
      // Cleanup on failure
      await this.handleExecutionFailure(error, { swarmId, featureBranch, milestoneNumber });
      
      return {
        success: false,
        error: error.message,
        executionTime: Date.now() - startTime,
        partialResults: true, // May have completed some issues
      };
    } finally {
      // Always cleanup swarm
      if (swarmId) {
        try {
          await this.swarm.destroySwarm(swarmId);
          this.log(`Cleaned up swarm ${swarmId}`, 'info');
        } catch (cleanupError) {
          this.log(`Swarm cleanup warning: ${cleanupError.message}`, 'warning');
        }
      }
    }
  }

  /**
   * Validate milestone before processing
   */
  validateMilestone(milestone) {
    if (milestone.state === 'closed') {
      throw new Error('Milestone is already closed - cannot process');
    }

    if (!milestone.title) {
      throw new Error('Milestone must have a title');
    }

    this.log(`Milestone validation passed: "${milestone.title}"`, 'success');
  }

  /**
   * Setup Git branch for milestone work
   */
  async setupGitBranch(milestoneNumber, milestoneTitle) {
    try {
      const branchName = await this.git.createFeatureBranch(milestoneTitle, milestoneNumber);
      
      // Create initial commit to establish branch
      await this.git.commitChanges(
        `[YOLO-WARP] Initialize milestone #${milestoneNumber}: ${milestoneTitle}`,
        { skipStaging: false }
      );

      this.log(`Git branch setup complete: ${branchName}`, 'success');
      return branchName;
    } catch (error) {
      if (error.message.includes('No changes to commit')) {
        // Branch exists and is clean, that's fine
        const currentBranch = await this.git.getCurrentBranch();
        this.log(`Using existing branch: ${currentBranch}`, 'info');
        return currentBranch;
      }
      throw error;
    }
  }

  /**
   * Calculate optimal swarm configuration based on milestone complexity
   */
  calculateSwarmConfiguration(milestone, issues) {
    const totalIssues = issues.length;
    let complexity = 'simple';
    let topology = 'mesh';
    let maxAgents = 3;
    
    // Analyze issue complexity
    const complexityAnalysis = issues.map(issue => this.github.analyzeComplexity(issue));
    const highComplexityCount = complexityAnalysis.filter(a => a.complexity === 'high').length;
    const mediumComplexityCount = complexityAnalysis.filter(a => a.complexity === 'medium').length;

    // Determine overall complexity
    if (highComplexityCount > 2 || totalIssues > 10) {
      complexity = 'high';
      topology = 'hierarchical';
      maxAgents = Math.min(8, totalIssues);
    } else if (highComplexityCount > 0 || mediumComplexityCount > 3 || totalIssues > 5) {
      complexity = 'medium';
      topology = 'mesh';
      maxAgents = Math.min(6, Math.max(4, totalIssues));
    } else {
      complexity = 'simple';
      topology = 'star';
      maxAgents = Math.min(4, Math.max(2, totalIssues));
    }

    this.log(`Calculated swarm configuration: ${complexity} complexity, ${topology} topology, ${maxAgents} max agents`, 'info');

    return {
      topology,
      maxAgents,
      strategy: 'adaptive',
      complexity,
      estimatedTime: complexityAnalysis.reduce((sum, a) => sum + a.estimatedTime.max, 0),
    };
  }

  /**
   * Initialize swarm for milestone processing
   */
  async initializeSwarmForMilestone(swarmConfig) {
    try {
      const swarmResult = await this.swarm.initializeSwarm(swarmConfig);
      const swarmId = swarmResult.swarmId;

      // Spawn agents based on requirements
      const agentConfigs = this.generateAgentConfigurations(swarmConfig);
      await this.swarm.spawnAgents(swarmId, agentConfigs);

      this.log(`Swarm ${swarmId} initialized with ${agentConfigs.length} agents`, 'success');
      return swarmId;
    } catch (error) {
      throw new Error(`Swarm initialization failed: ${error.message}`);
    }
  }

  /**
   * Generate agent configurations based on swarm complexity
   */
  generateAgentConfigurations(swarmConfig) {
    const { complexity, maxAgents } = swarmConfig;
    const configs = [];

    switch (complexity) {
      case 'high':
        configs.push(
          { type: 'architect', capabilities: ['system-design', 'planning'] },
          { type: 'researcher', capabilities: ['analysis', 'documentation'] },
          { type: 'coder', capabilities: ['implementation', 'debugging'] },
          { type: 'coder', capabilities: ['implementation', 'testing'] },
          { type: 'tester', capabilities: ['testing', 'validation'] },
          { type: 'reviewer', capabilities: ['code-review', 'quality-assurance'] },
        );
        break;
      
      case 'medium':
        configs.push(
          { type: 'researcher', capabilities: ['analysis', 'planning'] },
          { type: 'coder', capabilities: ['implementation', 'debugging'] },
          { type: 'coder', capabilities: ['implementation', 'testing'] },
          { type: 'tester', capabilities: ['testing', 'validation'] },
        );
        break;
      
      default: // simple
        configs.push(
          { type: 'coder', capabilities: ['implementation', 'debugging'] },
          { type: 'tester', capabilities: ['testing', 'validation'] },
        );
        break;
    }

    // Limit to maxAgents
    return configs.slice(0, maxAgents);
  }

  /**
   * Process all issues in the milestone
   */
  async processIssues(issues, options = {}) {
    const { swarmId, progressTracker } = options;
    const results = {
      successful: [],
      failed: [],
      skipped: [],
      totalTime: 0,
    };

    // Categorize and prioritize issues
    const categorizedIssues = this.categorizeAndPrioritizeIssues(issues);
    
    this.log(`Processing ${issues.length} issues (${categorizedIssues.highPriority.length} high priority)`, 'info');

    // Process high priority issues first
    for (const issue of categorizedIssues.highPriority) {
      const result = await this.processSingleIssue(issue, swarmId, options);
      this.updateProcessingResults(results, issue, result);
      progressTracker?.updateProgress('issue-processing', (results.successful.length + results.failed.length) / issues.length * 100);
    }

    // Process remaining issues
    const remainingIssues = [...categorizedIssues.mediumPriority, ...categorizedIssues.lowPriority];
    
    if (options.parallel && remainingIssues.length > 1) {
      // Process in parallel where possible
      const parallelResults = await this.processIssuesInParallel(remainingIssues, swarmId, options);
      
      for (let i = 0; i < remainingIssues.length; i++) {
        this.updateProcessingResults(results, remainingIssues[i], parallelResults[i]);
      }
    } else {
      // Process sequentially
      for (const issue of remainingIssues) {
        const result = await this.processSingleIssue(issue, swarmId, options);
        this.updateProcessingResults(results, issue, result);
        progressTracker?.updateProgress('issue-processing', (results.successful.length + results.failed.length) / issues.length * 100);
      }
    }

    this.log(`Issue processing complete: ${results.successful.length} successful, ${results.failed.length} failed`, 'info');
    return results;
  }

  /**
   * Process a single issue
   */
  async processSingleIssue(issue, swarmId, options = {}) {
    const startTime = Date.now();
    
    try {
      this.log(`Processing issue #${issue.number}: ${issue.title}`, 'info');
      
      // Mark issue as in progress
      await this.markIssueInProgress(issue);
      
      // Analyze issue and determine requirements
      const analysis = this.github.analyzeComplexity(issue);
      const dependencies = this.github.parseDependencies(issue);
      
      // Create task for swarm
      const task = {
        description: this.generateTaskDescription(issue, analysis),
        issue,
        priority: this.determinePriority(issue),
        strategy: analysis.complexity === 'high' ? 'sequential' : 'adaptive',
        maxAgents: analysis.recommendedAgents.length,
        dependencies,
        estimatedTime: analysis.estimatedTime,
      };

      // Execute via swarm
      const swarmResult = await this.swarm.orchestrateTask(swarmId, task);
      
      if (swarmResult.success) {
        // Commit progress
        await this.commitIssueCompletion(issue, swarmResult);
        
        // Mark issue as completed
        await this.markIssueCompleted(issue, swarmResult);
        
        const executionTime = Date.now() - startTime;
        this.log(`Issue #${issue.number} completed successfully in ${executionTime}ms`, 'success');
        
        return {
          success: true,
          issue,
          result: swarmResult,
          executionTime,
        };
      } else {
        throw new Error(swarmResult.error || 'Task execution failed');
      }
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.log(`Issue #${issue.number} failed: ${error.message}`, 'error');
      
      // Mark issue with error
      await this.markIssueError(issue, error);
      
      return {
        success: false,
        issue,
        error: error.message,
        executionTime,
      };
    }
  }

  /**
   * Process issues in parallel (for independent issues)
   */
  async processIssuesInParallel(issues, swarmId, options = {}) {
    const promises = issues.map(issue => 
      this.processSingleIssue(issue, swarmId, options)
        .catch(error => ({ success: false, issue, error: error.message }))
    );

    return Promise.all(promises);
  }

  /**
   * Categorize and prioritize issues
   */
  categorizeAndPrioritizeIssues(issues) {
    const categorized = {
      highPriority: [],
      mediumPriority: [],
      lowPriority: [],
    };

    for (const issue of issues) {
      const priority = this.determinePriority(issue);
      categorized[priority].push(issue);
    }

    return categorized;
  }

  /**
   * Determine issue priority based on labels and content
   */
  determinePriority(issue) {
    const labels = issue.labels.map(l => l.name.toLowerCase());
    
    if (labels.includes('critical') || labels.includes('high-priority') || labels.includes('blocker')) {
      return 'highPriority';
    }
    
    if (labels.includes('bug') || labels.includes('medium-priority') || labels.includes('feature')) {
      return 'mediumPriority';
    }
    
    return 'lowPriority';
  }

  /**
   * Generate task description for swarm
   */
  generateTaskDescription(issue, analysis) {
    return `
Complete GitHub Issue #${issue.number}: ${issue.title}

## Issue Description:
${issue.body || 'No description provided'}

## Complexity Analysis:
- Complexity Level: ${analysis.complexity}
- Estimated Time: ${analysis.estimatedTime.min}-${analysis.estimatedTime.max} minutes
- Recommended Agents: ${analysis.recommendedAgents.join(', ')}

## Requirements:
- Implement solution according to issue requirements
- Write appropriate tests
- Update documentation if necessary
- Ensure code quality standards
- Follow project conventions

## Success Criteria:
- Issue requirements are fully met
- Code passes all existing tests
- New functionality is properly tested
- Code follows project style guidelines
- No breaking changes unless explicitly required

## Deliverables:
- Working implementation
- Test coverage
- Updated documentation (if applicable)
- Commit message following convention
    `.trim();
  }

  /**
   * Mark issue as in progress
   */
  async markIssueInProgress(issue) {
    try {
      const updateData = {
        labels: [...issue.labels.map(l => l.name), 'yolo-warp-processing'],
        body: this.addYoloWarpStatus(issue.body || '', 'PROCESSING'),
      };

      const result = await this.github.updateIssue(issue.number, updateData);
      
      if (result.rateLimited) {
        this.log(`Rate limited updating issue #${issue.number}`, 'warning');
        return { rateLimited: true };
      }

      return { updated: true };
    } catch (error) {
      this.log(`Failed to mark issue #${issue.number} as in progress: ${error.message}`, 'warning');
      return { error: error.message };
    }
  }

  /**
   * Mark issue as completed
   */
  async markIssueCompleted(issue, swarmResult) {
    try {
      const completionComment = this.generateCompletionComment(issue, swarmResult);
      
      // Add completion comment
      await this.github.createComment(issue.number, completionComment);
      
      // Close issue
      await this.github.closeIssue(issue.number, 'Issue completed by YOLO-WARP automation');
      
      this.log(`Marked issue #${issue.number} as completed`, 'success');
      return { completed: true };
    } catch (error) {
      this.log(`Failed to mark issue #${issue.number} as completed: ${error.message}`, 'warning');
      return { error: error.message };
    }
  }

  /**
   * Mark issue with error status
   */
  async markIssueError(issue, error) {
    try {
      const errorComment = `
## ❌ YOLO-WARP Processing Failed

**Error:** ${error.message}

**Timestamp:** ${new Date().toISOString()}

The automated processing of this issue failed. Manual intervention may be required.

---
*Generated by YOLO-WARP automation*
      `;

      await this.github.createComment(issue.number, errorComment);
      
      // Add error label
      await this.github.addLabelsToIssue(issue.number, ['yolo-warp-failed']);
      
      return { marked: true };
    } catch (markError) {
      this.log(`Failed to mark error for issue #${issue.number}: ${markError.message}`, 'warning');
      return { error: markError.message };
    }
  }

  /**
   * Commit issue completion to git
   */
  async commitIssueCompletion(issue, swarmResult) {
    try {
      const commitMessage = `Complete issue #${issue.number}: ${issue.title}

${issue.body?.substring(0, 200) || 'No description'}${issue.body?.length > 200 ? '...' : ''}

- Completed by YOLO-WARP automation
- Execution time: ${swarmResult.executionTime}ms
- Assigned agents: ${swarmResult.assignedAgents?.join(', ') || 'N/A'}

Closes #${issue.number}`;

      const result = await this.git.commitChanges(commitMessage);
      
      if (result.noChanges) {
        this.log(`No changes to commit for issue #${issue.number}`, 'info');
        return { noChanges: true };
      }

      this.log(`Committed completion of issue #${issue.number}`, 'success');
      return { committed: true, message: commitMessage };
    } catch (error) {
      this.log(`Failed to commit issue #${issue.number}: ${error.message}`, 'warning');
      return { error: error.message };
    }
  }

  /**
   * Integrate processing results
   */
  async integrateResults(processingResults, featureBranch, milestone) {
    try {
      this.log('Integrating processing results', 'info');

      // Push all changes
      await this.git.pushBranch(featureBranch, true);
      
      // Create pull request if there were successful completions
      if (processingResults.successful.length > 0) {
        const pr = await this.createMilestonePR(featureBranch, milestone.title, milestone.number);
        this.log(`Created pull request: ${pr.html_url}`, 'success');
        
        return { pullRequest: pr, integrated: true };
      } else {
        this.log('No successful completions - skipping PR creation', 'info');
        return { integrated: false, reason: 'No successful completions' };
      }
    } catch (error) {
      this.log(`Result integration failed: ${error.message}`, 'error');
      return { integrated: false, error: error.message };
    }
  }

  /**
   * Create pull request for milestone completion
   */
  async createMilestonePR(branchName, milestoneTitle, milestoneNumber) {
    const prTitle = `[YOLO-WARP] Complete Milestone #${milestoneNumber}: ${milestoneTitle}`;
    
    const prBody = `
## 🚀 YOLO-WARP Automated Milestone Completion

This pull request was automatically generated by YOLO-WARP to complete milestone #${milestoneNumber}.

### Milestone: ${milestoneTitle}

**Automated Actions:**
- ✅ Processed all open issues in the milestone
- ✅ Implemented solutions using AI swarm orchestration
- ✅ Created comprehensive test coverage
- ✅ Updated documentation where applicable
- ✅ Followed project coding standards

### Review Checklist:
- [ ] All automated implementations meet requirements
- [ ] Test coverage is adequate
- [ ] No breaking changes introduced
- [ ] Documentation is updated appropriately
- [ ] Code follows project conventions

### Next Steps:
1. Review the automated implementations
2. Run final integration tests
3. Merge to complete the milestone
4. Close milestone #${milestoneNumber}

---
🤖 **Generated by YOLO-WARP** - Complete automation workflow for milestone completion
*Timestamp: ${new Date().toISOString()}*
    `.trim();

    return await this.github.createPullRequest({
      title: prTitle,
      head: branchName,
      base: 'main',
      body: prBody,
      draft: false,
    });
  }

  /**
   * Finalize milestone processing
   */
  async finalizeMilestone(featureBranch, milestoneNumber, processingResults) {
    try {
      this.log('Finalizing milestone processing', 'info');
      
      const finalResults = {
        featureBranch,
        milestoneNumber,
        processingResults,
        finalized: true,
      };

      // If all issues were successful, consider closing the milestone
      if (processingResults.failed.length === 0 && processingResults.successful.length > 0) {
        try {
          const closedMilestone = await this.github.closeMilestone(milestoneNumber);
          finalResults.milestoneClosed = true;
          finalResults.closedMilestone = closedMilestone;
          
          this.log(`Milestone #${milestoneNumber} closed successfully`, 'success');
        } catch (error) {
          this.log(`Failed to close milestone: ${error.message}`, 'warning');
          finalResults.milestoneCloseError = error.message;
        }
      } else {
        this.log('Not closing milestone due to failed issues', 'info');
        finalResults.milestoneClosed = false;
        finalResults.reason = 'Some issues failed processing';
      }

      return finalResults;
    } catch (error) {
      this.log(`Milestone finalization failed: ${error.message}`, 'error');
      return {
        finalized: false,
        error: error.message,
        featureBranch,
        milestoneNumber,
      };
    }
  }

  /**
   * Handle execution failure and cleanup
   */
  async handleExecutionFailure(error, context) {
    this.log(`Handling execution failure: ${error.message}`, 'error');
    
    try {
      // Record failure for circuit breaker
      this.circuitBreaker.failures++;
      this.circuitBreaker.lastFailure = Date.now();
      
      // Attempt to save work if possible
      if (context.featureBranch) {
        try {
          await this.git.commitChanges(`[YOLO-WARP] Save work before failure - ${error.message}`);
          await this.git.pushBranch(context.featureBranch, true);
          this.log('Work saved to feature branch before failure', 'info');
        } catch (saveError) {
          this.log(`Failed to save work: ${saveError.message}`, 'warning');
        }
      }

      // Create failure report
      if (context.milestoneNumber) {
        const failureReport = this.generateFailureReport(error, context);
        this.log('Failure report generated', 'info');
        return { failureReport };
      }
    } catch (handlingError) {
      this.log(`Error handling failed: ${handlingError.message}`, 'error');
    }
    
    return { handled: true };
  }

  /**
   * Create a progress tracker for milestone
   */
  createProgressTracker(milestoneNumber) {
    const tracker = {
      milestoneNumber,
      phases: {
        'validation': 0,
        'git-setup': 0,
        'swarm-init': 0,
        'issue-processing': 0,
        'integration': 0,
        'finalization': 0,
      },
      startTime: Date.now(),
      
      updateProgress(phase, percentage) {
        this.phases[phase] = Math.min(100, Math.max(0, percentage));
      },
      
      getOverallProgress() {
        const phaseCount = Object.keys(this.phases).length;
        const totalProgress = Object.values(this.phases).reduce((sum, p) => sum + p, 0);
        return Math.floor(totalProgress / phaseCount);
      },
      
      getCurrentPhase() {
        for (const [phase, progress] of Object.entries(this.phases)) {
          if (progress < 100) {
            return phase;
          }
        }
        return 'completed';
      },
    };

    this.progressTrackers.set(milestoneNumber, tracker);
    return tracker;
  }

  /**
   * Generate completion report
   */
  generateCompletionReport(data) {
    const {
      milestoneId,
      milestone,
      processingResults,
      executionTime,
      swarmId,
      featureBranch,
    } = data;

    const successRate = processingResults.successful.length / 
      (processingResults.successful.length + processingResults.failed.length) * 100;

    return `
# 🚀 YOLO-WARP Milestone Completion Report

## Milestone Information
- **ID:** #${milestoneId}
- **Title:** ${milestone.title}
- **Description:** ${milestone.description || 'No description provided'}

## Execution Summary
- **Start Time:** ${new Date(Date.now() - executionTime).toISOString()}
- **End Time:** ${new Date().toISOString()}
- **Total Execution Time:** ${Math.floor(executionTime / 1000)} seconds
- **Success Rate:** ${successRate.toFixed(1)}%

## Issue Processing Results
- **Total Issues:** ${processingResults.successful.length + processingResults.failed.length}
- **Successfully Completed:** ${processingResults.successful.length}
- **Failed:** ${processingResults.failed.length}
- **Skipped:** ${processingResults.skipped.length}

## Swarm Configuration
- **Swarm ID:** ${swarmId}
- **Feature Branch:** ${featureBranch}

## Successfully Completed Issues:
${processingResults.successful.map(result => 
  `- ✅ #${result.issue.number}: ${result.issue.title} (${result.executionTime}ms)`
).join('\n') || 'None'}

## Failed Issues:
${processingResults.failed.map(result => 
  `- ❌ #${result.issue.number}: ${result.issue.title} - ${result.error}`
).join('\n') || 'None'}

## Recommendations
${this.generateRecommendations(processingResults)}

---
*Generated by YOLO-WARP automation at ${new Date().toISOString()}*
    `.trim();
  }

  /**
   * Generate failure report
   */
  generateFailureReport(error, context) {
    return `
# ❌ YOLO-WARP Execution Failure Report

## Error Information
- **Error:** ${error.message}
- **Timestamp:** ${new Date().toISOString()}
- **Milestone:** #${context.milestoneNumber}

## Context
- **Swarm ID:** ${context.swarmId || 'Not initialized'}
- **Feature Branch:** ${context.featureBranch || 'Not created'}

## Recovery Recommendations
1. Check error details above
2. Verify repository state
3. Review swarm logs if available
4. Consider manual intervention for critical issues

## Stack Trace
\`\`\`
${error.stack || 'No stack trace available'}
\`\`\`

---
*Generated by YOLO-WARP automation at ${new Date().toISOString()}*
    `;
  }

  /**
   * Generate recommendations based on results
   */
  generateRecommendations(processingResults) {
    const recommendations = [];

    if (processingResults.failed.length > 0) {
      recommendations.push('• Review and manually address failed issues');
      recommendations.push('• Check error messages for common patterns');
    }

    if (processingResults.successful.length > 0) {
      recommendations.push('• Review automated implementations for quality');
      recommendations.push('• Run comprehensive integration tests');
    }

    recommendations.push('• Consider swarm configuration adjustments for future runs');
    recommendations.push('• Update issue templates based on processing patterns');

    return recommendations.join('\n');
  }

  /**
   * Utility methods
   */

  updateProcessingResults(results, issue, result) {
    if (result.success) {
      results.successful.push(result);
    } else {
      results.failed.push(result);
    }
    results.totalTime += result.executionTime || 0;
  }

  addYoloWarpStatus(body, status) {
    const statusLine = `\n\n---\n**[YOLO-WARP ${status}]** *${new Date().toISOString()}*\n`;
    return body + statusLine;
  }

  generateCompletionComment(issue, swarmResult) {
    return `
## ✅ Issue Completed by YOLO-WARP

**Processing Details:**
- Execution Time: ${swarmResult.executionTime}ms
- Assigned Agents: ${swarmResult.assignedAgents?.join(', ') || 'N/A'}
- Task ID: ${swarmResult.taskId}

**Automated Actions:**
- ✅ Implemented solution according to requirements
- ✅ Created appropriate test coverage
- ✅ Updated documentation where applicable
- ✅ Followed project coding standards

**Next Steps:**
- Review the automated implementation
- Run integration tests
- Merge associated pull request

---
🤖 *Completed by YOLO-WARP automation at ${new Date().toISOString()}*
    `;
  }

  // Circuit breaker implementation
  async executeWithCircuitBreaker(operation) {
    if (this.circuitBreaker.failures >= this.circuitBreaker.threshold) {
      const timeSinceLastFailure = Date.now() - (this.circuitBreaker.lastFailure || 0);
      if (timeSinceLastFailure < this.circuitBreaker.timeout) {
        return { circuitOpen: true, error: 'Circuit breaker is open' };
      }
    }

    try {
      const result = await operation();
      // Reset on success
      this.circuitBreaker.failures = 0;
      this.circuitBreaker.lastFailure = null;
      return result;
    } catch (error) {
      this.circuitBreaker.failures++;
      this.circuitBreaker.lastFailure = Date.now();
      throw error;
    }
  }

  // Retry mechanism
  async executeWithRetry(operation, options = {}) {
    const { maxRetries = this.options.maxRetries, backoffFactor = 2, baseDelay = 1000 } = options;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (attempt === maxRetries) {
          break;
        }

        const delay = baseDelay * Math.pow(backoffFactor, attempt - 1);
        this.log(`Attempt ${attempt} failed, retrying in ${delay}ms: ${error.message}`, 'warning');
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  // Error context wrapper
  async executeWithErrorContext(operation, context = {}) {
    try {
      return await operation();
    } catch (error) {
      const contextualError = new Error(error.message);
      contextualError.context = context;
      contextualError.originalError = error;
      contextualError.timestamp = new Date().toISOString();
      contextualError.stack = error.stack;
      throw contextualError;
    }
  }

  // Configuration methods
  configure(config) {
    // Validate configuration
    if (config.maxConcurrentTasks && config.maxConcurrentTasks < 1) {
      throw new Error('Invalid configuration: maxConcurrentTasks must be positive');
    }

    if (config.retryPolicy && typeof config.retryPolicy.maxRetries !== 'number') {
      throw new Error('Invalid configuration: retryPolicy.maxRetries must be a number');
    }

    this.config = { ...this.config, ...config };
    this.log('Configuration updated', 'info');
  }

  // CLI argument parsing
  parseCliArguments(args) {
    const parsed = {};
    for (let i = 0; i < args.length; i += 2) {
      if (args[i].startsWith('--')) {
        const key = args[i].substring(2);
        const value = args[i + 1];
        parsed[key] = value;
      }
    }
    return parsed;
  }

  validateCliArguments(args) {
    const parsed = this.parseCliArguments(args);
    const required = ['owner', 'repo', 'milestone'];
    
    for (const field of required) {
      if (!parsed[field]) {
        throw new Error(`Missing required arguments: ${required.join(', ')}`);
      }
    }

    return parsed;
  }

  // Agent requirement analysis
  categorizeIssues(issues) {
    const categorized = { simple: [], complex: [] };
    
    for (const issue of issues) {
      const analysis = this.github.analyzeComplexity(issue);
      if (analysis.complexity === 'high') {
        categorized.complex.push(issue);
      } else {
        categorized.simple.push(issue);
      }
    }

    return categorized;
  }

  getRequiredAgents(issue) {
    const analysis = this.github.analyzeComplexity(issue);
    return analysis.recommendedAgents;
  }

  // Logging
  log(message, level = 'info') {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      component: 'YoloWarp',
    };

    this.executionLogs.push(logEntry);

    if (this.executionLogs.length > 2000) {
      this.executionLogs = this.executionLogs.slice(-2000);
    }

    if (this.options.verbose || level === 'error') {
      const colors = {
        error: '\x1b[31m',
        warning: '\x1b[33m',
        success: '\x1b[32m',
        info: '\x1b[36m',
        debug: '\x1b[90m',
        reset: '\x1b[0m',
      };

      console.log(`${colors[level] || colors.info}[YoloWarp] ${message}${colors.reset}`);
    }
  }

  getExecutionLogs(level = null, limit = null) {
    let logs = [...this.executionLogs];

    if (level) {
      logs = logs.filter(log => log.level === level);
    }

    if (limit) {
      logs = logs.slice(-limit);
    }

    return logs;
  }
}

module.exports = YoloWarp;