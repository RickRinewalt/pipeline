/**
 * End-to-end architectural validation tests
 * Tests complete system functionality from initialization to complex workflows
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModularEngine } from '../../src/architecture/ModularEngine.js';
import fs from 'fs/promises';
import path from 'path';

describe('End-to-End Architectural Validation', () => {
  let engine;
  let tempDir;

  beforeEach(async () => {
    // Create temporary directory for test artifacts
    tempDir = path.join(process.cwd(), `e2e-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    engine = new ModularEngine({
      enableHotSwap: true,
      enableMarketplace: false,
      securityLevel: 'moderate',
      maxConcurrentPlugins: 50
    });

    // Configure paths for testing
    engine.pluginManager.config.pluginDirs = [path.join(tempDir, 'plugins')];
    engine.moduleConfig.config.configDir = path.join(tempDir, 'config');
    engine.moduleConfig.config.secretsDir = path.join(tempDir, 'secrets');
  });

  afterEach(async () => {
    if (engine.isInitialized) {
      await engine.shutdown();
    }
    
    // Cleanup temporary files
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Cleanup failed:', error.message);
    }
  });

  describe('Complete System Lifecycle', () => {
    it('should support full enterprise plugin ecosystem lifecycle', async () => {
      await engine.initialize();
      
      // 1. Create plugin ecosystem structure
      const pluginDir = path.join(tempDir, 'plugins');
      await fs.mkdir(pluginDir, { recursive: true });
      
      const configDir = path.join(tempDir, 'config');
      await fs.mkdir(configDir, { recursive: true });

      // 2. Create core infrastructure plugin
      await createPlugin(pluginDir, 'core-infrastructure', {
        name: 'Core Infrastructure',
        version: '1.0.0',
        main: 'index.js',
        permissions: ['filesystem', 'network'],
        provides: ['logger', 'database', 'cache']
      }, `
        export default class CoreInfrastructure {
          constructor(engine) {
            this.engine = engine;
            this.services = new Map();
          }
          
          async initialize() {
            // Register infrastructure services
            this.engine.serviceContainer.registerSingleton('logger', () => ({
              log: (level, message) => console.log(\`[\${level}] \${message}\`),
              error: (message) => console.error(\`[ERROR] \${message}\`),
              info: (message) => console.log(\`[INFO] \${message}\`)
            }));
            
            this.engine.serviceContainer.registerSingleton('database', () => ({
              query: async (sql) => ({ results: [], sql }),
              connect: async () => ({ connected: true }),
              disconnect: async () => ({ connected: false })
            }));
            
            this.engine.serviceContainer.registerSingleton('cache', () => {
              const cache = new Map();
              return {
                get: (key) => cache.get(key),
                set: (key, value, ttl = 300000) => {
                  cache.set(key, { value, expires: Date.now() + ttl });
                  return true;
                },
                delete: (key) => cache.delete(key),
                clear: () => cache.clear()
              };
            });
            
            return true;
          }
          
          getStatus() {
            return {
              services: Array.from(this.services.keys()),
              health: 'operational'
            };
          }
        }
      `);

      // 3. Create business logic plugin
      await createPlugin(pluginDir, 'user-management', {
        name: 'User Management',
        version: '1.0.0',
        main: 'index.js',
        dependencies: [{ name: 'core-infrastructure' }],
        permissions: ['network'],
        provides: ['userService']
      }, `
        export default class UserManagement {
          constructor(engine) {
            this.engine = engine;
            this.users = new Map();
          }
          
          async initialize() {
            this.logger = await this.engine.serviceContainer.resolve('logger');
            this.database = await this.engine.serviceContainer.resolve('database');
            this.cache = await this.engine.serviceContainer.resolve('cache');
            
            this.engine.serviceContainer.registerSingleton('userService', () => ({
              createUser: (userData) => this.createUser(userData),
              getUser: (userId) => this.getUser(userId),
              updateUser: (userId, updates) => this.updateUser(userId, updates),
              deleteUser: (userId) => this.deleteUser(userId),
              listUsers: () => this.listUsers()
            }));
            
            this.logger.info('User Management initialized');
            return true;
          }
          
          async createUser(userData) {
            const userId = 'user_' + Date.now();
            const user = { ...userData, id: userId, created: new Date() };
            
            await this.database.query('INSERT INTO users...');
            this.cache.set(\`user:\${userId}\`, user);
            this.users.set(userId, user);
            
            this.logger.info(\`User created: \${userId}\`);
            return user;
          }
          
          async getUser(userId) {
            let user = this.cache.get(\`user:\${userId}\`);
            if (!user) {
              user = this.users.get(userId);
              if (user) {
                this.cache.set(\`user:\${userId}\`, user);
              }
            }
            return user?.value || user;
          }
          
          async updateUser(userId, updates) {
            const user = await this.getUser(userId);
            if (user) {
              Object.assign(user, updates);
              this.users.set(userId, user);
              this.cache.set(\`user:\${userId}\`, user);
              this.logger.info(\`User updated: \${userId}\`);
              return user;
            }
            return null;
          }
          
          async deleteUser(userId) {
            const deleted = this.users.delete(userId);
            this.cache.delete(\`user:\${userId}\`);
            if (deleted) {
              this.logger.info(\`User deleted: \${userId}\`);
            }
            return deleted;
          }
          
          listUsers() {
            return Array.from(this.users.values());
          }
        }
      `);

      // 4. Create API layer plugin
      await createPlugin(pluginDir, 'api-gateway', {
        name: 'API Gateway',
        version: '1.0.0',
        main: 'index.js',
        dependencies: [{ name: 'user-management' }],
        permissions: ['network'],
        provides: ['apiServer']
      }, `
        export default class ApiGateway {
          constructor(engine) {
            this.engine = engine;
            this.routes = new Map();
            this.middleware = [];
          }
          
          async initialize() {
            this.logger = await this.engine.serviceContainer.resolve('logger');
            this.userService = await this.engine.serviceContainer.resolve('userService');
            
            this.setupRoutes();
            
            this.engine.serviceContainer.registerSingleton('apiServer', () => ({
              start: () => this.start(),
              stop: () => this.stop(),
              addRoute: (path, handler) => this.addRoute(path, handler),
              handleRequest: (req) => this.handleRequest(req)
            }));
            
            // Subscribe to system events
            this.engine.moduleBridge.subscribe(
              'api-gateway',
              'system-events',
              (message) => this.handleSystemEvent(message)
            );
            
            this.logger.info('API Gateway initialized');
            return true;
          }
          
          setupRoutes() {
            this.routes.set('GET /users', () => this.userService.listUsers());
            this.routes.set('POST /users', (data) => this.userService.createUser(data));
            this.routes.set('GET /users/:id', (params) => this.userService.getUser(params.id));
            this.routes.set('PUT /users/:id', (params, data) => 
              this.userService.updateUser(params.id, data)
            );
            this.routes.set('DELETE /users/:id', (params) => 
              this.userService.deleteUser(params.id)
            );
          }
          
          async handleRequest(request) {
            const routeKey = \`\${request.method} \${request.path}\`;
            const handler = this.routes.get(routeKey);
            
            if (handler) {
              try {
                const result = await handler(request.params, request.body);
                this.logger.info(\`API request handled: \${routeKey}\`);
                return { status: 200, data: result };
              } catch (error) {
                this.logger.error(\`API error: \${error.message}\`);
                return { status: 500, error: error.message };
              }
            }
            
            return { status: 404, error: 'Route not found' };
          }
          
          handleSystemEvent(message) {
            this.logger.info(\`System event received: \${message.type}\`);
          }
          
          start() {
            this.logger.info('API Gateway started');
            return { status: 'started', port: 3000 };
          }
          
          stop() {
            this.logger.info('API Gateway stopped');
            return { status: 'stopped' };
          }
        }
      `);

      // 5. Create monitoring plugin
      await createPlugin(pluginDir, 'system-monitor', {
        name: 'System Monitor',
        version: '1.0.0',
        main: 'index.js',
        permissions: ['network'],
        provides: ['monitoring']
      }, `
        export default class SystemMonitor {
          constructor(engine) {
            this.engine = engine;
            this.metrics = new Map();
            this.alerts = [];
          }
          
          async initialize() {
            this.logger = await this.engine.serviceContainer.resolve('logger');
            
            // Start monitoring loop
            this.monitorInterval = setInterval(() => {
              this.collectMetrics();
            }, 5000);
            
            // Subscribe to all system events for monitoring
            this.engine.moduleBridge.subscribe(
              'system-monitor',
              'global',
              (message) => this.recordEvent(message)
            );
            
            this.engine.serviceContainer.registerSingleton('monitoring', () => ({
              getMetrics: () => this.getMetrics(),
              getAlerts: () => this.getAlerts(),
              createAlert: (alert) => this.createAlert(alert)
            }));
            
            this.logger.info('System Monitor initialized');
            return true;
          }
          
          collectMetrics() {
            const engineMetrics = this.engine.getMetrics();
            const timestamp = Date.now();
            
            this.metrics.set(timestamp, {
              timestamp,
              engine: engineMetrics,
              memory: process.memoryUsage(),
              uptime: process.uptime()
            });
            
            // Keep only last 100 metric snapshots
            if (this.metrics.size > 100) {
              const oldest = Math.min(...this.metrics.keys());
              this.metrics.delete(oldest);
            }
            
            // Check for alerts
            if (engineMetrics.modulesFailed > 0) {
              this.createAlert({
                type: 'module_failure',
                message: \`\${engineMetrics.modulesFailed} modules have failed\`,
                severity: 'high'
              });
            }
          }
          
          recordEvent(message) {
            // Record system events for analysis
            this.logger.info(\`Event recorded: \${message.type || 'unknown'}\`);
          }
          
          createAlert(alert) {
            const alertWithTimestamp = {
              ...alert,
              id: 'alert_' + Date.now(),
              timestamp: Date.now()
            };
            
            this.alerts.push(alertWithTimestamp);
            this.logger.error(\`ALERT: \${alert.message}\`);
            
            // Keep only last 50 alerts
            if (this.alerts.length > 50) {
              this.alerts.shift();
            }
            
            return alertWithTimestamp;
          }
          
          getMetrics() {
            return Array.from(this.metrics.values());
          }
          
          getAlerts() {
            return [...this.alerts];
          }
          
          async cleanup() {
            if (this.monitorInterval) {
              clearInterval(this.monitorInterval);
            }
          }
        }
      `);

      // 6. Discover and load all plugins
      await engine.pluginManager.discoverPlugins();
      
      expect(engine.pluginManager.registry.discovered.size).toBe(4);

      // 7. Load plugins in dependency order
      const corePlugin = await engine.pluginManager.loadPlugin('core-infrastructure');
      const userPlugin = await engine.pluginManager.loadPlugin('user-management');
      const apiPlugin = await engine.pluginManager.loadPlugin('api-gateway');
      const monitorPlugin = await engine.pluginManager.loadPlugin('system-monitor');

      // 8. Test complete system integration
      
      // Test service resolution
      const logger = await engine.serviceContainer.resolve('logger');
      const userService = await engine.serviceContainer.resolve('userService');
      const apiServer = await engine.serviceContainer.resolve('apiServer');
      const monitoring = await engine.serviceContainer.resolve('monitoring');

      expect(logger).toBeDefined();
      expect(userService).toBeDefined();
      expect(apiServer).toBeDefined();
      expect(monitoring).toBeDefined();

      // Test business logic flow
      const user = await userService.createUser({ name: 'John Doe', email: 'john@example.com' });
      expect(user).toBeDefined();
      expect(user.id).toBeDefined();

      const retrievedUser = await userService.getUser(user.id);
      expect(retrievedUser.name).toBe('John Doe');

      // Test API layer
      const apiResponse = await apiServer.handleRequest({
        method: 'GET',
        path: '/users',
        params: {},
        body: null
      });
      
      expect(apiResponse.status).toBe(200);
      expect(apiResponse.data).toHaveLength(1);
      expect(apiResponse.data[0].name).toBe('John Doe');

      // Test monitoring
      await new Promise(resolve => setTimeout(resolve, 100)); // Allow metrics collection
      const metrics = monitoring.getMetrics();
      expect(metrics.length).toBeGreaterThan(0);

      // 9. Test system reconfiguration
      await engine.moduleConfig.setConfig('user-management', 'maxUsers', 1000);
      const config = engine.moduleConfig.getConfig('user-management', 'maxUsers');
      expect(config).toBe(1000);

      // 10. Test inter-module communication
      await engine.moduleBridge.sendMessage(
        'test-system',
        'system-events',
        { type: 'user_created', userId: user.id }
      );

      // Allow time for message processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // 11. Test hot swapping with maintained functionality
      const updatedUserManagement = {
        ...userPlugin.manifest,
        version: '1.1.0'
      };

      await engine.hotSwapModule('user-management', updatedUserManagement);

      // Verify system still works after hot swap
      const userServiceAfterSwap = await engine.serviceContainer.resolve('userService');
      const usersAfterSwap = userServiceAfterSwap.listUsers();
      expect(usersAfterSwap).toHaveLength(1);

      // 12. Test graceful shutdown
      const shutdownPromise = engine.shutdown();
      expect(shutdownPromise).resolves.toBeUndefined();

      await shutdownPromise;
      expect(engine.isShuttingDown).toBe(true);
    });
  });

  describe('Security and Compliance Validation', () => {
    it('should enforce security policies across complex plugin interactions', async () => {
      await engine.initialize();

      const pluginDir = path.join(tempDir, 'plugins');
      await fs.mkdir(pluginDir, { recursive: true });

      // Create trusted core plugin
      await createPlugin(pluginDir, 'trusted-core', {
        name: 'Trusted Core',
        version: '1.0.0',
        main: 'index.js',
        permissions: ['filesystem', 'network', 'crypto']
      }, `
        export default class TrustedCore {
          async initialize(engine) {
            this.engine = engine;
            
            // Register trusted services
            engine.serviceContainer.registerSingleton('secureStorage', () => ({
              store: (key, value) => ({ stored: true, key }),
              retrieve: (key) => ({ key, value: 'secure-data' }),
              delete: (key) => ({ deleted: true, key })
            }));
            
            return true;
          }
        }
      `);

      // Create restricted plugin
      await createPlugin(pluginDir, 'restricted-plugin', {
        name: 'Restricted Plugin',
        version: '1.0.0',
        main: 'index.js',
        permissions: ['network'] // Limited permissions
      }, `
        export default class RestrictedPlugin {
          async initialize(engine) {
            this.engine = engine;
            this.hasFileAccess = false;
            
            try {
              // Try to access filesystem (should be restricted)
              const fs = require('fs');
              this.hasFileAccess = true;
            } catch (error) {
              this.hasFileAccess = false;
            }
            
            return true;
          }
          
          testSecurityBoundaries() {
            return {
              hasFileAccess: this.hasFileAccess,
              canAccessTrustedServices: this.canAccessTrustedServices()
            };
          }
          
          async canAccessTrustedServices() {
            try {
              const secureStorage = await this.engine.serviceContainer.resolve('secureStorage');
              return !!secureStorage;
            } catch (error) {
              return false;
            }
          }
        }
      `);

      // Trust the core plugin
      engine.moduleSecurity.trustModule('trusted-core', 'System core component');

      await engine.pluginManager.discoverPlugins();

      // Load trusted plugin
      const trustedPlugin = await engine.pluginManager.loadPlugin('trusted-core');
      expect(trustedPlugin).toBeDefined();

      // Load restricted plugin
      const restrictedPlugin = await engine.pluginManager.loadPlugin('restricted-plugin');
      expect(restrictedPlugin).toBeDefined();

      // Test security boundaries
      const securityTest = restrictedPlugin.testSecurityBoundaries();
      
      // Restricted plugin should have limited access
      expect(securityTest.hasFileAccess).toBe(false); // No direct filesystem access
      expect(securityTest.canAccessTrustedServices).toBe(true); // But can use services

      // Verify security reports
      const trustedReport = engine.moduleSecurity.getSecurityReport('trusted-core');
      const restrictedReport = engine.moduleSecurity.getSecurityReport('restricted-plugin');

      expect(trustedReport.trusted).toBe(true);
      expect(trustedReport.permissions.length).toBeGreaterThan(restrictedReport.permissions.length);

      expect(restrictedReport.trusted).toBe(false);
      expect(restrictedReport.permissions).toContain('network');
      expect(restrictedReport.permissions).not.toContain('filesystem');
    });
  });

  describe('Performance and Scalability Validation', () => {
    it('should handle large-scale plugin ecosystem efficiently', async () => {
      await engine.initialize();

      const pluginDir = path.join(tempDir, 'plugins');
      await fs.mkdir(pluginDir, { recursive: true });

      const pluginCount = 25; // Test with 25 plugins
      const plugins = [];

      // Create many lightweight plugins
      for (let i = 0; i < pluginCount; i++) {
        const pluginId = `scale-test-plugin-${i}`;
        
        await createPlugin(pluginDir, pluginId, {
          name: `Scale Test Plugin ${i}`,
          version: '1.0.0',
          main: 'index.js'
        }, `
          export default class ScaleTestPlugin${i} {
            constructor() {
              this.id = ${i};
              this.data = new Array(1000).fill('data-${i}');
            }
            
            async initialize(engine) {
              this.engine = engine;
              
              // Register a service
              engine.serviceContainer.registerSingleton('service${i}', () => ({
                getId: () => this.id,
                getData: () => this.data.length,
                process: (input) => ({ processed: input, by: this.id })
              }));
              
              // Subscribe to a channel
              engine.moduleBridge.subscribe(
                '${pluginId}',
                'broadcast-channel',
                (message) => this.handleMessage(message)
              );
              
              return true;
            }
            
            handleMessage(message) {
              // Simple message processing
              return { received: true, id: this.id };
            }
            
            getStatus() {
              return {
                id: this.id,
                dataSize: this.data.length,
                healthy: true
              };
            }
          }
        `);
        
        plugins.push(pluginId);
      }

      // Measure discovery performance
      const discoveryStart = performance.now();
      await engine.pluginManager.discoverPlugins();
      const discoveryTime = performance.now() - discoveryStart;

      expect(engine.pluginManager.registry.discovered.size).toBe(pluginCount);
      expect(discoveryTime).toBeLessThan(2000); // Under 2 seconds

      // Measure loading performance
      const loadingStart = performance.now();
      const loadingPromises = plugins.map(pluginId => 
        engine.pluginManager.loadPlugin(pluginId)
      );
      
      const loadedPlugins = await Promise.all(loadingPromises);
      const loadingTime = performance.now() - loadingStart;

      expect(loadedPlugins).toHaveLength(pluginCount);
      expect(loadingTime).toBeLessThan(5000); // Under 5 seconds for all plugins

      // Test service resolution performance
      const serviceResolutionStart = performance.now();
      const servicePromises = [];
      
      for (let i = 0; i < pluginCount; i++) {
        servicePromises.push(engine.serviceContainer.resolve(`service${i}`));
      }
      
      const services = await Promise.all(servicePromises);
      const serviceResolutionTime = performance.now() - serviceResolutionStart;

      expect(services).toHaveLength(pluginCount);
      expect(serviceResolutionTime).toBeLessThan(1000); // Under 1 second

      // Test broadcast communication performance
      const broadcastStart = performance.now();
      
      await engine.moduleBridge.sendMessage(
        'scale-test-system',
        'broadcast-channel',
        { type: 'performance-test', timestamp: Date.now() }
      );
      
      const broadcastTime = performance.now() - broadcastStart;
      expect(broadcastTime).toBeLessThan(500); // Under 500ms

      // Test system metrics collection
      const engineMetrics = engine.getMetrics();
      const containerMetrics = engine.serviceContainer.getMetrics();
      const securityMetrics = engine.moduleSecurity.getMetrics();
      const pluginMetrics = engine.pluginManager.getMetrics();
      const bridgeMetrics = engine.moduleBridge.getMetrics();

      expect(engineMetrics.modulesActive).toBe(pluginCount);
      expect(containerMetrics.servicesActive).toBeGreaterThan(pluginCount);
      expect(pluginMetrics.pluginsActive).toBe(pluginCount);
      expect(bridgeMetrics.subscriptionsActive).toBe(pluginCount);

      // Test memory usage
      const memoryUsage = process.memoryUsage();
      expect(memoryUsage.heapUsed).toBeLessThan(200 * 1024 * 1024); // Under 200MB

      console.log('Scale Test Results:');
      console.log(`Plugins loaded: ${pluginCount}`);
      console.log(`Discovery time: ${discoveryTime.toFixed(2)}ms`);
      console.log(`Loading time: ${loadingTime.toFixed(2)}ms`);
      console.log(`Service resolution time: ${serviceResolutionTime.toFixed(2)}ms`);
      console.log(`Broadcast time: ${broadcastTime.toFixed(2)}ms`);
      console.log(`Memory usage: ${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    });
  });

  describe('Resilience and Recovery Validation', () => {
    it('should recover gracefully from various failure scenarios', async () => {
      await engine.initialize();

      const pluginDir = path.join(tempDir, 'plugins');
      await fs.mkdir(pluginDir, { recursive: true });

      // Create reliable core plugin
      await createPlugin(pluginDir, 'reliable-core', {
        name: 'Reliable Core',
        version: '1.0.0',
        main: 'index.js'
      }, `
        export default class ReliableCore {
          async initialize(engine) {
            this.engine = engine;
            this.engine.serviceContainer.registerSingleton('coreService', () => ({
              isHealthy: () => true,
              getVersion: () => '1.0.0'
            }));
            return true;
          }
        }
      `);

      // Create failing plugin
      await createPlugin(pluginDir, 'failing-plugin', {
        name: 'Failing Plugin',
        version: '1.0.0',
        main: 'index.js'
      }, `
        export default class FailingPlugin {
          async initialize(engine) {
            // Simulate random initialization failure
            if (Math.random() > 0.5) {
              throw new Error('Random initialization failure');
            }
            return true;
          }
        }
      `);

      // Create recovery plugin
      await createPlugin(pluginDir, 'recovery-plugin', {
        name: 'Recovery Plugin',
        version: '1.0.0',
        main: 'index.js'
      }, `
        export default class RecoveryPlugin {
          constructor() {
            this.retryCount = 0;
            this.maxRetries = 3;
          }
          
          async initialize(engine) {
            this.engine = engine;
            
            // Simulate failure that eventually succeeds
            this.retryCount++;
            if (this.retryCount < 2) {
              throw new Error(\`Initialization failed (attempt \${this.retryCount})\`);
            }
            
            this.engine.serviceContainer.registerSingleton('recoveryService', () => ({
              getRetryCount: () => this.retryCount,
              canRecover: () => true
            }));
            
            return true;
          }
        }
      `);

      await engine.pluginManager.discoverPlugins();

      // Load reliable core - should succeed
      const corePlugin = await engine.pluginManager.loadPlugin('reliable-core');
      expect(corePlugin).toBeDefined();

      const coreService = await engine.serviceContainer.resolve('coreService');
      expect(coreService.isHealthy()).toBe(true);

      // Test failure handling
      let failingPluginLoaded = false;
      try {
        await engine.pluginManager.loadPlugin('failing-plugin');
        failingPluginLoaded = true;
      } catch (error) {
        expect(error.message).toContain('initialization failure');
      }

      // Core should still be functional regardless of failing plugin
      expect(coreService.isHealthy()).toBe(true);

      // Test recovery mechanism
      let recoveryPlugin;
      let recoveryError;

      // First attempt should fail
      try {
        recoveryPlugin = await engine.pluginManager.loadPlugin('recovery-plugin');
      } catch (error) {
        recoveryError = error;
      }

      expect(recoveryError).toBeDefined();
      expect(recoveryError.message).toContain('Initialization failed (attempt 1)');

      // Second attempt should succeed (due to retry logic in the plugin)
      recoveryPlugin = await engine.pluginManager.loadPlugin('recovery-plugin');
      expect(recoveryPlugin).toBeDefined();

      const recoveryService = await engine.serviceContainer.resolve('recoveryService');
      expect(recoveryService.getRetryCount()).toBe(2);
      expect(recoveryService.canRecover()).toBe(true);

      // Test system health after failures
      const engineMetrics = engine.getMetrics();
      expect(engineMetrics.modulesActive).toBe(2); // Core + Recovery
      expect(engineMetrics.modulesFailed).toBeGreaterThan(0); // At least one failure

      // Test graceful degradation - core services should still work
      expect(coreService.isHealthy()).toBe(true);
      expect(recoveryService.canRecover()).toBe(true);
    });
  });

  // Helper function to create test plugins
  async function createPlugin(pluginDir, pluginId, manifest, code) {
    const pluginPath = path.join(pluginDir, pluginId);
    await fs.mkdir(pluginPath, { recursive: true });
    
    await fs.writeFile(
      path.join(pluginPath, 'plugin.json'),
      JSON.stringify(manifest, null, 2)
    );
    
    await fs.writeFile(
      path.join(pluginPath, 'index.js'),
      code
    );
  }
});