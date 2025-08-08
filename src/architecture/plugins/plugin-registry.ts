/**
 * Plugin Discovery and Registration Framework - SPARC Specification Phase
 * 
 * SPECIFICATIONS:
 * - Automatic plugin discovery from multiple sources
 * - Plugin manifest validation and schema checking
 * - Version compatibility and conflict resolution
 * - Plugin metadata indexing and search capabilities
 * - Registry persistence and caching
 * - Remote plugin repository integration
 * - Plugin update and migration support
 * - Multi-tenancy and namespace support
 */

export interface IPluginRegistry {
  // Discovery operations
  discover(searchPaths: string[]): Promise<PluginDescriptor[]>;
  discoverRemote(repositories: RepositoryConfig[]): Promise<PluginDescriptor[]>;
  scan(directory: string, recursive?: boolean): Promise<PluginDescriptor[]>;
  
  // Registration operations
  register(descriptor: PluginDescriptor): Promise<void>;
  unregister(pluginId: string): Promise<void>;
  update(pluginId: string, descriptor: PluginDescriptor): Promise<void>;
  
  // Query operations
  find(criteria: SearchCriteria): PluginDescriptor[];
  findByName(name: string): PluginDescriptor | null;
  findById(id: string): PluginDescriptor | null;
  findByTag(tag: string): PluginDescriptor[];
  findDependents(pluginId: string): PluginDescriptor[];
  findDependencies(pluginId: string): PluginDescriptor[];
  
  // Version management
  getVersions(pluginId: string): PluginVersion[];
  getLatestVersion(pluginId: string): PluginVersion | null;
  checkCompatibility(pluginId: string, version: string): CompatibilityResult;
  resolveVersion(pluginId: string, constraint: string): string | null;
  
  // Validation operations
  validate(descriptor: PluginDescriptor): ValidationResult;
  validateManifest(manifest: PluginManifest): ValidationResult;
  checkConflicts(descriptor: PluginDescriptor): ConflictResult[];
  
  // Registry management
  export(format: 'json' | 'yaml'): Promise<string>;
  import(data: string, format: 'json' | 'yaml'): Promise<void>;
  clear(): Promise<void>;
  sync(): Promise<void>;
}

export interface PluginDescriptor {
  id: string;
  name: string;
  version: string;
  description: string;
  manifest: PluginManifest;
  source: PluginSource;
  metadata: PluginRegistryMetadata;
  status: PluginRegistryStatus;
}

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  main: string;
  author: string | AuthorInfo;
  license: string;
  homepage?: string;
  repository?: RepositoryInfo;
  bugs?: string;
  keywords: string[];
  engines: Record<string, string>;
  dependencies: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  yoloPro?: YoloProConfig;
}

export interface YoloProConfig {
  type: 'plugin' | 'module' | 'extension';
  category: string;
  entry: string;
  exports?: Record<string, string>;
  permissions: Permission[];
  configuration?: ConfigurationSchema;
  lifecycle?: LifecycleHooks;
  compatibility: CompatibilityInfo;
}

export interface LifecycleHooks {
  onLoad?: string;
  onUnload?: string;
  onActivate?: string;
  onDeactivate?: string;
  onConfigure?: string;
  onUpdate?: string;
}

export interface CompatibilityInfo {
  yoloProVersion: string;
  nodeVersion: string;
  platform?: string[];
  arch?: string[];
}

export interface PluginSource {
  type: 'local' | 'remote' | 'git' | 'npm' | 'registry';
  path: string;
  url?: string;
  checksum?: string;
  signature?: string;
}

export interface PluginRegistryMetadata {
  registeredAt: Date;
  updatedAt: Date;
  downloadCount?: number;
  rating?: number;
  tags: string[];
  namespace?: string;
  verified: boolean;
}

export interface PluginRegistryStatus {
  available: boolean;
  installed: boolean;
  enabled: boolean;
  updateAvailable: boolean;
  lastCheck: Date;
}

export interface SearchCriteria {
  query?: string;
  tags?: string[];
  category?: string;
  namespace?: string;
  author?: string;
  minVersion?: string;
  maxVersion?: string;
  platform?: string;
  verified?: boolean;
  limit?: number;
  offset?: number;
  sort?: 'name' | 'version' | 'rating' | 'downloads' | 'updated';
  order?: 'asc' | 'desc';
}

export interface RepositoryConfig {
  name: string;
  url: string;
  type: 'npm' | 'git' | 'registry';
  auth?: AuthConfig;
  priority?: number;
}

export interface AuthConfig {
  type: 'basic' | 'token' | 'oauth' | 'ssh';
  credentials: Record<string, string>;
}

export interface PluginVersion {
  version: string;
  publishedAt: Date;
  deprecated?: boolean;
  changeLog?: string;
  compatibility: CompatibilityInfo;
}

export interface CompatibilityResult {
  compatible: boolean;
  issues: CompatibilityIssue[];
  recommendations: string[];
}

export interface CompatibilityIssue {
  type: 'version' | 'platform' | 'dependency' | 'api';
  severity: 'error' | 'warning' | 'info';
  message: string;
}

export interface ConflictResult {
  type: 'name' | 'version' | 'dependency' | 'resource';
  conflictsWith: string;
  severity: 'error' | 'warning';
  resolution: string[];
}

// SPARC SPECIFICATION ANALYSIS:
// 1. Multi-source discovery enables flexible plugin management
// 2. Manifest validation ensures plugin quality and compatibility
// 3. Version resolution prevents dependency conflicts
// 4. Metadata indexing enables efficient search operations
// 5. Registry persistence supports offline operations
// 6. Remote integration enables plugin marketplace
// 7. Conflict detection prevents system instability
// 8. Namespace support enables multi-tenant architectures