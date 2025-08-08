/**
 * Module Configuration Manager - Centralized configuration system for modules
 * Supports environment-based configs, hot-reloading, and validation
 */

import EventEmitter from 'events';
import fs from 'fs/promises';
import path from 'path';

export class ModuleConfig extends EventEmitter {
  constructor(engine) {
    super();
    this.engine = engine;
    this.configurations = new Map();
    this.watchers = new Map();
    this.validators = new Map();
    this.environments = new Map();
    this.secrets = new Map();
    
    this.config = {
      configDir: './config',
      secretsDir: './secrets',
      environmentFile: '.env',
      enableHotReload: true,
      enableSecrets: true,
      defaultEnvironment: 'development',
      configFormat: 'json', // json, yaml, toml
      encryptSecrets: true
    };

    this.configTypes = {
      MODULE: 'module',
      SYSTEM: 'system',
      ENVIRONMENT: 'environment',
      SECRET: 'secret'
    };

    this.metrics = {
      configurationsLoaded: 0,
      configurationsReloaded: 0,
      validationErrors: 0,
      secretsLoaded: 0,
      hotReloads: 0
    };

    this.isInitialized = false;
    this.currentEnvironment = process.env.NODE_ENV || this.config.defaultEnvironment;
  }

  async initialize() {
    if (this.isInitialized) {
      throw new Error('ModuleConfig already initialized');
    }

    this.emit('config:initializing');

    // Create config directories if they don't exist
    await this.ensureDirectories();

    // Load environment configuration
    await this.loadEnvironmentConfig();

    // Load system configuration
    await this.loadSystemConfig();

    // Load module configurations
    await this.loadModuleConfigurations();

    // Load secrets if enabled
    if (this.config.enableSecrets) {
      await this.loadSecrets();
    }

    // Setup configuration watchers
    if (this.config.enableHotReload) {
      await this.setupConfigWatchers();
    }

    this.isInitialized = true;
    this.emit('config:initialized');
  }

  /**
   * Get configuration for a module
   */
  getConfig(moduleId, key = null, defaultValue = null) {
    const moduleConfig = this.configurations.get(moduleId);
    
    if (!moduleConfig) {
      return key ? defaultValue : {};
    }

    if (key === null) {
      return moduleConfig;
    }

    return this.getNestedValue(moduleConfig, key, defaultValue);
  }

  /**
   * Set configuration for a module
   */
  async setConfig(moduleId, key, value, persist = false) {
    if (!this.configurations.has(moduleId)) {
      this.configurations.set(moduleId, {});
    }

    const config = this.configurations.get(moduleId);
    this.setNestedValue(config, key, value);

    this.emit('config:updated', { moduleId, key, value });

    // Validate configuration
    await this.validateConfiguration(moduleId, config);

    // Persist to file if requested
    if (persist) {
      await this.persistModuleConfig(moduleId, config);
    }

    // Notify module of config change
    this.notifyModuleConfigChange(moduleId, key, value);
  }

  /**
   * Register configuration validator
   */
  registerValidator(moduleId, validator) {
    this.validators.set(moduleId, validator);
    this.emit('config:validator-registered', { moduleId });
  }

  /**
   * Load configuration from file
   */
  async loadConfigFromFile(filePath, type = this.configTypes.MODULE) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const config = this.parseConfigContent(content, filePath);
      
      this.emit('config:loaded-from-file', { filePath, type });
      return config;

    } catch (error) {
      this.emit('config:load-error', { filePath, error });
      throw new Error(`Failed to load config from ${filePath}: ${error.message}`);
    }
  }

  /**
   * Save configuration to file
   */
  async saveConfigToFile(config, filePath) {
    try {
      const content = this.serializeConfig(config, filePath);
      await fs.writeFile(filePath, content, 'utf-8');
      
      this.emit('config:saved-to-file', { filePath });

    } catch (error) {
      this.emit('config:save-error', { filePath, error });
      throw new Error(`Failed to save config to ${filePath}: ${error.message}`);
    }
  }

  /**
   * Get environment-specific configuration
   */
  getEnvironmentConfig(key = null, defaultValue = null) {
    const envConfig = this.environments.get(this.currentEnvironment) || {};
    
    if (key === null) {
      return envConfig;
    }

    return this.getNestedValue(envConfig, key, defaultValue);
  }

  /**
   * Set environment variable
   */
  setEnvironmentVariable(key, value, persist = false) {
    process.env[key] = value;
    
    if (!this.environments.has(this.currentEnvironment)) {
      this.environments.set(this.currentEnvironment, {});
    }
    
    this.environments.get(this.currentEnvironment)[key] = value;

    this.emit('config:env-updated', { key, value, environment: this.currentEnvironment });

    if (persist) {
      this.persistEnvironmentConfig();
    }
  }

  /**
   * Get secret value
   */
  getSecret(key, defaultValue = null) {
    if (!this.config.enableSecrets) {
      throw new Error('Secrets are disabled');
    }

    return this.secrets.get(key) || defaultValue;
  }

  /**
   * Set secret value
   */
  async setSecret(key, value, persist = false) {
    if (!this.config.enableSecrets) {
      throw new Error('Secrets are disabled');
    }

    // Encrypt secret if configured
    const encryptedValue = this.config.encryptSecrets 
      ? await this.encryptValue(value)
      : value;

    this.secrets.set(key, value); // Store decrypted in memory
    
    this.emit('config:secret-updated', { key });

    if (persist) {
      await this.persistSecret(key, encryptedValue);
    }
  }

  /**
   * Get all configured modules for auto-loading
   */
  getConfiguredModules() {
    const systemConfig = this.configurations.get('system') || {};
    return systemConfig.autoLoadModules || [];
  }

  /**
   * Get configuration schema for validation
   */
  getConfigSchema(moduleId) {
    const moduleConfig = this.configurations.get(moduleId) || {};
    return moduleConfig.$schema || null;
  }

  /**
   * Reload all configurations
   */
  async reloadConfigurations() {
    this.emit('config:reloading');

    try {
      // Clear current configurations
      this.configurations.clear();

      // Reload all configurations
      await this.loadSystemConfig();
      await this.loadModuleConfigurations();
      
      if (this.config.enableSecrets) {
        await this.loadSecrets();
      }

      this.metrics.configurationsReloaded++;
      this.emit('config:reloaded');

    } catch (error) {
      this.emit('config:reload-error', { error });
      throw error;
    }
  }

  /**
   * Export all configurations
   */
  exportConfigurations(includeSecrets = false) {
    const exported = {
      environment: this.currentEnvironment,
      configurations: Object.fromEntries(this.configurations.entries()),
      environments: Object.fromEntries(this.environments.entries())
    };

    if (includeSecrets && this.config.enableSecrets) {
      exported.secrets = Object.fromEntries(this.secrets.entries());
    }

    return exported;
  }

  /**
   * Get configuration metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      configurationsActive: this.configurations.size,
      environmentsLoaded: this.environments.size,
      secretsActive: this.secrets.size,
      validatorsRegistered: this.validators.size,
      watchersActive: this.watchers.size
    };
  }

  async shutdown() {
    this.emit('config:shutting-down');

    // Close all watchers
    for (const watcher of this.watchers.values()) {
      if (watcher.close) {
        await watcher.close();
      }
    }
    this.watchers.clear();

    // Clear sensitive data
    this.secrets.clear();

    this.emit('config:shutdown');
  }

  // Private methods

  async ensureDirectories() {
    try {
      await fs.mkdir(this.config.configDir, { recursive: true });
      
      if (this.config.enableSecrets) {
        await fs.mkdir(this.config.secretsDir, { recursive: true });
      }

    } catch (error) {
      this.emit('config:directory-error', { error });
    }
  }

  async loadEnvironmentConfig() {
    const envFilePath = path.join(process.cwd(), this.config.environmentFile);
    
    try {
      const content = await fs.readFile(envFilePath, 'utf-8');
      const envVars = this.parseEnvironmentFile(content);
      
      this.environments.set(this.currentEnvironment, envVars);
      
      // Apply to process.env
      Object.entries(envVars).forEach(([key, value]) => {
        if (!process.env[key]) {
          process.env[key] = value;
        }
      });

      this.emit('config:environment-loaded', { environment: this.currentEnvironment });

    } catch (error) {
      // Environment file is optional
      this.emit('config:environment-not-found', { path: envFilePath });
    }
  }

  async loadSystemConfig() {
    const systemConfigPath = path.join(this.config.configDir, 'system.json');
    
    try {
      const systemConfig = await this.loadConfigFromFile(systemConfigPath, this.configTypes.SYSTEM);
      this.configurations.set('system', systemConfig);
      this.metrics.configurationsLoaded++;

    } catch (error) {
      // System config is optional, create default
      this.configurations.set('system', {
        autoLoadModules: [],
        defaultPermissions: [],
        enableHotReload: true
      });
    }
  }

  async loadModuleConfigurations() {
    try {
      const configFiles = await fs.readdir(this.config.configDir);
      
      for (const file of configFiles) {
        if (file === 'system.json') continue; // Skip system config
        
        const filePath = path.join(this.config.configDir, file);
        const stat = await fs.stat(filePath);
        
        if (stat.isFile() && this.isConfigFile(file)) {
          const moduleId = path.basename(file, path.extname(file));
          const config = await this.loadConfigFromFile(filePath);
          
          this.configurations.set(moduleId, config);
          this.metrics.configurationsLoaded++;
        }
      }

    } catch (error) {
      this.emit('config:load-modules-error', { error });
    }
  }

  async loadSecrets() {
    try {
      const secretFiles = await fs.readdir(this.config.secretsDir);
      
      for (const file of secretFiles) {
        if (this.isSecretFile(file)) {
          const secretPath = path.join(this.config.secretsDir, file);
          const content = await fs.readFile(secretPath, 'utf-8');
          
          const decryptedContent = this.config.encryptSecrets
            ? await this.decryptValue(content)
            : content;
          
          const secretKey = path.basename(file, path.extname(file));
          this.secrets.set(secretKey, decryptedContent);
          this.metrics.secretsLoaded++;
        }
      }

    } catch (error) {
      this.emit('config:load-secrets-error', { error });
    }
  }

  parseConfigContent(content, filePath) {
    const ext = path.extname(filePath).toLowerCase();
    
    switch (ext) {
      case '.json':
        return JSON.parse(content);
      
      case '.yaml':
      case '.yml':
        // Would use yaml parser in real implementation
        throw new Error('YAML parsing not implemented');
      
      case '.toml':
        // Would use TOML parser in real implementation
        throw new Error('TOML parsing not implemented');
      
      default:
        throw new Error(`Unsupported config format: ${ext}`);
    }
  }

  serializeConfig(config, filePath) {
    const ext = path.extname(filePath).toLowerCase();
    
    switch (ext) {
      case '.json':
        return JSON.stringify(config, null, 2);
      
      case '.yaml':
      case '.yml':
        // Would use yaml serializer in real implementation
        throw new Error('YAML serialization not implemented');
      
      case '.toml':
        // Would use TOML serializer in real implementation
        throw new Error('TOML serialization not implemented');
      
      default:
        throw new Error(`Unsupported config format: ${ext}`);
    }
  }

  parseEnvironmentFile(content) {
    const envVars = {};
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          envVars[key.trim()] = valueParts.join('=').trim();
        }
      }
    }
    
    return envVars;
  }

  getNestedValue(obj, key, defaultValue) {
    const keys = key.split('.');
    let current = obj;
    
    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) {
        current = current[k];
      } else {
        return defaultValue;
      }
    }
    
    return current;
  }

  setNestedValue(obj, key, value) {
    const keys = key.split('.');
    const lastKey = keys.pop();
    let current = obj;
    
    for (const k of keys) {
      if (!(k in current) || typeof current[k] !== 'object') {
        current[k] = {};
      }
      current = current[k];
    }
    
    current[lastKey] = value;
  }

  isConfigFile(filename) {
    const configExtensions = ['.json', '.yaml', '.yml', '.toml'];
    const ext = path.extname(filename).toLowerCase();
    return configExtensions.includes(ext);
  }

  isSecretFile(filename) {
    return filename.endsWith('.secret') || filename.endsWith('.key');
  }

  async validateConfiguration(moduleId, config) {
    const validator = this.validators.get(moduleId);
    
    if (validator) {
      try {
        const isValid = await validator(config);
        if (!isValid) {
          this.metrics.validationErrors++;
          throw new Error(`Configuration validation failed for module ${moduleId}`);
        }
      } catch (error) {
        this.metrics.validationErrors++;
        this.emit('config:validation-error', { moduleId, error });
        throw error;
      }
    }
  }

  async persistModuleConfig(moduleId, config) {
    const configPath = path.join(this.config.configDir, `${moduleId}.json`);
    await this.saveConfigToFile(config, configPath);
  }

  async persistEnvironmentConfig() {
    const envPath = path.join(process.cwd(), this.config.environmentFile);
    const envConfig = this.environments.get(this.currentEnvironment) || {};
    
    const content = Object.entries(envConfig)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    
    await fs.writeFile(envPath, content, 'utf-8');
  }

  async persistSecret(key, encryptedValue) {
    const secretPath = path.join(this.config.secretsDir, `${key}.secret`);
    await fs.writeFile(secretPath, encryptedValue, 'utf-8');
  }

  async encryptValue(value) {
    // Simplified encryption - in real implementation would use proper crypto
    const crypto = await import('crypto');
    const cipher = crypto.createCipher('aes-256-cbc', 'secret-key');
    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  async decryptValue(encryptedValue) {
    // Simplified decryption - in real implementation would use proper crypto
    const crypto = await import('crypto');
    const decipher = crypto.createDecipher('aes-256-cbc', 'secret-key');
    let decrypted = decipher.update(encryptedValue, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  notifyModuleConfigChange(moduleId, key, value) {
    // Find module instance and notify if it has config change handler
    const module = this.engine.getModule(moduleId);
    
    if (module && typeof module.onConfigChange === 'function') {
      module.onConfigChange(key, value);
    }
  }

  async setupConfigWatchers() {
    const { watch } = await import('chokidar');
    
    // Watch config directory
    const configWatcher = watch(this.config.configDir, {
      persistent: true,
      ignoreInitial: true
    });

    configWatcher.on('change', async (filePath) => {
      try {
        const moduleId = path.basename(filePath, path.extname(filePath));
        if (moduleId === 'system') {
          await this.loadSystemConfig();
        } else {
          const config = await this.loadConfigFromFile(filePath);
          this.configurations.set(moduleId, config);
          this.notifyModuleConfigChange(moduleId, '*', config);
        }
        
        this.metrics.hotReloads++;
        this.emit('config:hot-reloaded', { moduleId, filePath });

      } catch (error) {
        this.emit('config:watch-error', { filePath, error });
      }
    });

    this.watchers.set('config', configWatcher);

    // Watch environment file
    const envWatcher = watch(this.config.environmentFile, {
      persistent: true,
      ignoreInitial: true
    });

    envWatcher.on('change', async () => {
      try {
        await this.loadEnvironmentConfig();
        this.emit('config:environment-reloaded');
      } catch (error) {
        this.emit('config:env-watch-error', { error });
      }
    });

    this.watchers.set('environment', envWatcher);
  }
}

export default ModuleConfig;