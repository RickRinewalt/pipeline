/**
 * Basic Example Plugin - Demonstrates core modular architecture features
 * 
 * This plugin showcases:
 * - Basic plugin lifecycle (initialize, cleanup)
 * - Service registration with dependency injection
 * - Configuration management
 * - Inter-module communication
 * - Health monitoring
 * - Error handling
 */

export default class BasicExamplePlugin {
  constructor(engine, options = {}) {
    this.engine = engine;
    this.options = options;
    this.initialized = false;
    this.startTime = Date.now();
    this.messageCount = 0;
    this.connections = new Map();
    
    // Plugin state
    this.state = {
      status: 'created',
      lastActivity: null,
      errorCount: 0
    };
  }

  /**
   * Initialize the plugin
   */
  async initialize(engine, manifest, preservedState = null) {
    try {
      this.engine.logger?.info('BasicExamplePlugin: Initializing...');
      
      // Restore state if hot-swapped
      if (preservedState) {
        this.state = { ...this.state, ...preservedState };
        this.messageCount = preservedState.messageCount || 0;
      }
      
      // Get configuration
      this.config = this.engine.moduleConfig.getConfig('basic-plugin', null, {
        enableLogging: true,
        maxConnections: 10,
        apiEndpoint: 'https://api.example.com'
      });
      
      // Setup services
      await this.setupServices();
      
      // Setup communication
      await this.setupCommunication();
      
      // Register for configuration changes
      this.engine.moduleConfig.registerValidator('basic-plugin', (config) => {
        return config.maxConnections > 0 && config.maxConnections <= 100;
      });
      
      this.initialized = true;
      this.state.status = 'running';
      this.state.lastActivity = Date.now();
      
      this.engine.logger?.info('BasicExamplePlugin: Initialized successfully');
      return true;
      
    } catch (error) {
      this.state.errorCount++;
      this.engine.logger?.error(`BasicExamplePlugin: Initialization failed - ${error.message}`);
      throw error;
    }
  }

  /**
   * Setup services with dependency injection
   */
  async setupServices() {
    // Register basic service
    this.engine.serviceContainer.registerSingleton('basicService', () => {
      return {
        // Core API methods
        greet: (name) => this.greet(name),
        getStatus: () => this.getPublicStatus(),
        processData: (data) => this.processData(data),
        
        // Configuration methods
        getConfig: (key) => this.config[key],
        updateConfig: (key, value) => this.updateConfig(key, value),
        
        // Connection management
        createConnection: (id, options) => this.createConnection(id, options),
        closeConnection: (id) => this.closeConnection(id),
        listConnections: () => Array.from(this.connections.keys()),
        
        // Utility methods
        ping: () => ({ pong: true, timestamp: Date.now() }),
        echo: (message) => ({ echo: message, timestamp: Date.now() })
      };
    });

    // Register example API service
    this.engine.serviceContainer.registerTransient('exampleApi', () => {
      return {
        // HTTP-like API methods
        get: (path, params) => this.apiGet(path, params),
        post: (path, data) => this.apiPost(path, data),
        put: (path, data) => this.apiPut(path, data),
        delete: (path) => this.apiDelete(path),
        
        // Batch operations
        batch: (operations) => this.apiBatch(operations)
      };
    });

    this.engine.logger?.info('BasicExamplePlugin: Services registered');
  }

  /**
   * Setup inter-module communication
   */
  async setupCommunication() {
    // Subscribe to general announcements
    this.engine.moduleBridge.subscribe(
      'basic-plugin',
      'system-announcements',
      (message) => this.handleSystemAnnouncement(message)
    );

    // Subscribe to plugin-specific messages
    this.engine.moduleBridge.subscribe(
      'basic-plugin',
      'basic-plugin-messages',
      (message) => this.handlePluginMessage(message)
    );

    // Subscribe to configuration change notifications
    this.engine.moduleBridge.subscribe(
      'basic-plugin',
      'config-changes',
      (message) => this.handleConfigChange(message)
    );

    this.engine.logger?.info('BasicExamplePlugin: Communication setup complete');
  }

  /**
   * Greet a user
   */
  greet(name) {
    this.messageCount++;
    this.state.lastActivity = Date.now();
    
    const greeting = `Hello, ${name}! This is the Basic Example Plugin.`;
    
    // Send greeting event
    this.engine.moduleBridge.sendMessage(
      'basic-plugin',
      'system-announcements',
      {
        type: 'greeting',
        message: greeting,
        recipient: name,
        timestamp: Date.now()
      }
    );
    
    return greeting;
  }

  /**
   * Process some data (example business logic)
   */
  processData(data) {
    try {
      this.state.lastActivity = Date.now();
      
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid data provided');
      }

      const processed = {
        original: data,
        processed: true,
        processedBy: 'basic-plugin',
        processedAt: Date.now(),
        hash: this.generateHash(JSON.stringify(data)),
        metadata: {
          size: JSON.stringify(data).length,
          keys: Object.keys(data).length
        }
      };

      // Emit processing event
      this.engine.moduleBridge.sendMessage(
        'basic-plugin',
        'data-processing',
        {
          type: 'data_processed',
          dataHash: processed.hash,
          metadata: processed.metadata
        }
      );

      return processed;
      
    } catch (error) {
      this.state.errorCount++;
      this.engine.logger?.error(`BasicExamplePlugin: Data processing failed - ${error.message}`);
      throw error;
    }
  }

  /**
   * Create a connection (example resource management)
   */
  createConnection(id, options = {}) {
    if (this.connections.size >= this.config.maxConnections) {
      throw new Error(`Maximum connections (${this.config.maxConnections}) exceeded`);
    }

    if (this.connections.has(id)) {
      throw new Error(`Connection ${id} already exists`);
    }

    const connection = {
      id,
      created: Date.now(),
      lastUsed: Date.now(),
      status: 'active',
      options,
      data: new Map()
    };

    this.connections.set(id, connection);
    this.state.lastActivity = Date.now();

    this.engine.logger?.info(`BasicExamplePlugin: Connection ${id} created`);
    return connection;
  }

  /**
   * Close a connection
   */
  closeConnection(id) {
    const connection = this.connections.get(id);
    
    if (!connection) {
      return false;
    }

    connection.status = 'closed';
    this.connections.delete(id);
    
    this.engine.logger?.info(`BasicExamplePlugin: Connection ${id} closed`);
    return true;
  }

  /**
   * Update configuration
   */
  async updateConfig(key, value) {
    try {
      await this.engine.moduleConfig.setConfig('basic-plugin', key, value, true);
      this.config[key] = value;
      
      // Emit config change event
      this.engine.moduleBridge.sendMessage(
        'basic-plugin',
        'config-changes',
        {
          type: 'config_updated',
          key,
          value,
          updatedBy: 'basic-plugin'
        }
      );
      
      return true;
    } catch (error) {
      this.state.errorCount++;
      throw error;
    }
  }

  /**
   * API GET method simulation
   */
  async apiGet(path, params = {}) {
    this.state.lastActivity = Date.now();
    
    // Simulate API call
    await this.delay(100);
    
    return {
      method: 'GET',
      path,
      params,
      response: {
        status: 200,
        data: { message: `GET ${path}`, params, timestamp: Date.now() }
      }
    };
  }

  /**
   * API POST method simulation
   */
  async apiPost(path, data) {
    this.state.lastActivity = Date.now();
    
    // Simulate API call
    await this.delay(150);
    
    return {
      method: 'POST',
      path,
      data,
      response: {
        status: 201,
        data: { message: `POST ${path}`, created: true, id: Date.now() }
      }
    };
  }

  /**
   * API PUT method simulation
   */
  async apiPut(path, data) {
    this.state.lastActivity = Date.now();
    
    // Simulate API call
    await this.delay(120);
    
    return {
      method: 'PUT',
      path,
      data,
      response: {
        status: 200,
        data: { message: `PUT ${path}`, updated: true, timestamp: Date.now() }
      }
    };
  }

  /**
   * API DELETE method simulation
   */
  async apiDelete(path) {
    this.state.lastActivity = Date.now();
    
    // Simulate API call
    await this.delay(80);
    
    return {
      method: 'DELETE',
      path,
      response: {
        status: 204,
        data: { message: `DELETE ${path}`, deleted: true }
      }
    };
  }

  /**
   * Batch API operations
   */
  async apiBatch(operations) {
    this.state.lastActivity = Date.now();
    
    const results = [];
    
    for (const op of operations) {
      try {
        let result;
        
        switch (op.method.toUpperCase()) {
          case 'GET':
            result = await this.apiGet(op.path, op.params);
            break;
          case 'POST':
            result = await this.apiPost(op.path, op.data);
            break;
          case 'PUT':
            result = await this.apiPut(op.path, op.data);
            break;
          case 'DELETE':
            result = await this.apiDelete(op.path);
            break;
          default:
            throw new Error(`Unsupported method: ${op.method}`);
        }
        
        results.push({ success: true, ...result });
        
      } catch (error) {
        results.push({
          success: false,
          error: error.message,
          operation: op
        });
      }
    }
    
    return {
      batch: true,
      operations: operations.length,
      results,
      timestamp: Date.now()
    };
  }

  /**
   * Handle system announcements
   */
  handleSystemAnnouncement(message) {
    this.engine.logger?.info(`BasicExamplePlugin: System announcement - ${message.payload.type}`);
    this.state.lastActivity = Date.now();
  }

  /**
   * Handle plugin-specific messages
   */
  handlePluginMessage(message) {
    this.messageCount++;
    this.state.lastActivity = Date.now();
    
    this.engine.logger?.info(`BasicExamplePlugin: Received message from ${message.from}`);
    
    // Echo the message back
    this.engine.moduleBridge.sendMessage(
      'basic-plugin',
      `response:${message.from}`,
      {
        type: 'echo_response',
        originalMessage: message.payload,
        respondedBy: 'basic-plugin',
        timestamp: Date.now()
      }
    );
  }

  /**
   * Handle configuration changes
   */
  handleConfigChange(message) {
    const { key, value } = message.payload;
    
    if (key && this.config.hasOwnProperty(key)) {
      this.config[key] = value;
      this.engine.logger?.info(`BasicExamplePlugin: Configuration updated - ${key}: ${value}`);
    }
  }

  /**
   * Get public status (safe for external consumption)
   */
  getPublicStatus() {
    return {
      pluginName: 'BasicExamplePlugin',
      version: '1.0.0',
      status: this.state.status,
      initialized: this.initialized,
      uptime: Date.now() - this.startTime,
      messageCount: this.messageCount,
      activeConnections: this.connections.size,
      lastActivity: this.state.lastActivity,
      health: this.state.errorCount === 0 ? 'healthy' : 'degraded'
    };
  }

  /**
   * Get state for hot-swapping
   */
  getState() {
    return {
      messageCount: this.messageCount,
      state: this.state,
      connections: Array.from(this.connections.entries()),
      config: this.config
    };
  }

  /**
   * Health check for monitoring
   */
  async checkHealth() {
    const status = this.getPublicStatus();
    
    return {
      status: status.health === 'healthy' ? 'healthy' : 'degraded',
      details: {
        uptime: status.uptime,
        initialized: status.initialized,
        errorCount: this.state.errorCount,
        activeConnections: status.activeConnections,
        lastActivity: status.lastActivity,
        configValid: this.validateConfig()
      },
      timestamp: Date.now()
    };
  }

  /**
   * Configuration change handler
   */
  onConfigChange(key, value) {
    this.engine.logger?.info(`BasicExamplePlugin: Config change detected - ${key}: ${value}`);
    
    // Handle specific config changes
    if (key === 'maxConnections' && value < this.connections.size) {
      this.engine.logger?.warn('BasicExamplePlugin: Max connections reduced below current count');
    }
    
    this.config[key] = value;
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    try {
      this.engine.logger?.info('BasicExamplePlugin: Cleaning up...');
      
      // Close all connections
      for (const [id] of this.connections) {
        this.closeConnection(id);
      }
      
      // Unsubscribe from all channels
      this.engine.moduleBridge.unsubscribe('basic-plugin', 'system-announcements');
      this.engine.moduleBridge.unsubscribe('basic-plugin', 'basic-plugin-messages');
      this.engine.moduleBridge.unsubscribe('basic-plugin', 'config-changes');
      
      this.initialized = false;
      this.state.status = 'stopped';
      
      this.engine.logger?.info('BasicExamplePlugin: Cleanup complete');
      
    } catch (error) {
      this.engine.logger?.error(`BasicExamplePlugin: Cleanup failed - ${error.message}`);
      throw error;
    }
  }

  // Utility methods

  /**
   * Generate simple hash
   */
  generateHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  }

  /**
   * Validate current configuration
   */
  validateConfig() {
    return (
      this.config.maxConnections > 0 &&
      this.config.maxConnections <= 100 &&
      typeof this.config.enableLogging === 'boolean' &&
      typeof this.config.apiEndpoint === 'string'
    );
  }

  /**
   * Delay utility
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}