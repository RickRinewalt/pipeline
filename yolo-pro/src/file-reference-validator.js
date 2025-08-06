/**
 * File Reference Validator
 * Handles security validation, path traversal prevention, and input sanitization
 */

const path = require('path');
const crypto = require('crypto');

/**
 * Security validation for file references
 */
class FileReferenceValidator {
  constructor(options = {}) {
    this.options = {
      strictMode: options.strictMode !== false,
      allowedExtensions: options.allowedExtensions || [],
      blockedPaths: options.blockedPaths || [],
      allowedRoots: options.allowedRoots || ['/workspaces'],
      maxPathLength: options.maxPathLength || 4096,
      ...options
    };

    // Security patterns to detect
    this.dangerousPatterns = [
      { pattern: /\.\./g, name: 'directory_traversal', severity: 'high' },
      { pattern: /\/\.\./g, name: 'explicit_traversal', severity: 'high' },
      { pattern: /\\\..\\/g, name: 'windows_traversal', severity: 'high' },
      { pattern: /\0/g, name: 'null_byte_injection', severity: 'high' },
      { pattern: /<script>/gi, name: 'script_injection', severity: 'medium' },
      { pattern: /javascript:/gi, name: 'javascript_url', severity: 'medium' },
      { pattern: /data:/gi, name: 'data_url', severity: 'low' },
      { pattern: /[<>:"|?*]/g, name: 'invalid_characters', severity: 'low' }
    ];

    // Dangerous file extensions
    this.dangerousExtensions = [
      '.exe', '.bat', '.cmd', '.scr', '.pif', '.com', '.dll', '.sys',
      '.sh', '.bash', '.zsh', '.ps1', '.vbs', '.wsf', '.wsh'
    ];
  }

  /**
   * Validate security aspects of file path
   * @param {string} filePath - Path to validate
   * @returns {Promise<Object>} Security validation result
   */
  async validateSecurity(filePath) {
    try {
      // Check for dangerous patterns
      const patternCheck = this.detectDangerousPatterns(filePath);
      if (patternCheck.isTraversal || patternCheck.threats.length > 0) {
        return {
          isValid: false,
          error: 'Security violation detected',
          code: 'SECURITY_VIOLATION',
          securityEvent: {
            type: patternCheck.isTraversal ? 'path_traversal' : 'malicious_pattern',
            severity: 'high',
            blocked: true,
            patterns: patternCheck.threats
          }
        };
      }

      // Check path boundaries
      const resolvedPath = path.resolve(filePath);
      if (!this.isWithinAllowedBoundaries(resolvedPath)) {
        return {
          isValid: false,
          error: 'Path outside allowed boundaries',
          code: 'ACCESS_DENIED',
          securityEvent: {
            type: 'boundary_violation',
            severity: 'medium',
            blocked: true
          }
        };
      }

      // Check file extension
      const extCheck = this.validateFileExtension(filePath);
      if (!extCheck.allowed) {
        return {
          isValid: false,
          error: 'File type not allowed',
          code: 'FILE_TYPE_BLOCKED',
          details: {
            extension: extCheck.extension,
            category: extCheck.category
          }
        };
      }

      return {
        isValid: true,
        securityValidated: true
      };

    } catch (error) {
      return {
        isValid: false,
        error: 'Security validation failed',
        code: 'VALIDATION_ERROR',
        details: error.message
      };
    }
  }

  /**
   * Detect dangerous patterns in path
   * @param {string} filePath - Path to analyze
   * @returns {Object} Pattern detection result
   */
  detectDangerousPatterns(filePath) {
    const threats = [];
    let isTraversal = false;

    this.dangerousPatterns.forEach(({ pattern, name, severity }) => {
      if (pattern.test(filePath)) {
        threats.push({ pattern: name, severity });
        if (name.includes('traversal')) {
          isTraversal = true;
        }
      }
    });

    return {
      isTraversal,
      threats,
      severity: this.getMaxSeverity(threats)
    };
  }

  /**
   * Check if path is within allowed boundaries
   * @param {string} filePath - Resolved absolute path
   * @returns {boolean} Whether path is allowed
   */
  isWithinAllowedBoundaries(filePath) {
    const resolvedPath = path.resolve(filePath);
    
    // Check against blocked paths
    for (const blockedPath of this.options.blockedPaths) {
      if (resolvedPath.includes(blockedPath)) {
        return false;
      }
    }

    // If no allowed roots specified, allow all (except blocked)
    if (!this.options.allowedRoots || this.options.allowedRoots.length === 0) {
      return true;
    }

    // Check against allowed roots
    return this.options.allowedRoots.some(root => {
      const resolvedRoot = path.resolve(root);
      return resolvedPath.startsWith(resolvedRoot + path.sep) || 
             resolvedPath === resolvedRoot;
    });
  }

  /**
   * Validate file extension
   * @param {string} filePath - Path to check
   * @returns {Object} Extension validation result
   */
  validateFileExtension(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    
    // Check against dangerous extensions
    if (this.dangerousExtensions.includes(ext)) {
      return {
        allowed: false,
        extension: ext,
        category: 'dangerous',
        reason: 'Executable file type blocked'
      };
    }

    // If allowed extensions specified, check against whitelist
    if (this.options.allowedExtensions && this.options.allowedExtensions.length > 0) {
      const isAllowed = this.options.allowedExtensions.includes(ext);
      return {
        allowed: isAllowed,
        extension: ext,
        category: isAllowed ? 'allowed' : 'restricted',
        reason: isAllowed ? 'Extension in whitelist' : 'Extension not in whitelist'
      };
    }

    // Default allow if no restrictions
    return {
      allowed: true,
      extension: ext,
      category: 'safe',
      reason: 'No restrictions applied'
    };
  }

  /**
   * Sanitize input path
   * @param {string} filePath - Path to sanitize
   * @returns {Object} Sanitization result
   */
  sanitizeInput(filePath) {
    const original = filePath;
    let sanitized = filePath;
    const securityFlags = [];
    let containsNullBytes = false;
    let containsTraversal = false;

    // Check for null bytes
    if (sanitized.includes('\0')) {
      containsNullBytes = true;
      securityFlags.push('null_byte_injection');
      sanitized = sanitized.replace(/\0.*/g, ''); // Remove everything after null byte
    }

    // Check for traversal patterns
    if (/\.\./.test(sanitized)) {
      containsTraversal = true;
      securityFlags.push('path_traversal');
    }

    // Detect encoded patterns
    const encodedTraversalPatterns = [
      /%2e%2e%2f/gi,  // URL encoded ../
      /%252e%252e%252f/gi,  // Double URL encoded
      /%c0%ae/gi,     // UTF-8 overlong encoding
    ];

    encodedTraversalPatterns.forEach(pattern => {
      if (pattern.test(sanitized)) {
        securityFlags.push('encoded_traversal');
        sanitized = sanitized.replace(pattern, '');
      }
    });

    // Remove dangerous characters
    sanitized = sanitized.replace(/[<>:"|?*]/g, '');

    // Decode any remaining URL encoding
    try {
      const decoded = decodeURIComponent(sanitized);
      if (decoded !== sanitized) {
        sanitized = decoded;
        // Re-check for traversal in decoded content
        if (/\.\./.test(decoded)) {
          containsTraversal = true;
          securityFlags.push('encoded_traversal');
        }
      }
    } catch {
      // Invalid encoding, keep original sanitized version
    }

    return {
      original,
      sanitized,
      wasModified: sanitized !== original,
      containsNullBytes,
      containsTraversal,
      securityFlags,
      nullBytePositions: containsNullBytes ? [original.indexOf('\0')] : []
    };
  }

  /**
   * Detect malicious content patterns
   * @param {string} content - Content to analyze
   * @returns {Object} Malicious content detection result
   */
  detectMaliciousContent(content) {
    const threats = [];
    let isMalicious = false;
    let confidence = 0;

    // Script injection patterns
    const scriptPatterns = [
      /<script[^>]*>/gi,
      /javascript:/gi,
      /vbscript:/gi,
      /on\w+\s*=/gi,
      /eval\s*\(/gi,
      /atob\s*\(/gi
    ];

    scriptPatterns.forEach(pattern => {
      if (pattern.test(content)) {
        threats.push('script_injection');
        isMalicious = true;
        confidence += 0.3;
      }
    });

    // SQL injection patterns
    const sqlPatterns = [
      /union\s+select/gi,
      /drop\s+table/gi,
      /delete\s+from/gi,
      /'\s+or\s+'/gi,
      /'\s+and\s+'/gi
    ];

    sqlPatterns.forEach(pattern => {
      if (pattern.test(content)) {
        threats.push('sql_injection');
        isMalicious = true;
        confidence += 0.2;
      }
    });

    // Command injection patterns
    const commandPatterns = [
      /;\s*rm\s+/gi,
      /&&\s*cat\s+/gi,
      /\|\s*nc\s+/gi,
      /`.*`/g,
      /\$\(.*\)/g
    ];

    commandPatterns.forEach(pattern => {
      if (pattern.test(content)) {
        threats.push('command_injection');
        isMalicious = true;
        confidence += 0.25;
      }
    });

    return {
      isMalicious,
      threats: [...new Set(threats)], // Remove duplicates
      confidence: Math.min(confidence, 1.0),
      payload: content.substring(0, 100) // First 100 chars for logging
    };
  }

  /**
   * Get maximum severity from threats
   * @private
   */
  getMaxSeverity(threats) {
    if (threats.some(t => t.severity === 'high')) return 'high';
    if (threats.some(t => t.severity === 'medium')) return 'medium';
    if (threats.some(t => t.severity === 'low')) return 'low';
    return 'none';
  }

  /**
   * Hash file path for secure storage
   * @param {string} filePath - Path to hash
   * @returns {string} SHA-256 hash of path
   */
  hashPath(filePath) {
    return crypto.createHash('sha256').update(filePath).digest('hex');
  }

  /**
   * Check file integrity with checksum
   * @param {string} filePath - Path to check
   * @param {string} expectedChecksum - Expected checksum
   * @returns {Promise<Object>} Integrity check result
   */
  async checkFileIntegrity(filePath, expectedChecksum = null) {
    try {
      const fs = require('fs').promises;
      const content = await fs.readFile(filePath);
      const actualChecksum = crypto.createHash('sha256').update(content).digest('hex');
      
      const result = {
        path: filePath,
        checksum: actualChecksum,
        algorithm: 'sha256',
        valid: true,
        lastChecked: new Date().toISOString()
      };

      if (expectedChecksum) {
        result.valid = actualChecksum === expectedChecksum;
        result.expected = expectedChecksum;
        result.tampered = !result.valid;
      }

      return result;

    } catch (error) {
      return {
        path: filePath,
        valid: false,
        error: error.message,
        algorithm: 'sha256',
        lastChecked: new Date().toISOString()
      };
    }
  }

  /**
   * Validate checksum match
   * @param {string} filePath - File path  
   * @param {string} expectedChecksum - Expected checksum
   * @returns {Promise<Object>} Checksum validation result
   */
  async validateChecksum(filePath, expectedChecksum) {
    const integrity = await this.checkFileIntegrity(filePath, expectedChecksum);
    
    return {
      expected: expectedChecksum,
      actual: integrity.checksum,
      match: integrity.valid,
      tamperingDetected: integrity.tampered || false,
      algorithm: 'sha256'
    };
  }
}

module.exports = { FileReferenceValidator };