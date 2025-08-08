const { MonitoringEngine } = require('../../src/monitoring/core/MonitoringEngine');
const { MetricsCollector } = require('../../src/monitoring/core/MetricsCollector');

describe('MonitoringEngine', () => {
  let monitoringEngine;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };

    const config = {
      monitoring: {
        collectInterval: 1000,
        retentionPeriod: 60000,
        maxDataPoints: 100
      }
    };

    monitoringEngine = new MonitoringEngine(config, mockLogger);
  });

  afterEach(async () => {
    if (monitoringEngine.isRunning) {
      await monitoringEngine.stop();
    }
  });

  describe('Initialization', () => {
    test('should initialize with default configuration', () => {
      expect(monitoringEngine).toBeInstanceOf(MonitoringEngine);
      expect(monitoringEngine.isRunning).toBe(false);
      expect(monitoringEngine.collectors).toBeDefined();
      expect(monitoringEngine.dataStore).toBeDefined();
    });

    test('should initialize with custom configuration', () => {
      const customConfig = {
        monitoring: {
          collectInterval: 5000,
          retentionPeriod: 120000
        }
      };

      const customEngine = new MonitoringEngine(customConfig, mockLogger);
      expect(customEngine.config.monitoring.collectInterval).toBe(5000);
      expect(customEngine.config.monitoring.retentionPeriod).toBe(120000);
    });
  });

  describe('Lifecycle Management', () => {
    test('should start successfully', async () => {
      const result = await monitoringEngine.start();
      
      expect(result.success).toBe(true);
      expect(result.startTime).toBeDefined();
      expect(monitoringEngine.isRunning).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith('Performance monitoring engine started successfully');
    });

    test('should not start if already running', async () => {
      await monitoringEngine.start();
      const result = await monitoringEngine.start();
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Already running');
    });

    test('should stop successfully', async () => {
      await monitoringEngine.start();
      const result = await monitoringEngine.stop();
      
      expect(result.success).toBe(true);
      expect(result.stopTime).toBeDefined();
      expect(monitoringEngine.isRunning).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith('Performance monitoring engine stopped successfully');
    });

    test('should not stop if not running', async () => {
      const result = await monitoringEngine.stop();
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Not running');
    });
  });

  describe('Collector Management', () => {
    test('should register collector successfully', () => {
      const mockCollector = {
        collect: jest.fn().mockResolvedValue({ cpu: 50, memory: 60 })
      };

      const result = monitoringEngine.registerCollector('test-collector', mockCollector);
      
      expect(result.success).toBe(true);
      expect(result.name).toBe('test-collector');
      expect(monitoringEngine.collectors.has('test-collector')).toBe(true);
    });

    test('should replace existing collector', () => {
      const mockCollector1 = { collect: jest.fn() };
      const mockCollector2 = { collect: jest.fn() };

      monitoringEngine.registerCollector('test-collector', mockCollector1);
      monitoringEngine.registerCollector('test-collector', mockCollector2);
      
      const collectorData = monitoringEngine.collectors.get('test-collector');
      expect(collectorData.instance).toBe(mockCollector2);
      expect(mockLogger.warn).toHaveBeenCalledWith("Collector 'test-collector' already registered, replacing");
    });
  });

  describe('Metrics Collection', () => {
    beforeEach(async () => {
      await monitoringEngine.start();
    });

    test('should collect metrics from registered collectors', async () => {
      const mockCollector = {
        collect: jest.fn().mockResolvedValue({ cpu: 50, memory: 60 })
      };

      monitoringEngine.registerCollector('test-collector', mockCollector);
      const result = await monitoringEngine.collectMetrics();
      
      expect(result.success).toBe(true);
      expect(result.timestamp).toBeDefined();
      expect(result.collectors['test-collector']).toBeDefined();
      expect(result.collectors['test-collector'].success).toBe(true);
      expect(result.collectors['test-collector'].metrics).toEqual({ cpu: 50, memory: 60 });
      expect(mockCollector.collect).toHaveBeenCalled();
    });

    test('should handle collector errors gracefully', async () => {
      const mockCollector = {
        collect: jest.fn().mockRejectedValue(new Error('Collection failed'))
      };

      monitoringEngine.registerCollector('failing-collector', mockCollector);
      const result = await monitoringEngine.collectMetrics();
      
      expect(result.success).toBe(true);
      expect(result.collectors['failing-collector'].success).toBe(false);
      expect(result.collectors['failing-collector'].error).toBe('Collection failed');
      expect(result.errors).toHaveLength(1);
    });

    test('should disable collector after multiple failures', async () => {
      const mockCollector = {
        collect: jest.fn().mockRejectedValue(new Error('Collection failed'))
      };

      monitoringEngine.registerCollector('failing-collector', mockCollector);
      
      // Trigger multiple failures
      for (let i = 0; i < 6; i++) {
        await monitoringEngine.collectMetrics();
      }

      const collectorData = monitoringEngine.collectors.get('failing-collector');
      expect(collectorData.enabled).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith("Disabled collector 'failing-collector' due to repeated errors");
    });

    test('should not collect from disabled collectors', async () => {
      const mockCollector = {
        collect: jest.fn().mockResolvedValue({ cpu: 50 })
      };

      monitoringEngine.registerCollector('test-collector', mockCollector);
      const collectorData = monitoringEngine.collectors.get('test-collector');
      collectorData.enabled = false;

      const result = await monitoringEngine.collectMetrics();
      
      expect(result.collectors['test-collector']).toBeUndefined();
      expect(mockCollector.collect).not.toHaveBeenCalled();
    });
  });

  describe('Current Metrics', () => {
    beforeEach(async () => {
      await monitoringEngine.start();
    });

    test('should return current metrics structure', () => {
      const metrics = monitoringEngine.getCurrentMetrics();
      
      expect(metrics).toHaveProperty('timestamp');
      expect(metrics).toHaveProperty('system');
      expect(metrics).toHaveProperty('application');
      expect(metrics).toHaveProperty('performance');
      expect(metrics).toHaveProperty('summary');
    });

    test('should include system metrics when available', () => {
      // Mock system data
      monitoringEngine.dataStore.set('system', [{
        timestamp: Date.now(),
        metrics: { cpu: { usage: 75 }, memory: { usagePercent: 80 } }
      }]);

      const metrics = monitoringEngine.getCurrentMetrics();
      
      expect(metrics.system.cpu.usage).toBe(75);
      expect(metrics.system.memory.usagePercent).toBe(80);
    });
  });

  describe('Historical Metrics', () => {
    beforeEach(async () => {
      await monitoringEngine.start();

      // Add mock historical data
      const now = Date.now();
      monitoringEngine.dataStore.set('system', [
        { timestamp: now - 60000, metrics: { cpu: 50 } },
        { timestamp: now - 30000, metrics: { cpu: 60 } },
        { timestamp: now, metrics: { cpu: 70 } }
      ]);
    });

    test('should return historical metrics for time range', () => {
      const endTime = Date.now();
      const startTime = endTime - 120000; // 2 minutes ago

      const historical = monitoringEngine.getHistoricalMetrics({
        startTime,
        endTime,
        collectors: ['system']
      });

      expect(historical.startTime).toBe(startTime);
      expect(historical.endTime).toBe(endTime);
      expect(historical.data.system).toBeDefined();
      expect(historical.data.system).toHaveLength(3);
    });

    test('should filter by time range', () => {
      const endTime = Date.now();
      const startTime = endTime - 45000; // 45 seconds ago (should exclude first entry)

      const historical = monitoringEngine.getHistoricalMetrics({
        startTime,
        endTime,
        collectors: ['system']
      });

      expect(historical.data.system).toHaveLength(2);
    });

    test('should aggregate data when requested', () => {
      const historical = monitoringEngine.getHistoricalMetrics({
        collectors: ['system'],
        aggregation: 'minute'
      });

      expect(historical.aggregation).toBe('minute');
      expect(historical.data.system).toBeDefined();
    });
  });

  describe('Dashboard Data', () => {
    beforeEach(async () => {
      await monitoringEngine.start();
    });

    test('should return dashboard data structure', () => {
      const dashboardData = monitoringEngine.getDashboardData();
      
      expect(dashboardData).toHaveProperty('timestamp');
      expect(dashboardData).toHaveProperty('health');
      expect(dashboardData).toHaveProperty('metrics');
      expect(dashboardData).toHaveProperty('trends');
      expect(dashboardData).toHaveProperty('alerts');
      expect(dashboardData).toHaveProperty('summary');
    });

    test('should include collector status in summary', () => {
      const mockCollector = { collect: jest.fn() };
      monitoringEngine.registerCollector('test-collector', mockCollector);

      const dashboardData = monitoringEngine.getDashboardData();
      
      expect(dashboardData.summary.totalCollectors).toBe(1);
      expect(dashboardData.summary.activeCollectors).toBe(1);
    });

    test('should calculate uptime correctly', () => {
      const dashboardData = monitoringEngine.getDashboardData();
      
      expect(dashboardData.summary.uptime).toBeGreaterThan(0);
    });
  });

  describe('Performance Analysis', () => {
    beforeEach(async () => {
      await monitoringEngine.start();
    });

    test('should analyze performance with default options', async () => {
      const analysis = await monitoringEngine.analyzePerformance();
      
      expect(analysis).toHaveProperty('timestamp');
      expect(analysis).toHaveProperty('timeRange');
      expect(analysis).toHaveProperty('analysis');
      expect(analysis).toHaveProperty('recommendations');
      expect(analysis).toHaveProperty('alerts');
    });

    test('should analyze performance with custom time range', async () => {
      const timeRange = {
        start: Date.now() - 3600000, // 1 hour ago
        end: Date.now()
      };

      const analysis = await monitoringEngine.analyzePerformance({ timeRange });
      
      expect(analysis.timeRange).toEqual(timeRange);
    });

    test('should include different analysis types based on options', async () => {
      const analysis = await monitoringEngine.analyzePerformance({
        includeAnomaly: true,
        includeBottleneck: true,
        includeTrend: true
      });
      
      expect(analysis.analysis).toHaveProperty('bottlenecks');
      expect(analysis.analysis).toHaveProperty('trends');
      expect(analysis.analysis).toHaveProperty('anomalies');
    });
  });

  describe('System Health Calculation', () => {
    test('should calculate system health with good metrics', () => {
      const metrics = {
        system: {
          cpu: { usage: 50 },
          memory: { usagePercent: 60 }
        },
        application: {
          errors: { rate: 1 }
        }
      };

      const health = monitoringEngine.calculateSystemHealth(metrics);
      
      expect(health.score).toBeGreaterThan(80);
      expect(health.status).toBe('healthy');
      expect(health.timestamp).toBeDefined();
    });

    test('should calculate system health with poor metrics', () => {
      const metrics = {
        system: {
          cpu: { usage: 95 },
          memory: { usagePercent: 98 }
        },
        application: {
          errors: { rate: 15 }
        }
      };

      const health = monitoringEngine.calculateSystemHealth(metrics);
      
      expect(health.score).toBeLessThan(50);
      expect(health.status).toBe('critical');
    });

    test('should handle missing metrics gracefully', () => {
      const health = monitoringEngine.calculateSystemHealth({});
      
      expect(health.score).toBe(100); // No issues detected
      expect(health.status).toBe('healthy');
    });
  });

  describe('Data Cleanup', () => {
    beforeEach(async () => {
      await monitoringEngine.start();
    });

    test('should clean up old data', () => {
      const oldTimestamp = Date.now() - 120000; // 2 minutes ago
      const recentTimestamp = Date.now();

      // Add data older than retention period
      monitoringEngine.dataStore.set('system', [
        { timestamp: oldTimestamp, metrics: { cpu: 50 } },
        { timestamp: recentTimestamp, metrics: { cpu: 60 } }
      ]);

      // Set short retention period for test
      monitoringEngine.config.monitoring.retentionPeriod = 60000; // 1 minute

      monitoringEngine.cleanupOldData();

      const systemData = monitoringEngine.dataStore.get('system');
      expect(systemData).toHaveLength(1);
      expect(systemData[0].timestamp).toBe(recentTimestamp);
    });
  });

  describe('Error Handling', () => {
    test('should handle start errors gracefully', async () => {
      // Mock initialization failure
      jest.spyOn(monitoringEngine, 'initializeCollectors').mockRejectedValue(new Error('Init failed'));
      
      const result = await monitoringEngine.start();
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Init failed');
      expect(monitoringEngine.isRunning).toBe(false);
    });

    test('should handle stop errors gracefully', async () => {
      await monitoringEngine.start();
      
      // Mock stop failure
      jest.spyOn(monitoringEngine, 'stopCollectors').mockRejectedValue(new Error('Stop failed'));
      
      const result = await monitoringEngine.stop();
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Stop failed');
    });

    test('should handle collection errors without crashing', async () => {
      await monitoringEngine.start();

      const mockCollector = {
        collect: jest.fn().mockRejectedValue(new Error('Collection error'))
      };

      monitoringEngine.registerCollector('error-collector', mockCollector);
      
      const result = await monitoringEngine.collectMetrics();
      
      expect(result.success).toBe(true); // Should continue despite errors
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('Event Emission', () => {
    beforeEach(async () => {
      await monitoringEngine.start();
    });

    test('should emit started event', async () => {
      const engine = new MonitoringEngine({}, mockLogger);
      let startedEmitted = false;
      
      engine.on('started', () => {
        startedEmitted = true;
      });

      await engine.start();
      
      expect(startedEmitted).toBe(true);
      
      await engine.stop();
    });

    test('should emit stopped event', async () => {
      let stoppedEmitted = false;
      
      monitoringEngine.on('stopped', () => {
        stoppedEmitted = true;
      });

      await monitoringEngine.stop();
      
      expect(stoppedEmitted).toBe(true);
    });

    test('should emit metrics-collected event', async () => {
      let metricsEmitted = false;
      let emittedData = null;

      monitoringEngine.on('metrics-collected', (data) => {
        metricsEmitted = true;
        emittedData = data;
      });

      const mockCollector = {
        collect: jest.fn().mockResolvedValue({ cpu: 50 })
      };

      monitoringEngine.registerCollector('test-collector', mockCollector);
      await monitoringEngine.collectMetrics();
      
      expect(metricsEmitted).toBe(true);
      expect(emittedData).toBeDefined();
      expect(emittedData.collectors['test-collector']).toBeDefined();
    });
  });

  describe('Configuration Validation', () => {
    test('should use default configuration when none provided', () => {
      const engine = new MonitoringEngine();
      
      expect(engine.config.monitoring.enabled).toBe(true);
      expect(engine.config.monitoring.collectInterval).toBeDefined();
      expect(engine.config.monitoring.retentionPeriod).toBeDefined();
    });

    test('should merge custom configuration with defaults', () => {
      const customConfig = {
        monitoring: {
          collectInterval: 10000
        }
      };

      const engine = new MonitoringEngine(customConfig);
      
      expect(engine.config.monitoring.collectInterval).toBe(10000);
      expect(engine.config.monitoring.enabled).toBe(true); // Default preserved
    });
  });
});