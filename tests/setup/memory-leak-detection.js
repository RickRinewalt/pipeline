/**
 * Memory Leak Detection
 * Monitors for memory leaks and resource cleanup issues
 */

let baselineMemory;
let testMemorySnapshots = [];

beforeAll(() => {
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
  
  // Record baseline memory usage
  baselineMemory = process.memoryUsage();
  console.log(`📊 Baseline memory: ${(baselineMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
});

afterAll(() => {
  // Force garbage collection
  if (global.gc) {
    global.gc();
  }
  
  // Check for memory leaks
  const finalMemory = process.memoryUsage();
  const memoryIncrease = finalMemory.heapUsed - baselineMemory.heapUsed;
  const thresholdMB = 10; // 10MB threshold for memory leaks
  
  if (memoryIncrease > thresholdMB * 1024 * 1024) {
    console.warn(`🔥 Potential memory leak detected! Memory increased by ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
  }
  
  // Generate memory usage report
  if (testMemorySnapshots.length > 0) {
    const avgMemory = testMemorySnapshots.reduce((sum, snap) => sum + snap.heapUsed, 0) / testMemorySnapshots.length;
    const peakMemory = Math.max(...testMemorySnapshots.map(snap => snap.heapUsed));
    
    console.log(`📈 Memory Statistics:`);
    console.log(`   Baseline: ${(baselineMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    console.log(`   Average:  ${(avgMemory / 1024 / 1024).toFixed(2)}MB`);
    console.log(`   Peak:     ${(peakMemory / 1024 / 1024).toFixed(2)}MB`);
    console.log(`   Final:    ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
  }
});

// Monitor memory after each test
afterEach(() => {
  const currentMemory = process.memoryUsage();
  testMemorySnapshots.push(currentMemory);
  
  // Check for sudden memory spikes
  if (testMemorySnapshots.length > 1) {
    const prevMemory = testMemorySnapshots[testMemorySnapshots.length - 2];
    const memoryDelta = currentMemory.heapUsed - prevMemory.heapUsed;
    
    // Alert on >20MB increase in a single test
    if (memoryDelta > 20 * 1024 * 1024) {
      const testName = expect.getState().currentTestName;
      console.warn(`💥 Memory spike detected in test "${testName}": +${(memoryDelta / 1024 / 1024).toFixed(2)}MB`);
    }
  }
});