/**
 * YOLO-Warp Workflow Integration Tests
 * End-to-end testing of complete milestone automation workflows
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');
const YoloWarp = require('../../../yolo-pro/src/cli/yolo-warp');
const GitHubClient = require('../../../yolo-pro/src/cli/github-client');
const GitAutomation = require('../../../yolo-pro/src/cli/git-automation');

describe('YOLO-Warp Workflow Integration', () => {
  let yoloWarp;
  let mockGitHub;
  let mockGit;
  let testWorkspace;
  let originalEnv;
  
  beforeAll(async () => {
    // Setup test workspace
    testWorkspace = path.join(__dirname, '../tmp/integration-test-workspace');
    await fs.mkdir(testWorkspace, { recursive: true });
    
    // Backup environment
    originalEnv = { ...process.env };
    
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.GITHUB_TOKEN = 'test-token-integration';
  });
  
  afterAll(async () => {
    // Cleanup test workspace
    try {
      await fs.rmdir(testWorkspace, { recursive: true });
    } catch (error) {
      console.warn('Failed to cleanup test workspace:', error.message);
    }
    
    // Restore environment
    process.env = originalEnv;
  });
  
  beforeEach(() => {
    // Initialize with mocked dependencies
    mockGitHub = {
      createIssue: jest.fn().mockResolvedValue({ number: 123, id: 'issue-123' }),
      createPullRequest: jest.fn().mockResolvedValue({ number: 456, id: 'pr-456' }),
      getRepository: jest.fn().mockResolvedValue({ name: 'test-repo', owner: { login: 'test-owner' } }),
      createBranch: jest.fn().mockResolvedValue({ name: 'feature/test-branch' }),
      getIssues: jest.fn().mockResolvedValue([]),
      updateIssue: jest.fn().mockResolvedValue({}),
      addLabels: jest.fn().mockResolvedValue({}),
      assignUser: jest.fn().mockResolvedValue({})
    };
    
    mockGit = {
      createBranch: jest.fn().mockResolvedValue(true),
      switchBranch: jest.fn().mockResolvedValue(true),
      commitChanges: jest.fn().mockResolvedValue(true),
      pushChanges: jest.fn().mockResolvedValue(true),
      getStatus: jest.fn().mockResolvedValue({ clean: true }),
      getCurrentBranch: jest.fn().mockResolvedValue('main')
    };
    
    yoloWarp = new YoloWarp({
      gitHubClient: mockGitHub,
      gitAutomation: mockGit,
      workspace: testWorkspace
    });
  });

  describe('Complete Milestone Workflow', () => {
    const milestoneData = {
      title: 'Test Milestone',
      description: 'Integration test milestone',
      features: [
        {
          title: 'Feature 1: User Authentication',
          description: 'Implement user login/logout',
          tasks: [
            'Setup authentication routes',
            'Implement login form',
            'Add logout functionality'
          ]
        },
        {
          title: 'Feature 2: User Profile',
          description: 'User profile management',
          tasks: [
            'Create profile component',
            'Add edit functionality',
            'Implement avatar upload'
          ]
        }
      ]
    };

    it('should execute complete milestone workflow successfully', async () => {
      const result = await yoloWarp.execute('test-milestone', {
        milestone: milestoneData,
        autoCommit: true,
        createPRs: true
      });

      // Verify epic issue was created
      expect(mockGitHub.createIssue).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining('EPIC: Test Milestone'),
          labels: ['epic', 'milestone']
        })
      );

      // Verify feature issues were created
      expect(mockGitHub.createIssue).toHaveBeenCalledTimes(3); // 1 epic + 2 features

      // Verify branches were created
      expect(mockGit.createBranch).toHaveBeenCalledWith(
        expect.stringMatching(/feature\/test-milestone-.+/)
      );

      // Verify pull requests were created
      expect(mockGitHub.createPullRequest).toHaveBeenCalled();

      expect(result).toMatchObject({
        success: true,
        epic: expect.objectContaining({ number: 123 }),
        features: expect.arrayContaining([
          expect.objectContaining({ issue: expect.any(Object) })
        ]),
        pullRequests: expect.any(Array)
      });
    }, 30000);

    it('should handle workflow errors gracefully', async () => {
      // Simulate GitHub API error
      mockGitHub.createIssue.mockRejectedValueOnce(new Error('API Rate Limit'));

      const result = await yoloWarp.execute('failing-milestone', {
        milestone: milestoneData,
        retryAttempts: 2
      });

      expect(result).toMatchObject({
        success: false,
        error: expect.objectContaining({
          message: expect.stringContaining('API Rate Limit'),
          step: 'creating_epic_issue'
        })
      });
    });

    it('should support dry-run mode', async () => {
      const result = await yoloWarp.execute('dry-run-milestone', {
        milestone: milestoneData,
        dryRun: true
      });

      // No actual GitHub/Git operations should occur
      expect(mockGitHub.createIssue).not.toHaveBeenCalled();
      expect(mockGit.createBranch).not.toHaveBeenCalled();

      expect(result).toMatchObject({
        success: true,
        dryRun: true,
        plannedActions: expect.arrayContaining([
          expect.objectContaining({
            type: 'create_epic_issue',
            data: expect.any(Object)
          })
        ])
      });
    });
  });

  describe('Feature Development Workflow', () => {
    it('should create feature branch and structure', async () => {
      const featureConfig = {
        name: 'user-authentication',
        epic: { number: 123 },
        tasks: [
          'Setup authentication middleware',
          'Create login endpoint',
          'Add session management'
        ]
      };

      const result = await yoloWarp.createFeature(featureConfig);

      // Verify branch creation
      expect(mockGit.createBranch).toHaveBeenCalledWith('feature/user-authentication');
      
      // Verify file structure creation
      expect(result.fileStructure).toMatchObject({
        created: expect.arrayContaining([
          expect.stringContaining('src/auth/'),
          expect.stringContaining('tests/auth/')
        ])
      });

      // Verify task issues
      expect(mockGitHub.createIssue).toHaveBeenCalledTimes(3);
    });

    it('should link feature issues to epic', async () => {
      const featureConfig = {
        name: 'user-profile',
        epic: { number: 123, id: 'epic-123' }
      };

      await yoloWarp.createFeature(featureConfig);

      // Verify issues are linked to epic
      expect(mockGitHub.createIssue).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining('**Parent**: #123')
        })
      );
    });
  });

  describe('CI/CD Integration', () => {
    it('should trigger CI pipeline after feature completion', async () => {
      const featureName = 'completed-feature';
      mockGit.getStatus.mockResolvedValue({ clean: false, staged: ['src/auth.js'] });

      const result = await yoloWarp.completeFeature(featureName, {
        runTests: true,
        createPR: true
      });

      // Verify commits were made
      expect(mockGit.commitChanges).toHaveBeenCalledWith(
        expect.stringContaining('feat: complete completed-feature')
      );

      // Verify push triggered CI
      expect(mockGit.pushChanges).toHaveBeenCalledWith('feature/completed-feature');

      // Verify PR creation
      expect(mockGitHub.createPullRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          head: 'feature/completed-feature',
          base: 'main'
        })
      );
    });

    it('should wait for CI status before auto-merge', async () => {
      mockGitHub.getPRStatus = jest.fn()
        .mockResolvedValueOnce({ status: 'pending' })
        .mockResolvedValueOnce({ status: 'success' });
      
      mockGitHub.mergePR = jest.fn().mockResolvedValue({ merged: true });

      const result = await yoloWarp.completeFeature('ci-feature', {
        autoMerge: true,
        waitForCI: true
      });

      // Should wait for CI and then merge
      expect(mockGitHub.getPRStatus).toHaveBeenCalledTimes(2);
      expect(mockGitHub.mergePR).toHaveBeenCalled();
      
      expect(result.merged).toBe(true);
    });
  });

  describe('Error Recovery', () => {
    it('should recover from transient GitHub API errors', async () => {
      // First call fails, second succeeds
      mockGitHub.createIssue
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce({ number: 789, id: 'issue-789' });

      const result = await yoloWarp.execute('recovery-test', {
        milestone: { title: 'Recovery Test' },
        retryAttempts: 3,
        retryDelay: 100
      });

      expect(result.success).toBe(true);
      expect(mockGitHub.createIssue).toHaveBeenCalledTimes(2);
    });

    it('should cleanup on workflow failure', async () => {
      mockGit.createBranch.mockRejectedValue(new Error('Branch already exists'));

      const result = await yoloWarp.execute('cleanup-test', {
        milestone: { title: 'Cleanup Test' }
      });

      expect(result.success).toBe(false);
      expect(result.cleanupPerformed).toBe(true);
    });
  });

  describe('Performance Benchmarks', () => {
    it('should complete small milestone under 30 seconds', async () => {
      const smallMilestone = {
        title: 'Small Milestone',
        features: [{ title: 'Quick Feature', tasks: ['Simple task'] }]
      };

      const startTime = Date.now();
      
      await yoloWarp.execute('perf-small', {
        milestone: smallMilestone
      });
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(30000);
    }, 35000);

    it('should handle large milestone efficiently', async () => {
      const largeMilestone = {
        title: 'Large Milestone',
        features: Array.from({ length: 10 }, (_, i) => ({
          title: `Feature ${i + 1}`,
          tasks: Array.from({ length: 5 }, (_, j) => `Task ${j + 1}`)
        }))
      };

      const startTime = Date.now();
      
      await yoloWarp.execute('perf-large', {
        milestone: largeMilestone,
        parallel: true
      });
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(120000); // 2 minutes max
    }, 150000);
  });

  describe('Data Validation', () => {
    it('should validate milestone structure', async () => {
      const invalidMilestone = {
        // Missing required fields
        features: []
      };

      await expect(
        yoloWarp.execute('invalid-milestone', { milestone: invalidMilestone })
      ).rejects.toThrow('Invalid milestone structure');
    });

    it('should sanitize milestone data', async () => {
      const maliciousMilestone = {
        title: '<script>alert("xss")</script>Milestone',
        description: 'Description with\x00null bytes',
        features: [{
          title: 'Feature with "quotes" and \\slashes',
          tasks: ['Task 1', null, undefined, 'Valid task']
        }]
      };

      const result = await yoloWarp.execute('sanitized-milestone', {
        milestone: maliciousMilestone
      });

      // Verify data was sanitized
      expect(result.epic.title).not.toContain('<script>');
      expect(result.epic.description).not.toContain('\x00');
      
      // Verify invalid tasks were filtered out
      const featureTasks = result.features[0].tasks;
      expect(featureTasks).toHaveLength(2);
      expect(featureTasks.every(task => typeof task === 'string')).toBe(true);
    });
  });
});