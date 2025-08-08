/**
 * YOLO-WARP Automation Engine
 * Main entry point for the automation system
 */

// Core Components
const { YoloWarpEngine } = require('./core/YoloWarpEngine');
const { AutomationConfig } = require('./config/AutomationConfig');

// Processors
const { MilestoneProcessor } = require('./processors/MilestoneProcessor');
const { SparcAutomator } = require('./processors/SparcAutomator');

// Managers
const { WCPManager } = require('./managers/WCPManager');
const { CIPipelineManager } = require('./managers/CIPipelineManager');

// Reporters
const { ProgressReporter } = require('./reporters/ProgressReporter');

/**
 * Create a fully configured automation engine
 * @param {Object} userConfig - User configuration
 * @param {Object} logger - Logger instance
 * @returns {YoloWarpEngine} Configured automation engine
 */
function createAutomationEngine(userConfig = {}, logger = console) {
  const config = new AutomationConfig(userConfig);
  return new YoloWarpEngine(config.get(), logger);
}

/**
 * Create automation engine from configuration file
 * @param {string} configPath - Path to configuration file
 * @param {Object} logger - Logger instance
 * @returns {YoloWarpEngine} Configured automation engine
 */
function createEngineFromConfig(configPath, logger = console) {
  const config = AutomationConfig.fromFile(configPath);
  return new YoloWarpEngine(config.get(), logger);
}

/**
 * Create automation engine with preset configuration
 * @param {string} preset - Preset name ('small', 'enterprise', 'cicd')
 * @param {Object} additionalConfig - Additional configuration
 * @param {Object} logger - Logger instance
 * @returns {YoloWarpEngine} Configured automation engine
 */
function createEngineWithPreset(preset, additionalConfig = {}, logger = console) {
  const presetConfig = AutomationConfig.createPresetConfig(preset);
  const mergedConfig = { ...presetConfig, ...additionalConfig };
  const config = new AutomationConfig(mergedConfig);
  return new YoloWarpEngine(config.get(), logger);
}

/**
 * Create automation engine for specific environment
 * @param {string} environment - Environment name ('development', 'testing', 'staging', 'production')
 * @param {Object} additionalConfig - Additional configuration
 * @param {Object} logger - Logger instance
 * @returns {YoloWarpEngine} Configured automation engine
 */
function createEngineForEnvironment(environment, additionalConfig = {}, logger = console) {
  const envConfig = AutomationConfig.getEnvironmentConfig(environment);
  const mergedConfig = { ...envConfig, ...additionalConfig };
  const config = new AutomationConfig(mergedConfig);
  return new YoloWarpEngine(config.get(), logger);
}

/**
 * Utility functions for automation workflows
 */
const utils = {
  /**
   * Validate workflow specification
   * @param {Object} workflowSpec - Workflow specification
   * @returns {Object} Validation result
   */
  validateWorkflowSpec(workflowSpec) {
    const errors = [];

    if (!workflowSpec.milestoneId && !workflowSpec.epicTitle) {
      errors.push('Either milestoneId or epicTitle is required');
    }

    if (workflowSpec.sparcEnabled && !workflowSpec.sparcTaskDescription && !workflowSpec.epicTitle) {
      errors.push('SPARC workflow requires task description or epic title');
    }

    if (workflowSpec.ciEnabled && !workflowSpec.branch) {
      errors.push('CI pipeline requires branch specification');
    }

    if (workflowSpec.features && !Array.isArray(workflowSpec.features)) {
      errors.push('Features must be an array');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  },

  /**
   * Generate workflow specification from milestone
   * @param {Object} milestoneData - Milestone data from GitHub
   * @param {Object} options - Generation options
   * @returns {Object} Generated workflow specification
   */
  generateWorkflowSpecFromMilestone(milestoneData, options = {}) {
    return {
      milestoneId: milestoneData.number,
      epicTitle: milestoneData.title,
      businessObjective: milestoneData.description,
      sparcEnabled: options.enableSparc !== false,
      wcpEnabled: options.enableWcp !== false,
      ciEnabled: options.enableCi !== false,
      branch: options.branch || `milestone-${milestoneData.number}`,
      features: options.features || [],
      qualityGates: options.qualityGates || {},
      allowPartialFailure: options.allowPartialFailure || false
    };
  },

  /**
   * Create feature specification from requirements
   * @param {string} name - Feature name
   * @param {Array} requirements - Requirements list
   * @param {Object} options - Feature options
   * @returns {Object} Feature specification
   */
  createFeatureSpec(name, requirements = [], options = {}) {
    return {
      name,
      description: options.description || `Implement ${name}`,
      acceptanceCriteria: requirements,
      subTasks: options.subTasks || requirements.map((req, index) => ({
        title: req,
        estimate: options.defaultEstimate || 3
      })),
      epicNumber: options.epicNumber,
      assignees: options.assignees || [],
      labels: options.labels || []
    };
  },

  /**
   * Parse automation results for reporting
   * @param {Object} result - Automation result
   * @returns {Object} Parsed results
   */
  parseAutomationResults(result) {
    const summary = {
      success: result.success,
      workflowId: result.workflowId,
      duration: result.duration,
      completedComponents: result.completedComponents || [],
      failedComponents: result.failedComponents || [],
      partialSuccess: result.partialSuccess || false
    };

    // Component-specific results
    if (result.components) {
      summary.components = {
        milestone: result.components.milestone?.success || false,
        sparc: result.components.sparc?.success || false,
        wcp: result.components.wcp?.success || false,
        ci: result.components.ci?.success || false
      };
    }

    return summary;
  }
};

/**
 * Constants and enums
 */
const constants = {
  // Workflow statuses
  WORKFLOW_STATUS: {
    PENDING: 'pending',
    RUNNING: 'running',
    COMPLETED: 'completed',
    FAILED: 'failed',
    STOPPED: 'stopped'
  },

  // Component types
  COMPONENT_TYPES: {
    MILESTONE: 'milestone',
    SPARC: 'sparc',
    WCP: 'wcp',
    CI: 'ci',
    PROGRESS: 'progress'
  },

  // SPARC phases
  SPARC_PHASES: {
    SPECIFICATION: 'specification',
    PSEUDOCODE: 'pseudocode',
    ARCHITECTURE: 'architecture',
    REFINEMENT: 'refinement',
    COMPLETION: 'completion'
  },

  // WCP limits
  WCP_LIMITS: {
    MAX_FEATURES_PER_EPIC: 7,
    MAX_ISSUES_PER_FEATURE: 3,
    MIN_FEATURE_SIZE: 1,
    MAX_EPIC_COMPLEXITY: 20
  },

  // Error types
  ERROR_TYPES: {
    CONFIGURATION: 'ConfigurationError',
    VALIDATION: 'ValidationError',
    INTEGRATION: 'IntegrationError',
    WORKFLOW: 'WorkflowError',
    TIMEOUT: 'TimeoutError'
  }
};

module.exports = {
  // Core exports
  YoloWarpEngine,
  AutomationConfig,

  // Component exports
  MilestoneProcessor,
  SparcAutomator,
  WCPManager,
  CIPipelineManager,
  ProgressReporter,

  // Factory functions
  createAutomationEngine,
  createEngineFromConfig,
  createEngineWithPreset,
  createEngineForEnvironment,

  // Utilities
  utils,
  constants
};