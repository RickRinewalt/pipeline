/**
 * Comprehensive metrics collection for GitHub client
 */
class MetricsCollector {
  constructor(options = {}) {
    this.config = {
      trackingEnabled: options.trackingEnabled !== false,
      historySize: options.historySize || 1000,
      ...options
    };

    this.reset();
  }

  /**
   * Reset all metrics
   */
  reset() {
    this.metrics = {
      requests: {
        total: 0,
        successful: 0,
        failed: 0,
        byMethod: {},
        byStatus: {},
        byEndpoint: {}
      },
      responses: {
        totalTime: 0,
        averageTime: 0,
        minTime: Infinity,
        maxTime: 0,
        timeouts: 0
      },
      errors: {
        total: 0,
        byType: {},
        byMessage: {},
        retryable: 0,
        nonRetryable: 0
      },
      cache: {
        hits: 0,
        misses: 0,
        hitRate: 0
      },
      rateLimit: {
        delays: 0,
        totalDelayTime: 0,
        averageDelay: 0
      }
    };

    this.history = [];
    this.startTime = Date.now();
  }

  /**
   * Record a request
   */
  recordRequest(method, endpoint) {
    if (!this.config.trackingEnabled) return;

    this.metrics.requests.total++;
    this.metrics.requests.byMethod[method] = (this.metrics.requests.byMethod[method] || 0) + 1;
    
    const cleanEndpoint = this.sanitizeEndpoint(endpoint);
    this.metrics.requests.byEndpoint[cleanEndpoint] = (this.metrics.requests.byEndpoint[cleanEndpoint] || 0) + 1;

    this.addToHistory('request', {
      method,
      endpoint: cleanEndpoint,
      timestamp: Date.now()
    });
  }

  /**
   * Record a response
   */
  recordResponse(status, responseTime) {
    if (!this.config.trackingEnabled) return;

    this.metrics.responses.totalTime += responseTime;
    this.metrics.responses.minTime = Math.min(this.metrics.responses.minTime, responseTime);
    this.metrics.responses.maxTime = Math.max(this.metrics.responses.maxTime, responseTime);
    
    // Calculate rolling average
    const totalRequests = this.metrics.requests.total;
    this.metrics.responses.averageTime = totalRequests > 0 
      ? this.metrics.responses.totalTime / totalRequests 
      : 0;

    // Track status codes
    this.metrics.requests.byStatus[status] = (this.metrics.requests.byStatus[status] || 0) + 1;

    if (status >= 200 && status < 400) {
      this.metrics.requests.successful++;
    } else {
      this.metrics.requests.failed++;
    }

    this.addToHistory('response', {
      status,
      responseTime,
      timestamp: Date.now()
    });
  }

  /**
   * Record an error
   */
  recordError(message, method = 'UNKNOWN', endpoint = '') {
    if (!this.config.trackingEnabled) return;

    this.metrics.errors.total++;
    this.metrics.errors.byMessage[message] = (this.metrics.errors.byMessage[message] || 0) + 1;

    // Classify error type
    const errorType = this.classifyError(message);
    this.metrics.errors.byType[errorType] = (this.metrics.errors.byType[errorType] || 0) + 1;

    // Track if error is retryable
    if (this.isRetryableError(message)) {
      this.metrics.errors.retryable++;
    } else {
      this.metrics.errors.nonRetryable++;
    }

    this.addToHistory('error', {
      message,
      method,
      endpoint: this.sanitizeEndpoint(endpoint),
      type: errorType,
      timestamp: Date.now()
    });
  }

  /**
   * Record cache hit
   */
  recordCacheHit() {
    if (!this.config.trackingEnabled) return;

    this.metrics.cache.hits++;
    this.updateCacheHitRate();
  }

  /**
   * Record cache miss
   */
  recordCacheMiss() {
    if (!this.config.trackingEnabled) return;

    this.metrics.cache.misses++;
    this.updateCacheHitRate();
  }

  /**
   * Record rate limit delay
   */
  recordRateLimitDelay(delayTime) {
    if (!this.config.trackingEnabled) return;

    this.metrics.rateLimit.delays++;
    this.metrics.rateLimit.totalDelayTime += delayTime;
    this.metrics.rateLimit.averageDelay = this.metrics.rateLimit.totalDelayTime / this.metrics.rateLimit.delays;

    this.addToHistory('rateLimit', {
      delayTime,
      timestamp: Date.now()
    });
  }

  /**
   * Update cache hit rate
   */
  updateCacheHitRate() {
    const total = this.metrics.cache.hits + this.metrics.cache.misses;
    this.metrics.cache.hitRate = total > 0 
      ? parseFloat(((this.metrics.cache.hits / total) * 100).toFixed(2))
      : 0;
  }

  /**
   * Sanitize endpoint for metrics (remove dynamic parts)
   */
  sanitizeEndpoint(endpoint) {
    return endpoint
      .replace(/\/\d+/g, '/{id}') // Replace numeric IDs
      .replace(/\/[a-f0-9]{40}/g, '/{sha}') // Replace SHA hashes
      .replace(/\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\/pulls\/\d+/g, '/{owner}/{repo}/pulls/{id}')
      .replace(/\/repos\/[^\/]+\/[^\/]+/g, '/repos/{owner}/{repo}')
      .replace(/\/users\/[^\/]+/g, '/users/{username}')
      .replace(/\/orgs\/[^\/]+/g, '/orgs/{org}');
  }

  /**
   * Classify error type
   */
  classifyError(message) {
    if (message.includes('timeout')) return 'TIMEOUT';
    if (message.includes('rate limit') || message.includes('403')) return 'RATE_LIMIT';
    if (message.includes('404')) return 'NOT_FOUND';
    if (message.includes('401') || message.includes('unauthorized')) return 'AUTHENTICATION';
    if (message.includes('network') || message.includes('ENOTFOUND')) return 'NETWORK';
    if (message.includes('500') || message.includes('502') || message.includes('503')) return 'SERVER_ERROR';
    return 'UNKNOWN';
  }

  /**
   * Check if error is retryable
   */
  isRetryableError(message) {
    const retryableTypes = ['TIMEOUT', 'RATE_LIMIT', 'NETWORK', 'SERVER_ERROR'];
    const errorType = this.classifyError(message);
    return retryableTypes.includes(errorType);
  }

  /**
   * Add event to history
   */
  addToHistory(type, data) {
    const event = {
      type,
      data,
      id: this.generateEventId()
    };

    this.history.push(event);

    // Maintain history size limit
    if (this.history.length > this.config.historySize) {
      this.history.shift();
    }
  }

  /**
   * Generate unique event ID
   */
  generateEventId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get comprehensive statistics
   */
  getStats() {
    const uptime = Date.now() - this.startTime;
    const requestsPerSecond = this.metrics.requests.total > 0 
      ? (this.metrics.requests.total / (uptime / 1000)).toFixed(2)
      : '0.00';

    return {
      uptime: {
        milliseconds: uptime,
        seconds: Math.floor(uptime / 1000),
        minutes: Math.floor(uptime / 60000),
        hours: Math.floor(uptime / 3600000)
      },
      requests: {
        ...this.metrics.requests,
        successRate: this.metrics.requests.total > 0 
          ? parseFloat(((this.metrics.requests.successful / this.metrics.requests.total) * 100).toFixed(2))
          : 0,
        failureRate: this.metrics.requests.total > 0 
          ? parseFloat(((this.metrics.requests.failed / this.metrics.requests.total) * 100).toFixed(2))
          : 0,
        requestsPerSecond: parseFloat(requestsPerSecond)
      },
      responses: {
        ...this.metrics.responses,
        averageTime: parseFloat(this.metrics.responses.averageTime.toFixed(2)),
        minTime: this.metrics.responses.minTime === Infinity ? 0 : this.metrics.responses.minTime,
        maxTime: this.metrics.responses.maxTime
      },
      errors: this.metrics.errors,
      cache: this.metrics.cache,
      rateLimit: {
        ...this.metrics.rateLimit,
        averageDelay: parseFloat(this.metrics.rateLimit.averageDelay.toFixed(2))
      }
    };
  }

  /**
   * Get recent history
   */
  getHistory(limit = 100, type = null) {
    let filteredHistory = this.history;

    if (type) {
      filteredHistory = this.history.filter(event => event.type === type);
    }

    return filteredHistory.slice(-limit);
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary() {
    const stats = this.getStats();

    return {
      health: this.calculateHealthScore(stats),
      performance: {
        averageResponseTime: stats.responses.averageTime,
        requestsPerSecond: stats.requests.requestsPerSecond,
        successRate: stats.requests.successRate,
        cacheHitRate: stats.cache.hitRate
      },
      issues: this.identifyIssues(stats)
    };
  }

  /**
   * Calculate overall health score (0-100)
   */
  calculateHealthScore(stats) {
    let score = 100;

    // Penalize for low success rate
    if (stats.requests.successRate < 95) {
      score -= (95 - stats.requests.successRate) * 2;
    }

    // Penalize for slow response times
    if (stats.responses.averageTime > 2000) {
      score -= Math.min(30, (stats.responses.averageTime - 2000) / 100);
    }

    // Penalize for many errors
    const errorRate = (stats.errors.total / Math.max(1, stats.requests.total)) * 100;
    if (errorRate > 5) {
      score -= (errorRate - 5) * 3;
    }

    return Math.max(0, Math.round(score));
  }

  /**
   * Identify performance issues
   */
  identifyIssues(stats) {
    const issues = [];

    if (stats.requests.successRate < 95) {
      issues.push({
        type: 'LOW_SUCCESS_RATE',
        severity: 'HIGH',
        message: `Success rate is ${stats.requests.successRate}%, below 95% threshold`,
        recommendation: 'Check error patterns and implement better error handling'
      });
    }

    if (stats.responses.averageTime > 2000) {
      issues.push({
        type: 'SLOW_RESPONSE_TIME',
        severity: 'MEDIUM',
        message: `Average response time is ${stats.responses.averageTime}ms, above 2000ms threshold`,
        recommendation: 'Consider implementing request optimization or caching'
      });
    }

    if (stats.cache.hitRate < 60 && stats.cache.hits + stats.cache.misses > 0) {
      issues.push({
        type: 'LOW_CACHE_HIT_RATE',
        severity: 'LOW',
        message: `Cache hit rate is ${stats.cache.hitRate}%, below 60% threshold`,
        recommendation: 'Review caching strategy and TTL settings'
      });
    }

    if (stats.rateLimit.delays > stats.requests.total * 0.1) {
      issues.push({
        type: 'FREQUENT_RATE_LIMITING',
        severity: 'MEDIUM',
        message: 'Frequent rate limiting delays detected',
        recommendation: 'Implement better request pacing or increase rate limits'
      });
    }

    return issues;
  }
}

module.exports = { MetricsCollector };