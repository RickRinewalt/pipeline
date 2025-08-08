/**
 * Plugin Engine Test Suite - TDD Implementation
 * Comprehensive test coverage for plugin engine functionality
 */

import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import { PluginEngine } from '../../src/architecture/core/plugin-engine.impl';
import { IPlugin, PluginState } from '../../src/architecture/core/plugin-engine';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock dependencies
const mockServiceContainer = {
  get: jest.fn(),
  register: jest.fn(),
  has: jest.fn()
};

const mockEventBus = {
  emit: jest.fn(),
  subscribe: jest.fn(),
  unsubscribe: jest.fn()
};

const mockConfigManager = {
  get: jest.fn(),
  set: jest.fn(),
  has: jest.fn()
};

const mockSecurityFramework = {
  validatePlugin: jest.fn().mockResolvedValue({
    valid: true,
    risks: [],
    trustLevel: 3
  }),
  createSandbox: jest.fn().mockResolvedValue({
    execute: jest.fn().mockResolvedValue(undefined),
    terminate: jest.fn().mockResolvedValue(undefined),
    getMetrics: jest.fn(),
    checkHealth: jest.fn()
  }),
  destroySandbox: jest.fn().mockResolvedValue(undefined),
  createSecurityContext: jest.fn().mockResolvedValue({
    pluginId: 'test-plugin',
    permissions: [],
    trustLevel: 3,
    hasPermission: jest.fn().mockReturnValue(true)
  }),
  grantPermissions: jest.fn().mockResolvedValue(undefined)
};

jest.mock('fs/promises');
jest.mock('path');

describe('PluginEngine', () => {
  let pluginEngine: PluginEngine;
  let mockReadFile: jest.MockedFunction<typeof fs.readFile>;
  let mockAccess: jest.MockedFunction<typeof fs.access>;
  let mockReaddir: jest.MockedFunction<typeof fs.readdir>;

  beforeEach(() => {
    pluginEngine = new PluginEngine(
      mockServiceContainer as any,
      mockEventBus as any,
      mockConfigManager as any,
      mockSecurityFramework as any
    );

    mockReadFile = fs.readFile as jest.MockedFunction<typeof fs.readFile>;
    mockAccess = fs.access as jest.MockedFunction<typeof fs.access>;
    mockReaddir = fs.readdir as jest.MockedFunction<typeof fs.readdir>;

    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('loadPlugin', () => {
    const mockManifest = {
      name: 'test-plugin',
      version: '1.0.0',
      description: 'Test plugin',
      main: 'index.js',
      author: 'Test Author',
      license: 'MIT',
      dependencies: {},
      yoloPro: {
        provides: ['test-service'],
        permissions: []
      }
    };

    beforeEach(() => {
      mockReadFile.mockResolvedValue(JSON.stringify(mockManifest));
      
      // Mock dynamic import
      jest.doMock('/test/plugin/path/index.js', () => ({
        default: {
          initialize: jest.fn().mockResolvedValue(undefined),
          cleanup: jest.fn().mockResolvedValue(undefined)
        }
      }), { virtual: true });
    });

    it('should successfully load a valid plugin', async () => {
      const pluginPath = '/test/plugin/path';
      
      const plugin = await pluginEngine.loadPlugin(pluginPath);
      
      expect(plugin).toBeDefined();
      expect(plugin.id).toBe('test-plugin');
      expect(plugin.name).toBe('test-plugin');
      expect(plugin.version).toBe('1.0.0');
      expect(mockSecurityFramework.validatePlugin).toHaveBeenCalled();
      expect(mockSecurityFramework.createSandbox).toHaveBeenCalled();
    });

    it('should fail to load plugin if manifest is invalid', async () => {
      mockReadFile.mockRejectedValue(new Error('File not found'));
      
      await expect(pluginEngine.loadPlugin('/invalid/path')).rejects.toThrow('Failed to load plugin manifest');
    });

    it('should fail to load plugin if security validation fails', async () => {
      mockSecurityFramework.validatePlugin.mockResolvedValue({
        valid: false,
        risks: [{ description: 'Security risk detected', severity: 'high' }],
        trustLevel: 0
      });
      
      await expect(pluginEngine.loadPlugin('/test/plugin/path')).rejects.toThrow('Security validation failed');
    });

    it('should prevent loading the same plugin twice', async () => {
      await pluginEngine.loadPlugin('/test/plugin/path');
      
      await expect(pluginEngine.loadPlugin('/test/plugin/path')).rejects.toThrow('Plugin test-plugin is already loaded');
    });

    it('should prevent race conditions during plugin loading', async () => {
      const promise1 = pluginEngine.loadPlugin('/test/plugin/path');
      const promise2 = pluginEngine.loadPlugin('/test/plugin/path');
      
      await expect(promise1).resolves.toBeDefined();
      await expect(promise2).rejects.toThrow('is already being loaded');
    });

    it('should emit lifecycle events during loading', async () => {
      const lifecycleEvents: any[] = [];
      pluginEngine.on('lifecycle', (event) => lifecycleEvents.push(event));
      
      await pluginEngine.loadPlugin('/test/plugin/path');
      
      expect(lifecycleEvents).toHaveLength(1);
      expect(lifecycleEvents[0].pluginId).toBe('test-plugin');
      expect(lifecycleEvents[0].currentState).toBe(PluginState.ACTIVE);
    });
  });

  describe('unloadPlugin', () => {
    beforeEach(async () => {
      const mockManifest = {
        name: 'test-plugin',
        version: '1.0.0',
        description: 'Test plugin',
        main: 'index.js',
        dependencies: {},
        yoloPro: { provides: [], permissions: [] }
      };
      
      mockReadFile.mockResolvedValue(JSON.stringify(mockManifest));
      await pluginEngine.loadPlugin('/test/plugin/path');
    });

    it('should successfully unload a loaded plugin', async () => {
      await expect(pluginEngine.unloadPlugin('test-plugin')).resolves.not.toThrow();
      expect(pluginEngine.getPlugin('test-plugin')).toBeNull();
      expect(mockSecurityFramework.destroySandbox).toHaveBeenCalledWith('test-plugin');
    });

    it('should fail to unload a non-existent plugin', async () => {
      await expect(pluginEngine.unloadPlugin('non-existent')).rejects.toThrow('Plugin non-existent is not loaded');
    });

    it('should prevent unloading plugins with dependents', async () => {
      // Load a dependent plugin
      const dependentManifest = {
        name: 'dependent-plugin',
        version: '1.0.0',
        description: 'Dependent plugin',
        main: 'index.js',
        dependencies: { 'test-plugin': '1.0.0' },
        yoloPro: { provides: [], permissions: [] }
      };
      
      mockReadFile.mockResolvedValue(JSON.stringify(dependentManifest));
      await pluginEngine.loadPlugin('/dependent/plugin/path');
      
      await expect(pluginEngine.unloadPlugin('test-plugin')).rejects.toThrow('depended on by');
    });
  });

  describe('reloadPlugin', () => {
    beforeEach(async () => {
      const mockManifest = {
        name: 'test-plugin',
        version: '1.0.0',
        description: 'Test plugin',
        main: 'index.js',
        dependencies: {},
        yoloPro: { provides: [], permissions: [] }
      };
      
      mockReadFile.mockResolvedValue(JSON.stringify(mockManifest));
      await pluginEngine.loadPlugin('/test/plugin/path');
    });

    it('should successfully reload a plugin', async () => {
      await expect(pluginEngine.reloadPlugin('test-plugin')).resolves.not.toThrow();
      expect(pluginEngine.getPlugin('test-plugin')).toBeDefined();
    });

    it('should fail to reload a non-existent plugin', async () => {
      await expect(pluginEngine.reloadPlugin('non-existent')).rejects.toThrow('Plugin non-existent is not loaded');
    });
  });

  describe('discoverPlugins', () => {
    beforeEach(() => {
      mockReaddir.mockResolvedValue([
        { name: 'plugin1', isDirectory: () => true } as any,
        { name: 'plugin2', isDirectory: () => true } as any,
        { name: 'file.txt', isDirectory: () => false } as any
      ]);
      
      mockAccess.mockResolvedValue(undefined);
      
      const mockManifest = {
        name: 'discovered-plugin',
        version: '1.0.0',
        description: 'Discovered plugin',
        main: 'index.js',
        dependencies: {},
        yoloPro: { provides: [], permissions: [] }
      };
      
      mockReadFile.mockResolvedValue(JSON.stringify(mockManifest));
    });

    it('should discover plugins in search paths', async () => {
      const searchPaths = ['/plugins/directory'];
      
      const discoveredPlugins = await pluginEngine.discoverPlugins(searchPaths);
      
      expect(discoveredPlugins).toHaveLength(2);
      expect(discoveredPlugins[0].name).toBe('discovered-plugin');
      expect(mockReaddir).toHaveBeenCalledWith('/plugins/directory', { withFileTypes: true });
    });

    it('should skip invalid plugins during discovery', async () => {
      mockReadFile.mockRejectedValueOnce(new Error('Invalid manifest'));
      
      const discoveredPlugins = await pluginEngine.discoverPlugins(['/plugins/directory']);
      
      expect(discoveredPlugins).toHaveLength(1); // One plugin should be skipped
    });

    it('should handle directory access errors gracefully', async () => {
      mockReaddir.mockRejectedValue(new Error('Permission denied'));
      
      const discoveredPlugins = await pluginEngine.discoverPlugins(['/invalid/directory']);
      
      expect(discoveredPlugins).toHaveLength(0);
    });
  });

  describe('validateDependencies', () => {
    it('should validate plugins with no dependencies', async () => {
      const plugin: IPlugin = {
        id: 'test-plugin',
        name: 'test-plugin',
        version: '1.0.0',
        description: 'Test plugin',
        dependencies: [],
        provides: [],
        metadata: {
          author: 'Test',
          license: 'MIT',
          keywords: [],
          engines: {},
          permissions: []
        }
      };
      
      const isValid = await pluginEngine.validateDependencies(plugin);
      expect(isValid).toBe(true);
    });

    it('should fail validation for missing dependencies', async () => {
      const plugin: IPlugin = {
        id: 'test-plugin',
        name: 'test-plugin',
        version: '1.0.0',
        description: 'Test plugin',
        dependencies: ['missing-dependency'],
        provides: [],
        metadata: {
          author: 'Test',
          license: 'MIT',
          keywords: [],
          engines: { 'missing-dependency': '1.0.0' },
          permissions: []
        }
      };
      
      const isValid = await pluginEngine.validateDependencies(plugin);
      expect(isValid).toBe(false);
    });
  });

  describe('Plugin Management', () => {
    it('should list all loaded plugins', async () => {
      expect(pluginEngine.listPlugins()).toHaveLength(0);
      
      const mockManifest = {
        name: 'test-plugin',
        version: '1.0.0',
        description: 'Test plugin',
        main: 'index.js',
        dependencies: {},
        yoloPro: { provides: [], permissions: [] }
      };
      
      mockReadFile.mockResolvedValue(JSON.stringify(mockManifest));
      await pluginEngine.loadPlugin('/test/plugin/path');
      
      const plugins = pluginEngine.listPlugins();
      expect(plugins).toHaveLength(1);
      expect(plugins[0].id).toBe('test-plugin');
    });

    it('should get specific plugin by ID', async () => {
      expect(pluginEngine.getPlugin('test-plugin')).toBeNull();
      
      const mockManifest = {
        name: 'test-plugin',
        version: '1.0.0',
        description: 'Test plugin',
        main: 'index.js',
        dependencies: {},
        yoloPro: { provides: [], permissions: [] }
      };
      
      mockReadFile.mockResolvedValue(JSON.stringify(mockManifest));
      await pluginEngine.loadPlugin('/test/plugin/path');
      
      const plugin = pluginEngine.getPlugin('test-plugin');
      expect(plugin).toBeDefined();
      expect(plugin?.id).toBe('test-plugin');
    });
  });

  describe('Error Handling', () => {
    it('should handle plugin initialization errors gracefully', async () => {
      const mockManifest = {
        name: 'failing-plugin',
        version: '1.0.0',
        description: 'Failing plugin',
        main: 'index.js',
        dependencies: {},
        yoloPro: { provides: [], permissions: [] }
      };
      
      mockReadFile.mockResolvedValue(JSON.stringify(mockManifest));
      
      // Mock a failing plugin module
      const failingModule = {
        initialize: jest.fn().mockRejectedValue(new Error('Initialization failed'))
      };
      
      mockSecurityFramework.createSandbox.mockResolvedValue({
        execute: jest.fn().mockRejectedValue(new Error('Initialization failed')),
        terminate: jest.fn()
      });
      
      await expect(pluginEngine.loadPlugin('/failing/plugin/path')).rejects.toThrow('Plugin initialization failed');
    });

    it('should emit error events for plugin load failures', async () => {
      const errorEvents: any[] = [];
      pluginEngine.on('pluginLoadError', (event) => errorEvents.push(event));
      
      mockReadFile.mockRejectedValue(new Error('File not found'));
      
      await expect(pluginEngine.loadPlugin('/invalid/path')).rejects.toThrow();
      expect(errorEvents).toHaveLength(1);
      expect(errorEvents[0].pluginPath).toBe('/invalid/path');
    });
  });
});