/**
 * Modular Architecture Engine - Core system for dynamic module loading and management
 * Supports hot-swapping, dependency resolution, and plugin lifecycle management
 */

import EventEmitter from 'events';
import { ServiceContainer } from './ServiceContainer.js';
import { PluginManager } from '../plugins/PluginManager.js';
import { ModuleLifecycle } from './ModuleLifecycle.js';
import { ModuleSecurity } from '../security/ModuleSecurity.js';
import { ModuleConfig } from '../config/ModuleConfig.js';
import { ModuleBridge } from '../communication/ModuleBridge.js';

export class ModularEngine extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      enableHotSwap: true,
      securityLevel: 'strict',
      maxConcurrentPlugins: 100,
      moduleTimeout: 30000,
      enableMarketplace: false,
      ...config
    };

    // Core subsystems
    this.serviceContainer = new ServiceContainer(this);
    this.pluginManager = new PluginManager(this);
    this.moduleLifecycle = new ModuleLifecycle(this);
    this.moduleSecurity = new ModuleSecurity(this);
    this.moduleConfig = new ModuleConfig(this);
    this.moduleBridge = new ModuleBridge(this);

    // State management
    this.modules = new Map();
    this.dependencies = new Map();
    this.registry = new Map();
    this.loadedModules = new Set();
    this.failedModules = new Set();
    this.hotSwapQueue = [];
    
    // Performance tracking
    this.metrics = {
      modulesLoaded: 0,
      hotSwapsPerformed: 0,
      securityViolations: 0,
      dependencyResolutions: 0,
      communicationEvents: 0
    };

    this.isInitialized = false;
    this.isShuttingDown = false;
  }

  /**
   * Initialize the modular engine
   */
  async initialize() {
    if (this.isInitialized) {
      throw new Error('ModularEngine already initialized');
    }

    try {
      this.emit('engine:initializing');

      // Initialize core subsystems in order
      await this.moduleConfig.initialize();
      await this.moduleSecurity.initialize();
      await this.serviceContainer.initialize();
      await this.moduleBridge.initialize();
      await this.moduleLifecycle.initialize();
      await this.pluginManager.initialize();

      // Register core services
      this.serviceContainer.register('engine', this);
      this.serviceContainer.register('config', this.moduleConfig);
      this.serviceContainer.register('security', this.moduleSecurity);
      this.serviceContainer.register('lifecycle', this.moduleLifecycle);
      this.serviceContainer.register('bridge', this.moduleBridge);
      this.serviceContainer.register('plugins', this.pluginManager);

      this.isInitialized = true;
      this.emit('engine:initialized');

      // Auto-load configured modules
      await this.loadConfiguredModules();

    } catch (error) {
      this.emit('engine:error', error);
      throw new Error(`Failed to initialize ModularEngine: ${error.message}`);
    }
  }

  /**
   * Load a module dynamically
   */
  async loadModule(moduleSpec) {
    if (!this.isInitialized) {
      throw new Error('Engine not initialized');
    }

    const moduleId = this.generateModuleId(moduleSpec);
    
    try {
      this.emit('module:loading', { moduleId, spec: moduleSpec });

      // Security validation
      const securityResult = await this.moduleSecurity.validateModule(moduleSpec);
      if (!securityResult.valid) {
        throw new Error(`Security validation failed: ${securityResult.reason}`);
      }

      // Check dependencies
      const dependencies = await this.resolveDependencies(moduleSpec.dependencies || []);
      
      // Load module through lifecycle manager
      const module = await this.moduleLifecycle.loadModule(moduleSpec, dependencies);
      
      // Register module
      this.modules.set(moduleId, module);
      this.dependencies.set(moduleId, dependencies);
      this.registry.set(moduleId, {
        spec: moduleSpec,
        loadTime: Date.now(),
        status: 'loaded',
        version: moduleSpec.version,
        dependencies: dependencies.map(d => d.id)
      });

      this.loadedModules.add(moduleId);
      this.metrics.modulesLoaded++;

      this.emit('module:loaded', { moduleId, module });
      return module;

    } catch (error) {
      this.failedModules.add(moduleId);
      this.emit('module:error', { moduleId, error });
      throw error;
    }
  }

  /**
   * Hot-swap a module without disrupting system
   */
  async hotSwapModule(moduleId, newModuleSpec) {
    if (!this.config.enableHotSwap) {
      throw new Error('Hot swapping is disabled');
    }

    if (!this.modules.has(moduleId)) {
      throw new Error(`Module ${moduleId} not found`);
    }

    try {
      this.emit('module:hot-swapping', { moduleId, newSpec: newModuleSpec });

      // Add to hot swap queue for batching
      this.hotSwapQueue.push({ moduleId, newModuleSpec, timestamp: Date.now() });

      // Process hot swap queue
      await this.processHotSwapQueue();

      this.metrics.hotSwapsPerformed++;
      this.emit('module:hot-swapped', { moduleId });

    } catch (error) {
      this.emit('module:hot-swap-error', { moduleId, error });
      throw error;
    }
  }

  /**
   * Unload a module safely
   */
  async unloadModule(moduleId) {
    if (!this.modules.has(moduleId)) {
      throw new Error(`Module ${moduleId} not found`);
    }

    try {
      this.emit('module:unloading', { moduleId });

      // Check for dependent modules
      const dependents = this.findDependentModules(moduleId);
      if (dependents.length > 0) {
        throw new Error(`Cannot unload module ${moduleId}: has dependents ${dependents.join(', ')}`);
      }

      // Unload through lifecycle manager
      const module = this.modules.get(moduleId);
      await this.moduleLifecycle.unloadModule(module);

      // Clean up registrations
      this.modules.delete(moduleId);
      this.dependencies.delete(moduleId);
      this.registry.delete(moduleId);
      this.loadedModules.delete(moduleId);

      this.emit('module:unloaded', { moduleId });

    } catch (error) {
      this.emit('module:unload-error', { moduleId, error });
      throw error;
    }
  }

  /**
   * Get module by ID
   */
  getModule(moduleId) {
    return this.modules.get(moduleId);
  }

  /**
   * List all loaded modules
   */
  listModules() {
    return Array.from(this.registry.entries()).map(([id, info]) => ({
      id,
      ...info,
      instance: this.modules.get(id)
    }));
  }

  /**
   * Check module health and status
   */
  async checkModuleHealth(moduleId) {
    if (!this.modules.has(moduleId)) {
      return { status: 'not-found' };
    }

    const module = this.modules.get(moduleId);
    const registry = this.registry.get(moduleId);

    try {
      // Check if module has health check method
      const health = module.checkHealth ? await module.checkHealth() : { status: 'unknown' };
      
      return {
        id: moduleId,
        status: 'healthy',
        uptime: Date.now() - registry.loadTime,
        version: registry.version,
        dependencies: registry.dependencies,
        health
      };

    } catch (error) {
      return {
        id: moduleId,
        status: 'unhealthy',
        error: error.message,
        uptime: Date.now() - registry.loadTime
      };
    }
  }

  /**
   * Get engine metrics and statistics
   */
  getMetrics() {
    return {
      ...this.metrics,
      modulesActive: this.loadedModules.size,
      modulesFailed: this.failedModules.size,
      dependenciesResolved: this.dependencies.size,
      hotSwapQueueLength: this.hotSwapQueue.length,
      uptime: this.isInitialized ? Date.now() - this.initTime : 0,
      memoryUsage: process.memoryUsage()
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    this.emit('engine:shutting-down');

    try {
      // Unload all modules in reverse dependency order
      const unloadOrder = this.calculateUnloadOrder();
      
      for (const moduleId of unloadOrder) {
        try {
          await this.unloadModule(moduleId);
        } catch (error) {
          // Log but continue shutdown
          this.emit('module:shutdown-error', { moduleId, error });
        }
      }

      // Shutdown subsystems
      await this.pluginManager.shutdown();
      await this.moduleLifecycle.shutdown();
      await this.moduleBridge.shutdown();
      await this.serviceContainer.shutdown();
      await this.moduleSecurity.shutdown();
      await this.moduleConfig.shutdown();

      this.emit('engine:shutdown');

    } catch (error) {
      this.emit('engine:shutdown-error', error);
      throw error;
    }
  }

  // Private helper methods

  generateModuleId(moduleSpec) {
    return moduleSpec.id || `${moduleSpec.name}-${moduleSpec.version || '1.0.0'}`;
  }

  async resolveDependencies(dependencySpecs) {
    const resolved = [];
    
    for (const depSpec of dependencySpecs) {
      const depId = this.generateModuleId(depSpec);
      
      if (!this.modules.has(depId)) {
        // Auto-load dependency
        await this.loadModule(depSpec);
      }
      
      resolved.push({
        id: depId,
        instance: this.modules.get(depId),
        spec: depSpec
      });
    }

    this.metrics.dependencyResolutions++;
    return resolved;
  }

  findDependentModules(moduleId) {
    const dependents = [];
    
    for (const [id, deps] of this.dependencies.entries()) {
      if (deps.some(dep => dep.id === moduleId)) {
        dependents.push(id);
      }
    }
    
    return dependents;
  }

  calculateUnloadOrder() {
    // Topological sort for safe unload order
    const visited = new Set();
    const order = [];
    
    const visit = (moduleId) => {
      if (visited.has(moduleId)) return;
      visited.add(moduleId);
      
      const dependents = this.findDependentModules(moduleId);
      dependents.forEach(visit);
      
      order.push(moduleId);
    };
    
    this.loadedModules.forEach(visit);
    return order;
  }

  async processHotSwapQueue() {
    if (this.hotSwapQueue.length === 0) return;

    const swaps = this.hotSwapQueue.splice(0);
    
    for (const { moduleId, newModuleSpec } of swaps) {
      try {
        const oldModule = this.modules.get(moduleId);
        
        // Prepare new module
        const newModule = await this.moduleLifecycle.loadModule(newModuleSpec);
        
        // Hot swap - replace instance while maintaining connections
        this.modules.set(moduleId, newModule);
        
        // Update registry
        this.registry.set(moduleId, {
          ...this.registry.get(moduleId),
          spec: newModuleSpec,
          version: newModuleSpec.version,
          hotSwapTime: Date.now()
        });

        // Clean up old module
        await this.moduleLifecycle.unloadModule(oldModule);

      } catch (error) {
        this.emit('module:hot-swap-error', { moduleId, error });
      }
    }
  }

  async loadConfiguredModules() {
    const configuredModules = this.moduleConfig.getConfiguredModules();
    
    for (const moduleSpec of configuredModules) {
      try {
        await this.loadModule(moduleSpec);
      } catch (error) {
        this.emit('module:auto-load-error', { spec: moduleSpec, error });
      }
    }
  }
}

export default ModularEngine;