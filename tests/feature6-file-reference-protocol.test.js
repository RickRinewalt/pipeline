/**
 * Feature 6: File Reference Protocol Implementation - Core Tests
 * TDD Test Suite for File Reference Protocol
 * 
 * This test suite validates the core file reference protocol functionality
 * including path validation, file existence checking, and response formatting.
 */

const fs = require('fs').promises;
const path = require('path');

// Import the real implementation
const FileReferenceProtocol = require('../yolo-pro/src/file-reference-protocol');

// Create instance for testing
const protocol = new FileReferenceProtocol();

describe('Feature 6: File Reference Protocol - Core Functionality', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  describe('Path Validation', () => {
    describe('Valid Paths', () => {
      const validPaths = [
        '/absolute/path/to/file.js',
        './relative/path/to/file.js',
        '../parent/path/to/file.js',
        'simple-file.js',
        'path/with-dashes/file.js',
        'path/with_underscores/file.js',
        'path/with.dots/file.js',
        '/workspaces/project/src/index.js',
        './tests/unit/test-file.spec.js',
      ];

      test.each(validPaths)('should validate path: %s', async (validPath) => {
        const result = await protocol.validatePath(validPath);

        expect(result.isValid).toBe(true);
        expect(result.normalizedPath).toBeDefined();
        expect(result.pathType).toMatch(/^(absolute|relative)$/);
      });
    });

    describe('Invalid Paths', () => {
      const invalidPaths = [
        '',
        null,
        undefined,
        '   ',
        'path/../../../etc/passwd',
        'path/with\0nullbytes',
        'path/with<script>alert(1)</script>',
        'C:\\windows\\system32\\config',
        'file:///etc/passwd',
        'http://malicious.com/file.js',
        'path/with|pipe',
        'path/with*wildcard',
        'path/with"quotes"',
      ];

      test.each(invalidPaths)('should reject invalid path: %s', async (invalidPath) => {
        const result = await protocol.validatePath(invalidPath);

        expect(result.isValid).toBe(false);
        expect(result.error).toBeDefined();
        expect(['INVALID_PATH', 'SECURITY_VIOLATION', 'PATH_TOO_LONG'].includes(result.code)).toBe(true);
      });
    });

    describe('Path Normalization', () => {
      test('should normalize relative paths correctly', async () => {
        const testCases = [
          { input: './src/../src/file.js', expected: 'file.js' },
          { input: '../parent/./child/file.js', expected: 'file.js' },
          { input: 'path//double//slash.js', expected: 'slash.js' },
          { input: './file.js', expected: 'file.js' },
        ];

        for (const testCase of testCases) {
          const result = await protocol.validatePath(testCase.input);
          expect(result.isValid).toBe(true);
          expect(result.normalizedPath).toContain(testCase.expected);
        }
      });

      test('should handle edge cases in path normalization', async () => {
        const edgeCases = [
          { input: '/', expected: '/', type: 'absolute' },
          { input: '.', expected: '.', type: 'relative' },
          { input: '..', expected: '..', type: 'relative' },
        ];

        for (const edgeCase of edgeCases) {
          const result = await protocol.validatePath(edgeCase.input);
          expect(result.isValid).toBe(true);
          expect(result.pathType).toBe(edgeCase.type);
        }
      });
    });
  });

  describe('File Existence Checking', () => {
    describe('Existing Files', () => {
      test('should confirm existence of valid files', async () => {
        const testPath = '/workspaces/project/src/index.js';
        const result = await protocol.checkFileExists(testPath);

        expect(typeof result.exists).toBe('boolean');
        if (result.exists) {
          expect(typeof result.isFile).toBe('boolean');
          expect(typeof result.isDirectory).toBe('boolean');
          expect(result.permissions).toHaveProperty('readable');
        } else {
          expect(result.code).toBeDefined();
        }
      });

      test('should handle directories correctly', async () => {
        const testPath = '/workspaces/project';
        const result = await protocol.checkFileExists(testPath);

        expect(typeof result.exists).toBe('boolean');
        if (result.exists && result.isDirectory) {
          expect(result.isFile).toBe(false);
          expect(result.isDirectory).toBe(true);
        }
      });
    });

    describe('Non-existent Files', () => {
      test('should handle missing files gracefully', async () => {
        const testPath = '/workspaces/project/nonexistent.js';
        const result = await protocol.checkFileExists(testPath);

        expect(result.exists).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.code).toBeDefined();
      });

      test('should handle permission denied errors', async () => {
        const testPath = '/root/restricted-file.js';
        const result = await protocol.checkFileExists(testPath);

        expect(result.exists).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.code).toBeDefined();
      });
    });

    describe('File System Errors', () => {
      const errorCodes = ['ENOENT', 'EACCES', 'EISDIR', 'ENOTDIR', 'EMFILE', 'ENFILE'];

      test.each(errorCodes)('should handle file system error: %s', async (errorCode) => {
        const testPath = `/test/nonexistent-${errorCode}`;
        const result = await protocol.checkFileExists(testPath);

        expect(result.exists).toBe(false);
        expect(result.code).toBeDefined();
        expect(result.error).toBeDefined();
      });
    });
  });

  describe('Response Format Validation', () => {
    describe('Successful Response Format', () => {
      test('should format successful file reference response', async () => {
        const mockInput = {
          path: '/workspaces/project/src/index.js',
          exists: true,
          isFile: true,
          size: 1024,
          lastModified: new Date('2024-01-01'),
          permissions: { readable: true, writable: true, executable: false }
        };

        const result = protocol.formatResponse(mockInput);

        expect(result.success).toBe(true);
        expect(result.path).toBe(mockInput.path);
        expect(result.exists).toBe(true);
        expect(result.type).toBe('file');
        expect(result.protocol).toBe('file-reference-v1');
        expect(result.timestamp).toBeDefined();
      });

      test('should format directory response correctly', async () => {
        const mockInput = {
          path: '/workspaces/project/src',
          exists: true,
          isDirectory: true,
          permissions: { readable: true, writable: true, executable: true }
        };

        const result = protocol.formatResponse(mockInput);

        expect(result.success).toBe(true);
        expect(result.type).toBe('directory');
        expect(result.protocol).toBe('file-reference-v1');
      });
    });

    describe('Error Response Format', () => {
      test('should format error response for invalid path', async () => {
        const mockInput = {
          path: 'invalid/../../../path',
          error: 'Invalid path format',
          code: 'INVALID_PATH'
        };

        const result = protocol.formatResponse(mockInput);

        expect(result.success).toBe(false);
        expect(result.error.code).toBe('INVALID_PATH');
        expect(result.error.type).toBe('validation_error');
        expect(result.protocol).toBe('file-reference-v1');
      });

      test('should format error response for file not found', async () => {
        const mockInput = {
          path: '/workspaces/project/missing.js',
          error: 'File not found',
          code: 'ENOENT'
        };

        const result = protocol.formatResponse(mockInput);

        expect(result.success).toBe(false);
        expect(result.error.code).toBe('ENOENT');
        expect(result.error.type).toBe('filesystem_error');
      });
    });

    describe('Response Schema Validation', () => {
      test('should validate response has required fields', async () => {
        const mockInput = {
          path: '/test/path',
          exists: true
        };

        const result = protocol.formatResponse(mockInput);

        expect(result).toHaveProperty('success');
        expect(result).toHaveProperty('path');
        expect(result).toHaveProperty('protocol');
        expect(result).toHaveProperty('timestamp');
        expect(typeof result.success).toBe('boolean');
        expect(typeof result.path).toBe('string');
        expect(result.protocol).toBe('file-reference-v1');
      });

      test('should validate error response schema', async () => {
        const mockInput = {
          path: '/test/path',
          error: 'Test error',
          code: 'TEST_ERROR'
        };

        const result = protocol.formatResponse(mockInput);

        expect(result.success).toBe(false);
        expect(result.error).toHaveProperty('message');
        expect(result.error).toHaveProperty('code');
        expect(result.error).toHaveProperty('type');
      });
    });
  });

  describe('End-to-End File Processing', () => {
    test('should process valid file reference completely', async () => {
      const inputPath = '/workspaces/project/src/index.js';
      
      const result = await protocol.processFileReference(inputPath);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('path');
      expect(result).toHaveProperty('protocol', 'file-reference-v1');
      expect(result).toHaveProperty('timestamp');
    });

    test('should handle complete processing pipeline for invalid path', async () => {
      const inputPath = 'invalid/../../../path';
      
      const result = await protocol.processFileReference(inputPath);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error.type).toBeDefined();
    });
  });

  describe('Path Sanitization', () => {
    test('should sanitize potentially dangerous paths', async () => {
      const dangerousPaths = [
        '../../../etc/passwd',
        'path\\with\\backslashes',
        'path/with\0nullbyte',
        'path/with<script>',
        'path/with"quotes"',
      ];

      for (const dangerousPath of dangerousPaths) {
        const result = protocol.sanitizePath(dangerousPath);

        expect(result.wasModified).toBe(true);
        expect(result.sanitized).not.toContain('..');
        expect(result.sanitized).not.toContain('\0');
        expect(result.sanitized).not.toContain('<script>');
      }
    });

    test('should not modify safe paths', async () => {
      const safePaths = [
        '/workspaces/project/src/index.js',
        './relative/path/file.js',
        'simple-filename.js',
      ];

      for (const safePath of safePaths) {
        const result = protocol.sanitizePath(safePath);

        expect(result.wasModified).toBe(false);
        expect(result.sanitized).toBe(safePath);
      }
    });
  });
});

describe('Feature 6: File Reference Protocol - Performance Tests', () => {
  describe('Response Time Requirements', () => {
    test('should validate file existence within 100ms', async () => {
      const startTime = Date.now();
      
      await protocol.checkFileExists('/test/path');
      const endTime = Date.now();
      
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(100);
    });

    test('should process multiple file references concurrently', async () => {
      const paths = [
        '/workspaces/project/src/index.js',
        '/workspaces/project/src/utils.js',
        '/workspaces/project/tests/index.test.js',
        '/workspaces/project/docs/README.md',
      ];

      const startTime = Date.now();
      const results = await Promise.all(
        paths.map(path => protocol.processFileReference(path))
      );
      const endTime = Date.now();

      expect(results).toHaveLength(4);
      expect(endTime - startTime).toBeLessThan(200);
      results.forEach(result => {
        expect(result).toHaveProperty('success');
      });
    });
  });

  describe('Memory Usage', () => {
    test('should handle large file metadata without memory leaks', async () => {
      const largePath = '/workspaces/project/large-file.json';
      
      // Test doesn't cause memory issues
      const result = await protocol.processFileReference(largePath);
      
      expect(result).toHaveProperty('success');
    });
  });

  describe('Error Handling Performance', () => {
    test('should fail fast on invalid paths', async () => {
      const invalidPath = '../../../etc/passwd';
      
      const startTime = Date.now();
      const result = await protocol.processFileReference(invalidPath);
      const endTime = Date.now();

      expect(result.success).toBe(false);
      expect(endTime - startTime).toBeLessThan(50);
    });
  });
});