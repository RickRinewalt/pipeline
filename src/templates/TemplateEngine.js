/**
 * YOLO-PRO Issue Template Engine
 * Core template processing and management system
 * Implements SPARC Phase 4: Refinement with TDD methodology
 */

const { v4: uuidv4 } = require('uuid');
const { EventEmitter } = require('events');

class TemplateEngine extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      cacheSize: config.cacheSize || 1000,
      cacheTTL: config.cacheTTL || 300000, // 5 minutes
      maxTemplateSize: config.maxTemplateSize || 50000, // 50KB
      validationTimeout: config.validationTimeout || 5000,
      pluginTimeout: config.pluginTimeout || 10000,
      ...config
    };

    this.templateCache = new Map();
    this.templateRepository = new TemplateRepository(config.storage);
    this.templateValidator = new TemplateValidator(config.validationRules);
    this.pluginManager = new TemplatePluginManager(config.pluginPath);
    this.compiler = new TemplateCompiler(config.compilerOptions);
    
    this.metrics = {
      templatesCreated: 0,
      templatesApplied: 0,
      cacheHits: 0,
      cacheMisses: 0,
      validationErrors: 0,
      pluginExecutions: 0
    };

    this._initializeStandardTemplates();
  }

  /**
   * Create a new template with full validation and plugin support
   */
  async createTemplate(definition, userId, options = {}) {
    try {
      const startTime = Date.now();
      
      // Input validation
      if (!definition || typeof definition !== 'object') {
        throw new TemplateValidationError('Template definition is required');
      }

      if (!userId) {
        throw new TemplateValidationError('User ID is required');
      }

      // Structure validation
      const validationResult = await this.templateValidator.validate(definition, {
        timeout: this.config.validationTimeout,
        strict: options.strictValidation !== false
      });

      if (!validationResult.valid) {
        this.metrics.validationErrors++;
        throw new TemplateValidationError(
          'Template validation failed', 
          validationResult.errors
        );
      }

      // Permission check
      if (!await this._checkPermissions(userId, 'template:create', definition)) {
        throw new TemplatePermissionError('Insufficient permissions to create template');
      }

      // Process template definition
      const template = await this._processTemplateDefinition(definition, userId);

      // Handle template inheritance
      if (template.parent) {
        template = await this._processTemplateInheritance(template);
      }

      // Plugin processing
      if (definition.plugins && definition.plugins.length > 0) {
        template = await this._processTemplatePlugins(template, definition.plugins);
        this.metrics.pluginExecutions++;
      }

      // Compile template
      const compiledTemplate = await this.compiler.compile(template);

      // Store template
      const storedTemplate = await this.templateRepository.save(compiledTemplate);

      // Update cache
      this._updateTemplateCache(storedTemplate.id, storedTemplate);

      // Emit event
      this.emit('template:created', {
        templateId: storedTemplate.id,
        userId,
        template: storedTemplate,
        processingTime: Date.now() - startTime
      });

      this.metrics.templatesCreated++;

      return {
        success: true,
        template: storedTemplate,
        validationResult: validationResult,
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      this.emit('template:error', {
        operation: 'create',
        error: error.message,
        userId,
        definition: definition?.name
      });

      if (error instanceof TemplateError) {
        throw error;
      }

      throw new TemplateProcessingError(`Template creation failed: ${error.message}`);
    }
  }

  /**
   * Get template by ID with caching support
   */
  async getTemplate(templateId, options = {}) {
    try {
      if (!templateId) {
        throw new TemplateValidationError('Template ID is required');
      }

      // Check cache first
      const cached = this.templateCache.get(templateId);
      if (cached && Date.now() - cached.timestamp < this.config.cacheTTL) {
        this.metrics.cacheHits++;
        return cached.template;
      }

      this.metrics.cacheMisses++;

      // Fetch from repository
      const template = await this.templateRepository.get(templateId);
      
      if (!template) {
        throw new TemplateNotFoundError(`Template not found: ${templateId}`);
      }

      // Update cache
      this._updateTemplateCache(templateId, template);

      return template;

    } catch (error) {
      if (error instanceof TemplateError) {
        throw error;
      }
      
      throw new TemplateProcessingError(`Failed to get template: ${error.message}`);
    }
  }

  /**
   * Apply template to issue data with full validation
   */
  async applyTemplate(templateId, issueData, options = {}) {
    try {
      const startTime = Date.now();

      // Validate inputs
      if (!templateId) {
        throw new TemplateValidationError('Template ID is required');
      }

      if (!issueData || typeof issueData !== 'object') {
        throw new TemplateValidationError('Issue data is required');
      }

      // Get template
      const template = await this.getTemplate(templateId);

      // Process template fields
      const processedFields = await this._processTemplateFields(template, issueData, options);

      // Validate required fields
      const fieldValidation = await this._validateTemplateFields(template, processedFields);
      
      if (!fieldValidation.valid) {
        throw new TemplateValidationError(
          'Field validation failed',
          fieldValidation.errors
        );
      }

      // Apply template transformations
      const appliedTemplate = await this._applyTemplateTransformations(
        template,
        processedFields,
        issueData,
        options
      );

      // Plugin post-processing
      if (template.plugins && template.plugins.length > 0) {
        appliedTemplate = await this._postProcessWithPlugins(appliedTemplate, template.plugins);
      }

      const result = {
        templateId: templateId,
        templateVersion: template.version,
        appliedAt: new Date().toISOString(),
        appliedBy: options.userId,
        fields: appliedTemplate.fields,
        metadata: appliedTemplate.metadata,
        processingTime: Date.now() - startTime
      };

      // Emit event
      this.emit('template:applied', {
        templateId,
        issueData: issueData.title || 'Unknown',
        result,
        processingTime: Date.now() - startTime
      });

      this.metrics.templatesApplied++;

      return {
        success: true,
        appliedTemplate: result,
        validationResult: fieldValidation
      };

    } catch (error) {
      this.emit('template:error', {
        operation: 'apply',
        templateId,
        error: error.message
      });

      if (error instanceof TemplateError) {
        throw error;
      }

      throw new TemplateProcessingError(`Template application failed: ${error.message}`);
    }
  }

  /**
   * Batch apply templates with concurrency control
   */
  async batchApplyTemplates(operations, options = {}) {
    try {
      const {
        concurrency = 5,
        continueOnError = true,
        timeout = 30000
      } = options;

      if (!Array.isArray(operations) || operations.length === 0) {
        throw new TemplateValidationError('Operations array is required');
      }

      const results = {
        successful: [],
        failed: [],
        skipped: [],
        totalProcessed: 0,
        totalTime: 0
      };

      const startTime = Date.now();

      // Process in batches
      const batches = this._createBatches(operations, concurrency);

      for (const batch of batches) {
        const batchPromises = batch.map(async (operation) => {
          try {
            const result = await Promise.race([
              this.applyTemplate(operation.templateId, operation.issueData, operation.options),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Operation timeout')), timeout)
              )
            ]);

            return { success: true, operation, result };
          } catch (error) {
            if (continueOnError) {
              return { success: false, operation, error: error.message };
            }
            throw error;
          }
        });

        const batchResults = await Promise.all(batchPromises);

        batchResults.forEach(result => {
          results.totalProcessed++;
          
          if (result.success) {
            results.successful.push(result);
          } else {
            results.failed.push(result);
          }
        });
      }

      results.totalTime = Date.now() - startTime;

      return {
        success: results.failed.length === 0,
        results,
        summary: {
          total: operations.length,
          successful: results.successful.length,
          failed: results.failed.length,
          skipped: results.skipped.length,
          processingTime: results.totalTime
        }
      };

    } catch (error) {
      throw new TemplateProcessingError(`Batch template application failed: ${error.message}`);
    }
  }

  /**
   * Validate template definition
   */
  async validateTemplate(definition, options = {}) {
    try {
      return await this.templateValidator.validate(definition, options);
    } catch (error) {
      throw new TemplateValidationError(`Template validation failed: ${error.message}`);
    }
  }

  /**
   * Register template plugin
   */
  async registerPlugin(plugin, options = {}) {
    try {
      if (!plugin || typeof plugin !== 'object') {
        throw new TemplateValidationError('Plugin object is required');
      }

      const result = await this.pluginManager.register(plugin, options);
      
      this.emit('plugin:registered', {
        pluginName: plugin.name,
        version: plugin.version,
        result
      });

      return result;
    } catch (error) {
      throw new TemplatePluginError(`Plugin registration failed: ${error.message}`);
    }
  }

  /**
   * Get template metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      cacheStats: {
        size: this.templateCache.size,
        maxSize: this.config.cacheSize,
        hitRatio: this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) || 0
      },
      templateRepository: this.templateRepository.getStats(),
      pluginManager: this.pluginManager.getStats()
    };
  }

  /**
   * Clear template cache
   */
  clearCache() {
    this.templateCache.clear();
    this.emit('cache:cleared', { timestamp: Date.now() });
  }

  // Private methods

  _initializeStandardTemplates() {
    this.standardTemplates = {
      bug: {
        id: 'yolo-pro-bug-template',
        name: 'Bug Report',
        type: 'bug',
        version: '1.0.0',
        fields: [
          { id: 'title', name: 'Title', type: 'text', required: true },
          { id: 'description', name: 'Description', type: 'textarea', required: true },
          { id: 'steps', name: 'Steps to Reproduce', type: 'textarea', required: true },
          { id: 'expected', name: 'Expected Behavior', type: 'textarea', required: true },
          { id: 'actual', name: 'Actual Behavior', type: 'textarea', required: true },
          { id: 'environment', name: 'Environment', type: 'text', required: false }
        ]
      },
      feature: {
        id: 'yolo-pro-feature-template',
        name: 'Feature Request',
        type: 'feature',
        version: '1.0.0',
        fields: [
          { id: 'title', name: 'Title', type: 'text', required: true },
          { id: 'description', name: 'Description', type: 'textarea', required: true },
          { id: 'motivation', name: 'Motivation', type: 'textarea', required: true },
          { id: 'acceptance', name: 'Acceptance Criteria', type: 'textarea', required: true },
          { id: 'priority', name: 'Priority', type: 'select', options: ['low', 'medium', 'high', 'critical'], required: true }
        ]
      },
      epic: {
        id: 'yolo-pro-epic-template',
        name: 'Epic',
        type: 'epic',
        version: '1.0.0',
        fields: [
          { id: 'title', name: 'Title', type: 'text', required: true },
          { id: 'objective', name: 'Business Objective', type: 'textarea', required: true },
          { id: 'requirements', name: 'Technical Requirements', type: 'textarea', required: true },
          { id: 'features', name: 'Features', type: 'textarea', required: false },
          { id: 'success_criteria', name: 'Success Criteria', type: 'textarea', required: true },
          { id: 'dependencies', name: 'Dependencies', type: 'textarea', required: false }
        ]
      }
    };
  }

  async _processTemplateDefinition(definition, userId) {
    const template = {
      id: definition.id || uuidv4(),
      name: definition.name,
      type: definition.type || 'custom',
      version: definition.version || '1.0.0',
      fields: definition.fields || [],
      validation: definition.validation || [],
      metadata: {
        createdBy: userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...definition.metadata
      },
      parent: definition.parent,
      plugins: definition.plugins || []
    };

    return template;
  }

  async _processTemplateInheritance(template) {
    const parentTemplate = await this.getTemplate(template.parent);
    
    if (!parentTemplate) {
      throw new TemplateValidationError(`Parent template not found: ${template.parent}`);
    }

    // Merge fields (child overrides parent)
    const mergedFields = [...parentTemplate.fields];
    
    template.fields.forEach(childField => {
      const existingIndex = mergedFields.findIndex(f => f.id === childField.id);
      if (existingIndex >= 0) {
        mergedFields[existingIndex] = { ...mergedFields[existingIndex], ...childField };
      } else {
        mergedFields.push(childField);
      }
    });

    return {
      ...template,
      fields: mergedFields,
      validation: [...(parentTemplate.validation || []), ...(template.validation || [])],
      metadata: {
        ...template.metadata,
        inheritedFrom: template.parent
      }
    };
  }

  async _processTemplatePlugins(template, pluginNames) {
    let processedTemplate = { ...template };

    for (const pluginName of pluginNames) {
      const plugin = this.pluginManager.getPlugin(pluginName);
      
      if (!plugin) {
        throw new TemplatePluginError(`Plugin not found: ${pluginName}`);
      }

      processedTemplate = await plugin.processTemplate(processedTemplate, {
        userId: template.metadata.createdBy,
        context: 'creation'
      });
    }

    return processedTemplate;
  }

  async _processTemplateFields(template, issueData, options) {
    const processedFields = [];

    for (const field of template.fields) {
      const fieldValue = this._extractFieldValue(issueData, field);
      
      // Apply field transformations
      const transformedValue = await this._transformFieldValue(fieldValue, field, options);

      processedFields.push({
        fieldId: field.id,
        name: field.name,
        type: field.type,
        value: fieldValue,
        transformedValue: transformedValue,
        metadata: {
          required: field.required,
          processedAt: new Date().toISOString()
        }
      });
    }

    return processedFields;
  }

  async _validateTemplateFields(template, processedFields) {
    const validation = {
      valid: true,
      errors: [],
      warnings: []
    };

    // Check required fields
    for (const field of template.fields) {
      if (field.required) {
        const processedField = processedFields.find(f => f.fieldId === field.id);
        
        if (!processedField || !processedField.value || processedField.value === '') {
          validation.valid = false;
          validation.errors.push(`Required field missing: ${field.name}`);
        }
      }
    }

    // Apply field validations
    for (const validationRule of template.validation || []) {
      const fieldValue = processedFields.find(f => f.fieldId === validationRule.field);
      
      if (fieldValue) {
        const ruleResult = await this._applyValidationRule(validationRule, fieldValue);
        
        if (!ruleResult.valid) {
          if (validationRule.severity === 'error') {
            validation.valid = false;
            validation.errors.push(ruleResult.message);
          } else {
            validation.warnings.push(ruleResult.message);
          }
        }
      }
    }

    return validation;
  }

  async _applyTemplateTransformations(template, processedFields, issueData, options) {
    return {
      fields: processedFields,
      metadata: {
        templateId: template.id,
        templateVersion: template.version,
        transformedAt: new Date().toISOString(),
        transformationOptions: options
      }
    };
  }

  _extractFieldValue(issueData, field) {
    // Extract field value from issue data based on field mapping
    if (field.mapping) {
      return this._getNestedValue(issueData, field.mapping);
    }
    
    return issueData[field.id] || field.defaultValue || '';
  }

  async _transformFieldValue(value, field, options) {
    // Apply field-specific transformations
    switch (field.type) {
      case 'text':
        return this._transformTextValue(value, field, options);
      case 'textarea':
        return this._transformTextareaValue(value, field, options);
      case 'select':
        return this._transformSelectValue(value, field, options);
      default:
        return value;
    }
  }

  _transformTextValue(value, field, options) {
    if (typeof value !== 'string') {
      return String(value || '');
    }
    
    return value.trim();
  }

  _transformTextareaValue(value, field, options) {
    if (typeof value !== 'string') {
      return String(value || '');
    }
    
    return value.trim();
  }

  _transformSelectValue(value, field, options) {
    if (field.options && !field.options.includes(value)) {
      return field.defaultValue || field.options[0] || '';
    }
    
    return value;
  }

  async _applyValidationRule(rule, fieldValue) {
    try {
      switch (rule.type) {
        case 'required':
          return {
            valid: fieldValue.value && fieldValue.value !== '',
            message: rule.message || `${fieldValue.name} is required`
          };
        case 'minLength':
          return {
            valid: (fieldValue.value || '').length >= rule.parameters.min,
            message: rule.message || `${fieldValue.name} must be at least ${rule.parameters.min} characters`
          };
        case 'maxLength':
          return {
            valid: (fieldValue.value || '').length <= rule.parameters.max,
            message: rule.message || `${fieldValue.name} must not exceed ${rule.parameters.max} characters`
          };
        case 'regex':
          const regex = new RegExp(rule.parameters.pattern);
          return {
            valid: regex.test(fieldValue.value || ''),
            message: rule.message || `${fieldValue.name} format is invalid`
          };
        default:
          return { valid: true, message: '' };
      }
    } catch (error) {
      return {
        valid: false,
        message: `Validation error: ${error.message}`
      };
    }
  }

  _updateTemplateCache(templateId, template) {
    // Implement LRU cache eviction
    if (this.templateCache.size >= this.config.cacheSize) {
      const firstKey = this.templateCache.keys().next().value;
      this.templateCache.delete(firstKey);
    }

    this.templateCache.set(templateId, {
      template,
      timestamp: Date.now()
    });
  }

  _createBatches(operations, batchSize) {
    const batches = [];
    
    for (let i = 0; i < operations.length; i += batchSize) {
      batches.push(operations.slice(i, i + batchSize));
    }
    
    return batches;
  }

  _getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  async _checkPermissions(userId, action, resource) {
    // Implement permission checking logic
    return true; // Placeholder
  }

  async _postProcessWithPlugins(appliedTemplate, plugins) {
    // Implement plugin post-processing
    return appliedTemplate; // Placeholder
  }
}

// Error classes
class TemplateError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = this.constructor.name;
    this.details = details;
  }
}

class TemplateValidationError extends TemplateError {}
class TemplateNotFoundError extends TemplateError {}
class TemplatePermissionError extends TemplateError {}
class TemplateProcessingError extends TemplateError {}
class TemplatePluginError extends TemplateError {}

// Placeholder classes - to be implemented in separate files
class TemplateRepository {
  constructor(config) {
    this.config = config;
    this.storage = new Map(); // In-memory for now
  }

  async save(template) {
    this.storage.set(template.id, template);
    return template;
  }

  async get(templateId) {
    return this.storage.get(templateId);
  }

  getStats() {
    return { total: this.storage.size };
  }
}

class TemplateValidator {
  constructor(rules) {
    this.rules = rules;
  }

  async validate(definition, options = {}) {
    const errors = [];

    if (!definition.name) {
      errors.push('Template name is required');
    }

    if (!definition.fields || !Array.isArray(definition.fields)) {
      errors.push('Template fields are required');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

class TemplatePluginManager {
  constructor(pluginPath) {
    this.pluginPath = pluginPath;
    this.plugins = new Map();
  }

  async register(plugin, options) {
    this.plugins.set(plugin.name, plugin);
    return { success: true };
  }

  getPlugin(name) {
    return this.plugins.get(name);
  }

  getStats() {
    return { total: this.plugins.size };
  }
}

class TemplateCompiler {
  constructor(options) {
    this.options = options;
  }

  async compile(template) {
    // Implement template compilation logic
    return { ...template, compiled: true };
  }
}

module.exports = {
  TemplateEngine,
  TemplateError,
  TemplateValidationError,
  TemplateNotFoundError,
  TemplatePermissionError,
  TemplateProcessingError,
  TemplatePluginError
};