/**
 * Module Lifecycle Manager - Manages module loading, initialization, and cleanup
 * Supports hot-swapping, graceful shutdowns, and state persistence
 */

import EventEmitter from 'events';

export class ModuleLifecycle extends EventEmitter {
  constructor(engine) {
    super();
    this.engine = engine;
    this.loadedModules = new Map();
    this.moduleStates = new Map();
    this.lifecycleHooks = new Map();
    this.cleanupTasks = new Map();
    
    this.config = {
      gracefulShutdownTimeout: 30000,
      initializationTimeout: 15000,
      enableStateRecovery: true,
      maxRetryAttempts: 3,
      retryDelay: 1000
    };

    this.states = {
      LOADING: 'loading',
      INITIALIZING: 'initializing',
      RUNNING: 'running',
      STOPPING: 'stopping',
      STOPPED: 'stopped',
      FAILED: 'failed',
      HOT_SWAPPING: 'hot-swapping'
    };

    this.metrics = {
      modulesLoaded: 0,
      modulesFailed: 0,
      hotSwapsPerformed: 0,
      gracefulShutdowns: 0,
      forcedShutdowns: 0,
      retryAttempts: 0
    };

    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) {
      throw new Error('ModuleLifecycle already initialized');
    }

    this.emit('lifecycle:initializing');

    // Setup default lifecycle hooks
    this.setupDefaultHooks();

    // Recover module states if enabled
    if (this.config.enableStateRecovery) {
      await this.recoverModuleStates();
    }

    this.isInitialized = true;
    this.emit('lifecycle:initialized');
  }

  /**
   * Load a module with full lifecycle management
   */
  async loadModule(moduleSpec, dependencies = []) {
    const moduleId = this.generateModuleId(moduleSpec);
    
    try {
      this.setModuleState(moduleId, this.states.LOADING);
      this.emit('module:lifecycle:loading', { moduleId, spec: moduleSpec });

      // Execute pre-load hooks
      await this.executeHooks('preLoad', moduleId, moduleSpec);

      // Load module with retry logic
      const module = await this.loadModuleWithRetry(moduleSpec, dependencies);
      
      this.loadedModules.set(moduleId, {
        instance: module,
        spec: moduleSpec,
        dependencies,
        loadTime: Date.now()
      });

      // Initialize module
      await this.initializeModule(moduleId, module, moduleSpec);

      // Execute post-load hooks
      await this.executeHooks('postLoad', moduleId, module);

      this.setModuleState(moduleId, this.states.RUNNING);
      this.metrics.modulesLoaded++;

      this.emit('module:lifecycle:loaded', { moduleId, module });
      return module;

    } catch (error) {
      this.setModuleState(moduleId, this.states.FAILED);
      this.metrics.modulesFailed++;
      this.emit('module:lifecycle:error', { moduleId, error });
      throw error;
    }
  }

  /**
   * Unload a module with graceful cleanup
   */
  async unloadModule(module) {
    const moduleId = this.findModuleId(module);
    
    if (!moduleId) {
      throw new Error('Module not found in lifecycle registry');
    }

    try {
      this.setModuleState(moduleId, this.states.STOPPING);
      this.emit('module:lifecycle:unloading', { moduleId });

      // Execute pre-unload hooks
      await this.executeHooks('preUnload', moduleId, module);

      // Graceful shutdown with timeout
      await this.gracefulShutdown(moduleId, module);

      // Execute cleanup tasks
      await this.executeCleanupTasks(moduleId);

      // Execute post-unload hooks
      await this.executeHooks('postUnload', moduleId, module);

      // Remove from registry
      this.loadedModules.delete(moduleId);
      this.moduleStates.delete(moduleId);
      this.cleanupTasks.delete(moduleId);

      this.setModuleState(moduleId, this.states.STOPPED);
      this.metrics.gracefulShutdowns++;

      this.emit('module:lifecycle:unloaded', { moduleId });

    } catch (error) {
      this.metrics.forcedShutdowns++;
      this.emit('module:lifecycle:unload-error', { moduleId, error });
      throw error;
    }
  }

  /**
   * Hot-swap a module maintaining state
   */
  async hotSwapModule(moduleId, newModuleSpec) {
    if (!this.loadedModules.has(moduleId)) {
      throw new Error(`Module ${moduleId} not found`);
    }

    const currentModuleData = this.loadedModules.get(moduleId);
    const oldModule = currentModuleData.instance;

    try {
      this.setModuleState(moduleId, this.states.HOT_SWAPPING);
      this.emit('module:lifecycle:hot-swapping', { moduleId, newSpec: newModuleSpec });

      // Execute pre-swap hooks
      await this.executeHooks('preHotSwap', moduleId, oldModule, newModuleSpec);

      // Preserve module state
      const preservedState = await this.preserveModuleState(moduleId, oldModule);

      // Load new module
      const newModule = await this.loadModuleWithRetry(newModuleSpec, currentModuleData.dependencies);

      // Initialize new module with preserved state
      await this.initializeModule(moduleId, newModule, newModuleSpec, preservedState);

      // Update registry
      this.loadedModules.set(moduleId, {
        ...currentModuleData,
        instance: newModule,
        spec: newModuleSpec,
        swapTime: Date.now()
      });

      // Cleanup old module
      await this.cleanupOldModule(oldModule);

      // Execute post-swap hooks
      await this.executeHooks('postHotSwap', moduleId, newModule, oldModule);

      this.setModuleState(moduleId, this.states.RUNNING);
      this.metrics.hotSwapsPerformed++;

      this.emit('module:lifecycle:hot-swapped', { moduleId, newModule });

    } catch (error) {
      this.setModuleState(moduleId, this.states.FAILED);
      this.emit('module:lifecycle:hot-swap-error', { moduleId, error });
      throw error;
    }
  }

  /**
   * Get module state
   */
  getModuleState(moduleId) {
    return this.moduleStates.get(moduleId) || this.states.STOPPED;
  }

  /**
   * Check if module is in healthy state
   */
  isModuleHealthy(moduleId) {
    const state = this.getModuleState(moduleId);
    return state === this.states.RUNNING;
  }

  /**
   * Register lifecycle hook
   */
  registerHook(phase, callback) {
    if (!this.lifecycleHooks.has(phase)) {
      this.lifecycleHooks.set(phase, []);
    }
    
    this.lifecycleHooks.get(phase).push(callback);
    this.emit('hook:registered', { phase });
  }

  /**
   * Register cleanup task for module
   */
  registerCleanupTask(moduleId, task) {
    if (!this.cleanupTasks.has(moduleId)) {
      this.cleanupTasks.set(moduleId, []);
    }
    
    this.cleanupTasks.get(moduleId).push(task);
  }

  /**
   * Get lifecycle metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      modulesActive: this.loadedModules.size,
      moduleStates: Object.fromEntries(
        Array.from(this.moduleStates.entries())
      ),
      hooksRegistered: Array.from(this.lifecycleHooks.values())
        .reduce((sum, hooks) => sum + hooks.length, 0)
    };
  }

  async shutdown() {
    this.emit('lifecycle:shutting-down');

    // Unload all modules in reverse order
    const moduleIds = Array.from(this.loadedModules.keys()).reverse();
    
    for (const moduleId of moduleIds) {
      try {
        const moduleData = this.loadedModules.get(moduleId);
        await this.unloadModule(moduleData.instance);
      } catch (error) {
        this.emit('module:shutdown-error', { moduleId, error });
      }
    }

    this.emit('lifecycle:shutdown');
  }

  // Private methods

  generateModuleId(moduleSpec) {
    return moduleSpec.id || `${moduleSpec.name}-${moduleSpec.version || '1.0.0'}`;
  }

  findModuleId(module) {
    for (const [id, data] of this.loadedModules.entries()) {
      if (data.instance === module) {
        return id;
      }
    }
    return null;
  }

  setModuleState(moduleId, state) {
    this.moduleStates.set(moduleId, state);
    this.emit('module:state-changed', { moduleId, state });
  }

  async loadModuleWithRetry(moduleSpec, dependencies) {
    let lastError;
    
    for (let attempt = 0; attempt < this.config.maxRetryAttempts; attempt++) {
      try {
        return await this.loadModuleInstance(moduleSpec, dependencies);
      } catch (error) {
        lastError = error;
        this.metrics.retryAttempts++;
        
        if (attempt < this.config.maxRetryAttempts - 1) {
          await this.delay(this.config.retryDelay * Math.pow(2, attempt));
        }
      }
    }
    
    throw lastError;
  }

  async loadModuleInstance(moduleSpec, dependencies) {
    if (moduleSpec.factory) {
      // Factory function
      return await moduleSpec.factory(dependencies);
    } else if (moduleSpec.class) {
      // Class constructor
      return new moduleSpec.class(...dependencies);
    } else if (moduleSpec.path) {
      // Dynamic import
      const ModuleClass = await import(moduleSpec.path);
      return new (ModuleClass.default || ModuleClass)(...dependencies);
    } else {
      throw new Error('Invalid module specification');
    }
  }

  async initializeModule(moduleId, module, moduleSpec, preservedState = null) {
    this.setModuleState(moduleId, this.states.INITIALIZING);

    const initPromise = this.callModuleMethod(module, 'initialize', [
      this.engine,
      moduleSpec,
      preservedState
    ]);

    const timeout = setTimeout(() => {
      throw new Error(`Module ${moduleId} initialization timeout`);
    }, this.config.initializationTimeout);

    try {
      await initPromise;
      clearTimeout(timeout);
    } catch (error) {
      clearTimeout(timeout);
      throw error;
    }
  }

  async gracefulShutdown(moduleId, module) {
    const shutdownPromise = this.callModuleMethod(module, 'shutdown', []);
    
    const timeout = setTimeout(() => {
      this.emit('module:shutdown-timeout', { moduleId });
    }, this.config.gracefulShutdownTimeout);

    try {
      await Promise.race([
        shutdownPromise,
        this.delay(this.config.gracefulShutdownTimeout)
      ]);
      clearTimeout(timeout);
    } catch (error) {
      clearTimeout(timeout);
      throw error;
    }
  }

  async preserveModuleState(moduleId, module) {
    try {
      if (typeof module.getState === 'function') {
        return await module.getState();
      }
      return null;
    } catch (error) {
      this.emit('module:state-preservation-error', { moduleId, error });
      return null;
    }
  }

  async cleanupOldModule(oldModule) {
    try {
      await this.callModuleMethod(oldModule, 'cleanup', []);
    } catch (error) {
      this.emit('module:cleanup-error', { error });
    }
  }

  async executeHooks(phase, ...args) {
    const hooks = this.lifecycleHooks.get(phase) || [];
    
    for (const hook of hooks) {
      try {
        await hook(...args);
      } catch (error) {
        this.emit('hook:execution-error', { phase, error });
      }
    }
  }

  async executeCleanupTasks(moduleId) {
    const tasks = this.cleanupTasks.get(moduleId) || [];
    
    for (const task of tasks) {
      try {
        await task();
      } catch (error) {
        this.emit('cleanup:task-error', { moduleId, error });
      }
    }
  }

  async callModuleMethod(module, methodName, args = []) {
    if (typeof module[methodName] === 'function') {
      return await module[methodName](...args);
    }
  }

  setupDefaultHooks() {
    // Pre-load validation
    this.registerHook('preLoad', async (moduleId, spec) => {
      this.emit('hook:pre-load', { moduleId, spec });
    });

    // Post-load registration
    this.registerHook('postLoad', async (moduleId, module) => {
      this.emit('hook:post-load', { moduleId, module });
    });

    // Pre-unload cleanup preparation
    this.registerHook('preUnload', async (moduleId, module) => {
      this.emit('hook:pre-unload', { moduleId, module });
    });

    // Post-unload cleanup
    this.registerHook('postUnload', async (moduleId, module) => {
      this.emit('hook:post-unload', { moduleId, module });
    });
  }

  async recoverModuleStates() {
    // Simplified state recovery - in real implementation would use persistent storage
    this.emit('lifecycle:recovering-states');
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default ModuleLifecycle;