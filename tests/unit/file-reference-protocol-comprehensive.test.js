/**
 * File Reference Protocol - Comprehensive Unit Tests
 * Complete test coverage for all file reference protocol functionality
 */

const fs = require('fs').promises;
const path = require('path');
const FileReferenceProtocol = require('../../../yolo-pro/src/file-reference-protocol');
const FileReferenceValidator = require('../../../yolo-pro/src/file-reference-validator');
const FileReferenceCache = require('../../../yolo-pro/src/file-reference-cache');

describe('FileReferenceProtocol - Comprehensive Unit Tests', () => {
  let protocol;
  let validator;
  let cache;
  let mockFs;
  
  beforeEach(() => {
    protocol = new FileReferenceProtocol();
    validator = new FileReferenceValidator();
    cache = new FileReferenceCache();
    
    // Mock file system operations
    mockFs = {
      access: jest.fn(),
      stat: jest.fn(),
      readdir: jest.fn(),
      realpath: jest.fn()
    };
    
    jest.spyOn(fs, 'access').mockImplementation(mockFs.access);
    jest.spyOn(fs, 'stat').mockImplementation(mockFs.stat);
    jest.spyOn(fs, 'readdir').mockImplementation(mockFs.readdir);
    jest.spyOn(fs, 'realpath').mockImplementation(mockFs.realpath);
  });

  describe('Path Validation', () => {
    describe('Valid Path Formats', () => {
      const validPaths = [
        '/absolute/path/to/file.js',
        './relative/path/to/file.js',
        '../parent/path/to/file.js', 
        'simple-file.js',
        'path/with-dashes/file-name.js',
        'path/with_underscores/file_name.js',
        'path/with.dots/file.name.js',
        'path123/with-numbers456/file789.js',
        '/workspaces/project/src/components/Button.jsx',
        './tests/unit/components/Button.test.js'
      ];

      test.each(validPaths)('should validate path: %s', async (validPath) => {
        const result = await protocol.validatePath(validPath);

        expect(result).toMatchObject({
          isValid: true,
          normalizedPath: expect.any(String),
          pathType: expect.stringMatching(/^(absolute|relative)$/),
          sanitizedPath: expect.any(String)
        });
        
        expect(result.normalizedPath).toBe(path.normalize(validPath));
      });
    });

    describe('Invalid Path Formats', () => {
      const invalidPaths = [
        '',
        null,
        undefined,
        123,
        {},
        [],
        'file\x00.js', // null byte
        'file\t.js', // tab character
        'file\n.js', // newline
        'file\r.js', // carriage return
        'file\x01.js', // control character
        'CON', // Windows reserved name
        'PRN', // Windows reserved name
        'AUX', // Windows reserved name
        'NUL', // Windows reserved name
        'file<.js', // invalid character
        'file>.js', // invalid character  
        'file|.js', // invalid character
        'file".js', // invalid character
        'file:.js', // invalid character (Windows)
        'file*.js', // invalid character
        'file?.js'  // invalid character
      ];

      test.each(invalidPaths)('should reject invalid path: %s', async (invalidPath) => {
        const result = await protocol.validatePath(invalidPath);

        expect(result).toMatchObject({
          isValid: false,
          error: expect.any(String),
          errorCode: expect.any(String)
        });
      });
    });

    describe('Path Normalization', () => {
      it('should normalize relative paths correctly', async () => {
        const testCases = [
          { input: './path/../file.js', expected: 'file.js' },
          { input: './path/./file.js', expected: 'path/file.js' },
          { input: '../path/file.js', expected: '../path/file.js' },
          { input: 'path//file.js', expected: 'path/file.js' }
        ];

        for (const { input, expected } of testCases) {
          const result = await protocol.validatePath(input);
          expect(result.normalizedPath).toBe(expected);
        }
      });

      it('should handle complex path normalization', async () => {
        const complexPath = './src/../tests/./unit/../integration/test.js';
        const result = await protocol.validatePath(complexPath);
        
        expect(result.isValid).toBe(true);
        expect(result.normalizedPath).toBe('tests/integration/test.js');
      });
    });
  });

  describe('File Existence Checking', () => {
    describe('Existing Files', () => {
      it('should confirm file exists', async () => {
        const filePath = '/test/file.js';
        mockFs.access.mockResolvedValue();
        mockFs.stat.mockResolvedValue({ 
          isFile: () => true,
          isDirectory: () => false,
          size: 1024,
          mtime: new Date()
        });

        const result = await protocol.checkFileExists(filePath);

        expect(result).toMatchObject({
          exists: true,
          isFile: true,
          isDirectory: false,
          stats: expect.objectContaining({
            size: 1024,
            lastModified: expect.any(Date)
          })
        });
      });

      it('should confirm directory exists', async () => {
        const dirPath = '/test/directory';
        mockFs.access.mockResolvedValue();
        mockFs.stat.mockResolvedValue({
          isFile: () => false,
          isDirectory: () => true,
          size: 0
        });

        const result = await protocol.checkFileExists(dirPath);

        expect(result).toMatchObject({
          exists: true,
          isFile: false,
          isDirectory: true
        });
      });
    });

    describe('Non-existent Files', () => {
      it('should handle file not found error', async () => {
        const filePath = '/test/nonexistent.js';
        mockFs.access.mockRejectedValue({ code: 'ENOENT' });

        const result = await protocol.checkFileExists(filePath);

        expect(result).toMatchObject({
          exists: false,
          error: 'File not found',
          errorCode: 'ENOENT'
        });
      });

      it('should handle permission denied error', async () => {
        const filePath = '/test/restricted.js';
        mockFs.access.mockRejectedValue({ code: 'EACCES' });

        const result = await protocol.checkFileExists(filePath);

        expect(result).toMatchObject({
          exists: false,
          error: 'Permission denied',
          errorCode: 'EACCES'
        });
      });
    });

    describe('Edge Cases', () => {
      it('should handle symbolic links', async () => {
        const linkPath = '/test/symlink.js';
        const targetPath = '/test/target.js';
        
        mockFs.access.mockResolvedValue();
        mockFs.stat.mockResolvedValue({
          isFile: () => true,
          isSymbolicLink: () => true
        });
        mockFs.realpath.mockResolvedValue(targetPath);

        const result = await protocol.checkFileExists(linkPath);

        expect(result).toMatchObject({
          exists: true,
          isSymbolicLink: true,
          targetPath: targetPath
        });
      });

      it('should handle broken symbolic links', async () => {
        const brokenLink = '/test/broken-link.js';
        mockFs.access.mockRejectedValue({ code: 'ENOENT' });
        mockFs.stat.mockRejectedValue({ code: 'ENOENT' });

        const result = await protocol.checkFileExists(brokenLink);

        expect(result).toMatchObject({
          exists: false,
          error: 'File not found'
        });
      });
    });
  });

  describe('Response Formatting', () => {
    describe('Success Responses', () => {
      it('should format successful validation response', () => {
        const inputData = {
          path: '/test/file.js',
          isValid: true,
          exists: true,
          stats: { size: 1024 }
        };

        const response = protocol.formatResponse('SUCCESS', inputData);

        expect(response).toMatchObject({
          status: 'SUCCESS',
          timestamp: expect.any(String),
          data: expect.objectContaining({
            path: '/test/file.js',
            isValid: true,
            exists: true
          }),
          metadata: expect.objectContaining({
            version: expect.any(String),
            processingTime: expect.any(Number)
          })
        });
      });

      it('should include performance metrics', () => {
        const response = protocol.formatResponse('SUCCESS', {});
        
        expect(response.metadata).toHaveProperty('processingTime');
        expect(response.metadata.processingTime).toBeGreaterThanOrEqual(0);
      });
    });

    describe('Error Responses', () => {
      it('should format validation error response', () => {
        const errorData = {
          path: 'invalid\x00path.js',
          error: 'Invalid path format',
          errorCode: 'INVALID_PATH'
        };

        const response = protocol.formatResponse('ERROR', errorData);

        expect(response).toMatchObject({
          status: 'ERROR',
          error: expect.objectContaining({
            message: 'Invalid path format',
            code: 'INVALID_PATH',
            path: 'invalid\x00path.js'
          }),
          timestamp: expect.any(String)
        });
      });

      it('should include error stack in development mode', () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'development';

        const errorData = {
          error: new Error('Test error'),
          errorCode: 'TEST_ERROR'
        };

        const response = protocol.formatResponse('ERROR', errorData);

        expect(response.error).toHaveProperty('stack');
        
        process.env.NODE_ENV = originalEnv;
      });
    });

    describe('Response Schema Validation', () => {
      it('should validate response schema for success', () => {
        const response = protocol.formatResponse('SUCCESS', { path: '/test.js' });
        
        // Check required fields
        expect(response).toHaveProperty('status');
        expect(response).toHaveProperty('timestamp');
        expect(response).toHaveProperty('data');
        expect(response).toHaveProperty('metadata');
        
        // Check timestamp format (ISO 8601)
        expect(response.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      });

      it('should validate response schema for error', () => {
        const response = protocol.formatResponse('ERROR', { error: 'Test error' });
        
        expect(response).toHaveProperty('status');
        expect(response).toHaveProperty('timestamp');
        expect(response).toHaveProperty('error');
        expect(response.error).toHaveProperty('message');
      });
    });
  });

  describe('Integration with Validator', () => {
    it('should use validator for security checks', async () => {
      const maliciousPath = '../../../etc/passwd';
      const validateSpy = jest.spyOn(validator, 'validateSecurity');
      validateSpy.mockReturnValue({ 
        isSecure: false, 
        violations: ['PATH_TRAVERSAL'] 
      });

      const result = await protocol.validatePath(maliciousPath);

      expect(validateSpy).toHaveBeenCalledWith(maliciousPath);
      expect(result.isValid).toBe(false);
      expect(result.securityViolations).toContain('PATH_TRAVERSAL');
    });

    it('should use validator for file type restrictions', async () => {
      const executablePath = '/test/script.exe';
      const validateSpy = jest.spyOn(validator, 'validateFileType');
      validateSpy.mockReturnValue({ 
        isAllowed: false, 
        reason: 'EXECUTABLE_FILE_TYPE' 
      });

      const result = await protocol.validatePath(executablePath);

      expect(validateSpy).toHaveBeenCalledWith(executablePath);
      expect(result.isValid).toBe(false);
      expect(result.fileTypeViolation).toBe('EXECUTABLE_FILE_TYPE');
    });
  });

  describe('Cache Integration', () => {
    it('should cache successful validations', async () => {
      const filePath = '/test/cached-file.js';
      const cacheSpy = jest.spyOn(cache, 'set');
      
      mockFs.access.mockResolvedValue();
      mockFs.stat.mockResolvedValue({ isFile: () => true });

      await protocol.processFileReference(filePath);

      expect(cacheSpy).toHaveBeenCalledWith(
        filePath,
        expect.objectContaining({
          exists: true,
          isValid: true
        })
      );
    });

    it('should retrieve from cache when available', async () => {
      const filePath = '/test/cached-file.js';
      const cachedResult = { exists: true, isValid: true, cached: true };
      
      const getSpy = jest.spyOn(cache, 'get');
      getSpy.mockReturnValue(cachedResult);

      const result = await protocol.processFileReference(filePath);

      expect(getSpy).toHaveBeenCalledWith(filePath);
      expect(result.cached).toBe(true);
      expect(mockFs.access).not.toHaveBeenCalled(); // Should not hit file system
    });
  });

  describe('Performance Tests', () => {
    it('should process path validation under 100ms', async () => {
      const startTime = process.hrtime.bigint();
      
      await protocol.validatePath('/test/performance-test.js');
      
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
      
      expect(duration).toBeLessThan(100);
    });

    it('should handle batch processing efficiently', async () => {
      const paths = Array.from({ length: 100 }, (_, i) => `/test/file-${i}.js`);
      
      mockFs.access.mockResolvedValue();
      mockFs.stat.mockResolvedValue({ isFile: () => true });
      
      const startTime = process.hrtime.bigint();
      
      const results = await Promise.all(
        paths.map(path => protocol.processFileReference(path))
      );
      
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000;
      
      expect(results).toHaveLength(100);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      expect(results.every(r => r.status === 'SUCCESS')).toBe(true);
    });
  });

  describe('Error Recovery', () => {
    it('should recover from filesystem errors', async () => {
      const filePath = '/test/error-recovery.js';
      
      // First attempt fails
      mockFs.access.mockRejectedValueOnce({ code: 'EMFILE' });
      // Second attempt succeeds
      mockFs.access.mockResolvedValueOnce();
      mockFs.stat.mockResolvedValueOnce({ isFile: () => true });

      const result = await protocol.processFileReference(filePath, { retryAttempts: 2 });

      expect(result.status).toBe('SUCCESS');
      expect(mockFs.access).toHaveBeenCalledTimes(2);
    });

    it('should fail gracefully after max retry attempts', async () => {
      const filePath = '/test/persistent-error.js';
      
      mockFs.access.mockRejectedValue({ code: 'EMFILE' });

      const result = await protocol.processFileReference(filePath, { retryAttempts: 3 });

      expect(result.status).toBe('ERROR');
      expect(result.error.code).toBe('MAX_RETRIES_EXCEEDED');
      expect(mockFs.access).toHaveBeenCalledTimes(3);
    });
  });
});