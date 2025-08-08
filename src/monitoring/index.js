/**
 * Performance Monitoring & Analytics System
 * Main entry point for the comprehensive monitoring solution
 */

// Core monitoring components
const { MonitoringEngine } = require('./core/MonitoringEngine');
const { MetricsCollector } = require('./core/MetricsCollector');
const { AlertManager } = require('./core/AlertManager');
const { DataProcessor } = require('./core/DataProcessor');
const { PerformanceAnalyzer } = require('./core/PerformanceAnalyzer');

// Data collectors
const SystemMetricsCollector = require('./collectors/SystemMetricsCollector');
const ProcessMetricsCollector = require('./collectors/ProcessMetricsCollector');
const NetworkMetricsCollector = require('./collectors/NetworkMetricsCollector');
const CLIMetricsCollector = require('./collectors/CLIMetricsCollector');

// Dashboard and visualization
const PerformanceDashboard = require('./dashboards/PerformanceDashboard');

// Integration components
const YoloProIntegration = require('./integration/YoloProIntegration');

/**
 * Performance Monitoring System
 * High-level orchestrator for the complete monitoring solution
 */
class PerformanceMonitoringSystem {
  constructor(config = {}, logger = console) {
    this.config = {
      monitoring: {
        enabled: true,
        collectInterval: 5000,
        retentionPeriod: 30 * 24 * 60 * 60 * 1000, // 30 days
        ...config.monitoring
      },
      dashboard: {
        enabled: true,
        refreshInterval: 5000,
        ...config.dashboard
      },
      integration: {
        enabled: true,
        yoloPro: true,
        ...config.integration
      },
      collectors: {
        system: true,
        process: true,
        network: true,
        cli: true,
        ...config.collectors
      },
      ...config
    };

    this.logger = logger;
    this.isRunning = false;

    // Core components
    this.monitoringEngine = null;
    this.dashboard = null;
    this.yoloProIntegration = null;

    // Component initialization status
    this.componentStatus = {
      monitoring: 'stopped',
      dashboard: 'stopped',
      integration: 'stopped'
    };
  }

  /**
   * Start the complete monitoring system
   */
  async start() {
    if (this.isRunning) {
      return { success: false, error: 'System already running' };
    }

    try {
      this.logger.info('Starting Performance Monitoring System...');

      // Initialize monitoring engine
      if (this.config.monitoring.enabled) {
        await this.initializeMonitoringEngine();
        this.componentStatus.monitoring = 'running';
      }

      // Initialize dashboard
      if (this.config.dashboard.enabled && this.monitoringEngine) {
        await this.initializeDashboard();
        this.componentStatus.dashboard = 'running';
      }

      // Initialize YOLO-PRO integration
      if (this.config.integration.enabled && this.config.integration.yoloPro && this.monitoringEngine) {
        await this.initializeYoloProIntegration();
        this.componentStatus.integration = 'running';
      }

      this.isRunning = true;

      this.logger.info('Performance Monitoring System started successfully', {
        components: this.getActiveComponents(),
        config: this.getSystemConfig()
      });

      return {
        success: true,
        startTime: Date.now(),
        components: this.componentStatus,
        activeCollectors: this.getActiveCollectors()
      };

    } catch (error) {
      this.logger.error('Failed to start Performance Monitoring System', { error: error.message });
      
      // Cleanup on failure
      await this.cleanup();
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Stop the complete monitoring system
   */
  async stop() {
    if (!this.isRunning) {
      return { success: false, error: 'System not running' };
    }

    try {
      this.logger.info('Stopping Performance Monitoring System...');

      // Stop components in reverse order
      if (this.yoloProIntegration) {
        await this.yoloProIntegration.stop();
        this.componentStatus.integration = 'stopped';
      }

      if (this.dashboard) {
        await this.dashboard.stop();
        this.componentStatus.dashboard = 'stopped';
      }

      if (this.monitoringEngine) {
        await this.monitoringEngine.stop();
        this.componentStatus.monitoring = 'stopped';
      }

      this.isRunning = false;

      this.logger.info('Performance Monitoring System stopped successfully');

      return {
        success: true,
        stopTime: Date.now(),
        finalStats: this.getSystemStats()
      };

    } catch (error) {
      this.logger.error('Error stopping Performance Monitoring System', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get system status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      components: this.componentStatus,
      uptime: this.getUptime(),
      activeCollectors: this.getActiveCollectors(),
      config: this.getSystemConfig(),
      timestamp: Date.now()
    };
  }

  /**
   * Get current performance metrics
   */
  getCurrentMetrics() {
    if (!this.monitoringEngine) {
      return { error: 'Monitoring engine not available' };
    }

    return this.monitoringEngine.getCurrentMetrics();
  }

  /**
   * Get dashboard data
   */
  getDashboardData() {
    if (!this.dashboard) {
      return { error: 'Dashboard not available' };
    }

    return this.dashboard.getDashboardData();
  }

  /**
   * Get performance analysis
   */
  async getPerformanceAnalysis(options = {}) {
    if (!this.monitoringEngine) {
      return { error: 'Monitoring engine not available' };
    }

    return await this.monitoringEngine.analyzePerformance(options);
  }

  /**
   * Get YOLO-PRO integration metrics
   */
  getYoloProMetrics() {
    if (!this.yoloProIntegration) {
      return { error: 'YOLO-PRO integration not available' };
    }

    return this.yoloProIntegration.getYoloProMetrics();
  }

  /**
   * Hook a CLI command for performance tracking
   */
  hookCLICommand(commandName, executeFn) {
    if (!this.yoloProIntegration) {
      this.logger.warn('YOLO-PRO integration not available, returning original function');
      return executeFn;
    }

    return this.yoloProIntegration.hookCLICommand(commandName, executeFn);
  }

  /**
   * Hook a workflow for performance tracking
   */
  hookWorkflow(workflowName, executeFn) {
    if (!this.yoloProIntegration) {
      this.logger.warn('YOLO-PRO integration not available, returning original function');
      return executeFn;
    }

    return this.yoloProIntegration.hookWorkflowExecution(workflowName, executeFn);
  }

  /**
   * Hook a SPARC phase for performance tracking
   */
  hookSparcPhase(phaseName, executeFn) {
    if (!this.yoloProIntegration) {
      this.logger.warn('YOLO-PRO integration not available, returning original function');
      return executeFn;
    }

    return this.yoloProIntegration.hookSparcPhase(phaseName, executeFn);
  }

  /**
   * Export system data
   */
  exportData(format = 'json') {
    const data = {
      timestamp: Date.now(),
      system: this.getStatus(),
      metrics: this.getCurrentMetrics(),
      dashboard: this.getDashboardData(),
      yoloPro: this.getYoloProMetrics()
    };

    switch (format.toLowerCase()) {
      case 'json':
        return JSON.stringify(data, null, 2);
      case 'csv':
        return this.convertToCSV(data);
      default:
        return data;
    }
  }

  /**
   * Private Methods
   */

  async initializeMonitoringEngine() {
    this.monitoringEngine = new MonitoringEngine(this.config, this.logger);
    
    const result = await this.monitoringEngine.start();
    if (!result.success) {
      throw new Error(`Failed to start monitoring engine: ${result.error}`);
    }

    // Register collectors based on configuration
    await this.registerCollectors();

    this.logger.info('Monitoring engine initialized successfully');
  }

  async initializeDashboard() {
    this.dashboard = new PerformanceDashboard(this.monitoringEngine, this.config);
    
    const result = await this.dashboard.start();
    if (!result.success) {
      throw new Error(`Failed to start dashboard: ${result.error}`);
    }

    this.logger.info('Dashboard initialized successfully');
  }

  async initializeYoloProIntegration() {
    this.yoloProIntegration = new YoloProIntegration(this.monitoringEngine, this.config);
    
    const result = await this.yoloProIntegration.start();
    if (!result.success) {
      throw new Error(`Failed to start YOLO-PRO integration: ${result.error}`);
    }

    this.logger.info('YOLO-PRO integration initialized successfully');
  }

  async registerCollectors() {
    // System metrics collector
    if (this.config.collectors.system) {
      const systemCollector = new SystemMetricsCollector();
      this.monitoringEngine.registerCollector('system', systemCollector);
      this.logger.debug('Registered system metrics collector');
    }

    // Process metrics collector
    if (this.config.collectors.process) {
      const processCollector = new ProcessMetricsCollector();
      this.monitoringEngine.registerCollector('process', processCollector);
      this.logger.debug('Registered process metrics collector');
    }

    // Network metrics collector
    if (this.config.collectors.network) {
      const networkCollector = new NetworkMetricsCollector();
      this.monitoringEngine.registerCollector('network', networkCollector);
      this.logger.debug('Registered network metrics collector');
    }

    // CLI metrics collector
    if (this.config.collectors.cli) {
      const cliCollector = new CLIMetricsCollector();
      this.monitoringEngine.registerCollector('cli', cliCollector);
      this.logger.debug('Registered CLI metrics collector');
    }
  }

  async cleanup() {
    try {
      if (this.yoloProIntegration) {
        await this.yoloProIntegration.stop();
        this.yoloProIntegration = null;
      }

      if (this.dashboard) {
        await this.dashboard.stop();
        this.dashboard = null;
      }

      if (this.monitoringEngine) {
        await this.monitoringEngine.stop();
        this.monitoringEngine = null;
      }

      Object.keys(this.componentStatus).forEach(key => {
        this.componentStatus[key] = 'stopped';
      });

    } catch (error) {
      this.logger.error('Error during cleanup', { error: error.message });
    }
  }

  getActiveComponents() {
    return Object.entries(this.componentStatus)
      .filter(([_, status]) => status === 'running')
      .map(([component, _]) => component);
  }

  getActiveCollectors() {
    if (!this.monitoringEngine) {
      return [];
    }

    return Array.from(this.monitoringEngine.collectors.keys());
  }

  getSystemConfig() {
    return {
      monitoring: this.config.monitoring.enabled,
      dashboard: this.config.dashboard.enabled,
      integration: this.config.integration.enabled,
      collectors: Object.entries(this.config.collectors)
        .filter(([_, enabled]) => enabled)
        .map(([name, _]) => name)
    };
  }

  getSystemStats() {
    const stats = {
      uptime: this.getUptime(),
      components: this.componentStatus
    };

    if (this.monitoringEngine) {
      const engineStats = this.monitoringEngine.getDashboardData();
      stats.monitoring = {
        totalDataPoints: engineStats.summary?.dataPoints || 0,
        activeCollectors: engineStats.summary?.activeCollectors || 0
      };
    }

    if (this.yoloProIntegration) {
      stats.integration = this.yoloProIntegration.getIntegrationStats();
    }

    return stats;
  }

  getUptime() {
    return this.startTime ? Date.now() - this.startTime : 0;
  }

  convertToCSV(data) {
    const rows = ['Component,Metric,Value,Timestamp'];

    // Add system metrics
    if (data.metrics && data.metrics.system) {
      Object.entries(data.metrics.system).forEach(([key, value]) => {
        if (typeof value === 'object' && value !== null) {
          Object.entries(value).forEach(([subKey, subValue]) => {
            if (typeof subValue === 'number') {
              rows.push(`system,${key}_${subKey},${subValue},${data.timestamp}`);
            }
          });
        } else if (typeof value === 'number') {
          rows.push(`system,${key},${value},${data.timestamp}`);
        }
      });
    }

    return rows.join('\n');
  }
}

/**
 * Factory function to create and configure a performance monitoring system
 */
function createPerformanceMonitoringSystem(config = {}, logger = console) {
  return new PerformanceMonitoringSystem(config, logger);
}

/**
 * Quick start function for basic monitoring setup
 */
async function quickStart(config = {}) {
  const defaultConfig = {
    monitoring: { enabled: true },
    dashboard: { enabled: true },
    integration: { enabled: true, yoloPro: true },
    collectors: { system: true, process: true, network: true, cli: true }
  };

  const mergedConfig = { ...defaultConfig, ...config };
  const system = new PerformanceMonitoringSystem(mergedConfig);
  
  const result = await system.start();
  
  if (result.success) {
    console.log('Performance Monitoring System started successfully');
    console.log('Active components:', result.components);
    console.log('Active collectors:', result.activeCollectors);
  } else {
    console.error('Failed to start Performance Monitoring System:', result.error);
  }

  return system;
}

module.exports = {
  // Main system class
  PerformanceMonitoringSystem,

  // Core components
  MonitoringEngine,
  MetricsCollector,
  AlertManager,
  DataProcessor,
  PerformanceAnalyzer,

  // Collectors
  SystemMetricsCollector,
  ProcessMetricsCollector,
  NetworkMetricsCollector,
  CLIMetricsCollector,

  // Dashboard
  PerformanceDashboard,

  // Integration
  YoloProIntegration,

  // Utility functions
  createPerformanceMonitoringSystem,
  quickStart
};