/**
 * YOLO-PRO Issue Management Commands
 * CLI commands for GitHub issue operations
 */

class IssueCommands {
  constructor(options = {}) {
    this.gitHubClient = options.gitHubClient;
    this.labelManager = options.labelManager;
    
    this.description = 'GitHub issue management operations';
    this.usage = 'yolo-pro issue <subcommand> [options]';
    this.subcommands = [
      {
        name: 'list',
        description: 'List issues with filtering options',
        usage: 'yolo-pro issue list [--state <state>] [--label <labels>] [--assignee <user>]',
        parameters: [
          { name: '--state', description: 'Filter by state (open, closed, all)' },
          { name: '--label', description: 'Filter by labels (comma-separated)' },
          { name: '--assignee', description: 'Filter by assignee' },
          { name: '--milestone', description: 'Filter by milestone' },
          { name: '--limit', description: 'Maximum number of issues (default: 30)' }
        ]
      },
      {
        name: 'create',
        description: 'Create a new issue',
        usage: 'yolo-pro issue create --title <title> [--body <body>] [--labels <labels>] [--assignee <user>]',
        parameters: [
          { name: '--title', description: 'Issue title (required)' },
          { name: '--body', description: 'Issue body/description' },
          { name: '--labels', description: 'Comma-separated list of labels' },
          { name: '--assignee', description: 'Assign to user' },
          { name: '--milestone', description: 'Milestone number' },
          { name: '--template', description: 'Use issue template' }
        ]
      },
      {
        name: 'update',
        description: 'Update an existing issue',
        usage: 'yolo-pro issue update <number> [--title <title>] [--body <body>] [--state <state>]',
        parameters: [
          { name: 'number', description: 'Issue number (required)' },
          { name: '--title', description: 'New title' },
          { name: '--body', description: 'New body' },
          { name: '--state', description: 'New state (open, closed)' },
          { name: '--add-labels', description: 'Labels to add' },
          { name: '--remove-labels', description: 'Labels to remove' }
        ]
      },
      {
        name: 'search',
        description: 'Search issues with advanced filtering',
        usage: 'yolo-pro issue search <query> [--state <state>] [--labels <labels>]',
        parameters: [
          { name: 'query', description: 'Search query' },
          { name: '--state', description: 'Filter by state' },
          { name: '--labels', description: 'Filter by labels' },
          { name: '--assignee', description: 'Filter by assignee' },
          { name: '--author', description: 'Filter by author' }
        ]
      },
      {
        name: 'bulk-label',
        description: 'Add labels to multiple issues',
        usage: 'yolo-pro issue bulk-label <numbers...> <labels...>',
        parameters: [
          { name: 'numbers', description: 'Issue numbers (space-separated)' },
          { name: 'labels', description: 'Labels to add (space-separated)' }
        ]
      }
    ];
    
    this.examples = [
      'yolo-pro issue list --state open',
      'yolo-pro issue list --label "bug,priority:high"',
      'yolo-pro issue create --title "New feature" --labels "feature,priority:medium"',
      'yolo-pro issue update 123 --state closed',
      'yolo-pro issue search "authentication" --state open',
      'yolo-pro issue bulk-label 123 124 125 priority:high'
    ];
  }

  async execute(context) {
    const { subcommand, arguments: args, options, flags } = context;
    
    try {
      switch (subcommand) {
        case 'list':
          return await this.list(options);
        case 'create':
          return await this.create(options);
        case 'update':
          return await this.update(parseInt(args[0]), options);
        case 'search':
          return await this.search(args[0], options);
        case 'bulk-label':
          return await this.bulkLabel(this._parseNumbers(args), this._parseLabels(args));
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

  async list(options = {}) {
    try {
      if (!this.gitHubClient || !this.gitHubClient.octokit) {
        throw new Error('GitHub client not configured');
      }

      const queryParams = {
        owner: this.gitHubClient.options.owner,
        repo: this.gitHubClient.options.repo,
        state: options.state || 'open',
        per_page: parseInt(options.limit) || 30
      };

      // Add optional filters
      if (options.assignee) {
        queryParams.assignee = options.assignee;
      }
      
      if (options.milestone) {
        queryParams.milestone = options.milestone;
      }
      
      if (options.labels) {
        queryParams.labels = options.labels;
      }

      const response = await this.gitHubClient.octokit.rest.issues.listForRepo(queryParams);
      
      const issues = response.data.map(issue => ({
        number: issue.number,
        title: issue.title,
        state: issue.state,
        author: issue.user.login,
        assignees: issue.assignees.map(a => a.login),
        labels: issue.labels.map(l => l.name),
        milestone: issue.milestone ? issue.milestone.title : null,
        createdAt: issue.created_at,
        updatedAt: issue.updated_at,
        url: issue.html_url
      }));

      return {
        success: true,
        issues,
        total: issues.length,
        filters: {
          state: queryParams.state,
          assignee: queryParams.assignee,
          milestone: queryParams.milestone,
          labels: queryParams.labels
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        type: 'api-error'
      };
    }
  }

  async create(options = {}) {
    try {
      if (!options.title) {
        return {
          success: false,
          error: 'Issue title is required',
          usage: 'yolo-pro issue create --title <title> [--body <body>] [--labels <labels>]'
        };
      }

      if (!this.gitHubClient || !this.gitHubClient.octokit) {
        throw new Error('GitHub client not configured');
      }

      const issueData = {
        owner: this.gitHubClient.options.owner,
        repo: this.gitHubClient.options.repo,
        title: options.title,
        body: options.body || ''
      };

      // Add optional fields
      if (options.assignee) {
        issueData.assignees = [options.assignee];
      }
      
      if (options.milestone) {
        issueData.milestone = parseInt(options.milestone);
      }

      // Create the issue
      const response = await this.gitHubClient.octokit.rest.issues.create(issueData);
      const issue = response.data;

      // Add labels if specified
      let labelResult = null;
      if (options.labels && this.labelManager) {
        const labelsArray = options.labels.split(',').map(l => l.trim());
        labelResult = await this.labelManager.addLabelsToIssue(issue.number, labelsArray, {
          createMissing: true
        });
      }

      return {
        success: true,
        issue: {
          number: issue.number,
          title: issue.title,
          state: issue.state,
          url: issue.html_url
        },
        labels: labelResult ? {
          added: labelResult.added,
          created: labelResult.created,
          errors: labelResult.errors
        } : null,
        message: `Issue #${issue.number} created successfully`
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        type: 'creation-error'
      };
    }
  }

  async update(issueNumber, options = {}) {
    try {
      if (!issueNumber || isNaN(issueNumber)) {
        return {
          success: false,
          error: 'Valid issue number is required',
          usage: 'yolo-pro issue update <number> [--title <title>] [--body <body>]'
        };
      }

      if (!this.gitHubClient || !this.gitHubClient.octokit) {
        throw new Error('GitHub client not configured');
      }

      const updateData = {
        owner: this.gitHubClient.options.owner,
        repo: this.gitHubClient.options.repo,
        issue_number: issueNumber
      };

      // Add fields to update
      if (options.title) updateData.title = options.title;
      if (options.body) updateData.body = options.body;
      if (options.state) updateData.state = options.state;
      
      // Update the issue
      const response = await this.gitHubClient.octokit.rest.issues.update(updateData);
      
      // Handle label updates
      const labelResults = {};
      
      if (options['add-labels'] && this.labelManager) {
        const labelsToAdd = options['add-labels'].split(',').map(l => l.trim());
        labelResults.added = await this.labelManager.addLabelsToIssue(issueNumber, labelsToAdd, {
          createMissing: true
        });
      }
      
      if (options['remove-labels'] && this.labelManager) {
        const labelsToRemove = options['remove-labels'].split(',').map(l => l.trim());
        labelResults.removed = await this.labelManager.removeLabelsFromIssue(issueNumber, labelsToRemove);
      }

      return {
        success: true,
        issue: {
          number: response.data.number,
          title: response.data.title,
          state: response.data.state,
          url: response.data.html_url
        },
        labelUpdates: labelResults,
        message: `Issue #${issueNumber} updated successfully`
      };

    } catch (error) {
      if (error.status === 404) {
        return {
          success: false,
          error: `Issue #${issueNumber} not found`,
          type: 'not-found'
        };
      }
      
      return {
        success: false,
        error: error.message,
        type: 'update-error'
      };
    }
  }

  async search(query, options = {}) {
    try {
      if (!query) {
        return {
          success: false,
          error: 'Search query is required',
          usage: 'yolo-pro issue search <query> [--state <state>] [--labels <labels>]'
        };
      }

      if (!this.gitHubClient || !this.gitHubClient.octokit) {
        throw new Error('GitHub client not configured');
      }

      // Build search query
      let searchQuery = `${query} repo:${this.gitHubClient.options.owner}/${this.gitHubClient.options.repo}`;
      
      if (options.state) {
        searchQuery += ` state:${options.state}`;
      }
      
      if (options.labels) {
        const labels = options.labels.split(',').map(l => l.trim());
        labels.forEach(label => {
          searchQuery += ` label:"${label}"`;
        });
      }
      
      if (options.assignee) {
        searchQuery += ` assignee:${options.assignee}`;
      }
      
      if (options.author) {
        searchQuery += ` author:${options.author}`;
      }

      const response = await this.gitHubClient.octokit.rest.search.issuesAndPullRequests({
        q: searchQuery,
        per_page: 100
      });

      const issues = response.data.items
        .filter(item => !item.pull_request) // Exclude pull requests
        .map(issue => ({
          number: issue.number,
          title: issue.title,
          state: issue.state,
          author: issue.user.login,
          labels: issue.labels.map(l => l.name),
          createdAt: issue.created_at,
          updatedAt: issue.updated_at,
          url: issue.html_url
        }));

      return {
        success: true,
        issues,
        total: issues.length,
        query: searchQuery,
        searchResults: response.data.total_count
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        type: 'search-error'
      };
    }
  }

  async bulkLabel(issueNumbers, labels) {
    try {
      if (!Array.isArray(issueNumbers) || issueNumbers.length === 0) {
        return {
          success: false,
          error: 'At least one issue number is required',
          usage: 'yolo-pro issue bulk-label <numbers...> <labels...>'
        };
      }

      if (!Array.isArray(labels) || labels.length === 0) {
        return {
          success: false,
          error: 'At least one label is required',
          usage: 'yolo-pro issue bulk-label <numbers...> <labels...>'
        };
      }

      if (!this.labelManager) {
        throw new Error('Label manager not configured');
      }

      const results = {
        success: true,
        processed: 0,
        successful: [],
        failed: [],
        errors: []
      };

      for (const issueNumber of issueNumbers) {
        try {
          const labelResult = await this.labelManager.addLabelsToIssue(issueNumber, labels, {
            createMissing: true
          });

          if (labelResult.success) {
            results.successful.push({
              issue: issueNumber,
              added: labelResult.added,
              created: labelResult.created
            });
          } else {
            results.failed.push({
              issue: issueNumber,
              error: labelResult.error
            });
            results.errors.push(`Issue #${issueNumber}: ${labelResult.error}`);
          }

          results.processed++;
        } catch (error) {
          results.failed.push({
            issue: issueNumber,
            error: error.message
          });
          results.errors.push(`Issue #${issueNumber}: ${error.message}`);
        }
      }

      return {
        ...results,
        summary: {
          total: issueNumbers.length,
          successful: results.successful.length,
          failed: results.failed.length,
          labels: labels
        },
        message: `Processed ${results.processed} issues: ${results.successful.length} successful, ${results.failed.length} failed`
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        type: 'bulk-operation-error'
      };
    }
  }

  // Helper methods

  _parseNumbers(args) {
    const numbers = [];
    for (const arg of args) {
      const num = parseInt(arg);
      if (!isNaN(num)) {
        numbers.push(num);
      }
    }
    return numbers;
  }

  _parseLabels(args) {
    const labels = [];
    for (const arg of args) {
      if (isNaN(parseInt(arg))) {
        labels.push(arg);
      }
    }
    return labels;
  }
}

module.exports = IssueCommands;