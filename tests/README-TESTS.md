# Feature 6: File Reference Protocol - Test Suite

## Overview

This comprehensive test suite implements Test-Driven Development (TDD) practices for Feature 6: File Reference Protocol Implementation. The tests are written FIRST before any implementation, following the Red-Green-Refactor cycle.

## Test Structure

### Core Test Files

1. **`feature6-file-reference-protocol.test.js`** - Core functionality tests
   - Path validation (valid/invalid paths)
   - File existence checking
   - Response format validation
   - Error handling scenarios
   - Performance requirements

2. **`feature6-integration.test.js`** - YOLO-PRO workflow integration
   - Work Chunking Protocol (WCP) integration
   - CI Protocol integration  
   - Swarm coordination
   - End-to-end workflow validation

3. **`feature6-security.test.js`** - Security validation tests
   - Path traversal attack prevention
   - Access control and permissions
   - Input sanitization
   - Rate limiting and DoS protection
   - Audit logging and monitoring

### Test Configuration

- **`jest.config.js`** - Jest configuration optimized for TDD
- **`setup.js`** - Global test setup and utilities
- **`package.json`** - Test dependencies and scripts

## Test Coverage Requirements

Following TDD best practices, we enforce high coverage thresholds:

- **Statements**: 90%
- **Branches**: 90%
- **Functions**: 90%
- **Lines**: 90%

## Running Tests

### Basic Commands

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode for TDD
npm run test:watch

# Run specific test files
npm run test:core           # Core functionality tests
npm run test:integration    # Integration tests
npm run test:security       # Security tests

# Run tests by pattern
npm run test:performance    # Performance-related tests
npm run test:security-only  # Security-specific tests
```

### CI/CD Commands

```bash
# CI pipeline (no watch mode)
npm run test:ci

# Debug mode
npm run test:debug
```

### Development Workflow

```bash
# TDD Red-Green-Refactor cycle
npm run test:watch          # Keep running during development

# Check specific feature
npm run test:feature6       # All Feature 6 tests
```

## Test Categories

### 1. Unit Tests (Core Functionality)

**Path Validation Tests:**
- Valid path formats (absolute, relative)
- Invalid path rejection
- Path normalization
- Edge cases handling

**File Existence Tests:**
- Existing files confirmation
- Missing files handling
- Directory vs file detection
- Permission validation

**Response Format Tests:**
- Success response structure
- Error response format
- Schema validation
- Protocol compliance

### 2. Integration Tests (YOLO-PRO Workflow)

**Work Chunking Protocol (WCP):**
- Epic-level file validation
- Feature-level dependencies
- Task-level file requirements

**CI Protocol Integration:**
- Branch file validation
- Test file requirements
- Merge validation rules

**Swarm Coordination:**
- Multi-agent file processing
- Load distribution
- Failure recovery

### 3. Security Tests

**Attack Prevention:**
- Path traversal attempts (../../../etc/passwd)
- Null byte injection (file.txt\0malicious)
- Command injection (file.txt; rm -rf /)
- Script injection (<script>alert(1)</script>)

**Access Control:**
- Permission validation
- Whitelist/blacklist enforcement
- File type restrictions

**Rate Limiting:**
- Request throttling
- Burst protection
- DoS prevention

### 4. Performance Tests

**Response Time:**
- File validation <100ms
- Concurrent processing
- Large file sets

**Resource Usage:**
- Memory efficiency
- CPU utilization
- Scalability limits

## Test Data

### Valid Test Paths
```javascript
[
  '/workspaces/project/src/index.js',
  './relative/path/to/file.js',
  '../parent/path/to/file.js',
  'simple-file.js'
]
```

### Security Test Payloads
```javascript
{
  pathTraversal: ['../../../etc/passwd', '..\\..\\..\\windows\\system32'],
  nullByteInjection: ['file.txt\0../../../etc/passwd'],
  commandInjection: ['file.txt; rm -rf /', 'file.txt && cat /etc/passwd']
}
```

## Mock Implementation

The tests use comprehensive mocks for the File Reference Protocol:

```javascript
const FileReferenceProtocol = {
  validatePath: jest.fn(),
  checkFileExists: jest.fn(),
  formatResponse: jest.fn(),
  processFileReference: jest.fn(),
  sanitizeInput: jest.fn(),
  // ... additional methods
};
```

## Test Utilities

Global test utilities are available in all tests:

- `testUtils.generateRandomPath()` - Create random test paths
- `testUtils.generateFileData()` - Mock file metadata
- `testUtils.getSecurityPayloads()` - Security test vectors
- `testUtils.measurePerformance()` - Performance timing

## Performance Monitoring

The test suite includes built-in performance monitoring:

- **Test duration tracking** - Identifies slow tests (>1000ms)
- **Memory leak detection** - Warns on excessive memory usage
- **Coverage reporting** - HTML and JSON reports

## TDD Implementation Guidelines

### Red Phase (Write Failing Tests)
1. Write test cases for expected behavior
2. Define API contracts through tests
3. Ensure tests fail initially (no implementation)

### Green Phase (Make Tests Pass)
1. Write minimal code to pass tests
2. Focus on functionality, not optimization
3. All tests must pass

### Refactor Phase (Improve Code Quality)
1. Optimize implementation
2. Remove duplication
3. Maintain test coverage
4. All tests continue to pass

## Error Scenarios Tested

### Validation Errors
- Invalid path formats
- Path traversal attempts
- Malicious input patterns

### File System Errors
- File not found (ENOENT)
- Permission denied (EACCES)
- Directory vs file mismatch

### Security Violations
- Blacklisted path access
- Dangerous file types
- Rate limit exceeded

### System Errors
- Memory exhaustion
- Resource limits
- Network failures

## Best Practices

1. **Test First** - Always write tests before implementation
2. **Single Responsibility** - Each test validates one specific behavior
3. **Clear Naming** - Test names describe what and why
4. **Isolated Tests** - No dependencies between tests
5. **Fast Execution** - Unit tests should run quickly (<100ms)
6. **Comprehensive Coverage** - Test edge cases and error conditions

## Continuous Integration

The test suite is configured for CI/CD pipelines:

- **Automated execution** on code changes
- **Coverage reporting** with threshold enforcement
- **Performance regression** detection
- **Security vulnerability** scanning

## Integration with YOLO-PRO

The tests validate integration with YOLO-PRO protocols:

- **Work Chunking Protocol** - File dependencies in epics/features
- **CI Protocol** - Branch validation and merge requirements
- **Quality Gates** - Test coverage and security compliance

## Security Compliance

Security tests ensure compliance with:

- **OWASP Top 10** - Common web vulnerabilities
- **Path Traversal Prevention** - Directory escape attempts
- **Input Validation** - Malicious payload detection
- **Access Control** - Permission enforcement

## Reporting

Test results are output in multiple formats:

- **Console** - Real-time feedback during development
- **HTML** - Detailed coverage reports
- **JUnit XML** - CI/CD integration
- **JSON** - Programmatic analysis

Run `npm run test:coverage` to generate comprehensive reports in the `coverage/` directory.