const { GitHubClient } = require('./clients/github-client');
const { RepositoryOperations } = require('./operations/repository');
const { IssueOperations } = require('./operations/issues');
const { PullRequestOperations } = require('./operations/pull-requests');

/**
 * Main GitHub Integration Client
 * Production-ready client with comprehensive GitHub API operations
 */
class GitHubIntegrationClient {
  constructor(config = {}) {
    this.client = new GitHubClient(config);
    
    // Initialize operation modules
    this.repositories = new RepositoryOperations(this.client);
    this.issues = new IssueOperations(this.client);
    this.pullRequests = new PullRequestOperations(this.client);
  }

  /**
   * Validate authentication and get user info
   */
  async authenticate() {
    return await this.client.validateToken();
  }

  /**
   * Get client metrics and performance stats
   */
  getMetrics() {
    return this.client.getMetrics();
  }

  /**
   * Get client status and health information
   */
  getStatus() {
    const metrics = this.getMetrics();
    const rateLimit = metrics.rateLimit;
    
    return {
      authenticated: this.client.isAuthenticated(),
      rateLimit: {
        remaining: rateLimit.github?.remaining || 0,
        limit: rateLimit.github?.limit || 5000,
        reset: rateLimit.github?.resetAt,
        canMakeRequest: rateLimit.canMakeRequest
      },
      performance: {
        totalRequests: metrics.requests?.total || 0,
        successRate: metrics.requests?.successRate || 0,
        averageResponseTime: metrics.responses?.averageTime || 0,
        cacheHitRate: metrics.cache?.hitRate || 0
      },
      health: this.calculateHealthScore(metrics)
    };
  }

  /**
   * Reset client state and metrics
   */
  reset() {
    this.client.reset();
  }

  /**
   * Gracefully shutdown client
   */
  async shutdown() {
    await this.client.shutdown();
  }

  // Convenience methods for common operations

  /**
   * Quick repository info
   */
  async getRepo(owner, repo) {
    return await this.repositories.getRepository(owner, repo);
  }

  /**
   * Quick issue creation
   */
  async createIssue(owner, repo, title, body = '', options = {}) {
    return await this.issues.createIssue(owner, repo, {
      title,
      body,
      ...options
    });
  }

  /**
   * Quick pull request creation
   */
  async createPullRequest(owner, repo, title, head, base, body = '', options = {}) {
    return await this.pullRequests.createPullRequest(owner, repo, {
      title,
      head,
      base,
      body,
      ...options
    });
  }

  /**
   * Search across issues and PRs
   */
  async search(query, type = 'all') {
    const results = {};

    if (type === 'all' || type === 'issues') {
      try {
        results.issues = await this.issues.searchIssues(query);
      } catch (error) {
        results.issues = { error: error.message };
      }
    }

    if (type === 'all' || type === 'pullRequests') {
      try {
        results.pullRequests = await this.pullRequests.searchPullRequests(query);
      } catch (error) {
        results.pullRequests = { error: error.message };
      }
    }

    if (type === 'all' || type === 'repositories') {
      try {
        results.repositories = await this.repositories.searchRepositories(query);
      } catch (error) {
        results.repositories = { error: error.message };
      }
    }

    return results;
  }

  /**
   * Get comprehensive repository analytics
   */
  async getRepositoryAnalytics(owner, repo) {
    const [repoInfo, statistics, insights] = await Promise.allSettled([
      this.repositories.getRepository(owner, repo),
      this.repositories.getStatistics(owner, repo),
      this.repositories.getInsights(owner, repo)
    ]);

    return {
      repository: repoInfo.status === 'fulfilled' ? repoInfo.value : null,
      statistics: statistics.status === 'fulfilled' ? statistics.value : null,
      insights: insights.status === 'fulfilled' ? insights.value : null,
      errors: [
        repoInfo.status === 'rejected' ? repoInfo.reason : null,
        statistics.status === 'rejected' ? statistics.reason : null,
        insights.status === 'rejected' ? insights.reason : null
      ].filter(Boolean)
    };
  }

  /**
   * Batch operations across multiple repositories
   */
  async batchRepositoryOperation(repositories, operation, options = {}) {
    return await this.repositories.batchOperation(repositories, operation, options);
  }

  // Private helper methods

  /**
   * Calculate overall health score based on metrics
   */
  calculateHealthScore(metrics) {
    let score = 100;
    
    // Penalize for low success rate
    if (metrics.requests?.successRate < 95) {
      score -= (95 - metrics.requests.successRate) * 2;
    }

    // Penalize for slow response times
    if (metrics.responses?.averageTime > 2000) {
      score -= Math.min(30, (metrics.responses.averageTime - 2000) / 100);
    }

    // Penalize for low cache hit rate
    if (metrics.cache?.hitRate < 60 && (metrics.cache?.hits + metrics.cache?.misses) > 0) {
      score -= (60 - metrics.cache.hitRate) * 0.5;
    }

    // Penalize for frequent rate limiting
    if (metrics.rateLimit?.delays > metrics.requests?.total * 0.1) {
      score -= 20;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }
}

module.exports = {
  GitHubIntegrationClient,
  GitHubClient,
  RepositoryOperations,
  IssueOperations,
  PullRequestOperations
};