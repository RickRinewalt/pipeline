/**
 * Integration tests for complete modular architecture system
 * Tests the interaction between all components working together
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ModularEngine } from '../../src/architecture/ModularEngine.js';
import fs from 'fs/promises';
import path from 'path';

describe('Modular Architecture Integration Tests', () => {
  let engine;
  let testPluginDir;

  beforeEach(async () => {
    engine = new ModularEngine({
      enableHotSwap: true,
      enableMarketplace: false,
      securityLevel: 'moderate'
    });

    // Create temporary plugin directory for testing
    testPluginDir = path.join(process.cwd(), 'test-plugins');
    await fs.mkdir(testPluginDir, { recursive: true });
    
    engine.pluginManager.config.pluginDirs = [testPluginDir];
    
    await engine.initialize();
  });

  afterEach(async () => {
    await engine.shutdown();
    
    // Cleanup test plugin directory
    try {
      await fs.rm(testPluginDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Full Stack Plugin Lifecycle', () => {
    it('should load, configure, and run a complete plugin', async () => {
      // Create test plugin files
      const pluginId = 'integration-test-plugin';
      const pluginPath = path.join(testPluginDir, pluginId);
      
      await fs.mkdir(pluginPath);
      
      // Create plugin manifest
      const manifest = {
        name: 'Integration Test Plugin',
        version: '1.0.0',
        main: 'index.js',
        permissions: ['network'],
        dependencies: []
      };
      
      await fs.writeFile(
        path.join(pluginPath, 'plugin.json'),
        JSON.stringify(manifest, null, 2)
      );
      
      // Create plugin implementation
      const pluginCode = `
        export default class IntegrationTestPlugin {
          constructor(engine, options) {
            this.engine = engine;
            this.options = options;
            this.initialized = false;
            this.configValue = null;
          }
          
          async initialize(engine, manifest, options) {
            this.initialized = true;
            
            // Subscribe to configuration changes
            this.engine.moduleBridge.subscribe(
              '${pluginId}',
              'config:${pluginId}',
              (message) => {
                this.configValue = message.payload.value;
              }
            );
            
            return true;
          }
          
          async getStatus() {
            return {
              initialized: this.initialized,
              configValue: this.configValue,
              uptime: Date.now() - this.startTime
            };
          }
          
          async checkHealth() {
            return {
              status: 'healthy',
              checks: {
                initialized: this.initialized,
                hasConfig: this.configValue !== null
              }
            };
          }
          
          async cleanup() {
            this.initialized = false;
          }
        }
      `;
      
      await fs.writeFile(path.join(pluginPath, 'index.js'), pluginCode);
      
      // Test plugin discovery
      await engine.pluginManager.discoverPlugins();
      expect(engine.pluginManager.registry.discovered.has(pluginId)).toBe(true);
      
      // Test plugin loading
      const plugin = await engine.pluginManager.loadPlugin(pluginId);
      expect(plugin).toBeDefined();
      expect(plugin.initialized).toBe(true);
      
      // Test configuration system
      await engine.moduleConfig.setConfig(pluginId, 'test.value', 'test-config-value');
      const configValue = engine.moduleConfig.getConfig(pluginId, 'test.value');
      expect(configValue).toBe('test-config-value');
      
      // Test inter-module communication
      await engine.moduleBridge.sendMessage(
        'test-system',
        `config:${pluginId}`,
        { value: 'from-bridge' }
      );
      
      // Allow time for message processing
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Test plugin status
      const status = await plugin.getStatus();
      expect(status.initialized).toBe(true);
      expect(status.configValue).toBe('from-bridge');
      
      // Test health checking
      const health = await engine.checkModuleHealth(pluginId);
      expect(health.status).toBe('healthy');
      
      // Test plugin unloading
      await engine.pluginManager.unloadPlugin(pluginId);
      expect(engine.pluginManager.plugins.has(pluginId)).toBe(false);
    });

    it('should handle plugin dependencies correctly', async () => {
      // Create dependency plugin
      const depId = 'dependency-plugin';
      const depPath = path.join(testPluginDir, depId);
      await fs.mkdir(depPath);
      
      const depManifest = {
        name: 'Dependency Plugin',
        version: '1.0.0',
        main: 'index.js'
      };
      
      await fs.writeFile(
        path.join(depPath, 'plugin.json'),
        JSON.stringify(depManifest, null, 2)
      );
      
      const depCode = `
        export default class DependencyPlugin {
          constructor() {
            this.value = 42;
          }
          
          async initialize() {
            return true;
          }
          
          getValue() {
            return this.value;
          }
        }
      `;
      
      await fs.writeFile(path.join(depPath, 'index.js'), depCode);
      
      // Create dependent plugin
      const mainId = 'dependent-plugin';
      const mainPath = path.join(testPluginDir, mainId);
      await fs.mkdir(mainPath);
      
      const mainManifest = {
        name: 'Dependent Plugin',
        version: '1.0.0',
        main: 'index.js',
        dependencies: [{ name: depId }]
      };
      
      await fs.writeFile(
        path.join(mainPath, 'plugin.json'),
        JSON.stringify(mainManifest, null, 2)
      );
      
      const mainCode = `
        export default class DependentPlugin {
          constructor() {
            this.dependency = null;
          }
          
          async initialize(engine) {
            this.dependency = engine.pluginManager.getPlugin('${depId}');
            return true;
          }
          
          getDependencyValue() {
            return this.dependency ? this.dependency.getValue() : null;
          }
        }
      `;
      
      await fs.writeFile(path.join(mainPath, 'index.js'), mainCode);
      
      // Discover and load plugins
      await engine.pluginManager.discoverPlugins();
      
      const mainPlugin = await engine.pluginManager.loadPlugin(mainId);
      
      // Verify dependency was loaded
      expect(engine.pluginManager.plugins.has(depId)).toBe(true);
      expect(engine.pluginManager.plugins.has(mainId)).toBe(true);
      
      // Verify dependency relationship
      expect(mainPlugin.getDependencyValue()).toBe(42);
    });
  });

  describe('Security Integration', () => {
    it('should enforce security policies across the system', async () => {
      // Create plugin with dangerous code
      const pluginId = 'dangerous-plugin';
      const pluginPath = path.join(testPluginDir, pluginId);
      await fs.mkdir(pluginPath);
      
      const manifest = {
        name: 'Dangerous Plugin',
        version: '1.0.0',
        main: 'index.js'
      };
      
      await fs.writeFile(
        path.join(pluginPath, 'plugin.json'),
        JSON.stringify(manifest, null, 2)
      );
      
      const dangerousCode = `
        export default class DangerousPlugin {
          constructor() {
            // This should trigger security validation
            eval("console.log('dangerous')");
          }
        }
      `;
      
      await fs.writeFile(path.join(pluginPath, 'index.js'), dangerousCode);
      
      await engine.pluginManager.discoverPlugins();
      
      // Should reject dangerous plugin
      await expect(engine.pluginManager.loadPlugin(pluginId))
        .rejects.toThrow('Security validation failed');
      
      expect(engine.pluginManager.plugins.has(pluginId)).toBe(false);
    });

    it('should create and enforce sandboxes', async () => {
      const pluginId = 'sandbox-test-plugin';
      const pluginPath = path.join(testPluginDir, pluginId);
      await fs.mkdir(pluginPath);
      
      const manifest = {
        name: 'Sandbox Test Plugin',
        version: '1.0.0',
        main: 'index.js',
        permissions: ['crypto']
      };
      
      await fs.writeFile(
        path.join(pluginPath, 'plugin.json'),
        JSON.stringify(manifest, null, 2)
      );
      
      const pluginCode = `
        export default class SandboxTestPlugin {
          async initialize(engine) {
            this.engine = engine;
            
            // Create sandbox with crypto permission
            this.sandbox = engine.moduleSecurity.createSecureSandbox(
              '${pluginId}',
              ['crypto']
            );
            
            return true;
          }
          
          testSandbox() {
            if (!this.sandbox) return null;
            
            return {
              hasCrypto: !!this.sandbox.crypto,
              hasFileSystem: !!this.sandbox.fs,
              hasConsole: !!this.sandbox.console
            };
          }
        }
      `;
      
      await fs.writeFile(path.join(pluginPath, 'index.js'), pluginCode);
      
      await engine.pluginManager.discoverPlugins();
      const plugin = await engine.pluginManager.loadPlugin(pluginId);
      
      const sandboxTest = plugin.testSandbox();
      
      expect(sandboxTest.hasCrypto).toBe(true); // Has crypto permission
      expect(sandboxTest.hasFileSystem).toBe(false); // No filesystem permission
      expect(sandboxTest.hasConsole).toBe(true); // Console always available
    });
  });

  describe('Hot Swapping Integration', () => {
    it('should hot-swap plugins while maintaining state', async () => {
      const pluginId = 'hot-swap-plugin';
      const pluginPath = path.join(testPluginDir, pluginId);
      await fs.mkdir(pluginPath);
      
      // Create initial version
      const manifest1 = {
        name: 'Hot Swap Plugin',
        version: '1.0.0',
        main: 'index.js'
      };
      
      await fs.writeFile(
        path.join(pluginPath, 'plugin.json'),
        JSON.stringify(manifest1, null, 2)
      );
      
      const pluginCode1 = `
        export default class HotSwapPlugin {
          constructor() {
            this.version = '1.0.0';
            this.state = { counter: 0 };
          }
          
          async initialize() {
            return true;
          }
          
          increment() {
            this.state.counter++;
            return this.state.counter;
          }
          
          getState() {
            return this.state;
          }
          
          setState(state) {
            this.state = state;
          }
          
          getVersion() {
            return this.version;
          }
        }
      `;
      
      await fs.writeFile(path.join(pluginPath, 'index.js'), pluginCode1);
      
      await engine.pluginManager.discoverPlugins();
      const plugin1 = await engine.pluginManager.loadPlugin(pluginId);
      
      // Modify state
      plugin1.increment();
      plugin1.increment();
      expect(plugin1.increment()).toBe(3);
      expect(plugin1.getVersion()).toBe('1.0.0');
      
      // Create updated version
      const manifest2 = {
        name: 'Hot Swap Plugin',
        version: '2.0.0',
        main: 'index.js'
      };
      
      const pluginCode2 = `
        export default class HotSwapPlugin {
          constructor() {
            this.version = '2.0.0';
            this.state = { counter: 0 };
          }
          
          async initialize(engine, manifest, preservedState) {
            if (preservedState) {
              this.state = preservedState;
            }
            return true;
          }
          
          increment() {
            this.state.counter++;
            return this.state.counter;
          }
          
          getState() {
            return this.state;
          }
          
          setState(state) {
            this.state = state;
          }
          
          getVersion() {
            return this.version;
          }
          
          // New method in v2
          decrement() {
            this.state.counter--;
            return this.state.counter;
          }
        }
      `;
      
      // Update files
      await fs.writeFile(
        path.join(pluginPath, 'plugin.json'),
        JSON.stringify(manifest2, null, 2)
      );
      await fs.writeFile(path.join(pluginPath, 'index.js'), pluginCode2);
      
      // Perform hot swap
      await engine.hotSwapModule(pluginId, {
        id: pluginId,
        name: 'Hot Swap Plugin',
        version: '2.0.0',
        path: path.join(pluginPath, 'index.js')
      });
      
      const plugin2 = engine.getModule(pluginId);
      
      // Verify version updated
      expect(plugin2.getVersion()).toBe('2.0.0');
      
      // Verify state preserved
      expect(plugin2.getState().counter).toBe(3);
      
      // Verify new functionality
      expect(plugin2.decrement()).toBe(2);
    });
  });

  describe('Service Container Integration', () => {
    it('should register and resolve plugin services', async () => {
      const pluginId = 'service-plugin';
      const pluginPath = path.join(testPluginDir, pluginId);
      await fs.mkdir(pluginPath);
      
      const manifest = {
        name: 'Service Plugin',
        version: '1.0.0',
        main: 'index.js'
      };
      
      await fs.writeFile(
        path.join(pluginPath, 'plugin.json'),
        JSON.stringify(manifest, null, 2)
      );
      
      const pluginCode = `
        export default class ServicePlugin {
          async initialize(engine) {
            this.engine = engine;
            
            // Register services with the container
            engine.serviceContainer.registerSingleton(
              'testService',
              () => ({ value: 'from-plugin' })
            );
            
            engine.serviceContainer.registerTransient(
              'counterService',
              () => ({ count: Math.random() })
            );
            
            return true;
          }
          
          async getServices() {
            const testService = await this.engine.serviceContainer.resolve('testService');
            const counter1 = await this.engine.serviceContainer.resolve('counterService');
            const counter2 = await this.engine.serviceContainer.resolve('counterService');
            
            return {
              testService,
              counter1,
              counter2,
              sameInstance: counter1 === counter2
            };
          }
        }
      `;
      
      await fs.writeFile(path.join(pluginPath, 'index.js'), pluginCode);
      
      await engine.pluginManager.discoverPlugins();
      const plugin = await engine.pluginManager.loadPlugin(pluginId);
      
      const services = await plugin.getServices();
      
      expect(services.testService.value).toBe('from-plugin');
      expect(services.sameInstance).toBe(false); // Transient services are different instances
      expect(services.counter1).not.toBe(services.counter2);
    });
  });

  describe('Communication Bridge Integration', () => {
    it('should enable inter-plugin communication', async () => {
      // Create publisher plugin
      const pubId = 'publisher-plugin';
      const pubPath = path.join(testPluginDir, pubId);
      await fs.mkdir(pubPath);
      
      await fs.writeFile(
        path.join(pubPath, 'plugin.json'),
        JSON.stringify({
          name: 'Publisher Plugin',
          version: '1.0.0',
          main: 'index.js'
        }, null, 2)
      );
      
      const pubCode = `
        export default class PublisherPlugin {
          async initialize(engine) {
            this.engine = engine;
            return true;
          }
          
          publishMessage(message) {
            return this.engine.moduleBridge.sendMessage(
              '${pubId}',
              'test-channel',
              { data: message }
            );
          }
          
          sendDirectMessage(targetPlugin, message) {
            return this.engine.moduleBridge.sendDirectMessage(
              '${pubId}',
              targetPlugin,
              { direct: message }
            );
          }
        }
      `;
      
      await fs.writeFile(path.join(pubPath, 'index.js'), pubCode);
      
      // Create subscriber plugin
      const subId = 'subscriber-plugin';
      const subPath = path.join(testPluginDir, subId);
      await fs.mkdir(subPath);
      
      await fs.writeFile(
        path.join(subPath, 'plugin.json'),
        JSON.stringify({
          name: 'Subscriber Plugin',
          version: '1.0.0',
          main: 'index.js'
        }, null, 2)
      );
      
      const subCode = `
        export default class SubscriberPlugin {
          constructor() {
            this.receivedMessages = [];
          }
          
          async initialize(engine) {
            this.engine = engine;
            
            // Subscribe to broadcast channel
            engine.moduleBridge.subscribe(
              '${subId}',
              'test-channel',
              (message) => {
                this.receivedMessages.push({
                  type: 'broadcast',
                  from: message.from,
                  data: message.payload.data
                });
              }
            );
            
            // Subscribe to direct messages
            engine.moduleBridge.subscribe(
              '${subId}',
              'direct:${subId}',
              (message) => {
                this.receivedMessages.push({
                  type: 'direct',
                  from: message.from,
                  data: message.payload.direct
                });
              }
            );
            
            return true;
          }
          
          getReceivedMessages() {
            return [...this.receivedMessages];
          }
          
          clearMessages() {
            this.receivedMessages = [];
          }
        }
      `;
      
      await fs.writeFile(path.join(subPath, 'index.js'), subCode);
      
      // Load plugins
      await engine.pluginManager.discoverPlugins();
      const publisher = await engine.pluginManager.loadPlugin(pubId);
      const subscriber = await engine.pluginManager.loadPlugin(subId);
      
      // Test broadcast communication
      await publisher.publishMessage('Hello broadcast!');
      
      // Test direct communication
      await publisher.sendDirectMessage(subId, 'Hello direct!');
      
      // Allow time for message processing
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const messages = subscriber.getReceivedMessages();
      
      expect(messages).toHaveLength(2);
      expect(messages.find(m => m.type === 'broadcast' && m.data === 'Hello broadcast!')).toBeDefined();
      expect(messages.find(m => m.type === 'direct' && m.data === 'Hello direct!')).toBeDefined();
    });
  });

  describe('Configuration Integration', () => {
    it('should handle plugin configuration across system restarts', async () => {
      const pluginId = 'config-plugin';
      const pluginPath = path.join(testPluginDir, pluginId);
      await fs.mkdir(pluginPath);
      
      const manifest = {
        name: 'Config Plugin',
        version: '1.0.0',
        main: 'index.js'
      };
      
      await fs.writeFile(
        path.join(pluginPath, 'plugin.json'),
        JSON.stringify(manifest, null, 2)
      );
      
      const pluginCode = `
        export default class ConfigPlugin {
          async initialize(engine) {
            this.engine = engine;
            
            // Set default configuration
            const config = engine.moduleConfig.getConfig('${pluginId}');
            if (Object.keys(config).length === 0) {
              await engine.moduleConfig.setConfig('${pluginId}', 'initialized', true, true);
              await engine.moduleConfig.setConfig('${pluginId}', 'startCount', 1, true);
            } else {
              const currentCount = engine.moduleConfig.getConfig('${pluginId}', 'startCount', 0);
              await engine.moduleConfig.setConfig('${pluginId}', 'startCount', currentCount + 1, true);
            }
            
            return true;
          }
          
          getConfig() {
            return this.engine.moduleConfig.getConfig('${pluginId}');
          }
        }
      `;
      
      await fs.writeFile(path.join(pluginPath, 'index.js'), pluginCode);
      
      await engine.pluginManager.discoverPlugins();
      const plugin = await engine.pluginManager.loadPlugin(pluginId);
      
      let config = plugin.getConfig();
      expect(config.initialized).toBe(true);
      expect(config.startCount).toBe(1);
      
      // Simulate restart by unloading and reloading
      await engine.pluginManager.unloadPlugin(pluginId);
      const plugin2 = await engine.pluginManager.loadPlugin(pluginId);
      
      config = plugin2.getConfig();
      expect(config.startCount).toBe(2); // Should increment on reload
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle plugin errors gracefully without affecting other plugins', async () => {
      // Create stable plugin
      const stableId = 'stable-plugin';
      const stablePath = path.join(testPluginDir, stableId);
      await fs.mkdir(stablePath);
      
      await fs.writeFile(
        path.join(stablePath, 'plugin.json'),
        JSON.stringify({
          name: 'Stable Plugin',
          version: '1.0.0',
          main: 'index.js'
        }, null, 2)
      );
      
      const stableCode = `
        export default class StablePlugin {
          async initialize() {
            this.working = true;
            return true;
          }
          
          getStatus() {
            return { working: this.working };
          }
        }
      `;
      
      await fs.writeFile(path.join(stablePath, 'index.js'), stableCode);
      
      // Create error plugin
      const errorId = 'error-plugin';
      const errorPath = path.join(testPluginDir, errorId);
      await fs.mkdir(errorPath);
      
      await fs.writeFile(
        path.join(errorPath, 'plugin.json'),
        JSON.stringify({
          name: 'Error Plugin',
          version: '1.0.0',
          main: 'index.js'
        }, null, 2)
      );
      
      const errorCode = `
        export default class ErrorPlugin {
          async initialize() {
            throw new Error('Intentional initialization error');
          }
        }
      `;
      
      await fs.writeFile(path.join(errorPath, 'index.js'), errorCode);
      
      await engine.pluginManager.discoverPlugins();
      
      // Load stable plugin successfully
      const stablePlugin = await engine.pluginManager.loadPlugin(stableId);
      expect(stablePlugin.getStatus().working).toBe(true);
      
      // Error plugin should fail to load
      await expect(engine.pluginManager.loadPlugin(errorId))
        .rejects.toThrow('Intentional initialization error');
      
      // Stable plugin should still be working
      expect(stablePlugin.getStatus().working).toBe(true);
      expect(engine.pluginManager.plugins.has(stableId)).toBe(true);
      expect(engine.pluginManager.plugins.has(errorId)).toBe(false);
    });
  });

  describe('Performance and Metrics', () => {
    it('should track comprehensive system metrics', async () => {
      const pluginId = 'metrics-plugin';
      const pluginPath = path.join(testPluginDir, pluginId);
      await fs.mkdir(pluginPath);
      
      await fs.writeFile(
        path.join(pluginPath, 'plugin.json'),
        JSON.stringify({
          name: 'Metrics Plugin',
          version: '1.0.0',
          main: 'index.js'
        }, null, 2)
      );
      
      const metricsCode = `
        export default class MetricsPlugin {
          async initialize(engine) {
            this.engine = engine;
            return true;
          }
        }
      `;
      
      await fs.writeFile(path.join(pluginPath, 'index.js'), metricsCode);
      
      const initialMetrics = {
        engine: engine.getMetrics(),
        container: engine.serviceContainer.getMetrics(),
        security: engine.moduleSecurity.getMetrics(),
        plugins: engine.pluginManager.getMetrics(),
        bridge: engine.moduleBridge.getMetrics()
      };
      
      await engine.pluginManager.discoverPlugins();
      await engine.pluginManager.loadPlugin(pluginId);
      
      const finalMetrics = {
        engine: engine.getMetrics(),
        container: engine.serviceContainer.getMetrics(),
        security: engine.moduleSecurity.getMetrics(),
        plugins: engine.pluginManager.getMetrics(),
        bridge: engine.moduleBridge.getMetrics()
      };
      
      // Verify metrics increased appropriately
      expect(finalMetrics.engine.modulesLoaded).toBe(initialMetrics.engine.modulesLoaded + 1);
      expect(finalMetrics.security.validationsPerformed).toBeGreaterThan(initialMetrics.security.validationsPerformed);
      expect(finalMetrics.plugins.pluginsLoaded).toBeGreaterThan(initialMetrics.plugins.pluginsLoaded);
    });
  });
});