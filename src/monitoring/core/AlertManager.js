const EventEmitter = require('events');

/**
 * Alert Manager for Performance Monitoring
 * Advanced alerting system with configurable thresholds and notification channels
 */
class AlertManager extends EventEmitter {
  constructor(config = {}, logger = console) {
    super();

    this.config = {
      enabled: true,
      channels: ['log', 'email', 'webhook'],
      thresholds: {
        cpu: { warning: 70, critical: 90 },
        memory: { warning: 75, critical: 90 },
        disk: { warning: 80, critical: 95 },
        responseTime: { warning: 1000, critical: 3000 },
        errorRate: { warning: 1, critical: 5 },
        ...config.thresholds
      },
      suppression: {
        enabled: true,
        defaultDuration: 5 * 60 * 1000, // 5 minutes
        maxSuppression: 60 * 60 * 1000, // 1 hour
        ...config.suppression
      },
      escalation: {
        enabled: true,
        levels: [
          { severity: 'warning', delay: 5 * 60 * 1000 }, // 5 minutes
          { severity: 'critical', delay: 2 * 60 * 1000 }, // 2 minutes
          { severity: 'emergency', delay: 30 * 1000 }     // 30 seconds
        ],
        ...config.escalation
      },
      notifications: {
        email: {
          enabled: false,
          recipients: [],
          ...config.notifications?.email
        },
        webhook: {
          enabled: false,
          urls: [],
          ...config.notifications?.webhook
        },
        ...config.notifications
      },
      ...config
    };

    this.logger = logger;
    this.activeAlerts = new Map();
    this.suppressedAlerts = new Map();
    this.alertHistory = [];
    this.escalationTimers = new Map();
    
    this.logger.info('Alert Manager initialized', {
      channels: this.config.channels,
      thresholds: Object.keys(this.config.thresholds),
      suppressionEnabled: this.config.suppression.enabled
    });
  }

  /**
   * Check metrics against thresholds and trigger alerts
   */
  async checkMetrics(metricsData) {
    if (!this.config.enabled) {
      return { checked: false, reason: 'Alerting disabled' };
    }

    const timestamp = Date.now();
    const results = {
      timestamp,
      checked: true,
      triggered: [],
      resolved: [],
      suppressed: []
    };

    try {
      // Process each data source
      Object.entries(metricsData.sources || {}).forEach(([source, sourceData]) => {
        if (!sourceData.success) return;

        const alerts = this.evaluateSourceMetrics(source, sourceData.metrics, timestamp);
        
        alerts.triggered.forEach(alert => {
          results.triggered.push(alert);
          this.triggerAlert(alert);
        });

        alerts.resolved.forEach(alert => {
          results.resolved.push(alert);
          this.resolveAlert(alert);
        });

        alerts.suppressed.forEach(alert => {
          results.suppressed.push(alert);
        });
      });

      // Check for resolved alerts (no longer active)
      this.checkForResolvedAlerts(timestamp, results);

      // Update alert history
      if (results.triggered.length > 0 || results.resolved.length > 0) {
        this.updateAlertHistory(results);
      }

      return results;

    } catch (error) {
      this.logger.error('Error checking metrics for alerts', { error: error.message });
      return {
        timestamp,
        checked: false,
        error: error.message
      };
    }
  }

  /**
   * Manually trigger an alert
   */
  async triggerManualAlert(alertData) {
    const alert = {
      id: this.generateAlertId(),
      timestamp: Date.now(),
      source: 'manual',
      metric: alertData.metric || 'custom',
      value: alertData.value,
      severity: alertData.severity || 'warning',
      message: alertData.message || 'Manual alert triggered',
      manual: true,
      ...alertData
    };

    await this.triggerAlert(alert);
    return alert;
  }

  /**
   * Get all active alerts
   */
  getActiveAlerts() {
    return Array.from(this.activeAlerts.values()).map(alert => ({
      id: alert.id,
      timestamp: alert.timestamp,
      source: alert.source,
      metric: alert.metric,
      value: alert.value,
      severity: alert.severity,
      message: alert.message,
      duration: Date.now() - alert.timestamp,
      escalated: alert.escalated || false
    }));
  }

  /**
   * Get alert history with filtering
   */
  getAlertHistory(options = {}) {
    const {
      startTime = Date.now() - 24 * 60 * 60 * 1000, // 24 hours ago
      endTime = Date.now(),
      severity = null,
      source = null,
      limit = 100
    } = options;

    let filtered = this.alertHistory.filter(alert => 
      alert.timestamp >= startTime && alert.timestamp <= endTime
    );

    if (severity) {
      filtered = filtered.filter(alert => alert.severity === severity);
    }

    if (source) {
      filtered = filtered.filter(alert => alert.source === source);
    }

    // Sort by timestamp (newest first) and limit
    return filtered
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Suppress alerts for a specific metric or source
   */
  suppressAlerts(options = {}) {
    const {
      source = null,
      metric = null,
      duration = this.config.suppression.defaultDuration,
      reason = 'Manual suppression'
    } = options;

    const suppressionKey = this.generateSuppressionKey(source, metric);
    const suppression = {
      source,
      metric,
      duration,
      reason,
      startTime: Date.now(),
      endTime: Date.now() + duration
    };

    this.suppressedAlerts.set(suppressionKey, suppression);

    this.logger.info('Alert suppression activated', {
      source,
      metric,
      duration,
      reason
    });

    return {
      success: true,
      key: suppressionKey,
      suppression
    };
  }

  /**
   * Remove alert suppression
   */
  removeSuppression(suppressionKey) {
    const suppression = this.suppressedAlerts.get(suppressionKey);
    
    if (!suppression) {
      return { success: false, error: 'Suppression not found' };
    }

    this.suppressedAlerts.delete(suppressionKey);

    this.logger.info('Alert suppression removed', {
      key: suppressionKey,
      source: suppression.source,
      metric: suppression.metric
    });

    return {
      success: true,
      suppression
    };
  }

  /**
   * Get current alert statistics
   */
  getAlertStatistics(timeRange = 24 * 60 * 60 * 1000) {
    const endTime = Date.now();
    const startTime = endTime - timeRange;

    const recentAlerts = this.alertHistory.filter(alert => 
      alert.timestamp >= startTime && alert.timestamp <= endTime
    );

    const stats = {
      timeRange: { start: startTime, end: endTime },
      total: recentAlerts.length,
      active: this.activeAlerts.size,
      suppressed: this.suppressedAlerts.size,
      bySeverity: {
        warning: 0,
        critical: 0,
        emergency: 0
      },
      bySource: {},
      byMetric: {},
      averageDuration: 0,
      longestAlert: null,
      mostFrequentMetric: null
    };

    // Calculate statistics
    recentAlerts.forEach(alert => {
      // Count by severity
      if (stats.bySeverity[alert.severity] !== undefined) {
        stats.bySeverity[alert.severity]++;
      }

      // Count by source
      stats.bySource[alert.source] = (stats.bySource[alert.source] || 0) + 1;

      // Count by metric
      stats.byMetric[alert.metric] = (stats.byMetric[alert.metric] || 0) + 1;

      // Track duration if resolved
      if (alert.resolvedAt) {
        const duration = alert.resolvedAt - alert.timestamp;
        stats.averageDuration += duration;

        if (!stats.longestAlert || duration > (stats.longestAlert.resolvedAt - stats.longestAlert.timestamp)) {
          stats.longestAlert = alert;
        }
      }
    });

    // Calculate averages
    const resolvedAlerts = recentAlerts.filter(a => a.resolvedAt);
    stats.averageDuration = resolvedAlerts.length > 0 ? 
      stats.averageDuration / resolvedAlerts.length : 0;

    // Find most frequent metric
    let maxCount = 0;
    Object.entries(stats.byMetric).forEach(([metric, count]) => {
      if (count > maxCount) {
        maxCount = count;
        stats.mostFrequentMetric = metric;
      }
    });

    return stats;
  }

  /**
   * Configure alert thresholds
   */
  updateThresholds(newThresholds) {
    const oldThresholds = { ...this.config.thresholds };
    this.config.thresholds = { ...this.config.thresholds, ...newThresholds };

    this.logger.info('Alert thresholds updated', {
      old: oldThresholds,
      new: this.config.thresholds
    });

    this.emit('thresholds-updated', {
      old: oldThresholds,
      new: this.config.thresholds
    });

    return {
      success: true,
      old: oldThresholds,
      new: this.config.thresholds
    };
  }

  /**
   * Private Methods
   */

  evaluateSourceMetrics(source, metrics, timestamp) {
    const results = {
      triggered: [],
      resolved: [],
      suppressed: []
    };

    Object.entries(metrics).forEach(([metric, value]) => {
      if (typeof value !== 'number') return;

      const thresholds = this.config.thresholds[metric];
      if (!thresholds) return;

      // Check for suppression
      if (this.isAlertSuppressed(source, metric)) {
        results.suppressed.push({
          source,
          metric,
          value,
          reason: 'Suppressed'
        });
        return;
      }

      // Determine severity
      const severity = this.determineSeverity(value, thresholds);
      
      if (severity) {
        const alertId = this.generateAlertId(source, metric);
        const existingAlert = this.activeAlerts.get(alertId);

        if (!existingAlert) {
          // New alert
          const alert = {
            id: alertId,
            timestamp,
            source,
            metric,
            value,
            severity,
            threshold: thresholds[severity],
            message: this.generateAlertMessage(source, metric, value, severity, thresholds[severity])
          };

          results.triggered.push(alert);

        } else if (existingAlert.severity !== severity) {
          // Severity change
          const alert = {
            ...existingAlert,
            severity,
            value,
            threshold: thresholds[severity],
            escalated: severity === 'critical' && existingAlert.severity === 'warning',
            message: this.generateAlertMessage(source, metric, value, severity, thresholds[severity])
          };

          results.triggered.push(alert);
        }

      } else {
        // Check for resolution
        const alertId = this.generateAlertId(source, metric);
        const existingAlert = this.activeAlerts.get(alertId);

        if (existingAlert) {
          results.resolved.push({
            ...existingAlert,
            resolvedAt: timestamp,
            resolvedValue: value
          });
        }
      }
    });

    return results;
  }

  determineSeverity(value, thresholds) {
    if (value >= thresholds.critical) return 'critical';
    if (value >= thresholds.warning) return 'warning';
    return null;
  }

  async triggerAlert(alert) {
    try {
      // Store active alert
      this.activeAlerts.set(alert.id, alert);

      // Add to history
      this.alertHistory.push({ ...alert, type: 'triggered' });

      // Setup escalation if enabled
      if (this.config.escalation.enabled && alert.severity === 'warning') {
        this.setupEscalation(alert);
      }

      // Send notifications
      await this.sendNotifications(alert);

      // Emit event
      this.emit('alert-triggered', alert);

      this.logger.warn('Alert triggered', {
        id: alert.id,
        source: alert.source,
        metric: alert.metric,
        value: alert.value,
        severity: alert.severity
      });

    } catch (error) {
      this.logger.error('Error triggering alert', {
        alert: alert.id,
        error: error.message
      });
    }
  }

  async resolveAlert(alert) {
    try {
      // Remove from active alerts
      this.activeAlerts.delete(alert.id);

      // Cancel escalation
      this.cancelEscalation(alert.id);

      // Add to history
      this.alertHistory.push({ ...alert, type: 'resolved' });

      // Send resolution notifications
      await this.sendResolutionNotifications(alert);

      // Emit event
      this.emit('alert-resolved', alert);

      this.logger.info('Alert resolved', {
        id: alert.id,
        source: alert.source,
        metric: alert.metric,
        duration: alert.resolvedAt - alert.timestamp
      });

    } catch (error) {
      this.logger.error('Error resolving alert', {
        alert: alert.id,
        error: error.message
      });
    }
  }

  checkForResolvedAlerts(timestamp, results) {
    const currentMetrics = new Set();
    
    // Track which metrics are currently alerting
    results.triggered.forEach(alert => {
      currentMetrics.add(`${alert.source}:${alert.metric}`);
    });

    // Check if any active alerts are no longer present
    for (const [alertId, alert] of this.activeAlerts.entries()) {
      const metricKey = `${alert.source}:${alert.metric}`;
      
      if (!currentMetrics.has(metricKey)) {
        // Alert should be resolved
        const resolvedAlert = {
          ...alert,
          resolvedAt: timestamp
        };
        
        results.resolved.push(resolvedAlert);
        this.resolveAlert(resolvedAlert);
      }
    }
  }

  updateAlertHistory(results) {
    // Limit history size
    const maxHistorySize = 10000;
    
    if (this.alertHistory.length > maxHistorySize) {
      this.alertHistory = this.alertHistory.slice(-maxHistorySize);
    }
  }

  setupEscalation(alert) {
    const escalationConfig = this.config.escalation.levels.find(l => l.severity === 'critical');
    
    if (escalationConfig) {
      const timerId = setTimeout(() => {
        this.escalateAlert(alert);
      }, escalationConfig.delay);

      this.escalationTimers.set(alert.id, timerId);
    }
  }

  cancelEscalation(alertId) {
    const timerId = this.escalationTimers.get(alertId);
    
    if (timerId) {
      clearTimeout(timerId);
      this.escalationTimers.delete(alertId);
    }
  }

  async escalateAlert(alert) {
    const escalatedAlert = {
      ...alert,
      severity: 'critical',
      escalated: true,
      escalatedAt: Date.now(),
      message: `ESCALATED: ${alert.message}`
    };

    await this.triggerAlert(escalatedAlert);
  }

  async sendNotifications(alert) {
    const notifications = [];

    // Log notification (always enabled)
    notifications.push(this.sendLogNotification(alert));

    // Email notifications
    if (this.config.notifications.email?.enabled) {
      notifications.push(this.sendEmailNotification(alert));
    }

    // Webhook notifications
    if (this.config.notifications.webhook?.enabled) {
      notifications.push(this.sendWebhookNotification(alert));
    }

    await Promise.allSettled(notifications);
  }

  async sendResolutionNotifications(alert) {
    const notifications = [];

    // Log notification
    notifications.push(this.sendLogNotification({
      ...alert,
      type: 'resolution',
      message: `RESOLVED: ${alert.message}`
    }));

    // Email notifications for critical alerts
    if (alert.severity === 'critical' && this.config.notifications.email?.enabled) {
      notifications.push(this.sendEmailNotification({
        ...alert,
        type: 'resolution'
      }));
    }

    await Promise.allSettled(notifications);
  }

  async sendLogNotification(alert) {
    const logLevel = alert.severity === 'critical' ? 'error' : 'warn';
    
    this.logger[logLevel]('Performance Alert', {
      id: alert.id,
      type: alert.type || 'alert',
      source: alert.source,
      metric: alert.metric,
      value: alert.value,
      severity: alert.severity,
      message: alert.message
    });
  }

  async sendEmailNotification(alert) {
    // Email implementation would go here
    // For now, just log the intent
    this.logger.debug('Email notification would be sent', {
      alert: alert.id,
      recipients: this.config.notifications.email.recipients
    });
  }

  async sendWebhookNotification(alert) {
    // Webhook implementation would go here
    // For now, just log the intent
    this.logger.debug('Webhook notification would be sent', {
      alert: alert.id,
      urls: this.config.notifications.webhook.urls
    });
  }

  isAlertSuppressed(source, metric) {
    const now = Date.now();
    
    // Check specific suppression
    const specificKey = this.generateSuppressionKey(source, metric);
    const specificSuppression = this.suppressedAlerts.get(specificKey);
    
    if (specificSuppression && now < specificSuppression.endTime) {
      return true;
    }

    // Check source-wide suppression
    const sourceKey = this.generateSuppressionKey(source, null);
    const sourceSuppression = this.suppressedAlerts.get(sourceKey);
    
    if (sourceSuppression && now < sourceSuppression.endTime) {
      return true;
    }

    // Check global suppression
    const globalKey = this.generateSuppressionKey(null, null);
    const globalSuppression = this.suppressedAlerts.get(globalKey);
    
    if (globalSuppression && now < globalSuppression.endTime) {
      return true;
    }

    return false;
  }

  generateAlertId(source = '', metric = '') {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `${source}-${metric}-${timestamp}-${random}`.replace(/[^a-zA-Z0-9-]/g, '-');
  }

  generateSuppressionKey(source, metric) {
    return `${source || 'ALL'}:${metric || 'ALL'}`;
  }

  generateAlertMessage(source, metric, value, severity, threshold) {
    return `${severity.toUpperCase()}: ${metric} on ${source} is ${value} (threshold: ${threshold})`;
  }
}

module.exports = { AlertManager };