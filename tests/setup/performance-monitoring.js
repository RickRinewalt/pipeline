/**
 * Performance Monitoring Setup
 * Tracks test execution times and identifies performance bottlenecks
 */

beforeEach(() => {
  // Record test start time
  global.currentTestStartTime = process.hrtime.bigint();
  
  // Record memory usage before test
  const memUsage = process.memoryUsage();
  global.testStartMemory = memUsage;
});

afterEach(() => {
  // Calculate test execution time
  const endTime = process.hrtime.bigint();
  const executionTime = Number(endTime - global.currentTestStartTime) / 1000000; // Convert to milliseconds
  
  // Record memory usage after test
  const memUsage = process.memoryUsage();
  const memoryDelta = memUsage.heapUsed - global.testStartMemory.heapUsed;
  
  // Store metrics
  const currentTest = expect.getState().currentTestName;
  
  if (global.performanceMetrics) {
    global.performanceMetrics.testExecutionTimes.set(currentTest, executionTime);
    global.performanceMetrics.memoryUsage.push(memUsage.heapUsed);
    
    // Flag slow tests (>1000ms for unit tests, >5000ms for integration)
    const isIntegrationTest = currentTest.includes('integration') || currentTest.includes('e2e');
    const threshold = isIntegrationTest ? 5000 : 1000;
    
    if (executionTime > threshold) {
      global.performanceMetrics.slowTests.push({
        testName: currentTest,
        executionTime,
        memoryDelta,
        category: isIntegrationTest ? 'integration' : 'unit'
      });
    }
  }
  
  // Warn about slow tests in console
  if (executionTime > 1000) {
    console.warn(`⚠️  Slow test detected: ${currentTest} (${executionTime.toFixed(2)}ms)`);
  }
  
  // Warn about excessive memory usage (>50MB delta)
  if (memoryDelta > 50 * 1024 * 1024) {
    console.warn(`⚠️  High memory usage: ${currentTest} (+${(memoryDelta / 1024 / 1024).toFixed(2)}MB)`);
  }
});