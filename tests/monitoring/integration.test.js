const { MonitoringEngine } = require('../../src/monitoring/core/MonitoringEngine');
const PerformanceDashboard = require('../../src/monitoring/dashboards/PerformanceDashboard');
const YoloProIntegration = require('../../src/monitoring/integration/YoloProIntegration');

describe('Performance Monitoring Integration Tests', () => {
  let monitoringEngine;
  let dashboard;
  let yoloProIntegration;
  let mockLogger;

  beforeEach(async () => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };

    // Initialize monitoring engine
    const monitoringConfig = {
      monitoring: {
        collectInterval: 500, // Faster for testing
        retentionPeriod: 10000,
        maxDataPoints: 50
      }
    };

    monitoringEngine = new MonitoringEngine(monitoringConfig, mockLogger);

    // Initialize dashboard
    const dashboardConfig = {
      dashboard: {
        refreshInterval: 500,
        enableRealTime: true
      }
    };

    dashboard = new PerformanceDashboard(monitoringEngine, dashboardConfig);

    // Initialize YOLO-PRO integration
    const integrationConfig = {
      integration: {
        trackCLICommands: true,
        trackWorkflows: true
      }
    };

    yoloProIntegration = new YoloProIntegration(monitoringEngine, integrationConfig);
  });

  afterEach(async () => {
    // Cleanup in reverse order
    if (yoloProIntegration.isActive) {
      await yoloProIntegration.stop();
    }
    
    if (dashboard.isRunning) {
      await dashboard.stop();
    }
    
    if (monitoringEngine.isRunning) {
      await monitoringEngine.stop();
    }
  });

  describe('Component Integration', () => {
    test('should start all components successfully', async () => {
      const monitoringResult = await monitoringEngine.start();
      expect(monitoringResult.success).toBe(true);

      const dashboardResult = await dashboard.start();
      expect(dashboardResult.success).toBe(true);

      const integrationResult = await yoloProIntegration.start();
      expect(integrationResult.success).toBe(true);

      expect(monitoringEngine.isRunning).toBe(true);
      expect(dashboard.isRunning).toBe(true);
      expect(yoloProIntegration.isActive).toBe(true);
    });

    test('should handle component startup dependencies', async () => {
      // Dashboard requires monitoring engine
      const dashboardResult = await dashboard.start();
      expect(dashboardResult.success).toBe(true);

      // Integration requires monitoring engine  
      const integrationResult = await yoloProIntegration.start();
      expect(integrationResult.success).toBe(true);
    });

    test('should stop all components gracefully', async () => {
      await monitoringEngine.start();
      await dashboard.start();
      await yoloProIntegration.start();

      const integrationResult = await yoloProIntegration.stop();
      expect(integrationResult.success).toBe(true);

      const dashboardResult = await dashboard.stop();
      expect(dashboardResult.success).toBe(true);

      const monitoringResult = await monitoringEngine.stop();
      expect(monitoringResult.success).toBe(true);
    });
  });

  describe('Data Flow Integration', () => {
    beforeEach(async () => {
      await monitoringEngine.start();
      await dashboard.start();
      await yoloProIntegration.start();
    });

    test('should flow data from monitoring engine to dashboard', async () => {
      // Register a mock collector
      const mockCollector = {
        collect: jest.fn().mockResolvedValue({
          cpu: 55,
          memory: 70,
          disk: 45
        })
      };

      monitoringEngine.registerCollector('test-collector', mockCollector);

      // Collect metrics
      await monitoringEngine.collectMetrics();

      // Wait for data propagation
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check dashboard data
      const dashboardData = dashboard.getDashboardData();
      expect(dashboardData.metrics).toBeDefined();

      // Verify collector was called
      expect(mockCollector.collect).toHaveBeenCalled();
    });

    test('should integrate CLI metrics into monitoring system', async () => {
      // Simulate CLI command execution
      const testCommand = yoloProIntegration.hookCLICommand(
        'test-command',
        async (param) => {
          await new Promise(resolve => setTimeout(resolve, 50));
          return `Processed: ${param}`;
        }
      );

      // Execute hooked command
      const result = await testCommand('test-parameter');
      expect(result).toBe('Processed: test-parameter');

      // Wait for integration processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify integration stats
      const stats = yoloProIntegration.getIntegrationStats();
      expect(stats.totalCommands).toBeGreaterThan(0);
    });

    test('should propagate alerts through system', async () => {
      let alertReceived = false;
      let alertData = null;

      // Listen for alerts at dashboard level
      dashboard.on('new-alert', (alert) => {
        alertReceived = true;
        alertData = alert;
      });

      // Trigger alert from monitoring engine
      monitoringEngine.emit('alert', {
        id: 'test-alert',
        severity: 'warning',
        message: 'Test alert',
        source: 'test'
      });

      // Wait for alert propagation
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(alertReceived).toBe(true);
      expect(alertData.id).toBe('test-alert');
    });
  });

  describe('Performance Data Collection', () => {
    beforeEach(async () => {
      await monitoringEngine.start();
      await yoloProIntegration.start();
    });

    test('should collect system metrics continuously', async () => {
      // Register system collector mock
      const mockSystemCollector = {
        collect: jest.fn().mockResolvedValue({
          cpu: { usage: Math.random() * 100 },
          memory: { usagePercent: Math.random() * 100 },
          disk: { usagePercent: Math.random() * 100 }
        })
      };

      monitoringEngine.registerCollector('system', mockSystemCollector);

      // Run multiple collection cycles
      for (let i = 0; i < 3; i++) {
        await monitoringEngine.collectMetrics();
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      expect(mockSystemCollector.collect).toHaveBeenCalledTimes(3);

      // Verify historical data accumulation
      const historical = monitoringEngine.getHistoricalMetrics({
        collectors: ['system']
      });

      expect(historical.data.system).toBeDefined();
    });

    test('should track CLI operations performance', async () => {
      // Create tracked CLI operations
      const fastOperation = yoloProIntegration.hookCLICommand(
        'fast-op',
        async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return 'fast';
        }
      );

      const slowOperation = yoloProIntegration.hookCLICommand(
        'slow-op',
        async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return 'slow';
        }
      );

      // Execute operations
      await Promise.all([
        fastOperation(),
        slowOperation(),
        fastOperation()
      ]);

      // Get performance metrics
      const yoloProMetrics = yoloProIntegration.getYoloProMetrics();
      
      expect(yoloProMetrics.metrics.cli).toBeDefined();
      expect(yoloProMetrics.summary).toBeDefined();
    });
  });

  describe('Real-time Updates', () => {
    beforeEach(async () => {
      await monitoringEngine.start();
      await dashboard.start();
    });

    test('should update dashboard in real-time', async () => {
      let updateCount = 0;
      
      dashboard.on('data-updated', () => {
        updateCount++;
      });

      // Register a collector that changes values
      let currentValue = 50;
      const dynamicCollector = {
        collect: jest.fn().mockImplementation(async () => {
          currentValue += Math.random() * 10 - 5; // Random walk
          return { dynamicMetric: currentValue };
        })
      };

      monitoringEngine.registerCollector('dynamic', dynamicCollector);

      // Wait for several update cycles
      await new Promise(resolve => setTimeout(resolve, 1500));

      expect(updateCount).toBeGreaterThan(0);
      expect(dynamicCollector.collect).toHaveBeenCalledTimes(updateCount);
    });

    test('should emit real-time events from monitoring engine', async () => {
      let metricsEventCount = 0;
      
      monitoringEngine.on('metrics-collected', () => {
        metricsEventCount++;
      });

      const mockCollector = {
        collect: jest.fn().mockResolvedValue({ testMetric: 42 })
      };

      monitoringEngine.registerCollector('test', mockCollector);

      // Trigger collection manually
      await monitoringEngine.collectMetrics();
      await monitoringEngine.collectMetrics();

      expect(metricsEventCount).toBe(2);
    });
  });

  describe('Error Handling and Recovery', () => {
    beforeEach(async () => {
      await monitoringEngine.start();
      await dashboard.start();
      await yoloProIntegration.start();
    });

    test('should handle collector failures gracefully', async () => {
      let errorEmitted = false;
      
      dashboard.on('error', () => {
        errorEmitted = true;
      });

      // Register failing collector
      const failingCollector = {
        collect: jest.fn().mockRejectedValue(new Error('Collection failed'))
      };

      monitoringEngine.registerCollector('failing', failingCollector);

      // Attempt collection
      const result = await monitoringEngine.collectMetrics();

      // MonitoringEngine should handle failures gracefully
      expect(result.timestamp).toBeDefined();
      if (result.errors) {
        expect(result.errors.length).toBeGreaterThan(0);
      }
      
      // Dashboard should still function
      const dashboardData = dashboard.getDashboardData();
      expect(dashboardData.timestamp).toBeDefined();
    });

    test('should recover from CLI operation failures', async () => {
      const failingCommand = yoloProIntegration.hookCLICommand(
        'failing-command',
        async () => {
          throw new Error('Command failed');
        }
      );

      let operationEnded = false;
      yoloProIntegration.on('operation-ended', (data) => {
        if (data.success === false) {
          operationEnded = true;
        }
      });

      // Execute failing command
      try {
        await failingCommand();
      } catch (error) {
        expect(error.message).toBe('Command failed');
      }

      // Wait for event processing
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(operationEnded).toBe(true);

      // Verify integration continues to work
      const stats = yoloProIntegration.getIntegrationStats();
      expect(stats.totalCommands).toBeGreaterThan(0);
    });

    test('should maintain data integrity during component failures', async () => {
      // Simulate dashboard failure
      jest.spyOn(dashboard, 'updateDashboardData').mockRejectedValue(new Error('Dashboard update failed'));

      // Register collector
      const mockCollector = {
        collect: jest.fn().mockResolvedValue({ metric: 100 })
      };

      monitoringEngine.registerCollector('test', mockCollector);

      // Collect metrics (should succeed despite dashboard failure)
      const result = await monitoringEngine.collectMetrics();
      expect(result.timestamp).toBeDefined();

      // Verify data is still stored in monitoring engine
      const currentMetrics = monitoringEngine.getCurrentMetrics();
      expect(currentMetrics.timestamp).toBeDefined();
    });
  });

  describe('Performance and Scalability', () => {
    beforeEach(async () => {
      await monitoringEngine.start();
    });

    test('should handle multiple collectors efficiently', async () => {
      // Register multiple collectors
      const collectors = [];
      for (let i = 0; i < 10; i++) {
        const collector = {
          collect: jest.fn().mockResolvedValue({ metric: i })
        };
        collectors.push(collector);
        monitoringEngine.registerCollector(`collector-${i}`, collector);
      }

      const startTime = Date.now();
      
      // Collect from all collectors
      await monitoringEngine.collectMetrics();
      
      const duration = Date.now() - startTime;

      // Should complete reasonably quickly
      expect(duration).toBeLessThan(1000);

      // Verify all collectors were called
      collectors.forEach(collector => {
        expect(collector.collect).toHaveBeenCalled();
      });
    });

    test('should limit historical data growth', async () => {
      const mockCollector = {
        collect: jest.fn().mockResolvedValue({ metric: Math.random() })
      };

      monitoringEngine.registerCollector('test', mockCollector);

      // Collect many data points
      for (let i = 0; i < 100; i++) {
        await monitoringEngine.collectMetrics();
      }

      // Verify data store doesn't grow unbounded
      const testData = monitoringEngine.dataStore.get('test');
      if (testData) {
        expect(testData.length).toBeLessThanOrEqual(monitoringEngine.config.monitoring.maxDataPoints);
      }
    });

    test('should clean up old data automatically', async () => {
      // Set very short retention period
      monitoringEngine.config.monitoring.retentionPeriod = 100; // 100ms

      const mockCollector = {
        collect: jest.fn().mockResolvedValue({ metric: 1 })
      };

      monitoringEngine.registerCollector('test', mockCollector);

      // Collect initial data
      await monitoringEngine.collectMetrics();

      // Wait beyond retention period
      await new Promise(resolve => setTimeout(resolve, 150));

      // Collect new data
      await monitoringEngine.collectMetrics();

      // Trigger cleanup
      monitoringEngine.cleanupOldData();

      // Verify old data was removed
      const testData = monitoringEngine.dataStore.get('test');
      expect(testData.length).toBe(1);
    });
  });

  describe('Configuration and Customization', () => {
    test('should support custom monitoring intervals', async () => {
      const customConfig = {
        monitoring: { collectInterval: 100 }
      };

      const customEngine = new MonitoringEngine(customConfig, mockLogger);
      expect(customEngine.config.monitoring.collectInterval).toBe(100);
    });

    test('should support custom dashboard refresh rates', async () => {
      const customConfig = {
        dashboard: { refreshInterval: 200 }
      };

      const customDashboard = new PerformanceDashboard(monitoringEngine, customConfig);
      expect(customDashboard.config.dashboard.refreshInterval).toBe(200);
    });

    test('should support selective widget enabling', async () => {
      const customConfig = {
        widgets: {
          systemHealth: { enabled: false },
          realtimeMetrics: { enabled: true },
          alerts: { enabled: false }
        }
      };

      const customDashboard = new PerformanceDashboard(monitoringEngine, customConfig);
      const widgets = customDashboard.getAllWidgets();

      expect(widgets.find(w => w.type === 'systemHealth')).toBeUndefined();
      expect(widgets.find(w => w.type === 'realtimeMetrics')).toBeDefined();
      expect(widgets.find(w => w.type === 'alerts')).toBeUndefined();
    });
  });
});