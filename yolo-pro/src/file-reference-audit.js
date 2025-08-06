/**
 * File Reference Audit Logger
 * Comprehensive logging and monitoring for security events and file access
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

/**
 * Audit logger for file reference security events
 */
class FileReferenceAuditLogger {
  constructor(options = {}) {
    this.options = {
      logLevel: options.logLevel || 'info',
      logToFile: options.logToFile !== false,
      logToConsole: options.logToConsole !== false,
      logDirectory: options.logDirectory || './logs',
      maxLogFileSize: options.maxLogFileSize || 10 * 1024 * 1024, // 10MB
      retentionDays: options.retentionDays || 30,
      enableStructuredLogs: options.enableStructuredLogs !== false,
      ...options
    };

    this.eventBuffer = [];
    this.suspiciousActivities = new Map();
    
    // Ensure log directory exists
    this.initializeLogging();
  }

  /**
   * Initialize logging infrastructure
   * @private
   */
  async initializeLogging() {
    if (this.options.logToFile) {
      try {
        await fs.mkdir(this.options.logDirectory, { recursive: true });
      } catch (error) {
        console.warn('Failed to create log directory:', error.message);
      }
    }
  }

  /**
   * Log security event
   * @param {Object} event - Security event data
   * @returns {Promise<Object>} Logging result
   */
  async logSecurityEvent(event) {
    try {
      const eventId = this.generateEventId();
      const timestamp = new Date().toISOString();
      
      const logEntry = {
        eventId,
        timestamp,
        type: 'security_event',
        level: this.getSeverityLevel(event.severity || 'medium'),
        event: {
          type: event.type,
          severity: event.severity || 'medium',
          path: event.path,
          payload: event.payload,
          blocked: event.blocked !== false,
          clientId: event.clientId,
          userAgent: event.userAgent,
          ipAddress: event.ipAddress
        },
        metadata: {
          protocol: 'file-reference-v1',
          source: 'file-reference-protocol'
        }
      };

      // Write to configured outputs
      await this.writeLog(logEntry);

      // Track for suspicious activity analysis
      this.trackSuspiciousActivity(event);

      return {
        logged: true,
        eventId,
        timestamp,
        event
      };

    } catch (error) {
      console.error('Failed to log security event:', error.message);
      return {
        logged: false,
        error: error.message
      };
    }
  }

  /**
   * Log file access attempt
   * @param {Object} attempt - Access attempt data
   * @returns {Promise<Object>} Logging result
   */
  async logAccess(attempt) {
    try {
      const accessId = this.generateEventId('access');
      const timestamp = new Date().toISOString();
      
      const logEntry = {
        accessId,
        timestamp,
        type: 'access_attempt',
        level: attempt.result === 'success' ? 'info' : 'warn',
        attempt: {
          path: attempt.path,
          result: attempt.result,
          user: attempt.user,
          method: attempt.method || 'file_reference',
          duration: attempt.duration,
          size: attempt.size
        },
        network: {
          ipAddress: attempt.ipAddress || 'unknown',
          userAgent: attempt.userAgent || 'unknown'
        },
        metadata: {
          protocol: 'file-reference-v1',
          source: 'file-reference-protocol'
        }
      };

      await this.writeLog(logEntry);

      return {
        logged: true,
        accessId,
        timestamp,
        attempt
      };

    } catch (error) {
      console.error('Failed to log access attempt:', error.message);
      return {
        logged: false,
        error: error.message
      };
    }
  }

  /**
   * Log suspicious activity pattern
   * @param {Object} activity - Suspicious activity data
   * @returns {Promise<Object>} Logging result
   */
  async logSuspiciousActivity(activity) {
    try {
      const trackingId = this.generateEventId('suspicious');
      const timestamp = new Date().toISOString();
      
      // Determine if alert should be triggered
      const shouldAlert = activity.riskScore > 0.8;
      const recommendedAction = this.getRecommendedAction(activity.riskScore);
      
      const logEntry = {
        trackingId,
        timestamp,
        type: 'suspicious_activity',
        level: 'warn',
        activity: {
          clientId: activity.clientId,
          pattern: activity.pattern,
          riskScore: activity.riskScore,
          events: activity.events,
          timeWindow: activity.timeWindow,
          frequency: activity.frequency
        },
        analysis: {
          alertTriggered: shouldAlert,
          recommendedAction,
          confidence: activity.confidence || 0.85
        },
        metadata: {
          protocol: 'file-reference-v1',
          source: 'file-reference-protocol'
        }
      };

      await this.writeLog(logEntry);

      // Additional alerting if needed
      if (shouldAlert) {
        await this.triggerSecurityAlert(logEntry);
      }

      return {
        logged: true,
        alertTriggered: shouldAlert,
        riskScore: activity.riskScore,
        recommendedAction,
        trackingId
      };

    } catch (error) {
      console.error('Failed to log suspicious activity:', error.message);
      return {
        logged: false,
        error: error.message
      };
    }
  }

  /**
   * Track suspicious activity patterns
   * @private
   */
  trackSuspiciousActivity(event) {
    if (!event.clientId) return;

    const clientId = event.clientId;
    const now = Date.now();
    const timeWindow = 5 * 60 * 1000; // 5 minutes

    // Get or create client activity record
    let clientActivity = this.suspiciousActivities.get(clientId) || {
      events: [],
      riskScore: 0,
      lastUpdate: now
    };

    // Add current event
    clientActivity.events.push({
      type: event.type,
      severity: event.severity,
      timestamp: now
    });

    // Remove old events outside time window
    clientActivity.events = clientActivity.events.filter(
      e => now - e.timestamp <= timeWindow
    );

    // Calculate risk score
    clientActivity.riskScore = this.calculateRiskScore(clientActivity.events);
    clientActivity.lastUpdate = now;

    this.suspiciousActivities.set(clientId, clientActivity);

    // Check if pattern is suspicious enough to log
    if (clientActivity.riskScore > 0.7) {
      this.logSuspiciousActivity({
        clientId,
        pattern: this.identifyPattern(clientActivity.events),
        riskScore: clientActivity.riskScore,
        events: clientActivity.events.slice(-10), // Last 10 events
        timeWindow: `${timeWindow / 1000}s`
      });
    }
  }

  /**
   * Write log entry to configured outputs
   * @private
   */
  async writeLog(logEntry) {
    const logLine = this.formatLogEntry(logEntry);

    // Console output
    if (this.options.logToConsole) {
      this.writeToConsole(logEntry, logLine);
    }

    // File output
    if (this.options.logToFile) {
      await this.writeToFile(logLine);
    }
  }

  /**
   * Format log entry for output
   * @private
   */
  formatLogEntry(logEntry) {
    if (this.options.enableStructuredLogs) {
      return JSON.stringify(logEntry) + '\n';
    }

    // Human-readable format
    const timestamp = logEntry.timestamp;
    const level = logEntry.level.toUpperCase();
    const type = logEntry.type;
    const summary = this.summarizeEvent(logEntry);

    return `[${timestamp}] ${level} [${type}] ${summary}\n`;
  }

  /**
   * Write to console with appropriate level
   * @private
   */
  writeToConsole(logEntry, logLine) {
    switch (logEntry.level) {
      case 'error':
        console.error(logLine.trim());
        break;
      case 'warn':
        console.warn(logLine.trim());
        break;
      case 'info':
        console.info(logLine.trim());
        break;
      case 'debug':
        console.debug(logLine.trim());
        break;
      default:
        console.log(logLine.trim());
    }
  }

  /**
   * Write to log file
   * @private
   */
  async writeToFile(logLine) {
    try {
      const logFile = path.join(
        this.options.logDirectory,
        `file-reference-${new Date().toISOString().split('T')[0]}.log`
      );

      await fs.appendFile(logFile, logLine);

      // Check file size and rotate if necessary
      await this.checkAndRotateLog(logFile);

    } catch (error) {
      console.error('Failed to write to log file:', error.message);
    }
  }

  /**
   * Check log file size and rotate if needed
   * @private
   */
  async checkAndRotateLog(logFile) {
    try {
      const stats = await fs.stat(logFile);
      
      if (stats.size > this.options.maxLogFileSize) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const rotatedFile = logFile.replace('.log', `-${timestamp}.log`);
        
        await fs.rename(logFile, rotatedFile);
        console.info(`Rotated log file: ${rotatedFile}`);
      }
    } catch (error) {
      // Log file doesn't exist yet or other error - ignore
    }
  }

  /**
   * Generate unique event ID
   * @private
   */
  generateEventId(prefix = 'sec') {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(4).toString('hex');
    return `${prefix}-${timestamp}-${random}`;
  }

  /**
   * Get severity level for logging
   * @private
   */
  getSeverityLevel(severity) {
    const levelMap = {
      'critical': 'error',
      'high': 'error',
      'medium': 'warn',
      'low': 'info'
    };

    return levelMap[severity] || 'info';
  }

  /**
   * Calculate risk score from events
   * @private
   */
  calculateRiskScore(events) {
    if (events.length === 0) return 0;

    const weights = {
      'path_traversal': 0.4,
      'malicious_content': 0.3,
      'access_denied': 0.1,
      'rate_limit_exceeded': 0.05
    };

    let score = 0;
    const recentEvents = events.length;
    const uniqueTypes = new Set(events.map(e => e.type)).size;

    // Base score from event types
    events.forEach(event => {
      score += weights[event.type] || 0.05;
    });

    // Frequency multiplier
    if (recentEvents > 5) score *= 1.2;
    if (recentEvents > 10) score *= 1.5;

    // Diversity penalty (multiple attack types)
    if (uniqueTypes > 3) score *= 1.3;

    return Math.min(score, 1.0);
  }

  /**
   * Identify attack pattern from events
   * @private
   */
  identifyPattern(events) {
    const types = events.map(e => e.type);
    const uniqueTypes = new Set(types);

    if (uniqueTypes.has('path_traversal') && events.length > 3) {
      return 'persistent_path_traversal';
    }

    if (uniqueTypes.size > 2) {
      return 'multi_vector_attack';
    }

    if (events.length > 10) {
      return 'brute_force_attempt';
    }

    return 'escalating_attacks';
  }

  /**
   * Get recommended action based on risk score
   * @private
   */
  getRecommendedAction(riskScore) {
    if (riskScore > 0.9) return 'BLOCK_CLIENT_PERMANENTLY';
    if (riskScore > 0.8) return 'BLOCK_CLIENT';
    if (riskScore > 0.6) return 'THROTTLE_CLIENT';
    if (riskScore > 0.4) return 'MONITOR_CLOSELY';
    return 'CONTINUE_MONITORING';
  }

  /**
   * Summarize event for human-readable logs
   * @private
   */
  summarizeEvent(logEntry) {
    switch (logEntry.type) {
      case 'security_event':
        return `Security event: ${logEntry.event.type} - ${logEntry.event.path || 'N/A'}`;
      case 'access_attempt':
        return `Access ${logEntry.attempt.result}: ${logEntry.attempt.path} by ${logEntry.attempt.user}`;
      case 'suspicious_activity':
        return `Suspicious activity: ${logEntry.activity.pattern} (risk: ${logEntry.activity.riskScore})`;
      default:
        return 'Unknown event type';
    }
  }

  /**
   * Trigger security alert (override for custom alerting)
   * @protected
   */
  async triggerSecurityAlert(logEntry) {
    // Default implementation - log critical alert
    console.error('🚨 SECURITY ALERT:', this.summarizeEvent(logEntry));
    
    // In production, this could integrate with:
    // - Email notifications
    // - Slack/Teams webhooks  
    // - SIEM systems
    // - Incident management tools
  }

  /**
   * Clean up old activities and logs
   */
  async cleanup() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    // Clean up suspicious activities
    for (const [clientId, activity] of this.suspiciousActivities.entries()) {
      if (now - activity.lastUpdate > maxAge) {
        this.suspiciousActivities.delete(clientId);
      }
    }

    // Clean up old log files (if enabled)
    if (this.options.logToFile) {
      await this.cleanupOldLogs();
    }
  }

  /**
   * Clean up old log files
   * @private
   */
  async cleanupOldLogs() {
    try {
      const files = await fs.readdir(this.options.logDirectory);
      const cutoffDate = Date.now() - (this.options.retentionDays * 24 * 60 * 60 * 1000);

      for (const file of files) {
        if (file.startsWith('file-reference-') && file.endsWith('.log')) {
          const filePath = path.join(this.options.logDirectory, file);
          const stats = await fs.stat(filePath);
          
          if (stats.mtime.getTime() < cutoffDate) {
            await fs.unlink(filePath);
            console.info(`Deleted old log file: ${file}`);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to cleanup old logs:', error.message);
    }
  }
}

/**
 * Security utilities for file reference protocol
 */
class FileReferenceSecurityUtils {
  /**
   * Check if path is in allowed list
   * @param {string} filePath - Path to check
   * @param {string[]} allowedPaths - Array of allowed paths
   * @returns {Object} Allow/deny result
   */
  static isAllowedPath(filePath, allowedPaths = []) {
    const normalizedPath = path.normalize(filePath);
    
    for (const allowedPath of allowedPaths) {
      if (normalizedPath.startsWith(path.normalize(allowedPath))) {
        return {
          allowed: true,
          reason: 'Path in whitelist',
          category: 'whitelisted'
        };
      }
    }

    return {
      allowed: false,
      reason: 'Path not in whitelist',
      category: 'restricted',
      riskLevel: 'medium'
    };
  }

  /**
   * Hash file path for secure logging
   * @param {string} filePath - Path to hash
   * @returns {string} SHA-256 hash
   */
  static hashPath(filePath) {
    return crypto.createHash('sha256').update(filePath).digest('hex');
  }

  /**
   * Detect malicious content patterns
   * @param {string} content - Content to analyze
   * @returns {Object} Analysis result
   */
  static detectMaliciousContent(content) {
    // Delegate to validator for consistency
    const { FileReferenceValidator } = require('./file-reference-validator');
    const validator = new FileReferenceValidator();
    return validator.detectMaliciousContent(content);
  }
}

module.exports = { 
  FileReferenceAuditLogger,
  FileReferenceSecurityUtils
};