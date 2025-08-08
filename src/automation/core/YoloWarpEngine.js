const { MilestoneProcessor } = require('../processors/MilestoneProcessor');
const { SparcAutomator } = require('../processors/SparcAutomator');
const { WCPManager } = require('../managers/WCPManager');
const { CIPipelineManager } = require('../managers/CIPipelineManager');
const { ProgressReporter } = require('../reporters/ProgressReporter');
const { v4: uuidv4 } = require('uuid');

/**
 * YOLO-WARP Automation Engine
 * Core orchestrator for automated milestone completion workflows
 */
class YoloWarpEngine {
  constructor(config, logger) {
    if (!config) {
      throw new Error('Config is required');
    }
    if (!logger) {
      throw new Error('Logger is required');
    }

    this.config = config;
    this.logger = logger;
    this.activeWorkflows = new Map();
    this.completedWorkflows = new Map();

    // Initialize component dependencies
    this.milestoneProcessor = new MilestoneProcessor(config, logger);
    this.sparcAutomator = new SparcAutomator(config, logger);
    this.wcpManager = new WCPManager(config, logger);
    this.ciPipelineManager = new CIPipelineManager(config, logger);
    this.progressReporter = new ProgressReporter(config, logger);

    this.logger.info('YOLO-WARP Automation Engine initialized');
  }

  /**
   * Execute complete automation workflow
   * @param {Object} workflowSpec - Workflow specification
   * @returns {Object} Workflow execution result
   */
  async automateWorkflow(workflowSpec) {
    const workflowId = uuidv4();
    const startTime = Date.now();

    this.logger.info(`Starting automation workflow ${workflowId}`, { 
      milestoneId: workflowSpec.milestoneId,
      features: workflowSpec.features?.length || 0
    });

    try {
      // Validate workflow specification
      const validation = this.validateWorkflowSpec(workflowSpec);
      if (!validation.valid) {
        return {
          success: false,
          workflowId,
          error: `Invalid workflow specification: ${validation.errors.join(', ')}`
        };
      }

      // Initialize workflow tracking
      const workflow = {
        id: workflowId,
        spec: workflowSpec,
        startTime,
        status: 'running',
        components: {},
        progress: 0
      };

      this.activeWorkflows.set(workflowId, workflow);

      // Execute workflow components based on specification
      const results = {
        success: true,
        workflowId,
        components: {},
        partialSuccess: false,
        completedComponents: [],
        failedComponents: [],
        recoveredComponents: []
      };

      try {
        // Phase 1: Milestone Processing
        if (workflowSpec.milestoneId) {
          this.logger.info(`Processing milestone ${workflowSpec.milestoneId}`);
          results.components.milestone = await this.executeWithRetry(
            () => this.milestoneProcessor.processMilestone(workflowSpec.milestoneId),
            'milestone processing'
          );
          
          if (results.components.milestone.success) {
            results.completedComponents.push('milestone');
            workflow.progress += 20;
          } else {
            results.failedComponents.push('milestone');
            throw new Error(`Milestone processing failed: ${results.components.milestone.error}`);
          }
        }

        // Phase 2: WCP Initialization (if enabled)
        if (workflowSpec.wcpEnabled) {
          this.logger.info('Initializing Work Chunking Protocol');
          const wcpData = {
            milestoneId: workflowSpec.milestoneId,
            title: workflowSpec.epicTitle || 'Automated EPIC',
            features: workflowSpec.features || [],
            businessObjective: workflowSpec.businessObjective
          };

          results.components.wcp = await this.executeWithRetry(
            () => this.wcpManager.initializeWCP(wcpData),
            'WCP initialization'
          );

          if (results.components.wcp.success) {
            results.completedComponents.push('wcp');
            workflow.progress += 20;
          } else {
            results.failedComponents.push('wcp');
            if (!workflowSpec.allowPartialFailure) {
              throw new Error(`WCP initialization failed: ${results.components.wcp.error}`);
            }
          }
        }

        // Phase 3: SPARC Workflow (if enabled)
        if (workflowSpec.sparcEnabled) {
          this.logger.info('Starting SPARC workflow automation');
          const sparcTask = workflowSpec.sparcTaskDescription || 
            `Implement ${workflowSpec.epicTitle || 'automated feature'}`;

          results.components.sparc = await this.executeWithRetry(
            () => this.sparcAutomator.runSparcWorkflow(sparcTask),
            'SPARC workflow'
          );

          if (results.components.sparc.success) {
            results.completedComponents.push('sparc');
            workflow.progress += 30;
          } else {
            results.failedComponents.push('sparc');
            if (!workflowSpec.allowPartialFailure) {
              throw new Error(`SPARC workflow failed: ${results.components.sparc.error}`);
            }
          }
        }

        // Phase 4: CI Pipeline (if enabled)
        if (workflowSpec.ciEnabled) {
          this.logger.info('Starting CI pipeline automation');
          const ciConfig = {
            branch: workflowSpec.branch || 'main',
            workflow: workflowSpec.ciWorkflow || 'ci.yml',
            env: workflowSpec.environment || {},
            qualityGates: workflowSpec.qualityGates || this.config.ci?.qualityGates
          };

          results.components.ci = await this.executeWithRetry(
            () => this.ciPipelineManager.startPipeline(ciConfig),
            'CI pipeline'
          );

          if (results.components.ci.success) {
            results.completedComponents.push('ci');
            workflow.progress += 20;
          } else {
            results.failedComponents.push('ci');
            if (!workflowSpec.allowPartialFailure) {
              throw new Error(`CI pipeline failed: ${results.components.ci.error}`);
            }
          }
        }

        // Phase 5: Generate Progress Report
        results.components.report = await this.progressReporter.generateReport(workflowId);
        workflow.progress = 100;

        // Update workflow status
        workflow.status = 'completed';
        workflow.endTime = Date.now();
        workflow.duration = workflow.endTime - workflow.startTime;

        this.logger.info(`Workflow ${workflowId} completed successfully`, {
          duration: workflow.duration,
          components: results.completedComponents
        });

      } catch (error) {
        // Handle partial failures
        results.success = false;
        results.error = error.message;
        
        if (results.completedComponents.length > 0) {
          results.partialSuccess = true;
          this.logger.warn(`Workflow ${workflowId} completed with partial success`, {
            completed: results.completedComponents,
            failed: results.failedComponents,
            error: error.message
          });
        } else {
          this.logger.error(`Workflow ${workflowId} failed completely`, { error: error.message });
        }

        workflow.status = 'failed';
        workflow.error = error.message;
        workflow.endTime = Date.now();
      }

      // Move to completed workflows
      this.completedWorkflows.set(workflowId, workflow);
      this.activeWorkflows.delete(workflowId);

      return results;

    } catch (error) {
      this.logger.error(`Fatal error in workflow ${workflowId}`, { error: error.message });
      return {
        success: false,
        workflowId,
        error: error.message,
        fatal: true
      };
    }
  }

  /**
   * Monitor active workflow status
   * @param {string} workflowId - Workflow ID to monitor
   * @returns {Object} Workflow status
   */
  async monitorWorkflow(workflowId) {
    try {
      const workflow = this.activeWorkflows.get(workflowId) || 
                      this.completedWorkflows.get(workflowId);

      if (!workflow) {
        return {
          found: false,
          error: `Workflow ${workflowId} not found`
        };
      }

      const status = {
        workflowId,
        status: workflow.status,
        progress: workflow.progress,
        startTime: workflow.startTime,
        duration: workflow.endTime ? 
          workflow.endTime - workflow.startTime : 
          Date.now() - workflow.startTime,
        components: {}
      };

      // Get component statuses
      if (workflow.spec.milestoneId) {
        status.components.milestone = await this.milestoneProcessor.getMilestoneStatus(
          workflow.spec.milestoneId
        );
      }

      if (workflow.spec.sparcEnabled) {
        const sparcResult = workflow.components?.sparc;
        if (sparcResult?.workflowId) {
          status.components.sparc = await this.sparcAutomator.getWorkflowStatus(
            sparcResult.workflowId
          );
        }
      }

      if (workflow.spec.wcpEnabled) {
        const wcpResult = workflow.components?.wcp;
        if (wcpResult?.epicId) {
          status.components.wcp = await this.wcpManager.getWCPStatus(wcpResult.epicId);
        }
      }

      if (workflow.spec.ciEnabled) {
        const ciResult = workflow.components?.ci;
        if (ciResult?.pipelineId) {
          status.components.ci = await this.ciPipelineManager.getPipelineStatus(
            ciResult.pipelineId
          );
        }
      }

      // Calculate overall progress
      const componentProgresses = Object.values(status.components)
        .filter(c => c.progress !== undefined)
        .map(c => c.progress);
      
      if (componentProgresses.length > 0) {
        status.overallProgress = componentProgresses.reduce((a, b) => a + b, 0) / 
                                componentProgresses.length;
      } else {
        status.overallProgress = workflow.progress;
      }

      return status;

    } catch (error) {
      this.logger.error(`Error monitoring workflow ${workflowId}`, { error: error.message });
      return {
        workflowId,
        error: error.message
      };
    }
  }

  /**
   * Stop active workflow
   * @param {string} workflowId - Workflow ID to stop
   * @returns {Object} Stop result
   */
  async stopWorkflow(workflowId) {
    try {
      const workflow = this.activeWorkflows.get(workflowId);
      if (!workflow) {
        return {
          success: false,
          error: `Active workflow ${workflowId} not found`
        };
      }

      this.logger.info(`Stopping workflow ${workflowId}`);

      // Stop individual components
      const stopResults = [];

      try {
        // Stop SPARC workflow if running
        if (workflow.components?.sparc?.workflowId) {
          const sparcStop = await this.sparcAutomator.stopWorkflow(
            workflow.components.sparc.workflowId
          );
          stopResults.push({ component: 'sparc', ...sparcStop });
        }

        // Stop CI pipeline monitoring if running
        if (workflow.components?.ci?.pipelineId) {
          const ciStop = await this.ciPipelineManager.stopMonitoring(
            workflow.components.ci.pipelineId
          );
          stopResults.push({ component: 'ci', ...ciStop });
        }

        workflow.status = 'stopped';
        workflow.endTime = Date.now();
        workflow.stoppedBy = 'user';

        // Move to completed workflows
        this.completedWorkflows.set(workflowId, workflow);
        this.activeWorkflows.delete(workflowId);

        return {
          success: true,
          workflowId,
          stopResults
        };

      } catch (error) {
        return {
          success: false,
          workflowId,
          error: error.message,
          partialStop: stopResults.length > 0,
          stopResults
        };
      }

    } catch (error) {
      this.logger.error(`Error stopping workflow ${workflowId}`, { error: error.message });
      return {
        success: false,
        workflowId,
        error: error.message
      };
    }
  }

  /**
   * Get list of active workflows
   * @returns {Array} Active workflows
   */
  getActiveWorkflows() {
    return Array.from(this.activeWorkflows.values()).map(workflow => ({
      id: workflow.id,
      status: workflow.status,
      progress: workflow.progress,
      startTime: workflow.startTime,
      milestoneId: workflow.spec.milestoneId,
      title: workflow.spec.epicTitle
    }));
  }

  /**
   * Get workflow history and metrics
   * @param {Object} filters - Optional filters
   * @returns {Object} Workflow metrics
   */
  getWorkflowMetrics(filters = {}) {
    const allWorkflows = [
      ...Array.from(this.activeWorkflows.values()),
      ...Array.from(this.completedWorkflows.values())
    ];

    let filteredWorkflows = allWorkflows;

    // Apply filters
    if (filters.status) {
      filteredWorkflows = filteredWorkflows.filter(w => w.status === filters.status);
    }
    if (filters.since) {
      filteredWorkflows = filteredWorkflows.filter(w => w.startTime >= filters.since);
    }
    if (filters.milestoneId) {
      filteredWorkflows = filteredWorkflows.filter(w => 
        w.spec.milestoneId === filters.milestoneId
      );
    }

    // Calculate metrics
    const totalWorkflows = filteredWorkflows.length;
    const completedWorkflows = filteredWorkflows.filter(w => w.status === 'completed').length;
    const failedWorkflows = filteredWorkflows.filter(w => w.status === 'failed').length;
    const averageDuration = filteredWorkflows
      .filter(w => w.duration)
      .reduce((sum, w, _, arr) => sum + w.duration / arr.length, 0);

    return {
      totalWorkflows,
      completedWorkflows,
      failedWorkflows,
      activeWorkflows: totalWorkflows - completedWorkflows - failedWorkflows,
      successRate: totalWorkflows > 0 ? (completedWorkflows / totalWorkflows) * 100 : 0,
      averageDuration,
      workflows: filteredWorkflows.map(w => ({
        id: w.id,
        status: w.status,
        progress: w.progress,
        startTime: w.startTime,
        duration: w.duration
      }))
    };
  }

  /**
   * Validate workflow specification
   * @param {Object} spec - Workflow specification
   * @returns {Object} Validation result
   */
  validateWorkflowSpec(spec) {
    const errors = [];

    if (!spec.milestoneId && !spec.epicTitle) {
      errors.push('Either milestoneId or epicTitle is required');
    }

    if (spec.sparcEnabled && !spec.sparcTaskDescription && !spec.epicTitle) {
      errors.push('SPARC workflow requires task description or epic title');
    }

    if (spec.ciEnabled && !spec.branch) {
      errors.push('CI pipeline requires branch specification');
    }

    if (spec.features && !Array.isArray(spec.features)) {
      errors.push('Features must be an array');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Execute function with retry logic
   * @param {Function} fn - Function to execute
   * @param {string} operation - Operation description for logging
   * @returns {*} Function result
   */
  async executeWithRetry(fn, operation) {
    const maxRetries = this.config.automation?.retryAttempts || 3;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.debug(`Executing ${operation} (attempt ${attempt}/${maxRetries})`);
        const result = await fn();
        
        if (attempt > 1) {
          this.logger.info(`${operation} succeeded after ${attempt} attempts`);
        }
        
        return result;

      } catch (error) {
        lastError = error;
        this.logger.warn(`${operation} failed on attempt ${attempt}/${maxRetries}`, {
          error: error.message
        });

        if (attempt < maxRetries) {
          // Exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  /**
   * Cleanup completed workflows older than retention period
   */
  async cleanupOldWorkflows() {
    const retentionMs = (this.config.automation?.retentionDays || 7) * 24 * 60 * 60 * 1000;
    const cutoffTime = Date.now() - retentionMs;

    let cleanedCount = 0;

    for (const [id, workflow] of this.completedWorkflows.entries()) {
      if (workflow.endTime && workflow.endTime < cutoffTime) {
        this.completedWorkflows.delete(id);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.info(`Cleaned up ${cleanedCount} old workflows`);
    }
  }
}

module.exports = { YoloWarpEngine };