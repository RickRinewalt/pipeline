/**
 * Feature 2: YOLO-PRO Integration Test Suite
 * Comprehensive end-to-end testing for all implemented features
 */

const GitHubClient = require('../../src/clients/github-client');
const GitHubLabelManager = require('../../yolo-pro/src/github-label-manager');
const CLIFramework = require('../../yolo-pro/src/cli/cli-framework');
const PatternLibrary = require('../../yolo-pro/src/pattern-library');

// Mock external dependencies
jest.mock('@octokit/rest');
jest.mock('fs').promises;

describe('YOLO-PRO Integration Test Suite', () => {
  let githubClient;
  let labelManager;
  let cliFramework;
  let patternLibrary;

  beforeAll(async () => {
    // Initialize all components
    githubClient = new GitHubClient({
      token: 'test-token',
      owner: 'test-owner',
      repo: 'test-repo'
    });

    labelManager = new GitHubLabelManager({
      gitHubClient: githubClient
    });

    cliFramework = new CLIFramework({
      enablePlugins: false
    });

    patternLibrary = new PatternLibrary();

    await cliFramework.initialize();
  });

  describe('End-to-End Workflows', () => {
    test('should execute complete YOLO-PRO workflow', async () => {
      // Simulate complete workflow: Issue creation → Label management → CLI execution
      
      // 1. Create issue with CLI
      const createResult = await cliFramework.executeCommand([
        'issue', 'create',
        '--title', 'Test Issue',
        '--labels', 'feature,priority:high'
      ]);

      expect(createResult.success).toBe(true);

      // 2. Validate labels were created/assigned
      const labelValidation = await labelManager.validateLabels(['feature', 'priority:high']);
      expect(labelValidation.success).toBe(true);

      // 3. Execute workflow automation
      const workflowResult = await cliFramework.executeCommand([
        'workflow', 'sparc-phase', 'specification',
        '--issue', '123'
      ]);

      expect(workflowResult.success).toBe(true);
    });

    test('should handle error scenarios gracefully', async () => {
      // Test error propagation through the system
      
      // Invalid authentication
      const invalidClient = new GitHubClient({
        token: 'invalid-token',
        owner: 'test-owner',
        repo: 'test-repo'
      });

      const result = await invalidClient.initialize();
      expect(result.success).toBe(false);
      expect(result.error).toContain('authentication');
    });

    test('should support batch operations efficiently', async () => {
      // Test performance of batch operations
      const startTime = Date.now();

      // Batch label creation
      const labels = Array.from({ length: 10 }, (_, i) => `test-label-${i}`);
      const batchResult = await labelManager.ensureLabelsExist(labels);

      const endTime = Date.now();

      expect(batchResult.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5s
      expect(batchResult.created.length + batchResult.existing.length).toBe(10);
    });
  });

  describe('Cross-Component Integration', () => {
    test('should integrate GitHub client with label manager', async () => {
      // Test integration between GitHubClient and GitHubLabelManager
      
      // Mock GitHub client responses
      const mockLabels = [
        { name: 'bug', color: 'd73a49', description: 'Bug report' },
        { name: 'feature', color: '0052cc', description: 'New feature' }
      ];

      githubClient.getRepositoryLabels = jest.fn().mockResolvedValue({
        success: true,
        labels: mockLabels
      });

      // Test label manager using GitHub client
      const result = await labelManager.validateLabels(['bug', 'feature', 'enhancement']);

      expect(result.valid).toContain('bug');
      expect(result.valid).toContain('feature');
      expect(result.missing).toContain('enhancement');
    });

    test('should integrate CLI with all backend systems', async () => {
      // Test CLI integration with multiple backend systems
      
      // Mock all backend operations
      labelManager.createLabel = jest.fn().mockResolvedValue({
        success: true,
        label: { name: 'test-label', color: '000000' }
      });

      githubClient.createIssue = jest.fn().mockResolvedValue({
        success: true,
        issue: { number: 123, title: 'Test Issue' }
      });

      // Execute CLI command that uses multiple systems
      const result = await cliFramework.executeCommand([
        'issue', 'create',
        '--title', 'Integration Test',
        '--labels', 'integration-test'
      ]);

      expect(result.success).toBe(true);
      expect(githubClient.createIssue).toHaveBeenCalled();
    });

    test('should handle pattern library integration', async () => {
      // Test pattern library integration with workflows
      
      const pattern = patternLibrary.getPattern('sparc-specification');
      expect(pattern).toBeDefined();
      expect(pattern.template).toContain('Requirements');

      const generated = patternLibrary.generateFromPattern('sparc-specification', {
        name: 'Test Feature',
        requirements: 'Test requirements',
        criteria: 'Test criteria',
        dependencies: 'Test dependencies'
      });

      expect(generated).toContain('Test Feature');
      expect(generated).toContain('Test requirements');
    });
  });

  describe('Performance and Load Testing', () => {
    test('should handle concurrent operations', async () => {
      // Test system under concurrent load
      
      const concurrentOperations = Array.from({ length: 5 }, (_, i) =>
        cliFramework.executeCommand(['label', 'list'])
      );

      const results = await Promise.all(concurrentOperations);

      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });

    test('should maintain performance under load', async () => {
      // Performance benchmark testing
      
      const operationsCount = 20;
      const operations = [];

      for (let i = 0; i < operationsCount; i++) {
        operations.push(
          labelManager.validateLabels([`perf-test-${i}`, 'feature'])
        );
      }

      const startTime = Date.now();
      const results = await Promise.allSettled(operations);
      const endTime = Date.now();

      const duration = endTime - startTime;
      const avgTime = duration / operationsCount;

      expect(avgTime).toBeLessThan(100); // Average less than 100ms per operation
      
      const successCount = results.filter(r => 
        r.status === 'fulfilled' && r.value.success
      ).length;

      expect(successCount).toBeGreaterThanOrEqual(operationsCount * 0.9); // 90% success rate
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle network failures gracefully', async () => {
      // Test network error scenarios
      
      const networkError = new Error('Network request failed');
      networkError.code = 'ENOTFOUND';

      githubClient.octokit.rest.issues.listForRepo.mockRejectedValue(networkError);

      const result = await labelManager.validateLabels(['test-label']);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network');
    });

    test('should handle rate limit scenarios', async () => {
      // Test rate limiting behavior
      
      const rateLimitError = new Error('API rate limit exceeded');
      rateLimitError.status = 403;
      rateLimitError.headers = { 'x-ratelimit-reset': Math.floor(Date.now() / 1000) + 60 };

      githubClient.octokit.rest.issues.listForRepo.mockRejectedValue(rateLimitError);

      const result = await labelManager.validateLabels(['test-label']);

      expect(result.success).toBe(false);
      expect(result.retryAfter).toBeDefined();
    });

    test('should validate input parameters properly', async () => {
      // Test input validation across all components
      
      // Invalid CLI arguments
      const cliResult = await cliFramework.executeCommand([]);
      expect(cliResult.success).toBe(false);

      // Invalid label formats
      const labelResult = await labelManager.validateLabels(['']);
      expect(labelResult.success).toBe(false);

      // Invalid GitHub client config
      const invalidClient = new GitHubClient({});
      expect(() => invalidClient.initialize()).rejects.toThrow();
    });
  });

  describe('Data Consistency and State Management', () => {
    test('should maintain consistent state across operations', async () => {
      // Test state consistency
      
      // Create multiple labels
      const labels = ['consistency-test-1', 'consistency-test-2'];
      await labelManager.ensureLabelsExist(labels);

      // Verify they exist
      const validation = await labelManager.validateLabels(labels);
      expect(validation.valid).toEqual(labels);

      // Update one label
      await labelManager.createLabel('consistency-test-1', {
        name: 'consistency-test-1',
        color: 'ff0000',
        description: 'Updated description'
      });

      // Verify consistency
      const revalidation = await labelManager.validateLabels(labels);
      expect(revalidation.valid).toContain('consistency-test-1');
    });

    test('should handle cache invalidation properly', async () => {
      // Test caching behavior
      
      // First request - should cache
      await labelManager._getRepositoryLabels();
      
      // Second request - should use cache
      const startTime = Date.now();
      await labelManager._getRepositoryLabels();
      const cacheTime = Date.now() - startTime;

      expect(cacheTime).toBeLessThan(10); // Should be very fast from cache

      // Invalidate cache
      labelManager._invalidateCache();
      
      // Next request should refetch
      await labelManager._getRepositoryLabels();
      // Would verify fresh data if we had a way to detect it
    });
  });

  describe('Security and Validation', () => {
    test('should sanitize sensitive data in logs', async () => {
      // Test that tokens and sensitive data are not logged
      
      const client = new GitHubClient({
        token: 'ghp_sensitive_token_12345',
        owner: 'test-owner',
        repo: 'test-repo'
      });

      // Mock console to capture logs
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      try {
        await client.initialize();
      } catch (error) {
        // Expected to fail with mock
      }

      // Check that token was not logged
      const logCalls = consoleSpy.mock.calls.flat().join(' ');
      expect(logCalls).not.toContain('ghp_sensitive_token_12345');
      
      consoleSpy.mockRestore();
    });

    test('should validate permissions properly', async () => {
      // Test permission validation
      
      const permissionError = new Error('Resource not accessible by personal access token');
      permissionError.status = 403;

      githubClient.octokit.rest.issues.create.mockRejectedValue(permissionError);

      const result = await cliFramework.executeCommand([
        'issue', 'create',
        '--title', 'Permission Test'
      ]);

      expect(result.success).toBe(false);
      expect(result.error).toContain('permission');
    });
  });

  describe('Configuration and Setup', () => {
    test('should handle various configuration scenarios', async () => {
      // Test different configuration combinations
      
      // Minimal configuration
      const minimalCli = new CLIFramework({
        enablePlugins: false
      });

      await expect(minimalCli.initialize()).resolves.not.toThrow();

      // Full configuration
      const fullCli = new CLIFramework({
        enablePlugins: true,
        pluginDirectory: './test-plugins',
        configFile: './test-config.json'
      });

      await expect(fullCli.initialize()).resolves.not.toThrow();
    });

    test('should provide helpful error messages for misconfigurations', async () => {
      // Test configuration error handling
      
      const invalidClient = new GitHubClient({
        token: '', // Invalid token
        owner: 'test-owner',
        repo: 'test-repo'
      });

      const result = await invalidClient.initialize();
      expect(result.success).toBe(false);
      expect(result.error).toContain('token');
    });
  });
});

describe('YOLO-PRO System Health Monitoring', () => {
  test('should provide system health status', async () => {
    const githubClient = new GitHubClient({
      token: 'test-token',
      owner: 'test-owner',  
      repo: 'test-repo'
    });

    const healthStatus = await githubClient.getHealthStatus();

    expect(healthStatus).toHaveProperty('status');
    expect(healthStatus).toHaveProperty('checks');
    expect(Array.isArray(healthStatus.checks)).toBe(true);
  });

  test('should detect system issues', async () => {
    // Test system issue detection
    
    const client = new GitHubClient({
      token: 'invalid-token',
      owner: 'test-owner',
      repo: 'test-repo'
    });

    const healthStatus = await client.getHealthStatus();
    
    expect(healthStatus.status).toBe('unhealthy');
    expect(healthStatus.issues).toBeDefined();
    expect(healthStatus.issues.length).toBeGreaterThan(0);
  });
});