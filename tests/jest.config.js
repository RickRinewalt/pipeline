/**
 * Jest Configuration for Feature 6: File Reference Protocol Tests
 * Optimized for TDD workflow and comprehensive test coverage
 */

module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Test file patterns
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js'
  ],
  
  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'html',
    'lcov',
    'json-summary'
  ],
  
  // Coverage thresholds (TDD requirements)
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    }
  },
  
  // Files to collect coverage from
  collectCoverageFrom: [
    '../yolo-pro/src/**/*.js',
    '!../yolo-pro/src/**/*.test.js',
    '!../yolo-pro/src/**/*.spec.js',
    '!../yolo-pro/src/test-mocks.js',
    '!**/node_modules/**',
    '!**/coverage/**'
  ],
  
  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/setup.js'
  ],
  
  // Test timeout (for performance tests)
  testTimeout: 30000,
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Restore mocks after each test
  restoreMocks: true,
  
  // Verbose output for TDD feedback
  verbose: true,
  
  // Error handling
  errorOnDeprecated: true,
  
  // Module name mapping for easier imports
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1'
  },
  
  // Transform configuration
  transform: {
    '^.+\\.js$': 'babel-jest'
  },
  
  // Global test variables
  globals: {
    'process.env.NODE_ENV': 'test'
  },
  
  // Watch mode configuration
  watchman: true,
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ],
  
  // Performance monitoring
  logHeapUsage: true,
  maxWorkers: '50%',
  
  // Test results processing
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: 'test-results',
      outputName: 'jest-junit.xml',
      ancestorSeparator: ' › ',
      uniqueOutputName: 'false',
      suiteNameTemplate: '{filepath}',
      classNameTemplate: '{classname}',
      titleTemplate: '{title}'
    }]
  ]
};