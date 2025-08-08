/**
 * Performance tests for hot-swapping capabilities
 * Tests the speed and efficiency of module hot-swapping
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ModularEngine } from '../../src/architecture/ModularEngine.js';
import { performance } from 'perf_hooks';

describe('Hot Swapping Performance Tests', () => {
  let engine;
  let performanceMetrics;

  beforeEach(async () => {
    engine = new ModularEngine({
      enableHotSwap: true,
      maxConcurrentPlugins: 100
    });
    
    await engine.initialize();
    
    performanceMetrics = {
      swapTimes: [],
      memoryUsage: [],
      cpuTimes: []
    };
  });

  afterEach(async () => {
    await engine.shutdown();
  });

  describe('Single Module Hot Swap Performance', () => {
    it('should hot-swap a module in under 100ms', async () => {
      // Load initial module
      const moduleSpec = {
        id: 'perf-test-module',
        name: 'Performance Test Module',
        version: '1.0.0',
        factory: () => ({
          version: '1.0.0',
          initialize: jest.fn().mockResolvedValue(true),
          getState: () => ({ counter: 5 }),
          cleanup: jest.fn()
        })
      };

      await engine.loadModule(moduleSpec);

      // Prepare new version
      const newModuleSpec = {
        ...moduleSpec,
        version: '2.0.0',
        factory: () => ({
          version: '2.0.0',
          initialize: jest.fn().mockResolvedValue(true),
          setState: (state) => { /* restore state */ },
          cleanup: jest.fn()
        })
      };

      // Measure hot swap performance
      const startTime = performance.now();
      const memBefore = process.memoryUsage();

      await engine.hotSwapModule('perf-test-module', newModuleSpec);

      const endTime = performance.now();
      const memAfter = process.memoryUsage();

      const swapTime = endTime - startTime;
      const memoryDelta = memAfter.heapUsed - memBefore.heapUsed;

      expect(swapTime).toBeLessThan(100); // Less than 100ms
      expect(memoryDelta).toBeLessThan(10 * 1024 * 1024); // Less than 10MB memory increase

      performanceMetrics.swapTimes.push(swapTime);
      performanceMetrics.memoryUsage.push(memoryDelta);
    });

    it('should maintain consistent performance across multiple swaps', async () => {
      const moduleSpec = {
        id: 'consistency-test-module',
        name: 'Consistency Test Module',
        version: '1.0.0',
        factory: () => ({
          version: '1.0.0',
          initialize: jest.fn().mockResolvedValue(true),
          getState: () => ({ data: 'test' }),
          cleanup: jest.fn()
        })
      };

      await engine.loadModule(moduleSpec);

      const swapTimes = [];
      const swapCount = 20;

      // Perform multiple hot swaps
      for (let i = 1; i <= swapCount; i++) {
        const newSpec = {
          ...moduleSpec,
          version: `1.0.${i}`,
          factory: () => ({
            version: `1.0.${i}`,
            initialize: jest.fn().mockResolvedValue(true),
            setState: (state) => { /* restore state */ },
            getState: () => ({ data: 'test', iteration: i }),
            cleanup: jest.fn()
          })
        };

        const startTime = performance.now();
        await engine.hotSwapModule('consistency-test-module', newSpec);
        const endTime = performance.now();

        swapTimes.push(endTime - startTime);
      }

      // Verify performance consistency
      const avgSwapTime = swapTimes.reduce((a, b) => a + b, 0) / swapTimes.length;
      const maxSwapTime = Math.max(...swapTimes);
      const minSwapTime = Math.min(...swapTimes);

      expect(avgSwapTime).toBeLessThan(50); // Average under 50ms
      expect(maxSwapTime).toBeLessThan(200); // Max under 200ms
      expect(maxSwapTime / minSwapTime).toBeLessThan(5); // Variance under 5x

      // Performance should not degrade significantly over time
      const firstHalf = swapTimes.slice(0, swapCount / 2);
      const secondHalf = swapTimes.slice(swapCount / 2);
      
      const firstHalfAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const secondHalfAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
      
      expect(secondHalfAvg / firstHalfAvg).toBeLessThan(1.5); // Less than 50% degradation
    });
  });

  describe('Concurrent Hot Swap Performance', () => {
    it('should handle multiple concurrent hot swaps efficiently', async () => {
      const moduleCount = 10;
      const modules = [];

      // Load multiple modules
      for (let i = 0; i < moduleCount; i++) {
        const moduleSpec = {
          id: `concurrent-module-${i}`,
          name: `Concurrent Module ${i}`,
          version: '1.0.0',
          factory: () => ({
            id: i,
            version: '1.0.0',
            initialize: jest.fn().mockResolvedValue(true),
            getState: () => ({ moduleId: i, data: `initial-${i}` }),
            cleanup: jest.fn()
          })
        };

        await engine.loadModule(moduleSpec);
        modules.push(moduleSpec);
      }

      // Prepare concurrent hot swaps
      const swapPromises = modules.map(async (moduleSpec, i) => {
        const newSpec = {
          ...moduleSpec,
          version: '2.0.0',
          factory: () => ({
            id: i,
            version: '2.0.0',
            initialize: jest.fn().mockResolvedValue(true),
            setState: (state) => { /* restore state */ },
            getState: () => ({ moduleId: i, data: `updated-${i}` }),
            cleanup: jest.fn()
          })
        };

        return engine.hotSwapModule(moduleSpec.id, newSpec);
      });

      // Measure concurrent swap performance
      const startTime = performance.now();
      const memBefore = process.memoryUsage();

      await Promise.all(swapPromises);

      const endTime = performance.now();
      const memAfter = process.memoryUsage();

      const totalTime = endTime - startTime;
      const memoryDelta = memAfter.heapUsed - memBefore.heapUsed;

      // Should complete all swaps in reasonable time
      expect(totalTime).toBeLessThan(1000); // Under 1 second for 10 modules
      expect(memoryDelta).toBeLessThan(50 * 1024 * 1024); // Under 50MB

      // Verify all modules were swapped
      modules.forEach((moduleSpec) => {
        const module = engine.getModule(moduleSpec.id);
        expect(module.version).toBe('2.0.0');
      });
    });

    it('should prioritize hot swaps based on module importance', async () => {
      // Load critical and normal modules
      const criticalModule = {
        id: 'critical-module',
        name: 'Critical Module',
        version: '1.0.0',
        priority: 'critical',
        factory: () => ({
          type: 'critical',
          initialize: jest.fn().mockResolvedValue(true),
          cleanup: jest.fn()
        })
      };

      const normalModules = Array.from({ length: 5 }, (_, i) => ({
        id: `normal-module-${i}`,
        name: `Normal Module ${i}`,
        version: '1.0.0',
        priority: 'normal',
        factory: () => ({
          type: 'normal',
          id: i,
          initialize: jest.fn().mockResolvedValue(true),
          cleanup: jest.fn()
        })
      }));

      // Load all modules
      await engine.loadModule(criticalModule);
      for (const module of normalModules) {
        await engine.loadModule(module);
      }

      const swapStartTimes = new Map();
      const swapEndTimes = new Map();

      // Track swap timing for critical module
      const criticalSwapPromise = (async () => {
        swapStartTimes.set('critical-module', performance.now());
        await engine.hotSwapModule('critical-module', {
          ...criticalModule,
          version: '2.0.0',
          factory: () => ({
            type: 'critical',
            version: '2.0.0',
            initialize: jest.fn().mockResolvedValue(true),
            cleanup: jest.fn()
          })
        });
        swapEndTimes.set('critical-module', performance.now());
      })();

      // Track swap timing for normal modules (with small delays to simulate processing)
      const normalSwapPromises = normalModules.map(async (module) => {
        await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
        swapStartTimes.set(module.id, performance.now());
        await engine.hotSwapModule(module.id, {
          ...module,
          version: '2.0.0',
          factory: () => ({
            type: 'normal',
            version: '2.0.0',
            initialize: jest.fn().mockResolvedValue(true),
            cleanup: jest.fn()
          })
        });
        swapEndTimes.set(module.id, performance.now());
      });

      // Execute all swaps
      await Promise.all([criticalSwapPromise, ...normalSwapPromises]);

      // Verify critical module completed first or among the first
      const criticalTime = swapEndTimes.get('critical-module') - swapStartTimes.get('critical-module');
      const normalTimes = normalModules.map(m => 
        swapEndTimes.get(m.id) - swapStartTimes.get(m.id)
      );

      const avgNormalTime = normalTimes.reduce((a, b) => a + b, 0) / normalTimes.length;
      
      // Critical module should generally perform better or similar to normal modules
      expect(criticalTime).toBeLessThanOrEqual(avgNormalTime * 1.2);
    });
  });

  describe('Memory Management During Hot Swaps', () => {
    it('should not leak memory during hot swaps', async () => {
      const moduleSpec = {
        id: 'memory-test-module',
        name: 'Memory Test Module',
        version: '1.0.0',
        factory: () => {
          // Create some data to test memory cleanup
          const largeData = new Array(10000).fill('test-data');
          
          return {
            data: largeData,
            initialize: jest.fn().mockResolvedValue(true),
            getState: () => ({ dataSize: largeData.length }),
            cleanup: jest.fn(() => {
              largeData.length = 0; // Cleanup large data
            })
          };
        }
      };

      await engine.loadModule(moduleSpec);

      const initialMemory = process.memoryUsage();
      const swapCount = 10;

      // Perform multiple swaps to test memory management
      for (let i = 1; i <= swapCount; i++) {
        const newSpec = {
          ...moduleSpec,
          version: `1.0.${i}`,
          factory: () => {
            const largeData = new Array(10000).fill(`test-data-${i}`);
            
            return {
              data: largeData,
              version: `1.0.${i}`,
              initialize: jest.fn().mockResolvedValue(true),
              setState: (state) => { /* restore state */ },
              getState: () => ({ dataSize: largeData.length }),
              cleanup: jest.fn(() => {
                largeData.length = 0;
              })
            };
          }
        };

        await engine.hotSwapModule('memory-test-module', newSpec);
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
        
        // Small delay to allow cleanup
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory increase should be minimal (less than 20MB for 10 swaps)
      expect(memoryIncrease).toBeLessThan(20 * 1024 * 1024);
    });

    it('should handle memory pressure during hot swaps gracefully', async () => {
      // Create modules with varying memory usage
      const memoryIntensiveModules = Array.from({ length: 5 }, (_, i) => ({
        id: `memory-intensive-${i}`,
        name: `Memory Intensive Module ${i}`,
        version: '1.0.0',
        factory: () => {
          // Each module uses about 5MB
          const largeArray = new Array(500000).fill(`data-${i}-${Math.random()}`);
          
          return {
            id: i,
            data: largeArray,
            initialize: jest.fn().mockResolvedValue(true),
            getMemoryUsage: () => largeArray.length * 50, // Approximate bytes
            cleanup: jest.fn(() => {
              largeArray.length = 0;
            })
          };
        }
      }));

      // Load all memory-intensive modules
      for (const module of memoryIntensiveModules) {
        await engine.loadModule(module);
      }

      const memBefore = process.memoryUsage();

      // Perform hot swaps on all modules
      const swapPromises = memoryIntensiveModules.map(async (moduleSpec, i) => {
        const newSpec = {
          ...moduleSpec,
          version: '2.0.0',
          factory: () => {
            const largeArray = new Array(500000).fill(`updated-data-${i}-${Math.random()}`);
            
            return {
              id: i,
              data: largeArray,
              version: '2.0.0',
              initialize: jest.fn().mockResolvedValue(true),
              setState: (state) => { /* restore state */ },
              getMemoryUsage: () => largeArray.length * 50,
              cleanup: jest.fn(() => {
                largeArray.length = 0;
              })
            };
          }
        };

        return engine.hotSwapModule(moduleSpec.id, newSpec);
      });

      const startTime = performance.now();
      await Promise.all(swapPromises);
      const endTime = performance.now();

      const swapTime = endTime - startTime;
      const memAfter = process.memoryUsage();

      // Should complete within reasonable time even with high memory usage
      expect(swapTime).toBeLessThan(2000); // Under 2 seconds

      // Memory should not grow excessively
      const memoryGrowth = memAfter.heapUsed - memBefore.heapUsed;
      expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024); // Under 50MB growth
    });
  });

  describe('Hot Swap Queue Performance', () => {
    it('should process hot swap queue efficiently', async () => {
      const moduleCount = 20;
      const modules = [];

      // Load many modules
      for (let i = 0; i < moduleCount; i++) {
        const moduleSpec = {
          id: `queue-test-module-${i}`,
          name: `Queue Test Module ${i}`,
          version: '1.0.0',
          factory: () => ({
            id: i,
            initialize: jest.fn().mockResolvedValue(true),
            cleanup: jest.fn()
          })
        };

        await engine.loadModule(moduleSpec);
        modules.push(moduleSpec);
      }

      // Queue many hot swaps rapidly
      const queueStartTime = performance.now();
      
      const swapPromises = modules.map(async (moduleSpec, i) => {
        const newSpec = {
          ...moduleSpec,
          version: '2.0.0',
          factory: () => ({
            id: i,
            version: '2.0.0',
            initialize: jest.fn().mockResolvedValue(true),
            setState: (state) => { /* restore state */ },
            cleanup: jest.fn()
          })
        };

        // Add small random delay to simulate real-world timing
        await new Promise(resolve => setTimeout(resolve, Math.random() * 50));
        return engine.hotSwapModule(moduleSpec.id, newSpec);
      });

      await Promise.all(swapPromises);
      
      const queueEndTime = performance.now();
      const totalQueueTime = queueEndTime - queueStartTime;

      // Queue processing should be efficient
      expect(totalQueueTime).toBeLessThan(5000); // Under 5 seconds for 20 modules
      expect(engine.hotSwapQueue.length).toBe(0); // Queue should be empty

      // Verify all swaps completed
      modules.forEach((moduleSpec) => {
        const module = engine.getModule(moduleSpec.id);
        expect(module.version).toBe('2.0.0');
      });
    });
  });

  describe('Performance Benchmarks', () => {
    it('should meet performance benchmarks for hot swapping', async () => {
      const benchmarks = {
        singleSwapTime: 100, // ms
        concurrentSwapsTime: 1000, // ms for 10 modules
        memoryLeakThreshold: 10 * 1024 * 1024, // 10MB
        swapThroughput: 20 // swaps per second minimum
      };

      // Test single swap performance
      const singleModule = {
        id: 'benchmark-single',
        name: 'Benchmark Single',
        version: '1.0.0',
        factory: () => ({ initialize: jest.fn().mockResolvedValue(true) })
      };

      await engine.loadModule(singleModule);

      const singleStart = performance.now();
      await engine.hotSwapModule('benchmark-single', {
        ...singleModule,
        version: '2.0.0'
      });
      const singleTime = performance.now() - singleStart;

      expect(singleTime).toBeLessThan(benchmarks.singleSwapTime);

      // Test concurrent swap performance
      const concurrentModules = Array.from({ length: 10 }, (_, i) => ({
        id: `benchmark-concurrent-${i}`,
        name: `Benchmark Concurrent ${i}`,
        version: '1.0.0',
        factory: () => ({ initialize: jest.fn().mockResolvedValue(true) })
      }));

      for (const module of concurrentModules) {
        await engine.loadModule(module);
      }

      const concurrentStart = performance.now();
      await Promise.all(concurrentModules.map(module => 
        engine.hotSwapModule(module.id, { ...module, version: '2.0.0' })
      ));
      const concurrentTime = performance.now() - concurrentStart;

      expect(concurrentTime).toBeLessThan(benchmarks.concurrentSwapsTime);

      // Calculate throughput
      const throughput = (10 / concurrentTime) * 1000; // swaps per second
      expect(throughput).toBeGreaterThan(benchmarks.swapThroughput);

      console.log('Performance Benchmark Results:');
      console.log(`Single Swap Time: ${singleTime.toFixed(2)}ms (target: <${benchmarks.singleSwapTime}ms)`);
      console.log(`Concurrent Swaps Time: ${concurrentTime.toFixed(2)}ms (target: <${benchmarks.concurrentSwapsTime}ms)`);
      console.log(`Swap Throughput: ${throughput.toFixed(2)} swaps/sec (target: >${benchmarks.swapThroughput} swaps/sec)`);
    });
  });
});