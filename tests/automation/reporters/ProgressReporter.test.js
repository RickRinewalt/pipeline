const { ProgressReporter } = require('../../../src/automation/reporters/ProgressReporter');

describe('ProgressReporter', () => {
  let reporter;
  let mockLogger;
  let mockConfig;
  let mockMetricsStore;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    };

    mockConfig = {
      reporting: {
        enableRealTimeReporting: true,
        metricsRetentionDays: 30,
        alertThresholds: {
          lowProgress: 20,
          highFailureRate: 10,
          longDuration: 86400000 // 24 hours
        }
      },
      github: {
        owner: 'test-owner',
        repo: 'test-repo'
      }
    };

    mockMetricsStore = new Map();
    
    reporter = new ProgressReporter(mockConfig, mockLogger);
    reporter.metricsStore = mockMetricsStore;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with proper configuration', () => {
      expect(reporter).toBeDefined();
      expect(reporter.config).toBe(mockConfig);
      expect(reporter.logger).toBe(mockLogger);
      expect(reporter.metricsStore).toBeDefined();
    });

    it('should use default configuration when not provided', () => {
      const defaultReporter = new ProgressReporter({}, mockLogger);
      expect(defaultReporter.config.reporting.metricsRetentionDays).toBe(30);
      expect(defaultReporter.config.reporting.enableRealTimeReporting).toBe(true);
    });
  });

  describe('trackProgress', () => {
    const workflowId = 'test-workflow-123';

    it('should track workflow progress metrics', () => {
      const progressData = {
        workflowId,
        phase: 'refinement',
        progress: 75,
        completedTasks: 6,
        totalTasks: 8,
        timestamp: Date.now()
      };

      reporter.trackProgress(progressData);

      const storedMetrics = mockMetricsStore.get(workflowId);
      expect(storedMetrics).toBeDefined();
      expect(storedMetrics.currentProgress).toBe(75);
      expect(storedMetrics.history).toHaveLength(1);
      expect(storedMetrics.history[0]).toMatchObject({
        phase: 'refinement',
        progress: 75
      });
    });

    it('should maintain progress history', () => {
      const progressUpdates = [
        { workflowId, progress: 25, phase: 'specification' },
        { workflowId, progress: 50, phase: 'architecture' },
        { workflowId, progress: 75, phase: 'refinement' }
      ];

      progressUpdates.forEach(update => reporter.trackProgress(update));

      const storedMetrics = mockMetricsStore.get(workflowId);
      expect(storedMetrics.history).toHaveLength(3);
      expect(storedMetrics.currentProgress).toBe(75);
      expect(storedMetrics.velocity).toBeDefined();
    });

    it('should calculate velocity metrics', () => {
      const baseTime = Date.now();
      const progressUpdates = [
        { workflowId, progress: 0, timestamp: baseTime },
        { workflowId, progress: 25, timestamp: baseTime + 3600000 }, // 1 hour later
        { workflowId, progress: 75, timestamp: baseTime + 7200000 }  // 2 hours later
      ];

      progressUpdates.forEach(update => reporter.trackProgress(update));

      const storedMetrics = mockMetricsStore.get(workflowId);
      expect(storedMetrics.velocity).toBeCloseTo(37.5, 1); // 75 progress in 2 hours = 37.5/hour
    });

    it('should detect progress stagnation', () => {
      const stagnantUpdates = [
        { workflowId, progress: 50, timestamp: Date.now() - 7200000 },
        { workflowId, progress: 50, timestamp: Date.now() - 3600000 },
        { workflowId, progress: 50, timestamp: Date.now() }
      ];

      stagnantUpdates.forEach(update => reporter.trackProgress(update));

      const metrics = reporter.analyzeProgress(workflowId);
      expect(metrics.isStagnant).toBe(true);
      expect(metrics.alerts).toContain('Progress stagnation detected');
    });
  });

  describe('generateReport', () => {
    const workflowId = 'report-test-123';

    beforeEach(() => {
      // Setup test data
      mockMetricsStore.set(workflowId, {
        workflowId,
        currentProgress: 80,
        startTime: Date.now() - 86400000, // 24 hours ago
        history: [
          { phase: 'specification', progress: 20, timestamp: Date.now() - 72000000 },
          { phase: 'architecture', progress: 40, timestamp: Date.now() - 36000000 },
          { phase: 'refinement', progress: 80, timestamp: Date.now() - 18000000 }
        ],
        components: {
          milestone: { status: 'completed', progress: 100 },
          sparc: { status: 'in-progress', progress: 80 },
          wcp: { status: 'completed', progress: 100 },
          ci: { status: 'in-progress', progress: 60 }
        },
        issues: {
          total: 10,
          completed: 7,
          inProgress: 2,
          pending: 1
        }
      });
    });

    it('should generate comprehensive progress report', async () => {
      const report = await reporter.generateReport(workflowId);

      expect(report.workflowId).toBe(workflowId);
      expect(report.overallProgress).toBe(80);
      expect(report.status).toBe('in-progress');
      expect(report.components).toBeDefined();
      expect(report.timeline).toBeDefined();
      expect(report.metrics).toBeDefined();
      expect(report.estimatedCompletion).toBeDefined();
    });

    it('should include detailed component breakdown', async () => {
      const report = await reporter.generateReport(workflowId);

      expect(report.components.milestone.status).toBe('completed');
      expect(report.components.sparc.progress).toBe(80);
      expect(report.components.wcp.status).toBe('completed');
      expect(report.components.ci.progress).toBe(60);
    });

    it('should calculate accurate time estimates', async () => {
      const report = await reporter.generateReport(workflowId);

      expect(report.estimatedCompletion).toBeDefined();
      expect(report.timeRemaining).toBeDefined();
      expect(report.velocity).toBeDefined();
      expect(typeof report.estimatedCompletion).toBe('number');
    });

    it('should identify bottlenecks and blockers', async () => {
      // Add a blocked component
      const metrics = mockMetricsStore.get(workflowId);
      metrics.components.ci.status = 'blocked';
      metrics.components.ci.blockReason = 'Test failures in authentication module';

      const report = await reporter.generateReport(workflowId);

      expect(report.bottlenecks).toContain('ci');
      expect(report.blockers).toHaveLength(1);
      expect(report.blockers[0]).toContain('Test failures');
    });

    it('should handle workflows with no data', async () => {
      const report = await reporter.generateReport('nonexistent-workflow');

      expect(report.found).toBe(false);
      expect(report.error).toContain('Workflow not found');
    });
  });

  describe('getMetrics', () => {
    beforeEach(() => {
      // Setup multiple workflows for aggregated metrics
      const workflows = [
        {
          id: 'workflow-1',
          progress: 100,
          status: 'completed',
          duration: 86400000,
          success: true
        },
        {
          id: 'workflow-2',
          progress: 75,
          status: 'in-progress',
          duration: 43200000,
          success: null
        },
        {
          id: 'workflow-3',
          progress: 30,
          status: 'failed',
          duration: 21600000,
          success: false
        }
      ];

      workflows.forEach(workflow => {
        mockMetricsStore.set(workflow.id, workflow);
      });
    });

    it('should return aggregated metrics across all workflows', () => {
      const metrics = reporter.getMetrics();

      expect(metrics.totalWorkflows).toBe(3);
      expect(metrics.completedWorkflows).toBe(1);
      expect(metrics.inProgressWorkflows).toBe(1);
      expect(metrics.failedWorkflows).toBe(1);
      expect(metrics.averageProgress).toBeCloseTo(68.33, 2);
      expect(metrics.successRate).toBeCloseTo(33.33, 2); // 1 success out of 3 total
    });

    it('should calculate performance metrics', () => {
      const metrics = reporter.getMetrics();

      expect(metrics.performance).toBeDefined();
      expect(metrics.performance.averageDuration).toBeDefined();
      expect(metrics.performance.fastestCompletion).toBe(21600000);
      expect(metrics.performance.slowestCompletion).toBe(86400000);
    });

    it('should identify trends and patterns', () => {
      const metrics = reporter.getMetrics();

      expect(metrics.trends).toBeDefined();
      expect(metrics.patterns).toBeDefined();
      expect(metrics.recommendations).toBeDefined();
    });

    it('should filter metrics by time range', () => {
      const timeRange = {
        start: Date.now() - 86400000, // 24 hours ago
        end: Date.now()
      };

      const metrics = reporter.getMetrics(timeRange);

      expect(metrics.timeRange).toEqual(timeRange);
      expect(metrics.totalWorkflows).toBeLessThanOrEqual(3);
    });
  });

  describe('real-time reporting', () => {
    it('should emit real-time progress events', () => {
      const workflowId = 'realtime-test';
      const eventListener = jest.fn();
      
      reporter.on('progress-update', eventListener);
      
      reporter.trackProgress({
        workflowId,
        progress: 50,
        phase: 'architecture'
      });

      expect(eventListener).toHaveBeenCalledWith(
        expect.objectContaining({
          workflowId,
          progress: 50,
          phase: 'architecture'
        })
      );
    });

    it('should throttle real-time updates', () => {
      const workflowId = 'throttle-test';
      const eventListener = jest.fn();
      
      reporter.on('progress-update', eventListener);
      
      // Send multiple rapid updates
      for (let i = 0; i < 10; i++) {
        reporter.trackProgress({
          workflowId,
          progress: i * 10,
          timestamp: Date.now() + i
        });
      }

      // Should be throttled to fewer events
      expect(eventListener).toHaveBeenCalledTimes(1);
    });
  });

  describe('alerting system', () => {
    it('should trigger alerts for low progress', () => {
      const workflowId = 'low-progress-test';
      
      reporter.trackProgress({
        workflowId,
        progress: 15, // Below threshold of 20
        phase: 'specification',
        timestamp: Date.now() - 7200000 // 2 hours ago
      });

      const alerts = reporter.checkAlerts(workflowId);

      expect(alerts).toContain('Low progress detected');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Low progress alert')
      );
    });

    it('should trigger alerts for long duration', () => {
      const workflowId = 'long-duration-test';
      
      mockMetricsStore.set(workflowId, {
        workflowId,
        startTime: Date.now() - 90000000, // More than 24 hours ago
        currentProgress: 50
      });

      const alerts = reporter.checkAlerts(workflowId);

      expect(alerts).toContain('Long running workflow detected');
    });

    it('should not trigger duplicate alerts', () => {
      const workflowId = 'duplicate-alert-test';
      
      // Trigger the same alert condition twice
      reporter.trackProgress({
        workflowId,
        progress: 10,
        timestamp: Date.now() - 7200000
      });

      reporter.trackProgress({
        workflowId,
        progress: 15,
        timestamp: Date.now() - 3600000
      });

      const alerts1 = reporter.checkAlerts(workflowId);
      const alerts2 = reporter.checkAlerts(workflowId);

      expect(alerts1).toContain('Low progress detected');
      expect(alerts2).not.toContain('Low progress detected'); // Should be suppressed
    });
  });

  describe('data visualization support', () => {
    it('should provide data in chart-friendly format', () => {
      const workflowId = 'chart-data-test';
      
      const progressData = [
        { progress: 0, timestamp: Date.now() - 14400000, phase: 'specification' },
        { progress: 25, timestamp: Date.now() - 10800000, phase: 'pseudocode' },
        { progress: 50, timestamp: Date.now() - 7200000, phase: 'architecture' },
        { progress: 75, timestamp: Date.now() - 3600000, phase: 'refinement' }
      ];

      progressData.forEach(data => 
        reporter.trackProgress({ workflowId, ...data })
      );

      const chartData = reporter.getChartData(workflowId);

      expect(chartData.timeline).toBeDefined();
      expect(chartData.timeline).toHaveLength(4);
      expect(chartData.phaseBreakdown).toBeDefined();
      expect(chartData.velocityTrend).toBeDefined();
    });

    it('should generate dashboard summary data', () => {
      // Setup multiple workflows
      ['workflow-a', 'workflow-b', 'workflow-c'].forEach((id, index) => {
        mockMetricsStore.set(id, {
          workflowId: id,
          currentProgress: (index + 1) * 30,
          status: index === 0 ? 'completed' : index === 1 ? 'in-progress' : 'pending'
        });
      });

      const dashboardData = reporter.getDashboardData();

      expect(dashboardData.summary).toBeDefined();
      expect(dashboardData.activeWorkflows).toBeDefined();
      expect(dashboardData.recentActivity).toBeDefined();
      expect(dashboardData.performanceMetrics).toBeDefined();
    });
  });

  describe('export and import functionality', () => {
    it('should export metrics data', () => {
      const workflowId = 'export-test';
      mockMetricsStore.set(workflowId, {
        workflowId,
        progress: 80,
        history: [{ progress: 40 }, { progress: 80 }]
      });

      const exportData = reporter.exportMetrics();

      expect(exportData.version).toBeDefined();
      expect(exportData.exportDate).toBeDefined();
      expect(exportData.workflows).toHaveProperty(workflowId);
    });

    it('should import metrics data', () => {
      const importData = {
        version: '1.0.0',
        workflows: {
          'imported-workflow': {
            workflowId: 'imported-workflow',
            progress: 60,
            history: [{ progress: 30 }, { progress: 60 }]
          }
        }
      };

      const result = reporter.importMetrics(importData);

      expect(result.success).toBe(true);
      expect(mockMetricsStore.has('imported-workflow')).toBe(true);
      expect(mockMetricsStore.get('imported-workflow').progress).toBe(60);
    });
  });
});