const { CIPipelineManager } = require('../../../src/automation/managers/CIPipelineManager');
const { Octokit } = require('@octokit/rest');
const { exec } = require('child_process');
const { promisify } = require('util');

jest.mock('@octokit/rest');
jest.mock('child_process');
jest.mock('util');

describe('CIPipelineManager', () => {
  let manager;
  let mockOctokit;
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
      github: {
        owner: 'test-owner',
        repo: 'test-repo',
        token: 'test-token'
      },
      ci: {
        enableAdaptiveMonitoring: true,
        monitoringInterval: 5000,
        maxRetries: 3,
        timeoutMs: 300000,
        qualityGates: {
          testCoverage: 80,
          lintErrors: 0,
          buildSuccess: true
        }
      }
    };

    mockOctokit = {
      rest: {
        actions: {
          listWorkflowRuns: jest.fn(),
          getWorkflowRun: jest.fn(),
          reRunWorkflow: jest.fn(),
          listWorkflowRunLogs: jest.fn()
        },
        checks: {
          listForRef: jest.fn(),
          get: jest.fn()
        },
        pulls: {
          list: jest.fn(),
          get: jest.fn(),
          merge: jest.fn()
        }
      }
    };

    mockExec = jest.fn();
    promisify.mockReturnValue(mockExec);
    Octokit.mockImplementation(() => mockOctokit);

    manager = new CIPipelineManager(mockConfig, mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with GitHub client', () => {
      expect(manager).toBeDefined();
      expect(manager.config).toBe(mockConfig);
      expect(manager.logger).toBe(mockLogger);
      expect(Octokit).toHaveBeenCalledWith({ auth: 'test-token' });
    });

    it('should use default configuration when not provided', () => {
      const defaultManager = new CIPipelineManager({ github: mockConfig.github }, mockLogger);
      expect(defaultManager.config.ci.monitoringInterval).toBe(10000);
      expect(defaultManager.config.ci.maxRetries).toBe(3);
    });
  });

  describe('startPipeline', () => {
    const pipelineConfig = {
      branch: 'feature/user-auth',
      workflow: 'ci.yml',
      triggerType: 'push',
      env: {
        NODE_ENV: 'test',
        API_URL: 'https://api.test.com'
      }
    };

    it('should trigger CI pipeline successfully', async () => {
      mockOctokit.rest.actions.listWorkflowRuns.mockResolvedValue({
        data: {
          workflow_runs: [
            {
              id: 123456,
              status: 'queued',
              head_branch: 'feature/user-auth',
              workflow_id: 789,
              html_url: 'https://github.com/test/repo/actions/runs/123456'
            }
          ]
        }
      });

      const result = await manager.startPipeline(pipelineConfig);

      expect(result.success).toBe(true);
      expect(result.pipelineId).toBeDefined();
      expect(result.runId).toBe(123456);
      expect(result.monitoringUrl).toBeDefined();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Starting CI pipeline')
      );
    });

    it('should handle pipeline trigger failure', async () => {
      mockOctokit.rest.actions.listWorkflowRuns.mockRejectedValue(
        new Error('Workflow not found')
      );

      const result = await manager.startPipeline(pipelineConfig);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Workflow not found');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should validate pipeline configuration', async () => {
      const invalidConfig = {
        branch: '',
        workflow: null
      };

      const result = await manager.startPipeline(invalidConfig);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid pipeline configuration');
    });
  });

  describe('monitorPipeline', () => {
    const pipelineId = 'ci-pipeline-123';

    beforeEach(() => {
      manager.activePipelines.set(pipelineId, {
        id: pipelineId,
        runId: 123456,
        branch: 'feature/test',
        startTime: Date.now() - 60000,
        status: 'running'
      });
    });

    it('should monitor pipeline with adaptive intervals', async () => {
      mockOctokit.rest.actions.getWorkflowRun.mockResolvedValue({
        data: {
          id: 123456,
          status: 'in_progress',
          conclusion: null,
          jobs_url: 'https://api.github.com/repos/test/repo/actions/runs/123456/jobs',
          updated_at: new Date().toISOString()
        }
      });

      mockOctokit.rest.checks.listForRef.mockResolvedValue({
        data: {
          check_runs: [
            { name: 'build', status: 'completed', conclusion: 'success' },
            { name: 'test', status: 'in_progress', conclusion: null },
            { name: 'lint', status: 'queued', conclusion: null }
          ]
        }
      });

      const status = await manager.monitorPipeline(pipelineId);

      expect(status.pipelineId).toBe(pipelineId);
      expect(status.status).toBe('running');
      expect(status.checks).toBeDefined();
      expect(status.checks).toHaveLength(3);
      expect(status.progress).toBeGreaterThan(0);
    });

    it('should detect pipeline completion', async () => {
      mockOctokit.rest.actions.getWorkflowRun.mockResolvedValue({
        data: {
          id: 123456,
          status: 'completed',
          conclusion: 'success',
          updated_at: new Date().toISOString()
        }
      });

      mockOctokit.rest.checks.listForRef.mockResolvedValue({
        data: {
          check_runs: [
            { name: 'build', status: 'completed', conclusion: 'success' },
            { name: 'test', status: 'completed', conclusion: 'success' },
            { name: 'lint', status: 'completed', conclusion: 'success' }
          ]
        }
      });

      const status = await manager.monitorPipeline(pipelineId);

      expect(status.status).toBe('completed');
      expect(status.success).toBe(true);
      expect(status.progress).toBe(100);
      expect(status.allChecksPass).toBe(true);
    });

    it('should handle pipeline failures', async () => {
      mockOctokit.rest.actions.getWorkflowRun.mockResolvedValue({
        data: {
          id: 123456,
          status: 'completed',
          conclusion: 'failure',
          updated_at: new Date().toISOString()
        }
      });

      mockOctokit.rest.checks.listForRef.mockResolvedValue({
        data: {
          check_runs: [
            { name: 'build', status: 'completed', conclusion: 'success' },
            { name: 'test', status: 'completed', conclusion: 'failure' },
            { name: 'lint', status: 'completed', conclusion: 'success' }
          ]
        }
      });

      const status = await manager.monitorPipeline(pipelineId);

      expect(status.status).toBe('failed');
      expect(status.success).toBe(false);
      expect(status.failedChecks).toContain('test');
    });

    it('should implement adaptive monitoring intervals', async () => {
      manager.config.ci.enableAdaptiveMonitoring = true;
      
      // Mock successful run
      mockOctokit.rest.actions.getWorkflowRun.mockResolvedValue({
        data: {
          id: 123456,
          status: 'completed',
          conclusion: 'success'
        }
      });

      mockOctokit.rest.checks.listForRef.mockResolvedValue({
        data: { check_runs: [] }
      });

      const monitoringPromise = manager.startContinuousMonitoring(pipelineId);
      
      // Let it run briefly
      await new Promise(resolve => setTimeout(resolve, 100));
      
      await manager.stopMonitoring(pipelineId);

      expect(mockOctokit.rest.actions.getWorkflowRun).toHaveBeenCalled();
    });
  });

  describe('getPipelineStatus', () => {
    const pipelineId = 'test-pipeline-123';

    it('should return comprehensive pipeline status', async () => {
      manager.activePipelines.set(pipelineId, {
        id: pipelineId,
        runId: 123456,
        branch: 'main',
        startTime: Date.now() - 120000, // 2 minutes ago
        status: 'running',
        checks: [
          { name: 'build', status: 'completed', conclusion: 'success' },
          { name: 'test', status: 'in_progress', conclusion: null }
        ]
      });

      const status = await manager.getPipelineStatus(pipelineId);

      expect(status.pipelineId).toBe(pipelineId);
      expect(status.runId).toBe(123456);
      expect(status.elapsedTime).toBeGreaterThan(0);
      expect(status.checks).toHaveLength(2);
      expect(status.progress).toBeGreaterThan(0);
    });

    it('should return not found for invalid pipeline', async () => {
      const status = await manager.getPipelineStatus('invalid-id');

      expect(status.found).toBe(false);
      expect(status.error).toContain('Pipeline not found');
    });
  });

  describe('quality gates', () => {
    it('should evaluate quality gates against pipeline results', async () => {
      const pipelineResults = {
        testCoverage: 85,
        lintErrors: 2,
        buildSuccess: true,
        securityIssues: 0,
        performanceScore: 92
      };

      const evaluation = await manager.evaluateQualityGates(pipelineResults);

      expect(evaluation.passed).toBe(false); // lint errors > 0
      expect(evaluation.failures).toContain('lint');
      expect(evaluation.successes).toContain('testCoverage');
      expect(evaluation.successes).toContain('build');
    });

    it('should pass all quality gates with good results', async () => {
      const pipelineResults = {
        testCoverage: 92,
        lintErrors: 0,
        buildSuccess: true,
        securityIssues: 0
      };

      const evaluation = await manager.evaluateQualityGates(pipelineResults);

      expect(evaluation.passed).toBe(true);
      expect(evaluation.failures).toHaveLength(0);
      expect(evaluation.score).toBeGreaterThan(90);
    });

    it('should provide recommendations for failed gates', async () => {
      const pipelineResults = {
        testCoverage: 65,
        lintErrors: 5,
        buildSuccess: false
      };

      const evaluation = await manager.evaluateQualityGates(pipelineResults);

      expect(evaluation.recommendations).toContain('Increase test coverage');
      expect(evaluation.recommendations).toContain('Fix linting errors');
      expect(evaluation.recommendations).toContain('Resolve build failures');
    });
  });

  describe('auto-retry mechanism', () => {
    it('should implement intelligent retry for failed builds', async () => {
      const pipelineId = 'retry-pipeline-123';
      
      mockOctokit.rest.actions.reRunWorkflow.mockResolvedValue({
        data: { status: 204 }
      });

      const result = await manager.retryFailedPipeline(pipelineId);

      expect(result.success).toBe(true);
      expect(result.retryAttempt).toBeDefined();
      expect(mockOctokit.rest.actions.reRunWorkflow).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Retrying failed pipeline')
      );
    });

    it('should respect max retry limit', async () => {
      const pipelineId = 'max-retry-test';
      
      // Set up pipeline with max retries reached
      manager.activePipelines.set(pipelineId, {
        id: pipelineId,
        retryCount: 3,
        maxRetries: 3
      });

      const result = await manager.retryFailedPipeline(pipelineId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Maximum retry attempts reached');
    });
  });

  describe('log analysis', () => {
    it('should analyze pipeline logs for failure patterns', async () => {
      const mockLogs = `
        npm ERR! Test failed: Cannot read property 'id' of undefined
        npm ERR! at /app/src/auth.js:42:18
        Error: Database connection timeout
        FAIL src/__tests__/auth.test.js
      `;

      mockOctokit.rest.actions.listWorkflowRunLogs.mockResolvedValue({
        data: mockLogs
      });

      const analysis = await manager.analyzePipelineLogs(123456);

      expect(analysis.errorPatterns).toBeDefined();
      expect(analysis.failureReasons).toContain('Test failures');
      expect(analysis.suggestions).toContain('Check database connectivity');
    });

    it('should categorize different types of failures', async () => {
      const mockLogs = `
        TypeError: Cannot read property 'test' of undefined
        ESLint: 5 errors, 2 warnings
        npm ERR! Build failed with exit code 1
      `;

      mockOctokit.rest.actions.listWorkflowRunLogs.mockResolvedValue({
        data: mockLogs
      });

      const analysis = await manager.analyzePipelineLogs(123456);

      expect(analysis.categories).toContain('Runtime Error');
      expect(analysis.categories).toContain('Linting Issues');
      expect(analysis.categories).toContain('Build Failure');
    });
  });

  describe('integration with automation workflow', () => {
    it('should integrate with WCP feature deployment', async () => {
      const deploymentConfig = {
        feature: 'user-authentication',
        epicId: 'epic-123',
        wcpCompliant: true,
        branch: 'feature/user-auth'
      };

      mockOctokit.rest.actions.listWorkflowRuns.mockResolvedValue({
        data: {
          workflow_runs: [{
            id: 123456,
            status: 'queued',
            head_branch: 'feature/user-auth'
          }]
        }
      });

      const result = await manager.deployFeature(deploymentConfig);

      expect(result.success).toBe(true);
      expect(result.wcpIntegration).toBe(true);
      expect(result.featureTracking).toBeDefined();
    });

    it('should trigger SPARC phase completion validation', async () => {
      const sparcValidation = {
        phase: 'refinement',
        workflowId: 'sparc-workflow-123',
        artifactsPath: './sparc-artifacts'
      };

      mockExec.mockResolvedValue({
        stdout: JSON.stringify({ 
          testsPass: true, 
          coverage: 85, 
          lintClean: true 
        }),
        stderr: ''
      });

      const result = await manager.validateSparcPhase(sparcValidation);

      expect(result.success).toBe(true);
      expect(result.phaseValid).toBe(true);
      expect(result.qualityMetrics).toBeDefined();
    });
  });

  describe('notifications and reporting', () => {
    it('should send status notifications', async () => {
      const pipelineId = 'notification-test';
      const notification = {
        type: 'pipeline_completed',
        status: 'success',
        recipients: ['team@example.com']
      };

      const result = await manager.sendNotification(pipelineId, notification);

      expect(result.sent).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Notification sent')
      );
    });

    it('should generate pipeline summary reports', async () => {
      const pipelineId = 'report-test';
      manager.activePipelines.set(pipelineId, {
        id: pipelineId,
        branch: 'main',
        startTime: Date.now() - 300000, // 5 minutes ago
        endTime: Date.now(),
        status: 'completed',
        success: true,
        checks: [
          { name: 'build', duration: 120, status: 'success' },
          { name: 'test', duration: 180, status: 'success' }
        ]
      });

      const report = await manager.generatePipelineReport(pipelineId);

      expect(report.pipelineId).toBe(pipelineId);
      expect(report.summary).toBeDefined();
      expect(report.metrics).toBeDefined();
      expect(report.recommendations).toBeDefined();
      expect(report.duration).toBe(300000);
    });
  });
});