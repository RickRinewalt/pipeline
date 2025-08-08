/**
 * Feature 10: GitHub Label Management System - Test Suite
 * TDD Test Suite for GitHub Label Management
 */

const GitHubLabelManager = require('../yolo-pro/src/github-label-manager');
const GitHubAPIIntegration = require('../yolo-pro/src/github-api-integration');

// Mock the GitHub API Integration
jest.mock('../yolo-pro/src/github-api-integration');

describe('Feature 10: GitHub Label Management System', () => {
  let labelManager;
  let mockGitHubClient;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock GitHub API Integration
    mockGitHubClient = {
      octokit: {
        rest: {
          issues: {
            listLabelsForRepo: jest.fn(),
            createLabel: jest.fn(),
            updateLabel: jest.fn(),
            addLabels: jest.fn(),
            removeLabel: jest.fn()
          }
        }
      },
      options: {
        owner: 'test-owner',
        repo: 'test-repo'
      }
    };

    GitHubAPIIntegration.mockImplementation(() => mockGitHubClient);
    
    labelManager = new GitHubLabelManager({
      gitHubClient: mockGitHubClient
    });
  });

  describe('Standard YOLO-PRO Labels', () => {
    test('should provide complete YOLO-PRO label set', () => {
      const standardLabels = labelManager.getYoloProLabelSet();

      expect(standardLabels).toBeDefined();
      expect(Array.isArray(standardLabels)).toBe(true);
      expect(standardLabels.length).toBeGreaterThan(15);

      // Check core categories exist
      const categories = standardLabels.map(l => l.category);
      expect(categories).toContain('epic');
      expect(categories).toContain('priority');
      expect(categories).toContain('type');
      expect(categories).toContain('status');
      expect(categories).toContain('sparc');
    });

    test('should include all required SPARC workflow labels', () => {
      const standardLabels = labelManager.getYoloProLabelSet();
      const sparcLabels = standardLabels.filter(l => l.category === 'sparc');

      const expectedSparcLabels = [
        'sparc:specification',
        'sparc:pseudocode', 
        'sparc:architecture',
        'sparc:refinement',
        'sparc:completion'
      ];

      expectedSparcLabels.forEach(expected => {
        const found = sparcLabels.find(l => l.name === expected);
        expect(found).toBeDefined();
        expect(found.color).toBeDefined();
        expect(found.description).toBeDefined();
      });
    });

    test('should include priority labels with correct hierarchy', () => {
      const standardLabels = labelManager.getYoloProLabelSet();
      const priorityLabels = standardLabels.filter(l => l.category === 'priority');

      expect(priorityLabels).toHaveLength(4);
      
      const priorities = ['critical', 'high', 'medium', 'low'];
      priorities.forEach(priority => {
        const found = priorityLabels.find(l => l.name === `priority:${priority}`);
        expect(found).toBeDefined();
      });
    });
  });

  describe('Label Validation', () => {
    test('should validate label format correctly', () => {
      const validLabels = ['feature', 'priority:high', 'sparc:specification'];
      const invalidLabels = ['FEATURE', 'priority:', ':high', ''];

      validLabels.forEach(label => {
        expect(labelManager.isLabelFormatValid(label)).toBe(true);
      });

      invalidLabels.forEach(label => {
        expect(labelManager.isLabelFormatValid(label)).toBe(false);
      });
    });

    test('should validate labels against repository successfully', async () => {
      const repoLabels = [
        { name: 'bug', color: 'd73a49' },
        { name: 'feature', color: '0052cc' },
        { name: 'priority:high', color: 'b60205' }
      ];

      mockGitHubClient.octokit.rest.issues.listLabelsForRepo.mockResolvedValue({
        data: repoLabels
      });

      const labelsToValidate = ['bug', 'feature', 'enhancement', 'priority:high'];
      const result = await labelManager.validateLabels(labelsToValidate);

      expect(result.valid).toHaveLength(3);
      expect(result.invalid).toHaveLength(0);
      expect(result.missing).toHaveLength(1);
      expect(result.missing[0]).toBe('enhancement');
    });

    test('should handle API errors during validation', async () => {
      mockGitHubClient.octokit.rest.issues.listLabelsForRepo.mockRejectedValue(
        new Error('API rate limit exceeded')
      );

      const labelsToValidate = ['bug', 'feature'];
      const result = await labelManager.validateLabels(labelsToValidate);

      expect(result.success).toBe(false);
      expect(result.error).toBe('API rate limit exceeded');
      expect(result.valid).toHaveLength(0);
    });
  });

  describe('Label Creation', () => {
    test('should create missing labels successfully', async () => {
      // Mock existing labels
      mockGitHubClient.octokit.rest.issues.listLabelsForRepo.mockResolvedValue({
        data: [{ name: 'bug', color: 'd73a49' }]
      });

      // Mock label creation
      mockGitHubClient.octokit.rest.issues.createLabel.mockResolvedValue({
        data: { name: 'priority:high', color: 'b60205' }
      });

      const requiredLabels = ['bug', 'priority:high'];
      const result = await labelManager.ensureLabelsExist(requiredLabels);

      expect(result.success).toBe(true);
      expect(result.created).toHaveLength(1);
      expect(result.created[0]).toBe('priority:high');
      expect(result.existing).toHaveLength(1);
      expect(result.existing[0]).toBe('bug');
      expect(mockGitHubClient.octokit.rest.issues.createLabel).toHaveBeenCalledTimes(1);
    });

    test('should create label with standard YOLO-PRO definition', async () => {
      const result = await labelManager.createLabel('priority:critical');

      expect(mockGitHubClient.octokit.rest.issues.createLabel).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        name: 'priority:critical',
        color: expect.any(String),
        description: expect.stringContaining('Critical priority')
      });
    });

    test('should handle label creation conflicts', async () => {
      mockGitHubClient.octokit.rest.issues.createLabel.mockRejectedValue({
        status: 422,
        message: 'Label already exists'
      });

      const result = await labelManager.createLabel('bug');

      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
      expect(result.conflicted).toBe(true);
    });

    test('should batch create missing standard labels', async () => {
      mockGitHubClient.octokit.rest.issues.listLabelsForRepo.mockResolvedValue({
        data: []
      });

      mockGitHubClient.octokit.rest.issues.createLabel.mockResolvedValue({
        data: { name: 'test', color: '000000' }
      });

      const result = await labelManager.ensureStandardLabelsExist();

      expect(result.success).toBe(true);
      expect(result.created.length).toBeGreaterThan(15);
      expect(mockGitHubClient.octokit.rest.issues.createLabel).toHaveBeenCalledTimes(
        result.created.length
      );
    });
  });

  describe('Label Assignment to Issues', () => {
    test('should add labels to issue after validation', async () => {
      // Mock existing labels
      mockGitHubClient.octokit.rest.issues.listLabelsForRepo.mockResolvedValue({
        data: [
          { name: 'feature', color: '0052cc' },
          { name: 'priority:high', color: 'b60205' }
        ]
      });

      // Mock label assignment
      mockGitHubClient.octokit.rest.issues.addLabels.mockResolvedValue({
        data: []
      });

      const result = await labelManager.addLabelsToIssue(123, ['feature', 'priority:high']);

      expect(result.success).toBe(true);
      expect(result.added).toHaveLength(2);
      expect(result.skipped).toHaveLength(0);
      expect(mockGitHubClient.octokit.rest.issues.addLabels).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 123,
        labels: ['feature', 'priority:high']
      });
    });

    test('should create missing labels before assignment', async () => {
      // Mock no existing labels
      mockGitHubClient.octokit.rest.issues.listLabelsForRepo.mockResolvedValue({
        data: []
      });

      // Mock label creation
      mockGitHubClient.octokit.rest.issues.createLabel.mockResolvedValue({
        data: { name: 'test', color: '000000' }
      });

      // Mock label assignment
      mockGitHubClient.octokit.rest.issues.addLabels.mockResolvedValue({
        data: []
      });

      const result = await labelManager.addLabelsToIssue(123, ['feature'], { 
        createMissing: true 
      });

      expect(result.success).toBe(true);
      expect(result.created).toHaveLength(1);
      expect(result.added).toHaveLength(1);
      expect(mockGitHubClient.octokit.rest.issues.createLabel).toHaveBeenCalled();
      expect(mockGitHubClient.octokit.rest.issues.addLabels).toHaveBeenCalled();
    });

    test('should skip invalid labels during assignment', async () => {
      mockGitHubClient.octokit.rest.issues.listLabelsForRepo.mockResolvedValue({
        data: [{ name: 'feature', color: '0052cc' }]
      });

      const invalidLabels = ['', 'FEATURE', 'priority:'];
      const result = await labelManager.addLabelsToIssue(123, invalidLabels);

      expect(result.success).toBe(true);
      expect(result.added).toHaveLength(0);
      expect(result.skipped).toHaveLength(3);
      expect(result.skipped).toContain('Invalid format');
    });
  });

  describe('Label Removal', () => {
    test('should remove labels from issue', async () => {
      mockGitHubClient.octokit.rest.issues.removeLabel.mockResolvedValue({
        data: []
      });

      const result = await labelManager.removeLabelsFromIssue(123, ['feature']);

      expect(result.success).toBe(true);
      expect(result.removed).toHaveLength(1);
      expect(result.removed[0]).toBe('feature');
      expect(mockGitHubClient.octokit.rest.issues.removeLabel).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 123,
        name: 'feature'
      });
    });

    test('should handle removal of non-existent labels', async () => {
      mockGitHubClient.octokit.rest.issues.removeLabel.mockRejectedValue({
        status: 404,
        message: 'Label does not exist on issue'
      });

      const result = await labelManager.removeLabelsFromIssue(123, ['nonexistent']);

      expect(result.success).toBe(true);
      expect(result.removed).toHaveLength(0);
      expect(result.skipped).toHaveLength(1);
      expect(result.skipped[0]).toBe('nonexistent');
    });
  });

  describe('Caching System', () => {
    test('should cache repository labels', async () => {
      const repoLabels = [{ name: 'bug', color: 'd73a49' }];
      
      mockGitHubClient.octokit.rest.issues.listLabelsForRepo.mockResolvedValue({
        data: repoLabels
      });

      // First call
      await labelManager.validateLabels(['bug']);
      
      // Second call should use cache
      await labelManager.validateLabels(['bug']);

      expect(mockGitHubClient.octokit.rest.issues.listLabelsForRepo).toHaveBeenCalledTimes(1);
    });

    test('should refresh cache after TTL expiration', async () => {
      const repoLabels = [{ name: 'bug', color: 'd73a49' }];
      
      mockGitHubClient.octokit.rest.issues.listLabelsForRepo.mockResolvedValue({
        data: repoLabels
      });

      // Mock cache TTL to be expired
      labelManager.labelCacheTTL = 0; // Immediate expiration
      
      // First call
      await labelManager.validateLabels(['bug']);
      
      // Wait to simulate TTL expiration
      await new Promise(resolve => setTimeout(resolve, 1));
      
      // Second call should fetch fresh data
      await labelManager.validateLabels(['bug']);

      expect(mockGitHubClient.octokit.rest.issues.listLabelsForRepo).toHaveBeenCalledTimes(2);
    });
  });

  describe('Integration with Workflow Chain', () => {
    test('should integrate with issue creation workflow', async () => {
      const issueMetadata = {
        type: 'feature',
        priority: 'high',
        sparc_phase: 'specification'
      };

      mockGitHubClient.octokit.rest.issues.listLabelsForRepo.mockResolvedValue({
        data: []
      });

      mockGitHubClient.octokit.rest.issues.createLabel.mockResolvedValue({
        data: { name: 'test', color: '000000' }
      });

      mockGitHubClient.octokit.rest.issues.addLabels.mockResolvedValue({
        data: []
      });

      const result = await labelManager.integrateWithWorkflowChain(123, issueMetadata);

      expect(result.success).toBe(true);
      expect(result.appliedLabels).toContain('type:feature');
      expect(result.appliedLabels).toContain('priority:high');
      expect(result.appliedLabels).toContain('sparc:specification');
    });

    test('should suggest appropriate labels based on issue content', async () => {
      const issueTitle = 'Fix authentication bug in user login';
      const issueBody = 'Critical security issue affecting all users';

      const suggestions = await labelManager.suggestLabels(issueTitle, issueBody);

      expect(suggestions).toContain('type:bug');
      expect(suggestions).toContain('priority:critical');
      expect(suggestions).toContain('area:security');
    });
  });

  describe('Error Handling and Resilience', () => {
    test('should handle rate limit errors gracefully', async () => {
      mockGitHubClient.octokit.rest.issues.listLabelsForRepo.mockRejectedValue({
        status: 403,
        message: 'API rate limit exceeded',
        headers: {
          'x-ratelimit-reset': Math.floor(Date.now() / 1000) + 60
        }
      });

      const result = await labelManager.validateLabels(['bug']);

      expect(result.success).toBe(false);
      expect(result.error).toContain('rate limit');
      expect(result.retryAfter).toBeDefined();
    });

    test('should handle permission errors', async () => {
      mockGitHubClient.octokit.rest.issues.createLabel.mockRejectedValue({
        status: 403,
        message: 'Resource not accessible by personal access token'
      });

      const result = await labelManager.createLabel('test');

      expect(result.success).toBe(false);
      expect(result.error.toLowerCase()).toContain('permission');
      expect(result.requiresPermission).toBe(true);
    });

    test('should implement exponential backoff for retries', async () => {
      let callCount = 0;
      mockGitHubClient.octokit.rest.issues.listLabelsForRepo.mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          throw new Error('Temporary network error');
        }
        return { data: [] };
      });

      const result = await labelManager.validateLabels(['bug'], { retries: 3 });

      expect(result.success).toBe(true);
      expect(mockGitHubClient.octokit.rest.issues.listLabelsForRepo).toHaveBeenCalledTimes(3);
    });
  });

  describe('Performance and Optimization', () => {
    test('should batch multiple label operations efficiently', async () => {
      const labelsToCreate = Array.from({ length: 10 }, (_, i) => `label-${i}`);
      
      mockGitHubClient.octokit.rest.issues.listLabelsForRepo.mockResolvedValue({
        data: []
      });

      mockGitHubClient.octokit.rest.issues.createLabel.mockResolvedValue({
        data: { name: 'test', color: '000000' }
      });

      const startTime = Date.now();
      const result = await labelManager.ensureLabelsExist(labelsToCreate);
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(result.created).toHaveLength(10);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    test('should optimize API calls through intelligent caching', async () => {
      mockGitHubClient.octokit.rest.issues.listLabelsForRepo.mockResolvedValue({
        data: [{ name: 'feature', color: '0052cc' }]
      });

      // Make sequential calls to validate caching
      await labelManager.validateLabels(['feature']);
      await labelManager.validateLabels(['feature']);
      await labelManager.validateLabels(['feature']);
      
      // Should only make one API call due to caching
      expect(mockGitHubClient.octokit.rest.issues.listLabelsForRepo).toHaveBeenCalledTimes(1);
    });
  });
});