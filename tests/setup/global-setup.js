/**
 * Global Test Setup
 * Initializes test environment, external dependencies, and shared resources
 */

const fs = require('fs').promises;
const path = require('path');

module.exports = async () => {
  console.log('🚀 Initializing YOLO-PRO Test Environment...');
  
  // Set environment variables
  process.env.NODE_ENV = 'test';
  process.env.GITHUB_TOKEN = 'mock_token_for_testing';
  process.env.LOG_LEVEL = 'error'; // Suppress logs during testing
  
  // Create test directories
  const testDirs = [
    'tests/tmp',
    'tests/fixtures/github-responses',
    'tests/fixtures/file-systems',
    'tests/test-results',
    'tests/coverage',
    'tests/.jest-cache'
  ];
  
  for (const dir of testDirs) {
    const fullPath = path.resolve(__dirname, '../../', dir);
    try {
      await fs.mkdir(fullPath, { recursive: true });
    } catch (error) {
      // Directory might already exist
      if (error.code !== 'EEXIST') {
        console.warn(`Warning: Could not create directory ${fullPath}:`, error.message);
      }
    }
  }
  
  // Initialize test database/cache
  global.testStartTime = Date.now();
  global.testEnvironment = 'jest';
  
  // Setup global performance monitoring
  global.performanceMetrics = {
    testExecutionTimes: new Map(),
    memoryUsage: [],
    slowTests: []
  };
  
  console.log('✅ Test environment initialized successfully');
};