/**
 * Unit tests for PluginManager - Plugin discovery and lifecycle management
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { PluginManager } from '../../src/plugins/PluginManager.js';
import fs from 'fs/promises';
import path from 'path';

// Mock file system operations
jest.mock('fs/promises');
jest.mock('chokidar');

describe('PluginManager', () => {
  let pluginManager;
  let mockEngine;
  let mockMarketplace;

  beforeEach(async () => {
    mockEngine = {
      moduleSecurity: {
        validateModule: jest.fn().mockResolvedValue({ valid: true })
      },
      getModule: jest.fn()
    };

    pluginManager = new PluginManager(mockEngine);
    
    // Mock marketplace
    mockMarketplace = {
      initialize: jest.fn(),
      downloadPlugin: jest.fn(),
      shutdown: jest.fn()
    };
    pluginManager.marketplace = mockMarketplace;

    await pluginManager.initialize();
  });

  afterEach(async () => {
    await pluginManager.shutdown();
  });

  describe('Initialization', () => {
    it('should initialize successfully', () => {
      expect(pluginManager.isInitialized).toBe(true);
      expect(mockMarketplace.initialize).toHaveBeenCalled();
    });

    it('should throw error on double initialization', async () => {
      const newManager = new PluginManager(mockEngine);
      await newManager.initialize();
      
      await expect(newManager.initialize()).rejects.toThrow('PluginManager already initialized');
      
      await newManager.shutdown();
    });

    it('should initialize marketplace when enabled', async () => {
      const managerWithMarketplace = new PluginManager(mockEngine);
      managerWithMarketplace.config.enableMarketplace = true;
      
      await managerWithMarketplace.initialize();
      
      expect(mockMarketplace.initialize).toHaveBeenCalled();
      await managerWithMarketplace.shutdown();
    });
  });

  describe('Plugin Discovery', () => {
    beforeEach(() => {
      // Mock file system for discovery
      fs.readdir.mockResolvedValue([
        { name: 'plugin1', isDirectory: () => true },
        { name: 'plugin2', isDirectory: () => true },
        { name: 'notaplugin.txt', isDirectory: () => false }
      ]);
      
      fs.access.mockResolvedValue(); // Plugin manifest exists
    });

    it('should discover plugins in configured directories', async () => {
      const discoveredHandler = jest.fn();
      pluginManager.on('plugins:discovered', discoveredHandler);

      await pluginManager.discoverPlugins();

      expect(fs.readdir).toHaveBeenCalledWith('./plugins', { withFileTypes: true });
      expect(pluginManager.registry.discovered.size).toBeGreaterThan(0);
      expect(discoveredHandler).toHaveBeenCalled();
    });

    it('should skip directories without plugin manifests', async () => {
      fs.access.mockRejectedValueOnce(new Error('No manifest'));
      fs.access.mockResolvedValueOnce(); // Second plugin has manifest

      await pluginManager.discoverPlugins();

      expect(pluginManager.registry.discovered.size).toBe(1);
    });

    it('should handle discovery errors gracefully', async () => {
      fs.readdir.mockRejectedValue(new Error('Directory not found'));
      
      const errorHandler = jest.fn();
      pluginManager.on('plugins:discovery-error', errorHandler);

      await pluginManager.discoverPlugins();

      expect(errorHandler).toHaveBeenCalled();
    });
  });

  describe('Plugin Loading', () => {
    beforeEach(() => {
      // Setup discovered plugin
      pluginManager.registry.discovered.set('test-plugin', {
        id: 'test-plugin',
        path: '/path/to/test-plugin',
        manifestPath: '/path/to/test-plugin/plugin.json'
      });
    });

    it('should load a plugin successfully', async () => {
      const mockManifest = {
        name: 'Test Plugin',
        version: '1.0.0',
        main: 'index.js',
        dependencies: []
      };

      const mockModule = {
        default: class TestPlugin {
          constructor() { this.name = 'TestPlugin'; }
          initialize() { return Promise.resolve(); }
        }
      };

      // Mock file operations
      fs.readFile.mockResolvedValue(JSON.stringify(mockManifest));
      
      // Mock dynamic import
      const originalImport = global.__dirname ? require : global.import;
      global.import = jest.fn().mockResolvedValue(mockModule);

      const loadedHandler = jest.fn();
      pluginManager.on('plugin:loaded', loadedHandler);

      const plugin = await pluginManager.loadPlugin('test-plugin');

      expect(plugin).toBeDefined();
      expect(plugin.name).toBe('TestPlugin');
      expect(pluginManager.plugins.has('test-plugin')).toBe(true);
      expect(loadedHandler).toHaveBeenCalled();

      // Restore import
      global.import = originalImport;
    });

    it('should validate plugin security', async () => {
      mockEngine.moduleSecurity.validateModule.mockResolvedValue({
        valid: false,
        reason: 'Security violation'
      });

      const mockManifest = {
        name: 'Insecure Plugin',
        version: '1.0.0',
        main: 'index.js'
      };

      fs.readFile.mockResolvedValue(JSON.stringify(mockManifest));

      await expect(pluginManager.loadPlugin('test-plugin'))
        .rejects.toThrow('Security validation failed: Security violation');
    });

    it('should validate plugin manifest', async () => {
      const invalidManifest = {
        // Missing required fields
        description: 'Invalid plugin'
      };

      fs.readFile.mockResolvedValue(JSON.stringify(invalidManifest));

      await expect(pluginManager.loadPlugin('test-plugin'))
        .rejects.toThrow('Plugin manifest missing required field');
    });

    it('should check and load dependencies', async () => {
      const manifestWithDeps = {
        name: 'Dependent Plugin',
        version: '1.0.0',
        main: 'index.js',
        dependencies: [{ name: 'dependency-plugin' }]
      };

      // Setup dependency in discovered registry
      pluginManager.registry.discovered.set('dependency-plugin', {
        id: 'dependency-plugin',
        path: '/path/to/dependency',
        manifestPath: '/path/to/dependency/plugin.json'
      });

      const depManifest = {
        name: 'Dependency Plugin',
        version: '1.0.0',
        main: 'index.js'
      };

      fs.readFile
        .mockResolvedValueOnce(JSON.stringify(manifestWithDeps))
        .mockResolvedValueOnce(JSON.stringify(depManifest));

      // Mock plugin modules
      const mockDepModule = {
        default: class DepPlugin {
          initialize() { return Promise.resolve(); }
        }
      };

      const mockMainModule = {
        default: class MainPlugin {
          initialize() { return Promise.resolve(); }
        }
      };

      global.import = jest.fn()
        .mockResolvedValueOnce(mockDepModule)
        .mockResolvedValueOnce(mockMainModule);

      await pluginManager.loadPlugin('test-plugin');

      expect(pluginManager.plugins.has('dependency-plugin')).toBe(true);
      expect(pluginManager.plugins.has('test-plugin')).toBe(true);
    });

    it('should handle plugin loading errors', async () => {
      const mockManifest = {
        name: 'Error Plugin',
        version: '1.0.0',
        main: 'index.js'
      };

      fs.readFile.mockResolvedValue(JSON.stringify(mockManifest));
      global.import = jest.fn().mockRejectedValue(new Error('Module load error'));

      const errorHandler = jest.fn();
      pluginManager.on('plugin:load-error', errorHandler);

      await expect(pluginManager.loadPlugin('test-plugin'))
        .rejects.toThrow('Failed to load plugin module');

      expect(errorHandler).toHaveBeenCalled();
      expect(pluginManager.registry.failed.has('test-plugin')).toBe(true);
    });
  });

  describe('Plugin Unloading', () => {
    beforeEach(async () => {
      // Setup a loaded plugin
      const mockPlugin = {
        cleanup: jest.fn().mockResolvedValue()
      };

      pluginManager.plugins.set('unload-test', {
        id: 'unload-test',
        instance: mockPlugin,
        manifest: { name: 'Unload Test', version: '1.0.0' }
      });

      pluginManager.registry.loaded.set('unload-test', {});
    });

    it('should unload plugin successfully', async () => {
      const unloadedHandler = jest.fn();
      pluginManager.on('plugin:unloaded', unloadedHandler);

      await pluginManager.unloadPlugin('unload-test');

      expect(pluginManager.plugins.has('unload-test')).toBe(false);
      expect(pluginManager.registry.loaded.has('unload-test')).toBe(false);
      expect(unloadedHandler).toHaveBeenCalled();
    });

    it('should call plugin cleanup method', async () => {
      const pluginData = pluginManager.plugins.get('unload-test');
      
      await pluginManager.unloadPlugin('unload-test');

      expect(pluginData.instance.cleanup).toHaveBeenCalled();
    });

    it('should prevent unloading plugins with dependents', async () => {
      // Add a dependent plugin
      pluginManager.plugins.set('dependent', {
        id: 'dependent',
        manifest: {
          dependencies: [{ name: 'unload-test' }]
        }
      });

      await expect(pluginManager.unloadPlugin('unload-test'))
        .rejects.toThrow('Cannot unload plugin \'unload-test\': has dependents');
    });

    it('should throw error for non-existent plugin', async () => {
      await expect(pluginManager.unloadPlugin('non-existent'))
        .rejects.toThrow('Plugin \'non-existent\' not loaded');
    });
  });

  describe('Plugin Hot Reloading', () => {
    beforeEach(async () => {
      pluginManager.config.hotReload = true;

      // Setup loaded plugin
      pluginManager.plugins.set('reload-test', {
        id: 'reload-test',
        instance: { cleanup: jest.fn() },
        info: { manifestPath: '/path/to/reload-test/plugin.json' },
        options: { testOption: true }
      });

      pluginManager.registry.loaded.set('reload-test', {});
      pluginManager.registry.discovered.set('reload-test', {
        id: 'reload-test',
        path: '/path/to/reload-test',
        manifestPath: '/path/to/reload-test/plugin.json'
      });
    });

    it('should reload plugin successfully', async () => {
      const reloadedHandler = jest.fn();
      pluginManager.on('plugin:reloaded', reloadedHandler);

      // Mock the reload process
      const newManifest = {
        name: 'Reloaded Plugin',
        version: '2.0.0',
        main: 'index.js'
      };

      const newModule = {
        default: class ReloadedPlugin {
          initialize() { return Promise.resolve(); }
        }
      };

      fs.readFile.mockResolvedValue(JSON.stringify(newManifest));
      fs.readdir.mockResolvedValue([
        { name: 'reload-test', isDirectory: () => true }
      ]);
      fs.access.mockResolvedValue();
      global.import = jest.fn().mockResolvedValue(newModule);

      await pluginManager.reloadPlugin('reload-test');

      expect(reloadedHandler).toHaveBeenCalled();
      expect(pluginManager.getMetrics().hotReloads).toBeGreaterThan(0);
    });

    it('should throw error when hot reload is disabled', async () => {
      pluginManager.config.hotReload = false;

      await expect(pluginManager.reloadPlugin('reload-test'))
        .rejects.toThrow('Hot reload is disabled');
    });
  });

  describe('Marketplace Integration', () => {
    beforeEach(() => {
      pluginManager.config.enableMarketplace = true;
    });

    it('should install plugin from marketplace', async () => {
      const mockPackage = {
        name: 'marketplace-plugin',
        version: '1.0.0',
        files: {
          'plugin.json': JSON.stringify({
            name: 'Marketplace Plugin',
            version: '1.0.0',
            main: 'index.js'
          }),
          'index.js': 'module.exports = class MarketplacePlugin {}'
        }
      };

      mockMarketplace.downloadPlugin.mockResolvedValue(mockPackage);
      
      // Mock file system operations for installation
      fs.mkdir.mockResolvedValue();
      fs.writeFile.mockResolvedValue();

      const installedHandler = jest.fn();
      pluginManager.on('plugin:installed', installedHandler);

      const pluginId = await pluginManager.installFromMarketplace('marketplace-plugin');

      expect(pluginId).toBe('marketplace-plugin');
      expect(mockMarketplace.downloadPlugin).toHaveBeenCalledWith('marketplace-plugin', 'latest');
      expect(installedHandler).toHaveBeenCalled();
    });

    it('should search marketplace', async () => {
      const mockResults = [
        { name: 'plugin1', description: 'Test plugin 1' },
        { name: 'plugin2', description: 'Test plugin 2' }
      ];

      mockMarketplace.searchPlugins = jest.fn().mockResolvedValue(mockResults);

      const results = await pluginManager.searchMarketplace('test');

      expect(mockMarketplace.searchPlugins).toHaveBeenCalledWith('test', {});
      expect(results).toEqual(mockResults);
    });

    it('should throw error when marketplace is disabled', async () => {
      pluginManager.config.enableMarketplace = false;

      await expect(pluginManager.installFromMarketplace('test-plugin'))
        .rejects.toThrow('Marketplace is disabled');
    });
  });

  describe('Plugin Information', () => {
    beforeEach(() => {
      // Setup test plugins
      pluginManager.plugins.set('info-test-1', {
        id: 'info-test-1',
        manifest: { name: 'Info Test 1', version: '1.0.0' },
        status: 'loaded',
        loadTime: Date.now() - 1000
      });

      pluginManager.plugins.set('info-test-2', {
        id: 'info-test-2',
        manifest: { name: 'Info Test 2', version: '2.0.0' },
        status: 'loaded',
        loadTime: Date.now() - 2000
      });

      pluginManager.registry.failed.set('failed-plugin', {
        error: new Error('Load failed'),
        timestamp: Date.now()
      });
    });

    it('should get plugin by ID', () => {
      const plugin = pluginManager.getPlugin('info-test-1');
      expect(plugin).toBeDefined();
    });

    it('should return null for non-existent plugin', () => {
      const plugin = pluginManager.getPlugin('non-existent');
      expect(plugin).toBeNull();
    });

    it('should list all plugins', () => {
      const plugins = pluginManager.listPlugins();
      
      expect(plugins).toHaveLength(2);
      expect(plugins[0].id).toBe('info-test-1');
      expect(plugins[1].id).toBe('info-test-2');
    });

    it('should list loaded plugins only', () => {
      const loadedPlugins = pluginManager.listPlugins('loaded');
      
      expect(loadedPlugins).toHaveLength(2);
      expect(loadedPlugins.every(p => p.status === 'loaded')).toBe(true);
    });

    it('should list failed plugins', () => {
      const failedPlugins = pluginManager.listPlugins('failed');
      
      expect(failedPlugins).toHaveLength(1);
      expect(failedPlugins[0].id).toBe('failed-plugin');
      expect(failedPlugins[0].error).toBe('Load failed');
    });

    it('should list discovered plugins', () => {
      pluginManager.registry.discovered.set('discovered-plugin', {
        id: 'discovered-plugin',
        path: '/path/to/discovered'
      });

      const discoveredPlugins = pluginManager.listPlugins('discovered');
      
      expect(discoveredPlugins.length).toBeGreaterThan(0);
      expect(discoveredPlugins.some(p => p.id === 'discovered-plugin')).toBe(true);
    });
  });

  describe('Plugin Health', () => {
    beforeEach(() => {
      pluginManager.plugins.set('health-test', {
        id: 'health-test',
        manifest: { name: 'Health Test', version: '1.0.0' },
        instance: {
          getHealth: jest.fn().mockResolvedValue({ status: 'ok', uptime: 5000 })
        },
        loadTime: Date.now() - 5000
      });
    });

    it('should get plugin health', async () => {
      const health = await pluginManager.getPluginHealth('health-test');
      
      expect(health.status).toBe('healthy');
      expect(health.uptime).toBeGreaterThan(0);
      expect(health.health.status).toBe('ok');
    });

    it('should handle plugin health check errors', async () => {
      const pluginData = pluginManager.plugins.get('health-test');
      pluginData.instance.getHealth.mockRejectedValue(new Error('Health check failed'));

      const health = await pluginManager.getPluginHealth('health-test');
      
      expect(health.status).toBe('unhealthy');
      expect(health.error).toBe('Health check failed');
    });

    it('should return not-found for non-existent plugin', async () => {
      const health = await pluginManager.getPluginHealth('non-existent');
      expect(health.status).toBe('not-found');
    });
  });

  describe('Metrics', () => {
    it('should track plugin metrics', async () => {
      const metrics = pluginManager.getMetrics();
      
      expect(metrics).toHaveProperty('pluginsActive');
      expect(metrics).toHaveProperty('pluginsDiscovered');
      expect(metrics).toHaveProperty('pluginsFailed');
      expect(metrics).toHaveProperty('watchersActive');
    });
  });

  describe('Shutdown', () => {
    it('should shutdown gracefully', async () => {
      const shutdownHandler = jest.fn();
      pluginManager.on('plugins:shutdown', shutdownHandler);

      // Add some plugins to shutdown
      pluginManager.plugins.set('shutdown-test', {
        instance: { cleanup: jest.fn() }
      });

      await pluginManager.shutdown();

      expect(shutdownHandler).toHaveBeenCalled();
      expect(mockMarketplace.shutdown).toHaveBeenCalled();
    });
  });
});