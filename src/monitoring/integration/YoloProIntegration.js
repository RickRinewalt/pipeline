const EventEmitter = require('events');
const path = require('path');

/**
 * YOLO-PRO Integration Module
 * Integrates performance monitoring with existing YOLO-PRO systems
 */
class YoloProIntegration extends EventEmitter {
  constructor(monitoringEngine, config = {}) {
    super();

    if (!monitoringEngine) {
      throw new Error('Monitoring engine is required');
    }

    this.monitoringEngine = monitoringEngine;
    this.config = {
      integration: {
        enabled: true,
        trackCLICommands: true,
        trackGitOperations: true,
        trackFileOperations: true,
        trackWorkflows: true,
        trackSparCPhases: true,
        ...config.integration
      },
      yoloPro: {
        cliPath: config.yoloPro?.cliPath || 'yolo-pro/src/cli',
        automationPath: config.yoloPro?.automationPath || 'src/automation',
        workflowPath: config.yoloPro?.workflowPath || 'src/workflows',
        ...config.yoloPro
      },
      hooks: {
        preTask: true,
        postTask: true,
        preEdit: true,
        postEdit: true,
        sessionRestore: true,
        sessionEnd: true,
        ...config.hooks
      },
      ...config
    };

    this.isActive = false;
    this.integrationStats = {
      totalCommands: 0,
      trackedOperations: 0,
      lastIntegration: null
    };

    // Integration components
    this.cliTracker = null;
    this.workflowTracker = null;
    this.sparcTracker = null;
  }

  /**
   * Start YOLO-PRO integration
   */
  async start() {
    if (this.isActive) {
      return { success: false, error: 'Integration already active' };
    }

    try {
      console.log('Starting YOLO-PRO performance monitoring integration...');

      // Initialize integration components
      await this.initializeIntegrationComponents();

      // Set up monitoring hooks
      this.setupMonitoringHooks();

      // Register CLI collectors
      await this.registerCLICollectors();

      // Set up event listeners
      this.setupEventListeners();

      this.isActive = true;
      this.emit('integration-started');

      return {
        success: true,
        startTime: Date.now(),
        components: this.getActiveComponents()
      };

    } catch (error) {
      console.error('Failed to start YOLO-PRO integration:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Stop YOLO-PRO integration
   */
  async stop() {
    if (!this.isActive) {
      return { success: false, error: 'Integration not active' };
    }

    try {
      console.log('Stopping YOLO-PRO integration...');

      // Remove event listeners
      this.removeEventListeners();

      // Cleanup integration components
      await this.cleanupIntegrationComponents();

      this.isActive = false;
      this.emit('integration-stopped');

      return {
        success: true,
        stopTime: Date.now(),
        stats: this.integrationStats
      };

    } catch (error) {
      console.error('Error stopping YOLO-PRO integration:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Hook into YOLO-PRO CLI commands
   */
  hookCLICommand(commandName, executeFn) {
    if (!this.config.integration.trackCLICommands) {
      return executeFn;
    }

    return async (...args) => {
      const operationId = this.startOperationTracking('cli', commandName, {
        args: this.sanitizeArgs(args)
      });

      let result = null;
      let error = null;
      let success = true;

      try {
        // Execute pre-command hooks
        await this.executePreCommandHooks(commandName, args);

        // Execute the actual command
        const startTime = Date.now();
        result = await executeFn(...args);
        const endTime = Date.now();

        // Track command performance
        this.trackCommandPerformance(commandName, startTime, endTime, true);

        // Execute post-command hooks
        await this.executePostCommandHooks(commandName, args, result);

      } catch (err) {
        error = err;
        success = false;
        this.trackCommandPerformance(commandName, Date.now() - 1000, Date.now(), false, err.message);
      } finally {
        this.endOperationTracking(operationId, success, result, error);
        this.integrationStats.totalCommands++;
      }

      if (error) {
        throw error;
      }

      return result;
    };
  }

  /**
   * Hook into YOLO-PRO workflow execution
   */
  hookWorkflowExecution(workflowName, executeFn) {
    if (!this.config.integration.trackWorkflows) {
      return executeFn;
    }

    return async (...args) => {
      const operationId = this.startOperationTracking('workflow', workflowName, {
        args: this.sanitizeArgs(args)
      });

      let result = null;
      let error = null;
      let success = true;

      try {
        // Start workflow tracking
        const workflowId = this.startWorkflowTracking(workflowName);

        // Execute pre-workflow hooks
        await this.executePreWorkflowHooks(workflowName, args);

        const startTime = Date.now();
        result = await executeFn(...args);
        const endTime = Date.now();

        // Track workflow performance
        this.trackWorkflowPerformance(workflowName, startTime, endTime, true);

        // Execute post-workflow hooks
        await this.executePostWorkflowHooks(workflowName, args, result);

        // End workflow tracking
        this.endWorkflowTracking(workflowId, true, result);

      } catch (err) {
        error = err;
        success = false;
        this.trackWorkflowPerformance(workflowName, Date.now() - 1000, Date.now(), false, err.message);
      } finally {
        this.endOperationTracking(operationId, success, result, error);
      }

      if (error) {
        throw error;
      }

      return result;
    };
  }

  /**
   * Hook into SPARC phase execution
   */
  hookSparcPhase(phaseName, executeFn) {
    if (!this.config.integration.trackSparCPhases) {
      return executeFn;
    }

    return async (...args) => {
      const operationId = this.startOperationTracking('sparc', phaseName, {
        phase: phaseName,
        args: this.sanitizeArgs(args)
      });

      let result = null;
      let error = null;
      let success = true;

      try {
        // Start SPARC phase tracking
        const phaseId = this.startSparcPhaseTracking(phaseName);

        // Execute pre-phase hooks
        await this.executePreSparcPhaseHooks(phaseName, args);

        const startTime = Date.now();
        result = await executeFn(...args);
        const endTime = Date.now();

        // Track phase performance
        this.trackSparcPhasePerformance(phaseName, startTime, endTime, true);

        // Execute post-phase hooks
        await this.executePostSparcPhaseHooks(phaseName, args, result);

        // End phase tracking
        this.endSparcPhaseTracking(phaseId, true, result);

      } catch (err) {
        error = err;
        success = false;
        this.trackSparcPhasePerformance(phaseName, Date.now() - 1000, Date.now(), false, err.message);
      } finally {
        this.endOperationTracking(operationId, success, result, error);
      }

      if (error) {
        throw error;
      }

      return result;
    };
  }

  /**
   * Track Git operations
   */
  trackGitOperation(operation, repoPath, metadata = {}) {
    if (!this.config.integration.trackGitOperations) {
      return;
    }

    const operationId = this.startOperationTracking('git', operation, {
      repoPath,
      ...metadata
    });

    // This would be integrated with git hooks or commands
    // For now, we'll just track the operation initiation
    
    this.emit('git-operation-tracked', {
      operationId,
      operation,
      repoPath,
      metadata,
      timestamp: Date.now()
    });

    return operationId;
  }

  /**
   * Track file operations
   */
  trackFileOperation(operation, filePath, metadata = {}) {
    if (!this.config.integration.trackFileOperations) {
      return;
    }

    const operationId = this.startOperationTracking('file', operation, {
      filePath,
      ...metadata
    });

    this.emit('file-operation-tracked', {
      operationId,
      operation,
      filePath,
      metadata,
      timestamp: Date.now()
    });

    return operationId;
  }

  /**
   * Get integration statistics
   */
  getIntegrationStats() {
    return {
      ...this.integrationStats,
      isActive: this.isActive,
      components: this.getActiveComponents(),
      timestamp: Date.now()
    };
  }

  /**
   * Get performance metrics for YOLO-PRO operations
   */
  getYoloProMetrics() {
    const metrics = {
      cli: this.getCLIMetrics(),
      workflows: this.getWorkflowMetrics(),
      sparc: this.getSparcMetrics(),
      git: this.getGitMetrics(),
      files: this.getFileMetrics()
    };

    return {
      timestamp: Date.now(),
      metrics,
      summary: this.generateMetricsSummary(metrics)
    };
  }

  /**
   * Private Methods
   */

  async initializeIntegrationComponents() {
    // Initialize CLI tracker
    if (this.config.integration.trackCLICommands) {
      const CLIMetricsCollector = require('../collectors/CLIMetricsCollector');
      this.cliTracker = new CLIMetricsCollector();
      
      // Register with monitoring engine
      this.monitoringEngine.registerCollector('yolo-pro-cli', this.cliTracker);
    }

    // Initialize workflow tracker
    if (this.config.integration.trackWorkflows) {
      this.workflowTracker = new WorkflowTracker();
    }

    // Initialize SPARC tracker
    if (this.config.integration.trackSparCPhases) {
      this.sparcTracker = new SparcPhaseTracker();
    }

    console.log('Integration components initialized');
  }

  async registerCLICollectors() {
    if (this.cliTracker) {
      // The CLI collector is already registered in initializeIntegrationComponents
      console.log('CLI metrics collector registered with monitoring engine');
    }
  }

  setupMonitoringHooks() {
    // Set up various monitoring hooks based on configuration
    if (this.config.hooks.preTask) {
      this.setupPreTaskHooks();
    }

    if (this.config.hooks.postTask) {
      this.setupPostTaskHooks();
    }

    if (this.config.hooks.preEdit) {
      this.setupPreEditHooks();
    }

    if (this.config.hooks.postEdit) {
      this.setupPostEditHooks();
    }

    console.log('Monitoring hooks configured');
  }

  setupEventListeners() {
    // Listen to monitoring engine events
    this.monitoringEngine.on('metrics-collected', (data) => {
      this.handleMetricsUpdate(data);
    });

    this.monitoringEngine.on('alert', (alert) => {
      this.handlePerformanceAlert(alert);
    });

    this.monitoringEngine.on('bottleneck', (bottleneck) => {
      this.handlePerformanceBottleneck(bottleneck);
    });
  }

  removeEventListeners() {
    this.monitoringEngine.removeAllListeners();
  }

  async cleanupIntegrationComponents() {
    if (this.cliTracker) {
      await this.cliTracker.cleanup();
    }

    if (this.workflowTracker) {
      await this.workflowTracker.cleanup();
    }

    if (this.sparcTracker) {
      await this.sparcTracker.cleanup();
    }
  }

  startOperationTracking(type, name, metadata = {}) {
    const operationId = `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    this.integrationStats.trackedOperations++;
    this.integrationStats.lastIntegration = Date.now();

    this.emit('operation-started', {
      operationId,
      type,
      name,
      metadata,
      timestamp: Date.now()
    });

    return operationId;
  }

  endOperationTracking(operationId, success, result, error) {
    this.emit('operation-ended', {
      operationId,
      success,
      result: this.sanitizeResult(result),
      error: error ? error.message : null,
      timestamp: Date.now()
    });
  }

  // Command tracking methods
  async executePreCommandHooks(commandName, args) {
    this.emit('pre-command', { commandName, args, timestamp: Date.now() });
  }

  async executePostCommandHooks(commandName, args, result) {
    this.emit('post-command', { commandName, args, result: this.sanitizeResult(result), timestamp: Date.now() });
  }

  trackCommandPerformance(commandName, startTime, endTime, success, error = null) {
    const duration = endTime - startTime;
    
    if (this.cliTracker) {
      this.cliTracker.trackCommand(commandName, startTime, endTime, success, error);
    }

    this.emit('command-performance', {
      commandName,
      duration,
      success,
      error,
      timestamp: endTime
    });
  }

  // Workflow tracking methods
  startWorkflowTracking(workflowName) {
    const workflowId = `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    if (this.workflowTracker) {
      this.workflowTracker.startWorkflow(workflowId, workflowName);
    }

    return workflowId;
  }

  endWorkflowTracking(workflowId, success, result) {
    if (this.workflowTracker) {
      this.workflowTracker.endWorkflow(workflowId, success, result);
    }
  }

  async executePreWorkflowHooks(workflowName, args) {
    this.emit('pre-workflow', { workflowName, args, timestamp: Date.now() });
  }

  async executePostWorkflowHooks(workflowName, args, result) {
    this.emit('post-workflow', { workflowName, args, result: this.sanitizeResult(result), timestamp: Date.now() });
  }

  trackWorkflowPerformance(workflowName, startTime, endTime, success, error = null) {
    const duration = endTime - startTime;
    
    this.emit('workflow-performance', {
      workflowName,
      duration,
      success,
      error,
      timestamp: endTime
    });
  }

  // SPARC phase tracking methods
  startSparcPhaseTracking(phaseName) {
    const phaseId = `sparc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    if (this.sparcTracker) {
      this.sparcTracker.startPhase(phaseId, phaseName);
    }

    return phaseId;
  }

  endSparcPhaseTracking(phaseId, success, result) {
    if (this.sparcTracker) {
      this.sparcTracker.endPhase(phaseId, success, result);
    }
  }

  async executePreSparcPhaseHooks(phaseName, args) {
    this.emit('pre-sparc-phase', { phaseName, args, timestamp: Date.now() });
  }

  async executePostSparcPhaseHooks(phaseName, args, result) {
    this.emit('post-sparc-phase', { phaseName, args, result: this.sanitizeResult(result), timestamp: Date.now() });
  }

  trackSparcPhasePerformance(phaseName, startTime, endTime, success, error = null) {
    const duration = endTime - startTime;
    
    this.emit('sparc-phase-performance', {
      phaseName,
      duration,
      success,
      error,
      timestamp: endTime
    });
  }

  // Hook setup methods
  setupPreTaskHooks() {
    // Set up pre-task hooks
  }

  setupPostTaskHooks() {
    // Set up post-task hooks
  }

  setupPreEditHooks() {
    // Set up pre-edit hooks
  }

  setupPostEditHooks() {
    // Set up post-edit hooks
  }

  // Event handlers
  handleMetricsUpdate(data) {
    this.emit('yolo-pro-metrics-updated', data);
  }

  handlePerformanceAlert(alert) {
    this.emit('yolo-pro-performance-alert', alert);
  }

  handlePerformanceBottleneck(bottleneck) {
    this.emit('yolo-pro-performance-bottleneck', bottleneck);
  }

  // Utility methods
  sanitizeArgs(args) {
    // Remove sensitive information from arguments
    return args.map(arg => {
      if (typeof arg === 'string' && (arg.includes('password') || arg.includes('token'))) {
        return '[REDACTED]';
      }
      return arg;
    });
  }

  sanitizeResult(result) {
    // Remove sensitive information from results
    if (result && typeof result === 'object') {
      const sanitized = { ...result };
      
      Object.keys(sanitized).forEach(key => {
        if (key.toLowerCase().includes('password') || key.toLowerCase().includes('token')) {
          sanitized[key] = '[REDACTED]';
        }
      });
      
      return sanitized;
    }
    
    return result;
  }

  getActiveComponents() {
    const components = [];
    
    if (this.cliTracker) components.push('cli-tracker');
    if (this.workflowTracker) components.push('workflow-tracker');
    if (this.sparcTracker) components.push('sparc-tracker');
    
    return components;
  }

  getCLIMetrics() {
    if (this.cliTracker) {
      return this.cliTracker.exportData();
    }
    return { available: false };
  }

  getWorkflowMetrics() {
    if (this.workflowTracker) {
      return this.workflowTracker.getMetrics();
    }
    return { available: false };
  }

  getSparcMetrics() {
    if (this.sparcTracker) {
      return this.sparcTracker.getMetrics();
    }
    return { available: false };
  }

  getGitMetrics() {
    return { available: false, message: 'Git metrics tracking not yet implemented' };
  }

  getFileMetrics() {
    return { available: false, message: 'File metrics tracking not yet implemented' };
  }

  generateMetricsSummary(metrics) {
    return {
      totalComponents: Object.keys(metrics).length,
      activeComponents: Object.values(metrics).filter(m => m.available !== false).length,
      lastUpdate: Date.now()
    };
  }
}

// Helper classes for tracking
class WorkflowTracker {
  constructor() {
    this.activeWorkflows = new Map();
    this.completedWorkflows = [];
  }

  startWorkflow(workflowId, name) {
    this.activeWorkflows.set(workflowId, {
      id: workflowId,
      name,
      startTime: Date.now(),
      status: 'running'
    });
  }

  endWorkflow(workflowId, success, result) {
    const workflow = this.activeWorkflows.get(workflowId);
    if (workflow) {
      workflow.endTime = Date.now();
      workflow.duration = workflow.endTime - workflow.startTime;
      workflow.success = success;
      workflow.result = result;
      workflow.status = 'completed';

      this.completedWorkflows.push(workflow);
      this.activeWorkflows.delete(workflowId);
    }
  }

  getMetrics() {
    return {
      available: true,
      active: this.activeWorkflows.size,
      completed: this.completedWorkflows.length,
      workflows: Array.from(this.activeWorkflows.values())
    };
  }

  async cleanup() {
    this.activeWorkflows.clear();
  }
}

class SparcPhaseTracker {
  constructor() {
    this.activePhases = new Map();
    this.completedPhases = [];
  }

  startPhase(phaseId, name) {
    this.activePhases.set(phaseId, {
      id: phaseId,
      name,
      startTime: Date.now(),
      status: 'running'
    });
  }

  endPhase(phaseId, success, result) {
    const phase = this.activePhases.get(phaseId);
    if (phase) {
      phase.endTime = Date.now();
      phase.duration = phase.endTime - phase.startTime;
      phase.success = success;
      phase.result = result;
      phase.status = 'completed';

      this.completedPhases.push(phase);
      this.activePhases.delete(phaseId);
    }
  }

  getMetrics() {
    return {
      available: true,
      active: this.activePhases.size,
      completed: this.completedPhases.length,
      phases: Array.from(this.activePhases.values())
    };
  }

  async cleanup() {
    this.activePhases.clear();
  }
}

module.exports = YoloProIntegration;