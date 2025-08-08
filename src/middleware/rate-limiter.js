const { sleep } = require('../utils/helpers');

/**
 * Intelligent rate limiter with GitHub API-specific optimizations
 */
class RateLimiter {
  constructor(options = {}) {
    this.config = {
      requests: options.requests || 5000,
      per: options.per || 3600000, // 1 hour in milliseconds
      burst: options.burst || 100,
      bufferPercentage: options.bufferPercentage || 0.1, // Keep 10% buffer
      ...options
    };

    this.reset();
  }

  /**
   * Reset rate limiter state
   */
  reset() {
    this.tokens = this.config.requests;
    this.lastReset = Date.now();
    this.requestQueue = [];
    this.isProcessingQueue = false;
    
    // GitHub-specific rate limit tracking
    this.apiRateLimit = {
      remaining: 5000,
      reset: Date.now() + this.config.per,
      limit: 5000
    };
  }

  /**
   * Update rate limits from GitHub API response headers
   */
  updateLimits(headers) {
    this.apiRateLimit = {
      remaining: parseInt(headers.remaining || this.apiRateLimit.remaining),
      reset: parseInt(headers.reset || this.apiRateLimit.reset),
      limit: parseInt(headers.limit || this.apiRateLimit.limit)
    };
  }

  /**
   * Check if we have available tokens
   */
  hasTokens() {
    this.refillTokens();
    
    // Use the more restrictive limit between our internal and GitHub's
    const internalAvailable = this.tokens > 0;
    const githubAvailable = this.apiRateLimit.remaining > (this.apiRateLimit.limit * this.config.bufferPercentage);
    
    return internalAvailable && githubAvailable;
  }

  /**
   * Wait for an available token
   */
  async waitForToken() {
    if (this.hasTokens()) {
      this.consumeToken();
      return;
    }

    return new Promise((resolve) => {
      this.requestQueue.push(resolve);
      this.processQueue();
    });
  }

  /**
   * Consume a token
   */
  consumeToken() {
    if (this.tokens > 0) {
      this.tokens--;
      this.apiRateLimit.remaining = Math.max(0, this.apiRateLimit.remaining - 1);
    }
  }

  /**
   * Refill tokens based on time elapsed
   */
  refillTokens() {
    const now = Date.now();
    const timeSinceLastReset = now - this.lastReset;
    
    if (timeSinceLastReset >= this.config.per) {
      // Full refill
      this.tokens = this.config.requests;
      this.lastReset = now;
    } else {
      // Partial refill based on time
      const tokensToAdd = Math.floor(
        (timeSinceLastReset / this.config.per) * this.config.requests
      );
      this.tokens = Math.min(this.config.requests, this.tokens + tokensToAdd);
    }

    // Handle GitHub rate limit reset
    if (now >= this.apiRateLimit.reset) {
      this.apiRateLimit.remaining = this.apiRateLimit.limit;
      this.apiRateLimit.reset = now + this.config.per;
    }
  }

  /**
   * Process the queue of waiting requests
   */
  async processQueue() {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      if (this.hasTokens()) {
        this.consumeToken();
        const resolve = this.requestQueue.shift();
        resolve();
      } else {
        // Calculate wait time
        const waitTime = this.calculateWaitTime();
        await sleep(waitTime);
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * Calculate intelligent wait time
   */
  calculateWaitTime() {
    const now = Date.now();
    
    // Time until internal rate limit resets
    const internalResetWait = this.config.per - (now - this.lastReset);
    
    // Time until GitHub rate limit resets
    const githubResetWait = this.apiRateLimit.reset - now;
    
    // Use the minimum reasonable wait time
    const waitTime = Math.min(
      Math.max(1000, internalResetWait / this.config.requests), // At least 1 second
      Math.max(1000, githubResetWait / this.apiRateLimit.remaining), // GitHub-based
      60000 // Maximum 1 minute wait
    );

    return Math.max(100, waitTime); // Minimum 100ms
  }

  /**
   * Get current rate limiter status
   */
  getStatus() {
    this.refillTokens();
    
    return {
      internal: {
        tokens: this.tokens,
        maxTokens: this.config.requests,
        resetAt: this.lastReset + this.config.per,
        queueLength: this.requestQueue.length
      },
      github: {
        remaining: this.apiRateLimit.remaining,
        limit: this.apiRateLimit.limit,
        resetAt: this.apiRateLimit.reset,
        percentageUsed: ((this.apiRateLimit.limit - this.apiRateLimit.remaining) / this.apiRateLimit.limit) * 100
      },
      canMakeRequest: this.hasTokens()
    };
  }

  /**
   * Estimate time until next available token
   */
  timeUntilAvailable() {
    if (this.hasTokens()) {
      return 0;
    }

    return this.calculateWaitTime();
  }

  /**
   * Get recommended batch size for bulk operations
   */
  getRecommendedBatchSize() {
    const status = this.getStatus();
    const remainingTokens = Math.min(status.internal.tokens, status.github.remaining);
    
    // Conservative batch sizing
    return Math.min(
      Math.floor(remainingTokens * 0.1), // Use 10% of available tokens
      this.config.burst || 100 // Respect burst limit
    );
  }
}

module.exports = { RateLimiter };