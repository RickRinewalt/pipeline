/**
 * YOLO-PRO Performance and Load Testing Suite
 * Comprehensive performance testing for all core components
 */

const fs = require('fs').promises;
const path = require('path');
const { Worker } = require('worker_threads');
const FileReferenceProtocol = require('../../../yolo-pro/src/file-reference-protocol');
const GitHubClient = require('../../../yolo-pro/src/cli/github-client');
const YoloWarp = require('../../../yolo-pro/src/cli/yolo-warp');

describe('Performance Testing Suite', () => {
  let performanceMetrics;
  
  beforeAll(() => {
    performanceMetrics = {
      tests: [],
      startTime: Date.now()
    };
  });
  
  afterAll(() => {
    // Generate performance report
    const report = {
      totalExecutionTime: Date.now() - performanceMetrics.startTime,
      tests: performanceMetrics.tests,
      summary: {
        totalTests: performanceMetrics.tests.length,
        averageExecutionTime: performanceMetrics.tests.reduce((sum, test) => 
          sum + test.executionTime, 0) / performanceMetrics.tests.length,
        slowestTest: performanceMetrics.tests.reduce((slowest, test) => 
          test.executionTime > slowest.executionTime ? test : slowest),
        fastestTest: performanceMetrics.tests.reduce((fastest, test) => 
          test.executionTime < fastest.executionTime ? test : fastest)
      }
    };
    
    console.log('📊 Performance Test Summary:');
    console.log(`   Total Tests: ${report.summary.totalTests}`);
    console.log(`   Average Time: ${report.summary.averageExecutionTime.toFixed(2)}ms`);
    console.log(`   Slowest: ${report.summary.slowestTest.name} (${report.summary.slowestTest.executionTime}ms)`);
    console.log(`   Fastest: ${report.summary.fastestTest.name} (${report.summary.fastestTest.executionTime}ms)`);
  });

  describe('File Reference Protocol Performance', () => {
    let protocol;
    
    beforeEach(() => {
      protocol = new FileReferenceProtocol();
    });

    it('should validate paths under 10ms each', async () => {
      const testPaths = [
        '/test/path/file1.js',
        './relative/path/file2.js', 
        '../parent/path/file3.js',
        'simple-file4.js'
      ];

      for (const testPath of testPaths) {
        const startTime = process.hrtime.bigint();
        
        await protocol.validatePath(testPath);
        
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
        
        expect(duration).toBeLessThan(10);
        
        performanceMetrics.tests.push({
          name: `validatePath: ${testPath}`,
          executionTime: duration,
          category: 'path-validation'
        });
      }
    });

    it('should handle 1000 path validations under 5 seconds', async () => {
      const paths = Array.from({ length: 1000 }, (_, i) => `/test/batch/file-${i}.js`);
      
      const startTime = process.hrtime.bigint();
      
      const promises = paths.map(path => protocol.validatePath(path));
      const results = await Promise.all(promises);
      
      const endTime = process.hrtime.bigint();
      const totalDuration = Number(endTime - startTime) / 1000000;
      
      expect(totalDuration).toBeLessThan(5000);
      expect(results).toHaveLength(1000);
      expect(results.every(result => result.hasOwnProperty('isValid'))).toBe(true);
      
      performanceMetrics.tests.push({
        name: 'Batch path validation (1000 paths)',
        executionTime: totalDuration,
        category: 'batch-processing',
        throughput: (1000 / totalDuration * 1000).toFixed(2) + ' paths/sec'
      });
    });

    it('should maintain performance under concurrent load', async () => {
      const concurrentRequests = 50;
      const pathsPerRequest = 20;
      
      const startTime = process.hrtime.bigint();
      
      const concurrentPromises = Array.from({ length: concurrentRequests }, (_, i) => {
        const paths = Array.from({ length: pathsPerRequest }, (_, j) => 
          `/concurrent/batch-${i}/file-${j}.js`
        );
        return Promise.all(paths.map(path => protocol.validatePath(path)));
      });
      
      const results = await Promise.all(concurrentPromises);
      
      const endTime = process.hrtime.bigint();
      const totalDuration = Number(endTime - startTime) / 1000000;
      
      const totalProcessed = concurrentRequests * pathsPerRequest;
      const throughput = (totalProcessed / totalDuration * 1000);
      
      expect(totalDuration).toBeLessThan(10000); // 10 seconds max
      expect(throughput).toBeGreaterThan(100); // At least 100 paths/sec
      expect(results).toHaveLength(concurrentRequests);
      
      performanceMetrics.tests.push({
        name: `Concurrent processing (${concurrentRequests}x${pathsPerRequest})`,
        executionTime: totalDuration,
        category: 'concurrent-load',
        throughput: throughput.toFixed(2) + ' paths/sec'
      });
    });
  });

  describe('GitHub Client Performance', () => {
    let githubClient;
    let mockResponses;
    
    beforeEach(() => {
      // Setup performance-optimized mock responses
      mockResponses = {
        user: { login: 'testuser', id: 12345 },
        repo: { name: 'test-repo', full_name: 'testuser/test-repo' },
        issue: { number: 123, title: 'Test Issue', state: 'open' }
      };
      
      githubClient = new GitHubClient({ token: 'test-token' });
      
      // Mock HTTP client for performance testing
      githubClient.request = jest.fn()
        .mockImplementation(async (method, url) => {
          // Simulate realistic API response times
          await new Promise(resolve => setTimeout(resolve, Math.random() * 50 + 10));
          
          if (url.includes('/user')) return { data: mockResponses.user };
          if (url.includes('/repos')) return { data: mockResponses.repo };
          if (url.includes('/issues')) return { data: mockResponses.issue };
          
          return { data: {} };
        });
    });

    it('should handle API requests under 100ms average', async () => {
      const requests = 50;
      const durations = [];
      
      for (let i = 0; i < requests; i++) {
        const startTime = process.hrtime.bigint();
        
        await githubClient.getUser();
        
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1000000;
        durations.push(duration);
      }
      
      const averageDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      const maxDuration = Math.max(...durations);
      const minDuration = Math.min(...durations);
      
      expect(averageDuration).toBeLessThan(100);
      
      performanceMetrics.tests.push({
        name: `GitHub API requests (${requests} calls)`,
        executionTime: averageDuration,
        category: 'api-performance',
        details: {
          average: averageDuration.toFixed(2) + 'ms',
          min: minDuration.toFixed(2) + 'ms', 
          max: maxDuration.toFixed(2) + 'ms'
        }
      });
    });

    it('should handle burst requests efficiently', async () => {
      const burstSize = 100;
      
      const startTime = process.hrtime.bigint();
      
      const promises = Array.from({ length: burstSize }, () => githubClient.getUser());
      const results = await Promise.all(promises);
      
      const endTime = process.hrtime.bigint();
      const totalDuration = Number(endTime - startTime) / 1000000;
      
      const averagePerRequest = totalDuration / burstSize;
      
      expect(averagePerRequest).toBeLessThan(50); // Should benefit from parallelization
      expect(results).toHaveLength(burstSize);
      
      performanceMetrics.tests.push({
        name: `GitHub API burst (${burstSize} concurrent)`,
        executionTime: totalDuration,
        category: 'api-burst',
        throughput: (burstSize / totalDuration * 1000).toFixed(2) + ' req/sec'
      });
    });
  });

  describe('YOLO-Warp Workflow Performance', () => {
    let yoloWarp;
    let mockDependencies;
    
    beforeEach(() => {
      mockDependencies = {
        gitHubClient: {
          createIssue: jest.fn().mockResolvedValue({ number: 123, id: 'issue-123' }),
          createPullRequest: jest.fn().mockResolvedValue({ number: 456 }),
          getRepository: jest.fn().mockResolvedValue({ name: 'test-repo' })
        },
        gitAutomation: {
          createBranch: jest.fn().mockResolvedValue(true),
          commitChanges: jest.fn().mockResolvedValue(true),
          pushChanges: jest.fn().mockResolvedValue(true)
        }
      };
      
      yoloWarp = new YoloWarp(mockDependencies);
    });

    it('should create milestone under 60 seconds', async () => {
      const milestone = {
        title: 'Performance Test Milestone',
        features: Array.from({ length: 5 }, (_, i) => ({
          title: `Feature ${i + 1}`,
          tasks: Array.from({ length: 3 }, (_, j) => `Task ${j + 1}`)
        }))
      };
      
      const startTime = process.hrtime.bigint();
      
      const result = await yoloWarp.execute('perf-milestone', {
        milestone,
        parallel: true
      });
      
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000;
      
      expect(duration).toBeLessThan(60000);
      expect(result.success).toBe(true);
      
      performanceMetrics.tests.push({
        name: 'YOLO-Warp milestone creation',
        executionTime: duration,
        category: 'workflow-performance',
        details: {
          features: milestone.features.length,
          totalTasks: milestone.features.reduce((sum, f) => sum + f.tasks.length, 0)
        }
      });
    }, 65000);

    it('should scale linearly with feature count', async () => {
      const featureCounts = [1, 2, 5, 10];
      const results = [];
      
      for (const featureCount of featureCounts) {
        const milestone = {
          title: `Scale Test ${featureCount} Features`,
          features: Array.from({ length: featureCount }, (_, i) => ({
            title: `Feature ${i + 1}`,
            tasks: ['Task 1', 'Task 2']
          }))
        };
        
        const startTime = process.hrtime.bigint();
        
        await yoloWarp.execute(`scale-${featureCount}`, {
          milestone,
          parallel: true
        });
        
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1000000;
        
        results.push({
          featureCount,
          duration,
          durationPerFeature: duration / featureCount
        });
      }
      
      // Check that scaling is reasonable (not exponential)
      const scalingFactors = results.slice(1).map((result, i) => 
        result.durationPerFeature / results[i].durationPerFeature
      );
      
      // Scaling factor should be less than 2x (ideally close to 1 for linear scaling)
      scalingFactors.forEach(factor => {
        expect(factor).toBeLessThan(2);
      });
      
      performanceMetrics.tests.push({
        name: 'YOLO-Warp scaling test',
        executionTime: results.reduce((sum, r) => sum + r.duration, 0),
        category: 'scalability',
        details: {
          results: results.map(r => ({
            features: r.featureCount,
            totalTime: r.duration.toFixed(2) + 'ms',
            timePerFeature: r.durationPerFeature.toFixed(2) + 'ms'
          }))
        }
      });
    }, 120000);
  });

  describe('Memory Performance', () => {
    it('should not leak memory during batch operations', async () => {
      const protocol = new FileReferenceProtocol();
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Process 500 path validations
      for (let batch = 0; batch < 10; batch++) {
        const paths = Array.from({ length: 50 }, (_, i) => 
          `/memory-test/batch-${batch}/file-${i}.js`
        );
        
        await Promise.all(paths.map(path => protocol.validatePath(path)));
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be minimal (<5MB for 500 operations)
      expect(memoryIncrease).toBeLessThan(5 * 1024 * 1024);
      
      performanceMetrics.tests.push({
        name: 'Memory leak test (500 operations)',
        executionTime: 0, // N/A for memory test
        category: 'memory-performance',
        memoryIncrease: (memoryIncrease / 1024 / 1024).toFixed(2) + 'MB'
      });
    });

    it('should handle large data structures efficiently', async () => {
      const largeDataStructure = {
        milestone: {
          title: 'Large Milestone',
          description: 'A'.repeat(10000), // 10KB description
          features: Array.from({ length: 100 }, (_, i) => ({
            title: `Feature ${i}`,
            description: 'B'.repeat(1000), // 1KB per feature
            tasks: Array.from({ length: 20 }, (_, j) => ({
              title: `Task ${j}`,
              description: 'C'.repeat(500) // 500B per task
            }))
          }))
        }
      };
      
      const memoryBefore = process.memoryUsage().heapUsed;
      const startTime = process.hrtime.bigint();
      
      // Simulate processing large data structure
      const jsonString = JSON.stringify(largeDataStructure);
      const parsedData = JSON.parse(jsonString);
      
      // Verify data integrity
      expect(parsedData.milestone.features).toHaveLength(100);
      
      const endTime = process.hrtime.bigint();
      const memoryAfter = process.memoryUsage().heapUsed;
      
      const duration = Number(endTime - startTime) / 1000000;
      const memoryUsed = memoryAfter - memoryBefore;
      
      expect(duration).toBeLessThan(1000); // Should complete under 1 second
      
      performanceMetrics.tests.push({
        name: 'Large data structure processing',
        executionTime: duration,
        category: 'data-processing',
        dataSize: (jsonString.length / 1024).toFixed(2) + 'KB',
        memoryUsed: (memoryUsed / 1024 / 1024).toFixed(2) + 'MB'
      });
    });
  });

  describe('Concurrent Processing', () => {
    it('should handle multiple workflows simultaneously', async () => {
      const concurrentWorkflows = 5;
      const workflowPromises = [];
      
      const startTime = process.hrtime.bigint();
      
      for (let i = 0; i < concurrentWorkflows; i++) {
        const yoloWarp = new YoloWarp({
          gitHubClient: {
            createIssue: jest.fn().mockResolvedValue({ number: 100 + i }),
            createPullRequest: jest.fn().mockResolvedValue({ number: 200 + i })
          },
          gitAutomation: {
            createBranch: jest.fn().mockResolvedValue(true),
            commitChanges: jest.fn().mockResolvedValue(true)
          }
        });
        
        const milestone = {
          title: `Concurrent Milestone ${i}`,
          features: [{
            title: `Feature ${i}`,
            tasks: ['Task 1', 'Task 2']
          }]
        };
        
        workflowPromises.push(
          yoloWarp.execute(`concurrent-${i}`, { milestone })
        );
      }
      
      const results = await Promise.all(workflowPromises);
      
      const endTime = process.hrtime.bigint();
      const totalDuration = Number(endTime - startTime) / 1000000;
      
      expect(results).toHaveLength(concurrentWorkflows);
      expect(results.every(r => r.success)).toBe(true);
      
      // Concurrent execution should be faster than sequential
      const estimatedSequentialTime = 5000 * concurrentWorkflows; // 5 seconds each
      expect(totalDuration).toBeLessThan(estimatedSequentialTime * 0.7); // At least 30% faster
      
      performanceMetrics.tests.push({
        name: `Concurrent workflows (${concurrentWorkflows})`,
        executionTime: totalDuration,
        category: 'concurrency',
        parallelEfficiency: ((estimatedSequentialTime / totalDuration) * 100).toFixed(1) + '%'
      });
    }, 30000);
  });
});