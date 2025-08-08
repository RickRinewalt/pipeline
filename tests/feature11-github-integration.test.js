/**
 * Feature 11: GitHub API Integration & Automation - Test Suite
 * TDD Test Suite for GitHub API Integration
 */

const GitHubAPIIntegration = require('../yolo-pro/src/github-api-integration');

// Mock Octokit
jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => ({
    rest: {
      users: {
        getAuthenticated: jest.fn()
      },
      rateLimit: {
        get: jest.fn()
      },
      issues: {
        create: jest.fn(),
        get: jest.fn(),
        update: jest.fn(),
        createComment: jest.fn(),
        listForRepo: jest.fn(),
        listMilestones: jest.fn(),
        createMilestone: jest.fn(),
        getMilestone: jest.fn()
      },
      repos: {
        get: jest.fn(),
        createDispatchEvent: jest.fn()
      },
      pulls: {
        create: jest.fn(),
        requestReviewers: jest.fn()
      },
      git: {
        createRef: jest.fn(),
        deleteRef: jest.fn()
      },
      actions: {
        listWorkflowRuns: jest.fn(),
        createWorkflowDispatch: jest.fn()
      }
    }
  }))
}));

describe('Feature 11: GitHub API Integration & Automation', () => {
  let github;
  let mockOctokit;

  beforeEach(() => {
    jest.clearAllMocks();
    
    github = new GitHubAPIIntegration({
      token: 'test-token',
      owner: 'test-owner',
      repo: 'test-repo'
    });
    
    mockOctokit = github.octokit;
  });

  describe('Initialization and Authentication', () => {
    test('should initialize successfully with valid credentials', async () => {
      // Mock successful authentication
      mockOctokit.rest.users.getAuthenticated.mockResolvedValue({
        data: { login: 'test-user' }
      });
      
      mockOctokit.rest.rateLimit.get.mockResolvedValue({
        data: {
          rate: {
            remaining: 5000,
            reset: Math.floor(Date.now() / 1000) + 3600
          }
        }
      });

      const result = await github.initialize();

      expect(result.success).toBe(true);
      expect(result.user).toBe('test-user');
      expect(result.rateLimit.remaining).toBe(5000);
    });

    test('should handle authentication failure', async () => {
      mockOctokit.rest.users.getAuthenticated.mockRejectedValue({
        message: 'Bad credentials',
        status: 401
      });

      const result = await github.initialize();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Bad credentials');
      expect(result.code).toBe(401);
    });
  });

  describe('Milestone Management', () => {
    test('should get milestone features successfully', async () => {
      // Mock milestone data
      mockOctokit.rest.issues.listMilestones.mockResolvedValue({
        data: [{
          id: 1,
          number: 2,
          title: 'Milestone #2',
          state: 'open',
          description: 'Test milestone',
          due_on: '2024-12-31T23:59:59Z',
          open_issues: 5,
          closed_issues: 3
        }]
      });

      // Mock milestone issues
      mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: [
          {
            number: 24,
            title: 'Feature: File Reference Protocol',
            body: 'Implementation details',
            state: 'closed',
            labels: [{ name: 'feature' }, { name: 'enhancement' }],
            assignees: [{ login: 'developer1' }]
          },
          {
            number: 28,
            title: 'Feature: CLI Commands',
            body: 'CLI implementation',
            state: 'open',
            labels: [{ name: 'feature' }, { name: 'high' }],
            assignees: []
          }
        ]
      });

      const result = await github.getMilestoneFeatures(2);

      expect(result.milestone.number).toBe(2);
      expect(result.milestone.title).toBe('Milestone #2');
      expect(result.milestone.progress.percentage).toBe(38); // 3/(5+3) * 100
      expect(result.features).toHaveLength(2);
      expect(result.features[0].complexity).toBeGreaterThan(0);
      expect(result.features[0].priority).toBeGreaterThan(0);
    });

    test('should handle milestone not found', async () => {
      mockOctokit.rest.issues.listMilestones.mockResolvedValue({
        data: []
      });

      await expect(github.getMilestoneFeatures(999))
        .rejects.toThrow('Milestone 999 not found');
    });
  });

  describe('Issue Lifecycle Management', () => {
    test('should start issue successfully', async () => {
      const mockIssue = {
        number: 123,
        title: 'Test Issue',
        state: 'open',
        labels: [],
        assignees: []
      };

      mockOctokit.rest.issues.get.mockResolvedValue({
        data: mockIssue
      });

      mockOctokit.rest.issues.update.mockResolvedValue({
        data: { ...mockIssue, labels: [{ name: 'in-progress' }] }
      });

      mockOctokit.rest.issues.createComment.mockResolvedValue({
        data: { id: 456 }
      });

      const result = await github.manageIssueLifecycle(123, 'start', {
        assignee: 'developer1',
        branch: 'feature/123-test-issue'
      });

      expect(result.success).toBe(true);
      expect(mockOctokit.rest.issues.update).toHaveBeenCalled();
      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalled();
    });

    test('should complete issue successfully', async () => {
      const mockIssue = {
        number: 123,
        title: 'Test Issue',
        state: 'open',
        labels: [{ name: 'in-progress' }],
        assignees: [{ login: 'developer1' }]
      };

      mockOctokit.rest.issues.get.mockResolvedValue({
        data: mockIssue
      });

      mockOctokit.rest.issues.update.mockResolvedValue({
        data: { ...mockIssue, state: 'closed', labels: [{ name: 'completed' }] }
      });

      const result = await github.manageIssueLifecycle(123, 'complete', {
        resolution: 'Implemented successfully',
        testsPassed: true
      });

      expect(result.success).toBe(true);
      expect(result.issue.state).toBe('closed');
    });

    test('should handle unknown action', async () => {
      await expect(github.manageIssueLifecycle(123, 'unknown'))
        .rejects.toThrow('Unknown action: unknown');
    });
  });

  describe('Branch Management', () => {
    test('should create branch successfully', async () => {
      // Mock getting default branch SHA
      mockOctokit.rest.repos.get.mockResolvedValue({
        data: { default_branch: 'main' }
      });

      mockOctokit.rest.git.createRef.mockResolvedValue({
        data: {
          ref: 'refs/heads/feature/test-branch',
          object: { sha: 'abc123' }
        }
      });

      const result = await github.manageBranch('feature/test-branch', 'create', {
        from: 'main'
      });

      expect(result.success).toBe(true);
      expect(result.branch.name).toBe('feature/test-branch');
      expect(mockOctokit.rest.git.createRef).toHaveBeenCalled();
    });

    test('should merge branch successfully', async () => {
      mockOctokit.rest.pulls.create.mockResolvedValue({
        data: {
          number: 456,
          html_url: 'https://github.com/test-owner/test-repo/pull/456',
          state: 'open',
          mergeable: true
        }
      });

      const result = await github.manageBranch('feature/test-branch', 'merge', {
        base: 'main',
        title: 'Feature: Test Branch',
        body: 'Test implementation'
      });

      expect(result.success).toBe(true);
      expect(result.pullRequest.number).toBe(456);
    });
  });

  describe('Pull Request Orchestration', () => {
    test('should orchestrate pull request with all features', async () => {
      mockOctokit.rest.pulls.create.mockResolvedValue({
        data: {
          number: 789,
          html_url: 'https://github.com/test-owner/test-repo/pull/789',
          state: 'open',
          mergeable: true
        }
      });

      mockOctokit.rest.pulls.requestReviewers.mockResolvedValue({
        data: {}
      });

      mockOctokit.rest.issues.update.mockResolvedValue({
        data: {}
      });

      const result = await github.orchestratePullRequest({
        head: 'feature/test-feature',
        base: 'main',
        title: 'Feature: Test Feature',
        body: 'Implementation of test feature',
        reviewers: ['reviewer1', 'reviewer2'],
        assignees: ['developer1'],
        autoMerge: true
      });

      expect(result.success).toBe(true);
      expect(result.pullRequest.number).toBe(789);
      expect(result.pullRequest.autoMerge).toBe(true);
      expect(mockOctokit.rest.pulls.requestReviewers).toHaveBeenCalled();
    });
  });

  describe('Repository Analysis', () => {
    test('should analyze repository comprehensively', async () => {
      // Mock repository data
      mockOctokit.rest.repos.get.mockResolvedValue({
        data: {
          name: 'test-repo',
          description: 'Test repository',
          language: 'JavaScript',
          size: 1024,
          stargazers_count: 10,
          forks_count: 2,
          open_issues_count: 5,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-06-01T00:00:00Z'
        }
      });

      // Mock additional data calls
      mockOctokit.rest.git.listMatchingRefs = jest.fn().mockResolvedValue({
        data: [{ ref: 'refs/heads/main' }, { ref: 'refs/heads/develop' }]
      });

      mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: [
          { state: 'open', created_at: '2024-06-01T00:00:00Z' },
          { state: 'closed', created_at: '2024-05-01T00:00:00Z' }
        ]
      });

      mockOctokit.rest.pulls.list.mockResolvedValue({
        data: [
          { state: 'open', updated_at: '2024-06-01T00:00:00Z' },
          { state: 'closed', updated_at: '2024-05-15T00:00:00Z' }
        ]
      });

      mockOctokit.rest.actions.listRepoWorkflows = jest.fn().mockResolvedValue({
        data: { workflows: [{ name: 'CI', state: 'active' }] }
      });

      mockOctokit.rest.repos.listReleases = jest.fn().mockResolvedValue({
        data: [{ tag_name: 'v1.0.0' }]
      });

      const result = await github.analyzeRepository();

      expect(result.repository.name).toBe('test-repo');
      expect(result.repository.language).toBe('JavaScript');
      expect(result.health.score).toBeGreaterThanOrEqual(0);
      expect(result.health.score).toBeLessThanOrEqual(100);
      expect(result.yoloProCompliance).toBeDefined();
    });
  });

  describe('Deployment Coordination', () => {
    test('should coordinate deployment successfully', async () => {
      mockOctokit.rest.actions.createWorkflowDispatch.mockResolvedValue({
        data: {}
      });

      mockOctokit.rest.actions.listWorkflowRuns.mockResolvedValue({
        data: {
          workflow_runs: [{
            id: 123456,
            status: 'in_progress',
            html_url: 'https://github.com/test-owner/test-repo/actions/runs/123456',
            created_at: '2024-06-01T12:00:00Z'
          }]
        }
      });

      const result = await github.coordinateDeployment('production', {
        workflow: 'deploy.yml',
        ref: 'main',
        inputs: { environment: 'production' }
      });

      expect(result.success).toBe(true);
      expect(result.deployment.environment).toBe('production');
      expect(mockOctokit.rest.actions.createWorkflowDispatch).toHaveBeenCalled();
    });
  });

  describe('Complexity and Priority Estimation', () => {
    test('should estimate complexity correctly', async () => {
      const simpleIssue = {
        title: 'Fix typo',
        body: 'Simple fix needed',
        labels: []
      };

      const complexIssue = {
        title: 'Implement advanced authentication architecture with security optimization',
        body: 'A'.repeat(1500), // Long body
        labels: [
          { name: 'enhancement' },
          { name: 'architecture' },
          { name: 'security' },
          { name: 'performance' }
        ]
      };

      const simpleComplexity = github._estimateComplexity(simpleIssue);
      const complexComplexity = github._estimateComplexity(complexIssue);

      expect(simpleComplexity).toBeLessThan(complexComplexity);
      expect(complexComplexity).toBeGreaterThanOrEqual(4);
    });

    test('should estimate priority correctly', async () => {
      const lowPriorityIssue = {
        labels: [{ name: 'low' }]
      };

      const criticalIssue = {
        labels: [{ name: 'critical' }, { name: 'urgent' }]
      };

      const lowPriority = github._estimatePriority(lowPriorityIssue);
      const criticalPriority = github._estimatePriority(criticalIssue);

      expect(lowPriority).toBe(2);
      expect(criticalPriority).toBe(5);
    });

    test('should extract dependencies from issue body', async () => {
      const issueWithDeps = {
        body: 'This depends on #123 and fixes #456. See also #789.'
      };

      const dependencies = github._extractDependencies(issueWithDeps.body);

      expect(dependencies).toEqual([123, 456, 789]);
    });

    test('should estimate hours based on complexity', async () => {
      const complexity1 = github._estimateHours({ complexity: 1 });
      const complexity5 = github._estimateHours({ complexity: 5 });

      expect(complexity1).toBeLessThan(complexity5);
      expect(complexity5).toBe(32); // Very complex: 32 hours
    });
  });

  describe('YOLO-PRO Compliance Checking', () => {
    test('should check SPARC compliance', async () => {
      const result = await github._checkSparcCompliance();

      expect(result).toHaveProperty('compliant');
      expect(result).toHaveProperty('score');
      expect(typeof result.compliant).toBe('boolean');
      expect(typeof result.score).toBe('number');
    });

    test('should check TDD compliance', async () => {
      const result = await github._checkTDDCompliance();

      expect(result).toHaveProperty('compliant');
      expect(result).toHaveProperty('coverage');
      expect(typeof result.coverage).toBe('number');
    });

    test('should check WCP compliance', async () => {
      const result = await github._checkWCPCompliance();

      expect(result).toHaveProperty('compliant');
      expect(result).toHaveProperty('structure');
      expect(result.structure).toBe('epic-feature-issue');
    });
  });

  describe('Health Score Calculation', () => {
    test('should calculate health score correctly', async () => {
      const goodData = {
        issues: [
          { state: 'closed' },
          { state: 'closed' },
          { state: 'open' }
        ],
        pullRequests: [
          { state: 'closed', updated_at: '2024-06-01T00:00:00Z' }
        ],
        branches: [
          { name: 'main' },
          { name: 'develop' }
        ],
        workflows: [
          { state: 'active' }
        ]
      };

      const poorData = {
        issues: [
          { state: 'open' },
          { state: 'open' },
          { state: 'open' }
        ],
        pullRequests: [
          { 
            state: 'open', 
            updated_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() 
          }
        ],
        branches: new Array(15).fill({ name: 'branch' }),
        workflows: []
      };

      const goodScore = github._calculateHealthScore(goodData);
      const poorScore = github._calculateHealthScore(poorData);

      expect(goodScore).toBeGreaterThan(poorScore);
      expect(goodScore).toBeLessThanOrEqual(100);
      expect(poorScore).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle API errors gracefully', async () => {
      mockOctokit.rest.issues.listMilestones.mockRejectedValue(
        new Error('API rate limit exceeded')
      );

      await expect(github.getMilestoneFeatures(1))
        .rejects.toThrow('Failed to get milestone features: API rate limit exceeded');
    });

    test('should handle network errors', async () => {
      mockOctokit.rest.users.getAuthenticated.mockRejectedValue(
        new Error('Network error')
      );

      const result = await github.initialize();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });
});

describe('GitHubAPIIntegration Performance Tests', () => {
  let github;

  beforeEach(() => {
    github = new GitHubAPIIntegration({
      token: 'test-token',
      owner: 'test-owner',
      repo: 'test-repo'
    });
  });

  test('should cache milestone data for performance', async () => {
    const mockOctokit = github.octokit;
    
    mockOctokit.rest.issues.listMilestones.mockResolvedValue({
      data: [{ id: 1, number: 2, title: 'Test', state: 'open', open_issues: 5, closed_issues: 3 }]
    });

    mockOctokit.rest.issues.listForRepo.mockResolvedValue({
      data: []
    });

    // First call
    await github.getMilestoneFeatures(2);
    
    // Second call should use cache
    await github.getMilestoneFeatures(2);

    // Should only call API once due to caching
    expect(mockOctokit.rest.issues.listMilestones).toHaveBeenCalledTimes(1);
  });

  test('should handle concurrent requests efficiently', async () => {
    const mockOctokit = github.octokit;
    
    mockOctokit.rest.issues.get.mockResolvedValue({
      data: { number: 123, title: 'Test', state: 'open', labels: [], assignees: [] }
    });

    mockOctokit.rest.issues.update.mockResolvedValue({
      data: { number: 123, state: 'open' }
    });

    mockOctokit.rest.issues.createComment.mockResolvedValue({
      data: { id: 456 }
    });

    const promises = Array(5).fill().map((_, i) => 
      github.manageIssueLifecycle(123 + i, 'start')
    );

    const results = await Promise.all(promises);

    expect(results).toHaveLength(5);
    results.forEach(result => {
      expect(result.success).toBe(true);
    });
  });
});