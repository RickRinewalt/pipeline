/**
 * Global Test Teardown
 * Cleans up test environment and generates final reports
 */

const fs = require('fs').promises;
const path = require('path');

module.exports = async () => {
  console.log('🧹 Cleaning up test environment...');
  
  // Generate performance report
  if (global.performanceMetrics) {
    const report = {
      totalTestTime: Date.now() - global.testStartTime,
      slowTests: global.performanceMetrics.slowTests,
      averageMemoryUsage: global.performanceMetrics.memoryUsage.reduce((a, b) => a + b, 0) / global.performanceMetrics.memoryUsage.length,
      peakMemoryUsage: Math.max(...global.performanceMetrics.memoryUsage)
    };
    
    const reportPath = path.resolve(__dirname, '../test-results/performance-summary.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`📊 Performance report saved to ${reportPath}`);
  }
  
  // Cleanup temporary files
  try {
    const tmpDir = path.resolve(__dirname, '../tmp');
    await fs.rmdir(tmpDir, { recursive: true });
  } catch (error) {
    // Ignore cleanup errors
  }
  
  console.log('✅ Test environment cleanup complete');
};