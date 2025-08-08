/**
 * Feature 2: Performance Benchmarking and Load Testing
 * Comprehensive performance testing for YOLO-PRO components
 */

const { performance } = require('perf_hooks');
const GitHubLabelManager = require('../../yolo-pro/src/github-label-manager');
const CLIFramework = require('../../yolo-pro/src/cli/cli-framework');
const PatternLibrary = require('../../yolo-pro/src/pattern-library');

describe('YOLO-PRO Performance Benchmarks', () => {
  let labelManager;
  let cli;
  let patternLibrary;

  beforeAll(async () => {
    // Setup with mocked dependencies for consistent performance testing
    labelManager = new GitHubLabelManager({
      gitHubClient: {
        options: { owner: 'test', repo: 'test' },
        octokit: {
          rest: {
            issues: {
              listLabelsForRepo: jest.fn().mockResolvedValue({
                data: generateMockLabels(100) // 100 labels for testing
              }),
              createLabel: jest.fn().mockResolvedValue({
                data: { name: 'test', color: '000000' }
              })
            }
          }
        }
      }
    });

    cli = new CLIFramework({ enablePlugins: false });
    await cli.initialize();

    patternLibrary = new PatternLibrary();
  });

  describe('Label Management Performance', () => {
    test('should validate 100 labels within 500ms', async () => {
      const labels = Array.from({ length: 100 }, (_, i) => `perf-label-${i}`);
      
      const startTime = performance.now();
      const result = await labelManager.validateLabels(labels);
      const endTime = performance.now();

      const duration = endTime - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(500); // Should complete within 500ms
      
      console.log(`✅ Label validation: ${labels.length} labels in ${duration.toFixed(2)}ms`);
    });

    test('should handle bulk operations efficiently', async () => {
      const batchSizes = [10, 50, 100];
      const results = {};

      for (const size of batchSizes) {
        const labels = Array.from({ length: size }, (_, i) => `bulk-${size}-${i}`);
        
        const startTime = performance.now();
        await labelManager.ensureLabelsExist(labels);
        const endTime = performance.now();

        const duration = endTime - startTime;
        const avgTime = duration / size;

        results[size] = { duration, avgTime };

        expect(avgTime).toBeLessThan(10); // Average less than 10ms per label
        console.log(`✅ Bulk operation: ${size} labels in ${duration.toFixed(2)}ms (${avgTime.toFixed(2)}ms avg)`);
      }

      // Performance should scale reasonably
      expect(results[100].avgTime).toBeLessThan(results[10].avgTime * 2);
    });

    test('should cache repository labels effectively', async () => {
      // Clear any existing cache
      labelManager._invalidateCache();

      // First call - should cache
      const startTime1 = performance.now();
      await labelManager._getRepositoryLabels();
      const firstCallDuration = performance.now() - startTime1;

      // Second call - should use cache
      const startTime2 = performance.now();
      await labelManager._getRepositoryLabels();
      const cachedCallDuration = performance.now() - startTime2;

      expect(cachedCallDuration).toBeLessThan(firstCallDuration * 0.1); // Cache should be 10x faster
      console.log(`✅ Cache performance: First call ${firstCallDuration.toFixed(2)}ms, Cached call ${cachedCallDuration.toFixed(2)}ms`);
    });
  });

  describe('CLI Framework Performance', () => {
    test('should parse commands quickly', async () => {
      const commands = [
        ['help'],
        ['label', 'list'],
        ['issue', 'create', '--title', 'Test', '--labels', 'test'],
        ['workflow', 'sparc-phase', 'specification', '--issue', '123']
      ];

      const results = [];

      for (const command of commands) {
        const startTime = performance.now();
        const parsed = cli.parseArguments(command);
        const endTime = performance.now();

        const duration = endTime - startTime;
        results.push({ command: command.join(' '), duration });

        expect(parsed.valid).toBe(true);
        expect(duration).toBeLessThan(5); // Should parse within 5ms
      }

      const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
      console.log(`✅ Command parsing: Average ${avgDuration.toFixed(2)}ms per command`);
    });

    test('should handle concurrent command execution', async () => {
      // Register a test command for performance testing
      cli.registerCommand('perf-test', {
        description: 'Performance test command',
        execute: async () => {
          // Simulate some work
          await new Promise(resolve => setTimeout(resolve, 10));
          return { success: true, message: 'Performance test completed' };
        }
      });

      const concurrentCount = 20;
      const commands = Array.from({ length: concurrentCount }, () => ['perf-test']);

      const startTime = performance.now();
      const results = await Promise.all(
        commands.map(cmd => cli.executeCommand(cmd))
      );
      const endTime = performance.now();

      const totalDuration = endTime - startTime;
      const avgDuration = totalDuration / concurrentCount;

      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      expect(avgDuration).toBeLessThan(50); // Should handle concurrency well
      console.log(`✅ Concurrent execution: ${concurrentCount} commands in ${totalDuration.toFixed(2)}ms (${avgDuration.toFixed(2)}ms avg)`);
    });
  });

  describe('Pattern Library Performance', () => {
    test('should generate patterns quickly', async () => {
      const patterns = ['sparc-specification', 'tdd-test-structure', 'github-issue-epic'];
      const variables = {
        name: 'Performance Test',
        requirements: 'Test requirements for performance testing',
        criteria: 'Performance criteria validation',
        dependencies: 'No dependencies for performance testing'
      };

      const results = [];

      for (const patternId of patterns) {
        const startTime = performance.now();
        const generated = patternLibrary.generateFromPattern(patternId, variables);
        const endTime = performance.now();

        const duration = endTime - startTime;
        results.push({ pattern: patternId, duration });

        expect(generated).toContain(variables.name);
        expect(duration).toBeLessThan(5); // Should generate within 5ms
      }

      const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
      console.log(`✅ Pattern generation: Average ${avgDuration.toFixed(2)}ms per pattern`);
    });

    test('should handle multiple pattern generations efficiently', async () => {
      const batchSizes = [10, 50, 100];
      
      for (const size of batchSizes) {
        const operations = Array.from({ length: size }, (_, i) => {
          return () => patternLibrary.generateFromPattern('sparc-specification', {
            name: `Batch Test ${i}`,
            requirements: `Requirements ${i}`,
            criteria: `Criteria ${i}`,
            dependencies: `Dependencies ${i}`
          });
        });

        const startTime = performance.now();
        const results = operations.map(op => op());
        const endTime = performance.now();

        const duration = endTime - startTime;
        const avgTime = duration / size;

        expect(results.length).toBe(size);
        expect(avgTime).toBeLessThan(2); // Should average less than 2ms per generation

        console.log(`✅ Batch pattern generation: ${size} patterns in ${duration.toFixed(2)}ms (${avgTime.toFixed(2)}ms avg)`);
      }
    });
  });

  describe('Memory Usage and Cleanup', () => {
    test('should not have memory leaks in repeated operations', async () => {
      const getMemoryUsage = () => process.memoryUsage().heapUsed;
      
      const initialMemory = getMemoryUsage();
      
      // Perform many operations
      for (let i = 0; i < 100; i++) {
        await labelManager.validateLabels([`memory-test-${i}`]);
        cli.parseArguments(['label', 'list']);
        patternLibrary.generateFromPattern('sparc-specification', {
          name: `Memory Test ${i}`,
          requirements: 'Memory test requirements',
          criteria: 'Memory test criteria',
          dependencies: 'Memory test dependencies'
        });
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = getMemoryUsage();
      const memoryIncrease = finalMemory - initialMemory;
      const memoryIncreaseMB = memoryIncrease / 1024 / 1024;

      console.log(`✅ Memory usage: Increased by ${memoryIncreaseMB.toFixed(2)}MB after 100 operations`);
      
      // Memory increase should be reasonable (less than 10MB for 100 operations)
      expect(memoryIncreaseMB).toBeLessThan(10);
    });
  });

  describe('Scalability Testing', () => {
    test('should scale linearly with data size', async () => {
      const dataSizes = [10, 20, 40, 80];
      const scalabilityResults = [];

      for (const size of dataSizes) {
        const labels = Array.from({ length: size }, (_, i) => `scale-test-${size}-${i}`);
        
        const startTime = performance.now();
        await labelManager.validateLabels(labels);
        const endTime = performance.now();

        const duration = endTime - startTime;
        const throughput = size / duration; // labels per ms

        scalabilityResults.push({ size, duration, throughput });

        console.log(`✅ Scalability: ${size} labels processed in ${duration.toFixed(2)}ms (throughput: ${throughput.toFixed(2)} labels/ms)`);
      }

      // Verify reasonable scalability - throughput shouldn't decrease dramatically
      const firstThroughput = scalabilityResults[0].throughput;
      const lastThroughput = scalabilityResults[scalabilityResults.length - 1].throughput;
      
      // Allow for some performance degradation but not more than 50%
      expect(lastThroughput).toBeGreaterThan(firstThroughput * 0.5);
    });
  });

  // Helper function to generate mock labels for testing
  function generateMockLabels(count) {
    const colors = ['ff0000', '00ff00', '0000ff', 'ffff00', 'ff00ff', '00ffff'];
    const types = ['bug', 'feature', 'enhancement', 'question', 'help wanted'];
    
    return Array.from({ length: count }, (_, i) => ({
      name: `${types[i % types.length]}-${i}`,
      color: colors[i % colors.length],
      description: `Mock label ${i} for performance testing`
    }));
  }
});

describe('Load Testing', () => {
  test('should handle high-frequency operations', async () => {
    const cli = new CLIFramework({ enablePlugins: false });
    await cli.initialize();

    // Register a fast test command
    cli.registerCommand('load-test', {
      description: 'Load test command',
      execute: async () => ({ success: true, timestamp: Date.now() })
    });

    const operationsPerSecond = 50;
    const testDurationSeconds = 2;
    const totalOperations = operationsPerSecond * testDurationSeconds;

    const operations = [];
    const results = [];

    // Create all operations
    for (let i = 0; i < totalOperations; i++) {
      operations.push(
        cli.executeCommand(['load-test']).then(result => {
          results.push({
            success: result.success,
            timestamp: Date.now()
          });
          return result;
        })
      );

      // Throttle to maintain desired rate
      if (i % operationsPerSecond === 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Wait for all operations to complete
    const startTime = Date.now();
    await Promise.all(operations);
    const endTime = Date.now();

    const actualDuration = (endTime - startTime) / 1000;
    const actualRate = results.length / actualDuration;
    const successRate = results.filter(r => r.success).length / results.length;

    console.log(`✅ Load test: ${results.length} operations in ${actualDuration.toFixed(2)}s (${actualRate.toFixed(2)} ops/s)`);
    console.log(`✅ Success rate: ${(successRate * 100).toFixed(2)}%`);

    expect(successRate).toBeGreaterThan(0.95); // 95% success rate
    expect(actualRate).toBeGreaterThan(operationsPerSecond * 0.8); // Within 80% of target rate
  }, 10000); // 10 second timeout for load test
});