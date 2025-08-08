const { exec } = require('child_process');
const { promisify } = require('util');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const execAsync = promisify(exec);

/**
 * SparcAutomator
 * Handles SPARC methodology automation (Specification, Pseudocode, Architecture, Refinement, Completion)
 */
class SparcAutomator {
  constructor(config, logger) {
    this.config = {
      sparc: {
        enableParallelProcessing: true,
        timeoutMs: 60000,
        modes: {
          specification: 'spec-pseudocode',
          pseudocode: 'spec-pseudocode',
          architecture: 'architect',
          refinement: 'tdd',
          completion: 'integration'
        },
        ...config.sparc
      },
      automation: {
        workingDirectory: process.cwd(),
        retryAttempts: 3,
        ...config.automation
      },
      ...config
    };

    this.logger = logger;
    this.activeWorkflows = new Map();
    this.completedWorkflows = new Map();
    this.phases = ['specification', 'pseudocode', 'architecture', 'refinement', 'completion'];

    this.logger.info('SPARC Automator initialized', {
      parallelProcessing: this.config.sparc.enableParallelProcessing,
      timeout: this.config.sparc.timeoutMs
    });
  }

  /**
   * Run complete SPARC workflow
   * @param {string} taskDescription - Task description for SPARC processing
   * @param {Object} options - Additional options
   * @returns {Object} Workflow result
   */
  async runSparcWorkflow(taskDescription, options = {}) {
    if (!taskDescription || taskDescription.trim() === '') {
      return {
        success: false,
        error: 'Task description is required'
      };
    }

    const workflowId = uuidv4();
    const startTime = Date.now();

    this.logger.info(`Starting SPARC workflow ${workflowId}`, {
      task: taskDescription,
      parallel: this.config.sparc.enableParallelProcessing
    });

    try {
      // Initialize workflow tracking
      const workflow = {
        id: workflowId,
        taskDescription,
        startTime,
        status: 'running',
        phases: this.phases.map(phase => ({
          name: phase,
          status: 'pending',
          startTime: null,
          endTime: null,
          artifacts: [],
          error: null
        })),
        parallelExecution: this.config.sparc.enableParallelProcessing
      };

      this.activeWorkflows.set(workflowId, workflow);

      let results;
      if (this.config.sparc.enableParallelProcessing) {
        this.logger.info(`Running SPARC phases in parallel for ${workflowId}`);
        results = await this.executeParallelPhases(workflowId, taskDescription);
      } else {
        this.logger.info(`Running SPARC phases sequentially for ${workflowId}`);
        results = await this.executeSequentialPhases(workflowId, taskDescription);
      }

      // Update workflow status
      workflow.endTime = Date.now();
      workflow.duration = workflow.endTime - workflow.startTime;
      workflow.status = results.success ? 'completed' : 'failed';

      if (!results.success) {
        workflow.failedPhase = results.failedPhase;
        workflow.error = results.error;
      }

      // Move to completed workflows
      this.completedWorkflows.set(workflowId, workflow);
      this.activeWorkflows.delete(workflowId);

      const finalResult = {
        success: results.success,
        workflowId,
        phases: workflow.phases,
        completedPhases: results.completedPhases || 0,
        failedPhase: results.failedPhase,
        error: results.error,
        duration: workflow.duration,
        parallelExecution: workflow.parallelExecution,
        artifacts: this.collectArtifacts(workflow.phases)
      };

      if (results.success) {
        this.logger.info(`SPARC workflow ${workflowId} completed successfully`, {
          duration: workflow.duration,
          phases: finalResult.completedPhases
        });
      } else {
        this.logger.error(`SPARC workflow ${workflowId} failed`, {
          failedPhase: results.failedPhase,
          error: results.error
        });
      }

      return finalResult;

    } catch (error) {
      this.logger.error(`Fatal error in SPARC workflow ${workflowId}`, {
        error: error.message
      });

      return {
        success: false,
        workflowId,
        error: error.message,
        fatal: true
      };
    }
  }

  /**
   * Run single SPARC phase
   * @param {string} phase - SPARC phase name
   * @param {string} taskDescription - Task description
   * @param {Object} options - Phase-specific options
   * @returns {Object} Phase result
   */
  async runSinglePhase(phase, taskDescription, options = {}) {
    if (!this.phases.includes(phase)) {
      return {
        success: false,
        error: `Invalid phase: ${phase}. Valid phases: ${this.phases.join(', ')}`
      };
    }

    const phaseMode = this.config.sparc.modes[phase];
    if (!phaseMode) {
      return {
        success: false,
        error: `No mode configured for phase: ${phase}`
      };
    }

    try {
      this.logger.debug(`Executing SPARC phase: ${phase}`, {
        mode: phaseMode,
        task: taskDescription
      });

      const command = this.buildSparcCommand(phaseMode, taskDescription, options);
      const execOptions = {
        timeout: this.config.sparc.timeoutMs,
        cwd: this.config.automation.workingDirectory,
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      };

      const { stdout, stderr } = await execAsync(command, execOptions);

      // Parse command output
      const result = this.parseCommandOutput(stdout, phase);

      if (stderr && stderr.trim()) {
        this.logger.warn(`SPARC phase ${phase} stderr`, { stderr: stderr.trim() });
        result.warnings = stderr.trim();
      }

      this.logger.debug(`SPARC phase ${phase} completed`, {
        success: result.success,
        artifacts: result.artifacts?.length || 0
      });

      return {
        success: true,
        phase,
        mode: phaseMode,
        command,
        ...result
      };

    } catch (error) {
      this.logger.error(`SPARC phase ${phase} failed`, {
        error: error.message,
        phase,
        mode: phaseMode
      });

      return {
        success: false,
        phase,
        error: error.message,
        timeout: error.code === 'TIMEOUT'
      };
    }
  }

  /**
   * Get workflow status
   * @param {string} workflowId - Workflow ID
   * @returns {Object} Workflow status
   */
  getWorkflowStatus(workflowId) {
    const workflow = this.activeWorkflows.get(workflowId) || 
                     this.completedWorkflows.get(workflowId);

    if (!workflow) {
      return {
        found: false,
        error: `SPARC workflow ${workflowId} not found`
      };
    }

    const completedPhases = workflow.phases.filter(p => p.status === 'completed').length;
    const totalPhases = workflow.phases.length;
    const currentPhase = workflow.phases.find(p => p.status === 'in-progress');
    const progress = Math.round((completedPhases / totalPhases) * 100);

    const status = {
      workflowId,
      taskDescription: workflow.taskDescription,
      status: workflow.status,
      startTime: workflow.startTime,
      endTime: workflow.endTime,
      duration: workflow.duration,
      currentPhase: currentPhase?.name || (workflow.status === 'completed' ? 'completed' : 'unknown'),
      progress,
      completedPhases,
      totalPhases,
      phases: workflow.phases.map(phase => ({
        name: phase.name,
        status: phase.status,
        startTime: phase.startTime,
        endTime: phase.endTime,
        duration: phase.endTime ? phase.endTime - phase.startTime : null,
        artifacts: phase.artifacts,
        error: phase.error
      })),
      parallelExecution: workflow.parallelExecution
    };

    // Calculate estimated completion for active workflows
    if (workflow.status === 'running' && completedPhases > 0) {
      const avgPhaseTime = workflow.phases
        .filter(p => p.status === 'completed' && p.endTime && p.startTime)
        .reduce((sum, p, _, arr) => sum + (p.endTime - p.startTime) / arr.length, 0);

      if (avgPhaseTime > 0) {
        const remainingPhases = totalPhases - completedPhases;
        status.estimatedCompletion = Date.now() + (remainingPhases * avgPhaseTime);
      }
    }

    return status;
  }

  /**
   * Stop active workflow
   * @param {string} workflowId - Workflow ID
   * @returns {Object} Stop result
   */
  async stopWorkflow(workflowId) {
    const workflow = this.activeWorkflows.get(workflowId);
    if (!workflow) {
      return {
        success: false,
        error: `Active SPARC workflow ${workflowId} not found`
      };
    }

    try {
      this.logger.info(`Stopping SPARC workflow ${workflowId}`);

      // Kill any running processes
      if (workflow.processes) {
        workflow.processes.forEach(process => {
          try {
            process.kill('SIGTERM');
          } catch (error) {
            this.logger.warn(`Error killing process in workflow ${workflowId}`, {
              error: error.message
            });
          }
        });
      }

      workflow.status = 'stopped';
      workflow.endTime = Date.now();
      workflow.duration = workflow.endTime - workflow.startTime;

      // Move to completed workflows
      this.completedWorkflows.set(workflowId, workflow);
      this.activeWorkflows.delete(workflowId);

      return {
        success: true,
        workflowId,
        stoppedAt: workflow.endTime
      };

    } catch (error) {
      this.logger.error(`Error stopping SPARC workflow ${workflowId}`, {
        error: error.message
      });

      return {
        success: false,
        workflowId,
        error: error.message
      };
    }
  }

  /**
   * Execute phases in parallel
   * @private
   */
  async executeParallelPhases(workflowId, taskDescription) {
    const workflow = this.activeWorkflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    try {
      // Specification and Pseudocode can run together (same command)
      const specPseudoPromise = this.executePhaseWithTracking(
        workflow, 'specification', taskDescription
      );

      // Architecture runs after spec/pseudo
      const specResult = await specPseudoPromise;
      
      // Update pseudocode phase based on spec result
      const pseudoPhase = workflow.phases.find(p => p.name === 'pseudocode');
      if (specResult.success) {
        pseudoPhase.status = 'completed';
        pseudoPhase.startTime = specResult.startTime;
        pseudoPhase.endTime = specResult.endTime;
        pseudoPhase.artifacts = specResult.artifacts || [];
      } else {
        pseudoPhase.status = 'failed';
        pseudoPhase.error = specResult.error;
      }

      if (!specResult.success) {
        return {
          success: false,
          failedPhase: 'specification',
          error: specResult.error,
          completedPhases: 0
        };
      }

      // Run Architecture, Refinement, and Completion in parallel
      const remainingPhases = ['architecture', 'refinement', 'completion'];
      const phasePromises = remainingPhases.map(phase =>
        this.executePhaseWithTracking(workflow, phase, taskDescription)
      );

      const results = await Promise.allSettled(phasePromises);
      let completedPhases = 2; // spec + pseudo
      let firstFailure = null;

      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.success) {
          completedPhases++;
        } else {
          if (!firstFailure) {
            firstFailure = {
              phase: remainingPhases[index],
              error: result.status === 'fulfilled' ? 
                result.value.error : 
                result.reason.message
            };
          }
        }
      });

      if (firstFailure && completedPhases < this.phases.length) {
        return {
          success: false,
          failedPhase: firstFailure.phase,
          error: firstFailure.error,
          completedPhases
        };
      }

      return {
        success: true,
        completedPhases
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        completedPhases: 0
      };
    }
  }

  /**
   * Execute phases sequentially
   * @private
   */
  async executeSequentialPhases(workflowId, taskDescription) {
    const workflow = this.activeWorkflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    let completedPhases = 0;

    for (const phase of this.phases) {
      try {
        const result = await this.executePhaseWithTracking(workflow, phase, taskDescription);
        
        if (result.success) {
          completedPhases++;
        } else {
          return {
            success: false,
            failedPhase: phase,
            error: result.error,
            completedPhases
          };
        }

      } catch (error) {
        return {
          success: false,
          failedPhase: phase,
          error: error.message,
          completedPhases
        };
      }
    }

    return {
      success: true,
      completedPhases
    };
  }

  /**
   * Execute phase with workflow tracking
   * @private
   */
  async executePhaseWithTracking(workflow, phaseName, taskDescription) {
    const phase = workflow.phases.find(p => p.name === phaseName);
    if (!phase) {
      throw new Error(`Phase ${phaseName} not found in workflow`);
    }

    phase.status = 'in-progress';
    phase.startTime = Date.now();

    try {
      // Execute with retry logic
      const result = await this.executeWithRetry(
        () => this.runSinglePhase(phaseName, taskDescription),
        `SPARC phase ${phaseName}`
      );

      if (result.success) {
        phase.status = 'completed';
        phase.artifacts = result.artifacts || [];
        phase.output = result.output;
        phase.metrics = result.metrics;
      } else {
        phase.status = 'failed';
        phase.error = result.error;
      }

      phase.endTime = Date.now();
      return {
        success: result.success,
        error: result.error,
        startTime: phase.startTime,
        endTime: phase.endTime,
        artifacts: result.artifacts
      };

    } catch (error) {
      phase.status = 'failed';
      phase.error = error.message;
      phase.endTime = Date.now();

      throw error;
    }
  }

  /**
   * Build SPARC command
   * @private
   */
  buildSparcCommand(mode, taskDescription, options = {}) {
    const baseCommand = `npx claude-flow sparc run ${mode}`;
    const quotedTask = `"${taskDescription.replace(/"/g, '\\"')}"`;
    
    let command = `${baseCommand} ${quotedTask}`;

    // Add additional options
    if (options.parallel && this.config.sparc.enableParallelProcessing) {
      command += ' --parallel';
    }
    if (options.output) {
      command += ` --output "${options.output}"`;
    }
    if (options.format) {
      command += ` --format ${options.format}`;
    }

    return command;
  }

  /**
   * Parse command output
   * @private
   */
  parseCommandOutput(stdout, phase) {
    try {
      // Try to parse as JSON first
      const jsonOutput = JSON.parse(stdout);
      return {
        success: jsonOutput.success !== false,
        output: jsonOutput.output || stdout,
        artifacts: jsonOutput.artifacts || [],
        metrics: jsonOutput.metrics,
        nextSteps: jsonOutput.nextSteps
      };
    } catch (error) {
      // Fallback to plain text parsing
      const lines = stdout.split('\n').filter(line => line.trim());
      
      return {
        success: !stdout.toLowerCase().includes('error') && 
                !stdout.toLowerCase().includes('failed'),
        output: stdout,
        artifacts: this.extractArtifactsFromOutput(stdout),
        summary: lines.slice(0, 3).join(' ')
      };
    }
  }

  /**
   * Extract artifacts from command output
   * @private
   */
  extractArtifactsFromOutput(output) {
    const artifacts = [];
    
    // Look for file paths in output
    const filePatterns = [
      /Created:\s*([^\s]+\.\w+)/g,
      /Generated:\s*([^\s]+\.\w+)/g,
      /Output:\s*([^\s]+\.\w+)/g,
      /File:\s*([^\s]+\.\w+)/g
    ];

    filePatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(output)) !== null) {
        artifacts.push(match[1]);
      }
    });

    return artifacts;
  }

  /**
   * Collect all artifacts from phases
   * @private
   */
  collectArtifacts(phases) {
    const artifactsByPhase = {};
    
    phases.forEach(phase => {
      if (phase.artifacts && phase.artifacts.length > 0) {
        artifactsByPhase[phase.name] = phase.artifacts;
      }
    });

    return artifactsByPhase;
  }

  /**
   * Execute with retry logic
   * @private
   */
  async executeWithRetry(fn, operation) {
    const maxRetries = this.config.automation.retryAttempts;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
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
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  /**
   * Batch process multiple tasks
   */
  async batchProcess(tasks, options = {}) {
    this.logger.info(`Starting batch SPARC processing for ${tasks.length} tasks`);

    const results = [];
    const errors = [];

    for (const [index, task] of tasks.entries()) {
      try {
        this.logger.info(`Processing batch task ${index + 1}/${tasks.length}: ${task}`);
        const result = await this.runSparcWorkflow(task, options);
        results.push(result);

        if (!result.success) {
          errors.push({ index, task, error: result.error });
        }

      } catch (error) {
        this.logger.error(`Batch task ${index + 1} failed`, { error: error.message });
        errors.push({ index, task, error: error.message });
      }
    }

    const successfulTasks = results.filter(r => r.success).length;
    const failedTasks = errors.length;

    return {
      success: failedTasks === 0,
      processedTasks: tasks.length,
      successfulTasks,
      failedTasks,
      results,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Organize artifacts by phase
   */
  organizeArtifacts(phaseResults) {
    const organized = {};

    phaseResults.forEach(result => {
      if (result.phase && result.artifacts) {
        organized[result.phase] = result.artifacts;
      }
    });

    return organized;
  }

  /**
   * Validate artifact completeness
   */
  validateArtifacts(artifacts) {
    const requiredPhases = this.phases;
    const missingArtifacts = [];
    let totalArtifacts = 0;
    let presentArtifacts = 0;

    requiredPhases.forEach(phase => {
      const phaseArtifacts = artifacts[phase] || [];
      totalArtifacts++;
      
      if (phaseArtifacts.length > 0) {
        presentArtifacts++;
      } else {
        missingArtifacts.push(phase);
      }
    });

    return {
      isComplete: missingArtifacts.length === 0,
      completeness: (presentArtifacts / totalArtifacts) * 100,
      missingArtifacts,
      totalPhases: totalArtifacts,
      completedPhases: presentArtifacts
    };
  }
}

module.exports = { SparcAutomator };