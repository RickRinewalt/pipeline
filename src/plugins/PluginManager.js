/**
 * Plugin Manager - Dynamic plugin discovery, loading, and lifecycle management
 * Supports plugin hot-swapping, dependency resolution, and marketplace integration
 */

import EventEmitter from 'events';
import fs from 'fs/promises';
import path from 'path';
import { ModuleMarketplace } from '../marketplace/ModuleMarketplace.js';

export class PluginManager extends EventEmitter {
  constructor(engine) {
    super();
    this.engine = engine;
    this.plugins = new Map();
    this.pluginPaths = new Set();
    this.watchers = new Map();
    this.marketplace = new ModuleMarketplace(this);
    
    this.config = {
      pluginDirs: ['./plugins', './node_modules'],
      autoDiscovery: true,
      hotReload: true,
      maxPlugins: 1000,
      pluginTimeout: 30000,
      enableMarketplace: false,
      marketplaceUrl: 'https://plugins.yolo-pro.com'
    };

    this.registry = {
      discovered: new Map(),
      loaded: new Map(),
      failed: new Map(),
      disabled: new Set()
    };

    this.metrics = {
      pluginsDiscovered: 0,
      pluginsLoaded: 0,
      pluginsFailed: 0,
      hotReloads: 0,
      marketplaceInstalls: 0
    };

    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) {
      throw new Error('PluginManager already initialized');
    }

    this.emit('plugins:initializing');

    // Initialize marketplace if enabled
    if (this.config.enableMarketplace) {
      await this.marketplace.initialize();
    }

    // Discover plugins
    if (this.config.autoDiscovery) {
      await this.discoverPlugins();
    }

    // Setup hot reload watchers
    if (this.config.hotReload) {
      await this.setupWatchers();
    }

    this.isInitialized = true;
    this.emit('plugins:initialized');
  }

  /**
   * Discover plugins in configured directories
   */
  async discoverPlugins() {
    this.emit('plugins:discovering');

    for (const pluginDir of this.config.pluginDirs) {
      try {
        await this.discoverInDirectory(pluginDir);
      } catch (error) {
        this.emit('plugins:discovery-error', { directory: pluginDir, error });
      }
    }

    this.emit('plugins:discovered', { 
      count: this.registry.discovered.size 
    });
  }

  /**
   * Load a specific plugin
   */
  async loadPlugin(pluginId, options = {}) {
    if (!this.registry.discovered.has(pluginId)) {
      throw new Error(`Plugin '${pluginId}' not discovered`);
    }

    if (this.plugins.has(pluginId)) {
      throw new Error(`Plugin '${pluginId}' already loaded`);
    }

    const pluginInfo = this.registry.discovered.get(pluginId);

    try {
      this.emit('plugin:loading', { pluginId, info: pluginInfo });

      // Security validation
      const securityResult = await this.engine.moduleSecurity.validateModule(pluginInfo);
      if (!securityResult.valid) {
        throw new Error(`Security validation failed: ${securityResult.reason}`);
      }

      // Load plugin manifest
      const manifest = await this.loadPluginManifest(pluginInfo.manifestPath);
      
      // Validate plugin structure
      this.validatePluginManifest(manifest);

      // Check dependencies
      await this.checkPluginDependencies(manifest.dependencies || []);

      // Load plugin module
      const pluginModule = await this.loadPluginModule(pluginInfo, manifest);

      // Initialize plugin
      const plugin = await this.initializePlugin(pluginModule, manifest, options);

      // Register plugin
      this.plugins.set(pluginId, {
        id: pluginId,
        manifest,
        instance: plugin,
        info: pluginInfo,
        loadTime: Date.now(),
        status: 'loaded'
      });

      this.registry.loaded.set(pluginId, manifest);
      this.metrics.pluginsLoaded++;

      this.emit('plugin:loaded', { pluginId, plugin });
      return plugin;

    } catch (error) {
      this.registry.failed.set(pluginId, { error, timestamp: Date.now() });
      this.metrics.pluginsFailed++;
      this.emit('plugin:load-error', { pluginId, error });
      throw error;
    }
  }

  /**
   * Unload a plugin safely
   */
  async unloadPlugin(pluginId) {
    if (!this.plugins.has(pluginId)) {
      throw new Error(`Plugin '${pluginId}' not loaded`);
    }

    const pluginData = this.plugins.get(pluginId);

    try {
      this.emit('plugin:unloading', { pluginId });

      // Check for dependent plugins
      const dependents = await this.findDependentPlugins(pluginId);
      if (dependents.length > 0) {
        throw new Error(`Cannot unload plugin '${pluginId}': has dependents ${dependents.join(', ')}`);
      }

      // Call plugin cleanup if available
      if (pluginData.instance && typeof pluginData.instance.cleanup === 'function') {
        await pluginData.instance.cleanup();
      }

      // Remove from registry
      this.plugins.delete(pluginId);
      this.registry.loaded.delete(pluginId);

      this.emit('plugin:unloaded', { pluginId });

    } catch (error) {
      this.emit('plugin:unload-error', { pluginId, error });
      throw error;
    }
  }

  /**
   * Reload a plugin (hot reload)
   */
  async reloadPlugin(pluginId) {
    if (!this.config.hotReload) {
      throw new Error('Hot reload is disabled');
    }

    if (!this.plugins.has(pluginId)) {
      throw new Error(`Plugin '${pluginId}' not loaded`);
    }

    try {
      this.emit('plugin:reloading', { pluginId });

      // Get current plugin data
      const currentPlugin = this.plugins.get(pluginId);
      const options = currentPlugin.options || {};

      // Unload current plugin
      await this.unloadPlugin(pluginId);

      // Rediscover and reload
      await this.discoverInDirectory(path.dirname(currentPlugin.info.manifestPath));
      await this.loadPlugin(pluginId, options);

      this.metrics.hotReloads++;
      this.emit('plugin:reloaded', { pluginId });

    } catch (error) {
      this.emit('plugin:reload-error', { pluginId, error });
      throw error;
    }
  }

  /**
   * Install plugin from marketplace
   */
  async installFromMarketplace(pluginName, version = 'latest') {
    if (!this.config.enableMarketplace) {
      throw new Error('Marketplace is disabled');
    }

    try {
      this.emit('plugin:installing', { pluginName, version });

      const pluginPackage = await this.marketplace.downloadPlugin(pluginName, version);
      const pluginId = await this.installPluginPackage(pluginPackage);

      this.metrics.marketplaceInstalls++;
      this.emit('plugin:installed', { pluginId, pluginName, version });

      return pluginId;

    } catch (error) {
      this.emit('plugin:install-error', { pluginName, error });
      throw error;
    }
  }

  /**
   * Get plugin by ID
   */
  getPlugin(pluginId) {
    const pluginData = this.plugins.get(pluginId);
    return pluginData ? pluginData.instance : null;
  }

  /**
   * List all plugins
   */
  listPlugins(filter = 'all') {
    const plugins = Array.from(this.plugins.entries()).map(([id, data]) => ({
      id,
      name: data.manifest.name,
      version: data.manifest.version,
      status: data.status,
      loadTime: data.loadTime,
      dependencies: data.manifest.dependencies || []
    }));

    switch (filter) {
      case 'loaded': return plugins.filter(p => p.status === 'loaded');
      case 'failed': return Array.from(this.registry.failed.entries()).map(([id, data]) => ({
        id, error: data.error.message, timestamp: data.timestamp
      }));
      case 'discovered': return Array.from(this.registry.discovered.entries()).map(([id, info]) => ({
        id, path: info.path, manifestPath: info.manifestPath
      }));
      default: return plugins;
    }
  }

  /**
   * Search for plugins in marketplace
   */
  async searchMarketplace(query, options = {}) {
    if (!this.config.enableMarketplace) {
      throw new Error('Marketplace is disabled');
    }

    return await this.marketplace.searchPlugins(query, options);
  }

  /**
   * Get plugin metrics and health
   */
  async getPluginHealth(pluginId) {
    if (!this.plugins.has(pluginId)) {
      return { status: 'not-found' };
    }

    const pluginData = this.plugins.get(pluginId);

    try {
      const health = pluginData.instance.getHealth 
        ? await pluginData.instance.getHealth()
        : { status: 'unknown' };

      return {
        id: pluginId,
        status: 'healthy',
        uptime: Date.now() - pluginData.loadTime,
        version: pluginData.manifest.version,
        health
      };

    } catch (error) {
      return {
        id: pluginId,
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  /**
   * Get manager metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      pluginsActive: this.plugins.size,
      pluginsDiscovered: this.registry.discovered.size,
      pluginsFailed: this.registry.failed.size,
      watchersActive: this.watchers.size
    };
  }

  async shutdown() {
    this.emit('plugins:shutting-down');

    // Stop all watchers
    for (const watcher of this.watchers.values()) {
      await watcher.close();
    }
    this.watchers.clear();

    // Unload all plugins
    const pluginIds = Array.from(this.plugins.keys());
    for (const pluginId of pluginIds) {
      try {
        await this.unloadPlugin(pluginId);
      } catch (error) {
        this.emit('plugin:shutdown-error', { pluginId, error });
      }
    }

    // Shutdown marketplace
    if (this.marketplace) {
      await this.marketplace.shutdown();
    }

    this.emit('plugins:shutdown');
  }

  // Private methods

  async discoverInDirectory(directory) {
    try {
      const entries = await fs.readdir(directory, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const pluginPath = path.join(directory, entry.name);
          const manifestPath = path.join(pluginPath, 'plugin.json');

          try {
            await fs.access(manifestPath);
            const pluginId = entry.name;

            this.registry.discovered.set(pluginId, {
              id: pluginId,
              path: pluginPath,
              manifestPath,
              discoveryTime: Date.now()
            });

            this.metrics.pluginsDiscovered++;

          } catch (error) {
            // No manifest, skip
          }
        }
      }

    } catch (error) {
      throw new Error(`Failed to discover plugins in ${directory}: ${error.message}`);
    }
  }

  async loadPluginManifest(manifestPath) {
    try {
      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      return JSON.parse(manifestContent);
    } catch (error) {
      throw new Error(`Failed to load plugin manifest: ${error.message}`);
    }
  }

  validatePluginManifest(manifest) {
    const required = ['name', 'version', 'main'];
    
    for (const field of required) {
      if (!manifest[field]) {
        throw new Error(`Plugin manifest missing required field: ${field}`);
      }
    }

    // Validate semver
    if (!/^\d+\.\d+\.\d+/.test(manifest.version)) {
      throw new Error(`Invalid version format: ${manifest.version}`);
    }
  }

  async checkPluginDependencies(dependencies) {
    for (const dep of dependencies) {
      const depId = dep.name || dep;
      
      if (!this.plugins.has(depId) && !this.registry.discovered.has(depId)) {
        throw new Error(`Plugin dependency not found: ${depId}`);
      }

      // Auto-load dependency if discovered but not loaded
      if (this.registry.discovered.has(depId) && !this.plugins.has(depId)) {
        await this.loadPlugin(depId);
      }
    }
  }

  async loadPluginModule(pluginInfo, manifest) {
    const mainPath = path.resolve(pluginInfo.path, manifest.main);
    
    try {
      // Dynamic import with cache busting for hot reload
      const moduleUrl = `${mainPath}?t=${Date.now()}`;
      const module = await import(moduleUrl);
      
      return module.default || module;

    } catch (error) {
      throw new Error(`Failed to load plugin module: ${error.message}`);
    }
  }

  async initializePlugin(pluginModule, manifest, options) {
    try {
      // Create plugin instance
      const plugin = typeof pluginModule === 'function'
        ? new pluginModule(this.engine, options)
        : pluginModule;

      // Call initialize if available
      if (typeof plugin.initialize === 'function') {
        await plugin.initialize(this.engine, manifest, options);
      }

      return plugin;

    } catch (error) {
      throw new Error(`Failed to initialize plugin: ${error.message}`);
    }
  }

  async findDependentPlugins(pluginId) {
    const dependents = [];

    for (const [id, data] of this.plugins.entries()) {
      const dependencies = data.manifest.dependencies || [];
      if (dependencies.some(dep => (dep.name || dep) === pluginId)) {
        dependents.push(id);
      }
    }

    return dependents;
  }

  async setupWatchers() {
    const { watch } = await import('chokidar');

    for (const pluginDir of this.config.pluginDirs) {
      try {
        const watcher = watch(`${pluginDir}/*/plugin.json`, {
          persistent: true,
          ignoreInitial: true
        });

        watcher.on('change', async (filePath) => {
          const pluginId = path.basename(path.dirname(filePath));
          if (this.plugins.has(pluginId)) {
            try {
              await this.reloadPlugin(pluginId);
            } catch (error) {
              this.emit('plugin:watch-error', { pluginId, error });
            }
          }
        });

        this.watchers.set(pluginDir, watcher);

      } catch (error) {
        this.emit('plugins:watcher-error', { directory: pluginDir, error });
      }
    }
  }

  async installPluginPackage(pluginPackage) {
    // Extract package to plugins directory
    const pluginDir = path.join(this.config.pluginDirs[0], pluginPackage.name);
    
    await fs.mkdir(pluginDir, { recursive: true });
    await this.extractPluginPackage(pluginPackage, pluginDir);
    
    // Discover and load the new plugin
    await this.discoverInDirectory(this.config.pluginDirs[0]);
    await this.loadPlugin(pluginPackage.name);
    
    return pluginPackage.name;
  }

  async extractPluginPackage(pluginPackage, targetDir) {
    // Simplified package extraction
    // In real implementation, would handle zip/tar archives
    for (const [fileName, content] of Object.entries(pluginPackage.files)) {
      const filePath = path.join(targetDir, fileName);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content);
    }
  }
}

export default PluginManager;