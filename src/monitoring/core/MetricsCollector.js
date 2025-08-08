const EventEmitter = require('events');

/**
 * Advanced Metrics Collector with multiple data sources
 * Comprehensive performance monitoring for YOLO-PRO systems
 */
class MetricsCollector extends EventEmitter {
  constructor(config = {}, logger = console) {
    super();

    this.config = {
      collection: {
        enabled: true,
        interval: 5000,
        retentionLimit: 10000,
        enableBuffering: true,
        bufferSize: 100,
        ...config.collection
      },
      sources: {
        system: { enabled: true, weight: 1.0 },
        process: { enabled: true, weight: 1.0 },
        network: { enabled: true, weight: 0.8 },
        cli: { enabled: true, weight: 0.9 },
        git: { enabled: true, weight: 0.7 },
        ...config.sources
      },
      thresholds: {
        cpu: { warning: 70, critical: 90 },
        memory: { warning: 75, critical: 90 },
        disk: { warning: 80, critical: 95 },
        latency: { warning: 1000, critical: 3000 },
        errorRate: { warning: 1, critical: 5 },
        ...config.thresholds
      }
    };

    this.logger = logger;
    this.isActive = false;
    this.buffer = [];
    this.collectors = new Map();
    this.metrics = new Map();
    this.startTime = null;

    this.logger.info('Advanced Metrics Collector initialized', {
      sources: Object.keys(this.config.sources).filter(s => this.config.sources[s].enabled),
      interval: this.config.collection.interval
    });
  }

  /**
   * Start metrics collection
   */
  async start() {
    if (this.isActive) {
      return { success: false, error: 'Already active' };
    }

    try {
      this.logger.info('Starting metrics collection...');

      // Initialize all data sources
      await this.initializeDataSources();

      // Start collection loop
      this.startCollectionLoop();

      this.isActive = true;
      this.startTime = Date.now();
      this.emit('started');

      return {
        success: true,
        startTime: this.startTime,
        sources: Array.from(this.collectors.keys())
      };

    } catch (error) {
      this.logger.error('Failed to start metrics collection', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Stop metrics collection
   */
  async stop() {
    if (!this.isActive) {
      return { success: false, error: 'Not active' };
    }

    try {
      this.logger.info('Stopping metrics collection...');

      // Stop collection loop
      this.stopCollectionLoop();

      // Cleanup data sources
      await this.cleanupDataSources();

      this.isActive = false;
      this.emit('stopped');

      return {
        success: true,
        stopTime: Date.now(),
        totalMetrics: this.getTotalMetricsCount()
      };

    } catch (error) {
      this.logger.error('Error stopping metrics collection', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Collect all metrics from configured sources
   */
  async collectAll() {
    if (!this.isActive) {
      return { success: false, error: 'Collection not active' };
    }

    const timestamp = Date.now();
    const results = {
      timestamp,
      sources: {},
      aggregated: {},
      health: {},
      errors: []
    };

    // Collect from each enabled source
    for (const [sourceName, collector] of this.collectors.entries()) {
      try {
        const sourceConfig = this.config.sources[sourceName];
        if (!sourceConfig?.enabled) {
          continue;
        }

        const metrics = await this.collectFromSource(sourceName, collector);
        
        results.sources[sourceName] = {
          success: true,
          metrics,
          weight: sourceConfig.weight,
          timestamp
        };

        // Store metrics
        this.storeMetrics(sourceName, metrics, timestamp);

      } catch (error) {
        this.logger.warn(`Error collecting from ${sourceName}`, { error: error.message });
        
        results.sources[sourceName] = {
          success: false,
          error: error.message
        };
        results.errors.push({ source: sourceName, error: error.message });
      }
    }

    // Aggregate metrics across sources
    results.aggregated = this.aggregateMetrics(results.sources);

    // Calculate health scores
    results.health = this.calculateHealthScores(results.aggregated);

    // Buffer results if enabled
    if (this.config.collection.enableBuffering) {
      this.bufferResults(results);
    }

    // Emit collection event
    this.emit('metrics-collected', results);

    return results;
  }

  /**
   * Get current performance snapshot
   */
  getCurrentSnapshot() {
    const latest = this.getLatestMetrics();
    const trends = this.calculateTrends();
    const health = this.getHealthStatus();

    return {
      timestamp: Date.now(),
      metrics: latest,
      trends,
      health,
      uptime: this.getUptime(),
      sources: this.getSourceStatus()
    };
  }

  /**
   * Get historical metrics with time range
   */
  getHistoricalData(options = {}) {
    const {
      startTime = Date.now() - 24 * 60 * 60 * 1000, // 24 hours
      endTime = Date.now(),
      sources = Array.from(this.collectors.keys()),
      aggregation = 'minute'
    } = options;

    const data = {};

    sources.forEach(source => {
      const sourceMetrics = this.metrics.get(source) || [];
      
      const filtered = sourceMetrics.filter(entry => 
        entry.timestamp >= startTime && entry.timestamp <= endTime
      );

      data[source] = this.aggregateHistoricalData(filtered, aggregation);
    });

    return {
      startTime,
      endTime,
      aggregation,
      sources: sources.length,
      totalDataPoints: Object.values(data).reduce((sum, arr) => sum + arr.length, 0),
      data
    };
  }

  /**
   * Analyze performance patterns and anomalies
   */
  analyzePatterns(timeRange = 24 * 60 * 60 * 1000) {
    const endTime = Date.now();
    const startTime = endTime - timeRange;

    const analysis = {
      timeRange: { start: startTime, end: endTime },
      patterns: {},
      anomalies: [],
      trends: {},
      bottlenecks: [],
      recommendations: []
    };

    // Analyze each source
    for (const [sourceName, sourceMetrics] of this.metrics.entries()) {
      const data = sourceMetrics.filter(entry => 
        entry.timestamp >= startTime && entry.timestamp <= endTime
      );

      if (data.length === 0) continue;

      // Pattern analysis
      analysis.patterns[sourceName] = this.identifyPatterns(data);

      // Anomaly detection
      const anomalies = this.detectAnomalies(data, sourceName);
      analysis.anomalies.push(...anomalies);

      // Trend analysis
      analysis.trends[sourceName] = this.calculateSourceTrends(data);

      // Bottleneck detection
      const bottlenecks = this.detectBottlenecks(data, sourceName);
      analysis.bottlenecks.push(...bottlenecks);
    }

    // Generate recommendations
    analysis.recommendations = this.generateAnalysisRecommendations(analysis);

    return analysis;
  }

  /**
   * Get real-time performance dashboard data
   */
  getDashboardMetrics() {
    const current = this.getCurrentSnapshot();
    const recent = this.getRecentPerformance();
    const alerts = this.getActiveAlerts();

    return {
      timestamp: Date.now(),
      current: current.metrics,
      health: current.health,
      trends: current.trends,
      recent,
      alerts,
      summary: {
        totalSources: this.collectors.size,
        activeSources: Array.from(this.collectors.values()).filter(c => c.enabled).length,
        uptime: this.getUptime(),
        dataPoints: this.getTotalMetricsCount(),
        healthScore: this.calculateOverallHealth(current.health)
      }
    };
  }

  /**
   * Private Methods
   */

  async initializeDataSources() {
    const SystemCollector = require('../collectors/SystemMetricsCollector');
    const ProcessCollector = require('../collectors/ProcessMetricsCollector');
    const NetworkCollector = require('../collectors/NetworkMetricsCollector');

    // System metrics
    if (this.config.sources.system?.enabled) {
      this.collectors.set('system', {
        instance: new SystemCollector(),
        enabled: true,
        lastCollection: null,
        errorCount: 0
      });
    }

    // Process metrics
    if (this.config.sources.process?.enabled) {
      this.collectors.set('process', {
        instance: new ProcessCollector(),
        enabled: true,
        lastCollection: null,
        errorCount: 0
      });
    }

    // Network metrics
    if (this.config.sources.network?.enabled) {
      this.collectors.set('network', {
        instance: new NetworkCollector(),
        enabled: true,
        lastCollection: null,
        errorCount: 0
      });
    }

    // CLI-specific metrics
    if (this.config.sources.cli?.enabled) {
      try {
        const CLICollector = require('../collectors/CLIMetricsCollector');
        this.collectors.set('cli', {
          instance: new CLICollector(),
          enabled: true,
          lastCollection: null,
          errorCount: 0
        });
      } catch (error) {
        this.logger.debug('CLI metrics collector not available');
      }
    }

    // Git operation metrics
    if (this.config.sources.git?.enabled) {
      try {
        const GitCollector = require('../collectors/GitMetricsCollector');
        this.collectors.set('git', {
          instance: new GitCollector(),
          enabled: true,
          lastCollection: null,
          errorCount: 0
        });
      } catch (error) {
        this.logger.debug('Git metrics collector not available');
      }
    }

    this.logger.info(`Initialized ${this.collectors.size} data sources`);
  }

  startCollectionLoop() {
    if (this.collectionTimer) {
      clearInterval(this.collectionTimer);
    }

    this.collectionTimer = setInterval(
      () => this.collectAll().catch(error => 
        this.logger.error('Collection loop error', { error: error.message })
      ),
      this.config.collection.interval
    );

    this.logger.info(`Started collection loop every ${this.config.collection.interval}ms`);
  }

  stopCollectionLoop() {
    if (this.collectionTimer) {
      clearInterval(this.collectionTimer);
      this.collectionTimer = null;
    }
  }

  async cleanupDataSources() {
    for (const [name, collector] of this.collectors.entries()) {
      try {
        if (typeof collector.instance.cleanup === 'function') {
          await collector.instance.cleanup();
        }
      } catch (error) {
        this.logger.warn(`Error cleaning up ${name}`, { error: error.message });
      }
    }
  }

  async collectFromSource(sourceName, collector) {
    const startTime = Date.now();

    let metrics;
    if (typeof collector.instance.collect === 'function') {
      metrics = await collector.instance.collect();
    } else if (typeof collector.instance.getMetrics === 'function') {
      metrics = await collector.instance.getMetrics();
    } else {
      throw new Error(`No collect method available for ${sourceName}`);
    }

    const collectionTime = Date.now() - startTime;

    return {
      ...metrics,
      _collection: {
        source: sourceName,
        duration: collectionTime,
        timestamp: Date.now()
      }
    };
  }

  storeMetrics(sourceName, metrics, timestamp) {
    if (!this.metrics.has(sourceName)) {
      this.metrics.set(sourceName, []);
    }

    const sourceMetrics = this.metrics.get(sourceName);
    sourceMetrics.push({
      timestamp,
      metrics,
      id: `${sourceName}-${timestamp}`
    });

    // Limit storage
    if (sourceMetrics.length > this.config.collection.retentionLimit) {
      sourceMetrics.splice(0, sourceMetrics.length - this.config.collection.retentionLimit);
    }
  }

  aggregateMetrics(sources) {
    const aggregated = {
      system: {},
      performance: {},
      errors: {},
      network: {},
      cli: {}
    };

    // Weighted aggregation across sources
    Object.entries(sources).forEach(([sourceName, sourceData]) => {
      if (!sourceData.success) return;

      const { metrics, weight } = sourceData;
      const category = this.categorizeMetrics(sourceName);

      // Merge metrics with weighting
      Object.entries(metrics).forEach(([key, value]) => {
        if (typeof value === 'number') {
          if (!aggregated[category][key]) {
            aggregated[category][key] = { total: 0, count: 0 };
          }
          aggregated[category][key].total += value * weight;
          aggregated[category][key].count += weight;
        } else {
          aggregated[category][key] = value;
        }
      });
    });

    // Calculate weighted averages
    Object.keys(aggregated).forEach(category => {
      Object.keys(aggregated[category]).forEach(key => {
        const metric = aggregated[category][key];
        if (metric && typeof metric === 'object' && metric.total !== undefined) {
          aggregated[category][key] = metric.count > 0 ? metric.total / metric.count : 0;
        }
      });
    });

    return aggregated;
  }

  calculateHealthScores(aggregated) {
    const health = {};

    // CPU health
    const cpuUsage = aggregated.system.cpu || 0;
    health.cpu = this.calculateComponentHealth(cpuUsage, this.config.thresholds.cpu);

    // Memory health
    const memoryUsage = aggregated.system.memory || 0;
    health.memory = this.calculateComponentHealth(memoryUsage, this.config.thresholds.memory);

    // Disk health
    const diskUsage = aggregated.system.disk || 0;
    health.disk = this.calculateComponentHealth(diskUsage, this.config.thresholds.disk);

    // Network health
    const latency = aggregated.network.latency || 0;
    health.network = this.calculateComponentHealth(latency, this.config.thresholds.latency, true);

    // Error rate health
    const errorRate = aggregated.errors.rate || 0;
    health.errors = this.calculateComponentHealth(errorRate, this.config.thresholds.errorRate, true);

    // Overall health
    const scores = Object.values(health).map(h => h.score);
    const overallScore = scores.length > 0 ? scores.reduce((a, b) => a + b) / scores.length : 100;
    
    health.overall = {
      score: Math.round(overallScore),
      status: this.getHealthStatus(overallScore),
      timestamp: Date.now()
    };

    return health;
  }

  calculateComponentHealth(value, thresholds, reverse = false) {
    let score = 100;
    let status = 'healthy';

    if (reverse) {
      // For metrics where lower is better (latency, error rate)
      if (value >= thresholds.critical) {
        score = 0;
        status = 'critical';
      } else if (value >= thresholds.warning) {
        score = 50;
        status = 'warning';
      }
    } else {
      // For metrics where higher is worse (CPU, memory usage)
      if (value >= thresholds.critical) {
        score = 0;
        status = 'critical';
      } else if (value >= thresholds.warning) {
        score = 50;
        status = 'warning';
      }
    }

    return {
      value,
      score,
      status,
      thresholds
    };
  }

  bufferResults(results) {
    this.buffer.push({
      timestamp: results.timestamp,
      data: results
    });

    // Limit buffer size
    if (this.buffer.length > this.config.collection.bufferSize) {
      this.buffer.shift();
    }
  }

  getLatestMetrics() {
    const latest = {};
    
    for (const [sourceName, sourceMetrics] of this.metrics.entries()) {
      if (sourceMetrics.length > 0) {
        latest[sourceName] = sourceMetrics[sourceMetrics.length - 1].metrics;
      }
    }

    return latest;
  }

  calculateTrends() {
    const trends = {};
    const timeWindow = 15 * 60 * 1000; // 15 minutes

    for (const [sourceName, sourceMetrics] of this.metrics.entries()) {
      const cutoffTime = Date.now() - timeWindow;
      const recentMetrics = sourceMetrics.filter(m => m.timestamp >= cutoffTime);
      
      if (recentMetrics.length >= 2) {
        trends[sourceName] = this.calculateSourceTrends(recentMetrics);
      }
    }

    return trends;
  }

  getHealthStatus(score = null) {
    if (score === null) {
      const latest = this.getCurrentSnapshot();
      score = latest.health.overall?.score || 0;
    }

    if (score >= 80) return 'healthy';
    if (score >= 60) return 'warning';
    return 'critical';
  }

  categorizeMetrics(sourceName) {
    const categories = {
      system: 'system',
      process: 'performance',
      network: 'network',
      cli: 'cli',
      git: 'performance'
    };

    return categories[sourceName] || 'system';
  }

  calculateSourceTrends(data) {
    if (data.length < 2) {
      return { direction: 'stable', change: 0 };
    }

    const first = data[0];
    const last = data[data.length - 1];
    const trends = {};

    // Calculate trend for each numeric metric
    Object.keys(last.metrics).forEach(key => {
      const firstVal = first.metrics[key];
      const lastVal = last.metrics[key];

      if (typeof firstVal === 'number' && typeof lastVal === 'number' && firstVal !== 0) {
        const change = ((lastVal - firstVal) / firstVal) * 100;
        
        trends[key] = {
          change: parseFloat(change.toFixed(2)),
          direction: Math.abs(change) < 1 ? 'stable' : change > 0 ? 'increasing' : 'decreasing'
        };
      }
    });

    return trends;
  }

  identifyPatterns(data) {
    // Simple pattern identification
    const patterns = {
      cyclical: false,
      spikes: [],
      baseline: {},
      volatility: 'low'
    };

    if (data.length < 10) {
      return patterns;
    }

    // Calculate baseline values
    const numericKeys = this.getNumericKeys(data[0].metrics);
    
    numericKeys.forEach(key => {
      const values = data.map(d => d.metrics[key]).filter(v => typeof v === 'number');
      
      if (values.length > 0) {
        patterns.baseline[key] = {
          min: Math.min(...values),
          max: Math.max(...values),
          avg: values.reduce((a, b) => a + b) / values.length,
          stddev: this.calculateStdDev(values)
        };

        // Detect spikes (values > 2 standard deviations from mean)
        const threshold = patterns.baseline[key].avg + (2 * patterns.baseline[key].stddev);
        const spikes = data.filter(d => d.metrics[key] > threshold);
        
        if (spikes.length > 0) {
          patterns.spikes.push({
            metric: key,
            count: spikes.length,
            timestamps: spikes.map(s => s.timestamp)
          });
        }
      }
    });

    return patterns;
  }

  detectAnomalies(data, sourceName) {
    const anomalies = [];
    
    if (data.length < 10) {
      return anomalies;
    }

    const numericKeys = this.getNumericKeys(data[0].metrics);
    
    numericKeys.forEach(key => {
      const values = data.map(d => d.metrics[key]).filter(v => typeof v === 'number');
      
      if (values.length > 0) {
        const mean = values.reduce((a, b) => a + b) / values.length;
        const stddev = this.calculateStdDev(values);
        const threshold = 2.5; // 2.5 standard deviations

        data.forEach(entry => {
          const value = entry.metrics[key];
          if (typeof value === 'number') {
            const deviation = Math.abs(value - mean) / stddev;
            
            if (deviation > threshold) {
              anomalies.push({
                timestamp: entry.timestamp,
                source: sourceName,
                metric: key,
                value,
                expected: mean,
                deviation,
                severity: deviation > 3 ? 'high' : 'medium'
              });
            }
          }
        });
      }
    });

    return anomalies;
  }

  detectBottlenecks(data, sourceName) {
    const bottlenecks = [];
    
    if (data.length < 5) {
      return bottlenecks;
    }

    // Check for sustained high values
    const sustainedThreshold = 0.8; // 80% of time window
    const sustainedCount = Math.floor(data.length * sustainedThreshold);
    
    const numericKeys = this.getNumericKeys(data[0].metrics);
    
    numericKeys.forEach(key => {
      const thresholds = this.config.thresholds[key];
      if (!thresholds) return;

      const highValues = data.filter(d => {
        const value = d.metrics[key];
        return typeof value === 'number' && value >= thresholds.warning;
      });

      if (highValues.length >= sustainedCount) {
        bottlenecks.push({
          source: sourceName,
          metric: key,
          duration: highValues.length,
          severity: highValues.filter(d => d.metrics[key] >= thresholds.critical).length > 0 ? 'critical' : 'warning',
          avgValue: highValues.reduce((sum, d) => sum + d.metrics[key], 0) / highValues.length
        });
      }
    });

    return bottlenecks;
  }

  generateAnalysisRecommendations(analysis) {
    const recommendations = [];

    // Bottleneck recommendations
    if (analysis.bottlenecks.length > 0) {
      const criticalBottlenecks = analysis.bottlenecks.filter(b => b.severity === 'critical');
      
      if (criticalBottlenecks.length > 0) {
        recommendations.push({
          type: 'bottleneck',
          priority: 'high',
          message: `Critical performance bottlenecks detected in: ${criticalBottlenecks.map(b => b.metric).join(', ')}`,
          actions: [
            'Scale system resources immediately',
            'Optimize critical processes',
            'Implement load balancing',
            'Review system architecture'
          ]
        });
      }
    }

    // Anomaly recommendations
    if (analysis.anomalies.length > 0) {
      const highSeverityAnomalies = analysis.anomalies.filter(a => a.severity === 'high');
      
      if (highSeverityAnomalies.length > 0) {
        recommendations.push({
          type: 'anomaly',
          priority: 'medium',
          message: `Performance anomalies detected requiring investigation`,
          actions: [
            'Review system logs for correlating events',
            'Check for recent deployments or changes',
            'Monitor system stability',
            'Consider implementing alerts'
          ]
        });
      }
    }

    // Pattern-based recommendations
    Object.entries(analysis.patterns).forEach(([source, patterns]) => {
      if (patterns.spikes?.length > 0) {
        recommendations.push({
          type: 'pattern',
          priority: 'low',
          message: `Performance spikes detected in ${source}`,
          actions: [
            'Analyze spike patterns for root causes',
            'Implement spike protection mechanisms',
            'Consider capacity planning'
          ]
        });
      }
    });

    return recommendations;
  }

  aggregateHistoricalData(data, aggregation) {
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
      const values = metricsArray.map(m => m[key]).filter(v => typeof v === 'number');
      
      if (values.length > 0) {
        result[key] = values.reduce((sum, val) => sum + val, 0) / values.length;
      } else {
        result[key] = firstMetrics[key];
      }
    });

    return result;
  }

  getNumericKeys(metrics) {
    return Object.keys(metrics).filter(key => typeof metrics[key] === 'number');
  }

  calculateStdDev(values) {
    const mean = values.reduce((a, b) => a + b) / values.length;
    const squareDiffs = values.map(value => Math.pow(value - mean, 2));
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b) / values.length;
    return Math.sqrt(avgSquareDiff);
  }

  getRecentPerformance() {
    const recentWindow = 5 * 60 * 1000; // 5 minutes
    const cutoffTime = Date.now() - recentWindow;

    const recent = {};
    
    for (const [sourceName, sourceMetrics] of this.metrics.entries()) {
      const recentData = sourceMetrics.filter(m => m.timestamp >= cutoffTime);
      
      if (recentData.length > 0) {
        const latest = recentData[recentData.length - 1].metrics;
        const trend = this.calculateSourceTrends(recentData);
        
        recent[sourceName] = {
          latest,
          trend,
          dataPoints: recentData.length
        };
      }
    }

    return recent;
  }

  getActiveAlerts() {
    const alerts = [];
    const latest = this.getLatestMetrics();

    Object.entries(latest).forEach(([source, metrics]) => {
      Object.entries(metrics).forEach(([key, value]) => {
        const thresholds = this.config.thresholds[key];
        
        if (thresholds && typeof value === 'number') {
          if (value >= thresholds.critical) {
            alerts.push({
              source,
              metric: key,
              value,
              severity: 'critical',
              threshold: thresholds.critical,
              timestamp: Date.now()
            });
          } else if (value >= thresholds.warning) {
            alerts.push({
              source,
              metric: key,
              value,
              severity: 'warning',
              threshold: thresholds.warning,
              timestamp: Date.now()
            });
          }
        }
      });
    });

    return alerts;
  }

  calculateOverallHealth(healthScores) {
    const scores = Object.values(healthScores)
      .filter(h => h && typeof h.score === 'number')
      .map(h => h.score);

    return scores.length > 0 ? scores.reduce((a, b) => a + b) / scores.length : 100;
  }

  getSourceStatus() {
    const status = {};
    
    for (const [name, collector] of this.collectors.entries()) {
      const sourceMetrics = this.metrics.get(name) || [];
      
      status[name] = {
        enabled: collector.enabled,
        lastCollection: collector.lastCollection,
        errorCount: collector.errorCount,
        dataPoints: sourceMetrics.length,
        status: collector.enabled && collector.errorCount < 3 ? 'active' : 'inactive'
      };
    }

    return status;
  }

  getUptime() {
    return this.startTime ? Date.now() - this.startTime : 0;
  }

  getTotalMetricsCount() {
    return Array.from(this.metrics.values()).reduce((total, metrics) => total + metrics.length, 0);
  }
}

module.exports = { MetricsCollector };