/**
 * Service Container with Dependency Injection - SPARC Specification Phase
 * 
 * SPECIFICATIONS:
 * - Hierarchical dependency injection with scoping
 * - Service lifecycle management (singleton, transient, scoped)
 * - Circular dependency detection and resolution
 * - Constructor and property injection support
 * - Factory and provider pattern implementations
 * - Service discovery and registration
 * - Lazy loading and initialization
 * - Cross-plugin service sharing
 */

export type ServiceScope = 'singleton' | 'transient' | 'scoped' | 'request';
export type InjectionToken<T = any> = string | symbol | Function;

export interface ServiceDefinition<T = any> {
  token: InjectionToken<T>;
  factory?: () => T;
  useClass?: new (...args: any[]) => T;
  useValue?: T;
  useFactory?: (...dependencies: any[]) => T;
  scope: ServiceScope;
  dependencies?: InjectionToken[];
  lazy?: boolean;
  metadata?: ServiceMetadata;
}

export interface ServiceMetadata {
  description?: string;
  version?: string;
  tags?: string[];
  pluginId?: string;
  permissions?: Permission[];
}

export interface IServiceContainer {
  // Service registration
  register<T>(definition: ServiceDefinition<T>): void;
  registerSingleton<T>(token: InjectionToken<T>, implementation: new (...args: any[]) => T): void;
  registerTransient<T>(token: InjectionToken<T>, implementation: new (...args: any[]) => T): void;
  registerFactory<T>(token: InjectionToken<T>, factory: () => T): void;
  registerValue<T>(token: InjectionToken<T>, value: T): void;
  
  // Service resolution
  get<T>(token: InjectionToken<T>): T;
  getOptional<T>(token: InjectionToken<T>): T | null;
  getAll<T>(token: InjectionToken<T>): T[];
  
  // Dependency injection
  resolve<T>(target: new (...args: any[]) => T): T;
  create<T>(token: InjectionToken<T>, overrides?: Partial<ServiceDefinition<T>>): T;
  
  // Container management
  createChild(): IServiceContainer;
  dispose(): Promise<void>;
  
  // Service discovery
  has(token: InjectionToken): boolean;
  getRegistrations(): ServiceDefinition[];
  findByTag(tag: string): ServiceDefinition[];
  findByPlugin(pluginId: string): ServiceDefinition[];
  
  // Events
  onServiceRegistered(callback: (definition: ServiceDefinition) => void): void;
  onServiceResolved(callback: (token: InjectionToken, instance: any) => void): void;
  onServiceDisposed(callback: (token: InjectionToken) => void): void;
}

export interface IDependencyResolver {
  resolveDependencies(token: InjectionToken): InjectionToken[];
  detectCircularDependencies(token: InjectionToken): string[];
  buildDependencyGraph(): DependencyGraph;
  validateDependencies(): ValidationResult[];
}

export interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
}

export interface DependencyNode {
  token: InjectionToken;
  scope: ServiceScope;
  pluginId?: string;
  dependencies: InjectionToken[];
}

export interface DependencyEdge {
  from: InjectionToken;
  to: InjectionToken;
  optional: boolean;
}

export interface ServiceInstance<T = any> {
  token: InjectionToken<T>;
  instance: T;
  scope: ServiceScope;
  created: Date;
  accessed: Date;
  pluginId?: string;
}

// Decorators for dependency injection
export function Injectable(metadata?: ServiceMetadata): ClassDecorator;
export function Inject(token: InjectionToken): ParameterDecorator;
export function Optional(): ParameterDecorator;
export function Self(): ParameterDecorator;
export function SkipSelf(): ParameterDecorator;

// SPARC SPECIFICATION ANALYSIS:
// 1. Hierarchical injection enables plugin isolation
// 2. Multiple service scopes support different lifecycle needs
// 3. Circular dependency detection prevents runtime errors
// 4. Factory patterns enable complex service creation
// 5. Service discovery allows runtime plugin integration
// 6. Lazy loading optimizes memory usage
// 7. Cross-plugin sharing enables modular architecture
// 8. Event-driven notifications support plugin coordination