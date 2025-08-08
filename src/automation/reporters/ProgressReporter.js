const EventEmitter = require('events');

/**
 * ProgressReporter
 * Comprehensive progress tracking and reporting for automation workflows
 */
class ProgressReporter extends EventEmitter {
  constructor(config, logger) {
    super();
    
    this.config = {
      reporting: {
        enableRealTimeReporting: true,
        metricsRetentionDays: 30,
        alertThresholds: {
          lowProgress: 20,
          highFailureRate: 10,
          longDuration: 86400000 // 24 hours in milliseconds
        },
        ...config.reporting
      },
      github: config.github,
      ...config
    };

    this.logger = logger;
    this.metricsStore = new Map();
    this.progressHistory = new Map();
    this.alertHistory = new Map();
    this.throttleMap = new Map();

    // Initialize real-time reporting
    if (this.config.reporting.enableRealTimeReporting) {
      this.setupRealTimeReporting();
    }

    this.logger.info('Progress Reporter initialized', {
      realTimeReporting: this.config.reporting.enableRealTimeReporting,
      retentionDays: this.config.reporting.metricsRetentionDays
    });
  }

  /**
   * Track progress for a workflow
   * @param {Object} progressData - Progress data
   */
  trackProgress(progressData) {
    const { workflowId } = progressData;
    
    if (!workflowId) {
      this.logger.warn('Progress tracking called without workflowId');
      return;
    }

    try {
      // Get or create workflow metrics
      let metrics = this.metricsStore.get(workflowId);
      if (!metrics) {
        metrics = {
          workflowId,
          startTime: progressData.timestamp || Date.now(),
          currentProgress: 0,
          history: [],
          velocity: 0,
          estimatedCompletion: null,
          components: {},
          alerts: [],
          lastUpdate: null
        };
        this.metricsStore.set(workflowId, metrics);
      }

      // Update progress
      const timestamp = progressData.timestamp || Date.now();
      const progressUpdate = {
        timestamp,
        progress: progressData.progress || 0,
        phase: progressData.phase,
        component: progressData.component,
        completedTasks: progressData.completedTasks,
        totalTasks: progressData.totalTasks,
        message: progressData.message
      };

      metrics.history.push(progressUpdate);
      metrics.currentProgress = progressData.progress || 0;
      metrics.lastUpdate = timestamp;

      // Update component-specific progress
      if (progressData.component) {
        metrics.components[progressData.component] = {
          progress: progressData.progress || 0,
          status: progressData.status || 'in-progress',
          lastUpdate: timestamp
        };
      }

      // Calculate velocity
      this.updateVelocity(metrics);

      // Estimate completion
      this.updateEstimatedCompletion(metrics);

      // Check for alerts
      this.checkProgressAlerts(workflowId, metrics);

      // Emit real-time update
      this.emitProgressUpdate(progressData);

      this.logger.debug(`Progress tracked for workflow ${workflowId}`, {
        progress: progressData.progress,
        phase: progressData.phase,
        component: progressData.component
      });

    } catch (error) {
      this.logger.error(`Error tracking progress for workflow ${workflowId}`, {
        error: error.message
      });
    }
  }

  /**
   * Generate comprehensive progress report
   * @param {string} workflowId - Workflow ID
   * @returns {Object} Progress report
   */
  async generateReport(workflowId) {
    try {
      const metrics = this.metricsStore.get(workflowId);
      
      if (!metrics) {
        return {
          found: false,
          error: `Workflow ${workflowId} not found`
        };
      }

      // Calculate overall statistics
      const overallProgress = metrics.currentProgress;
      const elapsedTime = Date.now() - metrics.startTime;
      const isCompleted = overallProgress >= 100;
      
      // Determine status
      let status = 'in-progress';
      if (isCompleted) {
        status = 'completed';
      } else if (this.isStagnant(metrics)) {
        status = 'stagnant';
      } else if (this.hasBlockers(metrics)) {
        status = 'blocked';
      }

      // Analyze timeline
      const timeline = this.generateTimeline(metrics);
      
      // Component analysis
      const componentAnalysis = this.analyzeComponents(metrics);

      // Calculate estimated completion
      const estimatedCompletion = metrics.estimatedCompletion;
      const timeRemaining = estimatedCompletion ? 
        Math.max(0, estimatedCompletion - Date.now()) : null;

      // Identify bottlenecks and blockers
      const bottlenecks = this.identifyBottlenecks(metrics);
      const blockers = this.identifyBlockers(metrics);

      const report = {
        workflowId,
        generatedAt: Date.now(),
        overallProgress,
        status,
        startTime: metrics.startTime,
        elapsedTime,
        estimatedCompletion,
        timeRemaining,
        velocity: metrics.velocity,
        components: componentAnalysis,
        timeline,
        bottlenecks,
        blockers,
        alerts: metrics.alerts,
        metrics: {
          totalUpdates: metrics.history.length,
          averageUpdateInterval: this.calculateAverageUpdateInterval(metrics),
          progressTrend: this.calculateProgressTrend(metrics),
          completionProbability: this.calculateCompletionProbability(metrics)
        },
        recommendations: this.generateRecommendations(metrics, status)
      };

      this.logger.info(`Generated progress report for workflow ${workflowId}`, {
        progress: overallProgress,
        status,
        components: Object.keys(componentAnalysis).length
      });

      return report;

    } catch (error) {
      this.logger.error(`Error generating report for workflow ${workflowId}`, {
        error: error.message
      });

      return {
        workflowId,
        error: error.message
      };
    }
  }

  /**
   * Get aggregated metrics across all workflows
   * @param {Object} timeRange - Optional time range filter
   * @returns {Object} Aggregated metrics
   */
  getMetrics(timeRange = {}) {
    try {
      const allWorkflows = Array.from(this.metricsStore.values());
      
      // Apply time range filter
      let filteredWorkflows = allWorkflows;
      if (timeRange.start || timeRange.end) {
        filteredWorkflows = allWorkflows.filter(workflow => {
          if (timeRange.start && workflow.startTime < timeRange.start) return false;
          if (timeRange.end && workflow.startTime > timeRange.end) return false;
          return true;
        });
      }

      const totalWorkflows = filteredWorkflows.length;
      const completedWorkflows = filteredWorkflows.filter(w => w.currentProgress >= 100).length;
      const inProgressWorkflows = filteredWorkflows.filter(w => 
        w.currentProgress > 0 && w.currentProgress < 100
      ).length;
      const failedWorkflows = filteredWorkflows.filter(w => 
        this.hasBlockers({ components: w.components, alerts: w.alerts })
      ).length;

      // Calculate averages
      const averageProgress = totalWorkflows > 0 ? 
        filteredWorkflows.reduce((sum, w) => sum + w.currentProgress, 0) / totalWorkflows : 0;
      
      const completedDurations = filteredWorkflows
        .filter(w => w.currentProgress >= 100)
        .map(w => w.lastUpdate - w.startTime);
      
      const averageDuration = completedDurations.length > 0 ?
        completedDurations.reduce((sum, d) => sum + d, 0) / completedDurations.length : 0;

      const successRate = totalWorkflows > 0 ? (completedWorkflows / totalWorkflows) * 100 : 0;

      // Performance metrics
      const performance = {
        averageDuration,
        fastestCompletion: completedDurations.length > 0 ? Math.min(...completedDurations) : 0,
        slowestCompletion: completedDurations.length > 0 ? Math.max(...completedDurations) : 0,
        averageVelocity: this.calculateGlobalAverageVelocity(filteredWorkflows)
      };

      // Trend analysis
      const trends = this.analyzeTrends(filteredWorkflows, timeRange);

      // Pattern analysis
      const patterns = this.analyzePatterns(filteredWorkflows);

      // Generate recommendations
      const recommendations = this.generateGlobalRecommendations({
        totalWorkflows,
        successRate,
        averageProgress,
        performance,
        trends
      });

      return {
        timeRange,
        totalWorkflows,
        completedWorkflows,
        inProgressWorkflows,
        failedWorkflows,
        averageProgress: Math.round(averageProgress * 100) / 100,
        successRate: Math.round(successRate * 100) / 100,
        performance,
        trends,
        patterns,
        recommendations,
        generatedAt: Date.now()
      };

    } catch (error) {
      this.logger.error('Error getting aggregated metrics', {
        error: error.message
      });

      return {
        error: error.message,
        totalWorkflows: 0
      };
    }
  }

  /**
   * Analyze progress for alerts and issues
   * @param {string} workflowId - Workflow ID
   * @returns {Object} Progress analysis
   */
  analyzeProgress(workflowId) {
    const metrics = this.metricsStore.get(workflowId);
    
    if (!metrics) {
      return {
        workflowId,
        error: 'Workflow not found'
      };
    }

    const analysis = {
      workflowId,
      isStagnant: this.isStagnant(metrics),
      hasBlockers: this.hasBlockers(metrics),
      isAtRisk: this.isAtRisk(metrics),
      velocity: metrics.velocity,
      alerts: [],
      recommendations: []
    };

    // Check for stagnation
    if (analysis.isStagnant) {
      analysis.alerts.push('Progress stagnation detected');
      analysis.recommendations.push('Review current tasks for blockers');
    }

    // Check for low velocity
    if (metrics.velocity < 5 && metrics.history.length > 3) { // Less than 5% progress per update
      analysis.alerts.push('Low progress velocity');
      analysis.recommendations.push('Consider increasing resource allocation');
    }

    // Check for long duration
    const elapsedTime = Date.now() - metrics.startTime;
    if (elapsedTime > this.config.reporting.alertThresholds.longDuration) {
      analysis.alerts.push('Long running workflow detected');
      analysis.recommendations.push('Review workflow complexity and break down if needed');
    }

    return analysis;
  }

  /**
   * Check alerts for a workflow
   * @param {string} workflowId - Workflow ID
   * @returns {Array} Current alerts
   */
  checkAlerts(workflowId) {
    const metrics = this.metricsStore.get(workflowId);
    
    if (!metrics) {
      return [];
    }

    const alerts = [];
    const thresholds = this.config.reporting.alertThresholds;

    // Check for low progress
    const elapsedTime = Date.now() - metrics.startTime;
    const hoursSinceStart = elapsedTime / (60 * 60 * 1000);
    
    if (hoursSinceStart > 2 && metrics.currentProgress < thresholds.lowProgress) {
      const alertKey = `low-progress-${workflowId}`;
      if (!this.isAlertSuppressed(alertKey)) {
        alerts.push('Low progress detected');
        this.suppressAlert(alertKey, 3600000); // Suppress for 1 hour
        this.logger.warn(`Low progress alert for workflow ${workflowId}`, {
          progress: metrics.currentProgress,
          elapsedHours: hoursSinceStart
        });
      }
    }

    // Check for long duration
    if (elapsedTime > thresholds.longDuration) {
      const alertKey = `long-duration-${workflowId}`;
      if (!this.isAlertSuppressed(alertKey)) {
        alerts.push('Long running workflow detected');
        this.suppressAlert(alertKey, 7200000); // Suppress for 2 hours
      }
    }

    return alerts;
  }

  /**
   * Export metrics data
   * @returns {Object} Exported metrics
   */
  exportMetrics() {
    const exportData = {
      version: '1.0.0',
      exportDate: Date.now(),
      workflows: {}
    };

    this.metricsStore.forEach((metrics, workflowId) => {
      exportData.workflows[workflowId] = {
        workflowId: metrics.workflowId,
        startTime: metrics.startTime,
        progress: metrics.currentProgress,
        history: metrics.history,
        velocity: metrics.velocity,
        components: metrics.components
      };
    });

    return exportData;
  }

  /**
   * Import metrics data
   * @param {Object} importData - Imported metrics data
   * @returns {Object} Import result
   */
  importMetrics(importData) {
    try {
      if (!importData.workflows) {
        return {
          success: false,
          error: 'Invalid import data format'
        };
      }

      let importedCount = 0;
      Object.entries(importData.workflows).forEach(([workflowId, data]) => {
        this.metricsStore.set(workflowId, {
          workflowId: data.workflowId,
          startTime: data.startTime,
          currentProgress: data.progress,
          history: data.history || [],
          velocity: data.velocity || 0,
          components: data.components || {},
          alerts: [],
          lastUpdate: Date.now()
        });
        importedCount++;
      });

      return {
        success: true,
        importedWorkflows: importedCount
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get chart-friendly data format
   * @param {string} workflowId - Workflow ID
   * @returns {Object} Chart data
   */
  getChartData(workflowId) {
    const metrics = this.metricsStore.get(workflowId);
    
    if (!metrics) {
      return {
        error: 'Workflow not found'
      };
    }

    // Timeline data
    const timeline = metrics.history.map(entry => ({
      timestamp: entry.timestamp,
      progress: entry.progress,
      phase: entry.phase
    }));

    // Phase breakdown
    const phaseBreakdown = {};
    metrics.history.forEach(entry => {
      if (entry.phase) {
        phaseBreakdown[entry.phase] = entry.progress;
      }
    });

    // Velocity trend
    const velocityTrend = this.calculateVelocityTrend(metrics);

    return {
      workflowId,
      timeline,
      phaseBreakdown,
      velocityTrend,
      currentProgress: metrics.currentProgress,
      components: metrics.components
    };
  }

  /**
   * Get dashboard summary data
   * @returns {Object} Dashboard data
   */
  getDashboardData() {
    const allWorkflows = Array.from(this.metricsStore.values());
    
    const summary = {
      totalWorkflows: allWorkflows.length,
      completedWorkflows: allWorkflows.filter(w => w.currentProgress >= 100).length,
      inProgressWorkflows: allWorkflows.filter(w => 
        w.currentProgress > 0 && w.currentProgress < 100
      ).length,
      averageProgress: allWorkflows.length > 0 ? 
        allWorkflows.reduce((sum, w) => sum + w.currentProgress, 0) / allWorkflows.length : 0
    };

    const activeWorkflows = allWorkflows
      .filter(w => w.currentProgress < 100)
      .map(w => ({
        id: w.workflowId,
        progress: w.currentProgress,
        velocity: w.velocity,
        estimatedCompletion: w.estimatedCompletion,
        alerts: w.alerts.length
      }))
      .sort((a, b) => b.progress - a.progress)
      .slice(0, 10); // Top 10

    const recentActivity = allWorkflows
      .filter(w => w.lastUpdate)
      .map(w => ({
        id: w.workflowId,
        lastUpdate: w.lastUpdate,
        progress: w.currentProgress,
        recentChange: this.calculateRecentProgressChange(w)
      }))
      .sort((a, b) => b.lastUpdate - a.lastUpdate)
      .slice(0, 20); // Last 20

    const performanceMetrics = this.getMetrics();

    return {
      summary,
      activeWorkflows,
      recentActivity,
      performanceMetrics,
      generatedAt: Date.now()
    };
  }

  /**
   * Private helper methods
   */

  setupRealTimeReporting() {
    // Set up throttling for real-time updates
    this.throttleInterval = 1000; // 1 second throttle
  }

  emitProgressUpdate(progressData) {
    if (!this.config.reporting.enableRealTimeReporting) return;

    const { workflowId } = progressData;
    const now = Date.now();
    const lastEmit = this.throttleMap.get(workflowId) || 0;

    if (now - lastEmit > this.throttleInterval) {
      this.emit('progress-update', progressData);
      this.throttleMap.set(workflowId, now);
    }
  }

  updateVelocity(metrics) {
    if (metrics.history.length < 2) {
      metrics.velocity = 0;
      return;
    }

    const recent = metrics.history.slice(-5); // Last 5 updates
    let totalProgressChange = 0;
    let totalTimeChange = 0;

    for (let i = 1; i < recent.length; i++) {
      const progressChange = recent[i].progress - recent[i - 1].progress;
      const timeChange = recent[i].timestamp - recent[i - 1].timestamp;
      
      totalProgressChange += Math.max(0, progressChange); // Only positive progress
      totalTimeChange += timeChange;
    }

    // Velocity in progress per hour
    metrics.velocity = totalTimeChange > 0 ? 
      (totalProgressChange / totalTimeChange) * 3600000 : 0;
  }

  updateEstimatedCompletion(metrics) {
    if (metrics.velocity <= 0 || metrics.currentProgress >= 100) {
      metrics.estimatedCompletion = null;
      return;
    }

    const remainingProgress = 100 - metrics.currentProgress;
    const estimatedTime = (remainingProgress / metrics.velocity) * 3600000; // Convert to milliseconds
    metrics.estimatedCompletion = Date.now() + estimatedTime;
  }

  checkProgressAlerts(workflowId, metrics) {
    const alerts = this.checkAlerts(workflowId);
    metrics.alerts = alerts;
  }

  isStagnant(metrics) {
    if (metrics.history.length < 3) return false;

    const recent = metrics.history.slice(-3);
    const progressChanges = [];

    for (let i = 1; i < recent.length; i++) {
      progressChanges.push(recent[i].progress - recent[i - 1].progress);
    }

    // Stagnant if no progress in last 3 updates
    return progressChanges.every(change => change <= 0);
  }

  hasBlockers(metrics) {
    // Check if any component is blocked
    return Object.values(metrics.components).some(component => 
      component.status === 'blocked' || component.status === 'failed'
    );
  }

  isAtRisk(metrics) {
    const elapsedTime = Date.now() - metrics.startTime;
    const hoursSinceStart = elapsedTime / (60 * 60 * 1000);
    
    return (
      hoursSinceStart > 8 && metrics.currentProgress < 50
    ) || (
      this.isStagnant(metrics) && metrics.currentProgress < 90
    );
  }

  generateTimeline(metrics) {
    return metrics.history.map(entry => ({
      timestamp: entry.timestamp,
      progress: entry.progress,
      phase: entry.phase,
      component: entry.component,
      message: entry.message
    }));
  }

  analyzeComponents(metrics) {
    const analysis = {};

    Object.entries(metrics.components).forEach(([component, data]) => {
      analysis[component] = {
        progress: data.progress,
        status: data.status,
        lastUpdate: data.lastUpdate,
        isBlocked: data.status === 'blocked',
        isFailed: data.status === 'failed',
        updateFrequency: this.calculateComponentUpdateFrequency(metrics, component)
      };
    });

    return analysis;
  }

  identifyBottlenecks(metrics) {
    const bottlenecks = [];

    // Find components with lowest progress
    const components = Object.entries(metrics.components)
      .sort((a, b) => a[1].progress - b[1].progress);

    if (components.length > 0 && components[0][1].progress < 50) {
      bottlenecks.push(components[0][0]);
    }

    return bottlenecks;
  }

  identifyBlockers(metrics) {
    const blockers = [];

    Object.entries(metrics.components).forEach(([component, data]) => {
      if (data.status === 'blocked' && data.blockReason) {
        blockers.push(data.blockReason);
      }
    });

    return blockers;
  }

  generateRecommendations(metrics, status) {
    const recommendations = [];

    if (status === 'stagnant') {
      recommendations.push('Review current tasks for potential blockers');
      recommendations.push('Consider breaking down complex tasks');
    }

    if (status === 'blocked') {
      recommendations.push('Address identified blockers immediately');
      recommendations.push('Escalate to team leads if needed');
    }

    if (metrics.velocity < 5) {
      recommendations.push('Increase resource allocation or reduce scope');
    }

    const elapsedTime = Date.now() - metrics.startTime;
    if (elapsedTime > 86400000) { // 24 hours
      recommendations.push('Consider workflow optimization or parallelization');
    }

    return recommendations;
  }

  // Alert management methods
  isAlertSuppressed(alertKey) {
    const suppression = this.alertHistory.get(alertKey);
    return suppression && suppression.until > Date.now();
  }

  suppressAlert(alertKey, duration) {
    this.alertHistory.set(alertKey, {
      suppressedAt: Date.now(),
      until: Date.now() + duration
    });
  }

  // Additional calculation methods
  calculateAverageUpdateInterval(metrics) {
    if (metrics.history.length < 2) return 0;

    let totalInterval = 0;
    for (let i = 1; i < metrics.history.length; i++) {
      totalInterval += metrics.history[i].timestamp - metrics.history[i - 1].timestamp;
    }

    return totalInterval / (metrics.history.length - 1);
  }

  calculateProgressTrend(metrics) {
    if (metrics.history.length < 3) return 'unknown';

    const recent = metrics.history.slice(-3);
    const progressChanges = [];

    for (let i = 1; i < recent.length; i++) {
      progressChanges.push(recent[i].progress - recent[i - 1].progress);
    }

    const averageChange = progressChanges.reduce((a, b) => a + b, 0) / progressChanges.length;

    if (averageChange > 2) return 'accelerating';
    if (averageChange > 0) return 'steady';
    if (averageChange < -1) return 'declining';
    return 'stagnant';
  }

  calculateCompletionProbability(metrics) {
    if (metrics.currentProgress >= 100) return 100;
    if (metrics.velocity <= 0) return 0;

    const remainingProgress = 100 - metrics.currentProgress;
    const timeToComplete = remainingProgress / metrics.velocity * 3600000;
    
    // Simple heuristic: higher probability if less time needed
    if (timeToComplete < 86400000) return 90; // < 24 hours
    if (timeToComplete < 259200000) return 70; // < 72 hours
    if (timeToComplete < 604800000) return 50; // < 1 week
    return 30;
  }

  calculateGlobalAverageVelocity(workflows) {
    const velocities = workflows.map(w => w.velocity).filter(v => v > 0);
    return velocities.length > 0 ? 
      velocities.reduce((a, b) => a + b, 0) / velocities.length : 0;
  }

  analyzeTrends(workflows, timeRange) {
    // Mock trend analysis
    return {
      completionRate: 'increasing',
      averageVelocity: 'stable', 
      workflowCount: 'increasing'
    };
  }

  analyzePatterns(workflows) {
    // Mock pattern analysis
    return {
      commonBottlenecks: ['ci', 'testing'],
      successFactors: ['good planning', 'adequate resources'],
      failurePatterns: ['scope creep', 'technical debt']
    };
  }

  generateGlobalRecommendations(stats) {
    const recommendations = [];

    if (stats.successRate < 70) {
      recommendations.push('Focus on improving workflow success rate');
    }

    if (stats.performance.averageDuration > 604800000) { // 1 week
      recommendations.push('Optimize workflow duration');
    }

    return recommendations;
  }

  calculateVelocityTrend(metrics) {
    if (metrics.history.length < 5) return [];

    const trend = [];
    for (let i = 4; i < metrics.history.length; i++) {
      const window = metrics.history.slice(i - 4, i + 1);
      let velocitySum = 0;
      
      for (let j = 1; j < window.length; j++) {
        const progressChange = window[j].progress - window[j - 1].progress;
        const timeChange = window[j].timestamp - window[j - 1].timestamp;
        velocitySum += timeChange > 0 ? (progressChange / timeChange) * 3600000 : 0;
      }
      
      trend.push({
        timestamp: window[window.length - 1].timestamp,
        velocity: velocitySum / (window.length - 1)
      });
    }

    return trend;
  }

  calculateComponentUpdateFrequency(metrics, component) {
    const updates = metrics.history.filter(entry => entry.component === component);
    if (updates.length < 2) return 0;

    let totalInterval = 0;
    for (let i = 1; i < updates.length; i++) {
      totalInterval += updates[i].timestamp - updates[i - 1].timestamp;
    }

    return totalInterval / (updates.length - 1);
  }

  calculateRecentProgressChange(workflow) {
    if (workflow.history.length < 2) return 0;

    const recent = workflow.history.slice(-2);
    return recent[1].progress - recent[0].progress;
  }
}

module.exports = { ProgressReporter };