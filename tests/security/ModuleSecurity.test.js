/**
 * Unit tests for ModuleSecurity - Module security validation and sandboxing
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ModuleSecurity } from '../../src/security/ModuleSecurity.js';

describe('ModuleSecurity', () => {
  let security;
  let mockEngine;

  beforeEach(async () => {
    mockEngine = {};
    security = new ModuleSecurity(mockEngine);
    await security.initialize();
  });

  afterEach(async () => {
    await security.shutdown();
  });

  describe('Initialization', () => {
    it('should initialize successfully', () => {
      expect(security.isInitialized).toBe(true);
    });

    it('should throw error on double initialization', async () => {
      const newSecurity = new ModuleSecurity(mockEngine);
      await newSecurity.initialize();
      
      await expect(newSecurity.initialize()).rejects.toThrow('ModuleSecurity already initialized');
      
      await newSecurity.shutdown();
    });

    it('should setup default permissions', async () => {
      expect(security.securityPolicies.has('default')).toBe(true);
      expect(security.securityPolicies.has('trusted')).toBe(true);
      expect(security.securityPolicies.has('moderate')).toBe(true);
      expect(security.securityPolicies.has('strict')).toBe(true);
    });
  });

  describe('Module Validation', () => {
    it('should validate a safe module', async () => {
      const moduleSpec = {
        id: 'safe-module',
        name: 'Safe Module',
        version: '1.0.0',
        source: 'npm',
        code: 'function safeFunction() { return "Hello World"; }'
      };

      const result = await security.validateModule(moduleSpec);

      expect(result.valid).toBe(true);
      expect(result.securityLevel).toBeDefined();
    });

    it('should reject banned modules', async () => {
      const moduleId = 'banned-module';
      security.banModule(moduleId, 'Test ban');

      const moduleSpec = {
        id: moduleId,
        name: 'Banned Module',
        version: '1.0.0'
      };

      const result = await security.validateModule(moduleSpec);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('is banned');
    });

    it('should reject modules with dangerous code patterns', async () => {
      const moduleSpec = {
        id: 'dangerous-module',
        name: 'Dangerous Module',
        version: '1.0.0',
        code: 'eval("malicious code")'
      };

      const result = await security.validateModule(moduleSpec);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Dangerous code pattern detected');
    });

    it('should detect multiple dangerous patterns', async () => {
      const dangerousPatterns = [
        'eval("code")',
        'new Function("code")',
        'require("child_process")',
        'process.exit()',
        '__dirname'
      ];

      for (const pattern of dangerousPatterns) {
        const moduleSpec = {
          id: `test-${Math.random()}`,
          name: 'Test Module',
          version: '1.0.0',
          code: pattern
        };

        const result = await security.validateModule(moduleSpec);
        expect(result.valid).toBe(false);
      }
    });

    it('should reject modules from untrusted sources', async () => {
      const moduleSpec = {
        id: 'untrusted-module',
        name: 'Untrusted Module',
        version: '1.0.0',
        source: 'unknown-source'
      };

      const result = await security.validateModule(moduleSpec);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Untrusted source');
    });

    it('should validate required fields', async () => {
      const moduleSpec = {
        // Missing name
        version: '1.0.0'
      };

      const result = await security.validateModule(moduleSpec);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Module name is required');
    });

    it('should validate unknown permissions', async () => {
      const moduleSpec = {
        id: 'permission-test',
        name: 'Permission Test',
        version: '1.0.0',
        permissions: ['unknown-permission']
      };

      const result = await security.validateModule(moduleSpec);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Unknown permission');
    });

    it('should validate code signing when enabled', async () => {
      const securityWithSigning = new ModuleSecurity(mockEngine);
      securityWithSigning.config.enforceCodeSigning = true;
      await securityWithSigning.initialize();

      const moduleSpec = {
        id: 'unsigned-module',
        name: 'Unsigned Module',
        version: '1.0.0',
        code: 'function test() { return true; }'
        // Missing signature
      };

      const result = await securityWithSigning.validateModule(moduleSpec);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Module signature is required');

      await securityWithSigning.shutdown();
    });

    it('should validate proper code signatures', async () => {
      const securityWithSigning = new ModuleSecurity(mockEngine);
      securityWithSigning.config.enforceCodeSigning = true;
      await securityWithSigning.initialize();

      const moduleSpec = {
        id: 'signed-module',
        name: 'Signed Module',
        version: '1.0.0',
        code: 'function test() { return true; }'
      };

      // Calculate expected signature
      const expectedSignature = securityWithSigning.calculateSignature(moduleSpec);
      moduleSpec.signature = expectedSignature;

      const result = await securityWithSigning.validateModule(moduleSpec);

      expect(result.valid).toBe(true);

      await securityWithSigning.shutdown();
    });
  });

  describe('Security Levels', () => {
    it('should assign trusted level to trusted modules', async () => {
      const moduleId = 'trusted-module';
      security.trustModule(moduleId, 'Test trust');

      const moduleSpec = {
        id: moduleId,
        name: 'Trusted Module',
        version: '1.0.0'
      };

      const result = await security.validateModule(moduleSpec);

      expect(result.valid).toBe(true);
      expect(result.securityLevel).toBe(security.securityLevels.TRUSTED);
    });

    it('should assign strict level to modules with dangerous permissions', async () => {
      const moduleSpec = {
        id: 'dangerous-permissions',
        name: 'Dangerous Permissions',
        version: '1.0.0',
        permissions: [security.permissions.PROCESS, security.permissions.FILE_SYSTEM]
      };

      const result = await security.validateModule(moduleSpec);

      expect(result.valid).toBe(true);
      expect(result.securityLevel).toBe(security.securityLevels.STRICT);
    });

    it('should assign moderate level to safe modules', async () => {
      const moduleSpec = {
        id: 'moderate-module',
        name: 'Moderate Module',
        version: '1.0.0',
        permissions: [security.permissions.NETWORK]
      };

      const result = await security.validateModule(moduleSpec);

      expect(result.valid).toBe(true);
      expect(result.securityLevel).toBe(security.securityLevels.MODERATE);
    });
  });

  describe('Sandbox Creation', () => {
    it('should create secure sandbox', () => {
      const sandbox = security.createSecureSandbox('test-module', [
        security.permissions.CRYPTO,
        security.permissions.NETWORK
      ]);

      expect(sandbox).toBeDefined();
      expect(sandbox.console).toBeDefined();
      expect(sandbox.setTimeout).toBeDefined();
      expect(sandbox.crypto).toBeDefined(); // Has crypto permission
      expect(sandbox.fetch).toBeDefined(); // Has network permission
      expect(sandbox.fs).toBeUndefined(); // No file system permission
    });

    it('should return null when sandboxing is disabled', () => {
      const securityWithoutSandbox = new ModuleSecurity(mockEngine);
      securityWithoutSandbox.config.enableSandboxing = false;

      const sandbox = securityWithoutSandbox.createSecureSandbox('test-module');

      expect(sandbox).toBeNull();
    });

    it('should restrict setTimeout delays', () => {
      const sandbox = security.createSecureSandbox('test-module');

      expect(() => sandbox.setTimeout(() => {}, 31000)).toThrow('Timeout too long');
    });

    it('should restrict setInterval intervals', () => {
      const sandbox = security.createSecureSandbox('test-module');

      expect(() => sandbox.setInterval(() => {}, 50)).toThrow('Interval too short');
    });

    it('should provide secure fetch with URL restrictions', async () => {
      const sandbox = security.createSecureSandbox('test-module', [security.permissions.NETWORK]);

      // Mock fetch for testing
      global.fetch = jest.fn().mockResolvedValue({ ok: true });

      await sandbox.fetch('https://api.example.com/data');
      expect(global.fetch).toHaveBeenCalled();

      await expect(sandbox.fetch('ftp://malicious.com'))
        .rejects.toThrow('Only HTTPS URLs are allowed');
    });

    it('should provide secure file system with path restrictions', async () => {
      const sandbox = security.createSecureSandbox('test-module', [security.permissions.FILE_SYSTEM]);

      const fs = require('fs').promises;
      jest.spyOn(fs, 'readFile').mockResolvedValue('file content');

      await sandbox.fs.readFile('./temp/allowed.txt');
      expect(fs.readFile).toHaveBeenCalled();

      await expect(sandbox.fs.readFile('/etc/passwd'))
        .rejects.toThrow('File access denied');
    });
  });

  describe('Runtime Monitoring', () => {
    it('should start runtime monitoring', () => {
      const moduleId = 'monitored-module';
      const mockModule = { test: true };

      const monitor = security.startRuntimeMonitoring(moduleId, mockModule);

      expect(monitor).toBeDefined();
      expect(monitor.startTime).toBeGreaterThan(0);
      expect(security.securityContexts.has(moduleId)).toBe(true);
    });

    it('should stop runtime monitoring', () => {
      const moduleId = 'monitored-module';
      const mockModule = { test: true };

      security.startRuntimeMonitoring(moduleId, mockModule);
      security.stopRuntimeMonitoring(moduleId);

      const context = security.securityContexts.get(moduleId);
      expect(context.monitorInterval).toBeUndefined();
    });

    it('should detect memory violations', () => {
      const moduleId = 'memory-violator';
      const mockModule = { test: true };

      const violationHandler = jest.fn();
      security.on('security:violation', violationHandler);

      const monitor = security.startRuntimeMonitoring(moduleId, mockModule);
      
      // Mock memory usage to exceed limit
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = jest.fn().mockReturnValue({
        heapUsed: security.config.maxMemoryUsage + 1000000
      });

      monitor.checkMemory();

      expect(violationHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          moduleId,
          type: 'MEMORY_LIMIT_EXCEEDED'
        })
      );

      process.memoryUsage = originalMemoryUsage;
    });

    it('should detect execution time violations', () => {
      const moduleId = 'time-violator';
      const mockModule = { test: true };

      const violationHandler = jest.fn();
      security.on('security:violation', violationHandler);

      const monitor = security.startRuntimeMonitoring(moduleId, mockModule);
      
      // Simulate long execution time
      monitor.startTime = Date.now() - (security.config.maxExecutionTime + 1000);
      monitor.checkExecutionTime();

      expect(violationHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          moduleId,
          type: 'EXECUTION_TIME_EXCEEDED'
        })
      );
    });
  });

  describe('Permissions Management', () => {
    it('should set and check module permissions', () => {
      const moduleId = 'permission-test';
      const permissions = [security.permissions.NETWORK, security.permissions.CRYPTO];

      security.setModulePermissions(moduleId, permissions);

      expect(security.hasPermission(moduleId, security.permissions.NETWORK)).toBe(true);
      expect(security.hasPermission(moduleId, security.permissions.CRYPTO)).toBe(true);
      expect(security.hasPermission(moduleId, security.permissions.FILE_SYSTEM)).toBe(false);
    });

    it('should handle non-existent module permissions', () => {
      expect(security.hasPermission('non-existent', security.permissions.NETWORK)).toBe(false);
    });
  });

  describe('Trust Management', () => {
    it('should trust and untrust modules', () => {
      const moduleId = 'trust-test';
      const trustedHandler = jest.fn();
      security.on('security:module-trusted', trustedHandler);

      security.trustModule(moduleId, 'Test reason');

      expect(security.trustedModules.has(moduleId)).toBe(true);
      expect(trustedHandler).toHaveBeenCalledWith({ moduleId, reason: 'Test reason' });
    });

    it('should ban modules', () => {
      const moduleId = 'ban-test';
      const bannedHandler = jest.fn();
      security.on('security:module-banned', bannedHandler);

      security.banModule(moduleId, 'Test ban reason');

      expect(security.bannedModules.has(moduleId)).toBe(true);
      expect(bannedHandler).toHaveBeenCalledWith({ moduleId, reason: 'Test ban reason' });
    });
  });

  describe('Security Reports', () => {
    it('should generate security report for module', () => {
      const moduleId = 'report-test';
      
      security.trustModule(moduleId);
      security.setModulePermissions(moduleId, [security.permissions.NETWORK]);

      const report = security.getSecurityReport(moduleId);

      expect(report.moduleId).toBe(moduleId);
      expect(report.trusted).toBe(true);
      expect(report.banned).toBe(false);
      expect(report.permissions).toContain(security.permissions.NETWORK);
      expect(report.securityLevel).toBe(security.securityLevels.TRUSTED);
    });

    it('should include violations in report', () => {
      const moduleId = 'violation-test';
      
      // Create security context with violations
      security.securityContexts.set(moduleId, {
        monitor: {
          violations: [
            { type: 'MEMORY_VIOLATION', timestamp: Date.now() }
          ]
        }
      });

      const report = security.getSecurityReport(moduleId);

      expect(report.violations).toHaveLength(1);
      expect(report.violations[0].type).toBe('MEMORY_VIOLATION');
    });
  });

  describe('Metrics', () => {
    it('should track security metrics', async () => {
      const initialMetrics = security.getMetrics();

      // Perform some security operations
      await security.validateModule({
        id: 'metrics-test',
        name: 'Metrics Test',
        version: '1.0.0'
      });

      security.trustModule('trusted-module');
      security.banModule('banned-module');

      const metrics = security.getMetrics();

      expect(metrics.validationsPerformed).toBe(initialMetrics.validationsPerformed + 1);
      expect(metrics.trustedModules).toBe(initialMetrics.trustedModules + 1);
      expect(metrics.bannedModules).toBe(initialMetrics.bannedModules + 1);
    });

    it('should track violation metrics', () => {
      const initialMetrics = security.getMetrics();

      security.recordSecurityViolation('test-module', 'TEST_VIOLATION', {});

      const metrics = security.getMetrics();

      expect(metrics.securityViolations).toBe(initialMetrics.securityViolations + 1);
    });
  });

  describe('Error Handling', () => {
    it('should handle validation errors gracefully', async () => {
      const errorHandler = jest.fn();
      security.on('security:validation-error', errorHandler);

      // Force an error in validation
      const moduleSpec = {
        id: 'error-test',
        name: 'Error Test',
        version: '1.0.0',
        code: 'invalid javascript syntax {'
      };

      const result = await security.validateModule(moduleSpec);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Security validation failed');
      expect(errorHandler).toHaveBeenCalled();
    });
  });

  describe('Shutdown', () => {
    it('should shutdown gracefully', async () => {
      const shutdownHandler = jest.fn();
      security.on('security:shutdown', shutdownHandler);

      // Add some security contexts
      security.startRuntimeMonitoring('test1', {});
      security.startRuntimeMonitoring('test2', {});

      await security.shutdown();

      expect(shutdownHandler).toHaveBeenCalled();
      expect(security.securityContexts.size).toBe(0);
    });
  });
});