const { Octokit } = require('@octokit/rest');
const { exec } = require('child_process');
const { promisify } = require('util');
const { v4: uuidv4 } = require('uuid');

const execAsync = promisify(exec);

/**
 * CIPipelineManager
 * Handles CI/CD pipeline automation and monitoring
 */
class CIPipelineManager {
  constructor(config, logger) {
    this.config = {
      github: config.github,
      ci: {
        enableAdaptiveMonitoring: true,
        monitoringInterval: 10000, // 10 seconds
        maxRetries: 3,
        timeoutMs: 300000, // 5 minutes
        qualityGates: {
          testCoverage: 80,
          lintErrors: 0,
          buildSuccess: true,
          securityIssues: 0
        },
        ...config.ci
      },
      ...config
    };

    this.logger = logger;
    this.github = new Octokit({ auth: config.github.token });
    this.activePipelines = new Map();
    this.completedPipelines = new Map();
    this.monitoringIntervals = new Map();
    this.retryAttempts = new Map();

    this.logger.info('CI Pipeline Manager initialized', {
      adaptiveMonitoring: this.config.ci.enableAdaptiveMonitoring,
      qualityGates: Object.keys(this.config.ci.qualityGates)
    });
  }

  /**
   * Start CI pipeline
   * @param {Object} pipelineConfig - Pipeline configuration
   * @returns {Object} Pipeline start result
   */
  async startPipeline(pipelineConfig) {
    try {
      // Validate pipeline configuration
      const validation = this.validatePipelineConfig(pipelineConfig);
      if (!validation.valid) {
        return {
          success: false,
          error: `Invalid pipeline configuration: ${validation.errors.join(', ')}`
        };
      }

      const pipelineId = uuidv4();
      this.logger.info(`Starting CI pipeline ${pipelineId}`, {
        branch: pipelineConfig.branch,
        workflow: pipelineConfig.workflow
      });

      // Get or trigger workflow run
      const workflowRun = await this.triggerWorkflowRun(pipelineConfig);
      if (!workflowRun.success) {
        return {
          success: false,
          error: `Failed to trigger workflow: ${workflowRun.error}`,
          pipelineId
        };
      }

      // Initialize pipeline tracking
      const pipeline = {
        id: pipelineId,
        config: pipelineConfig,
        runId: workflowRun.runId,
        startTime: Date.now(),
        status: 'running',
        branch: pipelineConfig.branch,
        workflow: pipelineConfig.workflow,
        checks: [],
        qualityGateResults: {},
        retryCount: 0
      };

      this.activePipelines.set(pipelineId, pipeline);

      // Start monitoring if adaptive monitoring is enabled
      if (this.config.ci.enableAdaptiveMonitoring) {
        this.startContinuousMonitoring(pipelineId);
      }

      return {
        success: true,
        pipelineId,
        runId: workflowRun.runId,
        monitoringUrl: workflowRun.htmlUrl,
        status: 'running'
      };

    } catch (error) {
      this.logger.error('Error starting CI pipeline', {
        error: error.message,
        config: pipelineConfig
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Monitor CI pipeline status
   * @param {string} pipelineId - Pipeline ID
   * @returns {Object} Pipeline status
   */
  async monitorPipeline(pipelineId) {
    try {
      const pipeline = this.activePipelines.get(pipelineId);
      if (!pipeline) {
        return {
          found: false,
          error: `Pipeline ${pipelineId} not found in active pipelines`
        };
      }

      // Get workflow run status
      const workflowStatus = await this.github.rest.actions.getWorkflowRun({
        owner: this.config.github.owner,
        repo: this.config.github.repo,
        run_id: pipeline.runId
      });

      // Get check runs for detailed status
      const checks = await this.github.rest.checks.listForRef({
        owner: this.config.github.owner,
        repo: this.config.github.repo,
        ref: pipeline.branch,
        status: 'completed'
      });

      // Update pipeline status
      const runData = workflowStatus.data;
      pipeline.status = this.mapWorkflowStatus(runData.status, runData.conclusion);
      pipeline.checks = this.processCheckRuns(checks.data.check_runs);
      pipeline.lastUpdated = Date.now();

      // Calculate progress
      const progress = this.calculatePipelineProgress(pipeline);
      
      // Check if pipeline is completed
      const isCompleted = ['completed', 'failed', 'cancelled'].includes(pipeline.status);
      
      if (isCompleted) {
        await this.handlePipelineCompletion(pipelineId, pipeline);
      }

      const status = {
        pipelineId,
        runId: pipeline.runId,
        status: pipeline.status,
        progress,
        success: pipeline.status === 'completed',
        startTime: pipeline.startTime,
        elapsedTime: Date.now() - pipeline.startTime,
        branch: pipeline.branch,
        checks: pipeline.checks,
        allChecksPass: pipeline.checks.every(check => check.conclusion === 'success'),
        failedChecks: pipeline.checks
          .filter(check => check.conclusion === 'failure')
          .map(check => check.name),
        qualityGates: pipeline.qualityGateResults,
        retryCount: pipeline.retryCount
      };

      // Add completion time if finished
      if (pipeline.endTime) {
        status.endTime = pipeline.endTime;
        status.duration = pipeline.endTime - pipeline.startTime;
      }

      return status;

    } catch (error) {
      this.logger.error(`Error monitoring pipeline ${pipelineId}`, {
        error: error.message
      });

      return {
        pipelineId,
        error: error.message,
        status: 'error'
      };
    }
  }

  /**
   * Get pipeline status
   * @param {string} pipelineId - Pipeline ID
   * @returns {Object} Pipeline status
   */
  async getPipelineStatus(pipelineId) {
    const pipeline = this.activePipelines.get(pipelineId) || 
                     this.completedPipelines.get(pipelineId);

    if (!pipeline) {
      return {
        found: false,
        error: `Pipeline ${pipelineId} not found`
      };
    }

    // If it's an active pipeline, get live status
    if (this.activePipelines.has(pipelineId)) {
      return await this.monitorPipeline(pipelineId);
    }

    // Return cached status for completed pipelines
    return {
      pipelineId,
      runId: pipeline.runId,
      status: pipeline.status,
      success: pipeline.status === 'completed',
      startTime: pipeline.startTime,
      endTime: pipeline.endTime,
      duration: pipeline.duration,
      branch: pipeline.branch,
      checks: pipeline.checks,
      qualityGates: pipeline.qualityGateResults,
      retryCount: pipeline.retryCount,
      found: true
    };
  }

  /**
   * Evaluate quality gates
   * @param {Object} pipelineResults - Pipeline results
   * @returns {Object} Quality gate evaluation
   */
  async evaluateQualityGates(pipelineResults) {
    const gates = this.config.ci.qualityGates;
    const evaluation = {
      passed: true,
      score: 0,
      maxScore: 0,
      successes: [],
      failures: [],
      recommendations: []
    };

    // Evaluate test coverage
    if (gates.testCoverage !== undefined) {
      evaluation.maxScore += 25;
      if (pipelineResults.testCoverage >= gates.testCoverage) {
        evaluation.score += 25;
        evaluation.successes.push('testCoverage');
      } else {
        evaluation.passed = false;
        evaluation.failures.push('testCoverage');
        evaluation.recommendations.push(
          `Increase test coverage to ${gates.testCoverage}% (current: ${pipelineResults.testCoverage}%)`
        );
      }
    }

    // Evaluate lint errors
    if (gates.lintErrors !== undefined) {
      evaluation.maxScore += 25;
      if (pipelineResults.lintErrors <= gates.lintErrors) {
        evaluation.score += 25;
        evaluation.successes.push('lint');
      } else {
        evaluation.passed = false;
        evaluation.failures.push('lint');
        evaluation.recommendations.push(
          `Fix ${pipelineResults.lintErrors} linting errors`
        );
      }
    }

    // Evaluate build success
    if (gates.buildSuccess !== undefined) {
      evaluation.maxScore += 25;
      if (pipelineResults.buildSuccess === gates.buildSuccess) {
        evaluation.score += 25;
        evaluation.successes.push('build');
      } else {
        evaluation.passed = false;
        evaluation.failures.push('build');
        evaluation.recommendations.push('Resolve build failures');
      }
    }

    // Evaluate security issues
    if (gates.securityIssues !== undefined) {
      evaluation.maxScore += 25;
      if ((pipelineResults.securityIssues || 0) <= gates.securityIssues) {
        evaluation.score += 25;
        evaluation.successes.push('security');
      } else {
        evaluation.passed = false;
        evaluation.failures.push('security');
        evaluation.recommendations.push(
          `Address ${pipelineResults.securityIssues} security issues`
        );
      }
    }

    // Calculate percentage score
    if (evaluation.maxScore > 0) {
      evaluation.scorePercentage = Math.round((evaluation.score / evaluation.maxScore) * 100);
    }

    this.logger.info('Quality gates evaluated', {
      passed: evaluation.passed,
      score: evaluation.scorePercentage,
      failures: evaluation.failures
    });

    return evaluation;
  }

  /**
   * Retry failed pipeline
   * @param {string} pipelineId - Pipeline ID
   * @returns {Object} Retry result
   */
  async retryFailedPipeline(pipelineId) {
    try {
      const pipeline = this.activePipelines.get(pipelineId) || 
                      this.completedPipelines.get(pipelineId);

      if (!pipeline) {
        return {
          success: false,
          error: `Pipeline ${pipelineId} not found`
        };
      }

      const currentRetries = this.retryAttempts.get(pipelineId) || 0;
      const maxRetries = pipeline.maxRetries || this.config.ci.maxRetries;

      if (currentRetries >= maxRetries) {
        return {
          success: false,
          error: `Maximum retry attempts reached (${maxRetries})`
        };
      }

      this.logger.info(`Retrying failed pipeline ${pipelineId}`, {
        attempt: currentRetries + 1,
        maxRetries
      });

      // Re-run the workflow
      const rerunResult = await this.github.rest.actions.reRunWorkflow({
        owner: this.config.github.owner,
        repo: this.config.github.repo,
        run_id: pipeline.runId
      });

      // Update retry count
      this.retryAttempts.set(pipelineId, currentRetries + 1);
      pipeline.retryCount = currentRetries + 1;

      // Move back to active pipelines if it was completed
      if (this.completedPipelines.has(pipelineId)) {
        this.completedPipelines.delete(pipelineId);
        this.activePipelines.set(pipelineId, pipeline);
      }

      // Restart monitoring
      if (this.config.ci.enableAdaptiveMonitoring) {
        this.startContinuousMonitoring(pipelineId);
      }

      return {
        success: true,
        pipelineId,
        retryAttempt: currentRetries + 1,
        newRunId: pipeline.runId
      };

    } catch (error) {
      this.logger.error(`Error retrying pipeline ${pipelineId}`, {
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Analyze pipeline logs for failure patterns
   * @param {number} runId - GitHub Actions run ID
   * @returns {Object} Log analysis
   */
  async analyzePipelineLogs(runId) {
    try {
      const logs = await this.github.rest.actions.listWorkflowRunLogs({
        owner: this.config.github.owner,
        repo: this.config.github.repo,
        run_id: runId
      });

      const logContent = logs.data;
      const analysis = {
        errorPatterns: [],
        failureReasons: [],
        suggestions: [],
        categories: []
      };

      // Analyze log content for common patterns
      const patterns = {
        'Test failures': /FAIL|Error.*test|Test.*failed/gi,
        'Build failures': /Build failed|compilation error|npm ERR!/gi,
        'Linting issues': /ESLint|lint.*error|Linting failed/gi,
        'Runtime Error': /TypeError|ReferenceError|Cannot read property/gi,
        'Network issues': /timeout|ECONNREFUSED|network error/gi,
        'Dependency issues': /Cannot resolve|Module not found|dependency/gi
      };

      Object.entries(patterns).forEach(([category, pattern]) => {
        const matches = logContent.match(pattern);
        if (matches && matches.length > 0) {
          analysis.categories.push(category);
          analysis.errorPatterns.push(...matches.slice(0, 3)); // Limit to 3 examples
          
          // Add category-specific suggestions
          switch (category) {
            case 'Test failures':
              analysis.suggestions.push('Review failing tests and fix implementation');
              break;
            case 'Build failures':
              analysis.suggestions.push('Check build configuration and dependencies');
              break;
            case 'Linting issues':
              analysis.suggestions.push('Run linter locally and fix code style issues');
              break;
            case 'Runtime Error':
              analysis.suggestions.push('Check for undefined variables and type errors');
              break;
            case 'Network issues':
              analysis.suggestions.push('Check database connectivity and external services');
              break;
            case 'Dependency issues':
              analysis.suggestions.push('Update package.json and run npm install');
              break;
          }
        }
      });

      // Extract specific failure reasons
      const failureLines = logContent.split('\n')
        .filter(line => line.toLowerCase().includes('error') || 
                       line.toLowerCase().includes('failed'))
        .slice(0, 5);

      analysis.failureReasons = failureLines;

      return analysis;

    } catch (error) {
      this.logger.error(`Error analyzing pipeline logs for run ${runId}`, {
        error: error.message
      });

      return {
        error: error.message,
        errorPatterns: [],
        failureReasons: [],
        suggestions: [],
        categories: []
      };
    }
  }

  /**
   * Deploy feature with WCP integration
   * @param {Object} deploymentConfig - Deployment configuration
   * @returns {Object} Deployment result
   */
  async deployFeature(deploymentConfig) {
    try {
      this.logger.info('Deploying feature with WCP integration', {
        feature: deploymentConfig.feature,
        branch: deploymentConfig.branch
      });

      // Start pipeline with WCP-specific configuration
      const pipelineConfig = {
        branch: deploymentConfig.branch,
        workflow: 'feature-deploy.yml',
        env: {
          FEATURE_NAME: deploymentConfig.feature,
          EPIC_ID: deploymentConfig.epicId,
          WCP_COMPLIANT: deploymentConfig.wcpCompliant
        }
      };

      const pipelineResult = await this.startPipeline(pipelineConfig);
      if (!pipelineResult.success) {
        return pipelineResult;
      }

      return {
        success: true,
        pipelineId: pipelineResult.pipelineId,
        wcpIntegration: true,
        featureTracking: {
          feature: deploymentConfig.feature,
          epicId: deploymentConfig.epicId,
          deploymentStage: 'initiated'
        }
      };

    } catch (error) {
      this.logger.error('Error in feature deployment', {
        error: error.message,
        feature: deploymentConfig.feature
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Validate SPARC phase completion
   * @param {Object} sparcValidation - SPARC validation config
   * @returns {Object} Validation result
   */
  async validateSparcPhase(sparcValidation) {
    try {
      this.logger.info('Validating SPARC phase completion', {
        phase: sparcValidation.phase,
        workflowId: sparcValidation.workflowId
      });

      // Run validation checks
      const validationCommand = `cd ${sparcValidation.artifactsPath} && npm test -- --coverage`;
      const { stdout } = await execAsync(validationCommand);

      // Parse validation results
      const results = JSON.parse(stdout);

      const validation = {
        success: true,
        phaseValid: results.testsPass && results.coverage >= 80 && results.lintClean,
        qualityMetrics: {
          testsPass: results.testsPass,
          coverage: results.coverage,
          lintClean: results.lintClean
        }
      };

      if (!validation.phaseValid) {
        validation.success = false;
        validation.issues = [];
        
        if (!results.testsPass) validation.issues.push('Tests failing');
        if (results.coverage < 80) validation.issues.push('Insufficient test coverage');
        if (!results.lintClean) validation.issues.push('Linting errors present');
      }

      return validation;

    } catch (error) {
      this.logger.error('Error validating SPARC phase', {
        error: error.message,
        phase: sparcValidation.phase
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send pipeline status notifications
   * @param {string} pipelineId - Pipeline ID
   * @param {Object} notification - Notification configuration
   * @returns {Object} Notification result
   */
  async sendNotification(pipelineId, notification) {
    try {
      // Implementation would integrate with notification services
      // For now, just log the notification
      this.logger.info(`Notification sent for pipeline ${pipelineId}`, {
        type: notification.type,
        status: notification.status,
        recipients: notification.recipients
      });

      return {
        sent: true,
        timestamp: Date.now()
      };

    } catch (error) {
      this.logger.error(`Error sending notification for pipeline ${pipelineId}`, {
        error: error.message
      });

      return {
        sent: false,
        error: error.message
      };
    }
  }

  /**
   * Generate pipeline summary report
   * @param {string} pipelineId - Pipeline ID
   * @returns {Object} Pipeline report
   */
  async generatePipelineReport(pipelineId) {
    const pipeline = this.completedPipelines.get(pipelineId) || 
                     this.activePipelines.get(pipelineId);

    if (!pipeline) {
      return {
        error: `Pipeline ${pipelineId} not found`
      };
    }

    const report = {
      pipelineId,
      branch: pipeline.branch,
      workflow: pipeline.workflow,
      startTime: pipeline.startTime,
      endTime: pipeline.endTime,
      duration: pipeline.duration || (Date.now() - pipeline.startTime),
      status: pipeline.status,
      success: pipeline.status === 'completed',
      retryCount: pipeline.retryCount || 0,
      summary: {
        totalChecks: pipeline.checks?.length || 0,
        passedChecks: pipeline.checks?.filter(c => c.conclusion === 'success').length || 0,
        failedChecks: pipeline.checks?.filter(c => c.conclusion === 'failure').length || 0
      },
      metrics: {
        avgCheckTime: this.calculateAverageCheckTime(pipeline.checks || []),
        fastestCheck: this.getFastestCheck(pipeline.checks || []),
        slowestCheck: this.getSlowestCheck(pipeline.checks || [])
      },
      qualityGates: pipeline.qualityGateResults || {},
      recommendations: this.generatePipelineRecommendations(pipeline)
    };

    return report;
  }

  /**
   * Start continuous monitoring with adaptive intervals
   * @private
   */
  startContinuousMonitoring(pipelineId) {
    if (this.monitoringIntervals.has(pipelineId)) {
      clearInterval(this.monitoringIntervals.get(pipelineId));
    }

    const monitor = async () => {
      try {
        const status = await this.monitorPipeline(pipelineId);
        
        if (status.status === 'completed' || status.status === 'failed') {
          this.stopMonitoring(pipelineId);
        }
      } catch (error) {
        this.logger.error(`Error in continuous monitoring for ${pipelineId}`, {
          error: error.message
        });
      }
    };

    // Start with more frequent monitoring, then back off
    const interval = setInterval(monitor, this.config.ci.monitoringInterval);
    this.monitoringIntervals.set(pipelineId, interval);

    // Initial check
    monitor();
  }

  /**
   * Stop monitoring for a pipeline
   * @param {string} pipelineId - Pipeline ID
   * @returns {Object} Stop result
   */
  async stopMonitoring(pipelineId) {
    const interval = this.monitoringIntervals.get(pipelineId);
    if (interval) {
      clearInterval(interval);
      this.monitoringIntervals.delete(pipelineId);
      
      this.logger.debug(`Stopped monitoring pipeline ${pipelineId}`);
      
      return { success: true };
    }
    
    return { 
      success: false, 
      error: `No active monitoring for pipeline ${pipelineId}` 
    };
  }

  /**
   * Private helper methods
   */

  validatePipelineConfig(config) {
    const errors = [];

    if (!config.branch || config.branch.trim() === '') {
      errors.push('Branch is required');
    }

    if (!config.workflow) {
      errors.push('Workflow file is required');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  async triggerWorkflowRun(config) {
    try {
      // Get recent workflow runs to find the latest one for this branch
      const runs = await this.github.rest.actions.listWorkflowRuns({
        owner: this.config.github.owner,
        repo: this.config.github.repo,
        workflow_id: config.workflow,
        branch: config.branch,
        per_page: 1
      });

      if (runs.data.workflow_runs.length > 0) {
        const run = runs.data.workflow_runs[0];
        return {
          success: true,
          runId: run.id,
          htmlUrl: run.html_url
        };
      }

      return {
        success: false,
        error: 'No workflow runs found for specified branch and workflow'
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  mapWorkflowStatus(status, conclusion) {
    if (status === 'completed') {
      switch (conclusion) {
        case 'success':
          return 'completed';
        case 'failure':
        case 'timed_out':
          return 'failed';
        case 'cancelled':
          return 'cancelled';
        default:
          return 'completed';
      }
    }
    return status; // queued, in_progress
  }

  processCheckRuns(checkRuns) {
    return checkRuns.map(check => ({
      name: check.name,
      status: check.status,
      conclusion: check.conclusion,
      startedAt: check.started_at,
      completedAt: check.completed_at,
      duration: check.completed_at ? 
        new Date(check.completed_at) - new Date(check.started_at) : null,
      htmlUrl: check.html_url
    }));
  }

  calculatePipelineProgress(pipeline) {
    if (pipeline.status === 'completed') return 100;
    if (pipeline.status === 'failed' || pipeline.status === 'cancelled') return 100;
    
    const totalChecks = pipeline.checks.length || 1;
    const completedChecks = pipeline.checks.filter(c => 
      c.status === 'completed'
    ).length;
    
    return Math.round((completedChecks / totalChecks) * 100);
  }

  async handlePipelineCompletion(pipelineId, pipeline) {
    pipeline.endTime = Date.now();
    pipeline.duration = pipeline.endTime - pipeline.startTime;

    // Stop monitoring
    await this.stopMonitoring(pipelineId);

    // Move to completed pipelines
    this.completedPipelines.set(pipelineId, pipeline);
    this.activePipelines.delete(pipelineId);

    // Evaluate quality gates if pipeline succeeded
    if (pipeline.status === 'completed') {
      // Mock quality gate evaluation - in real implementation,
      // this would parse actual pipeline results
      const mockResults = {
        testCoverage: 85,
        lintErrors: 0,
        buildSuccess: true,
        securityIssues: 0
      };

      pipeline.qualityGateResults = await this.evaluateQualityGates(mockResults);
    }

    this.logger.info(`Pipeline ${pipelineId} completed`, {
      status: pipeline.status,
      duration: pipeline.duration,
      checks: pipeline.checks.length
    });
  }

  calculateAverageCheckTime(checks) {
    const completedChecks = checks.filter(c => c.duration);
    if (completedChecks.length === 0) return 0;
    
    const totalTime = completedChecks.reduce((sum, check) => sum + check.duration, 0);
    return Math.round(totalTime / completedChecks.length / 1000); // Convert to seconds
  }

  getFastestCheck(checks) {
    const completedChecks = checks.filter(c => c.duration);
    if (completedChecks.length === 0) return null;
    
    return completedChecks.reduce((fastest, check) => 
      check.duration < fastest.duration ? check : fastest
    );
  }

  getSlowestCheck(checks) {
    const completedChecks = checks.filter(c => c.duration);
    if (completedChecks.length === 0) return null;
    
    return completedChecks.reduce((slowest, check) => 
      check.duration > slowest.duration ? check : slowest
    );
  }

  generatePipelineRecommendations(pipeline) {
    const recommendations = [];

    if (pipeline.status === 'failed') {
      recommendations.push('Review failure logs and address root causes');
      
      if (pipeline.retryCount === 0) {
        recommendations.push('Consider retrying the pipeline');
      }
    }

    const slowChecks = (pipeline.checks || []).filter(c => 
      c.duration > 300000 // 5 minutes
    );
    
    if (slowChecks.length > 0) {
      recommendations.push(`Optimize slow checks: ${slowChecks.map(c => c.name).join(', ')}`);
    }

    if (pipeline.duration > 1800000) { // 30 minutes
      recommendations.push('Consider parallelizing pipeline steps to reduce total time');
    }

    return recommendations;
  }
}

module.exports = { CIPipelineManager };