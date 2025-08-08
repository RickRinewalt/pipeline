const { MetricsCollector } = require('../../src/utils/metrics');

describe('MetricsCollector', () => {
  let metrics;

  beforeEach(() => {
    metrics = new MetricsCollector();
  });

  describe('Initialization', () => {
    it('should initialize with empty metrics', () => {
      const stats = metrics.getStats();
      
      expect(stats.requests.total).toBe(0);
      expect(stats.responses.averageTime).toBe(0);
      expect(stats.errors.total).toBe(0);
      expect(stats.cache.hits).toBe(0);
      expect(stats.rateLimit.delays).toBe(0);
    });

    it('should respect tracking configuration', () => {
      const disabledMetrics = new MetricsCollector({ trackingEnabled: false });
      disabledMetrics.recordRequest('GET', '/test');
      
      const stats = disabledMetrics.getStats();
      expect(stats.requests.total).toBe(0);
    });
  });

  describe('Request Recording', () => {
    it('should record requests by method and endpoint', () => {
      metrics.recordRequest('GET', '/repos/owner/repo');
      metrics.recordRequest('POST', '/repos/owner/repo/issues');
      metrics.recordRequest('GET', '/repos/owner/repo');

      const stats = metrics.getStats();
      
      expect(stats.requests.total).toBe(3);
      expect(stats.requests.byMethod.GET).toBe(2);
      expect(stats.requests.byMethod.POST).toBe(1);
      expect(stats.requests.byEndpoint['/repos/{owner}/{repo}']).toBe(2);
      expect(stats.requests.byEndpoint['/repos/{owner}/{repo}/issues']).toBe(1);
    });

    it('should sanitize endpoints', () => {
      metrics.recordRequest('GET', '/repos/testowner/testrepo/issues/123');
      
      const stats = metrics.getStats();
      expect(stats.requests.byEndpoint).toHaveProperty('/repos/{owner}/{repo}/issues/{id}');
    });

    it('should add events to history', () => {
      metrics.recordRequest('GET', '/test');
      
      const history = metrics.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].type).toBe('request');
      expect(history[0].data.method).toBe('GET');
    });
  });

  describe('Response Recording', () => {
    it('should record response times and status codes', () => {
      metrics.recordRequest('GET', '/test');
      metrics.recordResponse(200, 150);
      metrics.recordResponse(404, 50);
      metrics.recordResponse(200, 200);

      const stats = metrics.getStats();
      
      expect(stats.responses.averageTime).toBe(133.33); // (150 + 50 + 200) / 3
      expect(stats.responses.minTime).toBe(50);
      expect(stats.responses.maxTime).toBe(200);
      expect(stats.requests.byStatus['200']).toBe(2);
      expect(stats.requests.byStatus['404']).toBe(1);
      expect(stats.requests.successful).toBe(2);
      expect(stats.requests.failed).toBe(1);
    });

    it('should calculate success and failure rates', () => {
      // Record some requests first
      for (let i = 0; i < 10; i++) {
        metrics.recordRequest('GET', '/test');
      }

      // Record responses - 8 successful, 2 failed
      for (let i = 0; i < 8; i++) {
        metrics.recordResponse(200, 100);
      }
      for (let i = 0; i < 2; i++) {
        metrics.recordResponse(500, 100);
      }

      const stats = metrics.getStats();
      
      expect(stats.requests.successRate).toBe(80);
      expect(stats.requests.failureRate).toBe(20);
    });
  });

  describe('Error Recording', () => {
    it('should record and classify errors', () => {
      metrics.recordError('Request timeout', 'GET', '/test');
      metrics.recordError('Network error', 'POST', '/data');
      metrics.recordError('Rate limit exceeded', 'GET', '/api');

      const stats = metrics.getStats();
      
      expect(stats.errors.total).toBe(3);
      expect(stats.errors.byType.TIMEOUT).toBe(1);
      expect(stats.errors.byType.NETWORK).toBe(1);
      expect(stats.errors.byType.RATE_LIMIT).toBe(1);
      expect(stats.errors.retryable).toBe(3);
      expect(stats.errors.nonRetryable).toBe(0);
    });

    it('should classify non-retryable errors', () => {
      metrics.recordError('404 Not Found', 'GET', '/missing');
      metrics.recordError('401 Unauthorized', 'GET', '/protected');

      const stats = metrics.getStats();
      
      expect(stats.errors.byType.NOT_FOUND).toBe(1);
      expect(stats.errors.byType.AUTHENTICATION).toBe(1);
      expect(stats.errors.retryable).toBe(0);
      expect(stats.errors.nonRetryable).toBe(2);
    });

    it('should count error occurrences by message', () => {
      metrics.recordError('Network timeout');
      metrics.recordError('Network timeout');
      metrics.recordError('Server error');

      const stats = metrics.getStats();
      
      expect(stats.errors.byMessage['Network timeout']).toBe(2);
      expect(stats.errors.byMessage['Server error']).toBe(1);
    });
  });

  describe('Cache Recording', () => {
    it('should record cache hits and misses', () => {
      metrics.recordCacheHit();
      metrics.recordCacheHit();
      metrics.recordCacheMiss();

      const stats = metrics.getStats();
      
      expect(stats.cache.hits).toBe(2);
      expect(stats.cache.misses).toBe(1);
      expect(stats.cache.hitRate).toBe(66.67);
    });

    it('should handle zero cache operations', () => {
      const stats = metrics.getStats();
      expect(stats.cache.hitRate).toBe(0);
    });
  });

  describe('Rate Limit Recording', () => {
    it('should record rate limit delays', () => {
      metrics.recordRateLimitDelay(1000);
      metrics.recordRateLimitDelay(2000);
      metrics.recordRateLimitDelay(500);

      const stats = metrics.getStats();
      
      expect(stats.rateLimit.delays).toBe(3);
      expect(stats.rateLimit.totalDelayTime).toBe(3500);
      expect(stats.rateLimit.averageDelay).toBe(1166.67);
    });
  });

  describe('Endpoint Sanitization', () => {
    it('should sanitize numeric IDs', () => {
      expect(metrics.sanitizeEndpoint('/repos/owner/repo/issues/123'))
        .toBe('/repos/owner/repo/issues/{id}');
    });

    it('should sanitize SHA hashes', () => {
      expect(metrics.sanitizeEndpoint('/repos/owner/repo/commits/a1b2c3d4e5f6'))
        .toBe('/repos/owner/repo/commits/{sha}');
    });

    it('should sanitize pull request URLs', () => {
      expect(metrics.sanitizeEndpoint('/repos/owner/repo/pulls/456/files'))
        .toBe('/repos/{owner}/{repo}/pulls/{id}/files');
    });

    it('should sanitize user and org names', () => {
      expect(metrics.sanitizeEndpoint('/users/someuser/repos'))
        .toBe('/users/{username}/repos');
      
      expect(metrics.sanitizeEndpoint('/orgs/someorg/members'))
        .toBe('/orgs/{org}/members');
    });

    it('should handle complex repository paths', () => {
      expect(metrics.sanitizeEndpoint('/repos/myorg/myrepo/pulls/123'))
        .toBe('/repos/{owner}/{repo}/pulls/{id}');
    });
  });

  describe('Error Classification', () => {
    it('should classify timeout errors', () => {
      expect(metrics.classifyError('Request timeout')).toBe('TIMEOUT');
      expect(metrics.classifyError('Connection timeout')).toBe('TIMEOUT');
    });

    it('should classify rate limit errors', () => {
      expect(metrics.classifyError('Rate limit exceeded')).toBe('RATE_LIMIT');
      expect(metrics.classifyError('403 Forbidden')).toBe('RATE_LIMIT');
    });

    it('should classify authentication errors', () => {
      expect(metrics.classifyError('401 Unauthorized')).toBe('AUTHENTICATION');
      expect(metrics.classifyError('Bad credentials')).toBe('AUTHENTICATION');
    });

    it('should classify network errors', () => {
      expect(metrics.classifyError('Network connection failed')).toBe('NETWORK');
      expect(metrics.classifyError('ENOTFOUND example.com')).toBe('NETWORK');
    });

    it('should classify server errors', () => {
      expect(metrics.classifyError('500 Internal Server Error')).toBe('SERVER_ERROR');
      expect(metrics.classifyError('502 Bad Gateway')).toBe('SERVER_ERROR');
      expect(metrics.classifyError('503 Service Unavailable')).toBe('SERVER_ERROR');
    });

    it('should classify unknown errors', () => {
      expect(metrics.classifyError('Something went wrong')).toBe('UNKNOWN');
    });
  });

  describe('Retryable Errors', () => {
    it('should identify retryable errors', () => {
      expect(metrics.isRetryableError('Request timeout')).toBe(true);
      expect(metrics.isRetryableError('Rate limit exceeded')).toBe(true);
      expect(metrics.isRetryableError('Network error')).toBe(true);
      expect(metrics.isRetryableError('500 Server error')).toBe(true);
    });

    it('should identify non-retryable errors', () => {
      expect(metrics.isRetryableError('404 Not Found')).toBe(false);
      expect(metrics.isRetryableError('401 Unauthorized')).toBe(false);
      expect(metrics.isRetryableError('Invalid input')).toBe(false);
    });
  });

  describe('History Management', () => {
    it('should maintain event history', () => {
      metrics.recordRequest('GET', '/test');
      metrics.recordResponse(200, 100);
      metrics.recordError('Test error');

      const history = metrics.getHistory();
      
      expect(history).toHaveLength(3);
      expect(history[0].type).toBe('request');
      expect(history[1].type).toBe('response');
      expect(history[2].type).toBe('error');
    });

    it('should limit history size', () => {
      const limitedMetrics = new MetricsCollector({ historySize: 5 });
      
      for (let i = 0; i < 10; i++) {
        limitedMetrics.recordRequest('GET', `/test${i}`);
      }

      const history = limitedMetrics.getHistory();
      expect(history).toHaveLength(5);
    });

    it('should filter history by type', () => {
      metrics.recordRequest('GET', '/test');
      metrics.recordResponse(200, 100);
      metrics.recordError('Test error');

      const requestHistory = metrics.getHistory(100, 'request');
      const errorHistory = metrics.getHistory(100, 'error');
      
      expect(requestHistory).toHaveLength(1);
      expect(errorHistory).toHaveLength(1);
    });

    it('should limit history results', () => {
      for (let i = 0; i < 10; i++) {
        metrics.recordRequest('GET', `/test${i}`);
      }

      const limitedHistory = metrics.getHistory(5);
      expect(limitedHistory).toHaveLength(5);
    });
  });

  describe('Performance Summary', () => {
    it('should calculate health score', () => {
      // Record good performance metrics
      for (let i = 0; i < 10; i++) {
        metrics.recordRequest('GET', '/test');
        metrics.recordResponse(200, 100); // Fast responses
      }

      const summary = metrics.getPerformanceSummary();
      
      expect(summary.health).toBeGreaterThan(90);
      expect(summary.performance.successRate).toBe(100);
      expect(summary.performance.averageResponseTime).toBe(100);
    });

    it('should identify performance issues', () => {
      // Record poor performance
      for (let i = 0; i < 10; i++) {
        metrics.recordRequest('GET', '/test');
        metrics.recordResponse(i < 8 ? 200 : 500, 3000); // Slow responses, some errors
      }
      
      // Low cache hit rate
      metrics.recordCacheMiss();
      metrics.recordCacheMiss();
      metrics.recordCacheHit();

      const summary = metrics.getPerformanceSummary();
      
      expect(summary.health).toBeLessThan(80);
      expect(summary.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'SLOW_RESPONSE_TIME' }),
          expect.objectContaining({ type: 'LOW_SUCCESS_RATE' }),
          expect.objectContaining({ type: 'LOW_CACHE_HIT_RATE' })
        ])
      );
    });

    it('should detect frequent rate limiting', () => {
      for (let i = 0; i < 10; i++) {
        metrics.recordRequest('GET', '/test');
        metrics.recordRateLimitDelay(1000);
      }

      const summary = metrics.getPerformanceSummary();
      
      expect(summary.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'FREQUENT_RATE_LIMITING' })
        ])
      );
    });
  });

  describe('Statistics Calculation', () => {
    it('should calculate uptime correctly', () => {
      // Wait a moment to ensure uptime > 0
      return new Promise(resolve => {
        setTimeout(() => {
          const stats = metrics.getStats();
          
          expect(stats.uptime.milliseconds).toBeGreaterThan(0);
          expect(stats.uptime.seconds).toBeGreaterThanOrEqual(0);
          resolve();
        }, 10);
      });
    });

    it('should calculate requests per second', () => {
      // Record requests
      for (let i = 0; i < 10; i++) {
        metrics.recordRequest('GET', '/test');
      }

      const stats = metrics.getStats();
      expect(parseFloat(stats.requests.requestsPerSecond)).toBeGreaterThan(0);
    });

    it('should handle division by zero', () => {
      const stats = metrics.getStats();
      
      expect(stats.requests.successRate).toBe(0);
      expect(stats.requests.failureRate).toBe(0);
      expect(stats.requests.requestsPerSecond).toBe('0.00');
    });
  });

  describe('Reset Functionality', () => {
    it('should reset all metrics', () => {
      // Record some data
      metrics.recordRequest('GET', '/test');
      metrics.recordResponse(200, 100);
      metrics.recordError('Test error');
      metrics.recordCacheHit();

      // Reset
      metrics.reset();

      const stats = metrics.getStats();
      
      expect(stats.requests.total).toBe(0);
      expect(stats.responses.totalTime).toBe(0);
      expect(stats.errors.total).toBe(0);
      expect(stats.cache.hits).toBe(0);
      expect(metrics.getHistory()).toHaveLength(0);
    });
  });

  describe('Event ID Generation', () => {
    it('should generate unique event IDs', () => {
      const id1 = metrics.generateEventId();
      const id2 = metrics.generateEventId();
      
      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
      expect(typeof id2).toBe('string');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty or null values', () => {
      metrics.recordRequest('', '');
      metrics.recordError('', '', '');
      
      const stats = metrics.getStats();
      expect(stats.requests.total).toBe(1);
      expect(stats.errors.total).toBe(1);
    });

    it('should handle very large response times', () => {
      metrics.recordRequest('GET', '/test');
      metrics.recordResponse(200, 999999);

      const stats = metrics.getStats();
      expect(stats.responses.maxTime).toBe(999999);
      expect(stats.responses.averageTime).toBe(999999);
    });

    it('should handle negative response times', () => {
      metrics.recordRequest('GET', '/test');
      metrics.recordResponse(200, -100);

      const stats = metrics.getStats();
      expect(stats.responses.minTime).toBe(-100);
    });
  });
});