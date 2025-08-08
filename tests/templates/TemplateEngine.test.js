/**
 * YOLO-PRO Template Engine Test Suite
 * Comprehensive TDD tests for template processing system
 * Implements SPARC Phase 4: Refinement testing methodology
 */

const { describe, test, expect, beforeEach, afterEach, jest } = require('@jest/globals');
const { TemplateEngine, TemplateError, TemplateValidationError } = require('../../src/templates/TemplateEngine');

describe('TemplateEngine', () => {
  let templateEngine;
  let mockConfig;

  beforeEach(() => {
    mockConfig = {
      cacheSize: 100,
      cacheTTL: 300000,
      maxTemplateSize: 50000,
      validationTimeout: 5000,
      storage: { type: 'memory' },
      validationRules: {},
      pluginPath: './test-plugins'
    };

    templateEngine = new TemplateEngine(mockConfig);
  });

  afterEach(() => {
    templateEngine.clearCache();
    jest.clearAllMocks();
  });

  describe('Template Creation', () => {
    test('should create valid template successfully', async () => {
      const templateDefinition = {
        name: 'Bug Report Template',
        type: 'bug',
        version: '1.0.0',
        fields: [
          { id: 'title', name: 'Title', type: 'text', required: true },
          { id: 'description', name: 'Description', type: 'textarea', required: true }
        ]
      };

      const result = await templateEngine.createTemplate(templateDefinition, 'test-user');

      expect(result.success).toBe(true);
      expect(result.template.id).toBeDefined();
      expect(result.template.name).toBe('Bug Report Template');
      expect(result.template.type).toBe('bug');
      expect(result.template.fields).toHaveLength(2);
      expect(result.template.metadata.createdBy).toBe('test-user');
      expect(result.processingTime).toBeGreaterThan(0);
    });

    test('should validate template definition before creation', async () => {
      const invalidTemplate = {
        // Missing required fields
        type: 'bug'
      };

      await expect(templateEngine.createTemplate(invalidTemplate, 'test-user'))
        .rejects.toThrow(TemplateValidationError);
    });

    test('should handle template inheritance correctly', async () => {
      // First create parent template
      const parentTemplate = {
        name: 'Base Template',
        type: 'base',
        fields: [
          { id: 'title', name: 'Title', type: 'text', required: true },
          { id: 'priority', name: 'Priority', type: 'select', options: ['low', 'high'], required: false }
        ]
      };

      const parentResult = await templateEngine.createTemplate(parentTemplate, 'test-user');

      // Create child template with inheritance
      const childTemplate = {
        name: 'Bug Template',
        type: 'bug',
        parent: parentResult.template.id,
        fields: [
          { id: 'steps', name: 'Reproduction Steps', type: 'textarea', required: true },
          { id: 'priority', name: 'Priority', type: 'select', options: ['low', 'medium', 'high'], required: true } // Override parent
        ]
      };

      const childResult = await templateEngine.createTemplate(childTemplate, 'test-user');

      expect(childResult.success).toBe(true);
      expect(childResult.template.fields).toHaveLength(3); // title + steps + priority (overridden)
      
      const priorityField = childResult.template.fields.find(f => f.id === 'priority');
      expect(priorityField.options).toEqual(['low', 'medium', 'high']); // Child overrides parent
      expect(priorityField.required).toBe(true);
    });

    test('should reject template creation without user ID', async () => {
      const templateDefinition = {
        name: 'Test Template',
        type: 'bug',
        fields: []
      };

      await expect(templateEngine.createTemplate(templateDefinition, null))
        .rejects.toThrow(TemplateValidationError);
    });

    test('should emit template:created event on successful creation', async () => {
      const templateDefinition = {
        name: 'Event Test Template',
        type: 'test',
        fields: [{ id: 'field1', name: 'Field 1', type: 'text', required: true }]
      };

      const eventPromise = new Promise(resolve => {
        templateEngine.once('template:created', resolve);
      });

      await templateEngine.createTemplate(templateDefinition, 'test-user');

      const eventData = await eventPromise;
      expect(eventData.templateId).toBeDefined();
      expect(eventData.userId).toBe('test-user');
      expect(eventData.template.name).toBe('Event Test Template');
    });
  });

  describe('Template Retrieval', () => {
    let testTemplateId;

    beforeEach(async () => {
      const template = {
        name: 'Test Template',
        type: 'test',
        fields: [{ id: 'field1', name: 'Field 1', type: 'text', required: true }]
      };

      const result = await templateEngine.createTemplate(template, 'test-user');
      testTemplateId = result.template.id;
    });

    test('should retrieve template by ID successfully', async () => {
      const template = await templateEngine.getTemplate(testTemplateId);

      expect(template.id).toBe(testTemplateId);
      expect(template.name).toBe('Test Template');
      expect(template.type).toBe('test');
    });

    test('should use cache for repeated template retrieval', async () => {
      // First call - cache miss
      const template1 = await templateEngine.getTemplate(testTemplateId);
      expect(template1).toBeDefined();

      // Second call - should hit cache
      const template2 = await templateEngine.getTemplate(testTemplateId);
      expect(template2).toBeDefined();

      const metrics = templateEngine.getMetrics();
      expect(metrics.cacheHits).toBeGreaterThan(0);
    });

    test('should throw error for non-existent template', async () => {
      await expect(templateEngine.getTemplate('non-existent-id'))
        .rejects.toThrow('Template not found');
    });

    test('should throw error for invalid template ID', async () => {
      await expect(templateEngine.getTemplate(null))
        .rejects.toThrow(TemplateValidationError);

      await expect(templateEngine.getTemplate(''))
        .rejects.toThrow(TemplateValidationError);
    });
  });

  describe('Template Application', () => {
    let bugTemplateId;

    beforeEach(async () => {
      const bugTemplate = {
        name: 'Bug Report',
        type: 'bug',
        fields: [
          { id: 'title', name: 'Title', type: 'text', required: true },
          { id: 'description', name: 'Description', type: 'textarea', required: true },
          { id: 'severity', name: 'Severity', type: 'select', options: ['low', 'medium', 'high'], required: false, defaultValue: 'medium' }
        ],
        validation: [
          { field: 'title', type: 'minLength', parameters: { min: 5 }, message: 'Title must be at least 5 characters' },
          { field: 'description', type: 'minLength', parameters: { min: 20 }, message: 'Description must be at least 20 characters' }
        ]
      };

      const result = await templateEngine.createTemplate(bugTemplate, 'test-user');
      bugTemplateId = result.template.id;
    });

    test('should apply template to issue data successfully', async () => {
      const issueData = {
        title: 'Application crashes on startup',
        description: 'The application fails to start properly and shows a white screen. This happens consistently on Windows 10.',
        severity: 'high'
      };

      const result = await templateEngine.applyTemplate(bugTemplateId, issueData, {
        userId: 'test-user'
      });

      expect(result.success).toBe(true);
      expect(result.appliedTemplate.templateId).toBe(bugTemplateId);
      expect(result.appliedTemplate.fields).toHaveLength(3);
      
      const titleField = result.appliedTemplate.fields.find(f => f.fieldId === 'title');
      expect(titleField.value).toBe('Application crashes on startup');
      expect(titleField.transformedValue).toBe('Application crashes on startup');
    });

    test('should validate required fields during application', async () => {
      const incompleteIssueData = {
        title: 'Test', // Too short
        // description missing
        severity: 'low'
      };

      await expect(templateEngine.applyTemplate(bugTemplateId, incompleteIssueData))
        .rejects.toThrow(TemplateValidationError);
    });

    test('should apply field validation rules', async () => {
      const invalidIssueData = {
        title: 'Bug', // Too short (less than 5 characters)
        description: 'Short desc', // Too short (less than 20 characters)
        severity: 'medium'
      };

      await expect(templateEngine.applyTemplate(bugTemplateId, invalidIssueData))
        .rejects.toThrow(TemplateValidationError);
    });

    test('should handle default values for missing fields', async () => {
      const issueData = {
        title: 'Valid title for testing purposes',
        description: 'This is a valid description that meets the minimum length requirement for the template.'
        // severity not provided - should use default
      };

      const result = await templateEngine.applyTemplate(bugTemplateId, issueData);

      expect(result.success).toBe(true);
      
      const severityField = result.appliedTemplate.fields.find(f => f.fieldId === 'severity');
      expect(severityField.transformedValue).toBe('medium'); // Default value
    });

    test('should handle select field validation', async () => {
      const issueData = {
        title: 'Valid title for testing',
        description: 'Valid description that meets requirements',
        severity: 'invalid-option'
      };

      const result = await templateEngine.applyTemplate(bugTemplateId, issueData);
      
      const severityField = result.appliedTemplate.fields.find(f => f.fieldId === 'severity');
      expect(severityField.transformedValue).toBe('medium'); // Falls back to default
    });

    test('should emit template:applied event on successful application', async () => {
      const issueData = {
        title: 'Event test issue',
        description: 'This is a test issue for event emission testing purposes'
      };

      const eventPromise = new Promise(resolve => {
        templateEngine.once('template:applied', resolve);
      });

      await templateEngine.applyTemplate(bugTemplateId, issueData);

      const eventData = await eventPromise;
      expect(eventData.templateId).toBe(bugTemplateId);
      expect(eventData.issueData).toBe('Event test issue');
    });
  });

  describe('Batch Template Operations', () => {
    let templateId;

    beforeEach(async () => {
      const template = {
        name: 'Batch Test Template',
        type: 'test',
        fields: [
          { id: 'title', name: 'Title', type: 'text', required: true },
          { id: 'category', name: 'Category', type: 'select', options: ['bug', 'feature'], required: true }
        ]
      };

      const result = await templateEngine.createTemplate(template, 'test-user');
      templateId = result.template.id;
    });

    test('should process batch template applications successfully', async () => {
      const operations = [
        {
          templateId,
          issueData: { title: 'Issue 1', category: 'bug' },
          options: { userId: 'user1' }
        },
        {
          templateId,
          issueData: { title: 'Issue 2', category: 'feature' },
          options: { userId: 'user2' }
        },
        {
          templateId,
          issueData: { title: 'Issue 3', category: 'bug' },
          options: { userId: 'user3' }
        }
      ];

      const result = await templateEngine.batchApplyTemplates(operations, {
        concurrency: 2,
        continueOnError: true
      });

      expect(result.success).toBe(true);
      expect(result.results.successful).toHaveLength(3);
      expect(result.results.failed).toHaveLength(0);
      expect(result.summary.total).toBe(3);
      expect(result.summary.successful).toBe(3);
    });

    test('should handle partial failures in batch operations', async () => {
      const operations = [
        {
          templateId,
          issueData: { title: 'Valid Issue', category: 'bug' },
          options: { userId: 'user1' }
        },
        {
          templateId,
          issueData: { category: 'feature' }, // Missing required title
          options: { userId: 'user2' }
        },
        {
          templateId,
          issueData: { title: 'Another Valid Issue', category: 'bug' },
          options: { userId: 'user3' }
        }
      ];

      const result = await templateEngine.batchApplyTemplates(operations, {
        continueOnError: true
      });

      expect(result.success).toBe(false);
      expect(result.results.successful).toHaveLength(2);
      expect(result.results.failed).toHaveLength(1);
      expect(result.summary.successful).toBe(2);
      expect(result.summary.failed).toBe(1);
    });

    test('should respect concurrency limits in batch processing', async () => {
      const operations = Array.from({ length: 10 }, (_, i) => ({
        templateId,
        issueData: { title: `Issue ${i + 1}`, category: 'bug' },
        options: { userId: `user${i + 1}` }
      }));

      const startTime = Date.now();
      
      const result = await templateEngine.batchApplyTemplates(operations, {
        concurrency: 3
      });

      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(result.results.successful).toHaveLength(10);
      
      // With concurrency of 3, processing should take less time than sequential
      expect(endTime - startTime).toBeLessThan(operations.length * 100); // Assuming each operation takes ~100ms
    });

    test('should handle timeout in batch operations', async () => {
      const operations = [
        {
          templateId,
          issueData: { title: 'Test Issue', category: 'bug' },
          options: { userId: 'user1' }
        }
      ];

      // Mock a slow template application
      jest.spyOn(templateEngine, 'applyTemplate').mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 2000))
      );

      const result = await templateEngine.batchApplyTemplates(operations, {
        timeout: 1000 // 1 second timeout
      });

      expect(result.success).toBe(false);
      expect(result.results.failed).toHaveLength(1);
      expect(result.results.failed[0].error).toContain('timeout');
    });
  });

  describe('Template Validation', () => {
    test('should validate correct template definition', async () => {
      const validTemplate = {
        name: 'Valid Template',
        type: 'test',
        fields: [
          { id: 'field1', name: 'Field 1', type: 'text', required: true },
          { id: 'field2', name: 'Field 2', type: 'textarea', required: false }
        ],
        validation: [
          { field: 'field1', type: 'minLength', parameters: { min: 1 }, message: 'Field 1 is required' }
        ]
      };

      const result = await templateEngine.validateTemplate(validTemplate);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should identify validation errors', async () => {
      const invalidTemplate = {
        // Missing name
        type: 'test',
        fields: 'invalid-fields-format' // Should be array
      };

      const result = await templateEngine.validateTemplate(invalidTemplate);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors).toContain('Template name is required');
      expect(result.errors).toContain('Template fields are required');
    });
  });

  describe('Caching and Performance', () => {
    test('should update metrics correctly', async () => {
      const template = {
        name: 'Metrics Test Template',
        type: 'test',
        fields: [{ id: 'field1', name: 'Field 1', type: 'text', required: true }]
      };

      const initialMetrics = templateEngine.getMetrics();
      
      await templateEngine.createTemplate(template, 'test-user');
      
      const updatedMetrics = templateEngine.getMetrics();

      expect(updatedMetrics.templatesCreated).toBe(initialMetrics.templatesCreated + 1);
    });

    test('should clear cache correctly', () => {
      templateEngine.clearCache();
      
      const metrics = templateEngine.getMetrics();
      expect(metrics.cacheStats.size).toBe(0);
    });

    test('should maintain cache hit ratio statistics', async () => {
      const template = {
        name: 'Cache Test Template',
        type: 'test',
        fields: [{ id: 'field1', name: 'Field 1', type: 'text', required: true }]
      };

      const result = await templateEngine.createTemplate(template, 'test-user');
      const templateId = result.template.id;

      // First access - cache miss
      await templateEngine.getTemplate(templateId);
      
      // Second access - cache hit
      await templateEngine.getTemplate(templateId);
      
      const metrics = templateEngine.getMetrics();
      expect(metrics.cacheStats.hitRatio).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle repository errors gracefully', async () => {
      // Mock repository to throw error
      templateEngine.templateRepository.save = jest.fn().mockRejectedValue(new Error('Storage error'));

      const template = {
        name: 'Error Test Template',
        type: 'test',
        fields: []
      };

      await expect(templateEngine.createTemplate(template, 'test-user'))
        .rejects.toThrow('Template creation failed');
    });

    test('should emit error events on failures', async () => {
      const invalidTemplate = {
        name: 'Error Test',
        type: 'test',
        fields: null // Invalid
      };

      const errorPromise = new Promise(resolve => {
        templateEngine.once('template:error', resolve);
      });

      try {
        await templateEngine.createTemplate(invalidTemplate, 'test-user');
      } catch (error) {
        // Expected to throw
      }

      const errorEvent = await errorPromise;
      expect(errorEvent.operation).toBe('create');
      expect(errorEvent.error).toBeDefined();
    });
  });

  describe('Plugin Integration', () => {
    test('should register plugins successfully', async () => {
      const mockPlugin = {
        name: 'test-plugin',
        version: '1.0.0',
        processTemplate: jest.fn(template => template)
      };

      const result = await templateEngine.registerPlugin(mockPlugin);

      expect(result.success).toBe(true);
    });

    test('should reject invalid plugins', async () => {
      const invalidPlugin = {
        // Missing required fields
      };

      await expect(templateEngine.registerPlugin(invalidPlugin))
        .rejects.toThrow(TemplateValidationError);
    });
  });

  describe('Standard Templates', () => {
    test('should have standard bug template available', () => {
      expect(templateEngine.standardTemplates.bug).toBeDefined();
      expect(templateEngine.standardTemplates.bug.type).toBe('bug');
      expect(templateEngine.standardTemplates.bug.fields.length).toBeGreaterThan(0);
    });

    test('should have standard feature template available', () => {
      expect(templateEngine.standardTemplates.feature).toBeDefined();
      expect(templateEngine.standardTemplates.feature.type).toBe('feature');
      expect(templateEngine.standardTemplates.feature.fields.length).toBeGreaterThan(0);
    });

    test('should have standard epic template available', () => {
      expect(templateEngine.standardTemplates.epic).toBeDefined();
      expect(templateEngine.standardTemplates.epic.type).toBe('epic');
      expect(templateEngine.standardTemplates.epic.fields.length).toBeGreaterThan(0);
    });
  });
});