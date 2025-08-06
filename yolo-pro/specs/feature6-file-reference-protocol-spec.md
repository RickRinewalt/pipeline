# SPARC Specification: Feature 6 - File Reference Protocol Implementation

> **Comprehensive specification for implementing reliable file referencing protocol within YOLO-PRO agent workflow**

**Issue Reference**: #24  
**SPARC Phase**: Specification  
**Priority**: High  
**Complexity**: Medium  
**Estimated Effort**: 2-3 days

---

## 1. REQUIREMENTS SPECIFICATION

### 1.1 Functional Requirements

#### FR-6.1 Core File Reference Protocol
- **FR-6.1.1**: System MUST implement standardized file reference protocol for agent communications
- **FR-6.1.2**: System MUST validate file path existence before referencing
- **FR-6.1.3**: System MUST provide consistent response format for all file reference operations
- **FR-6.1.4**: System MUST integrate seamlessly with existing YOLO-PRO agent workflow
- **FR-6.1.5**: System MUST support both absolute and relative path references

#### FR-6.2 Path Validation & Verification
- **FR-6.2.1**: System MUST validate file path syntax before processing
- **FR-6.2.2**: System MUST check file/directory existence in real-time
- **FR-6.2.3**: System MUST resolve relative paths to absolute paths
- **FR-6.2.4**: System MUST handle symbolic links and aliases
- **FR-6.2.5**: System MUST detect and report permission issues

#### FR-6.3 Response Format Standardization
- **FR-6.3.1**: System MUST return consistent JSON response format
- **FR-6.3.2**: System MUST include metadata (size, modified date, permissions)
- **FR-6.3.3**: System MUST provide error context for failed references
- **FR-6.3.4**: System MUST support both sync and async response modes
- **FR-6.3.5**: System MUST include reference validation status

#### FR-6.4 YOLO-PRO Integration
- **FR-6.4.1**: System MUST integrate with common-context.js workflow
- **FR-6.4.2**: System MUST support relay-method.js context passing
- **FR-6.4.3**: System MUST leverage Claude-Flow memory coordination
- **FR-6.4.4**: System MUST follow WCP (Work Chunking Protocol) patterns
- **FR-6.4.5**: System MUST maintain protocol state in memory

### 1.2 Non-Functional Requirements

#### NFR-6.1 Performance
- **NFR-6.1.1**: File existence check MUST complete within 100ms for local files
- **NFR-6.1.2**: System MUST support concurrent file reference validation
- **NFR-6.1.3**: Memory usage MUST not exceed 50MB during normal operation
- **NFR-6.1.4**: System MUST handle 1000+ file references without degradation

#### NFR-6.2 Reliability  
- **NFR-6.2.1**: System MUST achieve 99.9% uptime for file reference operations
- **NFR-6.2.2**: System MUST gracefully handle network filesystem timeouts
- **NFR-6.2.3**: System MUST implement retry logic for transient failures
- **NFR-6.2.4**: System MUST validate integrity of file references

#### NFR-6.3 Security
- **NFR-6.3.1**: System MUST prevent path traversal attacks (../ sequences)
- **NFR-6.3.2**: System MUST enforce filesystem permission boundaries
- **NFR-6.3.3**: System MUST sanitize file paths before processing
- **NFR-6.3.4**: System MUST log security-relevant file access attempts

#### NFR-6.4 Compatibility
- **NFR-6.4.1**: System MUST support Linux, macOS, and Windows file systems
- **NFR-6.4.2**: System MUST handle Unicode file names correctly
- **NFR-6.4.3**: System MUST work with Node.js 18+ runtime environment
- **NFR-6.4.4**: System MUST integrate with existing YOLO-PRO CLI commands

---

## 2. API SPECIFICATION

### 2.1 Core API Methods

#### 2.1.1 validateFileReference(filePath, options)

**Purpose**: Validate and resolve file reference with comprehensive checks

**Parameters**:
```typescript
interface ValidateFileReferenceOptions {
  resolveRelative?: boolean;        // Default: true
  checkPermissions?: boolean;       // Default: true
  followSymlinks?: boolean;         // Default: true
  timeoutMs?: number;              // Default: 5000
  includeMetadata?: boolean;        // Default: false
}
```

**Returns**:
```typescript
interface FileReferenceResult {
  success: boolean;
  path: string;                    // Resolved absolute path
  exists: boolean;
  type: 'file' | 'directory' | 'symlink' | 'unknown';
  metadata?: FileMetadata;
  error?: FileReferenceError;
  validationTimestamp: number;
}

interface FileMetadata {
  size: number;
  modified: Date;
  created: Date;
  permissions: string;
  owner: string;
  group: string;
}

interface FileReferenceError {
  code: string;
  message: string;
  details: string;
  recoverable: boolean;
}
```

**Usage Example**:
```javascript
const fileRef = new FileReferenceProtocol();
const result = await fileRef.validateFileReference('/path/to/file.js', {
  includeMetadata: true,
  checkPermissions: true
});

if (result.success && result.exists) {
  console.log('File is valid:', result.path);
} else {
  console.error('Validation failed:', result.error?.message);
}
```

#### 2.1.2 batchValidateReferences(filePaths, options)

**Purpose**: Validate multiple file references concurrently

**Parameters**:
```typescript
interface BatchValidationOptions extends ValidateFileReferenceOptions {
  concurrency?: number;            // Default: 10
  failFast?: boolean;             // Default: false
  progressCallback?: (progress: BatchProgress) => void;
}

interface BatchProgress {
  completed: number;
  total: number;
  failed: number;
  currentFile: string;
}
```

**Returns**:
```typescript
interface BatchValidationResult {
  success: boolean;
  results: Map<string, FileReferenceResult>;
  summary: {
    total: number;
    successful: number;
    failed: number;
    executionTimeMs: number;
  };
}
```

#### 2.1.3 createFileReference(filePath, content, options)

**Purpose**: Create a new file with reference validation

**Parameters**:
```typescript
interface CreateFileOptions {
  overwrite?: boolean;             // Default: false
  createParentDirs?: boolean;      // Default: true
  permissions?: string;            // Default: '644'
  validateAfterCreate?: boolean;   // Default: true
}
```

**Returns**:
```typescript
interface CreateFileResult extends FileReferenceResult {
  created: boolean;
  parentDirsCreated: string[];
}
```

#### 2.1.4 watchFileReference(filePath, callback, options)

**Purpose**: Monitor file reference for changes

**Parameters**:
```typescript
interface WatchOptions {
  persistent?: boolean;            // Default: true
  recursive?: boolean;             // Default: false
  debounceMs?: number;            // Default: 100
}

type FileWatchCallback = (event: FileWatchEvent) => void;

interface FileWatchEvent {
  type: 'created' | 'modified' | 'deleted' | 'moved';
  path: string;
  oldPath?: string;
  timestamp: number;
  metadata?: FileMetadata;
}
```

**Returns**:
```typescript
interface FileWatcher {
  stop(): Promise<void>;
  isActive(): boolean;
  getWatchedPath(): string;
}
```

### 2.2 Integration Methods

#### 2.2.1 integrateWithYoloPro(config)

**Purpose**: Initialize integration with YOLO-PRO workflow systems

**Parameters**:
```typescript
interface YoloProIntegrationConfig {
  memoryNamespace?: string;        // Default: 'file-references'
  enableContextRelay?: boolean;    // Default: true
  claudeFlowIntegration?: boolean; // Default: true
  persistReferences?: boolean;     // Default: true
}
```

#### 2.2.2 storeReferenceInMemory(filePath, result, ttl)

**Purpose**: Store file reference result in Claude-Flow memory system

**Parameters**:
```typescript
interface MemoryStorage {
  namespace: string;
  key: string;
  value: FileReferenceResult;
  ttl?: number;                   // Default: 3600 seconds
}
```

#### 2.2.3 relayReferenceContext(filePath, agentMessage)

**Purpose**: Apply relay method pattern to include file reference context

**Parameters**:
```typescript
interface RelayContextOptions {
  includeMetadata?: boolean;       // Default: false
  includeValidationStatus?: boolean; // Default: true
  appendToMessage?: boolean;       // Default: true
}
```

---

## 3. RESPONSE FORMAT DEFINITIONS

### 3.1 Standard Response Schema

All file reference operations return responses conforming to this schema:

```json
{
  "success": true,
  "timestamp": 1703123456789,
  "operation": "validateFileReference",
  "data": {
    "path": "/absolute/path/to/file.js",
    "exists": true,
    "type": "file",
    "validated": true,
    "metadata": {
      "size": 1024,
      "modified": "2024-01-01T12:00:00.000Z",
      "created": "2024-01-01T10:00:00.000Z",
      "permissions": "-rw-r--r--",
      "owner": "user",
      "group": "group"
    }
  },
  "error": null,
  "validationDetails": {
    "pathSyntax": "valid",
    "permissions": "readable",
    "securityCheck": "passed",
    "performanceMs": 15
  }
}
```

### 3.2 Error Response Schema

```json
{
  "success": false,
  "timestamp": 1703123456789,
  "operation": "validateFileReference",
  "data": null,
  "error": {
    "code": "FILE_NOT_FOUND",
    "message": "File does not exist at specified path",
    "details": "Path '/nonexistent/file.js' could not be resolved",
    "recoverable": true,
    "suggestions": [
      "Check file path spelling",
      "Verify file permissions",
      "Ensure file exists"
    ]
  },
  "validationDetails": {
    "pathSyntax": "valid",
    "permissions": "unknown",
    "securityCheck": "passed",
    "performanceMs": 5
  }
}
```

### 3.3 Batch Operation Response

```json
{
  "success": true,
  "timestamp": 1703123456789,
  "operation": "batchValidateReferences",
  "data": {
    "summary": {
      "total": 5,
      "successful": 4,
      "failed": 1,
      "executionTimeMs": 120
    },
    "results": {
      "/path/file1.js": { "success": true, "exists": true, "type": "file" },
      "/path/file2.js": { "success": true, "exists": true, "type": "file" },
      "/path/file3.js": { "success": true, "exists": false, "type": "unknown" },
      "/path/file4.js": { "success": true, "exists": true, "type": "directory" },
      "/path/file5.js": { "success": false, "error": { "code": "PERMISSION_DENIED" } }
    }
  },
  "error": null
}
```

---

## 4. ERROR HANDLING SPECIFICATIONS

### 4.1 Error Categories & Codes

#### 4.1.1 Path Validation Errors
- **INVALID_PATH_SYNTAX**: Malformed file path
- **PATH_TOO_LONG**: File path exceeds system limits
- **INVALID_CHARACTERS**: Path contains forbidden characters
- **PATH_TRAVERSAL_BLOCKED**: Attempted path traversal attack

#### 4.1.2 File System Errors
- **FILE_NOT_FOUND**: Target file/directory doesn't exist
- **PERMISSION_DENIED**: Insufficient permissions to access file
- **NETWORK_TIMEOUT**: Network filesystem operation timed out
- **DISK_SPACE_ERROR**: Insufficient disk space for operation

#### 4.1.3 System Errors
- **MEMORY_LIMIT_EXCEEDED**: Operation exceeded memory limits
- **CONCURRENT_LIMIT_REACHED**: Too many concurrent operations
- **INTERNAL_ERROR**: Unexpected internal system error
- **INTEGRATION_FAILURE**: YOLO-PRO integration component failed

### 4.2 Error Recovery Strategies

#### 4.2.1 Automatic Retry Logic
```typescript
interface RetryConfig {
  maxAttempts: number;             // Default: 3
  baseDelayMs: number;            // Default: 1000
  backoffMultiplier: number;       // Default: 2
  retryableErrors: string[];       // List of error codes to retry
}
```

#### 4.2.2 Fallback Mechanisms
- **Alternative Path Resolution**: Try common path variations
- **Graceful Degradation**: Return partial results when possible
- **Cache Utilization**: Use cached results for unavailable files
- **User Notification**: Inform user of recoverable errors

### 4.3 Error Context Enhancement

All errors include comprehensive context:
- **File path being processed**
- **Operation being attempted**
- **System state at time of error**
- **Recovery suggestions**
- **Related YOLO-PRO context**

---

## 5. PATH VALIDATION RULES

### 5.1 Path Syntax Validation

#### 5.1.1 Character Restrictions
- **Allowed**: Alphanumeric, hyphens, underscores, periods, forward slashes
- **Platform-specific**: Backslashes (Windows), colons (macOS)
- **Forbidden**: Control characters, pipes, quotes, wildcards
- **Unicode**: Full UTF-8 support with normalization

#### 5.1.2 Length Limitations
- **Maximum path length**: 4096 characters
- **Maximum filename length**: 255 characters
- **Component validation**: Each path component validated separately

#### 5.1.3 Special Path Handling
- **Relative paths**: Resolved against process.cwd()
- **Home directory**: Expand ~ and ~user patterns
- **Environment variables**: Resolve $VAR and ${VAR} patterns
- **Symbolic links**: Optionally follow or preserve

### 5.2 Security Validation

#### 5.2.1 Path Traversal Prevention
```javascript
// Block dangerous patterns
const dangerousPatterns = [
  /\.\./,           // Parent directory references
  /\/\.\./,         // Explicit parent traversal
  /\\\..\\/,        // Windows parent traversal
  /^\/etc/,         // System directory access
  /^\/proc/,        // Process filesystem access
  /^\/dev/          // Device filesystem access
];
```

#### 5.2.2 Permission Boundary Enforcement
- **Working directory limits**: Restrict to project boundaries
- **User permission checks**: Validate read/write permissions
- **System directory protection**: Block access to critical system paths
- **Network path validation**: Handle UNC paths and network mounts

### 5.3 Cross-Platform Compatibility

#### 5.3.1 Path Normalization
```javascript
function normalizePath(filePath) {
  return path.resolve(path.normalize(filePath))
    .replace(/\\/g, '/')           // Use forward slashes
    .replace(/\/+/g, '/')          // Collapse multiple slashes
    .replace(/\/$/, '');           // Remove trailing slash
}
```

#### 5.3.2 Platform-Specific Handling
- **Windows**: Drive letter validation, UNC path support
- **macOS**: Case sensitivity handling, resource forks
- **Linux**: Extended attributes, special filesystem features

---

## 6. INTEGRATION REQUIREMENTS

### 6.1 YOLO-PRO Agent Workflow Integration

#### 6.1.1 Common Context Integration
```javascript
// Integration with common-context.js
const context = new YoloProCommonContext();
const fileProtocol = new FileReferenceProtocol({
  contextProvider: context,
  memoryNamespace: 'file-references'
});

// Store file references in context
context.setContext('validated-files', fileProtocol.getValidatedFiles());
```

#### 6.1.2 Relay Method Integration
```javascript
// Integration with relay-method.js
const relay = new YoloProRelayMethod();
const fileRef = new FileReferenceProtocol({
  relayMethod: relay
});

// Enhanced messages include file reference context
const enhancedMessage = fileRef.enhanceMessageWithReferences(
  originalMessage, 
  validatedFilePaths
);
```

### 6.2 Claude-Flow Memory Coordination

#### 6.2.1 Memory Storage Pattern
```javascript
// Store file reference results in Claude-Flow memory
await claudeFlow.memory.store('file-references', {
  validatedPaths: new Map(),
  validationCache: new Map(),
  lastUpdated: Date.now(),
  namespace: 'yolo-pro-files'
});
```

#### 6.2.2 Cross-Session Persistence
- **Session restoration**: Reload validated file references
- **Cache invalidation**: Handle file changes between sessions
- **Memory cleanup**: Remove stale file references
- **Performance optimization**: Pre-validate frequently referenced files

### 6.3 Work Chunking Protocol (WCP) Integration

#### 6.3.1 Feature-Level File Tracking
- **Track files per feature**: Associate file references with WCP features
- **Validation status**: Include file validation in feature completion criteria
- **Cross-issue references**: Handle file references spanning multiple issues
- **Dependency tracking**: Track file dependencies between features

#### 6.3.2 CI/CD Pipeline Integration
- **Pre-commit validation**: Validate all referenced files before commit
- **Build-time checks**: Ensure file references are valid during CI
- **Deployment verification**: Verify file references in production
- **Rollback support**: Handle file reference changes during rollbacks

### 6.4 GitHub Integration Requirements

#### 6.4.1 Issue Management
- **File reference tracking**: Track file references in GitHub issues
- **Validation status reporting**: Report validation status in issue comments
- **Change notifications**: Notify when referenced files are modified
- **Cross-repository references**: Handle file references across repositories

#### 6.4.2 Pull Request Integration
- **Reference validation**: Validate file references in PR descriptions
- **Change impact analysis**: Analyze impact of file changes on references
- **Approval workflows**: Require approval for critical file reference changes
- **Merge validation**: Ensure file references remain valid after merge

---

## 7. ACCEPTANCE CRITERIA

### 7.1 Functional Acceptance

```gherkin
Feature: File Reference Protocol

  Scenario: Validate existing file reference
    Given a file exists at "/path/to/existing/file.js"
    When I validate the file reference
    Then the result should be successful
    And the file should be marked as existing
    And metadata should be included
    And response time should be under 100ms

  Scenario: Handle non-existent file reference  
    Given no file exists at "/path/to/missing/file.js"
    When I validate the file reference
    Then the result should indicate file not found
    And error code should be "FILE_NOT_FOUND"
    And recovery suggestions should be provided

  Scenario: Batch validate multiple file references
    Given a list of 10 file paths
    And 7 files exist
    And 3 files don't exist
    When I perform batch validation
    Then I should receive results for all 10 files
    And summary should show 7 successful, 3 failed
    And total execution time should be under 1 second

  Scenario: Integration with YOLO-PRO common context
    Given YOLO-PRO common context is initialized
    When I validate file references
    Then references should be stored in context
    And context should include validation status
    And relay method should enhance messages with references

  Scenario: Security path traversal prevention
    Given a malicious path "../../../etc/passwd"
    When I validate the file reference
    Then validation should fail
    And error code should be "PATH_TRAVERSAL_BLOCKED"
    And security event should be logged
```

### 7.2 Performance Acceptance

- **Single file validation**: < 100ms response time
- **Batch validation**: < 1000ms for 100 files
- **Memory usage**: < 50MB during normal operation
- **Concurrent operations**: Support 50+ simultaneous validations
- **Cache hit ratio**: > 80% for frequently referenced files

### 7.3 Integration Acceptance

- **YOLO-PRO workflow**: Seamless integration with all existing MVP components
- **Claude-Flow memory**: Successful storage and retrieval of file references
- **Error handling**: Graceful degradation with informative error messages
- **Cross-platform**: Consistent behavior on Linux, macOS, and Windows
- **Security**: No security vulnerabilities in path handling

### 7.4 User Experience Acceptance

- **API consistency**: All methods follow established patterns
- **Error messages**: Clear, actionable error descriptions
- **Recovery options**: Automatic retry for transient failures
- **Documentation**: Complete API documentation with examples
- **Logging**: Comprehensive logging for debugging and monitoring

---

## 8. IMPLEMENTATION CONSTRAINTS

### 8.1 Technical Constraints

- **Runtime**: Node.js 18+ compatibility required
- **Dependencies**: Minimize external dependencies, prefer Node.js built-ins
- **Memory**: Must operate within YOLO-PRO memory constraints
- **Performance**: File operations must not block YOLO-PRO workflow
- **Security**: Must comply with YOLO-PRO security requirements

### 8.2 Business Constraints

- **Timeline**: Must integrate with existing MVP milestone schedule
- **Resources**: Implementation must fit within current development capacity
- **Compatibility**: Must not break existing YOLO-PRO functionality
- **Maintainability**: Code must follow YOLO-PRO architectural patterns
- **Documentation**: Must provide comprehensive documentation for team

### 8.3 System Constraints

- **File system**: Must work with various filesystem types and configurations
- **Network**: Must handle network filesystem latency and timeouts
- **Permissions**: Must respect operating system permission models
- **Concurrency**: Must handle concurrent file system access safely
- **Platform**: Must support development environments across team

---

## 9. DEPENDENCIES & ASSUMPTIONS

### 9.1 Internal Dependencies

- **YOLO-PRO Common Context**: Integration with existing context system
- **YOLO-PRO Relay Method**: Integration with message relay functionality  
- **Claude-Flow Memory**: Dependency on memory coordination system
- **YOLO-PRO CLI**: Integration with command-line interface
- **GitHub Integration**: Coordination with existing GitHub tooling

### 9.2 External Dependencies

- **Node.js Built-ins**: fs, path, os modules for file system operations
- **Operating System**: Underlying filesystem and permission system
- **Network Infrastructure**: For network filesystem access
- **File System Drivers**: Platform-specific filesystem drivers
- **Security Framework**: Operating system security model

### 9.3 Assumptions

- **File System Access**: Application has appropriate filesystem permissions
- **Network Reliability**: Network filesystems are reasonably reliable
- **System Resources**: Sufficient system resources for file operations
- **User Permissions**: Users have appropriate permissions for referenced files
- **Platform Support**: Target platforms support required filesystem features

---

## 10. SUCCESS METRICS

### 10.1 Operational Metrics

- **Availability**: 99.9% uptime for file reference operations
- **Performance**: 95th percentile response time < 200ms
- **Accuracy**: 100% correct validation results
- **Reliability**: < 0.1% false positive/negative rate
- **Throughput**: Support 1000+ file references per minute

### 10.2 Integration Metrics

- **YOLO-PRO Workflow**: 0% disruption to existing workflows
- **Memory Efficiency**: < 10% increase in YOLO-PRO memory usage
- **Error Rate**: < 1% integration-related errors
- **Adoption**: 100% YOLO-PRO features use file reference protocol
- **Performance Impact**: < 5% slowdown in YOLO-PRO operations

### 10.3 Developer Experience Metrics

- **API Usability**: 100% team adoption within 1 week
- **Documentation Quality**: 0 documentation-related support requests
- **Development Velocity**: 0% decrease in feature development speed
- **Bug Rate**: < 5 bugs per 1000 lines of code
- **Test Coverage**: > 95% code coverage for file reference protocol

---

## 11. TESTING STRATEGY

### 11.1 Unit Testing

- **API Method Testing**: Comprehensive test coverage for all public methods
- **Path Validation Testing**: Extensive testing of path validation rules
- **Error Handling Testing**: Test all error conditions and recovery paths
- **Security Testing**: Test path traversal and permission boundary enforcement
- **Performance Testing**: Validate response time and memory usage requirements

### 11.2 Integration Testing

- **YOLO-PRO Integration**: Test integration with all YOLO-PRO components
- **Claude-Flow Integration**: Test memory coordination and persistence
- **Cross-Platform Testing**: Test on Linux, macOS, and Windows
- **Network Filesystem Testing**: Test with network-mounted filesystems
- **Concurrent Access Testing**: Test concurrent file reference operations

### 11.3 End-to-End Testing

- **Workflow Testing**: Test complete YOLO-PRO workflows using file references
- **Error Recovery Testing**: Test error recovery across system boundaries
- **Performance Testing**: Test performance under realistic load conditions
- **Security Testing**: Penetration testing for path traversal vulnerabilities
- **Compatibility Testing**: Test with various filesystem configurations

---

## 12. DOCUMENTATION REQUIREMENTS

### 12.1 Technical Documentation

- **API Reference**: Comprehensive API documentation with examples
- **Integration Guide**: Step-by-step integration instructions
- **Architecture Documentation**: System design and component relationships
- **Security Guide**: Security considerations and best practices
- **Troubleshooting Guide**: Common issues and resolution procedures

### 12.2 User Documentation

- **Usage Guide**: How to use file reference protocol in YOLO-PRO workflows
- **Configuration Guide**: Configuration options and customization
- **Best Practices**: Recommended patterns and anti-patterns
- **Migration Guide**: How to adopt file reference protocol in existing projects
- **FAQ**: Frequently asked questions and answers

---

## 13. RISK ASSESSMENT

### 13.1 Technical Risks

| Risk | Impact | Probability | Mitigation |
|------|---------|-------------|------------|
| Cross-platform filesystem differences | High | Medium | Extensive cross-platform testing |
| Performance degradation | Medium | Low | Performance monitoring and optimization |
| Security vulnerabilities | High | Low | Security code review and penetration testing |
| Memory leaks | Medium | Medium | Memory profiling and monitoring |
| Integration complexity | Medium | Medium | Phased integration approach |

### 13.2 Business Risks

| Risk | Impact | Probability | Mitigation |
|------|---------|-------------|------------|
| Timeline delays | Medium | Low | Conservative estimation and buffer time |
| Resource allocation | Low | Low | Clear resource requirements and planning |
| User adoption | Medium | Low | Comprehensive documentation and training |
| Compatibility issues | High | Low | Thorough testing with existing systems |
| Maintenance burden | Medium | Medium | Clean architecture and comprehensive tests |

---

**Specification Document Complete**

This SPARC specification provides comprehensive requirements and implementation guidance for Feature 6: File Reference Protocol Implementation. The specification follows YOLO-PRO architectural patterns and integrates seamlessly with existing workflow components while providing robust file reference capabilities for agent communications.

**Next Phase**: Proceed to Pseudocode phase for algorithmic design and implementation planning.