/**
 * Swarm orchestration manager for Claude-flow integration
 */
class SwarmManager {
  constructor({ claudeFlowPath = 'npx claude-flow@alpha', timeout = 300000 } = {}) {
    this.claudeFlowPath = claudeFlowPath;
    this.timeout = timeout;
    this.activeSwarms = new Map();
    this.executionLogs = [];
  }

  /**
   * Initialize a swarm with specified topology
   */
  async initializeSwarm({ 
    topology = 'hierarchical', 
    maxAgents = 8, 
    strategy = 'adaptive',
    swarmId = null 
  }) {
    try {
      const swarmConfig = {
        topology,
        maxAgents: Math.min(maxAgents, 20), // Safety limit
        strategy
      };

      this.log(`Initializing swarm with config: ${JSON.stringify(swarmConfig)}`, 'info');

      // Use MCP claude-flow for swarm initialization
      const result = await this.executeClaudeFlowCommand('swarm_init', swarmConfig);
      
      const swarmData = {
        id: swarmId || result.swarmId || `swarm-${Date.now()}`,
        ...swarmConfig,
        status: 'active',
        createdAt: new Date(),
        agents: [],
        tasks: new Map(),
      };

      this.activeSwarms.set(swarmData.id, swarmData);
      
      this.log(`Swarm ${swarmData.id} initialized successfully`, 'success');
      
      return { 
        swarmId: swarmData.id, 
        ...swarmConfig,
        status: 'initialized' 
      };
    } catch (error) {
      this.log(`Swarm initialization failed: ${error.message}`, 'error');
      throw new Error(`Swarm initialization failed: ${error.message}`);
    }
  }

  /**
   * Spawn agents in the swarm based on requirements
   */
  async spawnAgents(swarmId, agentConfigs) {
    try {
      const swarm = this.activeSwarms.get(swarmId);
      if (!swarm) {
        throw new Error(`Swarm ${swarmId} not found`);
      }

      const spawnedAgents = [];
      
      for (const config of agentConfigs) {
        this.log(`Spawning agent: ${config.type} with capabilities: ${config.capabilities?.join(', ')}`, 'info');
        
        const agent = await this.executeClaudeFlowCommand('agent_spawn', {
          swarmId,
          type: config.type,
          name: config.name || `${config.type}-${Date.now()}`,
          capabilities: config.capabilities || this.getDefaultCapabilities(config.type),
        });

        spawnedAgents.push(agent.agentId || agent.id);
        swarm.agents.push({
          id: agent.agentId || agent.id,
          type: config.type,
          capabilities: config.capabilities,
          status: 'ready',
          spawnedAt: new Date(),
        });
      }

      this.log(`Spawned ${spawnedAgents.length} agents in swarm ${swarmId}`, 'success');
      
      return spawnedAgents;
    } catch (error) {
      this.log(`Agent spawning failed: ${error.message}`, 'error');
      throw new Error(`Agent spawning failed: ${error.message}`);
    }
  }

  /**
   * Orchestrate a task across the swarm
   */
  async orchestrateTask(swarmId, task) {
    try {
      const swarm = this.activeSwarms.get(swarmId);
      if (!swarm) {
        throw new Error(`Swarm ${swarmId} not found`);
      }

      const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      this.log(`Orchestrating task ${taskId}: ${task.description?.substring(0, 100)}...`, 'info');

      const orchestrationConfig = {
        task: task.description,
        priority: task.priority || 'medium',
        strategy: task.strategy || 'adaptive',
        maxAgents: Math.min(task.maxAgents || 3, swarm.agents.length),
        dependencies: task.dependencies || [],
      };

      // Track task in swarm
      swarm.tasks.set(taskId, {
        id: taskId,
        ...orchestrationConfig,
        status: 'running',
        startedAt: new Date(),
        assignedAgents: [],
      });

      // Execute via claude-flow
      const result = await this.executeClaudeFlowCommand('task_orchestrate', orchestrationConfig);
      
      // Update task status
      const taskData = swarm.tasks.get(taskId);
      taskData.status = result.success ? 'completed' : 'failed';
      taskData.completedAt = new Date();
      taskData.result = result;

      this.log(`Task ${taskId} ${taskData.status}`, result.success ? 'success' : 'error');

      return {
        taskId,
        success: result.success || false,
        results: result.results || {},
        executionTime: taskData.completedAt - taskData.startedAt,
        assignedAgents: result.assignedAgents || [],
      };
    } catch (error) {
      this.log(`Task orchestration failed: ${error.message}`, 'error');
      throw new Error(`Task orchestration failed: ${error.message}`);
    }
  }

  /**
   * Monitor swarm progress and health
   */
  async monitorProgress(swarmId = null) {
    try {
      if (swarmId) {
        const swarm = this.activeSwarms.get(swarmId);
        if (!swarm) {
          throw new Error(`Swarm ${swarmId} not found`);
        }

        const status = await this.executeClaudeFlowCommand('swarm_status', { swarmId });
        
        return {
          swarmId,
          status: swarm.status,
          activeAgents: swarm.agents.filter(a => a.status === 'ready').length,
          totalAgents: swarm.agents.length,
          activeTasks: Array.from(swarm.tasks.values()).filter(t => t.status === 'running').length,
          completedTasks: Array.from(swarm.tasks.values()).filter(t => t.status === 'completed').length,
          failedTasks: Array.from(swarm.tasks.values()).filter(t => t.status === 'failed').length,
          uptime: Date.now() - swarm.createdAt.getTime(),
          ...status,
        };
      } else {
        // Monitor all active swarms
        const allStatus = [];
        for (const [id, swarm] of this.activeSwarms) {
          const status = await this.monitorProgress(id);
          allStatus.push(status);
        }
        return allStatus;
      }
    } catch (error) {
      this.log(`Monitoring failed: ${error.message}`, 'error');
      return { error: error.message };
    }
  }

  /**
   * Get swarm status and agent information
   */
  async getSwarmStatus(swarmId) {
    try {
      const swarm = this.activeSwarms.get(swarmId);
      if (!swarm) {
        throw new Error(`Swarm ${swarmId} not found`);
      }

      // Get detailed status from claude-flow
      const claudeFlowStatus = await this.executeClaudeFlowCommand('swarm_status', { swarmId });
      
      return {
        id: swarmId,
        topology: swarm.topology,
        status: swarm.status,
        agents: swarm.agents,
        tasks: Array.from(swarm.tasks.values()),
        performance: {
          uptime: Date.now() - swarm.createdAt.getTime(),
          totalTasks: swarm.tasks.size,
          successRate: this.calculateSuccessRate(swarm.tasks),
          avgExecutionTime: this.calculateAvgExecutionTime(swarm.tasks),
        },
        claudeFlowStatus,
      };
    } catch (error) {
      this.log(`Failed to get swarm status: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Destroy swarm and clean up resources
   */
  async destroySwarm(swarmId) {
    try {
      const swarm = this.activeSwarms.get(swarmId);
      if (!swarm) {
        this.log(`Swarm ${swarmId} not found for destruction`, 'warning');
        return { success: true, message: 'Swarm not found' };
      }

      this.log(`Destroying swarm ${swarmId}`, 'info');

      // Cancel running tasks
      for (const [taskId, task] of swarm.tasks) {
        if (task.status === 'running') {
          task.status = 'cancelled';
          task.completedAt = new Date();
        }
      }

      // Destroy via claude-flow
      try {
        await this.executeClaudeFlowCommand('swarm_destroy', { swarmId });
      } catch (error) {
        this.log(`Claude-flow swarm destruction warning: ${error.message}`, 'warning');
      }

      // Remove from active swarms
      this.activeSwarms.delete(swarmId);

      this.log(`Swarm ${swarmId} destroyed successfully`, 'success');

      return { 
        success: true, 
        message: `Swarm ${swarmId} destroyed`,
        finalStats: this.generateSwarmStats(swarm),
      };
    } catch (error) {
      this.log(`Swarm destruction failed: ${error.message}`, 'error');
      throw new Error(`Swarm destruction failed: ${error.message}`);
    }
  }

  /**
   * Scale swarm by adding or removing agents
   */
  async scaleSwarm(swarmId, targetAgentCount) {
    try {
      const swarm = this.activeSwarms.get(swarmId);
      if (!swarm) {
        throw new Error(`Swarm ${swarmId} not found`);
      }

      const currentCount = swarm.agents.length;
      const difference = targetAgentCount - currentCount;

      this.log(`Scaling swarm ${swarmId} from ${currentCount} to ${targetAgentCount} agents`, 'info');

      if (difference > 0) {
        // Add agents
        const agentConfigs = Array(difference).fill().map((_, i) => ({
          type: 'coder', // Default type for scaling
          name: `scaled-agent-${currentCount + i + 1}`,
        }));

        await this.spawnAgents(swarmId, agentConfigs);
      } else if (difference < 0) {
        // Remove agents (remove least active first)
        const agentsToRemove = swarm.agents
          .sort((a, b) => (a.lastActivity || 0) - (b.lastActivity || 0))
          .slice(0, Math.abs(difference));

        for (const agent of agentsToRemove) {
          const index = swarm.agents.findIndex(a => a.id === agent.id);
          if (index > -1) {
            swarm.agents.splice(index, 1);
          }
        }
      }

      return await this.getSwarmStatus(swarmId);
    } catch (error) {
      this.log(`Swarm scaling failed: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Execute Claude-flow command (mock implementation for testing)
   */
  async executeClaudeFlowCommand(command, params = {}) {
    // In production, this would execute actual claude-flow MCP commands
    // For now, simulate responses based on command type
    
    this.log(`Executing claude-flow command: ${command}`, 'debug');

    // Simulate network delay
    await this.delay(100 + Math.random() * 200);

    switch (command) {
      case 'swarm_init':
        return {
          swarmId: `swarm-${Date.now()}`,
          status: 'initialized',
          topology: params.topology,
          maxAgents: params.maxAgents,
        };

      case 'agent_spawn':
        return {
          agentId: `agent-${params.type}-${Date.now()}`,
          type: params.type,
          status: 'spawned',
        };

      case 'task_orchestrate':
        // Simulate some task execution time
        await this.delay(1000 + Math.random() * 2000);
        return {
          success: Math.random() > 0.1, // 90% success rate
          results: {
            executedBy: `agent-${Math.random().toString(36).substr(2, 9)}`,
            duration: Math.floor(1000 + Math.random() * 5000),
          },
        };

      case 'swarm_status':
        return {
          active: true,
          agents: Math.floor(2 + Math.random() * 6),
          uptime: Date.now() - (Date.now() - Math.random() * 3600000),
        };

      case 'swarm_destroy':
        return { success: true };

      default:
        throw new Error(`Unknown command: ${command}`);
    }
  }

  /**
   * Get default capabilities for agent type
   */
  getDefaultCapabilities(agentType) {
    const defaultCapabilities = {
      'researcher': ['information-gathering', 'analysis', 'documentation'],
      'coder': ['implementation', 'debugging', 'testing'],
      'architect': ['system-design', 'planning', 'documentation'],
      'tester': ['testing', 'validation', 'quality-assurance'],
      'reviewer': ['code-review', 'quality-assurance', 'documentation'],
      'optimizer': ['performance-analysis', 'optimization', 'profiling'],
    };

    return defaultCapabilities[agentType] || ['general-purpose'];
  }

  /**
   * Calculate success rate for tasks
   */
  calculateSuccessRate(tasks) {
    const taskArray = Array.from(tasks.values());
    if (taskArray.length === 0) return 0;

    const successful = taskArray.filter(t => t.status === 'completed').length;
    return (successful / taskArray.length) * 100;
  }

  /**
   * Calculate average execution time
   */
  calculateAvgExecutionTime(tasks) {
    const completedTasks = Array.from(tasks.values()).filter(t => t.completedAt && t.startedAt);
    if (completedTasks.length === 0) return 0;

    const totalTime = completedTasks.reduce((sum, task) => {
      return sum + (task.completedAt - task.startedAt);
    }, 0);

    return Math.floor(totalTime / completedTasks.length);
  }

  /**
   * Generate comprehensive swarm statistics
   */
  generateSwarmStats(swarm) {
    const tasks = Array.from(swarm.tasks.values());
    
    return {
      runtime: Date.now() - swarm.createdAt.getTime(),
      totalAgents: swarm.agents.length,
      totalTasks: tasks.length,
      completedTasks: tasks.filter(t => t.status === 'completed').length,
      failedTasks: tasks.filter(t => t.status === 'failed').length,
      cancelledTasks: tasks.filter(t => t.status === 'cancelled').length,
      successRate: this.calculateSuccessRate(swarm.tasks),
      avgExecutionTime: this.calculateAvgExecutionTime(swarm.tasks),
      topology: swarm.topology,
      strategy: swarm.strategy,
    };
  }

  /**
   * Utility function for delays
   */
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Logging utility
   */
  log(message, level = 'info') {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      component: 'SwarmManager',
    };

    this.executionLogs.push(logEntry);

    // Keep only last 1000 log entries
    if (this.executionLogs.length > 1000) {
      this.executionLogs = this.executionLogs.slice(-1000);
    }

    // Console output for development
    const colors = {
      error: '\x1b[31m',
      warning: '\x1b[33m',
      success: '\x1b[32m',
      info: '\x1b[36m',
      debug: '\x1b[90m',
      reset: '\x1b[0m',
    };

    console.log(`${colors[level] || colors.info}[SwarmManager] ${message}${colors.reset}`);
  }

  /**
   * Get execution logs
   */
  getExecutionLogs(level = null, limit = null) {
    let logs = [...this.executionLogs];

    if (level) {
      logs = logs.filter(log => log.level === level);
    }

    if (limit) {
      logs = logs.slice(-limit);
    }

    return logs;
  }

  /**
   * Clear execution logs
   */
  clearLogs() {
    this.executionLogs = [];
  }

  /**
   * Get all active swarms summary
   */
  getAllSwarms() {
    return Array.from(this.activeSwarms.entries()).map(([id, swarm]) => ({
      id,
      status: swarm.status,
      agents: swarm.agents.length,
      tasks: swarm.tasks.size,
      uptime: Date.now() - swarm.createdAt.getTime(),
      topology: swarm.topology,
    }));
  }
}

module.exports = SwarmManager;