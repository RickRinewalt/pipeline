const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Mock external dependencies
jest.mock('child_process');
jest.mock('@octokit/rest');
jest.mock('../yolo-pro/src/cli/github-client.js');
jest.mock('../yolo-pro/src/cli/swarm-manager.js');
jest.mock('../yolo-pro/src/cli/git-automation.js');

const YoloWarp = require('../yolo-pro/src/cli/yolo-warp.js');
const GitHubClient = require('../yolo-pro/src/cli/github-client.js');
const SwarmManager = require('../yolo-pro/src/cli/swarm-manager.js');
const GitAutomation = require('../yolo-pro/src/cli/git-automation.js');

describe('Feature 8: Comprehensive CLI Commands Implementation', () => {
  let yoloWarp;
  let mockGitHub;
  let mockSwarm;
  let mockGit;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock GitHub client
    mockGitHub = {
      getMilestone: jest.fn(),
      getIssuesForMilestone: jest.fn(),
      updateIssue: jest.fn(),
      createPullRequest: jest.fn(),
      closeMilestone: jest.fn(),
      getRepository: jest.fn()
    };
    GitHubClient.mockImplementation(() => mockGitHub);

    // Mock swarm manager
    mockSwarm = {
      initializeSwarm: jest.fn(),
      spawnAgents: jest.fn(),
      orchestrateTask: jest.fn(),
      monitorProgress: jest.fn(),
      destroySwarm: jest.fn(),
      getSwarmStatus: jest.fn()
    };
    SwarmManager.mockImplementation(() => mockSwarm);

    // Mock git automation
    mockGit = {
      createFeatureBranch: jest.fn(),
      commitChanges: jest.fn(),
      pushBranch: jest.fn(),
      mergeBranch: jest.fn(),
      cleanupBranch: jest.fn(),
      getCurrentBranch: jest.fn(),
      getRepoStatus: jest.fn()
    };
    GitAutomation.mockImplementation(() => mockGit);

    yoloWarp = new YoloWarp({
      owner: 'test-owner',
      repo: 'test-repo',
      token: 'test-token'
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('YoloWarp Constructor', () => {
    it('should initialize with required configuration', () => {
      expect(() => new YoloWarp({
        owner: 'test-owner',
        repo: 'test-repo',
        token: 'test-token'
      })).not.toThrow();
    });

    it('should throw error for missing required config', () => {
      expect(() => new YoloWarp({})).toThrow('Missing required configuration');
    });

    it('should initialize clients with correct parameters', () => {
      new YoloWarp({
        owner: 'test-owner',
        repo: 'test-repo',
        token: 'test-token'
      });

      expect(GitHubClient).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        token: 'test-token'
      });
    });
  });

  describe('Core Workflow: executeMilestone', () => {
    const mockMilestone = {
      id: 1,
      number: 1,
      title: 'Test Milestone',
      description: 'Test milestone description',
      state: 'open',
      open_issues: 3
    };

    const mockIssues = [
      { number: 10, title: 'Issue 1', state: 'open', assignee: null },
      { number: 11, title: 'Issue 2', state: 'open', assignee: null },
      { number: 12, title: 'Issue 3', state: 'open', assignee: null }
    ];

    beforeEach(() => {
      mockGitHub.getMilestone.mockResolvedValue(mockMilestone);
      mockGitHub.getIssuesForMilestone.mockResolvedValue(mockIssues);
      mockSwarm.initializeSwarm.mockResolvedValue({ swarmId: 'test-swarm-id' });
      mockSwarm.spawnAgents.mockResolvedValue(['agent1', 'agent2', 'agent3']);
      mockGit.createFeatureBranch.mockResolvedValue('milestone-1-automation');
    });

    it('should execute complete milestone workflow successfully', async () => {
      mockSwarm.orchestrateTask.mockResolvedValue({ success: true, results: {} });
      mockGit.getCurrentBranch.mockResolvedValue('main');

      const result = await yoloWarp.executeMilestone(1);

      expect(result.success).toBe(true);
      expect(mockGitHub.getMilestone).toHaveBeenCalledWith(1);
      expect(mockSwarm.initializeSwarm).toHaveBeenCalled();
      expect(mockGit.createFeatureBranch).toHaveBeenCalled();
    });

    it('should handle milestone not found error', async () => {
      mockGitHub.getMilestone.mockRejectedValue(new Error('Milestone not found'));

      await expect(yoloWarp.executeMilestone(999)).rejects.toThrow('Milestone not found');
    });

    it('should validate milestone state before execution', async () => {
      const closedMilestone = { ...mockMilestone, state: 'closed' };
      mockGitHub.getMilestone.mockResolvedValue(closedMilestone);

      await expect(yoloWarp.executeMilestone(1)).rejects.toThrow('Milestone is already closed');
    });

    it('should handle empty milestone gracefully', async () => {
      const emptyMilestone = { ...mockMilestone, open_issues: 0 };
      mockGitHub.getMilestone.mockResolvedValue(emptyMilestone);
      mockGitHub.getIssuesForMilestone.mockResolvedValue([]);

      const result = await yoloWarp.executeMilestone(1);

      expect(result.success).toBe(true);
      expect(result.message).toContain('No open issues');
    });
  });

  describe('Issue Processing', () => {
    const mockIssues = [
      { 
        number: 10, 
        title: 'Simple Task', 
        body: 'Simple implementation task',
        labels: [{ name: 'enhancement' }],
        assignee: null 
      },
      { 
        number: 11, 
        title: 'Complex Feature', 
        body: 'Complex feature requiring multiple components',
        labels: [{ name: 'feature' }, { name: 'high-priority' }],
        assignee: null 
      }
    ];

    it('should process issues sequentially', async () => {
      mockSwarm.orchestrateTask.mockResolvedValue({ success: true, results: {} });
      
      await yoloWarp.processIssues(mockIssues);

      expect(mockSwarm.orchestrateTask).toHaveBeenCalledTimes(2);
    });

    it('should categorize issues by complexity', () => {
      const categorized = yoloWarp.categorizeIssues(mockIssues);

      expect(categorized.simple).toHaveLength(1);
      expect(categorized.complex).toHaveLength(1);
    });

    it('should assign appropriate agents based on issue type', () => {
      const simpleIssue = mockIssues[0];
      const complexIssue = mockIssues[1];

      const simpleAgents = yoloWarp.getRequiredAgents(simpleIssue);
      const complexAgents = yoloWarp.getRequiredAgents(complexIssue);

      expect(simpleAgents).toContain('coder');
      expect(complexAgents).toContain('architect');
      expect(complexAgents.length).toBeGreaterThan(simpleAgents.length);
    });

    it('should handle issue processing failures gracefully', async () => {
      mockSwarm.orchestrateTask.mockRejectedValue(new Error('Task execution failed'));

      const result = await yoloWarp.processIssues([mockIssues[0]]);

      expect(result.failures).toHaveLength(1);
      expect(result.failures[0].error).toBe('Task execution failed');
    });

    it('should update issue progress in real-time', async () => {
      mockSwarm.orchestrateTask.mockImplementation(async () => {
        // Simulate progress updates
        return { success: true, results: {} };
      });

      await yoloWarp.processIssues([mockIssues[0]]);

      expect(mockGitHub.updateIssue).toHaveBeenCalledWith(
        10,
        expect.objectContaining({
          body: expect.stringContaining('[YOLO-WARP PROCESSING]')
        })
      );
    });
  });

  describe('Swarm Orchestration', () => {
    it('should initialize swarm with hierarchical topology for complex milestones', async () => {
      const complexMilestone = { open_issues: 10 };
      
      await yoloWarp.initializeSwarmForMilestone(complexMilestone);

      expect(mockSwarm.initializeSwarm).toHaveBeenCalledWith({
        topology: 'hierarchical',
        maxAgents: expect.any(Number)
      });
    });

    it('should scale swarm based on milestone complexity', async () => {
      const simpleMilestone = { open_issues: 2 };
      const complexMilestone = { open_issues: 15 };

      await yoloWarp.initializeSwarmForMilestone(simpleMilestone);
      const simpleCall = mockSwarm.initializeSwarm.mock.calls[0][0];

      vi.clearAllMocks();

      await yoloWarp.initializeSwarmForMilestone(complexMilestone);
      const complexCall = mockSwarm.initializeSwarm.mock.calls[0][0];

      expect(complexCall.maxAgents).toBeGreaterThan(simpleCall.maxAgents);
    });

    it('should handle swarm initialization failures', async () => {
      mockSwarm.initializeSwarm.mockRejectedValue(new Error('Swarm initialization failed'));

      await expect(yoloWarp.initializeSwarmForMilestone({ open_issues: 5 }))
        .rejects.toThrow('Swarm initialization failed');
    });

    it('should clean up swarm resources on completion', async () => {
      const swarmId = 'test-swarm-id';
      mockSwarm.initializeSwarm.mockResolvedValue({ swarmId });

      await yoloWarp.executeMilestone(1);

      expect(mockSwarm.destroySwarm).toHaveBeenCalledWith(swarmId);
    });

    it('should monitor swarm performance during execution', async () => {
      mockSwarm.monitorProgress.mockResolvedValue({
        activeAgents: 3,
        completedTasks: 2,
        failedTasks: 0
      });

      const status = await yoloWarp.getSwarmStatus();

      expect(mockSwarm.monitorProgress).toHaveBeenCalled();
      expect(status.activeAgents).toBe(3);
    });
  });

  describe('Git Automation', () => {
    it('should create feature branch for milestone', async () => {
      await yoloWarp.setupGitBranch(1, 'Test Milestone');

      expect(mockGit.createFeatureBranch).toHaveBeenCalledWith(
        'milestone-1-test-milestone'
      );
    });

    it('should commit changes after each issue completion', async () => {
      const issue = { number: 10, title: 'Test Issue' };
      
      await yoloWarp.commitIssueCompletion(issue);

      expect(mockGit.commitChanges).toHaveBeenCalledWith(
        expect.stringContaining('Complete issue #10')
      );
    });

    it('should handle git operation failures', async () => {
      mockGit.createFeatureBranch.mockRejectedValue(new Error('Git branch creation failed'));

      await expect(yoloWarp.setupGitBranch(1, 'Test'))
        .rejects.toThrow('Git branch creation failed');
    });

    it('should clean up git resources on milestone completion', async () => {
      const branchName = 'milestone-1-test';
      mockGit.createFeatureBranch.mockResolvedValue(branchName);

      await yoloWarp.executeMilestone(1);

      expect(mockGit.mergeBranch).toHaveBeenCalledWith(branchName, 'main');
      expect(mockGit.cleanupBranch).toHaveBeenCalledWith(branchName);
    });

    it('should handle merge conflicts gracefully', async () => {
      mockGit.mergeBranch.mockRejectedValue(new Error('Merge conflict detected'));

      const result = await yoloWarp.finalizeMilestone('test-branch', 1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Merge conflict');
    });
  });

  describe('GitHub Integration', () => {
    it('should create pull request for milestone completion', async () => {
      const branchName = 'milestone-1-test';
      const milestoneTitle = 'Test Milestone';

      await yoloWarp.createMilestonePR(branchName, milestoneTitle, 1);

      expect(mockGitHub.createPullRequest).toHaveBeenCalledWith({
        title: expect.stringContaining(milestoneTitle),
        head: branchName,
        base: 'main',
        body: expect.stringContaining('YOLO-WARP automated completion')
      });
    });

    it('should close milestone after successful completion', async () => {
      mockGitHub.closeMilestone.mockResolvedValue({ state: 'closed' });

      const result = await yoloWarp.closeMilestone(1);

      expect(mockGitHub.closeMilestone).toHaveBeenCalledWith(1);
      expect(result.state).toBe('closed');
    });

    it('should update issue labels and comments during processing', async () => {
      const issue = { number: 10, title: 'Test Issue' };
      
      await yoloWarp.markIssueInProgress(issue);

      expect(mockGitHub.updateIssue).toHaveBeenCalledWith(10, {
        labels: expect.arrayContaining(['yolo-warp-processing']),
        body: expect.stringContaining('[YOLO-WARP PROCESSING]')
      });
    });

    it('should handle GitHub API rate limiting', async () => {
      const rateLimitError = new Error('API rate limit exceeded');
      rateLimitError.status = 403;
      mockGitHub.updateIssue.mockRejectedValue(rateLimitError);

      const result = await yoloWarp.markIssueInProgress({ number: 10 });

      expect(result.rateLimited).toBe(true);
    });
  });

  describe('Progress Tracking', () => {
    it('should track milestone progress in real-time', async () => {
      const progressTracker = yoloWarp.createProgressTracker(1);
      
      progressTracker.updateProgress('issue-processing', 50);
      
      expect(progressTracker.getOverallProgress()).toBe(50);
    });

    it('should generate comprehensive completion report', async () => {
      const mockResults = {
        milestoneId: 1,
        totalIssues: 5,
        completedIssues: 4,
        failedIssues: 1,
        executionTime: 1800
      };

      const report = yoloWarp.generateCompletionReport(mockResults);

      expect(report).toContain('Milestone Completion Report');
      expect(report).toContain('80% success rate');
    });

    it('should maintain execution logs for debugging', () => {
      yoloWarp.log('Test log entry', 'info');
      
      const logs = yoloWarp.getExecutionLogs();
      
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('Test log entry');
      expect(logs[0].level).toBe('info');
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should implement retry mechanism for failed operations', async () => {
      let attempts = 0;
      mockSwarm.orchestrateTask.mockImplementation(async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary failure');
        }
        return { success: true, results: {} };
      });

      const result = await yoloWarp.executeWithRetry(
        () => mockSwarm.orchestrateTask({}),
        { maxRetries: 3 }
      );

      expect(result.success).toBe(true);
      expect(attempts).toBe(3);
    });

    it('should handle partial milestone completion gracefully', async () => {
      // Mock scenario where some issues fail
      mockSwarm.orchestrateTask
        .mockResolvedValueOnce({ success: true, results: {} })
        .mockRejectedValueOnce(new Error('Task failed'))
        .mockResolvedValueOnce({ success: true, results: {} });

      const result = await yoloWarp.executeMilestone(1);

      expect(result.partialSuccess).toBe(true);
      expect(result.completedIssues).toBe(2);
      expect(result.failedIssues).toBe(1);
    });

    it('should provide detailed error context for debugging', async () => {
      const error = new Error('Test error');
      error.stack = 'Error stack trace';

      try {
        await yoloWarp.executeWithErrorContext(
          () => { throw error; },
          { context: 'milestone execution', milestoneId: 1 }
        );
      } catch (contextualError) {
        expect(contextualError.context).toBe('milestone execution');
        expect(contextualError.milestoneId).toBe(1);
        expect(contextualError.originalError).toBe(error);
      }
    });

    it('should implement circuit breaker for repeated failures', async () => {
      // Simulate repeated failures
      for (let i = 0; i < 5; i++) {
        try {
          await yoloWarp.executeWithCircuitBreaker(() => {
            throw new Error('Consistent failure');
          });
        } catch (e) {
          // Expected failures
        }
      }

      // Circuit should be open now
      const result = await yoloWarp.executeWithCircuitBreaker(() => {
        throw new Error('This should not execute');
      });

      expect(result.circuitOpen).toBe(true);
    });
  });

  describe('CLI Integration', () => {
    it('should parse command line arguments correctly', () => {
      const args = ['--milestone', '1', '--owner', 'test-owner', '--repo', 'test-repo'];
      
      const parsed = yoloWarp.parseCliArguments(args);
      
      expect(parsed.milestone).toBe('1');
      expect(parsed.owner).toBe('test-owner');
      expect(parsed.repo).toBe('test-repo');
    });

    it('should validate required CLI parameters', () => {
      const incompleteArgs = ['--milestone', '1'];
      
      expect(() => yoloWarp.validateCliArguments(incompleteArgs))
        .toThrow('Missing required arguments');
    });

    it('should support dry-run mode', async () => {
      const result = await yoloWarp.executeMilestone(1, { dryRun: true });
      
      expect(result.dryRun).toBe(true);
      expect(mockGit.commitChanges).not.toHaveBeenCalled();
      expect(mockGitHub.updateIssue).not.toHaveBeenCalled();
    });

    it('should provide verbose output when requested', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await yoloWarp.executeMilestone(1, { verbose: true });
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Verbose mode enabled')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('Performance and Optimization', () => {
    it('should process issues in parallel when possible', async () => {
      const independentIssues = [
        { number: 10, dependencies: [] },
        { number: 11, dependencies: [] },
        { number: 12, dependencies: [] }
      ];

      const startTime = Date.now();
      await yoloWarp.processIssues(independentIssues, { parallel: true });
      const endTime = Date.now();

      // Parallel execution should be faster than sequential
      expect(endTime - startTime).toBeLessThan(1000);
      expect(mockSwarm.orchestrateTask).toHaveBeenCalledTimes(3);
    });

    it('should respect issue dependencies in execution order', async () => {
      const dependentIssues = [
        { number: 10, dependencies: [] },
        { number: 11, dependencies: [10] },
        { number: 12, dependencies: [10, 11] }
      ];

      const executionOrder = [];
      mockSwarm.orchestrateTask.mockImplementation(async (task) => {
        executionOrder.push(task.issue.number);
        return { success: true, results: {} };
      });

      await yoloWarp.processIssues(dependentIssues);

      expect(executionOrder).toEqual([10, 11, 12]);
    });

    it('should optimize swarm resource usage', async () => {
      const resourceUsage = await yoloWarp.optimizeSwarmResources({
        currentAgents: 10,
        queuedTasks: 3,
        systemLoad: 0.7
      });

      expect(resourceUsage.recommendedAgents).toBeLessThan(10);
    });
  });

  describe('Integration Test Scenarios', () => {
    it('should execute complete end-to-end workflow', async () => {
      // Setup comprehensive mock scenario
      const milestone = { id: 1, number: 1, title: 'E2E Test', open_issues: 2 };
      const issues = [
        { number: 10, title: 'Issue 1', state: 'open' },
        { number: 11, title: 'Issue 2', state: 'open' }
      ];

      mockGitHub.getMilestone.mockResolvedValue(milestone);
      mockGitHub.getIssuesForMilestone.mockResolvedValue(issues);
      mockSwarm.initializeSwarm.mockResolvedValue({ swarmId: 'e2e-test' });
      mockSwarm.orchestrateTask.mockResolvedValue({ success: true });
      mockGit.createFeatureBranch.mockResolvedValue('milestone-1-e2e-test');

      const result = await yoloWarp.executeMilestone(1);

      // Verify complete workflow execution
      expect(mockGitHub.getMilestone).toHaveBeenCalled();
      expect(mockSwarm.initializeSwarm).toHaveBeenCalled();
      expect(mockGit.createFeatureBranch).toHaveBeenCalled();
      expect(mockSwarm.orchestrateTask).toHaveBeenCalledTimes(2);
      expect(mockGitHub.createPullRequest).toHaveBeenCalled();
      expect(mockSwarm.destroySwarm).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should handle mixed success/failure scenarios realistically', async () => {
      mockSwarm.orchestrateTask
        .mockResolvedValueOnce({ success: true, results: {} })
        .mockRejectedValueOnce(new Error('Partial failure'))
        .mockResolvedValueOnce({ success: true, results: {} });

      const result = await yoloWarp.executeMilestone(1);

      expect(result.partialSuccess).toBe(true);
      expect(result.summary).toContain('2 of 3 issues completed');
    });
  });

  describe('Configuration and Customization', () => {
    it('should support custom agent configurations', () => {
      const customConfig = {
        agentTypes: ['researcher', 'coder', 'tester', 'custom-agent'],
        maxConcurrentTasks: 5,
        retryPolicy: { maxRetries: 5, backoffFactor: 2 }
      };

      yoloWarp.configure(customConfig);

      expect(yoloWarp.config.agentTypes).toContain('custom-agent');
      expect(yoloWarp.config.maxConcurrentTasks).toBe(5);
    });

    it('should validate configuration parameters', () => {
      const invalidConfig = {
        maxConcurrentTasks: -1,
        retryPolicy: { maxRetries: 'invalid' }
      };

      expect(() => yoloWarp.configure(invalidConfig))
        .toThrow('Invalid configuration');
    });
  });
});

// Test utilities and helpers
class TestHelpers {
  static createMockMilestone(overrides = {}) {
    return {
      id: 1,
      number: 1,
      title: 'Test Milestone',
      description: 'Test description',
      state: 'open',
      open_issues: 3,
      ...overrides
    };
  }

  static createMockIssue(overrides = {}) {
    return {
      number: 10,
      title: 'Test Issue',
      body: 'Test issue body',
      state: 'open',
      labels: [],
      assignee: null,
      ...overrides
    };
  }

  static async simulateApiDelay(ms = 100) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export for use in other test files
module.exports = { TestHelpers };