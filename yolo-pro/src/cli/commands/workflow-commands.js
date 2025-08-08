/**
 * YOLO-PRO Workflow Management Commands
 * CLI commands for YOLO-PRO workflow operations
 */

class WorkflowCommands {
  constructor(options = {}) {
    this.gitHubClient = options.gitHubClient;
    this.patternLibrary = options.patternLibrary;
    
    this.description = 'YOLO-PRO workflow and process management';
    this.usage = 'yolo-pro workflow <subcommand> [options]';
    this.subcommands = [
      {
        name: 'init-wcp',
        description: 'Initialize Work Chunking Protocol',
        usage: 'yolo-pro workflow init-wcp --epic <title> --features <list> [--milestone <name>]',
        parameters: [
          { name: '--epic', description: 'Epic title (required)' },
          { name: '--features', description: 'Comma-separated list of features' },
          { name: '--milestone', description: 'Milestone name' }
        ]
      },
      {
        name: 'sparc-phase',
        description: 'Execute SPARC methodology phase',
        usage: 'yolo-pro workflow sparc-phase <phase> --issue <number> [--requirements <text>]',
        parameters: [
          { name: 'phase', description: 'SPARC phase (specification, pseudocode, architecture, refinement, completion)' },
          { name: '--issue', description: 'Issue number to apply phase to' },
          { name: '--requirements', description: 'Phase-specific requirements' }
        ]
      },
      {
        name: 'ci-status',
        description: 'Check CI protocol status',
        usage: 'yolo-pro workflow ci-status [--branch <branch>] [--workflow <name>]',
        parameters: [
          { name: '--branch', description: 'Specific branch to check (default: current)' },
          { name: '--workflow', description: 'Specific workflow name to check' }
        ]
      },
      {
        name: 'cd-deploy',
        description: 'Execute Continuous Deployment protocol',
        usage: 'yolo-pro workflow cd-deploy <environment> [--workflow <file>] [--ref <ref>]',
        parameters: [
          { name: 'environment', description: 'Target environment (staging, production)' },
          { name: '--workflow', description: 'Deployment workflow file' },
          { name: '--ref', description: 'Git reference to deploy (default: main)' }
        ]
      }
    ];
    
    this.examples = [
      'yolo-pro workflow init-wcp --epic "User Authentication" --features "login,logout,registration"',
      'yolo-pro workflow sparc-phase specification --issue 123 --requirements "User login feature"',
      'yolo-pro workflow ci-status',
      'yolo-pro workflow cd-deploy staging --workflow deploy.yml'
    ];
  }

  async execute(context) {
    const { subcommand, arguments: args, options, flags } = context;
    
    try {
      switch (subcommand) {
        case 'init-wcp':
          return await this.initWCP(options);
        case 'sparc-phase':
          return await this.sparcPhase(args[0], options);
        case 'ci-status':
          return await this.ciStatus(options);
        case 'cd-deploy':
          return await this.cdDeploy(args[0], options);
        default:
          return {
            success: false,
            error: `Unknown subcommand: ${subcommand}`,
            availableSubcommands: this.subcommands.map(sub => sub.name)
          };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        type: 'execution-error'
      };
    }
  }

  async initWCP(options = {}) {
    try {
      if (!options.epic) {
        return {
          success: false,
          error: 'Epic title is required',
          usage: 'yolo-pro workflow init-wcp --epic <title> --features <list>'
        };
      }

      if (!this.gitHubClient || !this.gitHubClient.octokit) {
        throw new Error('GitHub client not configured');
      }

      const results = {
        success: true,
        epic: null,
        milestone: null,
        features: [],
        issues: []
      };

      // Create milestone if specified
      if (options.milestone) {
        const milestoneResult = await this._createMilestone(options.milestone, {
          description: `Milestone for Epic: ${options.epic}`
        });
        
        if (milestoneResult.success) {
          results.milestone = milestoneResult.milestone;
        } else {
          return {
            success: false,
            error: `Failed to create milestone: ${milestoneResult.error}`
          };
        }
      }

      // Create epic issue
      const epicResult = await this._createEpicIssue(options.epic, {
        milestone: results.milestone?.number,
        features: options.features
      });
      
      if (!epicResult.success) {
        return {
          success: false,
          error: `Failed to create epic: ${epicResult.error}`
        };
      }
      
      results.epic = epicResult.issue;

      // Create feature issues if features provided
      if (options.features) {
        const featuresList = options.features.split(',').map(f => f.trim());
        
        for (const feature of featuresList) {
          const featureResult = await this._createFeatureIssue(feature, {
            epic: results.epic.number,
            milestone: results.milestone?.number
          });
          
          if (featureResult.success) {
            results.features.push(featureResult.issue);
            results.issues.push(featureResult.issue);
          }
        }
      }

      return {
        ...results,
        message: `WCP initialized: Epic #${results.epic.number} with ${results.features.length} features`,
        summary: {
          epic: results.epic.number,
          milestone: results.milestone?.number,
          features: results.features.length,
          totalIssues: results.issues.length
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        type: 'wcp-init-error'
      };
    }
  }

  async sparcPhase(phase, options = {}) {
    try {
      const validPhases = ['specification', 'pseudocode', 'architecture', 'refinement', 'completion'];
      
      if (!phase || !validPhases.includes(phase)) {
        return {
          success: false,
          error: `Invalid SPARC phase. Valid phases: ${validPhases.join(', ')}`,
          usage: 'yolo-pro workflow sparc-phase <phase> --issue <number>'
        };
      }

      if (!options.issue) {
        return {
          success: false,
          error: 'Issue number is required',
          usage: 'yolo-pro workflow sparc-phase <phase> --issue <number>'
        };
      }

      // Generate phase-specific content using pattern library
      let generatedContent = '';
      if (this.patternLibrary) {
        const patternId = `sparc-${phase}`;
        try {
          generatedContent = this.patternLibrary.generateFromPattern(patternId, {
            name: options.requirements || `${phase} phase`,
            requirements: options.requirements || '',
            criteria: '',
            dependencies: ''
          });
        } catch (error) {
          // Pattern not found, continue without generated content
        }
      }

      // Update issue with SPARC phase label and content
      const updateResult = await this._updateIssueForSparcPhase(
        parseInt(options.issue),
        phase,
        generatedContent,
        options
      );

      if (!updateResult.success) {
        return {
          success: false,
          error: `Failed to update issue for SPARC phase: ${updateResult.error}`
        };
      }

      return {
        success: true,
        phase,
        issue: updateResult.issue,
        generatedContent: generatedContent.length > 0 ? generatedContent : null,
        message: `SPARC ${phase} phase applied to issue #${options.issue}`,
        nextPhase: this._getNextSparcPhase(phase)
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        type: 'sparc-phase-error'
      };
    }
  }

  async ciStatus(options = {}) {
    try {
      if (!this.gitHubClient || !this.gitHubClient.octokit) {
        throw new Error('GitHub client not configured');
      }

      // Get workflow runs
      const queryParams = {
        owner: this.gitHubClient.options.owner,
        repo: this.gitHubClient.options.repo,
        per_page: 20
      };

      if (options.branch) {
        queryParams.branch = options.branch;
      }

      const response = await this.gitHubClient.octokit.rest.actions.listWorkflowRuns(queryParams);
      const runs = response.data.workflow_runs;

      // Filter by specific workflow if requested
      let filteredRuns = runs;
      if (options.workflow) {
        filteredRuns = runs.filter(run => run.name === options.workflow);
      }

      // Analyze CI status
      const summary = {
        total: filteredRuns.length,
        success: filteredRuns.filter(run => run.conclusion === 'success').length,
        failure: filteredRuns.filter(run => run.conclusion === 'failure').length,
        pending: filteredRuns.filter(run => run.status === 'in_progress' || run.status === 'queued').length,
        cancelled: filteredRuns.filter(run => run.conclusion === 'cancelled').length
      };

      // Calculate success rate
      const completedRuns = summary.success + summary.failure + summary.cancelled;
      const successRate = completedRuns > 0 ? Math.round((summary.success / completedRuns) * 100) : 0;

      const recentRuns = filteredRuns.slice(0, 10).map(run => ({
        id: run.id,
        name: run.name,
        status: run.status,
        conclusion: run.conclusion,
        branch: run.head_branch,
        commit: run.head_sha.substring(0, 7),
        createdAt: run.created_at,
        updatedAt: run.updated_at,
        url: run.html_url
      }));

      return {
        success: true,
        summary,
        successRate,
        recentRuns,
        filters: {
          branch: options.branch,
          workflow: options.workflow
        },
        message: `CI Status: ${successRate}% success rate (${summary.success}/${completedRuns} passing)`
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        type: 'ci-status-error'
      };
    }
  }

  async cdDeploy(environment, options = {}) {
    try {
      if (!environment) {
        return {
          success: false,
          error: 'Deployment environment is required',
          usage: 'yolo-pro workflow cd-deploy <environment> [--workflow <file>]'
        };
      }

      const validEnvironments = ['staging', 'production'];
      if (!validEnvironments.includes(environment)) {
        return {
          success: false,
          error: `Invalid environment. Valid environments: ${validEnvironments.join(', ')}`
        };
      }

      if (!this.gitHubClient || !this.gitHubClient.octokit) {
        throw new Error('GitHub client not configured');
      }

      const workflowFile = options.workflow || 'deploy.yml';
      const ref = options.ref || 'main';

      // Trigger deployment workflow
      const dispatchResult = await this.gitHubClient.octokit.rest.actions.createWorkflowDispatch({
        owner: this.gitHubClient.options.owner,
        repo: this.gitHubClient.options.repo,
        workflow_id: workflowFile,
        ref,
        inputs: {
          environment,
          ...options.inputs
        }
      });

      // Get recent workflow runs to find the triggered deployment
      const runsResponse = await this.gitHubClient.octokit.rest.actions.listWorkflowRuns({
        owner: this.gitHubClient.options.owner,
        repo: this.gitHubClient.options.repo,
        workflow_id: workflowFile,
        per_page: 5
      });

      const recentRun = runsResponse.data.workflow_runs[0];

      return {
        success: true,
        deployment: {
          environment,
          workflow: workflowFile,
          ref,
          run: recentRun ? {
            id: recentRun.id,
            status: recentRun.status,
            url: recentRun.html_url,
            createdAt: recentRun.created_at
          } : null
        },
        message: `Deployment to ${environment} initiated using workflow ${workflowFile}`
      };

    } catch (error) {
      if (error.status === 404) {
        return {
          success: false,
          error: `Workflow file '${options.workflow || 'deploy.yml'}' not found`,
          type: 'workflow-not-found'
        };
      }

      return {
        success: false,
        error: error.message,
        type: 'cd-deploy-error'
      };
    }
  }

  // Helper methods

  async _createMilestone(title, options = {}) {
    try {
      const response = await this.gitHubClient.octokit.rest.issues.createMilestone({
        owner: this.gitHubClient.options.owner,
        repo: this.gitHubClient.options.repo,
        title,
        description: options.description || '',
        due_on: options.dueDate
      });

      return {
        success: true,
        milestone: {
          id: response.data.id,
          number: response.data.number,
          title: response.data.title,
          url: response.data.html_url
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async _createEpicIssue(title, options = {}) {
    try {
      const body = this._generateEpicBody(title, options);
      
      const response = await this.gitHubClient.octokit.rest.issues.create({
        owner: this.gitHubClient.options.owner,
        repo: this.gitHubClient.options.repo,
        title: `EPIC: ${title}`,
        body,
        labels: ['epic', 'yolo-pro'],
        milestone: options.milestone
      });

      return {
        success: true,
        issue: {
          number: response.data.number,
          title: response.data.title,
          url: response.data.html_url
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async _createFeatureIssue(title, options = {}) {
    try {
      const body = this._generateFeatureBody(title, options);
      
      const response = await this.gitHubClient.octokit.rest.issues.create({
        owner: this.gitHubClient.options.owner,
        repo: this.gitHubClient.options.repo,
        title: `Feature: ${title}`,
        body,
        labels: ['feature', 'yolo-pro'],
        milestone: options.milestone
      });

      return {
        success: true,
        issue: {
          number: response.data.number,
          title: response.data.title,
          url: response.data.html_url
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async _updateIssueForSparcPhase(issueNumber, phase, generatedContent, options) {
    try {
      // Add SPARC phase label
      const labelName = `sparc:${phase}`;
      
      // Update issue body with generated content if available
      let updateData = {
        owner: this.gitHubClient.options.owner,
        repo: this.gitHubClient.options.repo,
        issue_number: issueNumber
      };

      if (generatedContent) {
        // Get current issue to append content
        const currentIssue = await this.gitHubClient.octokit.rest.issues.get({
          owner: this.gitHubClient.options.owner,
          repo: this.gitHubClient.options.repo,
          issue_number: issueNumber
        });

        updateData.body = `${currentIssue.data.body}\n\n## SPARC ${phase.toUpperCase()} Phase\n\n${generatedContent}`;
      }

      // Update issue
      const response = await this.gitHubClient.octokit.rest.issues.update(updateData);

      // Add label
      await this.gitHubClient.octokit.rest.issues.addLabels({
        owner: this.gitHubClient.options.owner,
        repo: this.gitHubClient.options.repo,
        issue_number: issueNumber,
        labels: [labelName]
      });

      return {
        success: true,
        issue: {
          number: response.data.number,
          title: response.data.title,
          url: response.data.html_url
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  _getNextSparcPhase(currentPhase) {
    const phases = ['specification', 'pseudocode', 'architecture', 'refinement', 'completion'];
    const currentIndex = phases.indexOf(currentPhase);
    
    if (currentIndex >= 0 && currentIndex < phases.length - 1) {
      return phases[currentIndex + 1];
    }
    
    return null; // No next phase (completion is the last)
  }

  _generateEpicBody(title, options) {
    const features = options.features ? options.features.split(',').map(f => f.trim()) : [];
    
    return `# EPIC: ${title}

## Objective
${title}

## Features
${features.map(f => `- [ ] ${f}`).join('\n')}

## Success Criteria
- [ ] All features implemented and tested
- [ ] CI/CD pipeline passing 100%
- [ ] Documentation complete

## Dependencies
- Repository setup and configuration
- Team assignment and coordination

---
*Generated by YOLO-PRO Work Chunking Protocol*`;
  }

  _generateFeatureBody(title, options) {
    return `# Feature: ${title}
**Parent Epic**: ${options.epic ? `#${options.epic}` : 'TBD'}

## Description
${title} implementation

## Acceptance Criteria
- [ ] Feature functionality complete
- [ ] Tests pass (100% CI)
- [ ] Code review approved
- [ ] Documentation updated

## Implementation Tasks
- [ ] Design and specification
- [ ] Core implementation
- [ ] Testing and validation
- [ ] Integration and deployment

---
*Generated by YOLO-PRO Work Chunking Protocol*`;
  }
}

module.exports = WorkflowCommands;