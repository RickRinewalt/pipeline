/**
 * GitHub API Mock Implementation
 * Comprehensive mock for GitHub API with realistic responses and error handling
 */

class GitHubAPIMock {
  constructor(config = {}) {
    this.config = {
      rateLimitRemaining: 5000,
      rateLimitTotal: 5000,
      simulateNetworkDelay: true,
      networkDelayRange: [50, 200],
      failureRate: 0, // 0-1, probability of random failures
      ...config
    };
    
    // In-memory storage for mock data
    this.storage = {
      users: new Map(),
      repositories: new Map(),
      issues: new Map(),
      pullRequests: new Map(),
      labels: new Map(),
      milestones: new Map(),
      webhooks: new Map()
    };
    
    // Request tracking
    this.requestCount = 0;
    this.requestHistory = [];
    
    // Initialize with default data
    this.initializeDefaultData();
  }
  
  initializeDefaultData() {
    // Default user
    this.storage.users.set('testuser', {
      login: 'testuser',
      id: 12345,
      type: 'User',
      name: 'Test User',
      email: 'test@example.com',
      avatar_url: 'https://avatars.githubusercontent.com/u/12345',
      created_at: '2020-01-01T00:00:00Z',
      updated_at: new Date().toISOString()
    });
    
    // Default repository
    this.storage.repositories.set('testuser/test-repo', {
      id: 67890,
      name: 'test-repo',
      full_name: 'testuser/test-repo',
      owner: {
        login: 'testuser',
        id: 12345
      },
      private: false,
      description: 'Test repository for YOLO-PRO testing',
      default_branch: 'main',
      created_at: '2020-01-01T00:00:00Z',
      updated_at: new Date().toISOString(),
      permissions: {
        admin: true,
        push: true,
        pull: true
      }
    });
    
    // Default labels
    const defaultLabels = [
      { name: 'epic', color: '8B00FF', description: 'Epic-level issue' },
      { name: 'feature', color: '00FF00', description: 'New feature' },
      { name: 'task', color: '0000FF', description: 'Task item' },
      { name: 'bug', color: 'FF0000', description: 'Bug report' },
      { name: 'enhancement', color: 'FFFF00', description: 'Enhancement request' },
      { name: 'documentation', color: '00FFFF', description: 'Documentation' },
      { name: 'priority-high', color: 'FF6600', description: 'High priority' },
      { name: 'priority-medium', color: 'FFCC00', description: 'Medium priority' },
      { name: 'priority-low', color: 'CCCCCC', description: 'Low priority' }
    ];
    
    defaultLabels.forEach((label, index) => {
      this.storage.labels.set(`testuser/test-repo/${label.name}`, {
        id: 100 + index,
        url: `https://api.github.com/repos/testuser/test-repo/labels/${label.name}`,
        ...label
      });
    });
  }
  
  // Simulate network delay
  async simulateDelay() {
    if (!this.config.simulateNetworkDelay) return;
    
    const [min, max] = this.config.networkDelayRange;
    const delay = Math.random() * (max - min) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  
  // Simulate random failures
  simulateFailure() {
    if (Math.random() < this.config.failureRate) {
      const errorTypes = [
        { status: 500, message: 'Internal Server Error' },
        { status: 502, message: 'Bad Gateway' },
        { status: 503, message: 'Service Unavailable' },
        { status: 429, message: 'Rate limit exceeded' }
      ];
      
      const error = errorTypes[Math.floor(Math.random() * errorTypes.length)];
      const apiError = new Error(error.message);
      apiError.status = error.status;
      throw apiError;
    }
  }
  
  // Track request for analytics
  trackRequest(method, endpoint, data) {
    this.requestCount++;
    this.config.rateLimitRemaining = Math.max(0, this.config.rateLimitRemaining - 1);
    
    this.requestHistory.push({
      timestamp: new Date().toISOString(),
      method,
      endpoint,
      data,
      requestNumber: this.requestCount
    });
  }
  
  // User-related mocks
  async getUser(username = 'testuser') {
    await this.simulateDelay();
    this.simulateFailure();
    this.trackRequest('GET', `/users/${username}`);
    
    const user = this.storage.users.get(username);
    if (!user) {
      const error = new Error('Not Found');
      error.status = 404;
      throw error;
    }
    
    return {
      data: user,
      status: 200,
      headers: {
        'x-ratelimit-remaining': this.config.rateLimitRemaining.toString(),
        'x-ratelimit-limit': this.config.rateLimitTotal.toString()
      }
    };
  }
  
  async getAuthenticatedUser() {
    await this.simulateDelay();
    this.simulateFailure();
    this.trackRequest('GET', '/user');
    
    return this.getUser('testuser');
  }
  
  // Repository-related mocks
  async getRepository(owner, repo) {
    await this.simulateDelay();
    this.simulateFailure();
    this.trackRequest('GET', `/repos/${owner}/${repo}`);
    
    const repoKey = `${owner}/${repo}`;
    const repository = this.storage.repositories.get(repoKey);
    
    if (!repository) {
      const error = new Error('Not Found');
      error.status = 404;
      throw error;
    }
    
    return {
      data: repository,
      status: 200,
      headers: {
        'x-ratelimit-remaining': this.config.rateLimitRemaining.toString()
      }
    };
  }
  
  async listRepositories(options = {}) {
    await this.simulateDelay();
    this.simulateFailure();
    this.trackRequest('GET', '/user/repos', options);
    
    const repos = Array.from(this.storage.repositories.values())
      .filter(repo => !options.type || repo.private === (options.type === 'private'))
      .slice(0, options.per_page || 30);
    
    return {
      data: repos,
      status: 200,
      headers: {
        'x-ratelimit-remaining': this.config.rateLimitRemaining.toString()
      }
    };
  }
  
  // Issue-related mocks
  async createIssue(owner, repo, issueData) {
    await this.simulateDelay();
    this.simulateFailure();
    this.trackRequest('POST', `/repos/${owner}/${repo}/issues`, issueData);
    
    const issueId = `${owner}/${repo}/${Date.now()}`;
    const issueNumber = this.storage.issues.size + 1;
    
    const issue = {
      id: Date.now(),
      number: issueNumber,
      title: issueData.title,
      body: issueData.body || '',
      state: 'open',
      labels: issueData.labels || [],
      assignees: issueData.assignees || [],
      milestone: issueData.milestone || null,
      user: {
        login: 'testuser',
        id: 12345
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      html_url: `https://github.com/${owner}/${repo}/issues/${issueNumber}`,
      url: `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`
    };
    
    this.storage.issues.set(issueId, issue);
    
    return {
      data: issue,
      status: 201,
      headers: {
        'x-ratelimit-remaining': this.config.rateLimitRemaining.toString()
      }
    };
  }
  
  async getIssue(owner, repo, issueNumber) {
    await this.simulateDelay();
    this.simulateFailure();
    this.trackRequest('GET', `/repos/${owner}/${repo}/issues/${issueNumber}`);
    
    const issue = Array.from(this.storage.issues.values())
      .find(i => i.number === issueNumber);
    
    if (!issue) {
      const error = new Error('Not Found');
      error.status = 404;
      throw error;
    }
    
    return {
      data: issue,
      status: 200,
      headers: {
        'x-ratelimit-remaining': this.config.rateLimitRemaining.toString()
      }
    };
  }
  
  async listIssues(owner, repo, options = {}) {
    await this.simulateDelay();
    this.simulateFailure();
    this.trackRequest('GET', `/repos/${owner}/${repo}/issues`, options);
    
    let issues = Array.from(this.storage.issues.values());
    
    // Apply filters
    if (options.state) {
      issues = issues.filter(issue => issue.state === options.state);
    }
    
    if (options.labels) {
      const labelNames = options.labels.split(',');
      issues = issues.filter(issue => 
        labelNames.every(label => 
          issue.labels.some(issueLabel => issueLabel.name === label)
        )
      );
    }
    
    // Sort by created date (newest first)
    issues.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    // Paginate
    const page = options.page || 1;
    const perPage = options.per_page || 30;
    const start = (page - 1) * perPage;
    const paginatedIssues = issues.slice(start, start + perPage);
    
    return {
      data: paginatedIssues,
      status: 200,
      headers: {
        'x-ratelimit-remaining': this.config.rateLimitRemaining.toString(),
        'link': this.buildLinkHeader(page, perPage, issues.length, owner, repo, 'issues')
      }
    };
  }
  
  async updateIssue(owner, repo, issueNumber, updateData) {
    await this.simulateDelay();
    this.simulateFailure();
    this.trackRequest('PATCH', `/repos/${owner}/${repo}/issues/${issueNumber}`, updateData);
    
    const issueId = Array.from(this.storage.issues.entries())
      .find(([id, issue]) => issue.number === issueNumber)?.[0];
    
    if (!issueId) {
      const error = new Error('Not Found');
      error.status = 404;
      throw error;
    }
    
    const issue = this.storage.issues.get(issueId);
    const updatedIssue = {
      ...issue,
      ...updateData,
      updated_at: new Date().toISOString()
    };
    
    this.storage.issues.set(issueId, updatedIssue);
    
    return {
      data: updatedIssue,
      status: 200,
      headers: {
        'x-ratelimit-remaining': this.config.rateLimitRemaining.toString()
      }
    };
  }
  
  // Pull Request mocks
  async createPullRequest(owner, repo, prData) {
    await this.simulateDelay();
    this.simulateFailure();
    this.trackRequest('POST', `/repos/${owner}/${repo}/pulls`, prData);
    
    const prId = `${owner}/${repo}/pr/${Date.now()}`;
    const prNumber = this.storage.pullRequests.size + 1;
    
    const pullRequest = {
      id: Date.now(),
      number: prNumber,
      title: prData.title,
      body: prData.body || '',
      state: 'open',
      head: {
        ref: prData.head,
        sha: 'abc123'
      },
      base: {
        ref: prData.base,
        sha: 'def456'
      },
      user: {
        login: 'testuser',
        id: 12345
      },
      mergeable: true,
      merged: false,
      draft: prData.draft || false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      html_url: `https://github.com/${owner}/${repo}/pull/${prNumber}`,
      url: `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`
    };
    
    this.storage.pullRequests.set(prId, pullRequest);
    
    return {
      data: pullRequest,
      status: 201,
      headers: {
        'x-ratelimit-remaining': this.config.rateLimitRemaining.toString()
      }
    };
  }
  
  // Label mocks
  async listLabels(owner, repo) {
    await this.simulateDelay();
    this.simulateFailure();
    this.trackRequest('GET', `/repos/${owner}/${repo}/labels`);
    
    const repoLabels = Array.from(this.storage.labels.values())
      .filter(label => label.url.includes(`${owner}/${repo}`));
    
    return {
      data: repoLabels,
      status: 200,
      headers: {
        'x-ratelimit-remaining': this.config.rateLimitRemaining.toString()
      }
    };
  }
  
  async createLabel(owner, repo, labelData) {
    await this.simulateDelay();
    this.simulateFailure();
    this.trackRequest('POST', `/repos/${owner}/${repo}/labels`, labelData);
    
    const labelKey = `${owner}/${repo}/${labelData.name}`;
    
    if (this.storage.labels.has(labelKey)) {
      const error = new Error('Validation Failed');
      error.status = 422;
      error.errors = [{ message: 'Label already exists' }];
      throw error;
    }
    
    const label = {
      id: Date.now(),
      name: labelData.name,
      color: labelData.color,
      description: labelData.description || '',
      url: `https://api.github.com/repos/${owner}/${repo}/labels/${labelData.name}`
    };
    
    this.storage.labels.set(labelKey, label);
    
    return {
      data: label,
      status: 201,
      headers: {
        'x-ratelimit-remaining': this.config.rateLimitRemaining.toString()
      }
    };
  }
  
  // Utility methods
  buildLinkHeader(page, perPage, total, owner, repo, endpoint) {
    const totalPages = Math.ceil(total / perPage);
    const links = [];
    
    if (page > 1) {
      links.push(`<https://api.github.com/repos/${owner}/${repo}/${endpoint}?page=${page - 1}&per_page=${perPage}>; rel=\"prev\"`);
      links.push(`<https://api.github.com/repos/${owner}/${repo}/${endpoint}?page=1&per_page=${perPage}>; rel=\"first\"`);
    }
    
    if (page < totalPages) {
      links.push(`<https://api.github.com/repos/${owner}/${repo}/${endpoint}?page=${page + 1}&per_page=${perPage}>; rel=\"next\"`);
      links.push(`<https://api.github.com/repos/${owner}/${repo}/${endpoint}?page=${totalPages}&per_page=${perPage}>; rel=\"last\"`);
    }
    
    return links.join(', ');
  }
  
  // Analytics and debugging
  getRequestStats() {
    return {
      totalRequests: this.requestCount,
      rateLimitRemaining: this.config.rateLimitRemaining,
      requestHistory: this.requestHistory.slice(-10), // Last 10 requests
      storageStats: {
        users: this.storage.users.size,
        repositories: this.storage.repositories.size,
        issues: this.storage.issues.size,
        pullRequests: this.storage.pullRequests.size,
        labels: this.storage.labels.size
      }
    };
  }
  
  // Reset mock state
  reset() {
    this.requestCount = 0;
    this.requestHistory = [];
    this.config.rateLimitRemaining = this.config.rateLimitTotal;
    
    // Clear storage except for default data
    this.storage.users.clear();
    this.storage.repositories.clear();
    this.storage.issues.clear();
    this.storage.pullRequests.clear();
    this.storage.labels.clear();
    this.storage.milestones.clear();
    this.storage.webhooks.clear();
    
    this.initializeDefaultData();
  }
}

module.exports = GitHubAPIMock;