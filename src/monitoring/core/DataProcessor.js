const EventEmitter = require('events');

/**
 * Data Processor for Performance Monitoring
 * Advanced data processing, aggregation, and analysis for metrics
 */
class DataProcessor extends EventEmitter {
  constructor(config = {}, logger = console) {
    super();

    this.config = {
      processing: {
        enabled: true,
        batchSize: 100,
        processingInterval: 10000, // 10 seconds
        retentionPeriod: 30 * 24 * 60 * 60 * 1000, // 30 days
        enableRealTime: true,
        ...config.processing
      },
      aggregation: {
        enabled: true,
        intervals: ['minute', 'hour', 'day'],
        windowSizes: {
          minute: 60 * 1000,
          hour: 60 * 60 * 1000,
          day: 24 * 60 * 60 * 1000
        },
        functions: ['avg', 'min', 'max', 'count', 'sum'],
        ...config.aggregation
      },
      anomaly: {
        enabled: true,
        algorithm: 'zscore', // 'zscore', 'iqr', 'isolation'
        threshold: 2.5,
        windowSize: 100,
        minDataPoints: 20,
        ...config.anomaly
      },
      streaming: {
        enabled: true,
        bufferSize: 1000,
        flushInterval: 5000,
        ...config.streaming
      },
      ...config
    };

    this.logger = logger;
    this.isRunning = false;
    this.processingQueue = [];
    this.aggregatedData = new Map();
    this.streamBuffer = [];
    this.processingStats = {
      totalProcessed: 0,
      totalErrors: 0,
      averageProcessingTime: 0,
      lastProcessedAt: null
    };

    this.logger.info('Data Processor initialized', {
      batchSize: this.config.processing.batchSize,
      aggregationEnabled: this.config.aggregation.enabled,
      anomalyDetection: this.config.anomaly.enabled
    });
  }

  /**
   * Start data processing pipeline
   */
  async start() {
    if (this.isRunning) {
      return { success: false, error: 'Already running' };
    }

    try {
      this.logger.info('Starting data processing pipeline...');

      // Initialize processing components
      await this.initializeComponents();

      // Start processing loops
      this.startProcessingLoop();
      
      if (this.config.streaming.enabled) {
        this.startStreamingLoop();
      }

      this.isRunning = true;
      this.emit('started');

      return {
        success: true,
        startTime: Date.now(),
        config: this.config
      };

    } catch (error) {
      this.logger.error('Failed to start data processor', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Stop data processing pipeline
   */
  async stop() {
    if (!this.isRunning) {
      return { success: false, error: 'Not running' };
    }

    try {
      this.logger.info('Stopping data processing pipeline...');

      // Stop processing loops
      this.stopProcessingLoop();
      this.stopStreamingLoop();

      // Process remaining data
      await this.flushPendingData();

      this.isRunning = false;
      this.emit('stopped');

      return {
        success: true,
        stopTime: Date.now(),
        stats: this.getProcessingStats()
      };

    } catch (error) {
      this.logger.error('Error stopping data processor', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Process metrics data
   */
  async process(metricsData) {
    if (!this.isRunning) {
      return { success: false, error: 'Processor not running' };
    }

    const startTime = Date.now();

    try {
      const processed = {
        timestamp: metricsData.timestamp,
        processed: true,
        sources: {},
        aggregated: {},
        anomalies: [],
        insights: {}
      };

      // Process each data source
      for (const [sourceName, sourceData] of Object.entries(metricsData.sources || {})) {
        if (!sourceData.success) {
          processed.sources[sourceName] = {
            success: false,
            error: sourceData.error
          };
          continue;
        }

        try {
          const processedSource = await this.processSourceData(sourceName, sourceData, metricsData.timestamp);
          processed.sources[sourceName] = processedSource;

          // Aggregate data if enabled
          if (this.config.aggregation.enabled) {
            this.aggregateSourceData(sourceName, processedSource, metricsData.timestamp);
          }

          // Detect anomalies if enabled
          if (this.config.anomaly.enabled) {
            const anomalies = await this.detectAnomalies(sourceName, processedSource);
            processed.anomalies.push(...anomalies);
          }

        } catch (error) {
          this.logger.warn(`Error processing source ${sourceName}`, { error: error.message });
          processed.sources[sourceName] = {
            success: false,
            error: error.message
          };
        }
      }

      // Generate aggregated insights
      processed.aggregated = this.generateAggregatedMetrics(processed.sources);
      processed.insights = this.generateInsights(processed);

      // Update processing stats
      this.updateProcessingStats(Date.now() - startTime);

      // Add to streaming buffer if enabled
      if (this.config.streaming.enabled) {
        this.addToStreamBuffer(processed);
      }

      return processed;

    } catch (error) {
      this.logger.error('Error processing metrics data', { error: error.message });
      this.processingStats.totalErrors++;
      return {
        timestamp: metricsData.timestamp,
        processed: false,
        error: error.message
      };
    }
  }

  /**
   * Get aggregated data for time range
   */
  getAggregatedData(options = {}) {
    const {
      startTime = Date.now() - 24 * 60 * 60 * 1000, // 24 hours
      endTime = Date.now(),
      interval = 'hour',
      sources = null,
      metrics = null
    } = options;

    const results = {
      startTime,
      endTime,
      interval,
      data: {}
    };

    // Get data for each source
    for (const [sourceName, sourceData] of this.aggregatedData.entries()) {
      // Skip if source not requested
      if (sources && !sources.includes(sourceName)) {
        continue;
      }

      const intervalData = sourceData.get(interval) || [];
      
      // Filter by time range
      const filteredData = intervalData.filter(entry => 
        entry.timestamp >= startTime && entry.timestamp <= endTime
      );

      // Filter by specific metrics if requested
      if (metrics) {
        results.data[sourceName] = filteredData.map(entry => ({
          timestamp: entry.timestamp,
          metrics: this.filterMetrics(entry.metrics, metrics)
        }));
      } else {
        results.data[sourceName] = filteredData;
      }
    }

    return results;
  }

  /**
   * Detect patterns in historical data
   */
  async detectPatterns(options = {}) {
    const {
      timeRange = 7 * 24 * 60 * 60 * 1000, // 7 days
      sources = Array.from(this.aggregatedData.keys()),
      patternTypes = ['trend', 'seasonal', 'cyclical', 'spike']
    } = options;

    const endTime = Date.now();
    const startTime = endTime - timeRange;

    const patterns = {
      timestamp: Date.now(),
      timeRange: { start: startTime, end: endTime },
      sources: {},
      summary: {
        totalPatterns: 0,
        byType: {},
        significance: 'low'
      }
    };

    // Analyze patterns for each source
    for (const sourceName of sources) {
      const sourceData = this.getSourceDataForRange(sourceName, startTime, endTime);
      
      if (sourceData.length < 10) {
        continue; // Insufficient data
      }

      const sourcePatterns = {
        trends: [],
        seasonal: [],
        cyclical: [],
        spikes: []
      };

      // Detect different pattern types
      if (patternTypes.includes('trend')) {
        sourcePatterns.trends = this.detectTrendPatterns(sourceData);
      }

      if (patternTypes.includes('seasonal')) {
        sourcePatterns.seasonal = this.detectSeasonalPatterns(sourceData);
      }

      if (patternTypes.includes('cyclical')) {
        sourcePatterns.cyclical = this.detectCyclicalPatterns(sourceData);
      }

      if (patternTypes.includes('spike')) {
        sourcePatterns.spikes = this.detectSpikePatterns(sourceData);
      }

      patterns.sources[sourceName] = sourcePatterns;

      // Update summary
      Object.entries(sourcePatterns).forEach(([type, patternList]) => {
        patterns.summary.totalPatterns += patternList.length;
        patterns.summary.byType[type] = (patterns.summary.byType[type] || 0) + patternList.length;
      });
    }

    // Determine overall significance
    if (patterns.summary.totalPatterns > 10) {
      patterns.summary.significance = 'high';
    } else if (patterns.summary.totalPatterns > 3) {
      patterns.summary.significance = 'medium';
    }

    return patterns;
  }

  /**
   * Get real-time processing metrics
   */
  getProcessingStats() {
    return {
      ...this.processingStats,
      isRunning: this.isRunning,
      queueSize: this.processingQueue.length,
      bufferSize: this.streamBuffer.length,
      aggregatedSources: this.aggregatedData.size,
      timestamp: Date.now()
    };
  }

  /**
   * Get streaming buffer data
   */
  getStreamBuffer(limit = 100) {
    return {
      size: this.streamBuffer.length,
      data: this.streamBuffer.slice(-limit)
    };
  }

  /**
   * Clear processed data older than retention period
   */
  cleanup() {
    const cutoffTime = Date.now() - this.config.processing.retentionPeriod;
    let cleanedCount = 0;

    // Clean aggregated data
    for (const [sourceName, sourceData] of this.aggregatedData.entries()) {
      for (const [interval, intervalData] of sourceData.entries()) {
        const originalSize = intervalData.length;
        const filteredData = intervalData.filter(entry => entry.timestamp >= cutoffTime);
        
        sourceData.set(interval, filteredData);
        cleanedCount += originalSize - filteredData.length;
      }
    }

    // Clean stream buffer
    const originalBufferSize = this.streamBuffer.length;
    this.streamBuffer = this.streamBuffer.filter(entry => entry.timestamp >= cutoffTime);
    cleanedCount += originalBufferSize - this.streamBuffer.length;

    if (cleanedCount > 0) {
      this.logger.info(`Cleaned up ${cleanedCount} old data entries`);
    }

    return { cleanedCount };
  }

  /**
   * Private Methods
   */

  async initializeComponents() {
    // Initialize aggregation storage
    this.config.aggregation.intervals.forEach(interval => {
      if (!this.aggregatedData.has(interval)) {
        this.aggregatedData.set(interval, new Map());
      }
    });

    this.logger.info('Data processor components initialized');
  }

  startProcessingLoop() {
    if (this.processingTimer) {
      clearInterval(this.processingTimer);
    }

    this.processingTimer = setInterval(
      () => this.processQueue(),
      this.config.processing.processingInterval
    );

    this.logger.info(`Started processing loop every ${this.config.processing.processingInterval}ms`);
  }

  startStreamingLoop() {
    if (this.streamingTimer) {
      clearInterval(this.streamingTimer);
    }

    this.streamingTimer = setInterval(
      () => this.flushStreamBuffer(),
      this.config.streaming.flushInterval
    );

    this.logger.info(`Started streaming loop every ${this.config.streaming.flushInterval}ms`);
  }

  stopProcessingLoop() {
    if (this.processingTimer) {
      clearInterval(this.processingTimer);
      this.processingTimer = null;
    }
  }

  stopStreamingLoop() {
    if (this.streamingTimer) {
      clearInterval(this.streamingTimer);
      this.streamingTimer = null;
    }
  }

  async processQueue() {
    if (this.processingQueue.length === 0) {
      return;
    }

    const batch = this.processingQueue.splice(0, this.config.processing.batchSize);
    
    try {
      for (const item of batch) {
        await this.processQueueItem(item);
      }
    } catch (error) {
      this.logger.error('Error processing queue batch', { error: error.message });
    }
  }

  async processQueueItem(item) {
    // Process individual queue items
    // Implementation depends on specific requirements
  }

  async processSourceData(sourceName, sourceData, timestamp) {
    const processed = {
      source: sourceName,
      timestamp,
      metrics: {},
      metadata: {
        processingTime: Date.now(),
        dataPoints: 0,
        quality: 'good'
      }
    };

    // Extract and clean metrics
    const rawMetrics = sourceData.metrics || {};
    
    Object.entries(rawMetrics).forEach(([key, value]) => {
      // Clean and validate metric values
      const cleanedValue = this.cleanMetricValue(key, value);
      
      if (cleanedValue !== null) {
        processed.metrics[key] = cleanedValue;
        processed.metadata.dataPoints++;
      }
    });

    // Calculate derived metrics
    processed.metrics = {
      ...processed.metrics,
      ...this.calculateDerivedMetrics(processed.metrics, sourceName)
    };

    // Assess data quality
    processed.metadata.quality = this.assessDataQuality(processed.metrics);

    return processed;
  }

  cleanMetricValue(key, value) {
    // Handle different data types and clean invalid values
    if (typeof value === 'number') {
      if (isNaN(value) || !isFinite(value)) {
        return null;
      }
      
      // Apply reasonable bounds
      const bounds = this.getMetricBounds(key);
      if (bounds) {
        return Math.max(bounds.min, Math.min(bounds.max, value));
      }
      
      return value;
    }

    if (typeof value === 'string') {
      const numericValue = parseFloat(value);
      if (!isNaN(numericValue) && isFinite(numericValue)) {
        return numericValue;
      }
    }

    if (typeof value === 'boolean') {
      return value ? 1 : 0;
    }

    return null;
  }

  getMetricBounds(key) {
    const bounds = {
      cpu: { min: 0, max: 100 },
      memory: { min: 0, max: 100 },
      disk: { min: 0, max: 100 },
      latency: { min: 0, max: 60000 }, // 1 minute max
      errorRate: { min: 0, max: 100 }
    };

    return bounds[key] || null;
  }

  calculateDerivedMetrics(metrics, sourceName) {
    const derived = {};

    // Calculate utilization metrics
    if (metrics.cpu !== undefined && metrics.memory !== undefined) {
      derived.resourceUtilization = (metrics.cpu + metrics.memory) / 2;
    }

    // Calculate health score
    derived.healthScore = this.calculateHealthScore(metrics);

    // Calculate trend indicators
    derived.trend = this.calculateTrendIndicator(sourceName, metrics);

    return derived;
  }

  calculateHealthScore(metrics) {
    let score = 100;
    
    // Penalize high resource usage
    if (metrics.cpu > 80) score -= (metrics.cpu - 80) * 2;
    if (metrics.memory > 80) score -= (metrics.memory - 80) * 2;
    if (metrics.disk > 90) score -= (metrics.disk - 90) * 5;
    
    // Penalize high latency
    if (metrics.latency > 1000) score -= Math.min(50, (metrics.latency - 1000) / 100);
    
    // Penalize errors
    if (metrics.errorRate > 0) score -= metrics.errorRate * 5;

    return Math.max(0, Math.min(100, score));
  }

  calculateTrendIndicator(sourceName, currentMetrics) {
    // Simple trend calculation based on recent history
    // This would typically use historical data
    return 'stable'; // Placeholder
  }

  assessDataQuality(metrics) {
    const totalMetrics = Object.keys(metrics).length;
    const validMetrics = Object.values(metrics).filter(v => v !== null && v !== undefined).length;
    
    const completeness = validMetrics / Math.max(1, totalMetrics);
    
    if (completeness >= 0.9) return 'excellent';
    if (completeness >= 0.7) return 'good';
    if (completeness >= 0.5) return 'fair';
    return 'poor';
  }

  aggregateSourceData(sourceName, processedData, timestamp) {
    this.config.aggregation.intervals.forEach(interval => {
      const windowSize = this.config.aggregation.windowSizes[interval];
      const bucketTime = Math.floor(timestamp / windowSize) * windowSize;
      
      // Get or create aggregation data for this source
      if (!this.aggregatedData.has(sourceName)) {
        this.aggregatedData.set(sourceName, new Map());
      }
      
      const sourceData = this.aggregatedData.get(sourceName);
      
      if (!sourceData.has(interval)) {
        sourceData.set(interval, []);
      }
      
      const intervalData = sourceData.get(interval);
      
      // Find or create bucket
      let bucket = intervalData.find(b => b.timestamp === bucketTime);
      
      if (!bucket) {
        bucket = {
          timestamp: bucketTime,
          count: 0,
          metrics: {},
          metadata: {
            interval,
            windowSize,
            dataQuality: []
          }
        };
        intervalData.push(bucket);
        
        // Keep data sorted and limit size
        intervalData.sort((a, b) => a.timestamp - b.timestamp);
        if (intervalData.length > 1000) {
          intervalData.splice(0, intervalData.length - 1000);
        }
      }
      
      // Aggregate metrics
      this.aggregateMetricsIntoBucket(bucket, processedData.metrics);
      bucket.count++;
      bucket.metadata.dataQuality.push(processedData.metadata.quality);
    });
  }

  aggregateMetricsIntoBucket(bucket, metrics) {
    Object.entries(metrics).forEach(([key, value]) => {
      if (typeof value !== 'number') return;
      
      if (!bucket.metrics[key]) {
        bucket.metrics[key] = {
          sum: 0,
          count: 0,
          min: value,
          max: value,
          avg: 0
        };
      }
      
      const metric = bucket.metrics[key];
      metric.sum += value;
      metric.count++;
      metric.min = Math.min(metric.min, value);
      metric.max = Math.max(metric.max, value);
      metric.avg = metric.sum / metric.count;
    });
  }

  async detectAnomalies(sourceName, processedData) {
    const anomalies = [];
    
    if (!this.config.anomaly.enabled) {
      return anomalies;
    }

    // Get historical data for comparison
    const historicalData = this.getRecentHistoricalData(sourceName, this.config.anomaly.windowSize);
    
    if (historicalData.length < this.config.anomaly.minDataPoints) {
      return anomalies; // Insufficient data
    }

    // Check each metric for anomalies
    Object.entries(processedData.metrics).forEach(([metric, value]) => {
      if (typeof value !== 'number') return;
      
      const anomaly = this.detectMetricAnomaly(sourceName, metric, value, historicalData);
      
      if (anomaly) {
        anomalies.push({
          timestamp: processedData.timestamp,
          source: sourceName,
          metric,
          value,
          expectedRange: anomaly.expectedRange,
          deviation: anomaly.deviation,
          severity: anomaly.severity,
          algorithm: this.config.anomaly.algorithm
        });
      }
    });

    return anomalies;
  }

  detectMetricAnomaly(sourceName, metric, currentValue, historicalData) {
    // Extract historical values for this metric
    const historicalValues = historicalData
      .map(d => d.metrics[metric])
      .filter(v => typeof v === 'number' && isFinite(v));

    if (historicalValues.length < this.config.anomaly.minDataPoints) {
      return null;
    }

    switch (this.config.anomaly.algorithm) {
      case 'zscore':
        return this.detectZScoreAnomaly(currentValue, historicalValues);
      case 'iqr':
        return this.detectIQRAnomaly(currentValue, historicalValues);
      case 'isolation':
        return this.detectIsolationAnomaly(currentValue, historicalValues);
      default:
        return this.detectZScoreAnomaly(currentValue, historicalValues);
    }
  }

  detectZScoreAnomaly(value, historicalValues) {
    const mean = historicalValues.reduce((a, b) => a + b) / historicalValues.length;
    const variance = historicalValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / historicalValues.length;
    const stdDev = Math.sqrt(variance);
    
    if (stdDev === 0) return null; // No variance
    
    const zScore = Math.abs(value - mean) / stdDev;
    
    if (zScore > this.config.anomaly.threshold) {
      return {
        expectedRange: {
          min: mean - this.config.anomaly.threshold * stdDev,
          max: mean + this.config.anomaly.threshold * stdDev
        },
        deviation: zScore,
        severity: zScore > 3 ? 'high' : 'medium'
      };
    }
    
    return null;
  }

  detectIQRAnomaly(value, historicalValues) {
    const sorted = [...historicalValues].sort((a, b) => a - b);
    const q1 = this.quantile(sorted, 0.25);
    const q3 = this.quantile(sorted, 0.75);
    const iqr = q3 - q1;
    
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    
    if (value < lowerBound || value > upperBound) {
      return {
        expectedRange: {
          min: lowerBound,
          max: upperBound
        },
        deviation: Math.min(Math.abs(value - lowerBound), Math.abs(value - upperBound)) / iqr,
        severity: value < q1 - 3 * iqr || value > q3 + 3 * iqr ? 'high' : 'medium'
      };
    }
    
    return null;
  }

  detectIsolationAnomaly(value, historicalValues) {
    // Simplified isolation forest implementation
    // In practice, you'd use a more sophisticated algorithm
    const mean = historicalValues.reduce((a, b) => a + b) / historicalValues.length;
    const deviation = Math.abs(value - mean);
    const maxDeviation = Math.max(...historicalValues.map(v => Math.abs(v - mean)));
    
    const isolationScore = deviation / maxDeviation;
    
    if (isolationScore > 0.7) {
      return {
        expectedRange: {
          min: Math.min(...historicalValues),
          max: Math.max(...historicalValues)
        },
        deviation: isolationScore,
        severity: isolationScore > 0.9 ? 'high' : 'medium'
      };
    }
    
    return null;
  }

  quantile(sortedArray, q) {
    const index = (sortedArray.length - 1) * q;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;
    
    if (sortedArray[upper] !== undefined) {
      return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
    }
    
    return sortedArray[lower];
  }

  generateAggregatedMetrics(sources) {
    const aggregated = {
      timestamp: Date.now(),
      totalSources: Object.keys(sources).length,
      successfulSources: Object.values(sources).filter(s => s.success).length,
      overallHealth: 0,
      keyMetrics: {}
    };

    const successfulSources = Object.values(sources).filter(s => s.success);
    
    if (successfulSources.length === 0) {
      return aggregated;
    }

    // Calculate overall health
    const healthScores = successfulSources
      .map(s => s.metrics.healthScore)
      .filter(h => typeof h === 'number');
    
    if (healthScores.length > 0) {
      aggregated.overallHealth = healthScores.reduce((a, b) => a + b) / healthScores.length;
    }

    // Aggregate key metrics
    const metricKeys = [...new Set(successfulSources.flatMap(s => Object.keys(s.metrics)))];
    
    metricKeys.forEach(key => {
      const values = successfulSources
        .map(s => s.metrics[key])
        .filter(v => typeof v === 'number');
      
      if (values.length > 0) {
        aggregated.keyMetrics[key] = {
          avg: values.reduce((a, b) => a + b) / values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          count: values.length
        };
      }
    });

    return aggregated;
  }

  generateInsights(processedData) {
    const insights = {
      timestamp: processedData.timestamp,
      quality: 'good',
      recommendations: [],
      alerts: [],
      trends: {}
    };

    // Analyze data quality
    const qualityScores = Object.values(processedData.sources)
      .filter(s => s.success && s.metadata)
      .map(s => s.metadata.quality);

    if (qualityScores.includes('poor')) {
      insights.quality = 'poor';
      insights.recommendations.push('Investigate data quality issues in some sources');
    } else if (qualityScores.includes('fair')) {
      insights.quality = 'fair';
    }

    // Check for performance issues
    if (processedData.aggregated.overallHealth < 70) {
      insights.alerts.push({
        type: 'performance',
        severity: 'warning',
        message: `Overall system health is ${processedData.aggregated.overallHealth.toFixed(1)}%`
      });
    }

    // Generate recommendations based on anomalies
    if (processedData.anomalies.length > 0) {
      const highSeverityAnomalies = processedData.anomalies.filter(a => a.severity === 'high');
      
      if (highSeverityAnomalies.length > 0) {
        insights.recommendations.push('Investigate high-severity performance anomalies');
      }
    }

    return insights;
  }

  addToStreamBuffer(data) {
    this.streamBuffer.push({
      timestamp: Date.now(),
      data
    });

    // Limit buffer size
    if (this.streamBuffer.length > this.config.streaming.bufferSize) {
      this.streamBuffer.shift();
    }
  }

  flushStreamBuffer() {
    if (this.streamBuffer.length === 0) {
      return;
    }

    const data = [...this.streamBuffer];
    this.streamBuffer = [];

    this.emit('stream-flush', {
      timestamp: Date.now(),
      size: data.length,
      data
    });
  }

  async flushPendingData() {
    // Process remaining queue items
    if (this.processingQueue.length > 0) {
      await this.processQueue();
    }

    // Flush stream buffer
    this.flushStreamBuffer();
  }

  updateProcessingStats(processingTime) {
    this.processingStats.totalProcessed++;
    this.processingStats.lastProcessedAt = Date.now();
    
    // Update average processing time
    const currentAvg = this.processingStats.averageProcessingTime;
    const totalProcessed = this.processingStats.totalProcessed;
    
    this.processingStats.averageProcessingTime = 
      ((currentAvg * (totalProcessed - 1)) + processingTime) / totalProcessed;
  }

  getRecentHistoricalData(sourceName, windowSize) {
    // Get recent data from aggregated storage
    const sourceData = this.aggregatedData.get(sourceName);
    if (!sourceData) return [];

    const minuteData = sourceData.get('minute') || [];
    
    // Return the most recent entries up to windowSize
    return minuteData.slice(-windowSize);
  }

  getSourceDataForRange(sourceName, startTime, endTime) {
    const sourceData = this.aggregatedData.get(sourceName);
    if (!sourceData) return [];

    // Try to get data from appropriate interval
    const intervals = ['minute', 'hour', 'day'];
    
    for (const interval of intervals) {
      const intervalData = sourceData.get(interval) || [];
      const filtered = intervalData.filter(entry => 
        entry.timestamp >= startTime && entry.timestamp <= endTime
      );
      
      if (filtered.length >= 10) {
        return filtered;
      }
    }

    return [];
  }

  filterMetrics(metrics, requestedMetrics) {
    const filtered = {};
    
    requestedMetrics.forEach(metric => {
      if (metrics[metric] !== undefined) {
        filtered[metric] = metrics[metric];
      }
    });
    
    return filtered;
  }

  // Pattern detection methods
  detectTrendPatterns(data) {
    const trends = [];
    
    if (data.length < 5) return trends;

    // Simple linear regression for trend detection
    const numericKeys = this.getNumericKeys(data[0].metrics);
    
    numericKeys.forEach(key => {
      const values = data.map((d, i) => ({ x: i, y: d.metrics[key] }))
        .filter(point => typeof point.y === 'number');

      if (values.length < 5) return;

      const regression = this.calculateLinearRegression(values);
      
      if (Math.abs(regression.slope) > 0.1) { // Significant trend
        trends.push({
          metric: key,
          type: 'linear',
          direction: regression.slope > 0 ? 'increasing' : 'decreasing',
          strength: Math.abs(regression.r2),
          slope: regression.slope,
          significance: Math.abs(regression.slope) > 0.5 ? 'high' : 'medium'
        });
      }
    });

    return trends;
  }

  detectSeasonalPatterns(data) {
    // Placeholder for seasonal pattern detection
    // Would implement FFT or autocorrelation analysis
    return [];
  }

  detectCyclicalPatterns(data) {
    // Placeholder for cyclical pattern detection
    return [];
  }

  detectSpikePatterns(data) {
    const spikes = [];
    
    if (data.length < 10) return spikes;

    const numericKeys = this.getNumericKeys(data[0].metrics);
    
    numericKeys.forEach(key => {
      const values = data.map(d => d.metrics[key]).filter(v => typeof v === 'number');
      
      if (values.length < 10) return;

      const mean = values.reduce((a, b) => a + b) / values.length;
      const stdDev = Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length);
      
      const threshold = mean + 3 * stdDev;
      
      data.forEach((entry, index) => {
        const value = entry.metrics[key];
        
        if (typeof value === 'number' && value > threshold) {
          spikes.push({
            metric: key,
            timestamp: entry.timestamp,
            value,
            threshold,
            deviation: (value - mean) / stdDev,
            index
          });
        }
      });
    });

    return spikes;
  }

  calculateLinearRegression(points) {
    const n = points.length;
    const sumX = points.reduce((sum, p) => sum + p.x, 0);
    const sumY = points.reduce((sum, p) => sum + p.y, 0);
    const sumXY = points.reduce((sum, p) => sum + (p.x * p.y), 0);
    const sumXX = points.reduce((sum, p) => sum + (p.x * p.x), 0);
    const sumYY = points.reduce((sum, p) => sum + (p.y * p.y), 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Calculate R-squared
    const meanY = sumY / n;
    const totalSumSquares = sumYY - n * meanY * meanY;
    const residualSumSquares = points.reduce((sum, p) => {
      const predicted = slope * p.x + intercept;
      return sum + Math.pow(p.y - predicted, 2);
    }, 0);
    
    const r2 = 1 - (residualSumSquares / totalSumSquares);

    return { slope, intercept, r2 };
  }

  getNumericKeys(metrics) {
    return Object.keys(metrics).filter(key => typeof metrics[key] === 'number');
  }
}

module.exports = { DataProcessor };