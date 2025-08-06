/**
 * Test Mock Implementations
 * Provides the exact interfaces expected by the test files
 */

const { FileReferenceProtocol } = require('./file-reference-protocol');
const { FileReferenceValidator } = require('./file-reference-validator');
const { FileReferenceAuditLogger, FileReferenceSecurityUtils } = require('./file-reference-audit');
const { YoloProWorkflowIntegration } = require('./file-reference-integration');

// Create instances for testing
const protocolInstance = new FileReferenceProtocol();
const validatorInstance = new FileReferenceValidator();
const auditLogger = new FileReferenceAuditLogger({ logToConsole: false, logToFile: false });
const securityUtils = FileReferenceSecurityUtils;
const yoloProIntegration = new YoloProWorkflowIntegration();

/**
 * Mock implementations that match test expectations
 */
const FileReferenceProtocolMock = {
  validatePath: async (filePath, options = {}) => {
    return await protocolInstance.validatePath(filePath, options);
  },

  checkFileExists: async (filePath, options = {}) => {
    return await protocolInstance.checkFileExists(filePath, options);
  },

  formatResponse: (input) => {
    return protocolInstance.formatResponse(input);
  },

  processFileReference: async (filePath, options = {}) => {
    return await protocolInstance.processFileReference(filePath, options);
  },

  resolveRelativePath: (relativePath, basePath) => {
    return protocolInstance.resolveRelativePath(relativePath, basePath);
  },

  sanitizePath: (filePath) => {
    return protocolInstance.sanitizePath(filePath);
  },

  batchProcessFiles: async (filePaths, options = {}) => {
    return await protocolInstance.batchProcessFiles(filePaths, options);
  },

  integrateWithWorkflow: async (workflow) => {
    return await yoloProIntegration.integrateWithWorkflow(workflow);
  },

  // Security methods
  detectPathTraversal: (filePath) => {
    const result = validatorInstance.detectDangerousPatterns(filePath);
    return {
      isTraversal: result.isTraversal,
      severity: result.severity,
      pattern: result.threats[0]?.pattern || 'none',
      payload: filePath
    };
  },

  validateFileType: (filePath) => {
    return validatorInstance.validateFileExtension(filePath);
  },

  sanitizeInput: (input) => {
    return validatorInstance.sanitizeInput(input);
  },

  checkPermissions: async (filePath) => {
    const result = await protocolInstance.checkFileExists(filePath);
    return {
      path: filePath,
      permissions: result.permissions || { read: false, write: false, execute: false },
      owner: 'unknown',
      group: 'unknown',
      accessDenied: !result.exists,
      reason: result.error || 'Access granted',
      isDirectory: result.isDirectory || false
    };
  },

  auditAccess: async (accessData) => {
    return await auditLogger.logAccess(accessData);
  },

  rateLimit: async (request) => {
    // Simple mock rate limiter
    const mockRateLimiter = yoloProIntegration.rateLimiter;
    return await mockRateLimiter.rateLimit(request);
  },

  encryptResponse: async (response) => {
    return {
      encrypted: true,
      data: 'encrypted_payload_here',
      algorithm: 'AES-256-GCM',
      keyId: 'key-001',
      iv: 'random_iv_here'
    };
  }
};

/**
 * YOLO-PRO workflow mocks
 */
const YoloProMock = {
  workflow: {
    processTask: async (taskData) => {
      return await yoloProIntegration.processTask(taskData);
    },

    updateProgress: async (progress) => {
      return { success: true, updated: true };
    },

    validateWorkflow: async (workflow) => {
      return await yoloProIntegration.integrateWithWorkflow(workflow);
    }
  },

  swarm: {
    coordinateAgents: async (task) => {
      return await yoloProIntegration.coordinateAgents(task);
    },

    distributeTask: async (task) => {
      return { success: true, distributed: true };
    },

    collectResults: async (swarmId) => {
      return await yoloProIntegration.collectResults(swarmId);
    }
  },

  ci: {
    validateBranch: async (branchData) => {
      return await yoloProIntegration.validateBranch(branchData);
    },

    runTests: async (testConfig) => {
      return await yoloProIntegration.runTests(testConfig);
    },

    checkMergeRequirements: async (branchData) => {
      return await yoloProIntegration.checkMergeRequirements(branchData);
    }
  },

  protocols: {
    wcp: {
      validateChunking: async (data) => {
        return { success: true, valid: true };
      },

      processFeature: async (feature) => {
        return await yoloProIntegration.processFeature(feature);
      }
    }
  }
};

/**
 * Security utilities mock
 */
const SecurityUtilsMock = {
  isAllowedPath: (filePath, allowedPaths = []) => {
    return securityUtils.isAllowedPath(filePath, allowedPaths);
  },

  hashPath: (filePath) => {
    return securityUtils.hashPath(filePath);
  },

  checkFileIntegrity: async (filePath, expectedChecksum) => {
    return await validatorInstance.checkFileIntegrity(filePath, expectedChecksum);
  },

  validateChecksum: async (filePath, expectedChecksum) => {
    return await validatorInstance.validateChecksum(filePath, expectedChecksum);
  },

  detectMaliciousContent: (content) => {
    return validatorInstance.detectMaliciousContent(content);
  }
};

/**
 * Audit logger mock
 */
const AuditLoggerMock = {
  logAccess: async (accessData) => {
    return await auditLogger.logAccess(accessData);
  },

  logSecurityEvent: async (eventData) => {
    return await auditLogger.logSecurityEvent(eventData);
  },

  logSuspiciousActivity: async (activityData) => {
    return await auditLogger.logSuspiciousActivity(activityData);
  }
};

/**
 * Claude Flow mock
 */
const ClaudeFlowMock = {
  swarm: {
    init: async (config) => {
      return {
        swarmId: 'swarm-001',
        topology: config.topology || 'mesh',
        maxAgents: config.maxAgents || 5,
        autoScaling: true,
        initialAgents: 3
      };
    },

    spawn: async (agentConfig) => {
      return {
        agentId: `agent-${Math.random().toString(36).substr(2, 9)}`,
        type: agentConfig.type || 'generic'
      };
    },

    orchestrate: async (task) => {
      return { success: true, taskId: task.id || 'task-001' };
    }
  },

  memory: {
    store: async (key, value, options = {}) => {
      return {
        success: true,
        key,
        namespace: options.namespace || 'default'
      };
    },

    retrieve: async (key, options = {}) => {
      return {
        success: true,
        data: { mockData: 'retrieved' },
        namespace: options.namespace || 'default'
      };
    }
  },

  hooks: {
    preTask: async (task) => {
      return { success: true, taskId: task.id };
    },

    postTask: async (result) => {
      return { success: true, logged: true };
    }
  }
};

module.exports = {
  FileReferenceProtocol: FileReferenceProtocolMock,
  YoloPro: YoloProMock,
  SecurityUtils: SecurityUtilsMock,
  AuditLogger: AuditLoggerMock,
  ClaudeFlow: ClaudeFlowMock
};