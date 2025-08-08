const EventEmitter = require('events');

/**
 * Performance Dashboard
 * Real-time analytics dashboard for performance monitoring system
 */
class PerformanceDashboard extends EventEmitter {
  constructor(monitoringEngine, config = {}) {
    super();

    if (!monitoringEngine) {
      throw new Error('Monitoring engine is required');
    }

    this.monitoringEngine = monitoringEngine;
    this.config = {
      dashboard: {
        refreshInterval: 5000, // 5 seconds
        historyWindow: 24 * 60 * 60 * 1000, // 24 hours
        maxDataPoints: 1000,
        enableRealTime: true,
        ...config.dashboard
      },
      charts: {
        enableTrendCharts: true,
        enableMetricCharts: true,
        enableAlertCharts: true,
        ...config.charts
      },
      widgets: {
        systemHealth: { enabled: true, size: 'large' },
        realtimeMetrics: { enabled: true, size: 'medium' },
        alerts: { enabled: true, size: 'small' },
        trends: { enabled: true, size: 'large' },
        bottlenecks: { enabled: true, size: 'medium' },
        recommendations: { enabled: true, size: 'small' },
        ...config.widgets
      },
      ...config
    };

    this.dashboardData = {
      timestamp: Date.now(),
      systemHealth: {},
      metrics: {},
      charts: {},
      alerts: [],
      trends: {},
      widgets: {}
    };

    this.isRunning = false;
    this.refreshTimer = null;

    // Set up monitoring engine event listeners
    this.setupEventListeners();
  }

  /**
   * Start the dashboard
   */
  async start() {
    if (this.isRunning) {
      return { success: false, error: 'Dashboard already running' };
    }

    try {
      // Initialize dashboard data
      await this.initializeDashboard();

      // Start real-time updates
      if (this.config.dashboard.enableRealTime) {
        this.startRealTimeUpdates();
      }

      this.isRunning = true;
      this.emit('started');

      return {
        success: true,
        startTime: Date.now(),
        config: this.config
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Stop the dashboard
   */
  async stop() {
    if (!this.isRunning) {
      return { success: false, error: 'Dashboard not running' };
    }

    try {
      // Stop real-time updates
      this.stopRealTimeUpdates();

      this.isRunning = false;
      this.emit('stopped');

      return {
        success: true,
        stopTime: Date.now()
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get current dashboard data
   */
  getDashboardData() {
    return {
      ...this.dashboardData,
      timestamp: Date.now(),
      isRunning: this.isRunning,
      lastUpdate: this.dashboardData.timestamp
    };
  }

  /**
   * Get system health widget data
   */
  getSystemHealthWidget() {
    const healthData = this.dashboardData.systemHealth;
    
    return {
      type: 'systemHealth',
      title: 'System Health',
      size: this.config.widgets.systemHealth.size,
      data: {
        overallScore: healthData.score || 0,
        status: healthData.status || 'unknown',
        components: {
          cpu: { score: healthData.cpu?.score || 0, status: healthData.cpu?.status || 'unknown' },
          memory: { score: healthData.memory?.score || 0, status: healthData.memory?.status || 'unknown' },
          disk: { score: healthData.disk?.score || 0, status: healthData.disk?.status || 'unknown' },
          network: { score: healthData.network?.score || 0, status: healthData.network?.status || 'unknown' }
        },
        trend: healthData.trend || 'stable',
        lastUpdate: healthData.timestamp || Date.now()
      },
      visualization: 'gauge',
      thresholds: {
        excellent: 90,
        good: 75,
        warning: 50,
        critical: 25
      }
    };
  }

  /**
   * Get real-time metrics widget data
   */
  getRealtimeMetricsWidget() {
    const metrics = this.dashboardData.metrics;
    
    return {
      type: 'realtimeMetrics',
      title: 'Real-time Metrics',
      size: this.config.widgets.realtimeMetrics.size,
      data: {
        cpu: {
          current: metrics.system?.cpu?.usage || 0,
          trend: this.calculateMetricTrend('cpu'),
          unit: '%'
        },
        memory: {
          current: metrics.system?.memory?.usagePercent || 0,
          trend: this.calculateMetricTrend('memory'),
          unit: '%'
        },
        disk: {
          current: metrics.system?.disk?.usagePercent || 0,
          trend: this.calculateMetricTrend('disk'),
          unit: '%'
        },
        responseTime: {
          current: metrics.performance?.responseTime || 0,
          trend: this.calculateMetricTrend('responseTime'),
          unit: 'ms'
        },
        throughput: {
          current: metrics.performance?.throughput || 0,
          trend: this.calculateMetricTrend('throughput'),
          unit: 'req/s'
        }
      },
      visualization: 'metrics',
      refreshRate: this.config.dashboard.refreshInterval
    };
  }

  /**
   * Get alerts widget data
   */
  getAlertsWidget() {
    const alerts = this.dashboardData.alerts || [];
    const activeAlerts = alerts.filter(alert => alert.status === 'active');
    
    return {
      type: 'alerts',
      title: 'Active Alerts',
      size: this.config.widgets.alerts.size,
      data: {
        total: activeAlerts.length,
        critical: activeAlerts.filter(a => a.severity === 'critical').length,
        warning: activeAlerts.filter(a => a.severity === 'warning').length,
        info: activeAlerts.filter(a => a.severity === 'info').length,
        recent: activeAlerts.slice(0, 5).map(alert => ({
          id: alert.id,
          severity: alert.severity,
          message: alert.message,
          timestamp: alert.timestamp,
          duration: Date.now() - alert.timestamp
        }))
      },
      visualization: 'list',
      actions: ['acknowledge', 'silence', 'escalate']
    };
  }

  /**
   * Get trends widget data
   */
  getTrendsWidget() {
    const trends = this.dashboardData.trends || {};
    
    return {
      type: 'trends',
      title: 'Performance Trends',
      size: this.config.widgets.trends.size,
      data: {
        cpu: this.formatTrendData(trends.cpu),
        memory: this.formatTrendData(trends.memory),
        responseTime: this.formatTrendData(trends.responseTime),
        errorRate: this.formatTrendData(trends.errorRate),
        timeRange: this.config.dashboard.historyWindow
      },
      visualization: 'timeseries',
      options: {
        showGrid: true,
        showLegend: true,
        animation: true
      }
    };
  }

  /**
   * Get bottlenecks widget data
   */
  getBottlenecksWidget() {
    const bottlenecks = this.dashboardData.bottlenecks || [];
    
    return {
      type: 'bottlenecks',
      title: 'Performance Bottlenecks',
      size: this.config.widgets.bottlenecks.size,
      data: {
        active: bottlenecks.filter(b => b.status === 'active'),
        resolved: bottlenecks.filter(b => b.status === 'resolved'),
        topBottlenecks: bottlenecks
          .sort((a, b) => b.impact - a.impact)
          .slice(0, 5)
          .map(bottleneck => ({
            type: bottleneck.type,
            component: bottleneck.component,
            impact: bottleneck.impact,
            duration: bottleneck.duration,
            recommendations: bottleneck.recommendations?.slice(0, 2) || []
          }))
      },
      visualization: 'table',
      sortable: true
    };
  }

  /**
   * Get recommendations widget data
   */
  getRecommendationsWidget() {
    const recommendations = this.dashboardData.recommendations || [];
    
    return {
      type: 'recommendations',
      title: 'Optimization Recommendations',
      size: this.config.widgets.recommendations.size,
      data: {
        high: recommendations.filter(r => r.priority === 'high').slice(0, 3),
        medium: recommendations.filter(r => r.priority === 'medium').slice(0, 2),
        low: recommendations.filter(r => r.priority === 'low').slice(0, 1),
        implemented: recommendations.filter(r => r.status === 'implemented').length,
        pending: recommendations.filter(r => r.status === 'pending').length
      },
      visualization: 'cards',
      actions: ['implement', 'postpone', 'dismiss']
    };
  }

  /**
   * Get all widgets data
   */
  getAllWidgets() {
    const widgets = [];

    if (this.config.widgets.systemHealth?.enabled) {
      widgets.push(this.getSystemHealthWidget());
    }

    if (this.config.widgets.realtimeMetrics?.enabled) {
      widgets.push(this.getRealtimeMetricsWidget());
    }

    if (this.config.widgets.alerts?.enabled) {
      widgets.push(this.getAlertsWidget());
    }

    if (this.config.widgets.trends?.enabled) {
      widgets.push(this.getTrendsWidget());
    }

    if (this.config.widgets.bottlenecks?.enabled) {
      widgets.push(this.getBottlenecksWidget());
    }

    if (this.config.widgets.recommendations?.enabled) {
      widgets.push(this.getRecommendationsWidget());
    }

    return widgets;
  }

  /**
   * Get chart data for specific metrics
   */
  getChartData(chartType, timeRange = this.config.dashboard.historyWindow) {
    const endTime = Date.now();
    const startTime = endTime - timeRange;

    switch (chartType) {
      case 'system_overview':
        return this.getSystemOverviewChart(startTime, endTime);
      case 'performance_metrics':
        return this.getPerformanceMetricsChart(startTime, endTime);
      case 'alerts_timeline':
        return this.getAlertsTimelineChart(startTime, endTime);
      case 'bottleneck_analysis':
        return this.getBottleneckAnalysisChart(startTime, endTime);
      default:
        return { error: `Unknown chart type: ${chartType}` };
    }
  }

  /**
   * Get system overview chart
   */
  getSystemOverviewChart(startTime, endTime) {
    const historicalData = this.getHistoricalData(['cpu', 'memory', 'disk'], startTime, endTime);
    
    return {
      type: 'line',
      title: 'System Overview',
      timeRange: { start: startTime, end: endTime },
      datasets: [
        {
          label: 'CPU Usage (%)',
          data: historicalData.cpu || [],
          color: '#ff6384',
          yAxis: 'percentage'
        },
        {
          label: 'Memory Usage (%)',
          data: historicalData.memory || [],
          color: '#36a2eb',
          yAxis: 'percentage'
        },
        {
          label: 'Disk Usage (%)',
          data: historicalData.disk || [],
          color: '#ffcd56',
          yAxis: 'percentage'
        }
      ],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { type: 'time' },
          y: { min: 0, max: 100, title: { text: 'Percentage (%)' } }
        }
      }
    };
  }

  /**
   * Get performance metrics chart
   */
  getPerformanceMetricsChart(startTime, endTime) {
    const historicalData = this.getHistoricalData(['responseTime', 'throughput', 'errorRate'], startTime, endTime);
    
    return {
      type: 'line',
      title: 'Performance Metrics',
      timeRange: { start: startTime, end: endTime },
      datasets: [
        {
          label: 'Response Time (ms)',
          data: historicalData.responseTime || [],
          color: '#ff9f40',
          yAxis: 'responseTime'
        },
        {
          label: 'Throughput (req/s)',
          data: historicalData.throughput || [],
          color: '#4bc0c0',
          yAxis: 'throughput'
        },
        {
          label: 'Error Rate (%)',
          data: historicalData.errorRate || [],
          color: '#ff6384',
          yAxis: 'percentage'
        }
      ],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { type: 'time' },
          responseTime: { type: 'linear', position: 'left', title: { text: 'Response Time (ms)' } },
          throughput: { type: 'linear', position: 'right', title: { text: 'Throughput (req/s)' } },
          percentage: { min: 0, max: 100, position: 'right', title: { text: 'Error Rate (%)' } }
        }
      }
    };
  }

  /**
   * Get alerts timeline chart
   */
  getAlertsTimelineChart(startTime, endTime) {
    const alertsInRange = this.dashboardData.alerts?.filter(alert => 
      alert.timestamp >= startTime && alert.timestamp <= endTime
    ) || [];

    const timelineBuckets = this.createTimeBuckets(startTime, endTime, 60 * 60 * 1000); // 1-hour buckets
    
    timelineBuckets.forEach(bucket => {
      bucket.critical = 0;
      bucket.warning = 0;
      bucket.info = 0;
      
      alertsInRange.forEach(alert => {
        if (alert.timestamp >= bucket.start && alert.timestamp < bucket.end) {
          bucket[alert.severity]++;
        }
      });
    });

    return {
      type: 'bar',
      title: 'Alerts Timeline',
      timeRange: { start: startTime, end: endTime },
      datasets: [
        {
          label: 'Critical',
          data: timelineBuckets.map(bucket => ({ x: bucket.start, y: bucket.critical })),
          color: '#dc3545'
        },
        {
          label: 'Warning',
          data: timelineBuckets.map(bucket => ({ x: bucket.start, y: bucket.warning })),
          color: '#ffc107'
        },
        {
          label: 'Info',
          data: timelineBuckets.map(bucket => ({ x: bucket.start, y: bucket.info })),
          color: '#17a2b8'
        }
      ],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { type: 'time', stacked: true },
          y: { stacked: true, title: { text: 'Alert Count' } }
        }
      }
    };
  }

  /**
   * Export dashboard data
   */
  exportDashboard(format = 'json') {
    const exportData = {
      timestamp: Date.now(),
      config: this.config,
      data: this.dashboardData,
      widgets: this.getAllWidgets(),
      charts: {
        systemOverview: this.getChartData('system_overview'),
        performanceMetrics: this.getChartData('performance_metrics'),
        alertsTimeline: this.getChartData('alerts_timeline')
      }
    };

    switch (format.toLowerCase()) {
      case 'json':
        return JSON.stringify(exportData, null, 2);
      case 'csv':
        return this.convertToCSV(exportData);
      default:
        return exportData;
    }
  }

  /**
   * Private Methods
   */

  async initializeDashboard() {
    // Get initial data from monitoring engine
    await this.updateDashboardData();
  }

  async updateDashboardData() {
    try {
      // Get current metrics
      const dashboardData = this.monitoringEngine.getDashboardData();
      
      // Update dashboard state
      this.dashboardData = {
        timestamp: Date.now(),
        systemHealth: dashboardData.health || {},
        metrics: dashboardData.metrics || {},
        alerts: dashboardData.alerts || [],
        trends: dashboardData.trends || {},
        bottlenecks: this.extractBottlenecks(dashboardData),
        recommendations: this.extractRecommendations(dashboardData)
      };

      // Emit update event
      this.emit('data-updated', this.dashboardData);

    } catch (error) {
      this.emit('error', new Error(`Failed to update dashboard data: ${error.message}`));
    }
  }

  setupEventListeners() {
    // Listen to monitoring engine events
    this.monitoringEngine.on('metrics-collected', (data) => {
      this.handleMetricsUpdate(data);
    });

    this.monitoringEngine.on('alert', (alert) => {
      this.handleAlert(alert);
    });

    this.monitoringEngine.on('bottleneck', (bottleneck) => {
      this.handleBottleneck(bottleneck);
    });

    this.monitoringEngine.on('anomaly', (anomaly) => {
      this.handleAnomaly(anomaly);
    });
  }

  startRealTimeUpdates() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }

    this.refreshTimer = setInterval(
      () => this.updateDashboardData(),
      this.config.dashboard.refreshInterval
    );
  }

  stopRealTimeUpdates() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  handleMetricsUpdate(data) {
    // Update metrics in real-time
    this.emit('realtime-metrics', data);
  }

  handleAlert(alert) {
    // Add alert to dashboard
    if (!this.dashboardData.alerts) {
      this.dashboardData.alerts = [];
    }

    this.dashboardData.alerts.unshift({
      ...alert,
      status: 'active',
      timestamp: Date.now()
    });

    // Limit alerts array size
    if (this.dashboardData.alerts.length > 100) {
      this.dashboardData.alerts = this.dashboardData.alerts.slice(0, 100);
    }

    this.emit('new-alert', alert);
  }

  handleBottleneck(bottleneck) {
    // Add bottleneck to dashboard
    if (!this.dashboardData.bottlenecks) {
      this.dashboardData.bottlenecks = [];
    }

    this.dashboardData.bottlenecks.unshift({
      ...bottleneck,
      status: 'active',
      timestamp: Date.now()
    });

    this.emit('new-bottleneck', bottleneck);
  }

  handleAnomaly(anomaly) {
    // Handle anomaly detection
    this.emit('anomaly-detected', anomaly);
  }

  calculateMetricTrend(metric) {
    // Calculate trend based on historical data
    const historicalData = this.getRecentHistoricalData(metric, 300000); // Last 5 minutes
    
    if (historicalData.length < 2) {
      return 'stable';
    }

    const first = historicalData[0].value;
    const last = historicalData[historicalData.length - 1].value;
    const change = ((last - first) / first) * 100;

    if (Math.abs(change) < 5) return 'stable';
    return change > 0 ? 'increasing' : 'decreasing';
  }

  formatTrendData(trendData) {
    if (!trendData || !Array.isArray(trendData)) {
      return { data: [], trend: 'stable', change: 0 };
    }

    return {
      data: trendData.map(point => ({
        timestamp: point.timestamp,
        value: point.value
      })),
      trend: this.calculateTrendDirection(trendData),
      change: this.calculateTrendChange(trendData)
    };
  }

  extractBottlenecks(dashboardData) {
    // Extract bottlenecks from dashboard data
    const bottlenecks = [];

    // Add logic to identify bottlenecks from metrics
    const metrics = dashboardData.metrics || {};
    
    // CPU bottleneck
    if (metrics.system?.cpu?.usage > 80) {
      bottlenecks.push({
        type: 'cpu',
        component: 'system',
        impact: metrics.system.cpu.usage,
        duration: Date.now() - (metrics.system.cpu.highUsageStart || Date.now()),
        recommendations: ['Scale CPU resources', 'Optimize CPU-intensive processes']
      });
    }

    // Memory bottleneck
    if (metrics.system?.memory?.usagePercent > 85) {
      bottlenecks.push({
        type: 'memory',
        component: 'system',
        impact: metrics.system.memory.usagePercent,
        duration: Date.now() - (metrics.system.memory.highUsageStart || Date.now()),
        recommendations: ['Scale memory resources', 'Optimize memory usage']
      });
    }

    return bottlenecks;
  }

  extractRecommendations(dashboardData) {
    // Extract recommendations from dashboard data
    const recommendations = [];

    const health = dashboardData.health || {};
    
    if (health.score < 80) {
      recommendations.push({
        priority: 'high',
        type: 'system_health',
        title: 'Improve System Health',
        description: `System health score is ${health.score}%`,
        actions: ['Review system metrics', 'Address performance issues'],
        status: 'pending'
      });
    }

    return recommendations;
  }

  getHistoricalData(metrics, startTime, endTime) {
    // Get historical data for specified metrics
    const data = {};

    metrics.forEach(metric => {
      // This would typically query the monitoring engine's historical data
      data[metric] = this.generateMockHistoricalData(startTime, endTime);
    });

    return data;
  }

  getRecentHistoricalData(metric, timeWindow) {
    // Get recent historical data for a metric
    const endTime = Date.now();
    const startTime = endTime - timeWindow;
    
    // This would typically query the monitoring engine
    return this.generateMockHistoricalData(startTime, endTime);
  }

  generateMockHistoricalData(startTime, endTime) {
    // Generate mock historical data for demonstration
    const data = [];
    const interval = (endTime - startTime) / 100; // 100 data points

    for (let timestamp = startTime; timestamp <= endTime; timestamp += interval) {
      data.push({
        timestamp,
        value: Math.random() * 100
      });
    }

    return data;
  }

  createTimeBuckets(startTime, endTime, bucketSize) {
    const buckets = [];
    
    for (let time = startTime; time < endTime; time += bucketSize) {
      buckets.push({
        start: time,
        end: Math.min(time + bucketSize, endTime)
      });
    }

    return buckets;
  }

  calculateTrendDirection(data) {
    if (data.length < 2) return 'stable';
    
    const first = data[0].value;
    const last = data[data.length - 1].value;
    const change = ((last - first) / first) * 100;

    if (Math.abs(change) < 5) return 'stable';
    return change > 0 ? 'increasing' : 'decreasing';
  }

  calculateTrendChange(data) {
    if (data.length < 2) return 0;
    
    const first = data[0].value;
    const last = data[data.length - 1].value;
    
    return first > 0 ? ((last - first) / first) * 100 : 0;
  }

  convertToCSV(data) {
    // Convert dashboard data to CSV format
    const csv = [];
    csv.push('Timestamp,Metric,Value,Status');

    // Add system health data
    if (data.data.systemHealth) {
      const health = data.data.systemHealth;
      csv.push(`${health.timestamp || Date.now()},SystemHealth,${health.score || 0},${health.status || 'unknown'}`);
    }

    // Add metrics data
    if (data.data.metrics) {
      Object.entries(data.data.metrics).forEach(([category, categoryData]) => {
        if (typeof categoryData === 'object') {
          Object.entries(categoryData).forEach(([metric, value]) => {
            if (typeof value === 'number') {
              csv.push(`${Date.now()},${category}_${metric},${value},active`);
            }
          });
        }
      });
    }

    return csv.join('\n');
  }
}

module.exports = PerformanceDashboard;