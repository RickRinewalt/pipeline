# API Reference - YOLO-PRO Modular Architecture

## Table of Contents
- [ModularEngine](#modularengine)
- [ServiceContainer](#servicecontainer)
- [PluginManager](#pluginmanager)
- [ModuleLifecycle](#modulelifecycle)
- [ModuleSecurity](#modulesecurity)
- [ModuleConfig](#moduleconfig)
- [ModuleBridge](#modulebridge)
- [ModuleMarketplace](#modulemarketplace)

---

## ModularEngine

The core orchestrator for the modular architecture system.

### Constructor

```javascript
new ModularEngine(config)
```

**Parameters:**
- `config` (Object): Configuration object
  - `enableHotSwap` (Boolean): Enable hot-swapping capabilities (default: true)
  - `securityLevel` ('strict' | 'moderate' | 'permissive'): Security enforcement level
  - `maxConcurrentPlugins` (Number): Maximum number of concurrent plugins
  - `enableMarketplace` (Boolean): Enable marketplace integration

### Methods

#### `initialize()`
Initializes the modular engine and all subsystems.

```javascript
await engine.initialize();
```

**Returns:** `Promise<void>`

#### `loadModule(moduleSpec)`
Loads a module with the specified configuration.

```javascript
const module = await engine.loadModule({
  id: 'my-module',
  name: 'My Module',
  version: '1.0.0',
  factory: () => new MyModule()
});
```

**Parameters:**
- `moduleSpec` (Object): Module specification
  - `id` (String): Unique module identifier
  - `name` (String): Human-readable module name
  - `version` (String): Module version
  - `factory` (Function): Module factory function
  - `dependencies` (Array): Module dependencies

**Returns:** `Promise<Module>`

#### `hotSwapModule(moduleId, newModuleSpec)`
Hot-swaps an existing module with a new version.

```javascript
await engine.hotSwapModule('my-module', {
  id: 'my-module',
  version: '2.0.0',
  factory: () => new MyModuleV2()
});
```

**Parameters:**
- `moduleId` (String): ID of module to swap
- `newModuleSpec` (Object): New module specification

**Returns:** `Promise<void>`

#### `unloadModule(moduleId)`
Unloads a module safely.

```javascript
await engine.unloadModule('my-module');
```

**Parameters:**
- `moduleId` (String): ID of module to unload

**Returns:** `Promise<void>`

#### `getModule(moduleId)`
Retrieves a loaded module by ID.

```javascript
const module = engine.getModule('my-module');
```

**Parameters:**
- `moduleId` (String): Module ID

**Returns:** `Module | undefined`

#### `listModules()`
Lists all loaded modules.

```javascript
const modules = engine.listModules();
```

**Returns:** `Array<ModuleInfo>`

#### `checkModuleHealth(moduleId)`
Checks the health status of a module.

```javascript
const health = await engine.checkModuleHealth('my-module');
```

**Parameters:**
- `moduleId` (String): Module ID

**Returns:** `Promise<HealthStatus>`

#### `getMetrics()`
Returns engine metrics and statistics.

```javascript
const metrics = engine.getMetrics();
```

**Returns:** `EngineMetrics`

#### `shutdown()`
Gracefully shuts down the engine and all modules.

```javascript
await engine.shutdown();
```

**Returns:** `Promise<void>`

### Events

#### `'engine:initializing'`
Emitted when engine initialization starts.

#### `'engine:initialized'`
Emitted when engine initialization completes.

#### `'module:loading'`
Emitted when a module starts loading.

#### `'module:loaded'`
Emitted when a module finishes loading.

#### `'module:hot-swapping'`
Emitted when hot-swapping begins.

#### `'module:hot-swapped'`
Emitted when hot-swapping completes.

#### `'module:unloading'`
Emitted when module unloading starts.

#### `'module:unloaded'`
Emitted when module unloading completes.

#### `'module:error'`
Emitted when a module error occurs.

---

## ServiceContainer

Dependency injection container with multiple service patterns.

### Constructor

```javascript
new ServiceContainer(engine)
```

### Methods

#### `registerSingleton(name, factory, dependencies)`
Registers a singleton service.

```javascript
container.registerSingleton('logger', () => new Logger(), ['config']);
```

**Parameters:**
- `name` (String): Service name
- `factory` (Function): Service factory function
- `dependencies` (Array): Service dependencies

**Returns:** `ServiceContainer` (chainable)

#### `registerTransient(name, factory, dependencies)`
Registers a transient service (new instance each resolution).

```javascript
container.registerTransient('apiClient', () => new ApiClient());
```

**Parameters:**
- `name` (String): Service name
- `factory` (Function): Service factory function
- `dependencies` (Array): Service dependencies

**Returns:** `ServiceContainer` (chainable)

#### `registerFactory(name, factory, dependencies)`
Registers a factory service.

```javascript
container.registerFactory('connectionFactory', () => createConnection);
```

**Parameters:**
- `name` (String): Service name
- `factory` (Function): Service factory function
- `dependencies` (Array): Service dependencies

**Returns:** `ServiceContainer` (chainable)

#### `register(name, instance)`
Registers an existing instance.

```javascript
container.register('config', configInstance);
```

**Parameters:**
- `name` (String): Service name
- `instance` (Any): Service instance

**Returns:** `ServiceContainer` (chainable)

#### `resolve(name, context)`
Resolves a service by name.

```javascript
const logger = await container.resolve('logger');
```

**Parameters:**
- `name` (String): Service name
- `context` (Object): Resolution context (optional)

**Returns:** `Promise<Any>`

#### `resolveAll(names, context)`
Resolves multiple services.

```javascript
const { logger, config } = await container.resolveAll(['logger', 'config']);
```

**Parameters:**
- `names` (Array<String>): Service names
- `context` (Object): Resolution context (optional)

**Returns:** `Promise<Object>`

#### `has(name)`
Checks if a service is registered.

```javascript
const hasLogger = container.has('logger');
```

**Parameters:**
- `name` (String): Service name

**Returns:** `Boolean`

#### `addInterceptor(serviceName, interceptor)`
Adds an interceptor for aspect-oriented programming.

```javascript
container.addInterceptor('logger', (service) => {
  // Add logging wrapper
  return new LoggingProxy(service);
});
```

**Parameters:**
- `serviceName` (String): Service name
- `interceptor` (Function): Interceptor function

#### `createChild()`
Creates a child container with inherited services.

```javascript
const childContainer = container.createChild();
```

**Returns:** `ServiceContainer`

---

## PluginManager

Manages plugin discovery, loading, and marketplace integration.

### Constructor

```javascript
new PluginManager(engine)
```

### Methods

#### `discoverPlugins()`
Discovers plugins in configured directories.

```javascript
await pluginManager.discoverPlugins();
```

**Returns:** `Promise<void>`

#### `loadPlugin(pluginId, options)`
Loads a specific plugin.

```javascript
const plugin = await pluginManager.loadPlugin('my-plugin', {
  config: { enableFeature: true }
});
```

**Parameters:**
- `pluginId` (String): Plugin identifier
- `options` (Object): Loading options

**Returns:** `Promise<Plugin>`

#### `unloadPlugin(pluginId)`
Unloads a plugin safely.

```javascript
await pluginManager.unloadPlugin('my-plugin');
```

**Parameters:**
- `pluginId` (String): Plugin identifier

**Returns:** `Promise<void>`

#### `reloadPlugin(pluginId)`
Hot-reloads a plugin.

```javascript
await pluginManager.reloadPlugin('my-plugin');
```

**Parameters:**
- `pluginId` (String): Plugin identifier

**Returns:** `Promise<void>`

#### `installFromMarketplace(pluginName, version)`
Installs a plugin from the marketplace.

```javascript
const pluginId = await pluginManager.installFromMarketplace('premium-plugin', '2.1.0');
```

**Parameters:**
- `pluginName` (String): Plugin name in marketplace
- `version` (String): Version to install (default: 'latest')

**Returns:** `Promise<String>` (plugin ID)

#### `searchMarketplace(query, options)`
Searches for plugins in the marketplace.

```javascript
const results = await pluginManager.searchMarketplace('authentication', {
  category: 'security',
  minRating: 4.0
});
```

**Parameters:**
- `query` (String): Search query
- `options` (Object): Search options

**Returns:** `Promise<Array<PluginSearchResult>>`

#### `getPlugin(pluginId)`
Gets a loaded plugin instance.

```javascript
const plugin = pluginManager.getPlugin('my-plugin');
```

**Parameters:**
- `pluginId` (String): Plugin identifier

**Returns:** `Plugin | null`

#### `listPlugins(filter)`
Lists plugins by status.

```javascript
const loadedPlugins = pluginManager.listPlugins('loaded');
const allPlugins = pluginManager.listPlugins('all');
```

**Parameters:**
- `filter` ('all' | 'loaded' | 'failed' | 'discovered'): Filter criteria

**Returns:** `Array<PluginInfo>`

---

## ModuleLifecycle

Manages module lifecycle with state preservation and cleanup.

### Constructor

```javascript
new ModuleLifecycle(engine)
```

### Methods

#### `loadModule(moduleSpec, dependencies)`
Loads a module with full lifecycle management.

```javascript
const module = await lifecycle.loadModule(moduleSpec, dependencies);
```

**Parameters:**
- `moduleSpec` (Object): Module specification
- `dependencies` (Array): Resolved dependencies

**Returns:** `Promise<Module>`

#### `unloadModule(module)`
Unloads a module with graceful cleanup.

```javascript
await lifecycle.unloadModule(module);
```

**Parameters:**
- `module` (Module): Module instance

**Returns:** `Promise<void>`

#### `hotSwapModule(moduleId, newModuleSpec)`
Hot-swaps a module maintaining state.

```javascript
await lifecycle.hotSwapModule('my-module', newSpec);
```

**Parameters:**
- `moduleId` (String): Module identifier
- `newModuleSpec` (Object): New module specification

**Returns:** `Promise<void>`

#### `getModuleState(moduleId)`
Gets the current state of a module.

```javascript
const state = lifecycle.getModuleState('my-module');
```

**Parameters:**
- `moduleId` (String): Module identifier

**Returns:** `String` (module state)

#### `registerHook(phase, callback)`
Registers a lifecycle hook.

```javascript
lifecycle.registerHook('preLoad', async (moduleId, spec) => {
  console.log(`Loading ${moduleId}`);
});
```

**Parameters:**
- `phase` (String): Lifecycle phase
- `callback` (Function): Hook callback

#### `registerCleanupTask(moduleId, task)`
Registers a cleanup task for a module.

```javascript
lifecycle.registerCleanupTask('my-module', async () => {
  await cleanupResources();
});
```

**Parameters:**
- `moduleId` (String): Module identifier
- `task` (Function): Cleanup task

---

## ModuleSecurity

Security framework with validation and sandboxing.

### Constructor

```javascript
new ModuleSecurity(engine)
```

### Methods

#### `validateModule(moduleSpec)`
Validates a module against security policies.

```javascript
const result = await security.validateModule(moduleSpec);
if (result.valid) {
  console.log('Module is secure');
} else {
  console.error('Security violation:', result.reason);
}
```

**Parameters:**
- `moduleSpec` (Object): Module specification

**Returns:** `Promise<ValidationResult>`

#### `createSecureSandbox(moduleId, permissions)`
Creates a secure sandbox for module execution.

```javascript
const sandbox = security.createSecureSandbox('my-module', [
  'network', 'crypto'
]);
```

**Parameters:**
- `moduleId` (String): Module identifier
- `permissions` (Array<String>): Granted permissions

**Returns:** `Object | null` (sandbox or null if disabled)

#### `startRuntimeMonitoring(moduleId, module)`
Starts runtime security monitoring.

```javascript
const monitor = security.startRuntimeMonitoring('my-module', moduleInstance);
```

**Parameters:**
- `moduleId` (String): Module identifier
- `module` (Module): Module instance

**Returns:** `Monitor`

#### `stopRuntimeMonitoring(moduleId)`
Stops runtime monitoring.

```javascript
security.stopRuntimeMonitoring('my-module');
```

**Parameters:**
- `moduleId` (String): Module identifier

#### `setModulePermissions(moduleId, permissions)`
Sets permissions for a module.

```javascript
security.setModulePermissions('my-module', ['network', 'filesystem']);
```

**Parameters:**
- `moduleId` (String): Module identifier
- `permissions` (Array<String>): Permission list

#### `hasPermission(moduleId, permission)`
Checks if a module has a specific permission.

```javascript
const canNetwork = security.hasPermission('my-module', 'network');
```

**Parameters:**
- `moduleId` (String): Module identifier
- `permission` (String): Permission to check

**Returns:** `Boolean`

#### `trustModule(moduleId, reason)`
Adds a module to the trusted list.

```javascript
security.trustModule('core-module', 'System component');
```

**Parameters:**
- `moduleId` (String): Module identifier
- `reason` (String): Trust reason

#### `banModule(moduleId, reason)`
Bans a module from loading.

```javascript
security.banModule('malicious-module', 'Security violation detected');
```

**Parameters:**
- `moduleId` (String): Module identifier
- `reason` (String): Ban reason

#### `getSecurityReport(moduleId)`
Gets a comprehensive security report for a module.

```javascript
const report = security.getSecurityReport('my-module');
```

**Parameters:**
- `moduleId` (String): Module identifier

**Returns:** `SecurityReport`

---

## ModuleConfig

Configuration management with hot-reloading and validation.

### Constructor

```javascript
new ModuleConfig(engine)
```

### Methods

#### `getConfig(moduleId, key, defaultValue)`
Gets configuration value(s) for a module.

```javascript
// Get entire config
const config = moduleConfig.getConfig('my-module');

// Get specific key
const value = moduleConfig.getConfig('my-module', 'database.host', 'localhost');
```

**Parameters:**
- `moduleId` (String): Module identifier
- `key` (String): Configuration key (optional, dot-notation supported)
- `defaultValue` (Any): Default value if key not found

**Returns:** `Any`

#### `setConfig(moduleId, key, value, persist)`
Sets a configuration value.

```javascript
await moduleConfig.setConfig('my-module', 'feature.enabled', true, true);
```

**Parameters:**
- `moduleId` (String): Module identifier
- `key` (String): Configuration key (dot-notation supported)
- `value` (Any): Value to set
- `persist` (Boolean): Whether to persist to file

**Returns:** `Promise<void>`

#### `registerValidator(moduleId, validator)`
Registers a configuration validator.

```javascript
moduleConfig.registerValidator('my-module', (config) => {
  return config.port > 0 && config.port < 65536;
});
```

**Parameters:**
- `moduleId` (String): Module identifier
- `validator` (Function): Validation function

#### `loadConfigFromFile(filePath, type)`
Loads configuration from a file.

```javascript
const config = await moduleConfig.loadConfigFromFile('/path/to/config.json');
```

**Parameters:**
- `filePath` (String): Path to configuration file
- `type` (String): Configuration type

**Returns:** `Promise<Object>`

#### `saveConfigToFile(config, filePath)`
Saves configuration to a file.

```javascript
await moduleConfig.saveConfigToFile(config, '/path/to/config.json');
```

**Parameters:**
- `config` (Object): Configuration to save
- `filePath` (String): Target file path

**Returns:** `Promise<void>`

#### `getEnvironmentConfig(key, defaultValue)`
Gets environment-specific configuration.

```javascript
const dbHost = moduleConfig.getEnvironmentConfig('DATABASE_HOST', 'localhost');
```

**Parameters:**
- `key` (String): Environment key
- `defaultValue` (Any): Default value

**Returns:** `Any`

#### `setEnvironmentVariable(key, value, persist)`
Sets an environment variable.

```javascript
moduleConfig.setEnvironmentVariable('API_KEY', 'secret', true);
```

**Parameters:**
- `key` (String): Variable key
- `value` (String): Variable value
- `persist` (Boolean): Whether to persist

#### `getSecret(key, defaultValue)`
Gets a secret value.

```javascript
const apiKey = moduleConfig.getSecret('api-key', 'default-key');
```

**Parameters:**
- `key` (String): Secret key
- `defaultValue` (Any): Default value

**Returns:** `Any`

#### `setSecret(key, value, persist)`
Sets a secret value.

```javascript
await moduleConfig.setSecret('api-key', 'secret-value', true);
```

**Parameters:**
- `key` (String): Secret key
- `value` (Any): Secret value
- `persist` (Boolean): Whether to persist

**Returns:** `Promise<void>`

---

## ModuleBridge

Inter-module communication system with channels and messaging.

### Constructor

```javascript
new ModuleBridge(engine)
```

### Methods

#### `createChannel(channelName, options)`
Creates a communication channel.

```javascript
const channel = bridge.createChannel('events', {
  persistent: true,
  encrypted: false,
  maxSubscribers: 100
});
```

**Parameters:**
- `channelName` (String): Channel name
- `options` (Object): Channel options

**Returns:** `Channel`

#### `subscribe(moduleId, channelName, handler, options)`
Subscribes to a channel.

```javascript
const subscription = bridge.subscribe('my-module', 'events', (message) => {
  console.log('Received:', message.payload);
}, { priority: 'high' });
```

**Parameters:**
- `moduleId` (String): Module identifier
- `channelName` (String): Channel name
- `handler` (Function): Message handler
- `options` (Object): Subscription options

**Returns:** `Subscription`

#### `unsubscribe(moduleId, channelName)`
Unsubscribes from a channel.

```javascript
bridge.unsubscribe('my-module', 'events');
```

**Parameters:**
- `moduleId` (String): Module identifier
- `channelName` (String): Channel name

**Returns:** `Boolean`

#### `sendMessage(fromModuleId, channelName, message, type, options)`
Sends a message to a channel.

```javascript
const messageId = await bridge.sendMessage(
  'sender-module',
  'events',
  { type: 'user_created', userId: '123' },
  'broadcast',
  { priority: 'high' }
);
```

**Parameters:**
- `fromModuleId` (String): Sender module ID
- `channelName` (String): Target channel
- `message` (Any): Message payload
- `type` (String): Message type
- `options` (Object): Message options

**Returns:** `Promise<String>` (message ID)

#### `sendDirectMessage(fromModuleId, toModuleId, message, options)`
Sends a direct message to a specific module.

```javascript
await bridge.sendDirectMessage('sender', 'receiver', { data: 'hello' });
```

**Parameters:**
- `fromModuleId` (String): Sender module ID
- `toModuleId` (String): Receiver module ID
- `message` (Any): Message payload
- `options` (Object): Message options

**Returns:** `Promise<String>` (message ID)

#### `sendRequest(fromModuleId, channelName, request, timeout)`
Sends a request and waits for response.

```javascript
const response = await bridge.sendRequest('client', 'api', {
  action: 'getData',
  id: '123'
}, 5000);
```

**Parameters:**
- `fromModuleId` (String): Sender module ID
- `channelName` (String): Target channel
- `request` (Any): Request payload
- `timeout` (Number): Timeout in milliseconds

**Returns:** `Promise<Any>` (response)

#### `sendResponse(requestId, response, error)`
Sends a response to a request.

```javascript
await bridge.sendResponse('req_123', { data: 'result' });
```

**Parameters:**
- `requestId` (String): Request ID
- `response` (Any): Response payload
- `error` (Error): Error if request failed

**Returns:** `Promise<void>`

#### `use(middleware)`
Adds middleware for message processing.

```javascript
bridge.use(async (message, direction) => {
  console.log(`${direction} message:`, message.type);
  return message; // Return processed message
});
```

**Parameters:**
- `middleware` (Function): Middleware function

#### `addFilter(channelName, filterFn)`
Adds a message filter.

```javascript
bridge.addFilter('events', (message) => {
  return message.payload.type !== 'debug';
});
```

**Parameters:**
- `channelName` (String): Channel name
- `filterFn` (Function): Filter function

#### `addRouter(pattern, routerFn)`
Adds a message router.

```javascript
bridge.addRouter('api.*', (message) => {
  // Route API messages
  return 'api-handler-channel';
});
```

**Parameters:**
- `pattern` (String): Route pattern
- `routerFn` (Function): Router function

---

## ModuleMarketplace

Plugin marketplace integration with search and installation.

### Constructor

```javascript
new ModuleMarketplace(pluginManager)
```

### Methods

#### `searchPlugins(query, options)`
Searches for plugins in the marketplace.

```javascript
const results = await marketplace.searchPlugins('authentication', {
  category: 'security',
  minRating: 4.0,
  limit: 10
});
```

**Parameters:**
- `query` (String): Search query
- `options` (Object): Search options
  - `category` (String): Plugin category
  - `minRating` (Number): Minimum rating
  - `limit` (Number): Maximum results
  - `sort` (String): Sort order

**Returns:** `Promise<Array<PluginSearchResult>>`

#### `getPluginDetails(pluginId, version)`
Gets detailed information about a plugin.

```javascript
const details = await marketplace.getPluginDetails('auth-plugin', '2.1.0');
```

**Parameters:**
- `pluginId` (String): Plugin identifier
- `version` (String): Plugin version

**Returns:** `Promise<PluginDetails>`

#### `downloadPlugin(pluginId, version)`
Downloads a plugin package.

```javascript
const pluginPackage = await marketplace.downloadPlugin('auth-plugin', 'latest');
```

**Parameters:**
- `pluginId` (String): Plugin identifier
- `version` (String): Plugin version

**Returns:** `Promise<PluginPackage>`

#### `installPlugin(pluginId, version, options)`
Installs a plugin from the marketplace.

```javascript
const installedId = await marketplace.installPlugin('auth-plugin', '2.1.0', {
  force: false,
  backup: true
});
```

**Parameters:**
- `pluginId` (String): Plugin identifier
- `version` (String): Plugin version
- `options` (Object): Installation options

**Returns:** `Promise<String>` (installed plugin ID)

#### `uninstallPlugin(pluginId)`
Uninstalls a plugin.

```javascript
await marketplace.uninstallPlugin('auth-plugin');
```

**Parameters:**
- `pluginId` (String): Plugin identifier

**Returns:** `Promise<void>`

#### `checkUpdates(pluginId)`
Checks for plugin updates.

```javascript
const updates = await marketplace.checkUpdates('auth-plugin');
// or check all plugins
const allUpdates = await marketplace.checkUpdates();
```

**Parameters:**
- `pluginId` (String): Plugin identifier (optional)

**Returns:** `Promise<Array<UpdateInfo>>`

#### `updatePlugin(pluginId, options)`
Updates a plugin to the latest version.

```javascript
await marketplace.updatePlugin('auth-plugin', {
  backup: true,
  force: false
});
```

**Parameters:**
- `pluginId` (String): Plugin identifier
- `options` (Object): Update options

**Returns:** `Promise<void>`

#### `listInstalledPlugins()`
Lists all installed plugins.

```javascript
const installed = marketplace.listInstalledPlugins();
```

**Returns:** `Array<InstalledPluginInfo>`

#### `getInstallationStatus(installationId)`
Gets the status of an ongoing installation.

```javascript
const status = marketplace.getInstallationStatus('install_123');
```

**Parameters:**
- `installationId` (String): Installation identifier

**Returns:** `InstallationStatus | null`

---

## Type Definitions

### Common Types

#### `ModuleInfo`
```typescript
interface ModuleInfo {
  id: string;
  spec: ModuleSpec;
  loadTime: number;
  status: 'loaded' | 'failed';
  version: string;
  dependencies: string[];
  instance: any;
}
```

#### `HealthStatus`
```typescript
interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'not-found';
  uptime?: number;
  version?: string;
  error?: string;
  health?: any;
}
```

#### `EngineMetrics`
```typescript
interface EngineMetrics {
  modulesLoaded: number;
  hotSwapsPerformed: number;
  securityViolations: number;
  modulesActive: number;
  modulesFailed: number;
  uptime: number;
  memoryUsage: NodeJS.MemoryUsage;
}
```

#### `ValidationResult`
```typescript
interface ValidationResult {
  valid: boolean;
  reason?: string;
  securityLevel?: 'strict' | 'moderate' | 'permissive' | 'trusted';
}
```

#### `SecurityReport`
```typescript
interface SecurityReport {
  moduleId: string;
  trusted: boolean;
  banned: boolean;
  permissions: string[];
  violations: SecurityViolation[];
  runtimeMetrics: any;
  securityLevel: string;
}
```

#### `Channel`
```typescript
interface Channel {
  name: string;
  subscribers: Set<Subscription>;
  messageQueue: any[];
  persistent: boolean;
  encrypted: boolean;
  compressed: boolean;
  maxSubscribers: number;
  messageHistory: any[] | null;
  created: number;
}
```

#### `PluginSearchResult`
```typescript
interface PluginSearchResult {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  category: string;
  tags: string[];
  rating: number;
  downloads: number;
  size: number;
  verified: boolean;
  lastUpdated: string;
}
```