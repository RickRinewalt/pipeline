/**
 * Feature 6: File Reference Protocol - Main Export
 * Entry point for File Reference Protocol implementation
 */

const { FileReferenceProtocol } = require('./file-reference-protocol');
const { FileReferenceValidator } = require('./file-reference-validator');
const { FileReferenceCache } = require('./file-reference-cache');
const { FileReferenceAuditLogger, FileReferenceSecurityUtils } = require('./file-reference-audit');
const { FileReferenceRateLimiter, YoloProWorkflowIntegration } = require('./file-reference-integration');

module.exports = {
  // Core protocol
  FileReferenceProtocol,
  
  // Security and validation
  FileReferenceValidator,
  FileReferenceSecurityUtils,
  
  // Performance and caching
  FileReferenceCache,
  
  // Rate limiting
  FileReferenceRateLimiter,
  
  // Audit and logging
  FileReferenceAuditLogger,
  
  // YOLO-PRO integration
  YoloProWorkflowIntegration,

  // Convenience factory functions
  createFileReferenceProtocol: (options = {}) => new FileReferenceProtocol(options),
  createYoloProIntegration: (options = {}) => new YoloProWorkflowIntegration(options),
  createAuditLogger: (options = {}) => new FileReferenceAuditLogger(options),
  createRateLimiter: (options = {}) => new FileReferenceRateLimiter(options)
};