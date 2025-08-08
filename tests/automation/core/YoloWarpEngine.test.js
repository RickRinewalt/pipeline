const { YoloWarpEngine } = require('../../../src/automation/core/YoloWarpEngine');
const { MilestoneProcessor } = require('../../../src/automation/processors/MilestoneProcessor');
const { SparcAutomator } = require('../../../src/automation/processors/SparcAutomator');
const { WCPManager } = require('../../../src/automation/managers/WCPManager');
const { CIPipelineManager } = require('../../../src/automation/managers/CIPipelineManager');
const { ProgressReporter } = require('../../../src/automation/reporters/ProgressReporter');

jest.mock('../../../src/automation/processors/MilestoneProcessor');
jest.mock('../../../src/automation/processors/SparcAutomator');
jest.mock('../../../src/automation/managers/WCPManager');
jest.mock('../../../src/automation/managers/CIPipelineManager');
jest.mock('../../../src/automation/reporters/ProgressReporter');

describe('YoloWarpEngine', () => {
  let engine;
  let mockMilestoneProcessor;
  let mockSparcAutomator;
  let mockWCPManager;
  let mockCIPipelineManager;
  let mockProgressReporter;
  let mockLogger;
  let mockConfig;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    };

    mockConfig = {
      github: {
        owner: 'test-owner',
        repo: 'test-repo',
        token: 'test-token'
      },
      automation: {
        maxConcurrentTasks: 5,
        retryAttempts: 3,
        monitoringInterval: 1000
      },
      sparc: {
        enableParallelProcessing: true,
        timeoutMs: 30000
      }
    };

    mockMilestoneProcessor = {
      processMilestone: jest.fn(),
      getMilestoneStatus: jest.fn(),
      createSubIssues: jest.fn()
    };
    mockSparcAutomator = {
      runSparcWorkflow: jest.fn(),
      getWorkflowStatus: jest.fn()
    };
    mockWCPManager = {
      initializeWCP: jest.fn(),
      processFeature: jest.fn(),
      getWCPStatus: jest.fn()
    };
    mockCIPipelineManager = {
      startPipeline: jest.fn(),
      monitorPipeline: jest.fn(),
      getPipelineStatus: jest.fn()
    };
    mockProgressReporter = {
      generateReport: jest.fn(),
      trackProgress: jest.fn(),
      getMetrics: jest.fn()
    };

    MilestoneProcessor.mockImplementation(() => mockMilestoneProcessor);
    SparcAutomator.mockImplementation(() => mockSparcAutomator);
    WCPManager.mockImplementation(() => mockWCPManager);
    CIPipelineManager.mockImplementation(() => mockCIPipelineManager);
    ProgressReporter.mockImplementation(() => mockProgressReporter);

    engine = new YoloWarpEngine(mockConfig, mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with required components', () => {
      expect(engine).toBeDefined();
      expect(engine.config).toBe(mockConfig);
      expect(engine.logger).toBe(mockLogger);
      expect(MilestoneProcessor).toHaveBeenCalledWith(mockConfig, mockLogger);
      expect(SparcAutomator).toHaveBeenCalledWith(mockConfig, mockLogger);
      expect(WCPManager).toHaveBeenCalledWith(mockConfig, mockLogger);
      expect(CIPipelineManager).toHaveBeenCalledWith(mockConfig, mockLogger);
      expect(ProgressReporter).toHaveBeenCalledWith(mockConfig, mockLogger);
    });

    it('should throw error with invalid config', () => {
      expect(() => new YoloWarpEngine(null, mockLogger)).toThrow('Config is required');
    });

    it('should throw error with invalid logger', () => {
      expect(() => new YoloWarpEngine(mockConfig, null)).toThrow('Logger is required');
    });
  });

  describe('automateWorkflow', () => {
    const mockWorkflowSpec = {
      milestoneId: 123,
      features: ['feature1', 'feature2'],
      sparcEnabled: true,
      wcpEnabled: true,
      ciEnabled: true
    };

    it('should execute complete automation workflow successfully', async () => {
      // Mock successful responses
      mockMilestoneProcessor.processMilestone.mockResolvedValue({
        success: true,
        issuesCreated: 5,
        milestoneId: 123
      });
      mockWCPManager.initializeWCP.mockResolvedValue({ success: true });
      mockSparcAutomator.runSparcWorkflow.mockResolvedValue({ success: true });
      mockCIPipelineManager.startPipeline.mockResolvedValue({ success: true });
      mockProgressReporter.generateReport.mockResolvedValue({
        progress: 100,
        status: 'completed'
      });

      const result = await engine.automateWorkflow(mockWorkflowSpec);

      expect(result.success).toBe(true);
      expect(result.workflowId).toBeDefined();
      expect(mockMilestoneProcessor.processMilestone).toHaveBeenCalledWith(123);
      expect(mockWCPManager.initializeWCP).toHaveBeenCalled();
      expect(mockSparcAutomator.runSparcWorkflow).toHaveBeenCalled();
      expect(mockCIPipelineManager.startPipeline).toHaveBeenCalled();
      expect(mockProgressReporter.generateReport).toHaveBeenCalled();
    });

    it('should handle milestone processing failure', async () => {
      mockMilestoneProcessor.processMilestone.mockRejectedValue(
        new Error('Milestone processing failed')
      );

      const result = await engine.automateWorkflow(mockWorkflowSpec);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Milestone processing failed');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle partial automation workflow', async () => {
      const partialSpec = {
        milestoneId: 123,
        sparcEnabled: false,
        wcpEnabled: true,
        ciEnabled: false
      };

      mockMilestoneProcessor.processMilestone.mockResolvedValue({ success: true });
      mockWCPManager.initializeWCP.mockResolvedValue({ success: true });

      const result = await engine.automateWorkflow(partialSpec);

      expect(result.success).toBe(true);
      expect(mockSparcAutomator.runSparcWorkflow).not.toHaveBeenCalled();
      expect(mockCIPipelineManager.startPipeline).not.toHaveBeenCalled();
    });

    it('should validate workflow specification', async () => {
      const invalidSpec = {};

      const result = await engine.automateWorkflow(invalidSpec);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid workflow specification');
    });
  });

  describe('monitorWorkflow', () => {
    const workflowId = 'test-workflow-123';

    it('should monitor active workflow and return status', async () => {
      mockMilestoneProcessor.getMilestoneStatus.mockResolvedValue({
        progress: 75,
        status: 'in-progress'
      });
      mockSparcAutomator.getWorkflowStatus.mockResolvedValue({
        phase: 'refinement',
        progress: 80
      });
      mockCIPipelineManager.getPipelineStatus.mockResolvedValue({
        status: 'running',
        success: true
      });

      const status = await engine.monitorWorkflow(workflowId);

      expect(status.workflowId).toBe(workflowId);
      expect(status.overallProgress).toBeGreaterThan(0);
      expect(status.components).toHaveProperty('milestone');
      expect(status.components).toHaveProperty('sparc');
      expect(status.components).toHaveProperty('ci');
    });

    it('should handle monitoring errors gracefully', async () => {
      mockMilestoneProcessor.getMilestoneStatus.mockRejectedValue(
        new Error('Monitoring failed')
      );

      const status = await engine.monitorWorkflow(workflowId);

      expect(status.error).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should return not found for invalid workflow ID', async () => {
      const status = await engine.monitorWorkflow('invalid-id');

      expect(status.found).toBe(false);
      expect(status.error).toContain('Workflow not found');
    });
  });

  describe('stopWorkflow', () => {
    const workflowId = 'test-workflow-123';

    it('should stop active workflow gracefully', async () => {
      const result = await engine.stopWorkflow(workflowId);

      expect(result.success).toBe(true);
      expect(result.workflowId).toBe(workflowId);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Stopping workflow')
      );
    });

    it('should handle stop errors', async () => {
      // Simulate component that fails to stop
      engine.activeWorkflows.set(workflowId, {
        components: {
          milestone: mockMilestoneProcessor,
          ci: {
            ...mockCIPipelineManager,
            stop: jest.fn().mockRejectedValue(new Error('Stop failed'))
          }
        }
      });

      const result = await engine.stopWorkflow(workflowId);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('getActiveWorkflows', () => {
    it('should return list of active workflows', () => {
      engine.activeWorkflows.set('workflow1', { id: 'workflow1' });
      engine.activeWorkflows.set('workflow2', { id: 'workflow2' });

      const workflows = engine.getActiveWorkflows();

      expect(workflows).toHaveLength(2);
      expect(workflows[0]).toHaveProperty('id');
    });

    it('should return empty array when no active workflows', () => {
      const workflows = engine.getActiveWorkflows();

      expect(workflows).toHaveLength(0);
    });
  });

  describe('error handling and recovery', () => {
    it('should implement retry mechanism for failed operations', async () => {
      const mockWorkflowSpec = {
        milestoneId: 123,
        sparcEnabled: true
      };

      // First two calls fail, third succeeds
      mockMilestoneProcessor.processMilestone
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue({ success: true });

      const result = await engine.automateWorkflow(mockWorkflowSpec);

      expect(result.success).toBe(true);
      expect(mockMilestoneProcessor.processMilestone).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retry attempts', async () => {
      const mockWorkflowSpec = {
        milestoneId: 123,
        sparcEnabled: true
      };

      mockMilestoneProcessor.processMilestone.mockRejectedValue(
        new Error('Persistent error')
      );

      const result = await engine.automateWorkflow(mockWorkflowSpec);

      expect(result.success).toBe(false);
      expect(mockMilestoneProcessor.processMilestone).toHaveBeenCalledTimes(3);
    });
  });

  describe('concurrent workflow management', () => {
    it('should handle multiple concurrent workflows', async () => {
      const workflow1 = { milestoneId: 123, sparcEnabled: true };
      const workflow2 = { milestoneId: 124, wcpEnabled: true };

      mockMilestoneProcessor.processMilestone.mockResolvedValue({ success: true });
      mockSparcAutomator.runSparcWorkflow.mockResolvedValue({ success: true });
      mockWCPManager.initializeWCP.mockResolvedValue({ success: true });

      const [result1, result2] = await Promise.all([
        engine.automateWorkflow(workflow1),
        engine.automateWorkflow(workflow2)
      ]);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.workflowId).not.toBe(result2.workflowId);
    });

    it('should respect max concurrent tasks limit', async () => {
      // Override config for this test
      engine.config.automation.maxConcurrentTasks = 2;

      const workflows = Array.from({ length: 5 }, (_, i) => ({
        milestoneId: 100 + i,
        sparcEnabled: true
      }));

      mockMilestoneProcessor.processMilestone.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ success: true }), 100))
      );

      const results = await Promise.all(
        workflows.map(workflow => engine.automateWorkflow(workflow))
      );

      expect(results.every(r => r.success)).toBe(true);
      expect(engine.getActiveWorkflows()).toHaveLength(0); // All should be completed
    });
  });
});