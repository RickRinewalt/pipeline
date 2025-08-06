const { Octokit } = require('@octokit/rest');
const { retry } = require('@octokit/plugin-retry');
const { throttling } = require('@octokit/plugin-throttling');

const MyOctokit = Octokit.plugin(retry, throttling);

/**
 * GitHub API client wrapper with enhanced functionality for yolo-warp
 */
class GitHubClient {
  constructor({ owner, repo, token }) {
    if (!owner || !repo || !token) {
      throw new Error('Missing required GitHub configuration: owner, repo, token');
    }

    this.owner = owner;
    this.repo = repo;
    this.token = token;

    this.octokit = new MyOctokit({
      auth: token,
      throttle: {
        onRateLimit: (retryAfter, options, octokit) => {
          console.warn(`Request quota exhausted for request ${options.method} ${options.url}`);
          if (options.request.retryCount === 0) {
            console.log(`Retrying after ${retryAfter} seconds!`);
            return true;
          }
        },
        onAbuseLimit: (retryAfter, options, octokit) => {
          console.warn(`Abuse detected for request ${options.method} ${options.url}`);
        },
      },
      retry: {
        doNotRetry: ['429'],
      },
    });
  }

  /**
   * Get milestone by number
   */
  async getMilestone(milestoneNumber) {
    try {
      const response = await this.octokit.rest.issues.getMilestone({
        owner: this.owner,
        repo: this.repo,
        milestone_number: milestoneNumber,
      });
      
      return response.data;
    } catch (error) {
      if (error.status === 404) {
        throw new Error(`Milestone #${milestoneNumber} not found`);
      }
      throw error;
    }
  }

  /**
   * Get all issues for a milestone
   */
  async getIssuesForMilestone(milestoneNumber, state = 'open') {
    try {
      const response = await this.octokit.rest.issues.listForRepo({
        owner: this.owner,
        repo: this.repo,
        milestone: milestoneNumber.toString(),
        state: state,
        sort: 'created',
        direction: 'asc',
        per_page: 100,
      });

      return response.data.filter(issue => !issue.pull_request);
    } catch (error) {
      throw new Error(`Failed to fetch issues for milestone ${milestoneNumber}: ${error.message}`);
    }
  }

  /**
   * Update an issue with new content
   */
  async updateIssue(issueNumber, updates) {
    try {
      const response = await this.octokit.rest.issues.update({
        owner: this.owner,
        repo: this.repo,
        issue_number: issueNumber,
        ...updates,
      });

      return response.data;
    } catch (error) {
      if (error.status === 403) {
        return { rateLimited: true, error: error.message };
      }
      throw error;
    }
  }

  /**
   * Add labels to an issue
   */
  async addLabelsToIssue(issueNumber, labels) {
    try {
      const response = await this.octokit.rest.issues.addLabels({
        owner: this.owner,
        repo: this.repo,
        issue_number: issueNumber,
        labels: labels,
      });

      return response.data;
    } catch (error) {
      console.warn(`Failed to add labels to issue #${issueNumber}:`, error.message);
      return null;
    }
  }

  /**
   * Remove labels from an issue
   */
  async removeLabelsFromIssue(issueNumber, labels) {
    try {
      for (const label of labels) {
        await this.octokit.rest.issues.removeLabel({
          owner: this.owner,
          repo: this.repo,
          issue_number: issueNumber,
          name: label,
        });
      }
      return true;
    } catch (error) {
      console.warn(`Failed to remove labels from issue #${issueNumber}:`, error.message);
      return false;
    }
  }

  /**
   * Create a comment on an issue
   */
  async createComment(issueNumber, body) {
    try {
      const response = await this.octokit.rest.issues.createComment({
        owner: this.owner,
        repo: this.repo,
        issue_number: issueNumber,
        body: body,
      });

      return response.data;
    } catch (error) {
      console.warn(`Failed to create comment on issue #${issueNumber}:`, error.message);
      return null;
    }
  }

  /**
   * Close an issue
   */
  async closeIssue(issueNumber, comment = null) {
    try {
      // Add completion comment if provided
      if (comment) {
        await this.createComment(issueNumber, comment);
      }

      const response = await this.octokit.rest.issues.update({
        owner: this.owner,
        repo: this.repo,
        issue_number: issueNumber,
        state: 'closed',
      });

      return response.data;
    } catch (error) {
      throw new Error(`Failed to close issue #${issueNumber}: ${error.message}`);
    }
  }

  /**
   * Create a pull request
   */
  async createPullRequest({ title, head, base = 'main', body, draft = false }) {
    try {
      const response = await this.octokit.rest.pulls.create({
        owner: this.owner,
        repo: this.repo,
        title: title,
        head: head,
        base: base,
        body: body,
        draft: draft,
      });

      return response.data;
    } catch (error) {
      if (error.message.includes('already exists')) {
        // PR already exists, try to find and return it
        const existingPR = await this.findPullRequest(head, base);
        if (existingPR) {
          return existingPR;
        }
      }
      throw new Error(`Failed to create pull request: ${error.message}`);
    }
  }

  /**
   * Find existing pull request by branch names
   */
  async findPullRequest(head, base = 'main') {
    try {
      const response = await this.octokit.rest.pulls.list({
        owner: this.owner,
        repo: this.repo,
        head: `${this.owner}:${head}`,
        base: base,
        state: 'open',
      });

      return response.data.length > 0 ? response.data[0] : null;
    } catch (error) {
      console.warn(`Failed to find pull request for ${head}:`, error.message);
      return null;
    }
  }

  /**
   * Close a milestone
   */
  async closeMilestone(milestoneNumber) {
    try {
      const response = await this.octokit.rest.issues.updateMilestone({
        owner: this.owner,
        repo: this.repo,
        milestone_number: milestoneNumber,
        state: 'closed',
      });

      return response.data;
    } catch (error) {
      throw new Error(`Failed to close milestone #${milestoneNumber}: ${error.message}`);
    }
  }

  /**
   * Get repository information
   */
  async getRepository() {
    try {
      const response = await this.octokit.rest.repos.get({
        owner: this.owner,
        repo: this.repo,
      });

      return response.data;
    } catch (error) {
      throw new Error(`Failed to get repository information: ${error.message}`);
    }
  }

  /**
   * Check if repository has required permissions
   */
  async validatePermissions() {
    try {
      // Try to get repository to check read access
      await this.getRepository();

      // Try to create a test label to check write access
      try {
        await this.octokit.rest.issues.createLabel({
          owner: this.owner,
          repo: this.repo,
          name: 'yolo-warp-test',
          color: 'ff0000',
          description: 'Test label for YOLO-WARP permissions',
        });

        // Clean up test label
        await this.octokit.rest.issues.deleteLabel({
          owner: this.owner,
          repo: this.repo,
          name: 'yolo-warp-test',
        });

        return { read: true, write: true };
      } catch (writeError) {
        return { read: true, write: false, error: writeError.message };
      }
    } catch (readError) {
      return { read: false, write: false, error: readError.message };
    }
  }

  /**
   * Get issue dependencies by parsing issue body
   */
  parseDependencies(issue) {
    const dependencies = [];
    const dependsOnRegex = /(depends on|blocked by|requires).*?#(\d+)/gi;
    let match;

    while ((match = dependsOnRegex.exec(issue.body || '')) !== null) {
      dependencies.push(parseInt(match[2]));
    }

    return dependencies;
  }

  /**
   * Analyze issue complexity based on labels, body length, and other factors
   */
  analyzeComplexity(issue) {
    let complexity = 'simple';
    let score = 0;

    // Check labels
    const complexityLabels = {
      'feature': 3,
      'enhancement': 2,
      'bug': 1,
      'high-priority': 2,
      'breaking-change': 4,
      'epic': 5,
    };

    for (const label of issue.labels) {
      score += complexityLabels[label.name] || 0;
    }

    // Check body length and content
    if (issue.body) {
      const bodyLength = issue.body.length;
      if (bodyLength > 1000) score += 2;
      else if (bodyLength > 500) score += 1;

      // Check for complexity indicators
      const complexityIndicators = [
        'architecture', 'database', 'migration', 'breaking',
        'multiple', 'components', 'integration', 'api',
      ];

      for (const indicator of complexityIndicators) {
        if (issue.body.toLowerCase().includes(indicator)) {
          score += 1;
        }
      }
    }

    // Determine final complexity
    if (score >= 6) complexity = 'high';
    else if (score >= 3) complexity = 'medium';

    return {
      complexity,
      score,
      estimatedTime: this.estimateTime(complexity),
      recommendedAgents: this.getRecommendedAgents(complexity),
    };
  }

  /**
   * Estimate completion time based on complexity
   */
  estimateTime(complexity) {
    const timeEstimates = {
      'simple': { min: 30, max: 120 }, // 30min - 2h
      'medium': { min: 120, max: 480 }, // 2h - 8h
      'high': { min: 480, max: 1440 }, // 8h - 24h
    };

    return timeEstimates[complexity] || timeEstimates.simple;
  }

  /**
   * Get recommended agent types for complexity level
   */
  getRecommendedAgents(complexity) {
    const agentRecommendations = {
      'simple': ['coder', 'tester'],
      'medium': ['researcher', 'coder', 'tester', 'reviewer'],
      'high': ['architect', 'researcher', 'coder', 'tester', 'reviewer', 'optimizer'],
    };

    return agentRecommendations[complexity] || agentRecommendations.simple;
  }

  /**
   * Batch update multiple issues
   */
  async batchUpdateIssues(updates) {
    const results = [];
    const batchSize = 5; // GitHub rate limiting consideration

    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      
      const batchPromises = batch.map(({ issueNumber, updates }) =>
        this.updateIssue(issueNumber, updates)
          .then(result => ({ issueNumber, success: true, result }))
          .catch(error => ({ issueNumber, success: false, error: error.message }))
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Small delay between batches to be respectful of rate limits
      if (i + batchSize < updates.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  /**
   * Get comprehensive milestone statistics
   */
  async getMilestoneStats(milestoneNumber) {
    try {
      const milestone = await this.getMilestone(milestoneNumber);
      const allIssues = await this.getIssuesForMilestone(milestoneNumber, 'all');
      
      const stats = {
        milestone,
        total: allIssues.length,
        open: allIssues.filter(i => i.state === 'open').length,
        closed: allIssues.filter(i => i.state === 'closed').length,
        complexity: {
          simple: 0,
          medium: 0,
          high: 0,
        },
        estimatedTime: 0,
        dependencies: new Map(),
      };

      // Analyze each issue
      for (const issue of allIssues) {
        const analysis = this.analyzeComplexity(issue);
        stats.complexity[analysis.complexity]++;
        stats.estimatedTime += analysis.estimatedTime.max; // Use max for conservative estimate

        const deps = this.parseDependencies(issue);
        if (deps.length > 0) {
          stats.dependencies.set(issue.number, deps);
        }
      }

      return stats;
    } catch (error) {
      throw new Error(`Failed to get milestone statistics: ${error.message}`);
    }
  }
}

module.exports = GitHubClient;