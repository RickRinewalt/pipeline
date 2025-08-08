/**
 * Core Plugin Engine - SPARC Specification Phase
 * 
 * SPECIFICATIONS:
 * - Dynamic plugin loading with runtime resolution
 * - Dependency injection container integration
 * - Plugin lifecycle management (load/unload/reload)
 * - Event-driven inter-plugin communication
 * - Security validation and sandboxing
 * - Hot-swapping capabilities for zero-downtime updates
 * - Service discovery and registration
 * - Configuration management per plugin
 */

export interface IPlugin {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly dependencies: string[];
  readonly provides: string[];
  readonly metadata: PluginMetadata;
}

export interface PluginMetadata {
  author: string;
  license: string;
  homepage?: string;
  repository?: string;
  keywords: string[];
  engines: Record<string, string>;
  permissions: Permission[];
  configuration?: ConfigurationSchema;
}

export interface Permission {
  type: 'filesystem' | 'network' | 'system' | 'api' | 'database';
  resource: string;
  actions: string[];
}

export interface ConfigurationSchema {
  properties: Record<string, any>;
  required: string[];
  additionalProperties: boolean;
}

export interface PluginContext {
  readonly pluginId: string;
  readonly services: IServiceContainer;
  readonly events: IEventBus;
  readonly config: IConfiguration;
  readonly logger: ILogger;
  readonly security: ISecurityContext;
}

export interface IPluginEngine {
  // Core lifecycle operations
  loadPlugin(pluginPath: string): Promise<IPlugin>;
  unloadPlugin(pluginId: string): Promise<void>;
  reloadPlugin(pluginId: string): Promise<void>;
  
  // Plugin discovery and management
  discoverPlugins(searchPaths: string[]): Promise<IPlugin[]>;
  getPlugin(pluginId: string): IPlugin | null;
  listPlugins(): IPlugin[];
  
  // Dependency resolution
  resolveDependencies(pluginId: string): Promise<string[]>;
  validateDependencies(plugin: IPlugin): Promise<boolean>;
  
  // Hot-swapping capabilities
  enableHotSwap(pluginId: string): Promise<void>;
  swapPlugin(oldPluginId: string, newPluginPath: string): Promise<void>;
  
  // Security and validation
  validatePlugin(plugin: IPlugin): Promise<ValidationResult>;
  sandboxPlugin(pluginId: string, permissions: Permission[]): Promise<void>;
  
  // Events
  on(event: string, listener: Function): void;
  emit(event: string, ...args: any[]): void;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  securityIssues: SecurityIssue[];
}

export interface SecurityIssue {
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: string;
  description: string;
  recommendation: string;
}

export enum PluginState {
  DISCOVERED = 'discovered',
  LOADING = 'loading',
  LOADED = 'loaded',
  INITIALIZING = 'initializing',
  ACTIVE = 'active',
  PAUSED = 'paused',
  UNLOADING = 'unloading',
  ERROR = 'error'
}

export interface PluginLifecycleEvent {
  pluginId: string;
  previousState: PluginState;
  currentState: PluginState;
  timestamp: Date;
  metadata?: any;
}

// SPARC SPECIFICATION ANALYSIS:
// 1. Plugin loading requires dynamic module resolution
// 2. Dependency injection needs service container integration
// 3. Lifecycle management requires state machine implementation
// 4. Security framework needs sandboxing and permission system
// 5. Hot-swapping requires module replacement without downtime
// 6. Inter-plugin communication needs event-driven architecture
// 7. Configuration management needs schema validation
// 8. Service discovery requires registry pattern