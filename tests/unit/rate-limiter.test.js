const { RateLimiter } = require('../../src/middleware/rate-limiter');

describe('RateLimiter', () => {
  let rateLimiter;

  beforeEach(() => {
    rateLimiter = new RateLimiter({
      requests: 10,
      per: 1000, // 1 second for testing
      burst: 5
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('Token Management', () => {
    it('should initialize with full tokens', () => {
      expect(rateLimiter.hasTokens()).toBe(true);
      const status = rateLimiter.getStatus();
      expect(status.internal.tokens).toBe(10);
    });

    it('should consume tokens when requested', async () => {
      await rateLimiter.waitForToken();
      const status = rateLimiter.getStatus();
      expect(status.internal.tokens).toBe(9);
    });

    it('should refill tokens over time', async () => {
      jest.useFakeTimers();
      
      // Consume all tokens
      for (let i = 0; i < 10; i++) {
        await rateLimiter.waitForToken();
      }
      
      expect(rateLimiter.hasTokens()).toBe(false);
      
      // Advance time by half the reset period
      jest.advanceTimersByTime(500);
      rateLimiter.refillTokens();
      
      // Should have some tokens back
      const status = rateLimiter.getStatus();
      expect(status.internal.tokens).toBeGreaterThan(0);
      expect(status.internal.tokens).toBeLessThan(10);
    });

    it('should fully refill after reset period', async () => {
      jest.useFakeTimers();
      
      // Consume all tokens
      for (let i = 0; i < 10; i++) {
        await rateLimiter.waitForToken();
      }
      
      // Advance time past reset period
      jest.advanceTimersByTime(1100);
      rateLimiter.refillTokens();
      
      const status = rateLimiter.getStatus();
      expect(status.internal.tokens).toBe(10);
    });
  });

  describe('GitHub API Integration', () => {
    it('should respect GitHub rate limits', () => {
      rateLimiter.updateLimits({
        remaining: 100,
        reset: Date.now() + 3600000,
        limit: 5000
      });

      const status = rateLimiter.getStatus();
      expect(status.github.remaining).toBe(100);
      expect(status.github.limit).toBe(5000);
    });

    it('should consider GitHub limits in token availability', () => {
      // Set GitHub limit very low
      rateLimiter.updateLimits({
        remaining: 1,
        reset: Date.now() + 3600000,
        limit: 5000
      });

      // Should not have tokens due to GitHub buffer
      expect(rateLimiter.hasTokens()).toBe(false);
    });

    it('should update GitHub limits when tokens consumed', async () => {
      rateLimiter.updateLimits({
        remaining: 100,
        reset: Date.now() + 3600000,
        limit: 5000
      });

      await rateLimiter.waitForToken();
      
      const status = rateLimiter.getStatus();
      expect(status.github.remaining).toBe(99);
    });
  });

  describe('Queue Management', () => {
    it('should queue requests when no tokens available', async () => {
      jest.useFakeTimers();
      
      // Consume all tokens
      for (let i = 0; i < 10; i++) {
        await rateLimiter.waitForToken();
      }

      // Make additional requests that should be queued
      const promises = [];
      for (let i = 0; i < 3; i++) {
        promises.push(rateLimiter.waitForToken());
      }

      const status = rateLimiter.getStatus();
      expect(status.internal.queueLength).toBe(3);

      // Advance time to allow token refill
      jest.advanceTimersByTime(1100);
      
      // Wait for all queued requests to complete
      await Promise.all(promises);

      const finalStatus = rateLimiter.getStatus();
      expect(finalStatus.internal.queueLength).toBe(0);
    });

    it('should process queue in FIFO order', async () => {
      jest.useFakeTimers();
      
      // Consume all tokens
      for (let i = 0; i < 10; i++) {
        await rateLimiter.waitForToken();
      }

      const results = [];
      const promises = [];

      // Queue multiple requests
      for (let i = 0; i < 3; i++) {
        promises.push(
          rateLimiter.waitForToken().then(() => {
            results.push(i);
          })
        );
      }

      // Advance time gradually to process queue
      jest.advanceTimersByTime(1100);
      await Promise.all(promises);

      expect(results).toEqual([0, 1, 2]); // FIFO order
    });
  });

  describe('Wait Time Calculation', () => {
    it('should calculate reasonable wait times', () => {
      // Consume all tokens
      rateLimiter.tokens = 0;
      rateLimiter.apiRateLimit.remaining = 0;

      const waitTime = rateLimiter.calculateWaitTime();
      
      expect(waitTime).toBeGreaterThan(0);
      expect(waitTime).toBeLessThanOrEqual(60000); // Max 1 minute
    });

    it('should return 0 wait time when tokens available', () => {
      expect(rateLimiter.timeUntilAvailable()).toBe(0);
    });
  });

  describe('Batch Size Recommendations', () => {
    it('should recommend conservative batch sizes', () => {
      rateLimiter.updateLimits({
        remaining: 1000,
        reset: Date.now() + 3600000,
        limit: 5000
      });

      const batchSize = rateLimiter.getRecommendedBatchSize();
      
      expect(batchSize).toBeGreaterThan(0);
      expect(batchSize).toBeLessThanOrEqual(rateLimiter.config.burst);
    });

    it('should recommend smaller batches when rate limit is low', () => {
      rateLimiter.updateLimits({
        remaining: 10,
        reset: Date.now() + 3600000,
        limit: 5000
      });

      const batchSize = rateLimiter.getRecommendedBatchSize();
      
      expect(batchSize).toBeLessThanOrEqual(5); // Should be conservative
    });
  });

  describe('Status Reporting', () => {
    it('should provide comprehensive status information', () => {
      const status = rateLimiter.getStatus();
      
      expect(status).toHaveProperty('internal');
      expect(status).toHaveProperty('github');
      expect(status).toHaveProperty('canMakeRequest');
      
      expect(status.internal).toHaveProperty('tokens');
      expect(status.internal).toHaveProperty('maxTokens');
      expect(status.internal).toHaveProperty('resetAt');
      expect(status.internal).toHaveProperty('queueLength');
      
      expect(status.github).toHaveProperty('remaining');
      expect(status.github).toHaveProperty('limit');
      expect(status.github).toHaveProperty('resetAt');
      expect(status.github).toHaveProperty('percentageUsed');
    });

    it('should calculate percentage used correctly', () => {
      rateLimiter.updateLimits({
        remaining: 2500,
        reset: Date.now() + 3600000,
        limit: 5000
      });

      const status = rateLimiter.getStatus();
      expect(status.github.percentageUsed).toBe(50);
    });
  });

  describe('Reset Functionality', () => {
    it('should reset to initial state', async () => {
      // Consume some tokens and add to queue
      for (let i = 0; i < 5; i++) {
        await rateLimiter.waitForToken();
      }

      rateLimiter.reset();
      
      const status = rateLimiter.getStatus();
      expect(status.internal.tokens).toBe(10);
      expect(status.internal.queueLength).toBe(0);
    });
  });
});