const { GitHubIntegrationClient } = require('../../src/index');

// Mock all the operation classes
jest.mock('../../src/clients/github-client');
jest.mock('../../src/operations/repository');
jest.mock('../../src/operations/issues');
jest.mock('../../src/operations/pull-requests');

const { GitHubClient } = require('../../src/clients/github-client');
const { RepositoryOperations } = require('../../src/operations/repository');
const { IssueOperations } = require('../../src/operations/issues');
const { PullRequestOperations } = require('../../src/operations/pull-requests');

describe('GitHubIntegrationClient', () => {
  let client;
  let mockGitHubClient;
  let mockRepoOps;
  let mockIssueOps;
  let mockPRs;

  const mockMetrics = {
    requests: { total: 100, successRate: 95 },
    responses: { averageTime: 150 },
    cache: { hits: 30, misses: 10, hitRate: 75 },
    rateLimit: {
      github: { remaining: 4000, limit: 5000, resetAt: Date.now() + 3600000 },
      canMakeRequest: true,
      delays: 2
    }
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock GitHubClient
    mockGitHubClient = {
      isAuthenticated: jest.fn().mockReturnValue(true),
      validateToken: jest.fn().mockResolvedValue({ valid: true, user: { login: 'testuser' } }),
      getMetrics: jest.fn().mockReturnValue(mockMetrics),
      reset: jest.fn(),
      shutdown: jest.fn()
    };

    // Mock operation classes
    mockRepoOps = {
      getRepository: jest.fn().mockResolvedValue({ name: 'test-repo' }),
      getStatistics: jest.fn().mockResolvedValue({ contributors: { count: 5 } }),
      getInsights: jest.fn().mockResolvedValue({ health: 85 }),
      searchRepositories: jest.fn().mockResolvedValue({ repositories: [] }),
      batchOperation: jest.fn().mockResolvedValue({ total: 2, successful: 2 })
    };

    mockIssueOps = {
      createIssue: jest.fn().mockResolvedValue({ number: 1, title: 'Test Issue' }),
      searchIssues: jest.fn().mockResolvedValue({ issues: [] })
    };

    mockPRs = {
      createPullRequest: jest.fn().mockResolvedValue({ number: 1, title: 'Test PR' }),
      searchPullRequests: jest.fn().mockResolvedValue({ pullRequests: [] })
    };

    // Setup constructor mocks
    GitHubClient.mockImplementation(() => mockGitHubClient);
    RepositoryOperations.mockImplementation(() => mockRepoOps);
    IssueOperations.mockImplementation(() => mockIssueOps);
    PullRequestOperations.mockImplementation(() => mockPRs);

    client = new GitHubIntegrationClient({ token: 'test-token' });
  });

  describe('Constructor', () => {
    it('should initialize with all operation modules', () => {
      expect(GitHubClient).toHaveBeenCalledWith({ token: 'test-token' });
      expect(RepositoryOperations).toHaveBeenCalledWith(mockGitHubClient);
      expect(IssueOperations).toHaveBeenCalledWith(mockGitHubClient);
      expect(PullRequestOperations).toHaveBeenCalledWith(mockGitHubClient);
      
      expect(client.repositories).toBe(mockRepoOps);
      expect(client.issues).toBe(mockIssueOps);
      expect(client.pullRequests).toBe(mockPRs);
    });
  });

  describe('Authentication', () => {
    it('should authenticate and return validation result', async () => {
      const result = await client.authenticate();
      
      expect(mockGitHubClient.validateToken).toHaveBeenCalled();
      expect(result.valid).toBe(true);
      expect(result.user.login).toBe('testuser');
    });

    it('should handle authentication failure', async () => {
      mockGitHubClient.validateToken.mockResolvedValue({ 
        valid: false, 
        error: 'Invalid token' 
      });

      const result = await client.authenticate();
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid token');
    });
  });

  describe('Metrics and Status', () => {
    it('should get comprehensive metrics', () => {
      const metrics = client.getMetrics();
      
      expect(mockGitHubClient.getMetrics).toHaveBeenCalled();
      expect(metrics).toEqual(mockMetrics);
    });

    it('should get client status with health score', () => {
      const status = client.getStatus();
      
      expect(status.authenticated).toBe(true);
      expect(status.rateLimit.remaining).toBe(4000);
      expect(status.rateLimit.canMakeRequest).toBe(true);
      expect(status.performance.totalRequests).toBe(100);
      expect(status.performance.successRate).toBe(95);
      expect(status.health).toBeGreaterThan(80); // Should be a good health score
    });

    it('should calculate poor health score for bad metrics', () => {
      const badMetrics = {
        requests: { total: 100, successRate: 80 }, // Low success rate
        responses: { averageTime: 5000 }, // Slow responses
        cache: { hits: 1, misses: 9, hitRate: 10 }, // Low cache hit rate
        rateLimit: { delays: 50, canMakeRequest: true } // Frequent rate limiting
      };
      
      mockGitHubClient.getMetrics.mockReturnValue(badMetrics);
      
      const status = client.getStatus();
      expect(status.health).toBeLessThan(50);
    });
  });

  describe('State Management', () => {
    it('should reset client state', () => {
      client.reset();
      expect(mockGitHubClient.reset).toHaveBeenCalled();
    });

    it('should shutdown gracefully', async () => {
      await client.shutdown();
      expect(mockGitHubClient.shutdown).toHaveBeenCalled();
    });
  });

  describe('Convenience Methods', () => {
    it('should get repository info', async () => {
      const result = await client.getRepo('owner', 'repo');
      
      expect(mockRepoOps.getRepository).toHaveBeenCalledWith('owner', 'repo');
      expect(result.name).toBe('test-repo');
    });

    it('should create issue with minimal parameters', async () => {
      const result = await client.createIssue('owner', 'repo', 'Bug Report', 'Description');
      
      expect(mockIssueOps.createIssue).toHaveBeenCalledWith('owner', 'repo', {
        title: 'Bug Report',
        body: 'Description'
      });
      expect(result.number).toBe(1);
    });

    it('should create issue with additional options', async () => {
      await client.createIssue('owner', 'repo', 'Bug Report', 'Description', {
        labels: ['bug'],
        assignees: ['user1']
      });
      
      expect(mockIssueOps.createIssue).toHaveBeenCalledWith('owner', 'repo', {
        title: 'Bug Report',
        body: 'Description',
        labels: ['bug'],
        assignees: ['user1']
      });
    });

    it('should create pull request', async () => {
      const result = await client.createPullRequest(
        'owner', 'repo', 'New Feature', 'feature-branch', 'main', 'PR Description'
      );
      
      expect(mockPRs.createPullRequest).toHaveBeenCalledWith('owner', 'repo', {
        title: 'New Feature',
        head: 'feature-branch',
        base: 'main',
        body: 'PR Description'
      });
      expect(result.number).toBe(1);
    });

    it('should create pull request with options', async () => {
      await client.createPullRequest(
        'owner', 'repo', 'New Feature', 'feature-branch', 'main', 'PR Description',
        { draft: true }
      );
      
      expect(mockPRs.createPullRequest).toHaveBeenCalledWith('owner', 'repo', {
        title: 'New Feature',
        head: 'feature-branch',
        base: 'main',
        body: 'PR Description',
        draft: true
      });
    });
  });

  describe('Search Functionality', () => {
    it('should search all types by default', async () => {
      const result = await client.search('test query');
      
      expect(mockIssueOps.searchIssues).toHaveBeenCalledWith('test query');
      expect(mockPRs.searchPullRequests).toHaveBeenCalledWith('test query');
      expect(mockRepoOps.searchRepositories).toHaveBeenCalledWith('test query');
      
      expect(result).toHaveProperty('issues');
      expect(result).toHaveProperty('pullRequests');
      expect(result).toHaveProperty('repositories');
    });

    it('should search specific types', async () => {
      await client.search('test query', 'issues');
      
      expect(mockIssueOps.searchIssues).toHaveBeenCalledWith('test query');
      expect(mockPRs.searchPullRequests).not.toHaveBeenCalled();
      expect(mockRepoOps.searchRepositories).not.toHaveBeenCalled();
    });

    it('should handle search errors gracefully', async () => {
      mockIssueOps.searchIssues.mockRejectedValue(new Error('Search failed'));
      
      const result = await client.search('test query', 'issues');
      
      expect(result.issues.error).toBe('Search failed');
    });

    it('should search pull requests only', async () => {
      const result = await client.search('test query', 'pullRequests');
      
      expect(mockPRs.searchPullRequests).toHaveBeenCalledWith('test query');
      expect(mockIssueOps.searchIssues).not.toHaveBeenCalled();
      expect(mockRepoOps.searchRepositories).not.toHaveBeenCalled();
      
      expect(result).toHaveProperty('pullRequests');
      expect(result).not.toHaveProperty('issues');
    });

    it('should search repositories only', async () => {
      const result = await client.search('test query', 'repositories');
      
      expect(mockRepoOps.searchRepositories).toHaveBeenCalledWith('test query');
      expect(mockIssueOps.searchIssues).not.toHaveBeenCalled();
      expect(mockPRs.searchPullRequests).not.toHaveBeenCalled();
      
      expect(result).toHaveProperty('repositories');
      expect(result).not.toHaveProperty('issues');
    });
  });

  describe('Repository Analytics', () => {
    it('should get comprehensive repository analytics', async () => {
      const result = await client.getRepositoryAnalytics('owner', 'repo');
      
      expect(mockRepoOps.getRepository).toHaveBeenCalledWith('owner', 'repo');
      expect(mockRepoOps.getStatistics).toHaveBeenCalledWith('owner', 'repo');
      expect(mockRepoOps.getInsights).toHaveBeenCalledWith('owner', 'repo');
      
      expect(result.repository.name).toBe('test-repo');
      expect(result.statistics.contributors.count).toBe(5);
      expect(result.insights.health).toBe(85);
      expect(result.errors).toEqual([]);
    });

    it('should handle partial failures in analytics', async () => {
      mockRepoOps.getStatistics.mockRejectedValue(new Error('Statistics failed'));
      mockRepoOps.getInsights.mockRejectedValue(new Error('Insights failed'));
      
      const result = await client.getRepositoryAnalytics('owner', 'repo');
      
      expect(result.repository.name).toBe('test-repo');
      expect(result.statistics).toBeNull();
      expect(result.insights).toBeNull();
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].message).toBe('Statistics failed');
      expect(result.errors[1].message).toBe('Insights failed');
    });

    it('should handle complete failure in analytics', async () => {
      mockRepoOps.getRepository.mockRejectedValue(new Error('Repo not found'));
      mockRepoOps.getStatistics.mockRejectedValue(new Error('Stats failed'));
      mockRepoOps.getInsights.mockRejectedValue(new Error('Insights failed'));
      
      const result = await client.getRepositoryAnalytics('owner', 'repo');
      
      expect(result.repository).toBeNull();
      expect(result.statistics).toBeNull();
      expect(result.insights).toBeNull();
      expect(result.errors).toHaveLength(3);
    });
  });

  describe('Batch Operations', () => {
    it('should perform batch repository operations', async () => {
      const repositories = ['owner1/repo1', 'owner2/repo2'];
      const mockOperation = jest.fn();
      
      const result = await client.batchRepositoryOperation(repositories, mockOperation, {
        concurrency: 2
      });
      
      expect(mockRepoOps.batchOperation).toHaveBeenCalledWith(repositories, mockOperation, {
        concurrency: 2
      });
      expect(result.total).toBe(2);
      expect(result.successful).toBe(2);
    });
  });

  describe('Health Score Calculation', () => {
    it('should calculate perfect health score', () => {
      const perfectMetrics = {
        requests: { total: 100, successRate: 100 },
        responses: { averageTime: 100 },
        cache: { hits: 80, misses: 20, hitRate: 80 },
        rateLimit: { delays: 0 }
      };
      
      const score = client.calculateHealthScore(perfectMetrics);
      expect(score).toBe(100);
    });

    it('should penalize low success rate', () => {
      const metrics = {
        requests: { total: 100, successRate: 85 }, // 10 points below 95%
        responses: { averageTime: 100 },
        cache: { hits: 60, misses: 40, hitRate: 60 },
        rateLimit: { delays: 0 }
      };
      
      const score = client.calculateHealthScore(metrics);
      expect(score).toBe(80); // 100 - (95-85)*2 = 80
    });

    it('should penalize slow response times', () => {
      const metrics = {
        requests: { total: 100, successRate: 100 },
        responses: { averageTime: 4000 }, // 2000ms over threshold
        cache: { hits: 60, misses: 40, hitRate: 60 },
        rateLimit: { delays: 0 }
      };
      
      const score = client.calculateHealthScore(metrics);
      expect(score).toBe(80); // 100 - min(30, 2000/100) = 80
    });

    it('should penalize low cache hit rate', () => {
      const metrics = {
        requests: { total: 100, successRate: 100 },
        responses: { averageTime: 100 },
        cache: { hits: 40, misses: 60, hitRate: 40 }, // 20 points below 60%
        rateLimit: { delays: 0 }
      };
      
      const score = client.calculateHealthScore(metrics);
      expect(score).toBe(90); // 100 - (60-40)*0.5 = 90
    });

    it('should penalize frequent rate limiting', () => {
      const metrics = {
        requests: { total: 100, successRate: 100 },
        responses: { averageTime: 100 },
        cache: { hits: 60, misses: 40, hitRate: 60 },
        rateLimit: { delays: 20 } // 20% of requests delayed
      };
      
      const score = client.calculateHealthScore(metrics);
      expect(score).toBe(80); // 100 - 20 = 80
    });

    it('should not go below 0 or above 100', () => {
      const terribleMetrics = {
        requests: { total: 100, successRate: 50 },
        responses: { averageTime: 10000 },
        cache: { hits: 1, misses: 99, hitRate: 1 },
        rateLimit: { delays: 50 }
      };
      
      const score = client.calculateHealthScore(terribleMetrics);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should handle missing metrics gracefully', () => {
      const incompleteMetrics = {};
      
      const score = client.calculateHealthScore(incompleteMetrics);
      expect(score).toBe(100); // Should default to perfect score if no penalties apply
    });
  });

  describe('Integration', () => {
    it('should work with real-like workflow', async () => {
      // Authenticate
      const auth = await client.authenticate();
      expect(auth.valid).toBe(true);

      // Get status
      const status = client.getStatus();
      expect(status.authenticated).toBe(true);

      // Create an issue
      const issue = await client.createIssue('owner', 'repo', 'Bug Report');
      expect(issue.number).toBe(1);

      // Create a PR
      const pr = await client.createPullRequest('owner', 'repo', 'Fix', 'feature', 'main');
      expect(pr.number).toBe(1);

      // Search
      const searchResults = await client.search('bug');
      expect(searchResults).toHaveProperty('issues');
      expect(searchResults).toHaveProperty('pullRequests');
      expect(searchResults).toHaveProperty('repositories');

      // Get analytics
      const analytics = await client.getRepositoryAnalytics('owner', 'repo');
      expect(analytics.repository).toBeTruthy();
      expect(analytics.statistics).toBeTruthy();
      expect(analytics.insights).toBeTruthy();
    });
  });
});