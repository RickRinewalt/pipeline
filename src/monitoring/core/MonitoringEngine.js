const EventEmitter = require('events');
const { MetricsCollector } = require('./MetricsCollector');
const { AlertManager } = require('./AlertManager');
const { DataProcessor } = require('./DataProcessor');
const { PerformanceAnalyzer } = require('./PerformanceAnalyzer');

/**
 * Performance Monitoring Engine
 * Core orchestrator for comprehensive performance monitoring and analytics
 */
class MonitoringEngine extends EventEmitter {
  constructor(config = {}, logger = console) {
    super();

    this.config = {
      monitoring: {
        enabled: true,
        collectInterval: 5000, // 5 seconds
        retentionPeriod: 30 * 24 * 60 * 60 * 1000, // 30 days
        maxDataPoints: 10000,
        realTimeUpdates: true,
        ...config.monitoring
      },
      alerts: {
        enabled: true,
        thresholds: {
          cpuUsage: 80,
          memoryUsage: 85,
          responseTime: 2000,
          errorRate: 5,
          ...config.alerts?.thresholds
        },
        channels: config.alerts?.channels || ['log'],
        ...config.alerts
      },
      analytics: {
        enableTrendAnalysis: true,
        enableBottleneckDetection: true,
        enableAnomalyDetection: true,
        ...config.analytics
      }
    };

    this.logger = logger;
    this.isRunning = false;
    this.collectors = new Map();
    this.dataStore = new Map();
    this.activeMetrics = new Set();
    
    // Initialize core components
    this.metricsCollector = new MetricsCollector(this.config, this.logger);
    this.alertManager = new AlertManager(this.config.alerts, this.logger);
    this.dataProcessor = new DataProcessor(this.config, this.logger);
    this.performanceAnalyzer = new PerformanceAnalyzer(this.config.analytics, this.logger);

    // Bind event handlers
    this.setupEventHandlers();

    this.logger.info('Performance Monitoring Engine initialized', {
      collectInterval: this.config.monitoring.collectInterval,
      alertsEnabled: this.config.alerts.enabled,
      retentionPeriod: this.config.monitoring.retentionPeriod
    });
  }

  /**
   * Start monitoring engine
   */
  async start() {
    if (this.isRunning) {
      this.logger.warn('Monitoring engine is already running');
      return { success: false, error: 'Already running' };
    }

    try {
      this.logger.info('Starting performance monitoring engine...');

      // Initialize data collection
      await this.initializeCollectors();

      // Start data processing pipeline
      await this.startDataPipeline();

      // Start real-time collection
      this.startCollection();

      // Setup cleanup intervals
      this.setupCleanupTasks();

      this.isRunning = true;
      this.emit('started');

      this.logger.info('Performance monitoring engine started successfully');

      return {
        success: true,
        startTime: Date.now(),
        collectors: Array.from(this.collectors.keys()),
        config: this.config
      };

    } catch (error) {
      this.logger.error('Failed to start monitoring engine', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Stop monitoring engine
   */
  async stop() {
    if (!this.isRunning) {
      this.logger.warn('Monitoring engine is not running');
      return { success: false, error: 'Not running' };
    }

    try {
      this.logger.info('Stopping performance monitoring engine...');

      // Stop data collection
      this.stopCollection();

      // Stop all collectors
      await this.stopCollectors();

      // Cleanup resources
      this.cleanup();

      this.isRunning = false;
      this.emit('stopped');

      this.logger.info('Performance monitoring engine stopped successfully');

      return {
        success: true,
        stopTime: Date.now(),
        finalMetrics: this.getCurrentMetrics()
      };

    } catch (error) {
      this.logger.error('Error stopping monitoring engine', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Register a new metrics collector
   */
  registerCollector(name, collector) {
    if (this.collectors.has(name)) {
      this.logger.warn(`Collector '${name}' already registered, replacing`);
    }

    this.collectors.set(name, {
      instance: collector,
      enabled: true,
      lastCollection: null,
      errorCount: 0,
      metrics: new Map()
    });

    this.logger.info(`Registered collector: ${name}`);
    this.emit('collector-registered', { name, collector });

    return { success: true, name };
  }

  /**
   * Collect metrics from all registered collectors
   */
  async collectMetrics() {
    if (!this.isRunning) {
      return { success: false, error: 'Engine not running' };
    }

    const timestamp = Date.now();
    const results = {
      timestamp,
      collectors: {},
      summary: {},
      errors: []
    };

    // Collect from each registered collector
    for (const [name, collectorData] of this.collectors.entries()) {
      if (!collectorData.enabled) {
        continue;
      }

      try {
        const metrics = await this.collectFromCollector(name, collectorData);
        results.collectors[name] = {
          success: true,
          metrics,
          timestamp
        };

        // Store metrics
        this.storeMetrics(name, metrics, timestamp);

        collectorData.lastCollection = timestamp;

      } catch (error) {
        this.logger.error(`Error collecting from '${name}'`, { error: error.message });
        
        collectorData.errorCount++;
        results.collectors[name] = {
          success: false,
          error: error.message
        };
        results.errors.push({ collector: name, error: error.message });

        // Disable collector if too many errors
        if (collectorData.errorCount > 5) {
          collectorData.enabled = false;
          this.logger.warn(`Disabled collector '${name}' due to repeated errors`);
        }
      }
    }

    // Process collected data
    await this.processCollectedData(results);

    // Emit real-time update
    if (this.config.monitoring.realTimeUpdates) {
      this.emit('metrics-collected', results);
    }

    return results;
  }

  /**
   * Get current performance metrics
   */
  getCurrentMetrics() {
    const timestamp = Date.now();
    const systemMetrics = this.getSystemMetrics();
    const applicationMetrics = this.getApplicationMetrics();
    const performanceMetrics = this.getPerformanceMetrics();

    return {
      timestamp,
      system: systemMetrics,
      application: applicationMetrics,
      performance: performanceMetrics,
      summary: this.generateMetricsSummary(systemMetrics, applicationMetrics, performanceMetrics)
    };
  }

  /**
   * Get historical metrics data
   */
  getHistoricalMetrics(options = {}) {
    const {
      startTime = Date.now() - 24 * 60 * 60 * 1000, // 24 hours ago
      endTime = Date.now(),
      collectors = Array.from(this.collectors.keys()),
      aggregation = 'raw' // raw, minute, hour, day
    } = options;

    const data = {};

    collectors.forEach(collectorName => {
      const collectorData = this.dataStore.get(collectorName) || [];
      
      // Filter by time range
      const filteredData = collectorData.filter(entry => 
        entry.timestamp >= startTime && entry.timestamp <= endTime
      );

      // Apply aggregation if requested
      data[collectorName] = this.aggregateData(filteredData, aggregation);
    });

    return {
      startTime,
      endTime,
      aggregation,
      collectors: collectors.length,
      dataPoints: Object.values(data).reduce((sum, arr) => sum + arr.length, 0),
      data
    };
  }

  /**
   * Analyze performance trends and patterns
   */
  async analyzePerformance(options = {}) {
    const analysis = await this.performanceAnalyzer.analyzeAll({
      timeRange: options.timeRange || { 
        start: Date.now() - 24 * 60 * 60 * 1000, 
        end: Date.now() 
      },
      includeAnomaly: options.includeAnomaly !== false,
      includeBottleneck: options.includeBottleneck !== false,
      includeTrend: options.includeTrend !== false
    });

    return {
      timestamp: Date.now(),
      timeRange: options.timeRange,
      analysis,
      recommendations: this.generateRecommendations(analysis),
      alerts: this.getActiveAlerts()
    };
  }

  /**
   * Get dashboard-ready data
   */
  getDashboardData() {
    const currentMetrics = this.getCurrentMetrics();
    const recentTrends = this.getRecentTrends();
    const activeAlerts = this.getActiveAlerts();
    const systemHealth = this.calculateSystemHealth(currentMetrics);

    return {
      timestamp: Date.now(),
      health: systemHealth,
      metrics: currentMetrics,
      trends: recentTrends,
      alerts: activeAlerts,
      collectors: this.getCollectorStatus(),
      summary: {
        totalCollectors: this.collectors.size,
        activeCollectors: Array.from(this.collectors.values()).filter(c => c.enabled).length,
        totalAlerts: activeAlerts.length,
        uptime: this.getUptime(),
        dataPoints: this.getTotalDataPoints()
      }
    };
  }

  /**
   * Private methods
   */

  setupEventHandlers() {
    // Alert manager events
    this.alertManager.on('alert-triggered', (alert) => {
      this.emit('alert', alert);
      this.logger.warn('Performance alert triggered', alert);
    });

    this.alertManager.on('alert-resolved', (alert) => {
      this.emit('alert-resolved', alert);
      this.logger.info('Performance alert resolved', alert);
    });

    // Data processor events
    this.dataProcessor.on('anomaly-detected', (anomaly) => {
      this.emit('anomaly', anomaly);
      this.logger.warn('Performance anomaly detected', anomaly);
    });

    // Performance analyzer events
    this.performanceAnalyzer.on('bottleneck-detected', (bottleneck) => {
      this.emit('bottleneck', bottleneck);
      this.logger.warn('Performance bottleneck detected', bottleneck);
    });
  }

  async initializeCollectors() {
    // Register default system collectors
    const SystemCollector = require('../collectors/SystemCollector');
    const ProcessCollector = require('../collectors/ProcessCollector');
    const NetworkCollector = require('../collectors/NetworkCollector');

    this.registerCollector('system', new SystemCollector());
    this.registerCollector('process', new ProcessCollector());
    this.registerCollector('network', new NetworkCollector());

    // Initialize CLI-specific collectors if available
    try {
      const CLICollector = require('../collectors/CLICollector');
      this.registerCollector('cli', new CLICollector());
    } catch (error) {
      this.logger.debug('CLI collector not available');
    }

    this.logger.info(`Initialized ${this.collectors.size} collectors`);
  }

  async startDataPipeline() {
    await this.dataProcessor.start();
    await this.performanceAnalyzer.start();
    this.logger.info('Data processing pipeline started');
  }

  startCollection() {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
    }

    this.collectionInterval = setInterval(
      () => this.collectMetrics(),
      this.config.monitoring.collectInterval
    );

    this.logger.info(`Started data collection every ${this.config.monitoring.collectInterval}ms`);
  }

  stopCollection() {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = null;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.logger.info('Stopped data collection');
  }

  async stopCollectors() {
    for (const [name, collectorData] of this.collectors.entries()) {
      try {
        if (typeof collectorData.instance.stop === 'function') {
          await collectorData.instance.stop();
        }
      } catch (error) {
        this.logger.error(`Error stopping collector '${name}'`, { error: error.message });
      }
    }
  }

  setupCleanupTasks() {
    // Setup periodic cleanup
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldData();
    }, 60 * 60 * 1000); // Every hour

    this.logger.info('Setup cleanup tasks');
  }

  cleanup() {
    // Clear all stored data
    this.dataStore.clear();
    this.activeMetrics.clear();
    
    // Remove all listeners
    this.removeAllListeners();
  }

  async collectFromCollector(name, collectorData) {
    const startTime = Date.now();
    
    let metrics;
    if (typeof collectorData.instance.collect === 'function') {
      metrics = await collectorData.instance.collect();
    } else if (typeof collectorData.instance === 'function') {
      metrics = await collectorData.instance();
    } else {
      throw new Error(`Collector '${name}' has no collect method`);
    }

    const collectionTime = Date.now() - startTime;
    
    return {
      ...metrics,
      _meta: {
        collector: name,
        collectionTime,
        timestamp: Date.now()
      }
    };
  }

  storeMetrics(collectorName, metrics, timestamp) {
    if (!this.dataStore.has(collectorName)) {
      this.dataStore.set(collectorName, []);
    }

    const data = this.dataStore.get(collectorName);
    data.push({
      timestamp,
      metrics,
      id: `${collectorName}-${timestamp}`
    });

    // Limit data points
    if (data.length > this.config.monitoring.maxDataPoints) {
      data.splice(0, data.length - this.config.monitoring.maxDataPoints);
    }
  }

  async processCollectedData(results) {
    try {
      // Process through data processor
      const processed = await this.dataProcessor.process(results);

      // Check for alerts
      await this.alertManager.checkMetrics(results);

      // Update performance analyzer
      await this.performanceAnalyzer.updateMetrics(processed);

    } catch (error) {
      this.logger.error('Error processing collected data', { error: error.message });
    }
  }

  getSystemMetrics() {
    const systemData = this.dataStore.get('system');
    return systemData ? systemData[systemData.length - 1]?.metrics || {} : {};
  }

  getApplicationMetrics() {
    const processData = this.dataStore.get('process');
    return processData ? processData[processData.length - 1]?.metrics || {} : {};
  }

  getPerformanceMetrics() {
    const networkData = this.dataStore.get('network');
    return networkData ? networkData[networkData.length - 1]?.metrics || {} : {};
  }

  generateMetricsSummary(system, application, performance) {
    return {
      health: this.calculateSystemHealth({ system, application, performance }),
      timestamp: Date.now(),
      key_metrics: {
        cpu_usage: system.cpu?.usage || 0,
        memory_usage: system.memory?.usagePercent || 0,
        disk_usage: system.disk?.usagePercent || 0,
        network_latency: performance.latency || 0,
        error_rate: application.errors?.rate || 0
      }
    };
  }

  aggregateData(data, aggregation) {
    if (aggregation === 'raw') {
      return data;
    }

    // Simple aggregation implementation
    const intervals = {
      minute: 60 * 1000,
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000
    };

    const interval = intervals[aggregation];
    if (!interval) {
      return data;
    }

    const buckets = new Map();
    
    data.forEach(entry => {
      const bucketTime = Math.floor(entry.timestamp / interval) * interval;
      
      if (!buckets.has(bucketTime)) {
        buckets.set(bucketTime, []);
      }
      
      buckets.get(bucketTime).push(entry);
    });

    // Average values in each bucket
    return Array.from(buckets.entries()).map(([timestamp, entries]) => ({
      timestamp,
      metrics: this.averageMetrics(entries.map(e => e.metrics)),
      count: entries.length
    }));
  }

  averageMetrics(metricsArray) {
    if (metricsArray.length === 0) return {};

    const result = {};
    const firstMetrics = metricsArray[0];

    Object.keys(firstMetrics).forEach(key => {
      if (typeof firstMetrics[key] === 'number') {
        result[key] = metricsArray.reduce((sum, m) => sum + (m[key] || 0), 0) / metricsArray.length;
      } else {
        result[key] = firstMetrics[key]; // Keep first non-numeric value
      }
    });

    return result;
  }

  generateRecommendations(analysis) {
    const recommendations = [];

    if (analysis.bottlenecks?.length > 0) {
      recommendations.push({
        type: 'bottleneck',
        priority: 'high',
        message: `Address identified bottlenecks: ${analysis.bottlenecks.join(', ')}`,
        actions: ['Scale resources', 'Optimize algorithms', 'Implement caching']
      });
    }

    if (analysis.anomalies?.length > 0) {
      recommendations.push({
        type: 'anomaly',
        priority: 'medium',
        message: 'Investigate performance anomalies',
        actions: ['Review recent changes', 'Check system logs', 'Monitor trends']
      });
    }

    if (analysis.trends?.declining?.length > 0) {
      recommendations.push({
        type: 'trend',
        priority: 'medium',
        message: 'Performance degradation detected',
        actions: ['Identify root cause', 'Implement optimizations', 'Add monitoring']
      });
    }

    return recommendations;
  }

  getActiveAlerts() {
    return this.alertManager.getActiveAlerts();
  }

  getRecentTrends() {
    // Get trends from the last hour
    const endTime = Date.now();
    const startTime = endTime - 60 * 60 * 1000;

    const trends = {};
    
    for (const [name, data] of this.dataStore.entries()) {
      const recentData = data.filter(entry => 
        entry.timestamp >= startTime && entry.timestamp <= endTime
      );

      if (recentData.length > 1) {
        trends[name] = this.calculateTrend(recentData);
      }
    }

    return trends;
  }

  calculateTrend(data) {
    if (data.length < 2) return { direction: 'stable', change: 0 };

    const first = data[0];
    const last = data[data.length - 1];
    
    // Simple trend calculation for numeric values
    const trend = { direction: 'stable', change: 0, metrics: {} };
    
    Object.keys(last.metrics).forEach(key => {
      if (typeof last.metrics[key] === 'number' && typeof first.metrics[key] === 'number') {
        const change = ((last.metrics[key] - first.metrics[key]) / first.metrics[key]) * 100;
        trend.metrics[key] = {
          change: change,
          direction: change > 5 ? 'increasing' : change < -5 ? 'decreasing' : 'stable'
        };
      }
    });

    return trend;
  }

  calculateSystemHealth(metrics) {
    let healthScore = 100;
    
    const system = metrics.system || {};
    const application = metrics.application || {};

    // CPU health
    const cpuUsage = system.cpu?.usage || 0;
    if (cpuUsage > 90) healthScore -= 30;
    else if (cpuUsage > 80) healthScore -= 15;
    else if (cpuUsage > 70) healthScore -= 5;

    // Memory health
    const memoryUsage = system.memory?.usagePercent || 0;
    if (memoryUsage > 95) healthScore -= 25;
    else if (memoryUsage > 85) healthScore -= 10;
    else if (memoryUsage > 75) healthScore -= 5;

    // Error rate health
    const errorRate = application.errors?.rate || 0;
    if (errorRate > 10) healthScore -= 20;
    else if (errorRate > 5) healthScore -= 10;
    else if (errorRate > 1) healthScore -= 5;

    // Ensure score is between 0 and 100
    healthScore = Math.max(0, Math.min(100, healthScore));

    return {
      score: healthScore,
      status: healthScore >= 80 ? 'healthy' : healthScore >= 60 ? 'warning' : 'critical',
      timestamp: Date.now()
    };
  }

  getCollectorStatus() {
    const status = {};
    
    for (const [name, data] of this.collectors.entries()) {
      status[name] = {
        enabled: data.enabled,
        lastCollection: data.lastCollection,
        errorCount: data.errorCount,
        status: data.enabled && data.errorCount < 5 ? 'active' : 'inactive'
      };
    }
    
    return status;
  }

  getUptime() {
    return this.startTime ? Date.now() - this.startTime : 0;
  }

  getTotalDataPoints() {
    return Array.from(this.dataStore.values()).reduce((total, data) => total + data.length, 0);
  }

  cleanupOldData() {
    const cutoffTime = Date.now() - this.config.monitoring.retentionPeriod;
    let cleanedPoints = 0;

    for (const [name, data] of this.dataStore.entries()) {
      const originalLength = data.length;
      
      // Filter out old data
      const filteredData = data.filter(entry => entry.timestamp >= cutoffTime);
      
      this.dataStore.set(name, filteredData);
      cleanedPoints += originalLength - filteredData.length;
    }

    if (cleanedPoints > 0) {
      this.logger.info(`Cleaned up ${cleanedPoints} old data points`);
    }
  }
}

module.exports = { MonitoringEngine };