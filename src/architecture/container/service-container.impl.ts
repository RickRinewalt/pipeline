/**
 * Service Container Implementation - SPARC Phase 3 Architecture
 * Production-ready dependency injection container with advanced features
 */

import { EventEmitter } from 'events';
import {
  IServiceContainer,
  ServiceDefinition,
  ServiceScope,
  InjectionToken,
  ServiceInstance,
  IDependencyResolver,
  DependencyGraph
} from './service-container';

export class ServiceContainer extends EventEmitter implements IServiceContainer {
  private services = new Map<InjectionToken, ServiceDefinition>();
  private instances = new Map<InjectionToken, ServiceInstance>();
  private singletons = new Map<InjectionToken, any>();
  private scopedInstances = new Map<string, Map<InjectionToken, any>>();
  private currentScope?: string;
  private dependencyResolver: IDependencyResolver;
  private disposables: Set<any> = new Set();

  constructor(private parent?: IServiceContainer) {
    super();
    this.dependencyResolver = new DependencyResolver(this);
    this.setupErrorHandling();
  }

  register<T>(definition: ServiceDefinition<T>): void {
    // Validate definition
    this.validateServiceDefinition(definition);

    // Check for circular dependencies
    const circularDeps = this.dependencyResolver.detectCircularDependencies(definition.token);
    if (circularDeps.length > 0) {
      throw new Error(`Circular dependency detected: ${circularDeps.join(' -> ')}`);
    }

    // Register the service
    this.services.set(definition.token, definition);
    
    // Emit registration event
    this.emit('serviceRegistered', definition);
    
    console.debug(`Service registered: ${String(definition.token)}`);
  }

  registerSingleton<T>(token: InjectionToken<T>, implementation: new (...args: any[]) => T): void {
    this.register({
      token,
      useClass: implementation,
      scope: 'singleton',
      dependencies: this.extractDependencies(implementation)
    });
  }

  registerTransient<T>(token: InjectionToken<T>, implementation: new (...args: any[]) => T): void {
    this.register({
      token,
      useClass: implementation,
      scope: 'transient',
      dependencies: this.extractDependencies(implementation)
    });
  }

  registerFactory<T>(token: InjectionToken<T>, factory: () => T): void {
    this.register({
      token,
      useFactory: factory,
      scope: 'transient'
    });
  }

  registerValue<T>(token: InjectionToken<T>, value: T): void {
    this.register({
      token,
      useValue: value,
      scope: 'singleton'
    });
  }

  get<T>(token: InjectionToken<T>): T {
    const instance = this.getOptional<T>(token);
    if (instance === null) {
      throw new Error(`Service not found: ${String(token)}`);
    }
    return instance;
  }

  getOptional<T>(token: InjectionToken<T>): T | null {
    try {
      return this.resolveInstance<T>(token);
    } catch (error) {
      if (this.parent) {
        return this.parent.getOptional<T>(token);
      }
      return null;
    }
  }

  getAll<T>(token: InjectionToken<T>): T[] {
    const instances: T[] = [];
    
    // Get instances from current container
    const currentDefinitions = Array.from(this.services.entries())
      .filter(([key]) => key === token)
      .map(([, definition]) => definition);
    
    for (const definition of currentDefinitions) {
      try {
        const instance = this.resolveInstance<T>(definition.token);
        instances.push(instance);
      } catch (error) {
        console.warn(`Failed to resolve instance: ${error.message}`);
      }
    }
    
    // Get instances from parent container
    if (this.parent && 'getAll' in this.parent) {
      const parentInstances = this.parent.getAll<T>(token);
      instances.push(...parentInstances);
    }
    
    return instances;
  }

  resolve<T>(target: new (...args: any[]) => T): T {
    const dependencies = this.extractDependencies(target);
    const resolvedDependencies = dependencies.map(dep => this.get(dep));
    return new target(...resolvedDependencies);
  }

  create<T>(token: InjectionToken<T>, overrides?: Partial<ServiceDefinition<T>>): T {
    const definition = this.services.get(token);
    if (!definition) {
      throw new Error(`Service definition not found: ${String(token)}`);
    }

    const effectiveDefinition = { ...definition, ...overrides };
    return this.createInstance(effectiveDefinition);
  }

  createChild(): IServiceContainer {
    return new ServiceContainer(this);
  }

  async dispose(): Promise<void> {
    // Dispose all disposable instances
    const disposePromises: Promise<void>[] = [];
    
    for (const instance of this.disposables) {
      if (instance && typeof instance.dispose === 'function') {
        disposePromises.push(instance.dispose());
      }
    }
    
    await Promise.all(disposePromises);
    
    // Clear all containers
    this.services.clear();
    this.instances.clear();
    this.singletons.clear();
    this.scopedInstances.clear();
    this.disposables.clear();
    
    console.debug('Service container disposed');
  }

  has(token: InjectionToken): boolean {
    return this.services.has(token) || (this.parent ? this.parent.has(token) : false);
  }

  getRegistrations(): ServiceDefinition[] {
    return Array.from(this.services.values());
  }

  findByTag(tag: string): ServiceDefinition[] {
    return this.getRegistrations().filter(def => 
      def.metadata?.tags?.includes(tag)
    );
  }

  findByPlugin(pluginId: string): ServiceDefinition[] {
    return this.getRegistrations().filter(def => 
      def.metadata?.pluginId === pluginId
    );
  }

  onServiceRegistered(callback: (definition: ServiceDefinition) => void): void {
    this.on('serviceRegistered', callback);
  }

  onServiceResolved(callback: (token: InjectionToken, instance: any) => void): void {
    this.on('serviceResolved', callback);
  }

  onServiceDisposed(callback: (token: InjectionToken) => void): void {
    this.on('serviceDisposed', callback);
  }

  // Scoped operations
  enterScope(scopeId: string): void {
    this.currentScope = scopeId;
    if (!this.scopedInstances.has(scopeId)) {
      this.scopedInstances.set(scopeId, new Map());
    }
  }

  exitScope(scopeId: string): void {
    const scopedMap = this.scopedInstances.get(scopeId);
    if (scopedMap) {
      // Dispose scoped instances
      for (const instance of scopedMap.values()) {
        this.disposeInstance(instance);
      }
      this.scopedInstances.delete(scopeId);
    }
    
    if (this.currentScope === scopeId) {
      this.currentScope = undefined;
    }
  }

  private resolveInstance<T>(token: InjectionToken<T>): T {
    const definition = this.services.get(token);
    if (!definition) {
      throw new Error(`Service not registered: ${String(token)}`);
    }

    // Handle different scopes
    switch (definition.scope) {
      case 'singleton':
        return this.resolveSingleton(definition);
      
      case 'scoped':
        return this.resolveScoped(definition);
      
      case 'transient':
        return this.createInstance(definition);
      
      default:
        throw new Error(`Unknown service scope: ${definition.scope}`);
    }
  }

  private resolveSingleton<T>(definition: ServiceDefinition<T>): T {
    if (this.singletons.has(definition.token)) {
      return this.singletons.get(definition.token);
    }

    const instance = this.createInstance(definition);
    this.singletons.set(definition.token, instance);
    return instance;
  }

  private resolveScoped<T>(definition: ServiceDefinition<T>): T {
    if (!this.currentScope) {
      throw new Error('No active scope for scoped service resolution');
    }

    const scopedMap = this.scopedInstances.get(this.currentScope)!;
    
    if (scopedMap.has(definition.token)) {
      return scopedMap.get(definition.token);
    }

    const instance = this.createInstance(definition);
    scopedMap.set(definition.token, instance);
    return instance;
  }

  private createInstance<T>(definition: ServiceDefinition<T>): T {
    let instance: T;

    try {
      if (definition.useValue !== undefined) {
        instance = definition.useValue;
      } else if (definition.useFactory) {
        const dependencies = (definition.dependencies || []).map(dep => this.get(dep));
        instance = definition.useFactory(...dependencies);
      } else if (definition.useClass) {
        instance = this.resolve(definition.useClass);
      } else if (definition.factory) {
        instance = definition.factory();
      } else {
        throw new Error(`Invalid service definition for ${String(definition.token)}`);
      }

      // Track disposable instances
      if (instance && typeof (instance as any).dispose === 'function') {
        this.disposables.add(instance);
      }

      // Create service instance record
      const serviceInstance: ServiceInstance<T> = {
        token: definition.token,
        instance,
        scope: definition.scope,
        created: new Date(),
        accessed: new Date(),
        pluginId: definition.metadata?.pluginId
      };

      this.instances.set(definition.token, serviceInstance as ServiceInstance);

      // Emit resolution event
      this.emit('serviceResolved', definition.token, instance);

      return instance;

    } catch (error) {
      throw new Error(`Failed to create instance of ${String(definition.token)}: ${error.message}`);
    }
  }

  private validateServiceDefinition<T>(definition: ServiceDefinition<T>): void {
    if (!definition.token) {
      throw new Error('Service definition must have a token');
    }

    const hasImplementation = !!(
      definition.useValue !== undefined ||
      definition.useFactory ||
      definition.useClass ||
      definition.factory
    );

    if (!hasImplementation) {
      throw new Error(`Service definition must specify an implementation for ${String(definition.token)}`);
    }

    if (!definition.scope) {
      throw new Error(`Service definition must specify a scope for ${String(definition.token)}`);
    }
  }

  private extractDependencies(constructor: Function): InjectionToken[] {
    // In a real implementation, this would use reflection or decorators
    // For now, return empty array as placeholder
    const metadata = Reflect.getMetadata?.('design:paramtypes', constructor);
    return metadata || [];
  }

  private disposeInstance(instance: any): void {
    if (instance && typeof instance.dispose === 'function') {
      try {
        instance.dispose();
      } catch (error) {
        console.error('Error disposing instance:', error);
      }
    }
  }

  private setupErrorHandling(): void {
    this.on('error', (error) => {
      console.error('ServiceContainer error:', error);
    });
  }
}

class DependencyResolver implements IDependencyResolver {
  constructor(private container: ServiceContainer) {}

  resolveDependencies(token: InjectionToken): InjectionToken[] {
    const visited = new Set<InjectionToken>();
    const resolved: InjectionToken[] = [];

    const resolve = (currentToken: InjectionToken) => {
      if (visited.has(currentToken)) {
        return;
      }

      visited.add(currentToken);
      const definition = (this.container as any).services.get(currentToken);
      
      if (definition?.dependencies) {
        for (const dep of definition.dependencies) {
          resolve(dep);
          if (!resolved.includes(dep)) {
            resolved.push(dep);
          }
        }
      }
    };

    resolve(token);
    return resolved;
  }

  detectCircularDependencies(token: InjectionToken): string[] {
    const visited = new Set<InjectionToken>();
    const recursionStack = new Set<InjectionToken>();
    const path: InjectionToken[] = [];

    const detectCircular = (currentToken: InjectionToken): boolean => {
      if (recursionStack.has(currentToken)) {
        const circularPath = path.slice(path.indexOf(currentToken));
        circularPath.push(currentToken);
        return true;
      }

      if (visited.has(currentToken)) {
        return false;
      }

      visited.add(currentToken);
      recursionStack.add(currentToken);
      path.push(currentToken);

      const definition = (this.container as any).services.get(currentToken);
      if (definition?.dependencies) {
        for (const dep of definition.dependencies) {
          if (detectCircular(dep)) {
            return true;
          }
        }
      }

      recursionStack.delete(currentToken);
      path.pop();
      return false;
    };

    if (detectCircular(token)) {
      return path.map(t => String(t));
    }

    return [];
  }

  buildDependencyGraph(): DependencyGraph {
    const nodes: any[] = [];
    const edges: any[] = [];

    for (const [token, definition] of (this.container as any).services) {
      nodes.push({
        token,
        scope: definition.scope,
        pluginId: definition.metadata?.pluginId,
        dependencies: definition.dependencies || []
      });

      if (definition.dependencies) {
        for (const dep of definition.dependencies) {
          edges.push({
            from: token,
            to: dep,
            optional: false
          });
        }
      }
    }

    return { nodes, edges };
  }

  validateDependencies(): any[] {
    const validationResults: any[] = [];
    
    for (const [token] of (this.container as any).services) {
      const circularDeps = this.detectCircularDependencies(token);
      if (circularDeps.length > 0) {
        validationResults.push({
          valid: false,
          token,
          errors: [`Circular dependency: ${circularDeps.join(' -> ')}`],
          warnings: []
        });
      }
    }

    return validationResults;
  }
}