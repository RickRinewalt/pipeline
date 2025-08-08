/**
 * Module Security - Comprehensive security framework for module validation and sandboxing
 * Provides code analysis, permission management, and runtime security monitoring
 */

import EventEmitter from 'events';
import crypto from 'crypto';
import vm from 'vm';

export class ModuleSecurity extends EventEmitter {
  constructor(engine) {
    super();
    this.engine = engine;
    this.securityPolicies = new Map();
    this.trustedModules = new Set();
    this.bannedModules = new Set();
    this.modulePermissions = new Map();
    this.securityContexts = new Map();
    
    this.config = {
      enforceCodeSigning: false,
      allowDynamicImports: false,
      maxMemoryUsage: 100 * 1024 * 1024, // 100MB
      maxExecutionTime: 10000, // 10 seconds
      enableSandboxing: true,
      trustedSources: ['npm', 'internal'],
      dangerousPatterns: [
        /eval\s*\(/,
        /Function\s*\(/,
        /require\s*\(\s*['"]child_process['"].*\)/,
        /process\.exit/,
        /__dirname/,
        /__filename/
      ]
    };

    this.securityLevels = {
      STRICT: 'strict',
      MODERATE: 'moderate',
      PERMISSIVE: 'permissive',
      TRUSTED: 'trusted'
    };

    this.permissions = {
      FILE_SYSTEM: 'filesystem',
      NETWORK: 'network',
      PROCESS: 'process',
      CRYPTO: 'crypto',
      ENVIRONMENT: 'environment',
      EXTERNAL_MODULES: 'external_modules'
    };

    this.metrics = {
      validationsPerformed: 0,
      securityViolations: 0,
      modulesBlocked: 0,
      sandboxViolations: 0,
      codeSigningViolations: 0
    };

    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) {
      throw new Error('ModuleSecurity already initialized');
    }

    this.emit('security:initializing');

    // Load security policies
    await this.loadSecurityPolicies();

    // Setup default permissions
    this.setupDefaultPermissions();

    // Initialize code signing if enabled
    if (this.config.enforceCodeSigning) {
      await this.initializeCodeSigning();
    }

    this.isInitialized = true;
    this.emit('security:initialized');
  }

  /**
   * Validate a module against security policies
   */
  async validateModule(moduleSpec) {
    this.metrics.validationsPerformed++;
    
    try {
      this.emit('security:validating', { moduleSpec });

      // Basic validation
      const basicValidation = await this.performBasicValidation(moduleSpec);
      if (!basicValidation.valid) {
        return basicValidation;
      }

      // Source validation
      const sourceValidation = await this.validateModuleSource(moduleSpec);
      if (!sourceValidation.valid) {
        return sourceValidation;
      }

      // Code analysis
      const codeValidation = await this.analyzeModuleCode(moduleSpec);
      if (!codeValidation.valid) {
        return codeValidation;
      }

      // Permission check
      const permissionValidation = await this.validatePermissions(moduleSpec);
      if (!permissionValidation.valid) {
        return permissionValidation;
      }

      // Code signing validation
      if (this.config.enforceCodeSigning) {
        const signingValidation = await this.validateCodeSigning(moduleSpec);
        if (!signingValidation.valid) {
          return signingValidation;
        }
      }

      this.emit('security:validated', { moduleSpec, result: 'valid' });
      return { valid: true, securityLevel: this.determineSecurityLevel(moduleSpec) };

    } catch (error) {
      this.metrics.securityViolations++;
      this.emit('security:validation-error', { moduleSpec, error });
      return { 
        valid: false, 
        reason: `Security validation failed: ${error.message}` 
      };
    }
  }

  /**
   * Create secure sandbox for module execution
   */
  createSecureSandbox(moduleId, permissions = []) {
    if (!this.config.enableSandboxing) {
      return null;
    }

    const sandbox = {
      // Safe globals
      console: {
        log: (...args) => this.emit('sandbox:log', { moduleId, args }),
        error: (...args) => this.emit('sandbox:error', { moduleId, args }),
        warn: (...args) => this.emit('sandbox:warn', { moduleId, args }),
        info: (...args) => this.emit('sandbox:info', { moduleId, args })
      },
      
      // Restricted globals
      setTimeout: (callback, delay) => {
        if (delay > 30000) { // Max 30 seconds
          throw new Error('Timeout too long');
        }
        return setTimeout(callback, delay);
      },
      
      clearTimeout,
      setInterval: (callback, interval) => {
        if (interval < 100) { // Min 100ms
          throw new Error('Interval too short');
        }
        return setInterval(callback, interval);
      },
      
      clearInterval,

      // Module-specific APIs
      __moduleId: moduleId,
      __permissions: new Set(permissions)
    };

    // Add permitted APIs
    if (permissions.includes(this.permissions.CRYPTO)) {
      sandbox.crypto = crypto;
    }

    if (permissions.includes(this.permissions.NETWORK)) {
      sandbox.fetch = this.createSecureFetch(moduleId);
    }

    if (permissions.includes(this.permissions.FILE_SYSTEM)) {
      sandbox.fs = this.createSecureFileSystem(moduleId);
    }

    this.securityContexts.set(moduleId, {
      sandbox,
      permissions: new Set(permissions),
      createdAt: Date.now()
    });

    return sandbox;
  }

  /**
   * Monitor module runtime security
   */
  startRuntimeMonitoring(moduleId, module) {
    const monitor = {
      startTime: Date.now(),
      memoryPeak: 0,
      violations: [],
      
      checkMemory: () => {
        const usage = process.memoryUsage();
        monitor.memoryPeak = Math.max(monitor.memoryPeak, usage.heapUsed);
        
        if (usage.heapUsed > this.config.maxMemoryUsage) {
          this.recordSecurityViolation(moduleId, 'MEMORY_LIMIT_EXCEEDED', {
            usage: usage.heapUsed,
            limit: this.config.maxMemoryUsage
          });
        }
      },
      
      checkExecutionTime: () => {
        const runtime = Date.now() - monitor.startTime;
        if (runtime > this.config.maxExecutionTime) {
          this.recordSecurityViolation(moduleId, 'EXECUTION_TIME_EXCEEDED', {
            runtime,
            limit: this.config.maxExecutionTime
          });
        }
      }
    };

    // Start monitoring interval
    const monitorInterval = setInterval(() => {
      monitor.checkMemory();
      monitor.checkExecutionTime();
    }, 1000);

    // Store monitor
    this.securityContexts.set(moduleId, {
      ...this.securityContexts.get(moduleId),
      monitor,
      monitorInterval
    });

    return monitor;
  }

  /**
   * Stop runtime monitoring
   */
  stopRuntimeMonitoring(moduleId) {
    const context = this.securityContexts.get(moduleId);
    
    if (context && context.monitorInterval) {
      clearInterval(context.monitorInterval);
      this.emit('security:monitoring-stopped', { 
        moduleId, 
        metrics: context.monitor 
      });
    }
  }

  /**
   * Set permissions for a module
   */
  setModulePermissions(moduleId, permissions) {
    this.modulePermissions.set(moduleId, new Set(permissions));
    this.emit('security:permissions-set', { moduleId, permissions });
  }

  /**
   * Check if module has permission
   */
  hasPermission(moduleId, permission) {
    const permissions = this.modulePermissions.get(moduleId) || new Set();
    return permissions.has(permission);
  }

  /**
   * Add module to trusted list
   */
  trustModule(moduleId, reason = '') {
    this.trustedModules.add(moduleId);
    this.emit('security:module-trusted', { moduleId, reason });
  }

  /**
   * Add module to banned list
   */
  banModule(moduleId, reason = '') {
    this.bannedModules.add(moduleId);
    this.emit('security:module-banned', { moduleId, reason });
  }

  /**
   * Get security report for module
   */
  getSecurityReport(moduleId) {
    const context = this.securityContexts.get(moduleId);
    const permissions = this.modulePermissions.get(moduleId) || new Set();
    
    return {
      moduleId,
      trusted: this.trustedModules.has(moduleId),
      banned: this.bannedModules.has(moduleId),
      permissions: Array.from(permissions),
      violations: context ? context.monitor?.violations || [] : [],
      runtimeMetrics: context ? context.monitor : null,
      securityLevel: this.getModuleSecurityLevel(moduleId)
    };
  }

  /**
   * Get overall security metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      trustedModules: this.trustedModules.size,
      bannedModules: this.bannedModules.size,
      activeContexts: this.securityContexts.size,
      totalPermissions: Array.from(this.modulePermissions.values())
        .reduce((sum, perms) => sum + perms.size, 0)
    };
  }

  async shutdown() {
    this.emit('security:shutting-down');

    // Stop all monitoring
    for (const moduleId of this.securityContexts.keys()) {
      this.stopRuntimeMonitoring(moduleId);
    }

    // Clear all contexts
    this.securityContexts.clear();
    this.modulePermissions.clear();

    this.emit('security:shutdown');
  }

  // Private methods

  async performBasicValidation(moduleSpec) {
    // Check banned modules
    const moduleId = moduleSpec.id || moduleSpec.name;
    if (this.bannedModules.has(moduleId)) {
      this.metrics.modulesBlocked++;
      return { 
        valid: false, 
        reason: `Module ${moduleId} is banned` 
      };
    }

    // Check required fields
    if (!moduleSpec.name) {
      return { valid: false, reason: 'Module name is required' };
    }

    if (!moduleSpec.version) {
      return { valid: false, reason: 'Module version is required' };
    }

    return { valid: true };
  }

  async validateModuleSource(moduleSpec) {
    if (moduleSpec.source && !this.config.trustedSources.includes(moduleSpec.source)) {
      return { 
        valid: false, 
        reason: `Untrusted source: ${moduleSpec.source}` 
      };
    }

    return { valid: true };
  }

  async analyzeModuleCode(moduleSpec) {
    if (!moduleSpec.code && !moduleSpec.path) {
      return { valid: true }; // No code to analyze
    }

    let code = moduleSpec.code;
    
    // Load code from path if necessary
    if (!code && moduleSpec.path) {
      try {
        const fs = await import('fs');
        code = await fs.promises.readFile(moduleSpec.path, 'utf-8');
      } catch (error) {
        return { 
          valid: false, 
          reason: `Cannot read module code: ${error.message}` 
        };
      }
    }

    // Check for dangerous patterns
    for (const pattern of this.config.dangerousPatterns) {
      if (pattern.test(code)) {
        this.metrics.securityViolations++;
        return { 
          valid: false, 
          reason: `Dangerous code pattern detected: ${pattern}` 
        };
      }
    }

    // Static analysis
    const analysisResult = await this.performStaticAnalysis(code);
    if (!analysisResult.safe) {
      return { 
        valid: false, 
        reason: `Static analysis failed: ${analysisResult.reason}` 
      };
    }

    return { valid: true };
  }

  async validatePermissions(moduleSpec) {
    const requestedPermissions = moduleSpec.permissions || [];
    
    for (const permission of requestedPermissions) {
      if (!Object.values(this.permissions).includes(permission)) {
        return { 
          valid: false, 
          reason: `Unknown permission: ${permission}` 
        };
      }
    }

    return { valid: true };
  }

  async validateCodeSigning(moduleSpec) {
    if (!moduleSpec.signature) {
      this.metrics.codeSigningViolations++;
      return { 
        valid: false, 
        reason: 'Module signature is required' 
      };
    }

    // Simplified signature validation
    const expectedSignature = this.calculateSignature(moduleSpec);
    if (moduleSpec.signature !== expectedSignature) {
      this.metrics.codeSigningViolations++;
      return { 
        valid: false, 
        reason: 'Invalid module signature' 
      };
    }

    return { valid: true };
  }

  determineSecurityLevel(moduleSpec) {
    const moduleId = moduleSpec.id || moduleSpec.name;
    
    if (this.trustedModules.has(moduleId)) {
      return this.securityLevels.TRUSTED;
    }

    const permissions = moduleSpec.permissions || [];
    const dangerousPermissions = [
      this.permissions.PROCESS,
      this.permissions.FILE_SYSTEM
    ];

    if (permissions.some(p => dangerousPermissions.includes(p))) {
      return this.securityLevels.STRICT;
    }

    return this.securityLevels.MODERATE;
  }

  async performStaticAnalysis(code) {
    try {
      // Create temporary context for syntax validation
      vm.createContext({});
      new vm.Script(code);
      
      return { safe: true };
    } catch (error) {
      return { 
        safe: false, 
        reason: `Syntax error: ${error.message}` 
      };
    }
  }

  createSecureFetch(moduleId) {
    return async (url, options = {}) => {
      // URL validation
      if (!url.startsWith('https://') && !url.startsWith('http://localhost')) {
        throw new Error('Only HTTPS URLs are allowed (except localhost)');
      }

      this.emit('security:network-request', { moduleId, url, options });
      
      // Use standard fetch with additional security
      const response = await fetch(url, {
        ...options,
        timeout: 10000 // 10 second timeout
      });

      return response;
    };
  }

  createSecureFileSystem(moduleId) {
    const fs = require('fs').promises;
    
    return {
      readFile: async (path, options) => {
        if (!this.isPathAllowed(path)) {
          throw new Error(`File access denied: ${path}`);
        }
        
        this.emit('security:file-access', { moduleId, path, operation: 'read' });
        return fs.readFile(path, options);
      },
      
      writeFile: async (path, data, options) => {
        if (!this.isPathAllowed(path)) {
          throw new Error(`File write denied: ${path}`);
        }
        
        this.emit('security:file-access', { moduleId, path, operation: 'write' });
        return fs.writeFile(path, data, options);
      }
    };
  }

  isPathAllowed(path) {
    // Only allow access to certain directories
    const allowedPaths = ['./temp/', './data/', './logs/'];
    return allowedPaths.some(allowed => path.startsWith(allowed));
  }

  recordSecurityViolation(moduleId, type, details) {
    this.metrics.securityViolations++;
    
    const violation = {
      moduleId,
      type,
      details,
      timestamp: Date.now()
    };

    const context = this.securityContexts.get(moduleId);
    if (context && context.monitor) {
      context.monitor.violations.push(violation);
    }

    this.emit('security:violation', violation);
  }

  calculateSignature(moduleSpec) {
    const data = JSON.stringify({
      name: moduleSpec.name,
      version: moduleSpec.version,
      code: moduleSpec.code
    });
    
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  getModuleSecurityLevel(moduleId) {
    if (this.trustedModules.has(moduleId)) {
      return this.securityLevels.TRUSTED;
    }
    
    const permissions = this.modulePermissions.get(moduleId) || new Set();
    const dangerousPermissions = [
      this.permissions.PROCESS,
      this.permissions.FILE_SYSTEM
    ];

    if (Array.from(permissions).some(p => dangerousPermissions.includes(p))) {
      return this.securityLevels.STRICT;
    }

    return this.securityLevels.MODERATE;
  }

  async loadSecurityPolicies() {
    // Load default security policies
    this.securityPolicies.set('default', {
      maxMemoryUsage: this.config.maxMemoryUsage,
      maxExecutionTime: this.config.maxExecutionTime,
      allowedPermissions: Object.values(this.permissions)
    });
  }

  setupDefaultPermissions() {
    // Setup default permission sets for different security levels
    this.securityPolicies.set('trusted', new Set(Object.values(this.permissions)));
    this.securityPolicies.set('moderate', new Set([
      this.permissions.NETWORK,
      this.permissions.CRYPTO
    ]));
    this.securityPolicies.set('strict', new Set([
      this.permissions.CRYPTO
    ]));
  }

  async initializeCodeSigning() {
    // Initialize code signing infrastructure
    this.emit('security:code-signing-initialized');
  }
}

export default ModuleSecurity;