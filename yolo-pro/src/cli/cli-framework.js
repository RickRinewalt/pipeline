/**
 * YOLO-PRO CLI Framework
 * Enhanced command-line interface framework with plugin support
 */

const { EventEmitter } = require('events');
const path = require('path');
const fs = require('fs').promises;

class CLIFramework extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      pluginDirectory: options.pluginDirectory || './plugins',
      configFile: options.configFile || './yolo-pro.config.json',
      enablePlugins: options.enablePlugins !== false,
      ...options
    };

    this.commands = new Map();
    this.plugins = new Map();
    this.config = {};
    this.progressTrackers = new Map();
    
    // Command trie for auto-completion
    this.commandTrie = this._buildCommandTrie();
    
    this._initialized = false;
  }

  /**
   * Initialize the CLI framework
   */
  async initialize() {
    if (this._initialized) return;

    try {
      // Load configuration
      await this._loadConfiguration();
      
      // Register built-in commands
      await this._registerBuiltInCommands();
      
      // Discover and load plugins
      if (this.options.enablePlugins) {
        await this._discoverAndLoadPlugins();
      }
      
      this._initialized = true;
      this.emit('initialized');
      
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Parse command line arguments
   */
  parseArguments(args) {
    if (!Array.isArray(args) || args.length === 0) {
      return {
        valid: false,
        errors: ['No command provided'],
        suggestions: this._getTopLevelCommands()
      };
    }

    const parsed = {
      command: args[0],
      subcommand: null,
      arguments: [],
      options: {},
      flags: [],
      valid: true,
      errors: []
    };

    let currentIndex = 1;
    
    // Parse subcommand
    if (args.length > 1 && !args[1].startsWith('-')) {
      parsed.subcommand = args[1];
      currentIndex = 2;
    }

    // Parse remaining arguments and options
    while (currentIndex < args.length) {
      const arg = args[currentIndex];
      
      if (arg.startsWith('--')) {
        // Long option
        const optionName = arg.substring(2);
        if (currentIndex + 1 < args.length && !args[currentIndex + 1].startsWith('-')) {
          parsed.options[optionName] = args[currentIndex + 1];
          currentIndex += 2;
        } else {
          parsed.flags.push(optionName);
          currentIndex += 1;
        }
      } else if (arg.startsWith('-')) {
        // Short option or flag
        const optionName = arg.substring(1);
        if (currentIndex + 1 < args.length && !args[currentIndex + 1].startsWith('-')) {
          parsed.options[optionName] = args[currentIndex + 1];
          currentIndex += 2;
        } else {
          parsed.flags.push(optionName);
          currentIndex += 1;
        }
      } else {
        // Regular argument
        parsed.arguments.push(arg);
        currentIndex += 1;
      }
    }

    // Validate command exists
    if (!this.commands.has(parsed.command)) {
      parsed.valid = false;
      parsed.errors.push(`Unknown command: ${parsed.command}`);
      parsed.suggestions = this.getAutoCompletions(parsed.command);
    }

    return parsed;
  }

  /**
   * Execute a command
   */
  async executeCommand(args) {
    try {
      const parsed = this.parseArguments(args);
      
      if (!parsed.valid) {
        return {
          success: false,
          error: parsed.errors.join(', '),
          errors: parsed.errors,
          suggestions: parsed.suggestions
        };
      }

      const command = this.commands.get(parsed.command);
      if (!command) {
        return {
          success: false,
          error: `Unknown command: ${parsed.command}`,
          suggestions: this.getAutoCompletions(parsed.command)
        };
      }

      // Create execution context
      const context = {
        command: parsed.command,
        subcommand: parsed.subcommand,
        arguments: parsed.arguments,
        options: parsed.options,
        flags: parsed.flags,
        cli: this
      };

      // Execute command
      const result = await command.execute(context);
      
      this.emit('command-executed', {
        command: parsed.command,
        subcommand: parsed.subcommand,
        success: result.success,
        duration: result.duration
      });

      return result;

    } catch (error) {
      this.emit('command-error', error);
      return {
        success: false,
        error: error.message,
        type: this.classifyError(error).type
      };
    }
  }

  /**
   * Register a command
   */
  registerCommand(name, command) {
    if (typeof name !== 'string' || !command) {
      throw new Error('Invalid command registration parameters');
    }

    if (!command.execute || typeof command.execute !== 'function') {
      throw new Error('Command must have an execute method');
    }

    this.commands.set(name, command);
    this._updateCommandTrie();
    
    this.emit('command-registered', name);
  }

  /**
   * Get registered commands
   */
  getRegisteredCommands() {
    return Array.from(this.commands.keys());
  }

  /**
   * Get auto-completion suggestions
   */
  getAutoCompletions(input) {
    if (!input || typeof input !== 'string') {
      return this._getTopLevelCommands();
    }

    const suggestions = [];
    const inputLower = input.toLowerCase();

    // Exact prefix matches first
    for (const command of this.commands.keys()) {
      if (command.toLowerCase().startsWith(inputLower)) {
        suggestions.push(command);
      }
    }

    // If no exact matches, try fuzzy matching
    if (suggestions.length === 0) {
      for (const command of this.commands.keys()) {
        if (this._fuzzyMatch(command.toLowerCase(), inputLower)) {
          suggestions.push(command);
        }
      }
    }

    return suggestions.sort();
  }

  /**
   * Get help information for a command
   */
  getHelp(commandName) {
    if (!commandName) {
      return this._getGeneralHelp();
    }

    const command = this.commands.get(commandName);
    if (!command) {
      return {
        error: `Command '${commandName}' not found`,
        suggestions: this.getAutoCompletions(commandName)
      };
    }

    return {
      name: commandName,
      description: command.description || 'No description available',
      usage: command.usage || `yolo-pro ${commandName} [options]`,
      subcommands: command.subcommands || [],
      options: command.options || [],
      examples: command.examples || [],
      seeAlso: command.seeAlso || []
    };
  }

  /**
   * Get contextual help
   */
  getContextualHelp(args) {
    const parsed = this.parseArguments(args);
    const help = this.getHelp(parsed.command);
    
    if (parsed.subcommand && help.subcommands) {
      const subcommandHelp = help.subcommands.find(sub => sub.name === parsed.subcommand);
      if (subcommandHelp) {
        return {
          command: parsed.command,
          subcommand: parsed.subcommand,
          description: subcommandHelp.description,
          usage: subcommandHelp.usage,
          parameters: subcommandHelp.parameters || [],
          examples: subcommandHelp.examples || []
        };
      }
    }

    return help;
  }

  /**
   * Get help navigation structure
   */
  getHelpNavigation(commandName) {
    const help = this.getHelp(commandName);
    
    return {
      current: commandName,
      parent: null, // Could be enhanced for nested commands
      children: help.subcommands ? help.subcommands.map(sub => sub.name) : [],
      related: help.seeAlso || [],
      siblings: this.getRegisteredCommands().filter(cmd => cmd !== commandName)
    };
  }

  /**
   * Create progress tracker
   */
  createProgressTracker(options = {}) {
    const trackerId = `tracker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const tracker = {
      id: trackerId,
      current: 0,
      total: options.total || 100,
      label: options.label || 'Processing',
      startTime: Date.now(),
      isComplete: false,
      
      increment(amount = 1) {
        this.current = Math.min(this.current + amount, this.total);
        const percentage = Math.round((this.current / this.total) * 100);
        
        this.emit('progress', {
          current: this.current,
          total: this.total,
          percentage,
          label: this.label,
          elapsed: Date.now() - this.startTime
        });
        
        if (this.current >= this.total) {
          this.complete();
        }
      },
      
      complete() {
        this.isComplete = true;
        this.current = this.total;
        
        this.emit('complete', {
          total: this.total,
          elapsed: Date.now() - this.startTime
        });
      },
      
      // Make it an event emitter
      emit: this.emit.bind(this),
      on: this.on.bind(this)
    };

    this.progressTrackers.set(trackerId, tracker);
    
    // Clean up completed trackers after a delay
    setTimeout(() => {
      this.progressTrackers.delete(trackerId);
    }, 60000); // 1 minute

    return tracker;
  }

  /**
   * Classify error types
   */
  classifyError(error) {
    const classification = {
      type: 'unknown',
      recoverable: false,
      suggestions: []
    };

    if (error.code === 'NETWORK_ERROR' || error.message.includes('network')) {
      classification.type = 'network';
      classification.recoverable = true;
      classification.suggestions = [
        'Check your internet connection',
        'Verify GitHub API is accessible',
        'Try again in a few moments'
      ];
    } else if (error.status === 401 || error.message.includes('authentication')) {
      classification.type = 'authentication';
      classification.recoverable = true;
      classification.suggestions = [
        'Check your GitHub token',
        'Verify token permissions',
        'Run: yolo-pro config set github.token <your-token>'
      ];
    } else if (error.status === 403) {
      classification.type = 'permission';
      classification.recoverable = true;
      classification.suggestions = [
        'Check repository permissions',
        'Verify token has required scopes',
        'Contact repository administrator'
      ];
    } else if (error.status === 404) {
      classification.type = 'not-found';
      classification.recoverable = false;
      classification.suggestions = [
        'Verify repository name',
        'Check if resource exists',
        'Confirm access permissions'
      ];
    } else if (error.status === 422) {
      classification.type = 'validation';
      classification.recoverable = true;
      classification.suggestions = [
        'Check input parameters',
        'Verify data format',
        'Review API documentation'
      ];
    }

    return classification;
  }

  /**
   * Format error message with suggestions
   */
  formatError(error) {
    const classification = this.classifyError(error);
    let message = `Error: ${error.message}\n`;
    
    if (classification.suggestions.length > 0) {
      message += '\nTry:\n';
      classification.suggestions.forEach(suggestion => {
        message += `  • ${suggestion}\n`;
      });
    }

    return message.trim();
  }

  /**
   * Load configuration
   */
  loadConfiguration() {
    return this.config;
  }

  /**
   * Update configuration
   */
  updateConfiguration(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this.emit('config-updated', this.config);
  }

  /**
   * Get current configuration
   */
  getConfiguration() {
    return { ...this.config };
  }

  /**
   * Validate configuration
   */
  validateConfiguration(config) {
    const validation = {
      valid: true,
      errors: []
    };

    // Check GitHub token
    if (!config.github || !config.github.token) {
      validation.valid = false;
      validation.errors.push('GitHub token is required');
    }

    // Check repository settings
    if (config.github && (!config.github.owner || !config.github.repo)) {
      validation.valid = false;
      validation.errors.push('GitHub owner and repo are required');
    }

    return validation;
  }

  /**
   * Discover plugins in plugin directory
   */
  async discoverPlugins() {
    try {
      const pluginDir = path.resolve(this.options.pluginDirectory);
      const entries = await fs.readdir(pluginDir);
      const plugins = [];

      for (const entry of entries) {
        try {
          const pluginPath = path.join(pluginDir, entry);
          const manifestPath = path.join(pluginPath, 'package.json');
          
          const manifestData = await fs.readFile(manifestPath, 'utf8');
          const manifest = JSON.parse(manifestData);
          
          if (this._validatePluginManifest(manifest)) {
            plugins.push({
              name: entry,
              path: pluginPath,
              manifest
            });
          }
        } catch (error) {
          // Skip invalid plugins
          continue;
        }
      }

      return plugins;
    } catch (error) {
      // Plugin directory doesn't exist or not accessible
      return [];
    }
  }

  /**
   * Register a plugin
   */
  async registerPlugin(plugin) {
    try {
      if (!plugin.name || !plugin.commands) {
        return {
          success: false,
          error: 'Invalid plugin structure'
        };
      }

      // Register plugin commands
      for (const [commandName, commandImpl] of Object.entries(plugin.commands)) {
        this.registerCommand(commandName, commandImpl);
      }

      this.plugins.set(plugin.name, plugin);
      
      return {
        success: true,
        commandsRegistered: Object.keys(plugin.commands).length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Private helper methods

  async _loadConfiguration() {
    try {
      const configPath = path.resolve(this.options.configFile);
      const configData = await fs.readFile(configPath, 'utf8');
      this.config = JSON.parse(configData);
    } catch (error) {
      // Use default configuration
      this.config = {
        github: {
          token: process.env.GITHUB_TOKEN,
          owner: process.env.GITHUB_OWNER,
          repo: process.env.GITHUB_REPO
        },
        commands: {
          defaultTimeout: 30000,
          enableProgressBars: true
        }
      };
    }
  }

  async _registerBuiltInCommands() {
    // Register help command
    this.registerCommand('help', {
      description: 'Show help information',
      execute: async (context) => {
        const helpInfo = context.arguments.length > 0 
          ? this.getHelp(context.arguments[0])
          : this._getGeneralHelp();
        
        return {
          success: true,
          help: helpInfo
        };
      }
    });

    // Import and register other built-in commands
    try {
      const LabelCommands = require('./commands/label-commands');
      const labelCommands = new LabelCommands({
        gitHubClient: this.config.gitHubClient,
        labelManager: this.config.labelManager
      });
      this.registerCommand('label', labelCommands);

      const IssueCommands = require('./commands/issue-commands');
      const issueCommands = new IssueCommands({
        gitHubClient: this.config.gitHubClient,
        labelManager: this.config.labelManager
      });
      this.registerCommand('issue', issueCommands);

      const WorkflowCommands = require('./commands/workflow-commands');
      const workflowCommands = new WorkflowCommands({
        gitHubClient: this.config.gitHubClient,
        patternLibrary: this.config.patternLibrary
      });
      this.registerCommand('workflow', workflowCommands);

      // Register milestone command as placeholder
      this.registerCommand('milestone', {
        description: 'Milestone management operations',
        execute: async (context) => ({ success: true, message: 'Milestone command placeholder' })
      });

    } catch (error) {
      // Commands not available or not properly configured
      console.warn('Some built-in commands could not be loaded:', error.message);
    }
  }

  async _discoverAndLoadPlugins() {
    const plugins = await this.discoverPlugins();
    
    for (const pluginInfo of plugins) {
      try {
        const plugin = require(pluginInfo.path);
        await this.registerPlugin(plugin);
      } catch (error) {
        console.warn(`Failed to load plugin ${pluginInfo.name}:`, error.message);
      }
    }
  }

  _validatePluginManifest(manifest) {
    return manifest.name && 
           manifest.version && 
           manifest.main &&
           manifest.yoloProVersion;
  }

  _buildCommandTrie() {
    // Simplified trie implementation for command completion
    return new Map();
  }

  _updateCommandTrie() {
    // Update trie with new commands
    // Implementation would build a proper trie structure
  }

  _getTopLevelCommands() {
    return Array.from(this.commands.keys());
  }

  _fuzzyMatch(str, pattern) {
    // Simple fuzzy matching implementation
    const patternLength = pattern.length;
    const strLength = str.length;
    
    if (patternLength === 0) return true;
    if (strLength === 0) return false;

    let patternIndex = 0;
    let strIndex = 0;

    while (patternIndex < patternLength && strIndex < strLength) {
      if (pattern[patternIndex] === str[strIndex]) {
        patternIndex++;
      }
      strIndex++;
    }

    return patternIndex === patternLength;
  }

  _getGeneralHelp() {
    const commands = this.getRegisteredCommands();
    
    return {
      title: 'YOLO-PRO CLI Framework',
      description: 'Enhanced command-line interface for YOLO-PRO workflows',
      usage: 'yolo-pro <command> [subcommand] [options]',
      availableCommands: commands.map(cmd => ({
        name: cmd,
        description: this.commands.get(cmd).description || 'No description'
      })),
      examples: [
        'yolo-pro help',
        'yolo-pro label list',
        'yolo-pro issue create --title "New feature"',
        'yolo-pro workflow init-wcp'
      ]
    };
  }
}

module.exports = CLIFramework;