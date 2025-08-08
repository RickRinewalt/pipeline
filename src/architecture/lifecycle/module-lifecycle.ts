/**
 * Module Lifecycle Management System - SPARC Specification Phase
 * 
 * SPECIFICATIONS:
 * - State machine-based lifecycle management
 * - Graceful loading and unloading sequences
 * - Dependency-aware initialization ordering
 * - Error recovery and rollback mechanisms
 * - Health monitoring and diagnostics
 * - Resource cleanup and memory management
 * - Hot-reload capabilities with state preservation
 * - Plugin coordination and synchronization
 */

export enum ModuleState {
  UNKNOWN = 'unknown',
  DISCOVERED = 'discovered',
  VALIDATED = 'validated',
  LOADING = 'loading',
  LOADED = 'loaded',
  INITIALIZING = 'initializing',
  INITIALIZED = 'initialized',
  STARTING = 'starting',
  RUNNING = 'running',
  PAUSING = 'pausing',
  PAUSED = 'paused',
  STOPPING = 'stopping',
  STOPPED = 'stopped',
  UNLOADING = 'unloading',
  UNLOADED = 'unloaded',
  ERROR = 'error',
  FAILED = 'failed'
}

export interface IModuleLifecycle {
  // State management
  getCurrentState(moduleId: string): ModuleState;
  getStateHistory(moduleId: string): StateTransition[];
  getAllStates(): Map<string, ModuleState>;
  
  // Lifecycle operations
  load(moduleId: string, options?: LoadOptions): Promise<void>;
  unload(moduleId: string, options?: UnloadOptions): Promise<void>;
  reload(moduleId: string, options?: ReloadOptions): Promise<void>;
  
  // Module control
  start(moduleId: string): Promise<void>;
  stop(moduleId: string): Promise<void>;
  pause(moduleId: string): Promise<void>;
  resume(moduleId: string): Promise<void>;
  restart(moduleId: string): Promise<void>;
  
  // Batch operations
  loadMultiple(moduleIds: string[], options?: BatchOptions): Promise<BatchResult>;
  startDependencyChain(moduleId: string): Promise<void>;
  stopDependencyChain(moduleId: string, options?: StopOptions): Promise<void>;
  
  // Health and diagnostics
  checkHealth(moduleId: string): Promise<HealthStatus>;
  diagnose(moduleId: string): Promise<DiagnosticResult>;
  getMetrics(moduleId: string): ModuleMetrics;
  
  // Event handling
  on(event: LifecycleEvent, listener: LifecycleEventHandler): void;
  off(event: LifecycleEvent, listener: LifecycleEventHandler): void;
  emit(event: LifecycleEvent, data: LifecycleEventData): void;
}

export interface StateTransition {
  from: ModuleState;
  to: ModuleState;
  timestamp: Date;
  duration: number;
  success: boolean;
  error?: Error;
  metadata?: any;
}

export interface LoadOptions {
  force?: boolean;
  skipDependencies?: boolean;
  timeout?: number;
  retries?: number;
  rollbackOnFailure?: boolean;
  validateOnly?: boolean;
  preserveState?: boolean;
}

export interface UnloadOptions {
  force?: boolean;
  timeout?: number;
  cleanup?: boolean;
  preserveData?: boolean;
  graceful?: boolean;
}

export interface ReloadOptions extends LoadOptions {
  preserveConnections?: boolean;
  hotSwap?: boolean;
  backupState?: boolean;
}

export interface BatchOptions {
  parallel?: boolean;
  continueOnError?: boolean;
  maxConcurrency?: number;
  timeout?: number;
  order?: 'dependency' | 'priority' | 'alphabetical';
}

export interface StopOptions {
  cascade?: boolean;
  timeout?: number;
  force?: boolean;
  preserveState?: boolean;
}

export interface BatchResult {
  successful: string[];
  failed: Array<{
    moduleId: string;
    error: Error;
  }>;
  skipped: string[];
  duration: number;
}

export interface HealthStatus {
  healthy: boolean;
  score: number; // 0-100
  checks: HealthCheck[];
  lastCheck: Date;
  issues: HealthIssue[];
}

export interface HealthCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message?: string;
  duration: number;
  metadata?: any;
}

export interface HealthIssue {
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'performance' | 'memory' | 'network' | 'dependency' | 'configuration';
  message: string;
  recommendation?: string;
}

export interface DiagnosticResult {
  moduleId: string;
  state: ModuleState;
  uptime: number;
  memoryUsage: MemoryUsage;
  dependencies: DependencyStatus[];
  resources: ResourceUsage[];
  events: RecentEvent[];
  configuration: ConfigurationStatus;
  errors: ErrorSummary[];
}

export interface MemoryUsage {
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
}

export interface DependencyStatus {
  moduleId: string;
  required: boolean;
  version: string;
  state: ModuleState;
  healthy: boolean;
}

export interface ResourceUsage {
  type: 'cpu' | 'memory' | 'network' | 'filesystem' | 'database';
  usage: number;
  limit?: number;
  unit: string;
}

export interface RecentEvent {
  type: string;
  timestamp: Date;
  data?: any;
}

export interface ConfigurationStatus {
  valid: boolean;
  source: string;
  lastUpdated: Date;
  errors: string[];
  warnings: string[];
}

export interface ErrorSummary {
  count: number;
  lastOccurrence: Date;
  message: string;
  stack?: string;
}

export interface ModuleMetrics {
  startTime: Date;
  uptime: number;
  stateChanges: number;
  errorCount: number;
  restartCount: number;
  averageResponseTime: number;
  throughput: number;
  resourceUsage: ResourceUsage[];
}

export type LifecycleEvent = 
  | 'module-loading'
  | 'module-loaded'
  | 'module-starting'
  | 'module-started'
  | 'module-stopping'
  | 'module-stopped'
  | 'module-error'
  | 'dependency-resolved'
  | 'health-check'
  | 'state-changed';

export type LifecycleEventHandler = (data: LifecycleEventData) => void;

export interface LifecycleEventData {
  moduleId: string;
  state?: ModuleState;
  previousState?: ModuleState;
  timestamp: Date;
  duration?: number;
  error?: Error;
  metadata?: any;
}

// SPARC SPECIFICATION ANALYSIS:
// 1. State machine ensures predictable lifecycle transitions
// 2. Dependency-aware ordering prevents initialization conflicts
// 3. Error recovery enables resilient system operation
// 4. Health monitoring provides operational visibility
// 5. Resource cleanup prevents memory leaks
// 6. Hot-reload enables development workflow
// 7. Batch operations improve efficiency
// 8. Event-driven architecture enables loose coupling