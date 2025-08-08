const axios = require('axios');
const { RateLimiter } = require('../middleware/rate-limiter');
const { RequestCache } = require('../utils/cache');
const { MetricsCollector } = require('../utils/metrics');
const { sleep, exponentialBackoff } = require('../utils/helpers');

/**
 * Production-ready GitHub API client with comprehensive features
 * Supports authentication, rate limiting, caching, and error handling
 */
class GitHubClient {
  constructor(config = {}) {
    this.config = {
      token: config.token,
      baseUrl: config.baseUrl || 'https://api.github.com',
      timeout: config.timeout || 30000,
      retryAttempts: config.retryAttempts || 3,
      userAgent: config.userAgent || 'GitHub-Integration-Client/1.0.0',
      ...config
    };

    this.validateConfig();
    this.setupComponents();
  }

  /**
   * Validate configuration and token format
   */
  validateConfig() {
    if (!this.config.token) {
      throw new Error('GitHub token is required');
    }

    // Validate token format (GitHub personal access tokens start with ghp_)
    const tokenPattern = /^(ghp_[a-zA-Z0-9]{36}|gho_[a-zA-Z0-9]{36}|ghu_[a-zA-Z0-9]{36}|ghs_[a-zA-Z0-9]{36}|ghr_[a-zA-Z0-9]{76})$/;
    if (!tokenPattern.test(this.config.token)) {
      throw new Error('Invalid GitHub token format');
    }
  }

  /**
   * Setup internal components
   */
  setupComponents() {
    this.rateLimiter = new RateLimiter({
      requests: 5000,
      per: 3600000, // 1 hour in milliseconds
      burst: 100
    });

    this.cache = new RequestCache({
      ttl: this.config.cacheTtl || 300, // 5 minutes default
      maxSize: this.config.cacheSize || 1000
    });

    this.metrics = new MetricsCollector();

    this.axios = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Authorization': `Bearer ${this.config.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': this.config.userAgent,
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });

    this.setupInterceptors();
  }

  /**
   * Setup request/response interceptors
   */
  setupInterceptors() {
    // Request interceptor
    this.axios.interceptors.request.use(
      (config) => {
        this.metrics.recordRequest(config.method.toUpperCase(), config.url);
        return config;
      },
      (error) => {
        this.metrics.recordError(error.message, 'REQUEST_INTERCEPTOR', '');
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.axios.interceptors.response.use(
      (response) => {
        this.metrics.recordResponse(response.status, Date.now() - response.config.metadata?.startTime || 0);
        this.updateRateLimit(response.headers);
        return response;
      },
      (error) => {
        if (error.response) {
          this.metrics.recordResponse(error.response.status, Date.now() - error.config?.metadata?.startTime || 0);
          this.updateRateLimit(error.response.headers);
        }
        this.metrics.recordError(error.message, error.config?.method?.toUpperCase() || 'UNKNOWN', error.config?.url || '');
        return Promise.reject(error);
      }
    );
  }

  /**
   * Update rate limit information from response headers
   */
  updateRateLimit(headers = {}) {
    const remaining = parseInt(headers['x-ratelimit-remaining'] || '5000');
    const reset = parseInt(headers['x-ratelimit-reset'] || Math.floor(Date.now() / 1000) + 3600);
    
    this.rateLimiter.updateLimits({
      remaining,
      reset: reset * 1000 // Convert to milliseconds
    });
  }

  /**
   * Check if client is authenticated
   */
  isAuthenticated() {
    return !!this.config.token;
  }

  /**
   * Validate token against GitHub API
   */
  async validateToken() {
    try {
      const response = await this.request('GET', '/user');
      return {
        valid: true,
        user: response.data,
        rateLimit: {
          remaining: response.headers['x-ratelimit-remaining'],
          reset: response.headers['x-ratelimit-reset']
        }
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message,
        code: error.response?.status
      };
    }
  }

  /**
   * Main request method with caching, rate limiting, and error handling
   */
  async request(method, path, data = null, options = {}) {
    const cacheKey = method === 'GET' ? `${method}:${path}:${JSON.stringify(data)}` : null;
    
    // Check cache for GET requests
    if (cacheKey) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        this.metrics.recordCacheHit();
        return cached;
      }
    }

    // Wait for rate limit if needed
    await this.rateLimiter.waitForToken();

    let lastError;
    
    for (let attempt = 0; attempt < this.config.retryAttempts; attempt++) {
      try {
        const response = await this._makeRequest(method, path, data, options);
        
        // Cache successful GET requests
        if (cacheKey && response.status < 400) {
          this.cache.set(cacheKey, response);
        }

        return response;
      } catch (error) {
        lastError = error;
        const classified = this.classifyError(error);
        
        // Don't retry if error is not retryable or if this is the last attempt
        if (!classified.retryable || attempt === this.config.retryAttempts - 1) {
          break;
        }

        // Handle rate limiting
        if (error.response?.status === 403 && error.response?.headers['x-ratelimit-remaining'] === '0') {
          const resetTime = parseInt(error.response.headers['x-ratelimit-reset']) * 1000;
          const waitTime = resetTime - Date.now() + 1000; // Add 1 second buffer
          
          if (waitTime > 0) {
            await sleep(Math.min(waitTime, 3600000)); // Max 1 hour wait
            continue;
          }
        }

        // Exponential backoff for other retryable errors
        await sleep(exponentialBackoff(attempt));
      }
    }

    throw lastError;
  }

  /**
   * Make the actual HTTP request
   */
  async _makeRequest(method, path, data = null, options = {}) {
    const config = {
      method: method.toUpperCase(),
      url: path.startsWith('/') ? path : `/${path}`,
      ...options,
      metadata: {
        startTime: Date.now()
      }
    };

    if (data) {
      if (method.toUpperCase() === 'GET') {
        config.params = data;
      } else {
        config.data = data;
      }
    }

    return await this.axios(config);
  }

  /**
   * Classify error for retry logic
   */
  classifyError(error) {
    if (error.response) {
      const status = error.response.status;
      
      if (status >= 400 && status < 500) {
        return {
          type: 'CLIENT_ERROR',
          retryable: status === 429 || status === 408, // Rate limit or timeout
          status
        };
      }
      
      if (status >= 500) {
        return {
          type: 'SERVER_ERROR',
          retryable: true,
          status
        };
      }
    }

    if (error.code === 'ENOTFOUND' || error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      return {
        type: 'NETWORK_ERROR',
        retryable: true,
        code: error.code
      };
    }

    return {
      type: 'UNKNOWN_ERROR',
      retryable: false,
      message: error.message
    };
  }

  /**
   * Batch multiple requests with concurrency control
   */
  async batchRequests(requests, options = {}) {
    const {
      concurrency = 10,
      continueOnError = false,
      delay = 100
    } = options;

    const results = [];
    const batches = [];

    // Split requests into batches
    for (let i = 0; i < requests.length; i += concurrency) {
      batches.push(requests.slice(i, i + concurrency));
    }

    for (const batch of batches) {
      const batchPromises = batch.map(async (req, index) => {
        try {
          // Add small delay to avoid overwhelming the API
          if (index > 0) {
            await sleep(delay * index);
          }

          const result = await this.request(req.method, req.path, req.data, req.options);
          return { success: true, data: result.data, status: result.status };
        } catch (error) {
          if (!continueOnError) {
            throw error;
          }
          return { 
            success: false, 
            error: error.message, 
            status: error.response?.status 
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Get client metrics
   */
  getMetrics() {
    return {
      ...this.metrics.getStats(),
      rateLimit: this.rateLimiter.getStatus(),
      cache: this.cache.getStats()
    };
  }

  /**
   * Reset client state
   */
  reset() {
    this.cache.clear();
    this.metrics.reset();
    this.rateLimiter.reset();
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    // Cancel any pending requests
    this.axios.interceptors.request.clear();
    this.axios.interceptors.response.clear();
    
    // Clear resources
    this.cache.clear();
    this.metrics.reset();
  }
}

module.exports = { GitHubClient };