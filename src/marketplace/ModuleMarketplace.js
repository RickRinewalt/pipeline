/**
 * Module Marketplace - Plugin distribution and discovery system
 * Provides plugin search, download, installation, and version management
 */

import EventEmitter from 'events';
import crypto from 'crypto';

export class ModuleMarketplace extends EventEmitter {
  constructor(pluginManager) {
    super();
    this.pluginManager = pluginManager;
    this.registry = new Map();
    this.cache = new Map();
    this.installations = new Map();
    this.publishers = new Map();
    
    this.config = {
      marketplaceUrl: 'https://marketplace.yolo-pro.com',
      enableCaching: true,
      cacheTimeout: 3600000, // 1 hour
      enableSignatureVerification: true,
      enableVersionConstraints: true,
      maxDownloadSize: 50 * 1024 * 1024, // 50MB
      downloadTimeout: 300000, // 5 minutes
      trustedPublishers: ['yolo-pro', 'verified']
    };

    this.packageTypes = {
      PLUGIN: 'plugin',
      THEME: 'theme',
      TEMPLATE: 'template',
      EXTENSION: 'extension',
      LIBRARY: 'library'
    };

    this.installationStates = {
      PENDING: 'pending',
      DOWNLOADING: 'downloading',
      INSTALLING: 'installing',
      COMPLETED: 'completed',
      FAILED: 'failed'
    };

    this.metrics = {
      searchesPerformed: 0,
      packagesDownloaded: 0,
      installationsSuccessful: 0,
      installationsFailed: 0,
      cacheHits: 0,
      cacheMisses: 0,
      signatureVerifications: 0
    };

    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) {
      throw new Error('ModuleMarketplace already initialized');
    }

    this.emit('marketplace:initializing');

    // Initialize local registry
    await this.initializeRegistry();

    // Setup cache cleanup
    if (this.config.enableCaching) {
      this.setupCacheCleanup();
    }

    this.isInitialized = true;
    this.emit('marketplace:initialized');
  }

  /**
   * Search for plugins in the marketplace
   */
  async searchPlugins(query, options = {}) {
    this.metrics.searchesPerformed++;
    
    try {
      this.emit('marketplace:searching', { query, options });

      // Check cache first
      const cacheKey = this.generateCacheKey('search', query, options);
      if (this.config.enableCaching) {
        const cached = this.getCachedResult(cacheKey);
        if (cached) {
          this.metrics.cacheHits++;
          return cached;
        }
      }

      // Perform marketplace search
      const searchParams = {
        q: query,
        type: options.type || 'all',
        category: options.category,
        tag: options.tags,
        publisher: options.publisher,
        minRating: options.minRating,
        limit: options.limit || 20,
        offset: options.offset || 0,
        sort: options.sort || 'relevance'
      };

      const results = await this.performMarketplaceRequest('/search', searchParams);

      // Process and validate results
      const processedResults = await this.processSearchResults(results);

      // Cache results
      if (this.config.enableCaching) {
        this.cacheResult(cacheKey, processedResults);
      }

      this.metrics.cacheMisses++;
      this.emit('marketplace:search-completed', { query, results: processedResults });

      return processedResults;

    } catch (error) {
      this.emit('marketplace:search-error', { query, error });
      throw error;
    }
  }

  /**
   * Get plugin details
   */
  async getPluginDetails(pluginId, version = 'latest') {
    try {
      this.emit('marketplace:fetching-details', { pluginId, version });

      // Check cache
      const cacheKey = this.generateCacheKey('details', pluginId, version);
      if (this.config.enableCaching) {
        const cached = this.getCachedResult(cacheKey);
        if (cached) {
          this.metrics.cacheHits++;
          return cached;
        }
      }

      const details = await this.performMarketplaceRequest(`/plugins/${pluginId}`, { version });
      
      // Validate and process details
      const processedDetails = await this.processPluginDetails(details);

      // Cache details
      if (this.config.enableCaching) {
        this.cacheResult(cacheKey, processedDetails);
      }

      this.metrics.cacheMisses++;
      return processedDetails;

    } catch (error) {
      this.emit('marketplace:details-error', { pluginId, error });
      throw error;
    }
  }

  /**
   * Download plugin package
   */
  async downloadPlugin(pluginId, version = 'latest') {
    try {
      this.emit('marketplace:downloading', { pluginId, version });

      // Get plugin details first
      const details = await this.getPluginDetails(pluginId, version);
      
      // Validate download permissions
      await this.validateDownloadPermissions(details);

      // Check size limits
      if (details.size > this.config.maxDownloadSize) {
        throw new Error(`Plugin size ${details.size} exceeds maximum allowed size ${this.config.maxDownloadSize}`);
      }

      // Download package
      const packageData = await this.downloadPackage(details.downloadUrl, details);

      // Verify signature if enabled
      if (this.config.enableSignatureVerification) {
        await this.verifyPackageSignature(packageData, details.signature);
      }

      this.metrics.packagesDownloaded++;
      this.emit('marketplace:download-completed', { pluginId, version });

      return packageData;

    } catch (error) {
      this.emit('marketplace:download-error', { pluginId, error });
      throw error;
    }
  }

  /**
   * Install plugin from marketplace
   */
  async installPlugin(pluginId, version = 'latest', options = {}) {
    const installationId = this.generateInstallationId();
    
    try {
      this.emit('marketplace:installing', { pluginId, version, installationId });

      // Track installation
      this.installations.set(installationId, {
        pluginId,
        version,
        state: this.installationStates.PENDING,
        startTime: Date.now(),
        progress: 0
      });

      // Check if plugin is already installed
      if (this.pluginManager.getPlugin(pluginId) && !options.force) {
        throw new Error(`Plugin ${pluginId} is already installed`);
      }

      // Update state
      this.updateInstallationState(installationId, this.installationStates.DOWNLOADING);

      // Download plugin
      const packageData = await this.downloadPlugin(pluginId, version);

      // Update state
      this.updateInstallationState(installationId, this.installationStates.INSTALLING);

      // Validate dependencies
      await this.validateDependencies(packageData.manifest);

      // Install plugin through plugin manager
      const installedPluginId = await this.pluginManager.installPluginPackage(packageData);

      // Update state
      this.updateInstallationState(installationId, this.installationStates.COMPLETED, {
        installedPluginId,
        installTime: Date.now()
      });

      this.metrics.installationsSuccessful++;
      this.emit('marketplace:installation-completed', { pluginId, version, installedPluginId });

      return installedPluginId;

    } catch (error) {
      this.updateInstallationState(installationId, this.installationStates.FAILED, { error });
      this.metrics.installationsFailed++;
      this.emit('marketplace:installation-error', { pluginId, version, error });
      throw error;
    }
  }

  /**
   * Uninstall plugin
   */
  async uninstallPlugin(pluginId) {
    try {
      this.emit('marketplace:uninstalling', { pluginId });

      // Check if plugin is installed
      if (!this.pluginManager.getPlugin(pluginId)) {
        throw new Error(`Plugin ${pluginId} is not installed`);
      }

      // Uninstall through plugin manager
      await this.pluginManager.unloadPlugin(pluginId);

      this.emit('marketplace:uninstalled', { pluginId });

    } catch (error) {
      this.emit('marketplace:uninstall-error', { pluginId, error });
      throw error;
    }
  }

  /**
   * Check for plugin updates
   */
  async checkUpdates(pluginId = null) {
    try {
      const installedPlugins = pluginId 
        ? [this.pluginManager.getPlugin(pluginId)]
        : this.pluginManager.listPlugins('loaded');

      const updates = [];

      for (const plugin of installedPlugins) {
        if (!plugin) continue;

        const currentVersion = plugin.version;
        const details = await this.getPluginDetails(plugin.id);
        const latestVersion = details.version;

        if (this.compareVersions(latestVersion, currentVersion) > 0) {
          updates.push({
            pluginId: plugin.id,
            currentVersion,
            latestVersion,
            updateAvailable: true,
            details
          });
        }
      }

      this.emit('marketplace:updates-checked', { updates });
      return updates;

    } catch (error) {
      this.emit('marketplace:update-check-error', { error });
      throw error;
    }
  }

  /**
   * Update plugin to latest version
   */
  async updatePlugin(pluginId, options = {}) {
    try {
      this.emit('marketplace:updating', { pluginId });

      // Check for updates
      const updates = await this.checkUpdates(pluginId);
      const updateInfo = updates.find(u => u.pluginId === pluginId);

      if (!updateInfo || !updateInfo.updateAvailable) {
        throw new Error(`No updates available for plugin ${pluginId}`);
      }

      // Backup current plugin if requested
      if (options.backup) {
        await this.backupPlugin(pluginId);
      }

      // Install new version
      await this.installPlugin(pluginId, updateInfo.latestVersion, { force: true });

      this.emit('marketplace:updated', { pluginId, version: updateInfo.latestVersion });

    } catch (error) {
      this.emit('marketplace:update-error', { pluginId, error });
      throw error;
    }
  }

  /**
   * List installed plugins
   */
  listInstalledPlugins() {
    return this.pluginManager.listPlugins('loaded').map(plugin => ({
      id: plugin.id,
      name: plugin.name,
      version: plugin.version,
      status: plugin.status,
      installedFrom: 'marketplace' // Could track installation source
    }));
  }

  /**
   * Get installation status
   */
  getInstallationStatus(installationId) {
    return this.installations.get(installationId) || null;
  }

  /**
   * List all ongoing installations
   */
  listInstallations() {
    return Array.from(this.installations.entries()).map(([id, data]) => ({
      id,
      ...data
    }));
  }

  /**
   * Get marketplace metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      cachedEntries: this.cache.size,
      ongoingInstallations: Array.from(this.installations.values())
        .filter(i => i.state !== this.installationStates.COMPLETED && i.state !== this.installationStates.FAILED).length,
      trustedPublishers: this.config.trustedPublishers.length
    };
  }

  async shutdown() {
    this.emit('marketplace:shutting-down');

    // Clear caches
    this.cache.clear();
    this.registry.clear();

    // Clear ongoing installations
    this.installations.clear();

    this.emit('marketplace:shutdown');
  }

  // Private methods

  async initializeRegistry() {
    // Initialize local plugin registry for caching and offline access
    this.registry.set('initialized', true);
  }

  setupCacheCleanup() {
    // Cleanup expired cache entries every hour
    setInterval(() => {
      this.cleanupExpiredCache();
    }, 3600000);
  }

  cleanupExpiredCache() {
    const now = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expires < now) {
        this.cache.delete(key);
      }
    }
  }

  generateCacheKey(type, ...params) {
    const keyData = [type, ...params].join(':');
    return crypto.createHash('md5').update(keyData).digest('hex');
  }

  getCachedResult(key) {
    const cached = this.cache.get(key);
    
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }
    
    if (cached) {
      this.cache.delete(key); // Remove expired entry
    }
    
    return null;
  }

  cacheResult(key, data, ttl = this.config.cacheTimeout) {
    this.cache.set(key, {
      data,
      expires: Date.now() + ttl,
      cached: Date.now()
    });
  }

  async performMarketplaceRequest(endpoint, params = {}) {
    const url = new URL(endpoint, this.config.marketplaceUrl);
    
    // Add parameters
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, value.toString());
      }
    });

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'YOLO-PRO-Marketplace/1.0'
      },
      timeout: 10000
    });

    if (!response.ok) {
      throw new Error(`Marketplace API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  async processSearchResults(results) {
    // Process and validate search results
    return results.plugins?.map(plugin => ({
      id: plugin.id,
      name: plugin.name,
      description: plugin.description,
      version: plugin.latest_version,
      author: plugin.author,
      category: plugin.category,
      tags: plugin.tags || [],
      rating: plugin.rating || 0,
      downloads: plugin.downloads || 0,
      size: plugin.size || 0,
      verified: this.config.trustedPublishers.includes(plugin.author),
      lastUpdated: plugin.updated_at
    })) || [];
  }

  async processPluginDetails(details) {
    return {
      id: details.id,
      name: details.name,
      description: details.description,
      version: details.version,
      author: details.author,
      category: details.category,
      tags: details.tags || [],
      dependencies: details.dependencies || [],
      permissions: details.permissions || [],
      size: details.size || 0,
      downloadUrl: details.download_url,
      signature: details.signature,
      verified: this.config.trustedPublishers.includes(details.author),
      changelog: details.changelog,
      documentation: details.documentation,
      screenshots: details.screenshots || [],
      createdAt: details.created_at,
      updatedAt: details.updated_at
    };
  }

  async validateDownloadPermissions(details) {
    // Check if user has permission to download
    if (details.private && !details.hasAccess) {
      throw new Error('Insufficient permissions to download private plugin');
    }

    // Check publisher trust
    if (!details.verified && this.config.enableSignatureVerification) {
      throw new Error('Plugin from untrusted publisher');
    }
  }

  async downloadPackage(downloadUrl, details) {
    const response = await fetch(downloadUrl, {
      method: 'GET',
      timeout: this.config.downloadTimeout
    });

    if (!response.ok) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}`);
    }

    // In real implementation, would handle binary data properly
    const packageData = {
      name: details.name,
      version: details.version,
      manifest: details,
      files: await response.arrayBuffer() // Simplified
    };

    return packageData;
  }

  async verifyPackageSignature(packageData, expectedSignature) {
    this.metrics.signatureVerifications++;

    // Simplified signature verification
    const packageHash = crypto.createHash('sha256')
      .update(JSON.stringify(packageData))
      .digest('hex');

    if (packageHash !== expectedSignature) {
      throw new Error('Package signature verification failed');
    }
  }

  async validateDependencies(manifest) {
    const dependencies = manifest.dependencies || [];

    for (const dep of dependencies) {
      // Check if dependency is available in marketplace
      const depDetails = await this.getPluginDetails(dep.name, dep.version);
      
      if (!depDetails) {
        throw new Error(`Dependency not found: ${dep.name}@${dep.version}`);
      }

      // Check version constraints
      if (this.config.enableVersionConstraints && dep.version !== 'latest') {
        if (!this.satisfiesVersion(depDetails.version, dep.version)) {
          throw new Error(`Dependency version mismatch: ${dep.name} requires ${dep.version}, found ${depDetails.version}`);
        }
      }
    }
  }

  updateInstallationState(installationId, state, additionalData = {}) {
    const installation = this.installations.get(installationId);
    if (installation) {
      this.installations.set(installationId, {
        ...installation,
        state,
        ...additionalData,
        lastUpdated: Date.now()
      });

      this.emit('installation:state-changed', { installationId, state, additionalData });
    }
  }

  generateInstallationId() {
    return `install_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  compareVersions(version1, version2) {
    // Simplified semver comparison
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);

    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;

      if (v1Part > v2Part) return 1;
      if (v1Part < v2Part) return -1;
    }

    return 0;
  }

  satisfiesVersion(availableVersion, requiredVersion) {
    // Simplified version satisfaction check
    if (requiredVersion === 'latest' || requiredVersion === '*') {
      return true;
    }

    return this.compareVersions(availableVersion, requiredVersion) >= 0;
  }

  async backupPlugin(pluginId) {
    // Simplified backup - in real implementation would create proper backup
    this.emit('marketplace:backup-created', { pluginId });
  }
}

export default ModuleMarketplace;