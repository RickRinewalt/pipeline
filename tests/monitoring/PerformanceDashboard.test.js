const PerformanceDashboard = require('../../src/monitoring/dashboards/PerformanceDashboard');

describe('PerformanceDashboard', () => {
  let dashboard;
  let mockMonitoringEngine;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };

    mockMonitoringEngine = {
      getDashboardData: jest.fn().mockReturnValue({
        health: { score: 85, status: 'healthy' },
        metrics: {
          system: { cpu: { usage: 45 }, memory: { usagePercent: 60 } },
          performance: { responseTime: 150, throughput: 100 }
        },
        alerts: [
          { id: '1', severity: 'warning', message: 'High CPU usage', timestamp: Date.now() }
        ],
        trends: {
          cpu: [{ timestamp: Date.now(), value: 45 }]
        }
      }),
      on: jest.fn(),
      removeAllListeners: jest.fn()
    };

    const config = {
      dashboard: { refreshInterval: 1000 },
      widgets: {
        systemHealth: { enabled: true, size: 'large' },
        realtimeMetrics: { enabled: true, size: 'medium' },
        alerts: { enabled: true, size: 'small' },
        trends: { enabled: true, size: 'large' },
        bottlenecks: { enabled: true, size: 'medium' },
        recommendations: { enabled: true, size: 'small' }
      }
    };

    dashboard = new PerformanceDashboard(mockMonitoringEngine, config);
  });

  afterEach(async () => {
    if (dashboard.isRunning) {
      await dashboard.stop();
    }
  });

  describe('Initialization', () => {
    test('should initialize with monitoring engine', () => {
      expect(dashboard).toBeInstanceOf(PerformanceDashboard);
      expect(dashboard.monitoringEngine).toBe(mockMonitoringEngine);
      expect(dashboard.isRunning).toBe(false);
    });

    test('should throw error without monitoring engine', () => {
      expect(() => {
        new PerformanceDashboard(null);
      }).toThrow('Monitoring engine is required');
    });

    test('should initialize with default configuration', () => {
      const defaultDashboard = new PerformanceDashboard(mockMonitoringEngine);
      
      expect(defaultDashboard.config.dashboard.refreshInterval).toBeDefined();
      expect(defaultDashboard.config.widgets.systemHealth.enabled).toBe(true);
    });
  });

  describe('Lifecycle Management', () => {
    test('should start successfully', async () => {
      const result = await dashboard.start();
      
      expect(result.success).toBe(true);
      expect(result.startTime).toBeDefined();
      expect(dashboard.isRunning).toBe(true);
    });

    test('should not start if already running', async () => {
      await dashboard.start();
      const result = await dashboard.start();
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Dashboard already running');
    });

    test('should stop successfully', async () => {
      await dashboard.start();
      const result = await dashboard.stop();
      
      expect(result.success).toBe(true);
      expect(result.stopTime).toBeDefined();
      expect(dashboard.isRunning).toBe(false);
    });

    test('should not stop if not running', async () => {
      const result = await dashboard.stop();
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Dashboard not running');
    });
  });

  describe('Dashboard Data', () => {
    beforeEach(async () => {
      await dashboard.start();
    });

    test('should return complete dashboard data', () => {
      const data = dashboard.getDashboardData();
      
      expect(data.timestamp).toBeDefined();
      expect(data.isRunning).toBe(true);
      expect(data.lastUpdate).toBeDefined();
    });

    test('should update dashboard data from monitoring engine', () => {
      const data = dashboard.getDashboardData();
      
      expect(data.systemHealth).toBeDefined();
      expect(data.metrics).toBeDefined();
      expect(data.alerts).toBeDefined();
    });
  });

  describe('System Health Widget', () => {
    beforeEach(async () => {
      dashboard.dashboardData.systemHealth = {
        score: 85,
        status: 'healthy',
        cpu: { score: 80, status: 'healthy' },
        memory: { score: 75, status: 'healthy' },
        timestamp: Date.now()
      };
    });

    test('should return system health widget data', () => {
      const widget = dashboard.getSystemHealthWidget();
      
      expect(widget.type).toBe('systemHealth');
      expect(widget.title).toBe('System Health');
      expect(widget.data.overallScore).toBe(85);
      expect(widget.data.status).toBe('healthy');
      expect(widget.data.components.cpu.score).toBe(80);
      expect(widget.visualization).toBe('gauge');
    });

    test('should include component health scores', () => {
      const widget = dashboard.getSystemHealthWidget();
      
      expect(widget.data.components).toHaveProperty('cpu');
      expect(widget.data.components).toHaveProperty('memory');
      expect(widget.data.components).toHaveProperty('disk');
      expect(widget.data.components).toHaveProperty('network');
    });

    test('should include health thresholds', () => {
      const widget = dashboard.getSystemHealthWidget();
      
      expect(widget.thresholds).toHaveProperty('excellent');
      expect(widget.thresholds).toHaveProperty('good');
      expect(widget.thresholds).toHaveProperty('warning');
      expect(widget.thresholds).toHaveProperty('critical');
    });
  });

  describe('Realtime Metrics Widget', () => {
    beforeEach(async () => {
      dashboard.dashboardData.metrics = {
        system: {
          cpu: { usage: 45 },
          memory: { usagePercent: 60 },
          disk: { usagePercent: 70 }
        },
        performance: {
          responseTime: 150,
          throughput: 100
        }
      };
    });

    test('should return realtime metrics widget data', () => {
      const widget = dashboard.getRealtimeMetricsWidget();
      
      expect(widget.type).toBe('realtimeMetrics');
      expect(widget.title).toBe('Real-time Metrics');
      expect(widget.data.cpu.current).toBe(45);
      expect(widget.data.memory.current).toBe(60);
      expect(widget.data.disk.current).toBe(70);
    });

    test('should include units for metrics', () => {
      const widget = dashboard.getRealtimeMetricsWidget();
      
      expect(widget.data.cpu.unit).toBe('%');
      expect(widget.data.memory.unit).toBe('%');
      expect(widget.data.responseTime.unit).toBe('ms');
    });

    test('should include metric trends', () => {
      const widget = dashboard.getRealtimeMetricsWidget();
      
      expect(widget.data.cpu).toHaveProperty('trend');
      expect(widget.data.memory).toHaveProperty('trend');
    });
  });

  describe('Alerts Widget', () => {
    beforeEach(async () => {
      dashboard.dashboardData.alerts = [
        { id: '1', severity: 'critical', message: 'High CPU', timestamp: Date.now(), status: 'active' },
        { id: '2', severity: 'warning', message: 'High Memory', timestamp: Date.now() - 1000, status: 'active' },
        { id: '3', severity: 'info', message: 'System Update', timestamp: Date.now() - 2000, status: 'active' }
      ];
    });

    test('should return alerts widget data', () => {
      const widget = dashboard.getAlertsWidget();
      
      expect(widget.type).toBe('alerts');
      expect(widget.title).toBe('Active Alerts');
      expect(widget.data.total).toBe(3);
      expect(widget.data.critical).toBe(1);
      expect(widget.data.warning).toBe(1);
      expect(widget.data.info).toBe(1);
    });

    test('should include recent alerts', () => {
      const widget = dashboard.getAlertsWidget();
      
      expect(widget.data.recent).toHaveLength(3);
      expect(widget.data.recent[0].severity).toBe('critical');
    });

    test('should include alert actions', () => {
      const widget = dashboard.getAlertsWidget();
      
      expect(widget.actions).toContain('acknowledge');
      expect(widget.actions).toContain('silence');
      expect(widget.actions).toContain('escalate');
    });
  });

  describe('Trends Widget', () => {
    beforeEach(async () => {
      dashboard.dashboardData.trends = {
        cpu: [
          { timestamp: Date.now() - 60000, value: 40 },
          { timestamp: Date.now(), value: 45 }
        ],
        memory: [
          { timestamp: Date.now() - 60000, value: 55 },
          { timestamp: Date.now(), value: 60 }
        ]
      };
    });

    test('should return trends widget data', () => {
      const widget = dashboard.getTrendsWidget();
      
      expect(widget.type).toBe('trends');
      expect(widget.title).toBe('Performance Trends');
      expect(widget.data.cpu).toBeDefined();
      expect(widget.data.memory).toBeDefined();
    });

    test('should format trend data correctly', () => {
      const widget = dashboard.getTrendsWidget();
      
      expect(widget.data.cpu.data).toHaveLength(2);
      expect(widget.data.cpu.data[0]).toHaveProperty('timestamp');
      expect(widget.data.cpu.data[0]).toHaveProperty('value');
    });

    test('should include visualization options', () => {
      const widget = dashboard.getTrendsWidget();
      
      expect(widget.visualization).toBe('timeseries');
      expect(widget.options.showGrid).toBe(true);
      expect(widget.options.showLegend).toBe(true);
    });
  });

  describe('Bottlenecks Widget', () => {
    beforeEach(async () => {
      dashboard.dashboardData.bottlenecks = [
        {
          type: 'cpu',
          component: 'system',
          impact: 85,
          duration: 300000,
          status: 'active',
          recommendations: ['Scale CPU resources', 'Optimize processes']
        },
        {
          type: 'memory',
          component: 'application',
          impact: 70,
          duration: 180000,
          status: 'resolved'
        }
      ];
    });

    test('should return bottlenecks widget data', () => {
      const widget = dashboard.getBottlenecksWidget();
      
      expect(widget.type).toBe('bottlenecks');
      expect(widget.title).toBe('Performance Bottlenecks');
      expect(widget.data.active).toHaveLength(1);
      expect(widget.data.resolved).toHaveLength(1);
    });

    test('should sort bottlenecks by impact', () => {
      const widget = dashboard.getBottlenecksWidget();
      
      expect(widget.data.topBottlenecks[0].impact).toBeGreaterThanOrEqual(
        widget.data.topBottlenecks[widget.data.topBottlenecks.length - 1]?.impact || 0
      );
    });

    test('should limit recommendations per bottleneck', () => {
      const widget = dashboard.getBottlenecksWidget();
      
      const bottleneckWithRecommendations = widget.data.topBottlenecks.find(b => b.recommendations);
      if (bottleneckWithRecommendations) {
        expect(bottleneckWithRecommendations.recommendations.length).toBeLessThanOrEqual(2);
      }
    });
  });

  describe('Recommendations Widget', () => {
    beforeEach(async () => {
      dashboard.dashboardData.recommendations = [
        { priority: 'high', status: 'pending', type: 'performance' },
        { priority: 'high', status: 'pending', type: 'security' },
        { priority: 'medium', status: 'pending', type: 'optimization' },
        { priority: 'low', status: 'implemented', type: 'maintenance' }
      ];
    });

    test('should return recommendations widget data', () => {
      const widget = dashboard.getRecommendationsWidget();
      
      expect(widget.type).toBe('recommendations');
      expect(widget.title).toBe('Optimization Recommendations');
      expect(widget.data.high).toHaveLength(2);
      expect(widget.data.medium).toHaveLength(1);
      expect(widget.data.pending).toBe(3);
      expect(widget.data.implemented).toBe(1);
    });

    test('should limit recommendations by priority', () => {
      const widget = dashboard.getRecommendationsWidget();
      
      expect(widget.data.high.length).toBeLessThanOrEqual(3);
      expect(widget.data.medium.length).toBeLessThanOrEqual(2);
      expect(widget.data.low.length).toBeLessThanOrEqual(1);
    });

    test('should include recommendation actions', () => {
      const widget = dashboard.getRecommendationsWidget();
      
      expect(widget.actions).toContain('implement');
      expect(widget.actions).toContain('postpone');
      expect(widget.actions).toContain('dismiss');
    });
  });

  describe('All Widgets', () => {
    test('should return all enabled widgets', () => {
      const widgets = dashboard.getAllWidgets();
      
      expect(widgets.length).toBeGreaterThan(0);
      expect(widgets.every(widget => widget.type)).toBe(true);
      expect(widgets.every(widget => widget.title)).toBe(true);
      expect(widgets.every(widget => widget.data)).toBe(true);
    });

    test('should respect widget enabled configuration', () => {
      const disabledConfig = {
        widgets: {
          systemHealth: { enabled: false },
          realtimeMetrics: { enabled: true }
        }
      };

      const customDashboard = new PerformanceDashboard(mockMonitoringEngine, disabledConfig);
      const widgets = customDashboard.getAllWidgets();
      
      expect(widgets.find(w => w.type === 'systemHealth')).toBeUndefined();
      expect(widgets.find(w => w.type === 'realtimeMetrics')).toBeDefined();
    });
  });

  describe('Chart Data', () => {
    test('should return system overview chart data', () => {
      const chartData = dashboard.getChartData('system_overview');
      
      expect(chartData.type).toBe('line');
      expect(chartData.title).toBe('System Overview');
      expect(chartData.datasets).toBeDefined();
      expect(chartData.datasets.length).toBeGreaterThan(0);
    });

    test('should return performance metrics chart data', () => {
      const chartData = dashboard.getChartData('performance_metrics');
      
      expect(chartData.type).toBe('line');
      expect(chartData.title).toBe('Performance Metrics');
      expect(chartData.datasets).toBeDefined();
    });

    test('should return alerts timeline chart data', () => {
      dashboard.dashboardData.alerts = [
        { timestamp: Date.now() - 3600000, severity: 'critical' },
        { timestamp: Date.now() - 1800000, severity: 'warning' }
      ];

      const chartData = dashboard.getChartData('alerts_timeline');
      
      expect(chartData.type).toBe('bar');
      expect(chartData.title).toBe('Alerts Timeline');
      expect(chartData.datasets).toBeDefined();
    });

    test('should handle unknown chart type', () => {
      const chartData = dashboard.getChartData('unknown_chart');
      
      expect(chartData.error).toBeDefined();
    });

    test('should respect time range parameter', () => {
      const timeRange = 3600000; // 1 hour
      const chartData = dashboard.getChartData('system_overview', timeRange);
      
      expect(chartData.timeRange.end - chartData.timeRange.start).toBe(timeRange);
    });
  });

  describe('Data Export', () => {
    test('should export dashboard data as JSON', () => {
      const exported = dashboard.exportDashboard('json');
      
      expect(typeof exported).toBe('string');
      
      const parsed = JSON.parse(exported);
      expect(parsed.timestamp).toBeDefined();
      expect(parsed.config).toBeDefined();
      expect(parsed.data).toBeDefined();
      expect(parsed.widgets).toBeDefined();
      expect(parsed.charts).toBeDefined();
    });

    test('should export dashboard data as CSV', () => {
      const exported = dashboard.exportDashboard('csv');
      
      expect(typeof exported).toBe('string');
      expect(exported).toContain('Timestamp,Metric,Value,Status');
    });

    test('should return raw data for unknown format', () => {
      const exported = dashboard.exportDashboard('xml');
      
      expect(typeof exported).toBe('object');
      expect(exported.timestamp).toBeDefined();
    });
  });

  describe('Real-time Updates', () => {
    beforeEach(async () => {
      await dashboard.start();
    });

    test('should start real-time updates when enabled', () => {
      expect(dashboard.refreshTimer).toBeDefined();
    });

    test('should not start real-time updates when disabled', async () => {
      await dashboard.stop();

      const disabledConfig = {
        dashboard: { enableRealTime: false }
      };

      const customDashboard = new PerformanceDashboard(mockMonitoringEngine, disabledConfig);
      await customDashboard.start();
      
      expect(customDashboard.refreshTimer).toBeNull();
      
      await customDashboard.stop();
    });

    test('should stop real-time updates on stop', async () => {
      await dashboard.stop();
      
      expect(dashboard.refreshTimer).toBeNull();
    });
  });

  describe('Event Handling', () => {
    beforeEach(async () => {
      await dashboard.start();
    });

    test('should emit started event', async () => {
      const testDashboard = new PerformanceDashboard(mockMonitoringEngine);
      let startedEmitted = false;
      
      testDashboard.on('started', () => {
        startedEmitted = true;
      });

      await testDashboard.start();
      
      expect(startedEmitted).toBe(true);
      
      await testDashboard.stop();
    });

    test('should emit stopped event', async () => {
      let stoppedEmitted = false;
      
      dashboard.on('stopped', () => {
        stoppedEmitted = true;
      });

      await dashboard.stop();
      
      expect(stoppedEmitted).toBe(true);
    });

    test('should emit data-updated event', async () => {
      let dataUpdatedEmitted = false;
      
      dashboard.on('data-updated', () => {
        dataUpdatedEmitted = true;
      });

      await dashboard.updateDashboardData();
      
      expect(dataUpdatedEmitted).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle monitoring engine errors gracefully', async () => {
      mockMonitoringEngine.getDashboardData.mockImplementation(() => {
        throw new Error('Monitoring engine error');
      });

      let errorEmitted = false;
      dashboard.on('error', () => {
        errorEmitted = true;
      });

      await dashboard.start();
      
      // Wait for the error to be emitted
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(errorEmitted).toBe(true);
    });

    test('should handle start errors gracefully', async () => {
      jest.spyOn(dashboard, 'initializeDashboard').mockRejectedValue(new Error('Init failed'));
      
      const result = await dashboard.start();
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Init failed');
    });

    test('should handle stop errors gracefully', async () => {
      await dashboard.start();
      
      jest.spyOn(dashboard, 'stopRealTimeUpdates').mockImplementation(() => {
        throw new Error('Stop failed');
      });
      
      const result = await dashboard.stop();
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Stop failed');
    });
  });
});