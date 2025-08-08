const { SparcAutomator } = require('../../../src/automation/processors/SparcAutomator');
const { exec } = require('child_process');
const { promisify } = require('util');

jest.mock('child_process');
jest.mock('util');

describe('SparcAutomator', () => {
  let automator;
  let mockLogger;
  let mockConfig;
  let mockExec;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    };

    mockConfig = {
      sparc: {
        enableParallelProcessing: true,
        timeoutMs: 30000,
        modes: {
          specification: 'spec-pseudocode',
          pseudocode: 'spec-pseudocode', 
          architecture: 'architect',
          refinement: 'tdd',
          completion: 'integration'
        }
      },
      automation: {
        workingDirectory: '/test/workspace',
        retryAttempts: 3
      }
    };

    mockExec = jest.fn();
    promisify.mockReturnValue(mockExec);

    automator = new SparcAutomator(mockConfig, mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with proper configuration', () => {
      expect(automator).toBeDefined();
      expect(automator.config).toBe(mockConfig);
      expect(automator.logger).toBe(mockLogger);
      expect(automator.phases).toEqual(['specification', 'pseudocode', 'architecture', 'refinement', 'completion']);
    });

    it('should use default configuration when not provided', () => {
      const defaultAutomator = new SparcAutomator({}, mockLogger);
      expect(defaultAutomator.config.sparc.timeoutMs).toBe(60000);
    });
  });

  describe('runSparcWorkflow', () => {
    const taskDescription = 'Implement user authentication system';
    
    it('should execute complete SPARC workflow successfully', async () => {
      // Mock successful execution for each phase
      mockExec.mockResolvedValue({
        stdout: JSON.stringify({ 
          success: true, 
          phase: 'specification',
          output: 'Phase completed successfully'
        }),
        stderr: ''
      });

      const result = await automator.runSparcWorkflow(taskDescription);

      expect(result.success).toBe(true);
      expect(result.workflowId).toBeDefined();
      expect(result.phases).toHaveLength(5);
      expect(result.completedPhases).toBe(5);
      
      // Verify all phases were executed
      expect(mockExec).toHaveBeenCalledTimes(5);
      
      // Verify specific phase commands
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('npx claude-flow sparc run spec-pseudocode'),
        expect.any(Object)
      );
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('npx claude-flow sparc run architect'),
        expect.any(Object)
      );
    });

    it('should handle parallel processing when enabled', async () => {
      mockConfig.sparc.enableParallelProcessing = true;
      mockExec.mockResolvedValue({
        stdout: JSON.stringify({ success: true }),
        stderr: ''
      });

      const result = await automator.runSparcWorkflow(taskDescription);

      expect(result.success).toBe(true);
      expect(result.parallelExecution).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Running SPARC phases in parallel')
      );
    });

    it('should handle sequential processing when parallel is disabled', async () => {
      mockConfig.sparc.enableParallelProcessing = false;
      mockExec.mockResolvedValue({
        stdout: JSON.stringify({ success: true }),
        stderr: ''
      });

      const result = await automator.runSparcWorkflow(taskDescription);

      expect(result.success).toBe(true);
      expect(result.parallelExecution).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Running SPARC phases sequentially')
      );
    });

    it('should handle phase execution failure', async () => {
      mockExec
        .mockResolvedValueOnce({ 
          stdout: JSON.stringify({ success: true }), 
          stderr: '' 
        }) // specification succeeds
        .mockRejectedValueOnce(new Error('Command failed')) // pseudocode fails
        .mockResolvedValue({ 
          stdout: JSON.stringify({ success: true }), 
          stderr: '' 
        }); // remaining phases succeed

      const result = await automator.runSparcWorkflow(taskDescription);

      expect(result.success).toBe(false);
      expect(result.failedPhase).toBe('pseudocode');
      expect(result.error).toContain('Command failed');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should implement retry mechanism for failed phases', async () => {
      mockExec
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue({ 
          stdout: JSON.stringify({ success: true }), 
          stderr: '' 
        });

      const result = await automator.runSparcWorkflow(taskDescription);

      expect(result.success).toBe(true);
      // Should retry specification phase 3 times total
      expect(mockExec).toHaveBeenCalledTimes(7); // 3 retries + 4 other phases
    });

    it('should validate task description', async () => {
      const result = await automator.runSparcWorkflow('');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Task description is required');
    });

    it('should handle timeout scenarios', async () => {
      mockConfig.sparc.timeoutMs = 100;
      mockExec.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 200))
      );

      const result = await automator.runSparcWorkflow(taskDescription);

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });
  });

  describe('runSinglePhase', () => {
    it('should execute individual SPARC phase', async () => {
      const phase = 'architecture';
      const taskDescription = 'Design system architecture';

      mockExec.mockResolvedValue({
        stdout: JSON.stringify({ 
          success: true, 
          phase: 'architecture',
          artifacts: ['system-design.md', 'component-diagram.png']
        }),
        stderr: ''
      });

      const result = await automator.runSinglePhase(phase, taskDescription);

      expect(result.success).toBe(true);
      expect(result.phase).toBe(phase);
      expect(result.artifacts).toBeDefined();
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('npx claude-flow sparc run architect'),
        expect.objectContaining({
          timeout: 30000,
          cwd: '/test/workspace'
        })
      );
    });

    it('should handle invalid phase names', async () => {
      const result = await automator.runSinglePhase('invalid-phase', 'task');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid phase');
    });

    it('should parse command output correctly', async () => {
      const complexOutput = {
        success: true,
        phase: 'refinement',
        artifacts: ['tests/auth.test.js', 'src/auth.js'],
        metrics: {
          testCoverage: 95,
          lintErrors: 0,
          buildTime: '2.3s'
        },
        nextSteps: ['Deploy to staging', 'Run integration tests']
      };

      mockExec.mockResolvedValue({
        stdout: JSON.stringify(complexOutput),
        stderr: ''
      });

      const result = await automator.runSinglePhase('refinement', 'implement TDD');

      expect(result.success).toBe(true);
      expect(result.artifacts).toEqual(complexOutput.artifacts);
      expect(result.metrics).toEqual(complexOutput.metrics);
      expect(result.nextSteps).toEqual(complexOutput.nextSteps);
    });
  });

  describe('getWorkflowStatus', () => {
    const workflowId = 'sparc-workflow-123';

    beforeEach(() => {
      // Setup active workflow
      automator.activeWorkflows.set(workflowId, {
        id: workflowId,
        taskDescription: 'Test task',
        phases: [
          { name: 'specification', status: 'completed', startTime: Date.now() - 10000, endTime: Date.now() - 8000 },
          { name: 'pseudocode', status: 'completed', startTime: Date.now() - 8000, endTime: Date.now() - 6000 },
          { name: 'architecture', status: 'in-progress', startTime: Date.now() - 6000 },
          { name: 'refinement', status: 'pending' },
          { name: 'completion', status: 'pending' }
        ],
        startTime: Date.now() - 10000
      });
    });

    it('should return comprehensive workflow status', () => {
      const status = automator.getWorkflowStatus(workflowId);

      expect(status.workflowId).toBe(workflowId);
      expect(status.currentPhase).toBe('architecture');
      expect(status.progress).toBe(40); // 2 out of 5 phases completed
      expect(status.completedPhases).toBe(2);
      expect(status.totalPhases).toBe(5);
      expect(status.elapsedTime).toBeGreaterThan(0);
    });

    it('should calculate estimated completion time', () => {
      const status = automator.getWorkflowStatus(workflowId);

      expect(status.estimatedCompletion).toBeDefined();
      expect(typeof status.estimatedCompletion).toBe('number');
    });

    it('should handle completed workflows', () => {
      const workflow = automator.activeWorkflows.get(workflowId);
      workflow.phases.forEach(phase => {
        phase.status = 'completed';
        phase.endTime = phase.endTime || Date.now();
      });

      const status = automator.getWorkflowStatus(workflowId);

      expect(status.progress).toBe(100);
      expect(status.status).toBe('completed');
      expect(status.totalDuration).toBeDefined();
    });

    it('should return not found for invalid workflow ID', () => {
      const status = automator.getWorkflowStatus('invalid-id');

      expect(status.found).toBe(false);
      expect(status.error).toContain('not found');
    });
  });

  describe('stopWorkflow', () => {
    const workflowId = 'sparc-workflow-123';

    it('should stop active workflow gracefully', async () => {
      automator.activeWorkflows.set(workflowId, {
        id: workflowId,
        processes: [
          { kill: jest.fn() },
          { kill: jest.fn() }
        ]
      });

      const result = await automator.stopWorkflow(workflowId);

      expect(result.success).toBe(true);
      expect(result.workflowId).toBe(workflowId);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Stopping SPARC workflow')
      );
    });

    it('should handle stop errors', async () => {
      automator.activeWorkflows.set(workflowId, {
        id: workflowId,
        processes: [
          { kill: jest.fn(() => { throw new Error('Process kill failed'); }) }
        ]
      });

      const result = await automator.stopWorkflow(workflowId);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('batchProcessing', () => {
    it('should handle batch SPARC processing', async () => {
      const tasks = [
        'Implement user login',
        'Create password reset',
        'Add user profile'
      ];

      mockExec.mockResolvedValue({
        stdout: JSON.stringify({ success: true }),
        stderr: ''
      });

      const result = await automator.batchProcess(tasks);

      expect(result.success).toBe(true);
      expect(result.processedTasks).toBe(3);
      expect(result.results).toHaveLength(3);
    });

    it('should handle mixed success/failure in batch', async () => {
      const tasks = ['Task 1', 'Task 2', 'Task 3'];

      mockExec
        .mockResolvedValueOnce({ stdout: JSON.stringify({ success: true }), stderr: '' })
        .mockRejectedValueOnce(new Error('Task 2 failed'))
        .mockResolvedValueOnce({ stdout: JSON.stringify({ success: true }), stderr: '' });

      const result = await automator.batchProcess(tasks);

      expect(result.success).toBe(false); // Overall failure due to one task failing
      expect(result.successfulTasks).toBe(2);
      expect(result.failedTasks).toBe(1);
    });
  });

  describe('artifactManagement', () => {
    it('should collect and organize SPARC artifacts', () => {
      const phaseResults = [
        { 
          phase: 'specification', 
          artifacts: ['requirements.md', 'user-stories.md'] 
        },
        { 
          phase: 'architecture', 
          artifacts: ['system-design.md', 'api-spec.yaml'] 
        },
        { 
          phase: 'refinement', 
          artifacts: ['src/auth.js', 'tests/auth.test.js'] 
        }
      ];

      const organized = automator.organizeArtifacts(phaseResults);

      expect(organized).toHaveProperty('specification');
      expect(organized).toHaveProperty('architecture');
      expect(organized).toHaveProperty('refinement');
      expect(organized.specification).toContain('requirements.md');
      expect(organized.refinement).toContain('src/auth.js');
    });

    it('should validate artifact completeness', () => {
      const artifacts = {
        specification: ['requirements.md'],
        pseudocode: [],
        architecture: ['design.md'],
        refinement: ['code.js', 'test.js'],
        completion: ['deployment.md']
      };

      const validation = automator.validateArtifacts(artifacts);

      expect(validation.isComplete).toBe(false);
      expect(validation.missingArtifacts).toContain('pseudocode');
      expect(validation.completeness).toBeLessThan(100);
    });
  });
});