/**
 * YOLO-WARP Automation Engine Configuration
 * Centralized configuration management for all automation components
 */

const path = require('path');
const fs = require('fs');

class AutomationConfig {
  constructor(userConfig = {}) {
    this.config = this.mergeConfigs(this.getDefaultConfig(), userConfig);
    this.validateConfig();
  }

  /**
   * Get default configuration
   * @returns {Object} Default configuration
   */
  getDefaultConfig() {
    return {
      // GitHub Integration
      github: {
        owner: process.env.GITHUB_OWNER || '',
        repo: process.env.GITHUB_REPO || '',
        token: process.env.GITHUB_TOKEN || '',
        apiUrl: process.env.GITHUB_API_URL || 'https://api.github.com'
      },

      // Automation Engine Settings
      automation: {
        workingDirectory: process.cwd(),
        maxConcurrentTasks: parseInt(process.env.MAX_CONCURRENT_TASKS) || 5,
        retryAttempts: parseInt(process.env.RETRY_ATTEMPTS) || 3,
        monitoringInterval: parseInt(process.env.MONITORING_INTERVAL) || 5000,
        retentionDays: parseInt(process.env.RETENTION_DAYS) || 7,
        enableErrorRecovery: process.env.ENABLE_ERROR_RECOVERY !== 'false',
        logLevel: process.env.LOG_LEVEL || 'info'
      },

      // SPARC Configuration
      sparc: {
        enableParallelProcessing: process.env.SPARC_PARALLEL !== 'false',
        timeoutMs: parseInt(process.env.SPARC_TIMEOUT) || 60000,
        modes: {
          specification: 'spec-pseudocode',
          pseudocode: 'spec-pseudocode',
          architecture: 'architect',
          refinement: 'tdd',
          completion: 'integration'
        },
        artifactsPath: process.env.SPARC_ARTIFACTS_PATH || './sparc-artifacts',
        enableArtifactValidation: process.env.SPARC_VALIDATE_ARTIFACTS !== 'false'
      },

      // Work Chunking Protocol (WCP) Settings
      wcp: {
        maxFeaturesPerEpic: parseInt(process.env.WCP_MAX_FEATURES) || 7,
        maxIssuesPerFeature: parseInt(process.env.WCP_MAX_ISSUES) || 3,
        enableSwarmDeployment: process.env.WCP_ENABLE_SWARM !== 'false',
        concurrentFeatures: process.env.WCP_CONCURRENT_FEATURES === 'true',
        enforceCompliance: process.env.WCP_ENFORCE_COMPLIANCE !== 'false',
        complexityThresholds: {
          low: parseInt(process.env.WCP_LOW_THRESHOLD) || 5,
          medium: parseInt(process.env.WCP_MEDIUM_THRESHOLD) || 10,
          high: parseInt(process.env.WCP_HIGH_THRESHOLD) || 15
        }
      },

      // CI/CD Pipeline Configuration
      ci: {
        enableAdaptiveMonitoring: process.env.CI_ADAPTIVE_MONITORING !== 'false',
        monitoringInterval: parseInt(process.env.CI_MONITORING_INTERVAL) || 10000,
        maxRetries: parseInt(process.env.CI_MAX_RETRIES) || 3,
        timeoutMs: parseInt(process.env.CI_TIMEOUT) || 300000,
        qualityGates: {
          testCoverage: parseInt(process.env.CI_TEST_COVERAGE) || 80,
          lintErrors: parseInt(process.env.CI_LINT_ERRORS) || 0,
          buildSuccess: process.env.CI_BUILD_SUCCESS !== 'false',
          securityIssues: parseInt(process.env.CI_SECURITY_ISSUES) || 0,
          performanceThreshold: parseInt(process.env.CI_PERFORMANCE_THRESHOLD) || 90
        },
        workflows: {
          default: process.env.CI_DEFAULT_WORKFLOW || 'ci.yml',
          featureDeploy: process.env.CI_FEATURE_DEPLOY_WORKFLOW || 'feature-deploy.yml',
          integration: process.env.CI_INTEGRATION_WORKFLOW || 'integration.yml'
        }
      },

      // Progress Reporting Configuration
      reporting: {
        enableRealTimeReporting: process.env.REPORTING_REALTIME !== 'false',
        metricsRetentionDays: parseInt(process.env.REPORTING_RETENTION_DAYS) || 30,
        dashboardUpdateInterval: parseInt(process.env.DASHBOARD_UPDATE_INTERVAL) || 30000,
        alertThresholds: {
          lowProgress: parseInt(process.env.ALERT_LOW_PROGRESS) || 20,
          highFailureRate: parseInt(process.env.ALERT_HIGH_FAILURE_RATE) || 10,
          longDuration: parseInt(process.env.ALERT_LONG_DURATION) || 86400000,
          stagnationPeriod: parseInt(process.env.ALERT_STAGNATION_PERIOD) || 7200000
        },
        notifications: {
          enableSlack: process.env.SLACK_NOTIFICATIONS === 'true',
          enableEmail: process.env.EMAIL_NOTIFICATIONS === 'true',
          enableWebhook: process.env.WEBHOOK_NOTIFICATIONS === 'true',
          slackWebhook: process.env.SLACK_WEBHOOK_URL || '',
          emailConfig: {
            smtp: process.env.SMTP_SERVER || '',
            from: process.env.NOTIFICATION_EMAIL_FROM || '',
            recipients: (process.env.NOTIFICATION_EMAIL_RECIPIENTS || '').split(',')
          }
        }
      },

      // Swarm Coordination
      swarm: {
        enableSwarmCoordination: process.env.SWARM_COORDINATION !== 'false',
        defaultTopology: process.env.SWARM_DEFAULT_TOPOLOGY || 'hierarchical',
        maxAgents: parseInt(process.env.SWARM_MAX_AGENTS) || 8,
        agentSpawnStrategy: process.env.SWARM_SPAWN_STRATEGY || 'adaptive',
        coordinationProtocol: process.env.SWARM_PROTOCOL || 'hooks',
        memoryPersistence: process.env.SWARM_MEMORY_PERSISTENCE !== 'false'
      },

      // Error Handling and Recovery
      errorHandling: {
        enableAutoRetry: process.env.ERROR_AUTO_RETRY !== 'false',
        maxRetryAttempts: parseInt(process.env.ERROR_MAX_RETRIES) || 3,
        backoffStrategy: process.env.ERROR_BACKOFF_STRATEGY || 'exponential',
        enableCircuitBreaker: process.env.ERROR_CIRCUIT_BREAKER !== 'false',
        circuitBreakerThreshold: parseInt(process.env.ERROR_CIRCUIT_THRESHOLD) || 5,
        enableGracefulDegradation: process.env.ERROR_GRACEFUL_DEGRADATION !== 'false'
      },

      // Security Settings
      security: {
        enableSecurityScanning: process.env.SECURITY_SCANNING !== 'false',
        scanThresholds: {
          critical: parseInt(process.env.SECURITY_CRITICAL_THRESHOLD) || 0,
          high: parseInt(process.env.SECURITY_HIGH_THRESHOLD) || 0,
          medium: parseInt(process.env.SECURITY_MEDIUM_THRESHOLD) || 5
        },
        enableSecretDetection: process.env.SECURITY_SECRET_DETECTION !== 'false',
        allowedSecretPatterns: (process.env.SECURITY_ALLOWED_SECRETS || '').split(',')
      },

      // Performance Optimization
      performance: {
        enablePerformanceMonitoring: process.env.PERFORMANCE_MONITORING !== 'false',
        enableCaching: process.env.PERFORMANCE_CACHING !== 'false',
        cacheTimeout: parseInt(process.env.PERFORMANCE_CACHE_TIMEOUT) || 3600000,
        enableParallelExecution: process.env.PERFORMANCE_PARALLEL !== 'false',
        maxParallelTasks: parseInt(process.env.PERFORMANCE_MAX_PARALLEL) || 10,
        resourceLimits: {
          maxMemoryMB: parseInt(process.env.PERFORMANCE_MAX_MEMORY) || 2048,
          maxCpuPercent: parseInt(process.env.PERFORMANCE_MAX_CPU) || 80
        }
      },

      // Integration Settings
      integrations: {
        claude: {
          enabled: process.env.CLAUDE_INTEGRATION !== 'false',
          apiUrl: process.env.CLAUDE_API_URL || 'https://claude.ai',
          model: process.env.CLAUDE_MODEL || 'claude-sonnet-4'
        },
        openai: {
          enabled: process.env.OPENAI_INTEGRATION === 'true',
          apiKey: process.env.OPENAI_API_KEY || '',
          model: process.env.OPENAI_MODEL || 'gpt-4'
        },
        jira: {
          enabled: process.env.JIRA_INTEGRATION === 'true',
          baseUrl: process.env.JIRA_BASE_URL || '',
          username: process.env.JIRA_USERNAME || '',
          apiToken: process.env.JIRA_API_TOKEN || ''
        },
        discord: {
          enabled: process.env.DISCORD_INTEGRATION === 'true',
          webhookUrl: process.env.DISCORD_WEBHOOK_URL || '',
          botToken: process.env.DISCORD_BOT_TOKEN || ''
        }
      }
    };
  }

  /**
   * Merge user config with defaults
   * @param {Object} defaultConfig - Default configuration
   * @param {Object} userConfig - User-provided configuration
   * @returns {Object} Merged configuration
   */
  mergeConfigs(defaultConfig, userConfig) {
    return this.deepMerge(defaultConfig, userConfig);
  }

  /**
   * Deep merge two objects
   * @param {Object} target - Target object
   * @param {Object} source - Source object
   * @returns {Object} Merged object
   */
  deepMerge(target, source) {
    const output = { ...target };
    
    Object.keys(source).forEach(key => {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        output[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        output[key] = source[key];
      }
    });
    
    return output;
  }

  /**
   * Validate configuration
   * @throws {Error} If configuration is invalid
   */
  validateConfig() {
    const errors = [];

    // Validate required GitHub settings
    if (!this.config.github.owner) {
      errors.push('GitHub owner is required');
    }
    if (!this.config.github.repo) {
      errors.push('GitHub repo is required');
    }
    if (!this.config.github.token) {
      errors.push('GitHub token is required');
    }

    // Validate numeric ranges
    if (this.config.wcp.maxFeaturesPerEpic < 1 || this.config.wcp.maxFeaturesPerEpic > 20) {
      errors.push('WCP maxFeaturesPerEpic must be between 1 and 20');
    }
    if (this.config.wcp.maxIssuesPerFeature < 1 || this.config.wcp.maxIssuesPerFeature > 10) {
      errors.push('WCP maxIssuesPerFeature must be between 1 and 10');
    }

    // Validate quality gate thresholds
    const coverage = this.config.ci.qualityGates.testCoverage;
    if (coverage < 0 || coverage > 100) {
      errors.push('CI test coverage threshold must be between 0 and 100');
    }

    // Validate timeout values
    if (this.config.sparc.timeoutMs < 1000) {
      errors.push('SPARC timeout must be at least 1000ms');
    }
    if (this.config.ci.timeoutMs < 1000) {
      errors.push('CI timeout must be at least 1000ms');
    }

    // Validate paths
    const paths = [
      this.config.automation.workingDirectory,
      this.config.sparc.artifactsPath
    ];

    paths.forEach(path => {
      if (path && !fs.existsSync(path)) {
        try {
          fs.mkdirSync(path, { recursive: true });
        } catch (error) {
          errors.push(`Cannot create directory: ${path}`);
        }
      }
    });

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }
  }

  /**
   * Load configuration from file
   * @param {string} configPath - Path to configuration file
   * @returns {AutomationConfig} Configuration instance
   */
  static fromFile(configPath) {
    try {
      const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return new AutomationConfig(configData);
    } catch (error) {
      throw new Error(`Failed to load configuration from ${configPath}: ${error.message}`);
    }
  }

  /**
   * Save configuration to file
   * @param {string} configPath - Path to save configuration
   */
  saveToFile(configPath) {
    try {
      const configDir = path.dirname(configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      // Remove sensitive data before saving
      const sanitizedConfig = this.sanitizeForSave();
      fs.writeFileSync(configPath, JSON.stringify(sanitizedConfig, null, 2));
    } catch (error) {
      throw new Error(`Failed to save configuration to ${configPath}: ${error.message}`);
    }
  }

  /**
   * Remove sensitive data from configuration
   * @returns {Object} Sanitized configuration
   */
  sanitizeForSave() {
    const sanitized = JSON.parse(JSON.stringify(this.config));
    
    // Remove sensitive tokens and keys
    sanitized.github.token = '***REDACTED***';
    if (sanitized.integrations.openai.apiKey) {
      sanitized.integrations.openai.apiKey = '***REDACTED***';
    }
    if (sanitized.integrations.jira.apiToken) {
      sanitized.integrations.jira.apiToken = '***REDACTED***';
    }
    if (sanitized.integrations.discord.botToken) {
      sanitized.integrations.discord.botToken = '***REDACTED***';
    }
    if (sanitized.reporting.notifications.slackWebhook) {
      sanitized.reporting.notifications.slackWebhook = '***REDACTED***';
    }

    return sanitized;
  }

  /**
   * Get configuration for a specific component
   * @param {string} component - Component name
   * @returns {Object} Component configuration
   */
  getComponentConfig(component) {
    const componentConfigs = {
      milestoneProcessor: {
        github: this.config.github,
        wcp: this.config.wcp
      },
      sparcAutomator: {
        sparc: this.config.sparc,
        automation: this.config.automation,
        performance: this.config.performance
      },
      wcpManager: {
        wcp: this.config.wcp,
        github: this.config.github,
        swarm: this.config.swarm
      },
      ciPipelineManager: {
        github: this.config.github,
        ci: this.config.ci,
        performance: this.config.performance
      },
      progressReporter: {
        reporting: this.config.reporting,
        github: this.config.github,
        integrations: this.config.integrations
      },
      yoloWarpEngine: this.config
    };

    return componentConfigs[component] || this.config;
  }

  /**
   * Environment-specific configurations
   */
  static getEnvironmentConfig(environment = 'development') {
    const envConfigs = {
      development: {
        automation: {
          logLevel: 'debug',
          retryAttempts: 1
        },
        sparc: {
          timeoutMs: 30000
        },
        ci: {
          timeoutMs: 120000
        }
      },
      
      testing: {
        automation: {
          logLevel: 'warn',
          retryAttempts: 2,
          maxConcurrentTasks: 2
        },
        sparc: {
          timeoutMs: 15000,
          enableParallelProcessing: false
        },
        reporting: {
          enableRealTimeReporting: false
        }
      },

      staging: {
        automation: {
          logLevel: 'info',
          retryAttempts: 3
        },
        ci: {
          qualityGates: {
            testCoverage: 85,
            performanceThreshold: 85
          }
        }
      },

      production: {
        automation: {
          logLevel: 'warn',
          retryAttempts: 5,
          maxConcurrentTasks: 10
        },
        sparc: {
          timeoutMs: 120000
        },
        ci: {
          timeoutMs: 600000,
          qualityGates: {
            testCoverage: 90,
            lintErrors: 0,
            securityIssues: 0,
            performanceThreshold: 95
          }
        },
        reporting: {
          metricsRetentionDays: 90
        },
        errorHandling: {
          maxRetryAttempts: 5,
          enableCircuitBreaker: true
        }
      }
    };

    return envConfigs[environment] || {};
  }

  /**
   * Create configuration for specific use cases
   */
  static createPresetConfig(preset) {
    const presets = {
      // Small team setup
      small: {
        automation: {
          maxConcurrentTasks: 3
        },
        wcp: {
          maxFeaturesPerEpic: 5,
          maxIssuesPerFeature: 2
        },
        swarm: {
          maxAgents: 4
        }
      },

      // Enterprise setup
      enterprise: {
        automation: {
          maxConcurrentTasks: 20,
          enableErrorRecovery: true
        },
        wcp: {
          maxFeaturesPerEpic: 10,
          enableSwarmDeployment: true
        },
        ci: {
          qualityGates: {
            testCoverage: 95,
            securityIssues: 0
          }
        },
        swarm: {
          maxAgents: 15
        },
        performance: {
          maxParallelTasks: 20,
          resourceLimits: {
            maxMemoryMB: 8192,
            maxCpuPercent: 90
          }
        }
      },

      // CI/CD focused
      cicd: {
        ci: {
          enableAdaptiveMonitoring: true,
          maxRetries: 5,
          qualityGates: {
            testCoverage: 90,
            lintErrors: 0,
            buildSuccess: true,
            securityIssues: 0
          }
        },
        reporting: {
          enableRealTimeReporting: true,
          dashboardUpdateInterval: 10000
        }
      }
    };

    return presets[preset] || {};
  }

  /**
   * Get current configuration
   * @returns {Object} Current configuration
   */
  get() {
    return this.config;
  }

  /**
   * Update configuration
   * @param {Object} updates - Configuration updates
   */
  update(updates) {
    this.config = this.deepMerge(this.config, updates);
    this.validateConfig();
  }
}

module.exports = { AutomationConfig };