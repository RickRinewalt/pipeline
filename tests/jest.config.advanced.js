/**
 * YOLO-PRO Comprehensive Test Suite Configuration
 * Advanced Jest configuration for complete testing framework with
 * parallel execution, coverage analysis, and performance monitoring
 */

const path = require('path');

module.exports = {
  // Test environment and setup
  testEnvironment: 'node',
  rootDir: path.resolve(__dirname, '..'),
  
  // Test discovery patterns
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js',
    '**/tests/unit/**/*.test.js',
    '**/tests/integration/**/*.test.js',
    '**/tests/e2e/**/*.test.js',
    '**/tests/performance/**/*.test.js'
  ],
  
  // Test organization by project
  projects: [
    {
      displayName: 'Unit Tests',
      testMatch: ['<rootDir>/tests/unit/**/*.test.js'],
      coverageDirectory: '<rootDir>/tests/coverage/unit'
    },
    {
      displayName: 'Integration Tests', 
      testMatch: ['<rootDir>/tests/integration/**/*.test.js'],
      coverageDirectory: '<rootDir>/tests/coverage/integration',
      testTimeout: 60000
    },
    {
      displayName: 'E2E Tests',
      testMatch: ['<rootDir>/tests/e2e/**/*.test.js'],
      coverageDirectory: '<rootDir>/tests/coverage/e2e',
      testTimeout: 120000
    },
    {
      displayName: 'Performance Tests',
      testMatch: ['<rootDir>/tests/performance/**/*.test.js'],
      coverageDirectory: '<rootDir>/tests/coverage/performance',
      testTimeout: 300000
    }
  ],
  
  // Coverage configuration - comprehensive analysis
  collectCoverage: true,
  coverageDirectory: '<rootDir>/tests/coverage',
  coverageReporters: [
    'text-summary',
    'text',
    'html',
    'lcov',
    'json-summary',
    'json',
    'clover',
    'cobertura'
  ],
  
  // High coverage thresholds for production quality
  coverageThreshold: {
    global: {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95
    },
    // Per-module thresholds
    './yolo-pro/src/cli/**/*.js': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    },
    './yolo-pro/src/file-reference-*.js': {
      branches: 98,
      functions: 98,
      lines: 98,
      statements: 98
    }
  },
  
  // Files to collect coverage from
  collectCoverageFrom: [
    'yolo-pro/src/**/*.js',
    'src/**/*.js',
    '!**/*.test.js',
    '!**/*.spec.js',
    '!**/test-mocks.js',
    '!**/node_modules/**',
    '!**/coverage/**',
    '!**/bin/**',
    '!**/docs/**',
    '!**/examples/**'
  ],
  
  // Setup and teardown
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup.js',
    '<rootDir>/tests/setup/performance-monitoring.js',
    '<rootDir>/tests/setup/memory-leak-detection.js'
  ],
  
  // Global setup for database/external services
  globalSetup: '<rootDir>/tests/setup/global-setup.js',
  globalTeardown: '<rootDir>/tests/setup/global-teardown.js',
  
  // Test execution configuration
  testTimeout: 30000,
  clearMocks: true,
  restoreMocks: true,
  resetMocks: true,
  verbose: process.env.CI ? false : true,
  
  // Error and deprecation handling
  errorOnDeprecated: true,
  bail: process.env.CI ? 1 : 0,
  
  // Module resolution and mocking
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1',
    '^@yolo-pro/(.*)$': '<rootDir>/yolo-pro/src/$1',
    '^@mocks/(.*)$': '<rootDir>/tests/mocks/$1',
    '^@fixtures/(.*)$': '<rootDir>/tests/fixtures/$1',
    '^@utils/(.*)$': '<rootDir>/tests/utils/$1'
  },
  
  // Transform configuration
  transform: {
    '^.+\.js$': 'babel-jest'
  },
  
  // Global test variables
  globals: {
    'process.env.NODE_ENV': 'test',
    'process.env.CI': process.env.CI || 'false'
  },
  
  // Parallel execution and performance
  maxWorkers: process.env.CI ? 2 : '50%',
  logHeapUsage: true,
  detect: true,
  
  // Watch mode configuration for development
  watchman: true,
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ],
  
  // Advanced test result reporting
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: '<rootDir>/tests/test-results',
      outputName: 'junit.xml',
      ancestorSeparator: ' › ',
      uniqueOutputName: false,
      suiteNameTemplate: '{filepath}',
      classNameTemplate: '{classname}',
      titleTemplate: '{title}'
    }],
    ['jest-html-reporters', {
      publicPath: '<rootDir>/tests/test-results',
      filename: 'test-report.html',
      expand: true,
      hideIcon: false
    }],
    // Performance and memory reporting
    ['<rootDir>/tests/reporters/performance-reporter.js'],
    ['<rootDir>/tests/reporters/memory-reporter.js']
  ],
  
  // Test result caching
  cacheDirectory: '<rootDir>/tests/.jest-cache',
  
  // Notification configuration (development only)
  notify: !process.env.CI,
  notifyMode: 'failure-change',
  
  // Snapshot testing
  snapshotSerializers: [
    '<rootDir>/tests/serializers/custom-serializer.js'
  ],
  
  // Test result processing
  testResultsProcessor: '<rootDir>/tests/processors/results-processor.js',
  
  // Force exit after tests complete
  forceExit: true,
  
  // Coverage path ignoring
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/tests/',
    '/coverage/',
    '/bin/',
    '/docs/'
  ],
  
  // Module path ignoring
  modulePathIgnorePatterns: [
    '<rootDir>/build/',
    '<rootDir>/dist/',
    '<rootDir>/coverage/'
  ]
};