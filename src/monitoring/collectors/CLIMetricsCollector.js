const { execSync, exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

/**
 * CLI Metrics Collector
 * Collects performance metrics specific to CLI operations and YOLO-PRO commands
 */
class CLIMetricsCollector {
  constructor(options = {}) {
    this.config = {
      trackCommands: true,
      trackFileOperations: true,
      trackGitOperations: true,
      trackNetworkRequests: true,
      commandHistory: true,
      historyLimit: 1000,
      ...options
    };

    this.commandHistory = [];
    this.activeOperations = new Map();
    this.operationStats = {
      totalCommands: 0,
      successfulCommands: 0,
      failedCommands: 0,
      averageExecutionTime: 0,
      lastCommand: null
    };
  }

  /**
   * Collect CLI-specific metrics
   */
  async collect() {
    const timestamp = Date.now();
    const metrics = { timestamp };

    try {
      // Command execution metrics
      if (this.config.trackCommands) {
        metrics.commands = await this.collectCommandMetrics();
      }

      // File operation metrics
      if (this.config.trackFileOperations) {
        metrics.fileOperations = await this.collectFileOperationMetrics();
      }

      // Git operation metrics
      if (this.config.trackGitOperations) {
        metrics.gitOperations = await this.collectGitOperationMetrics();
      }

      // Network request metrics (GitHub API, etc.)
      if (this.config.trackNetworkRequests) {
        metrics.networkRequests = await this.collectNetworkRequestMetrics();
      }

      // CLI performance metrics
      metrics.performance = await this.collectCLIPerformanceMetrics();

      return {
        success: true,
        timestamp,
        metrics
      };

    } catch (error) {
      return {
        success: false,
        timestamp,
        error: error.message
      };
    }
  }

  /**
   * Track command execution
   */
  trackCommand(commandName, startTime, endTime, success, error = null) {
    const executionTime = endTime - startTime;
    const commandData = {
      id: this.generateCommandId(),
      name: commandName,
      startTime,
      endTime,
      executionTime,
      success,
      error,
      timestamp: Date.now()
    };

    // Add to history
    if (this.config.commandHistory) {
      this.commandHistory.push(commandData);
      
      // Limit history size
      if (this.commandHistory.length > this.config.historyLimit) {
        this.commandHistory.shift();
      }
    }

    // Update statistics
    this.operationStats.totalCommands++;
    
    if (success) {
      this.operationStats.successfulCommands++;
    } else {
      this.operationStats.failedCommands++;
    }

    // Update average execution time
    const total = this.operationStats.totalCommands;
    const currentAvg = this.operationStats.averageExecutionTime;
    this.operationStats.averageExecutionTime = 
      ((currentAvg * (total - 1)) + executionTime) / total;

    this.operationStats.lastCommand = commandData;

    return commandData;
  }

  /**
   * Start tracking an operation
   */
  startOperation(operationType, operationName, metadata = {}) {
    const operationId = this.generateOperationId();
    const operation = {
      id: operationId,
      type: operationType,
      name: operationName,
      startTime: Date.now(),
      metadata
    };

    this.activeOperations.set(operationId, operation);
    return operationId;
  }

  /**
   * End tracking an operation
   */
  endOperation(operationId, success = true, result = null, error = null) {
    const operation = this.activeOperations.get(operationId);
    
    if (!operation) {
      return null;
    }

    operation.endTime = Date.now();
    operation.duration = operation.endTime - operation.startTime;
    operation.success = success;
    operation.result = result;
    operation.error = error;

    // Remove from active operations
    this.activeOperations.delete(operationId);

    // Track in command history
    this.trackCommand(
      `${operation.type}:${operation.name}`,
      operation.startTime,
      operation.endTime,
      success,
      error
    );

    return operation;
  }

  /**
   * Collect command execution metrics
   */
  async collectCommandMetrics() {
    const recentCommands = this.getRecentCommands(300000); // Last 5 minutes
    
    const metrics = {
      total: this.operationStats.totalCommands,
      successful: this.operationStats.successfulCommands,
      failed: this.operationStats.failedCommands,
      successRate: this.operationStats.totalCommands > 0 ? 
        (this.operationStats.successfulCommands / this.operationStats.totalCommands) * 100 : 0,
      averageExecutionTime: Math.round(this.operationStats.averageExecutionTime * 100) / 100,
      recent: {
        count: recentCommands.length,
        commands: recentCommands.slice(0, 10) // Last 10 commands
      },
      active: this.activeOperations.size,
      byType: this.analyzeCommandsByType(),
      performance: this.analyzeCommandPerformance()
    };

    return metrics;
  }

  /**
   * Collect file operation metrics
   */
  async collectFileOperationMetrics() {
    const metrics = {
      reads: 0,
      writes: 0,
      creates: 0,
      deletes: 0,
      errors: 0,
      averageOperationTime: 0
    };

    // Get file operations from command history
    const fileOperations = this.commandHistory.filter(cmd => 
      cmd.name.includes('file:') || 
      cmd.name.includes('fs:') ||
      cmd.name.includes('read') ||
      cmd.name.includes('write')
    );

    fileOperations.forEach(op => {
      if (op.name.includes('read')) metrics.reads++;
      else if (op.name.includes('write') || op.name.includes('create')) metrics.writes++;
      else if (op.name.includes('delete')) metrics.deletes++;

      if (!op.success) metrics.errors++;
    });

    if (fileOperations.length > 0) {
      metrics.averageOperationTime = fileOperations.reduce((sum, op) => 
        sum + op.executionTime, 0) / fileOperations.length;
    }

    // Add current working directory info
    try {
      metrics.currentDirectory = process.cwd();
      const stats = await fs.stat(metrics.currentDirectory);
      metrics.directoryInfo = {
        exists: true,
        isDirectory: stats.isDirectory(),
        modified: stats.mtime
      };
    } catch (error) {
      metrics.directoryInfo = {
        exists: false,
        error: error.message
      };
    }

    return metrics;
  }

  /**
   * Collect Git operation metrics
   */
  async collectGitOperationMetrics() {
    const metrics = {
      operations: {
        commits: 0,
        pushes: 0,
        pulls: 0,
        branches: 0,
        merges: 0,
        errors: 0
      },
      averageOperationTime: 0,
      repositoryInfo: null
    };

    // Get git operations from command history
    const gitOperations = this.commandHistory.filter(cmd => 
      cmd.name.includes('git:') || cmd.name.includes('gh:')
    );

    gitOperations.forEach(op => {
      if (op.name.includes('commit')) metrics.operations.commits++;
      else if (op.name.includes('push')) metrics.operations.pushes++;
      else if (op.name.includes('pull')) metrics.operations.pulls++;
      else if (op.name.includes('branch')) metrics.operations.branches++;
      else if (op.name.includes('merge')) metrics.operations.merges++;

      if (!op.success) metrics.operations.errors++;
    });

    if (gitOperations.length > 0) {
      metrics.averageOperationTime = gitOperations.reduce((sum, op) => 
        sum + op.executionTime, 0) / gitOperations.length;
    }

    // Get repository information
    try {
      metrics.repositoryInfo = await this.getGitRepositoryInfo();
    } catch (error) {
      metrics.repositoryInfo = {
        isRepository: false,
        error: error.message
      };
    }

    return metrics;
  }

  /**
   * Collect network request metrics
   */
  async collectNetworkRequestMetrics() {
    const metrics = {
      total: 0,
      successful: 0,
      failed: 0,
      averageResponseTime: 0,
      byEndpoint: {},
      errors: []
    };

    // Get network operations from command history
    const networkOperations = this.commandHistory.filter(cmd => 
      cmd.name.includes('http:') || 
      cmd.name.includes('api:') ||
      cmd.name.includes('github:') ||
      cmd.name.includes('network:')
    );

    networkOperations.forEach(op => {
      metrics.total++;
      
      if (op.success) {
        metrics.successful++;
      } else {
        metrics.failed++;
        metrics.errors.push({
          operation: op.name,
          error: op.error,
          timestamp: op.timestamp
        });
      }

      // Track by endpoint type
      const endpointType = this.extractEndpointType(op.name);
      if (!metrics.byEndpoint[endpointType]) {
        metrics.byEndpoint[endpointType] = {
          count: 0,
          successful: 0,
          averageTime: 0
        };
      }

      metrics.byEndpoint[endpointType].count++;
      if (op.success) {
        metrics.byEndpoint[endpointType].successful++;
      }
    });

    // Calculate average response time
    if (networkOperations.length > 0) {
      metrics.averageResponseTime = networkOperations.reduce((sum, op) => 
        sum + op.executionTime, 0) / networkOperations.length;
    }

    // Calculate success rate
    metrics.successRate = metrics.total > 0 ? 
      (metrics.successful / metrics.total) * 100 : 0;

    return metrics;
  }

  /**
   * Collect CLI performance metrics
   */
  async collectCLIPerformanceMetrics() {
    const metrics = {
      startupTime: this.getStartupTime(),
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      uptime: process.uptime(),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch
    };

    // CLI-specific performance indicators
    metrics.performance = {
      commandThroughput: this.calculateCommandThroughput(),
      errorRate: this.calculateErrorRate(),
      averageCommandTime: this.operationStats.averageExecutionTime,
      slowestCommand: this.findSlowestCommand(),
      fastestCommand: this.findFastestCommand()
    };

    return metrics;
  }

  /**
   * Get recent commands within time window
   */
  getRecentCommands(timeWindow = 300000) {
    const cutoffTime = Date.now() - timeWindow;
    return this.commandHistory.filter(cmd => cmd.timestamp >= cutoffTime);
  }

  /**
   * Analyze commands by type
   */
  analyzeCommandsByType() {
    const byType = {};

    this.commandHistory.forEach(cmd => {
      const type = cmd.name.split(':')[0] || 'unknown';
      
      if (!byType[type]) {
        byType[type] = {
          count: 0,
          successful: 0,
          averageTime: 0,
          totalTime: 0
        };
      }

      byType[type].count++;
      byType[type].totalTime += cmd.executionTime;
      
      if (cmd.success) {
        byType[type].successful++;
      }
    });

    // Calculate averages
    Object.keys(byType).forEach(type => {
      const data = byType[type];
      data.averageTime = data.totalTime / data.count;
      data.successRate = (data.successful / data.count) * 100;
    });

    return byType;
  }

  /**
   * Analyze command performance
   */
  analyzeCommandPerformance() {
    if (this.commandHistory.length === 0) {
      return {
        percentiles: {},
        distribution: {},
        trends: {}
      };
    }

    const executionTimes = this.commandHistory.map(cmd => cmd.executionTime);
    executionTimes.sort((a, b) => a - b);

    const percentiles = {
      p50: this.calculatePercentile(executionTimes, 0.5),
      p75: this.calculatePercentile(executionTimes, 0.75),
      p90: this.calculatePercentile(executionTimes, 0.9),
      p95: this.calculatePercentile(executionTimes, 0.95),
      p99: this.calculatePercentile(executionTimes, 0.99)
    };

    const distribution = this.analyzeExecutionTimeDistribution(executionTimes);
    const trends = this.analyzePerformanceTrends();

    return {
      percentiles,
      distribution,
      trends
    };
  }

  /**
   * Get Git repository information
   */
  async getGitRepositoryInfo() {
    try {
      const isRepo = await this.executeGitCommand('git rev-parse --is-inside-work-tree');
      
      if (!isRepo.includes('true')) {
        return { isRepository: false };
      }

      const info = {
        isRepository: true,
        branch: await this.executeGitCommand('git branch --show-current'),
        lastCommit: await this.executeGitCommand('git log -1 --format="%H %s"'),
        status: await this.executeGitCommand('git status --porcelain'),
        remote: await this.executeGitCommand('git remote get-url origin'),
        ahead: 0,
        behind: 0
      };

      // Check ahead/behind status
      try {
        const aheadBehind = await this.executeGitCommand('git rev-list --left-right --count origin/HEAD...HEAD');
        const parts = aheadBehind.trim().split('\t');
        if (parts.length === 2) {
          info.behind = parseInt(parts[0]) || 0;
          info.ahead = parseInt(parts[1]) || 0;
        }
      } catch (error) {
        // Ignore errors for ahead/behind check
      }

      return info;

    } catch (error) {
      return {
        isRepository: false,
        error: error.message
      };
    }
  }

  /**
   * Execute Git command safely
   */
  async executeGitCommand(command) {
    return new Promise((resolve, reject) => {
      exec(command, { timeout: 5000 }, (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(stdout.trim());
      });
    });
  }

  /**
   * Calculate command throughput (commands per minute)
   */
  calculateCommandThroughput() {
    const recentCommands = this.getRecentCommands(60000); // Last minute
    return recentCommands.length;
  }

  /**
   * Calculate error rate
   */
  calculateErrorRate() {
    if (this.operationStats.totalCommands === 0) return 0;
    return (this.operationStats.failedCommands / this.operationStats.totalCommands) * 100;
  }

  /**
   * Find slowest command
   */
  findSlowestCommand() {
    if (this.commandHistory.length === 0) return null;
    
    return this.commandHistory.reduce((slowest, cmd) => 
      cmd.executionTime > slowest.executionTime ? cmd : slowest
    );
  }

  /**
   * Find fastest command
   */
  findFastestCommand() {
    if (this.commandHistory.length === 0) return null;
    
    return this.commandHistory.reduce((fastest, cmd) => 
      cmd.executionTime < fastest.executionTime ? cmd : fastest
    );
  }

  /**
   * Extract endpoint type from operation name
   */
  extractEndpointType(operationName) {
    if (operationName.includes('github')) return 'github';
    if (operationName.includes('api')) return 'api';
    if (operationName.includes('http')) return 'http';
    return 'unknown';
  }

  /**
   * Get startup time (placeholder)
   */
  getStartupTime() {
    // This would typically be measured from process start
    return process.uptime() * 1000; // Convert to milliseconds
  }

  /**
   * Calculate percentile
   */
  calculatePercentile(sortedArray, percentile) {
    if (sortedArray.length === 0) return 0;
    
    const index = Math.ceil(sortedArray.length * percentile) - 1;
    return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
  }

  /**
   * Analyze execution time distribution
   */
  analyzeExecutionTimeDistribution(executionTimes) {
    const buckets = {
      fast: 0,      // < 100ms
      medium: 0,    // 100ms - 1s
      slow: 0,      // 1s - 5s
      verySlow: 0   // > 5s
    };

    executionTimes.forEach(time => {
      if (time < 100) buckets.fast++;
      else if (time < 1000) buckets.medium++;
      else if (time < 5000) buckets.slow++;
      else buckets.verySlow++;
    });

    const total = executionTimes.length;
    
    return {
      fast: { count: buckets.fast, percentage: (buckets.fast / total) * 100 },
      medium: { count: buckets.medium, percentage: (buckets.medium / total) * 100 },
      slow: { count: buckets.slow, percentage: (buckets.slow / total) * 100 },
      verySlow: { count: buckets.verySlow, percentage: (buckets.verySlow / total) * 100 }
    };
  }

  /**
   * Analyze performance trends
   */
  analyzePerformanceTrends() {
    if (this.commandHistory.length < 10) {
      return { trend: 'insufficient_data', change: 0 };
    }

    const recentCommands = this.commandHistory.slice(-10);
    const olderCommands = this.commandHistory.slice(-20, -10);

    if (olderCommands.length === 0) {
      return { trend: 'insufficient_data', change: 0 };
    }

    const recentAvg = recentCommands.reduce((sum, cmd) => sum + cmd.executionTime, 0) / recentCommands.length;
    const olderAvg = olderCommands.reduce((sum, cmd) => sum + cmd.executionTime, 0) / olderCommands.length;

    const change = ((recentAvg - olderAvg) / olderAvg) * 100;

    return {
      trend: Math.abs(change) < 10 ? 'stable' : change > 0 ? 'slower' : 'faster',
      change: Math.round(change * 100) / 100,
      recentAverage: Math.round(recentAvg * 100) / 100,
      previousAverage: Math.round(olderAvg * 100) / 100
    };
  }

  /**
   * Generate unique command ID
   */
  generateCommandId() {
    return `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique operation ID
   */
  generateOperationId() {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get command history
   */
  getCommandHistory(limit = 100) {
    return this.commandHistory.slice(-limit);
  }

  /**
   * Clear command history
   */
  clearHistory() {
    this.commandHistory = [];
    this.operationStats = {
      totalCommands: 0,
      successfulCommands: 0,
      failedCommands: 0,
      averageExecutionTime: 0,
      lastCommand: null
    };
  }

  /**
   * Get active operations
   */
  getActiveOperations() {
    return Array.from(this.activeOperations.values());
  }

  /**
   * Export metrics data
   */
  exportData() {
    return {
      commandHistory: this.commandHistory,
      operationStats: this.operationStats,
      activeOperations: Array.from(this.activeOperations.values()),
      config: this.config
    };
  }

  /**
   * Import metrics data
   */
  importData(data) {
    if (data.commandHistory) {
      this.commandHistory = data.commandHistory;
    }
    
    if (data.operationStats) {
      this.operationStats = data.operationStats;
    }
    
    if (data.activeOperations) {
      this.activeOperations.clear();
      data.activeOperations.forEach(op => {
        this.activeOperations.set(op.id, op);
      });
    }
  }

  /**
   * Cleanup method
   */
  async cleanup() {
    // Clear active operations
    this.activeOperations.clear();
  }
}

module.exports = CLIMetricsCollector;