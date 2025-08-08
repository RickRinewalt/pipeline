const dns = require('dns').promises;
const { performance } = require('perf_hooks');

/**
 * Network Metrics Collector
 * Collects network performance metrics including latency, connectivity, and throughput
 */
class NetworkMetricsCollector {
  constructor(options = {}) {
    this.config = {
      testHosts: [
        'google.com',
        'github.com',
        'npmjs.com',
        ...options.testHosts || []
      ],
      dnsServers: [
        '8.8.8.8',
        '1.1.1.1',
        ...options.dnsServers || []
      ],
      timeout: options.timeout || 5000,
      collectDNS: options.collectDNS !== false,
      collectPing: options.collectPing !== false,
      collectThroughput: options.collectThroughput !== false,
      ...options
    };

    this.networkHistory = [];
  }

  /**
   * Collect all network metrics
   */
  async collect() {
    const timestamp = Date.now();
    const metrics = { timestamp };

    try {
      // DNS resolution metrics
      if (this.config.collectDNS) {
        metrics.dns = await this.collectDNSMetrics();
      }

      // Ping/latency metrics
      if (this.config.collectPing) {
        metrics.latency = await this.collectLatencyMetrics();
      }

      // Throughput metrics (simplified)
      if (this.config.collectThroughput) {
        metrics.throughput = await this.collectThroughputMetrics();
      }

      // Connection quality assessment
      metrics.quality = this.assessNetworkQuality(metrics);

      // Store in history
      this.networkHistory.push({
        timestamp,
        metrics
      });

      // Limit history size
      if (this.networkHistory.length > 100) {
        this.networkHistory.shift();
      }

      return {
        success: true,
        timestamp,
        metrics
      };

    } catch (error) {
      return {
        success: false,
        timestamp,
        error: error.message
      };
    }
  }

  /**
   * Collect DNS resolution metrics
   */
  async collectDNSMetrics() {
    const metrics = {
      resolutions: [],
      averageTime: 0,
      errors: 0,
      successRate: 0
    };

    const promises = this.config.testHosts.map(async (host) => {
      const startTime = performance.now();
      
      try {
        await dns.lookup(host);
        const resolutionTime = performance.now() - startTime;
        
        metrics.resolutions.push({
          host,
          success: true,
          time: Math.round(resolutionTime * 100) / 100
        });

        return resolutionTime;

      } catch (error) {
        metrics.errors++;
        metrics.resolutions.push({
          host,
          success: false,
          error: error.message,
          time: null
        });

        return null;
      }
    });

    const results = await Promise.all(promises);
    const successfulResults = results.filter(r => r !== null);

    // Calculate metrics
    if (successfulResults.length > 0) {
      metrics.averageTime = Math.round(
        (successfulResults.reduce((sum, time) => sum + time, 0) / successfulResults.length) * 100
      ) / 100;
    }

    metrics.successRate = Math.round(
      (successfulResults.length / this.config.testHosts.length) * 100 * 100
    ) / 100;

    return metrics;
  }

  /**
   * Collect latency metrics using simplified ping-like tests
   */
  async collectLatencyMetrics() {
    const metrics = {
      tests: [],
      averageLatency: 0,
      minLatency: Number.MAX_VALUE,
      maxLatency: 0,
      packetLoss: 0
    };

    // Test connectivity to various hosts
    const testPromises = this.config.testHosts.map(async (host) => {
      return await this.testHostLatency(host);
    });

    const results = await Promise.all(testPromises);
    metrics.tests = results;

    // Calculate aggregate metrics
    const successfulTests = results.filter(r => r.success);
    
    if (successfulTests.length > 0) {
      const latencies = successfulTests.map(t => t.latency);
      
      metrics.averageLatency = Math.round(
        (latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length) * 100
      ) / 100;
      
      metrics.minLatency = Math.min(...latencies);
      metrics.maxLatency = Math.max(...latencies);
    } else {
      metrics.minLatency = 0;
    }

    metrics.packetLoss = Math.round(
      ((results.length - successfulTests.length) / results.length) * 100 * 100
    ) / 100;

    return metrics;
  }

  /**
   * Test latency to a specific host
   */
  async testHostLatency(host) {
    const startTime = performance.now();
    
    try {
      // Use DNS lookup as a proxy for network connectivity test
      await Promise.race([
        dns.lookup(host),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), this.config.timeout)
        )
      ]);

      const latency = performance.now() - startTime;

      return {
        host,
        success: true,
        latency: Math.round(latency * 100) / 100
      };

    } catch (error) {
      return {
        host,
        success: false,
        error: error.message,
        latency: null
      };
    }
  }

  /**
   * Collect simplified throughput metrics
   */
  async collectThroughputMetrics() {
    const metrics = {
      downloadSpeed: 0,
      uploadSpeed: 0,
      available: false,
      message: 'Throughput testing requires external service integration'
    };

    // In a real implementation, you would:
    // 1. Download a known-size file from a test server
    // 2. Upload data to a test endpoint
    // 3. Measure the time and calculate speeds

    // For now, we'll provide a placeholder structure
    try {
      // Simulate a small download test using DNS queries
      const testStartTime = performance.now();
      const testPromises = this.config.testHosts.map(host => dns.lookup(host));
      
      await Promise.all(testPromises);
      
      const testDuration = performance.now() - testStartTime;
      
      // Very rough approximation - not actual throughput
      metrics.responseTime = Math.round(testDuration * 100) / 100;
      metrics.available = true;
      metrics.message = 'Basic network response time measured';

    } catch (error) {
      metrics.error = error.message;
    }

    return metrics;
  }

  /**
   * Assess overall network quality based on collected metrics
   */
  assessNetworkQuality(metrics) {
    const quality = {
      score: 100,
      rating: 'excellent',
      issues: []
    };

    // Check DNS performance
    if (metrics.dns) {
      if (metrics.dns.successRate < 95) {
        quality.score -= 20;
        quality.issues.push('DNS resolution issues detected');
      }

      if (metrics.dns.averageTime > 100) {
        quality.score -= 10;
        quality.issues.push('Slow DNS resolution');
      }
    }

    // Check latency
    if (metrics.latency) {
      if (metrics.latency.packetLoss > 1) {
        quality.score -= 25;
        quality.issues.push(`High packet loss: ${metrics.latency.packetLoss}%`);
      }

      if (metrics.latency.averageLatency > 200) {
        quality.score -= 15;
        quality.issues.push('High network latency');
      }
    }

    // Determine rating
    if (quality.score >= 90) {
      quality.rating = 'excellent';
    } else if (quality.score >= 75) {
      quality.rating = 'good';
    } else if (quality.score >= 50) {
      quality.rating = 'fair';
    } else {
      quality.rating = 'poor';
    }

    quality.score = Math.max(0, quality.score);

    return quality;
  }

  /**
   * Get network performance trends
   */
  getNetworkTrends() {
    if (this.networkHistory.length < 2) {
      return {
        available: false,
        message: 'Insufficient data for trend analysis'
      };
    }

    const recent = this.networkHistory.slice(-10); // Last 10 measurements
    const trends = {
      dns: this.calculateDNSTrend(recent),
      latency: this.calculateLatencyTrend(recent),
      quality: this.calculateQualityTrend(recent)
    };

    return trends;
  }

  /**
   * Calculate DNS performance trend
   */
  calculateDNSTrend(history) {
    const dnsTimes = history
      .map(h => h.metrics.dns?.averageTime)
      .filter(t => typeof t === 'number');

    if (dnsTimes.length < 2) {
      return { trend: 'stable', change: 0 };
    }

    const first = dnsTimes[0];
    const last = dnsTimes[dnsTimes.length - 1];
    const change = ((last - first) / first) * 100;

    return {
      trend: Math.abs(change) < 10 ? 'stable' : change > 0 ? 'degrading' : 'improving',
      change: Math.round(change * 100) / 100,
      current: last,
      average: dnsTimes.reduce((a, b) => a + b) / dnsTimes.length
    };
  }

  /**
   * Calculate latency trend
   */
  calculateLatencyTrend(history) {
    const latencies = history
      .map(h => h.metrics.latency?.averageLatency)
      .filter(l => typeof l === 'number');

    if (latencies.length < 2) {
      return { trend: 'stable', change: 0 };
    }

    const first = latencies[0];
    const last = latencies[latencies.length - 1];
    const change = first > 0 ? ((last - first) / first) * 100 : 0;

    return {
      trend: Math.abs(change) < 10 ? 'stable' : change > 0 ? 'degrading' : 'improving',
      change: Math.round(change * 100) / 100,
      current: last,
      min: Math.min(...latencies),
      max: Math.max(...latencies),
      average: latencies.reduce((a, b) => a + b) / latencies.length
    };
  }

  /**
   * Calculate quality trend
   */
  calculateQualityTrend(history) {
    const qualityScores = history
      .map(h => h.metrics.quality?.score)
      .filter(s => typeof s === 'number');

    if (qualityScores.length < 2) {
      return { trend: 'stable', change: 0 };
    }

    const first = qualityScores[0];
    const last = qualityScores[qualityScores.length - 1];
    const change = first > 0 ? ((last - first) / first) * 100 : 0;

    return {
      trend: Math.abs(change) < 5 ? 'stable' : change > 0 ? 'improving' : 'degrading',
      change: Math.round(change * 100) / 100,
      current: last,
      average: qualityScores.reduce((a, b) => a + b) / qualityScores.length
    };
  }

  /**
   * Perform comprehensive network diagnostics
   */
  async performDiagnostics() {
    const diagnostics = {
      timestamp: Date.now(),
      tests: {}
    };

    try {
      // Basic connectivity test
      diagnostics.tests.connectivity = await this.testBasicConnectivity();

      // DNS resolution test
      diagnostics.tests.dnsResolution = await this.testDNSResolution();

      // Latency test
      diagnostics.tests.latency = await this.testLatencyVariation();

      // Network interface test (if available)
      diagnostics.tests.interfaces = await this.testNetworkInterfaces();

      // Generate recommendations
      diagnostics.recommendations = this.generateNetworkRecommendations(diagnostics.tests);

    } catch (error) {
      diagnostics.error = error.message;
    }

    return diagnostics;
  }

  /**
   * Test basic connectivity
   */
  async testBasicConnectivity() {
    const results = {
      reachableHosts: 0,
      unreachableHosts: 0,
      hostResults: []
    };

    for (const host of this.config.testHosts) {
      try {
        const startTime = performance.now();
        await dns.lookup(host);
        const duration = performance.now() - startTime;

        results.reachableHosts++;
        results.hostResults.push({
          host,
          reachable: true,
          responseTime: Math.round(duration * 100) / 100
        });

      } catch (error) {
        results.unreachableHosts++;
        results.hostResults.push({
          host,
          reachable: false,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Test DNS resolution performance
   */
  async testDNSResolution() {
    const results = {
      servers: [],
      averageTime: 0,
      fastest: null,
      slowest: null
    };

    // This is a simplified test - in practice you'd test different DNS servers
    const testHost = 'example.com';
    
    try {
      const startTime = performance.now();
      await dns.lookup(testHost);
      const duration = performance.now() - startTime;

      results.servers.push({
        server: 'system',
        responseTime: Math.round(duration * 100) / 100,
        success: true
      });

      results.averageTime = duration;
      results.fastest = 'system';
      results.slowest = 'system';

    } catch (error) {
      results.servers.push({
        server: 'system',
        success: false,
        error: error.message
      });
    }

    return results;
  }

  /**
   * Test latency variation
   */
  async testLatencyVariation() {
    const samples = 10;
    const results = {
      samples: [],
      jitter: 0,
      consistency: 'good'
    };

    const testHost = this.config.testHosts[0];
    
    for (let i = 0; i < samples; i++) {
      try {
        const startTime = performance.now();
        await dns.lookup(testHost);
        const latency = performance.now() - startTime;

        results.samples.push(Math.round(latency * 100) / 100);

      } catch (error) {
        results.samples.push(null);
      }
    }

    // Calculate jitter (standard deviation)
    const validSamples = results.samples.filter(s => s !== null);
    
    if (validSamples.length > 1) {
      const mean = validSamples.reduce((a, b) => a + b) / validSamples.length;
      const variance = validSamples.reduce((sum, sample) => 
        sum + Math.pow(sample - mean, 2), 0) / validSamples.length;
      
      results.jitter = Math.round(Math.sqrt(variance) * 100) / 100;
      
      // Assess consistency
      if (results.jitter < 5) {
        results.consistency = 'excellent';
      } else if (results.jitter < 15) {
        results.consistency = 'good';
      } else if (results.jitter < 30) {
        results.consistency = 'fair';
      } else {
        results.consistency = 'poor';
      }
    }

    return results;
  }

  /**
   * Test network interfaces (basic)
   */
  async testNetworkInterfaces() {
    const os = require('os');
    const interfaces = os.networkInterfaces();
    const results = {
      total: 0,
      active: 0,
      interfaces: []
    };

    Object.entries(interfaces).forEach(([name, addresses]) => {
      results.total++;
      
      const hasActiveAddress = addresses.some(addr => 
        !addr.internal && (addr.family === 'IPv4' || addr.family === 'IPv6')
      );

      if (hasActiveAddress) {
        results.active++;
      }

      results.interfaces.push({
        name,
        addresses: addresses.length,
        active: hasActiveAddress,
        details: addresses.map(addr => ({
          family: addr.family,
          address: addr.address,
          internal: addr.internal
        }))
      });
    });

    return results;
  }

  /**
   * Generate network recommendations
   */
  generateNetworkRecommendations(tests) {
    const recommendations = [];

    // Connectivity recommendations
    if (tests.connectivity) {
      const successRate = tests.connectivity.reachableHosts / 
        (tests.connectivity.reachableHosts + tests.connectivity.unreachableHosts);
      
      if (successRate < 0.8) {
        recommendations.push({
          type: 'connectivity',
          priority: 'high',
          message: 'Poor network connectivity detected',
          actions: [
            'Check network configuration',
            'Verify internet connection',
            'Test with different DNS servers'
          ]
        });
      }
    }

    // Latency recommendations
    if (tests.latency && tests.latency.jitter > 20) {
      recommendations.push({
        type: 'latency',
        priority: 'medium',
        message: 'High network jitter detected',
        actions: [
          'Check network stability',
          'Consider using a different network',
          'Investigate bandwidth limitations'
        ]
      });
    }

    // DNS recommendations
    if (tests.dnsResolution && tests.dnsResolution.averageTime > 100) {
      recommendations.push({
        type: 'dns',
        priority: 'low',
        message: 'Slow DNS resolution',
        actions: [
          'Consider using faster DNS servers (8.8.8.8, 1.1.1.1)',
          'Clear DNS cache',
          'Check DNS configuration'
        ]
      });
    }

    return recommendations;
  }

  /**
   * Cleanup method
   */
  async cleanup() {
    // Clear history
    this.networkHistory = [];
  }
}

module.exports = NetworkMetricsCollector;