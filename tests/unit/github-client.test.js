const { GitHubClient } = require('../../src/clients/github-client');
const { RateLimiter } = require('../../src/middleware/rate-limiter');
const { RequestCache } = require('../../src/utils/cache');

describe('GitHubClient', () => {
  let client;
  const mockToken = 'ghp_test_token_12345';
  const mockConfig = {
    token: mockToken,
    baseUrl: 'https://api.github.com',
    timeout: 30000,
    retryAttempts: 3
  };

  beforeEach(() => {
    jest.clearAllMocks();
    client = new GitHubClient(mockConfig);
  });

  describe('Authentication', () => {
    it('should initialize with valid token', () => {
      expect(client.isAuthenticated()).toBe(true);
      expect(client.config.token).toBe(mockToken);
    });

    it('should throw error with invalid token format', () => {
      expect(() => {
        new GitHubClient({ token: 'invalid_token' });
      }).toThrow('Invalid GitHub token format');
    });

    it('should validate token against GitHub API', async () => {
      const mockResponse = {
        data: {
          login: 'testuser',
          id: 12345,
          type: 'User'
        },
        status: 200,
        headers: {
          'x-ratelimit-remaining': '4999'
        }
      };

      client.request = jest.fn().mockResolvedValue(mockResponse);
      
      const validation = await client.validateToken();
      
      expect(validation.valid).toBe(true);
      expect(validation.user.login).toBe('testuser');
      expect(client.request).toHaveBeenCalledWith('GET', '/user');
    });

    it('should handle token validation failure', async () => {
      client.request = jest.fn().mockRejectedValue(new Error('Bad credentials'));
      
      const validation = await client.validateToken();
      
      expect(validation.valid).toBe(false);
      expect(validation.error).toBe('Bad credentials');
    });
  });

  describe('Rate Limiting', () => {
    it('should respect GitHub rate limits', async () => {
      const rateLimiter = new RateLimiter();
      client.rateLimiter = rateLimiter;

      // Mock rate limit exceeded scenario
      const rateLimitError = new Error('Rate limit exceeded');
      rateLimitError.response = {
        status: 403,
        headers: {
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': Math.floor(Date.now() / 1000) + 3600
        }
      };

      client._makeRequest = jest.fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValue({ data: 'success', status: 200 });

      const result = await client.request('GET', '/test');
      
      expect(result.data).toBe('success');
      expect(client._makeRequest).toHaveBeenCalledTimes(2);
    });

    it('should implement exponential backoff', async () => {
      const startTime = Date.now();
      
      client._makeRequest = jest.fn()
        .mockRejectedValueOnce(new Error('Server error'))
        .mockRejectedValueOnce(new Error('Server error'))
        .mockResolvedValue({ data: 'success', status: 200 });

      const result = await client.request('GET', '/test');
      const elapsed = Date.now() - startTime;
      
      expect(result.data).toBe('success');
      expect(elapsed).toBeGreaterThan(3000); // Should have waited for retries
    });
  });

  describe('Error Classification', () => {
    it('should classify 4xx errors as client errors', () => {
      const error = {
        response: { status: 404 },
        message: 'Not Found'
      };

      const classified = client.classifyError(error);
      
      expect(classified.type).toBe('CLIENT_ERROR');
      expect(classified.retryable).toBe(false);
    });

    it('should classify 5xx errors as server errors', () => {
      const error = {
        response: { status: 500 },
        message: 'Internal Server Error'
      };

      const classified = client.classifyError(error);
      
      expect(classified.type).toBe('SERVER_ERROR');
      expect(classified.retryable).toBe(true);
    });

    it('should classify network errors as retryable', () => {
      const error = {
        code: 'ENOTFOUND',
        message: 'Network error'
      };

      const classified = client.classifyError(error);
      
      expect(classified.type).toBe('NETWORK_ERROR');
      expect(classified.retryable).toBe(true);
    });
  });

  describe('Request Caching', () => {
    it('should cache GET requests', async () => {
      const cache = new RequestCache({ ttl: 300 });
      client.cache = cache;

      const mockResponse = { data: 'cached_data', status: 200 };
      client._makeRequest = jest.fn().mockResolvedValue(mockResponse);

      // First request
      const result1 = await client.request('GET', '/test');
      
      // Second request (should use cache)
      const result2 = await client.request('GET', '/test');
      
      expect(result1.data).toBe('cached_data');
      expect(result2.data).toBe('cached_data');
      expect(client._makeRequest).toHaveBeenCalledTimes(1);
    });

    it('should not cache non-GET requests', async () => {
      const cache = new RequestCache({ ttl: 300 });
      client.cache = cache;

      const mockResponse = { data: 'post_data', status: 201 };
      client._makeRequest = jest.fn().mockResolvedValue(mockResponse);

      await client.request('POST', '/test', { data: 'test' });
      await client.request('POST', '/test', { data: 'test' });
      
      expect(client._makeRequest).toHaveBeenCalledTimes(2);
    });
  });

  describe('Batch Operations', () => {
    it('should batch multiple requests efficiently', async () => {
      const requests = [
        { method: 'GET', path: '/repos/owner/repo1' },
        { method: 'GET', path: '/repos/owner/repo2' },
        { method: 'GET', path: '/repos/owner/repo3' }
      ];

      client._makeRequest = jest.fn()
        .mockResolvedValueOnce({ data: { name: 'repo1' }, status: 200 })
        .mockResolvedValueOnce({ data: { name: 'repo2' }, status: 200 })
        .mockResolvedValueOnce({ data: { name: 'repo3' }, status: 200 });

      const results = await client.batchRequests(requests);
      
      expect(results).toHaveLength(3);
      expect(results[0].data.name).toBe('repo1');
      expect(results[1].data.name).toBe('repo2');
      expect(results[2].data.name).toBe('repo3');
    });

    it('should handle partial failures in batch operations', async () => {
      const requests = [
        { method: 'GET', path: '/repos/owner/repo1' },
        { method: 'GET', path: '/repos/owner/invalid' },
        { method: 'GET', path: '/repos/owner/repo3' }
      ];

      client._makeRequest = jest.fn()
        .mockResolvedValueOnce({ data: { name: 'repo1' }, status: 200 })
        .mockRejectedValueOnce(new Error('Not Found'))
        .mockResolvedValueOnce({ data: { name: 'repo3' }, status: 200 });

      const results = await client.batchRequests(requests, { continueOnError: true });
      
      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[2].success).toBe(true);
    });
  });

  describe('Metrics Collection', () => {
    it('should collect request metrics', async () => {
      client.metrics = {
        recordRequest: jest.fn(),
        recordResponse: jest.fn(),
        recordError: jest.fn()
      };

      const mockResponse = { data: 'test', status: 200 };
      client._makeRequest = jest.fn().mockResolvedValue(mockResponse);

      await client.request('GET', '/test');
      
      expect(client.metrics.recordRequest).toHaveBeenCalledWith('GET', '/test');
      expect(client.metrics.recordResponse).toHaveBeenCalledWith(200, expect.any(Number));
    });

    it('should record error metrics', async () => {
      client.metrics = {
        recordRequest: jest.fn(),
        recordError: jest.fn()
      };

      const error = new Error('Test error');
      client._makeRequest = jest.fn().mockRejectedValue(error);

      try {
        await client.request('GET', '/test');
      } catch (e) {
        // Expected error
      }
      
      expect(client.metrics.recordError).toHaveBeenCalledWith('Test error', 'GET', '/test');
    });
  });
});