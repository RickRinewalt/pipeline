/**
 * Service Container - Dependency injection and service management system
 * Provides singleton, factory, and transient service lifecycles
 */

import EventEmitter from 'events';

export class ServiceContainer extends EventEmitter {
  constructor(engine) {
    super();
    this.engine = engine;
    this.services = new Map();
    this.factories = new Map();
    this.singletons = new Map();
    this.transients = new Map();
    this.dependencies = new Map();
    this.resolving = new Set();
    this.interceptors = new Map();
    
    this.config = {
      circularDependencyCheck: true,
      lazyLoading: true,
      autoWiring: true,
      maxResolutionDepth: 10
    };

    this.metrics = {
      servicesRegistered: 0,
      singletonsCreated: 0,
      transientInstancesCreated: 0,
      dependenciesResolved: 0,
      circularDependenciesDetected: 0
    };

    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) {
      throw new Error('ServiceContainer already initialized');
    }

    this.emit('container:initializing');

    // Register built-in services
    this.registerSingleton('container', () => this);
    this.registerSingleton('engine', () => this.engine);

    this.isInitialized = true;
    this.emit('container:initialized');
  }

  /**
   * Register a singleton service
   */
  registerSingleton(name, factory, dependencies = []) {
    this.validateServiceName(name);
    
    const serviceDefinition = {
      type: 'singleton',
      factory: this.wrapFactory(factory),
      dependencies,
      instance: null,
      created: false
    };

    this.services.set(name, serviceDefinition);
    this.dependencies.set(name, dependencies);
    this.singletons.set(name, serviceDefinition);
    
    this.metrics.servicesRegistered++;
    this.emit('service:registered', { name, type: 'singleton' });

    return this;
  }

  /**
   * Register a transient service (new instance each time)
   */
  registerTransient(name, factory, dependencies = []) {
    this.validateServiceName(name);
    
    const serviceDefinition = {
      type: 'transient',
      factory: this.wrapFactory(factory),
      dependencies,
      instanceCount: 0
    };

    this.services.set(name, serviceDefinition);
    this.dependencies.set(name, dependencies);
    this.transients.set(name, serviceDefinition);
    
    this.metrics.servicesRegistered++;
    this.emit('service:registered', { name, type: 'transient' });

    return this;
  }

  /**
   * Register a factory service
   */
  registerFactory(name, factory, dependencies = []) {
    this.validateServiceName(name);
    
    const serviceDefinition = {
      type: 'factory',
      factory: this.wrapFactory(factory),
      dependencies,
      instances: []
    };

    this.services.set(name, serviceDefinition);
    this.dependencies.set(name, dependencies);
    this.factories.set(name, serviceDefinition);
    
    this.metrics.servicesRegistered++;
    this.emit('service:registered', { name, type: 'factory' });

    return this;
  }

  /**
   * Register an existing instance
   */
  register(name, instance) {
    this.validateServiceName(name);
    
    const serviceDefinition = {
      type: 'instance',
      factory: () => instance,
      dependencies: [],
      instance
    };

    this.services.set(name, serviceDefinition);
    this.dependencies.set(name, []);
    
    this.metrics.servicesRegistered++;
    this.emit('service:registered', { name, type: 'instance' });

    return this;
  }

  /**
   * Resolve a service with dependency injection
   */
  async resolve(name, context = {}) {
    if (!this.services.has(name)) {
      throw new Error(`Service '${name}' not registered`);
    }

    // Check for circular dependencies
    if (this.config.circularDependencyCheck && this.resolving.has(name)) {
      this.metrics.circularDependenciesDetected++;
      throw new Error(`Circular dependency detected for service '${name}'`);
    }

    this.resolving.add(name);

    try {
      const service = await this.doResolve(name, context);
      this.resolving.delete(name);
      
      // Apply interceptors
      return this.applyInterceptors(name, service);

    } catch (error) {
      this.resolving.delete(name);
      this.emit('service:resolution-error', { name, error });
      throw error;
    }
  }

  /**
   * Resolve multiple services
   */
  async resolveAll(names, context = {}) {
    const services = {};
    
    for (const name of names) {
      services[name] = await this.resolve(name, context);
    }
    
    return services;
  }

  /**
   * Check if service is registered
   */
  has(name) {
    return this.services.has(name);
  }

  /**
   * Get service definition without resolving
   */
  getDefinition(name) {
    return this.services.get(name);
  }

  /**
   * List all registered services
   */
  listServices() {
    return Array.from(this.services.entries()).map(([name, def]) => ({
      name,
      type: def.type,
      dependencies: this.dependencies.get(name) || [],
      created: def.type === 'singleton' ? def.created : undefined,
      instanceCount: def.type === 'transient' ? def.instanceCount : undefined
    }));
  }

  /**
   * Add service interceptor for AOP
   */
  addInterceptor(serviceName, interceptor) {
    if (!this.interceptors.has(serviceName)) {
      this.interceptors.set(serviceName, []);
    }
    
    this.interceptors.get(serviceName).push(interceptor);
    this.emit('interceptor:added', { serviceName });
  }

  /**
   * Create child container with service inheritance
   */
  createChild() {
    const child = new ServiceContainer(this.engine);
    
    // Inherit parent services
    for (const [name, definition] of this.services.entries()) {
      child.services.set(name, { ...definition });
    }
    
    child.parent = this;
    return child;
  }

  /**
   * Dispose container and cleanup singletons
   */
  async dispose() {
    this.emit('container:disposing');

    // Dispose singletons that have dispose method
    for (const [name, definition] of this.singletons.entries()) {
      if (definition.created && definition.instance) {
        try {
          if (typeof definition.instance.dispose === 'function') {
            await definition.instance.dispose();
          }
        } catch (error) {
          this.emit('service:dispose-error', { name, error });
        }
      }
    }

    // Clear all registrations
    this.services.clear();
    this.factories.clear();
    this.singletons.clear();
    this.transients.clear();
    this.dependencies.clear();
    this.interceptors.clear();

    this.emit('container:disposed');
  }

  /**
   * Get container metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      servicesActive: this.services.size,
      singletonsActive: Array.from(this.singletons.values())
        .filter(s => s.created).length,
      interceptorsActive: Array.from(this.interceptors.values())
        .reduce((sum, arr) => sum + arr.length, 0)
    };
  }

  async shutdown() {
    await this.dispose();
  }

  // Private methods

  async doResolve(name, context) {
    const definition = this.services.get(name);

    switch (definition.type) {
      case 'singleton':
        return await this.resolveSingleton(name, definition, context);
      
      case 'transient':
        return await this.resolveTransient(name, definition, context);
      
      case 'factory':
        return await this.resolveFactory(name, definition, context);
      
      case 'instance':
        return definition.instance;
      
      default:
        throw new Error(`Unknown service type: ${definition.type}`);
    }
  }

  async resolveSingleton(name, definition, context) {
    if (definition.created) {
      return definition.instance;
    }

    // Resolve dependencies
    const dependencies = await this.resolveDependencies(
      this.dependencies.get(name) || [], 
      context
    );

    // Create instance
    definition.instance = await definition.factory(...dependencies);
    definition.created = true;

    this.metrics.singletonsCreated++;
    this.emit('service:singleton-created', { name });

    return definition.instance;
  }

  async resolveTransient(name, definition, context) {
    // Always create new instance
    const dependencies = await this.resolveDependencies(
      this.dependencies.get(name) || [], 
      context
    );

    const instance = await definition.factory(...dependencies);
    definition.instanceCount++;

    this.metrics.transientInstancesCreated++;
    this.emit('service:transient-created', { name });

    return instance;
  }

  async resolveFactory(name, definition, context) {
    const dependencies = await this.resolveDependencies(
      this.dependencies.get(name) || [], 
      context
    );

    const factory = await definition.factory(...dependencies);
    definition.instances.push(factory);

    this.emit('service:factory-created', { name });
    return factory;
  }

  async resolveDependencies(dependencyNames, context) {
    const dependencies = [];
    
    for (const depName of dependencyNames) {
      const dependency = await this.resolve(depName, context);
      dependencies.push(dependency);
    }

    this.metrics.dependenciesResolved++;
    return dependencies;
  }

  wrapFactory(factory) {
    return async (...args) => {
      try {
        const result = await factory(...args);
        return result;
      } catch (error) {
        this.emit('service:factory-error', { factory, error });
        throw error;
      }
    };
  }

  applyInterceptors(serviceName, service) {
    const interceptors = this.interceptors.get(serviceName) || [];
    
    return interceptors.reduce((interceptedService, interceptor) => {
      return interceptor(interceptedService) || interceptedService;
    }, service);
  }

  validateServiceName(name) {
    if (!name || typeof name !== 'string') {
      throw new Error('Service name must be a non-empty string');
    }

    if (this.services.has(name)) {
      throw new Error(`Service '${name}' is already registered`);
    }
  }

  /**
   * Auto-wire services based on constructor parameters or decorators
   */
  autoWire(serviceClass) {
    if (!this.config.autoWiring) {
      return serviceClass;
    }

    // Extract dependency metadata (simplified - could use decorators/reflection)
    const dependencies = this.extractDependencies(serviceClass);
    
    return (...injectedDeps) => {
      const allDeps = [...injectedDeps, ...dependencies];
      return new serviceClass(...allDeps);
    };
  }

  extractDependencies(serviceClass) {
    // Simplified dependency extraction
    // In real implementation, would use decorators or parameter metadata
    const deps = serviceClass.$inject || [];
    return deps.map(dep => this.resolve(dep));
  }
}

export default ServiceContainer;