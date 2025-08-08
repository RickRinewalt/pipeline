/**
 * YOLO-PRO Label Management Commands
 * CLI commands for GitHub label operations
 */

class LabelCommands {
  constructor(options = {}) {
    this.gitHubClient = options.gitHubClient;
    this.labelManager = options.labelManager;
    
    this.description = 'GitHub label management operations';
    this.usage = 'yolo-pro label <subcommand> [options]';
    this.subcommands = [
      {
        name: 'list',
        description: 'List available labels in repository',
        usage: 'yolo-pro label list [--filter <type>]',
        parameters: [
          { name: '--filter', description: 'Filter by label category (priority, type, status, sparc)' },
          { name: '--format', description: 'Output format (table, json, csv)' }
        ]
      },
      {
        name: 'create',
        description: 'Create a new label',
        usage: 'yolo-pro label create <name> [--color <hex>] [--description <desc>]',
        parameters: [
          { name: 'name', description: 'Label name (required)' },
          { name: '--color', description: 'Hex color code (without #)' },
          { name: '--description', description: 'Label description' }
        ]
      },
      {
        name: 'init-standards',
        description: 'Initialize all standard YOLO-PRO labels',
        usage: 'yolo-pro label init-standards [--force]',
        parameters: [
          { name: '--force', description: 'Recreate existing labels' }
        ]
      },
      {
        name: 'validate',
        description: 'Validate label format and existence',
        usage: 'yolo-pro label validate <labels...>',
        parameters: [
          { name: 'labels', description: 'Space-separated list of labels to validate' }
        ]
      },
      {
        name: 'bulk-create',
        description: 'Create multiple labels from list',
        usage: 'yolo-pro label bulk-create <labels...> [--from-file <path>]',
        parameters: [
          { name: 'labels', description: 'Space-separated list of labels' },
          { name: '--from-file', description: 'Read labels from file (one per line)' }
        ]
      }
    ];
    
    this.examples = [
      'yolo-pro label list',
      'yolo-pro label list --filter priority',
      'yolo-pro label create priority:urgent --color b60205 --description "Urgent priority"',
      'yolo-pro label init-standards',
      'yolo-pro label validate priority:high type:feature',
      'yolo-pro label bulk-create label1 label2 label3'
    ];
  }

  async execute(context) {
    const { subcommand, arguments: args, options, flags } = context;
    
    try {
      switch (subcommand) {
        case 'list':
          return await this.list(options);
        case 'create':
          return await this.create(args[0], options);
        case 'init-standards':
          return await this.initStandards(options);
        case 'validate':
          return await this.validate(args);
        case 'bulk-create':
          return await this.bulkCreate(args, options);
        default:
          return {
            success: false,
            error: `Unknown subcommand: ${subcommand}`,
            availableSubcommands: this.subcommands.map(sub => sub.name)
          };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        type: 'execution-error'
      };
    }
  }

  async list(options = {}) {
    try {
      if (!this.labelManager) {
        throw new Error('Label manager not configured');
      }

      // Get all repository labels
      const repoLabels = await this.labelManager._getRepositoryLabels();
      let labels = repoLabels;

      // Apply filtering
      if (options.filter) {
        const standardLabels = this.labelManager.getYoloProLabelSet();
        const categoryMap = new Map();
        
        standardLabels.forEach(label => {
          categoryMap.set(label.name, label.category);
        });

        labels = labels.filter(label => {
          const category = categoryMap.get(label.name);
          return category === options.filter;
        });
      }

      // Format output
      const formattedLabels = labels.map(label => ({
        name: label.name,
        color: label.color,
        description: label.description || '',
        category: this._getCategoryForLabel(label.name)
      }));

      return {
        success: true,
        labels: formattedLabels,
        total: formattedLabels.length,
        format: options.format || 'table'
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        type: 'api-error'
      };
    }
  }

  async create(labelName, options = {}) {
    try {
      if (!labelName) {
        return {
          success: false,
          error: 'Label name is required',
          usage: 'yolo-pro label create <name> [--color <hex>] [--description <desc>]'
        };
      }

      if (!this.labelManager) {
        throw new Error('Label manager not configured');
      }

      // Validate label format
      if (this.labelManager.isLabelFormatValid && !this.labelManager.isLabelFormatValid(labelName)) {
        return {
          success: false,
          error: `Invalid label format: ${labelName}`,
          suggestion: this.labelManager._suggestLabelFormat ? this.labelManager._suggestLabelFormat(labelName) : null
        };
      }

      // Create custom definition if provided
      let customDefinition = null;
      if (options.color || options.description) {
        customDefinition = {
          name: labelName,
          color: options.color || '0052cc',
          description: options.description || `Custom label: ${labelName}`
        };
      }

      const result = await this.labelManager.createLabel(labelName, customDefinition);

      if (!result.success) {
        return {
          success: false,
          error: result.error,
          conflicted: result.conflicted,
          requiresPermission: result.requiresPermission
        };
      }

      return {
        success: true,
        label: result.label,
        message: `Label '${labelName}' created successfully`
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        type: 'creation-error'
      };
    }
  }

  async initStandards(options = {}) {
    try {
      if (!this.labelManager) {
        throw new Error('Label manager not configured');
      }

      const result = await this.labelManager.ensureStandardLabelsExist();

      if (!result.success) {
        return {
          success: false,
          error: result.error,
          failed: result.failed
        };
      }

      return {
        success: true,
        created: result.created,
        existing: result.existing,
        message: `Created ${result.created.length} labels, ${result.existing.length} already existed`,
        summary: {
          totalStandards: this.labelManager.getYoloProLabelSet().length,
          newlyCreated: result.created.length,
          alreadyExisted: result.existing.length
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        type: 'initialization-error'
      };
    }
  }

  async validate(labels) {
    try {
      if (!Array.isArray(labels) || labels.length === 0) {
        return {
          success: false,
          error: 'At least one label is required for validation',
          usage: 'yolo-pro label validate <labels...>'
        };
      }

      if (!this.labelManager) {
        throw new Error('Label manager not configured');
      }

      const formatErrors = [];
      const validLabels = [];

      // Check format first
      labels.forEach(label => {
        if (this.labelManager.isLabelFormatValid(label)) {
          validLabels.push(label);
        } else {
          formatErrors.push({
            label,
            error: 'Invalid format',
            suggestion: this.labelManager._suggestLabelFormat(label)
          });
        }
      });

      if (formatErrors.length > 0) {
        return {
          success: false,
          errors: formatErrors,
          validLabels: validLabels.length
        };
      }

      // Validate against repository
      const validation = await this.labelManager.validateLabels(validLabels);

      return {
        success: validation.success,
        valid: validation.valid,
        missing: validation.missing,
        invalid: validation.invalid,
        suggestions: validation.suggestions,
        summary: {
          total: labels.length,
          valid: validation.valid.length,
          missing: validation.missing.length,
          invalid: validation.invalid.length
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        type: 'validation-error'
      };
    }
  }

  async bulkCreate(labels, options = {}) {
    try {
      let labelsToCreate = labels;

      // Read from file if specified
      if (options['from-file']) {
        const fs = require('fs').promises;
        const fileContent = await fs.readFile(options['from-file'], 'utf8');
        labelsToCreate = fileContent.split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0);
      }

      if (!Array.isArray(labelsToCreate) || labelsToCreate.length === 0) {
        return {
          success: false,
          error: 'No labels provided for creation',
          usage: 'yolo-pro label bulk-create <labels...> [--from-file <path>]'
        };
      }

      if (!this.labelManager) {
        throw new Error('Label manager not configured');
      }

      const result = await this.labelManager.ensureLabelsExist(labelsToCreate);

      return {
        success: result.success,
        created: result.created,
        existing: result.existing,
        failed: result.failed,
        errors: result.errors,
        summary: {
          requested: labelsToCreate.length,
          created: result.created.length,
          alreadyExisted: result.existing.length,
          failed: result.failed.length
        },
        message: `Processed ${labelsToCreate.length} labels: ${result.created.length} created, ${result.existing.length} existing, ${result.failed.length} failed`
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        type: 'bulk-creation-error'
      };
    }
  }

  // Helper method to get category for a label
  _getCategoryForLabel(labelName) {
    const standardLabels = this.labelManager ? this.labelManager.getYoloProLabelSet() : [];
    const found = standardLabels.find(label => label.name === labelName);
    return found ? found.category : 'custom';
  }
}

module.exports = LabelCommands;