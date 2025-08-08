/**
 * YOLO-PRO Issue Templates & Workflow Integration Test Suite
 * End-to-end integration tests for the complete system
 * Implements SPARC Phase 5: Completion integration testing
 */

const { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach, jest } = require('@jest/globals');
const { TemplateEngine } = require('../../src/templates/TemplateEngine');
const { WorkflowEngine } = require('../../src/workflows/WorkflowEngine');
const { ClassificationEngine } = require('../../src/classification/ClassificationEngine');
const IssueTemplateCommands = require('../../src/cli/IssueTemplateCommands');

describe('Issue Templates & Workflow Integration', () => {
  let templateEngine;
  let workflowEngine;
  let classificationEngine;
  let cliCommands;
  let mockGitHubClient;
  let mockLabelManager;

  beforeAll(async () => {
    // Setup mock GitHub client
    mockGitHubClient = {
      request: jest.fn(),
      options: {
        owner: 'test-owner',
        repo: 'test-repo'
      }
    };

    // Setup mock label manager
    mockLabelManager = {
      addLabelsToIssue: jest.fn().mockResolvedValue({
        success: true,
        added: [],
        created: [],
        errors: []
      })
    };

    // Initialize engines
    templateEngine = new TemplateEngine({
      storage: { type: 'memory' },
      cacheSize: 50
    });

    workflowEngine = new WorkflowEngine({
      stateStore: { type: 'memory' },
      maxConcurrentWorkflows: 20
    });

    classificationEngine = new ClassificationEngine({
      confidenceThreshold: 0.6,
      modelConfig: { type: 'mock' }
    });

    // Initialize CLI commands
    cliCommands = new IssueTemplateCommands({
      gitHubClient: mockGitHubClient,
      labelManager: mockLabelManager,
      storage: { type: 'memory' }
    });
  });

  afterAll(async () => {
    // Cleanup
    if (templateEngine) {
      templateEngine.clearCache();
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('End-to-End Template Workflow', () => {
    test('should create template, apply it, and create GitHub issue', async () => {
      // Step 1: Create template via CLI
      const templateCreation = await cliCommands.createTemplate({
        name: 'Integration Test Bug Template',
        type: 'bug',
        description: 'Template for integration testing'
      });

      expect(templateCreation.success).toBe(true);
      expect(templateCreation.templateId).toBeDefined();

      // Step 2: Apply template with issue data
      const issueData = {
        title: 'Critical bug in user authentication',
        description: 'Users cannot log in to the application after the latest update',
        steps: '1. Navigate to login page\n2. Enter credentials\n3. Click submit',
        expected: 'User should be logged in successfully',
        actual: 'Error message appears: "Invalid credentials"'
      };

      // Mock GitHub API response
      mockGitHubClient.request.mockResolvedValueOnce({
        data: {
          number: 123,
          html_url: 'https://github.com/test-owner/test-repo/issues/123',
          title: issueData.title
        }
      });

      const templateApplication = await cliCommands.applyTemplate({
        template: templateCreation.templateId,
        data: JSON.stringify(issueData),
        repo: 'test-owner/test-repo'
      });

      expect(templateApplication.success).toBe(true);
      expect(templateApplication.githubIssue).toBeDefined();
      expect(templateApplication.githubIssue.number).toBe(123);

      // Verify GitHub API was called correctly
      expect(mockGitHubClient.request).toHaveBeenCalledWith(
        'POST',
        '/repos/test-owner/test-repo/issues',
        expect.objectContaining({
          title: issueData.title,
          body: expect.stringContaining(issueData.description)
        })
      );
    });

    test('should classify issue and start workflow automatically', async () => {
      // Step 1: Mock GitHub issue fetch
      mockGitHubClient.request.mockResolvedValueOnce({
        data: {
          number: 456,
          title: 'Performance issue with database queries',
          body: 'The application is running slowly due to inefficient database queries. Response times are over 5 seconds.',
          html_url: 'https://github.com/test-owner/test-repo/issues/456'
        }
      });

      // Step 2: Classify the issue
      const classification = await cliCommands.classifyIssue({
        issue: '456',
        repo: 'test-owner/test-repo',
        'apply-labels': true
      });

      expect(classification.success).toBe(true);
      expect(classification.classification.predictions.length).toBeGreaterThan(0);

      // Verify label manager was called
      expect(mockLabelManager.addLabelsToIssue).toHaveBeenCalledWith(
        456,
        expect.arrayContaining(['bug']),
        expect.objectContaining({ createMissing: true })
      );

      // Step 3: Start workflow for the classified issue
      const workflowStart = await cliCommands.startWorkflow({
        issue: '456',
        workflow: 'yolo-pro-issue-lifecycle'
      });

      expect(workflowStart.success).toBe(true);
      expect(workflowStart.workflow.executionId).toBeDefined();
      expect(workflowStart.workflow.issueId).toBe(456);
    });

    test('should handle batch operations across all components', async () => {
      // Step 1: Create multiple templates
      const templatePromises = ['bug', 'feature', 'enhancement'].map(type => 
        cliCommands.createTemplate({
          name: `Batch Test ${type} Template`,
          type: type
        })
      );

      const templates = await Promise.all(templatePromises);
      templates.forEach(template => {
        expect(template.success).toBe(true);
      });

      // Step 2: Mock multiple GitHub issues
      const issueNumbers = [201, 202, 203, 204, 205];
      const mockIssues = issueNumbers.map(num => ({
        data: {
          number: num,
          title: `Test issue ${num}`,
          body: `Description for test issue ${num}`,
          html_url: `https://github.com/test-owner/test-repo/issues/${num}`
        }
      }));

      mockGitHubClient.request
        .mockResolvedValueOnce(mockIssues[0])
        .mockResolvedValueOnce(mockIssues[1])
        .mockResolvedValueOnce(mockIssues[2])
        .mockResolvedValueOnce(mockIssues[3])
        .mockResolvedValueOnce(mockIssues[4]);

      // Step 3: Batch classify issues
      const batchClassification = await cliCommands.batchClassifyIssues({
        issues: issueNumbers.join(','),
        repo: 'test-owner/test-repo',
        concurrency: '3',
        'apply-labels': true
      });

      expect(batchClassification.success).toBe(true);
      expect(batchClassification.batchClassification.successful).toBe(5);
      expect(batchClassification.batchClassification.failed).toBe(0);

      // Step 4: Start workflows for all classified issues
      const workflowPromises = issueNumbers.map(issueNum => 
        cliCommands.startWorkflow({
          issue: issueNum.toString(),
          workflow: 'yolo-pro-issue-lifecycle'
        })
      );

      const workflowResults = await Promise.all(workflowPromises);
      workflowResults.forEach(result => {
        expect(result.success).toBe(true);
      });
    });
  });

  describe('System Integration Points', () => {
    test('should integrate template engine with classification suggestions', async () => {
      // Create a template
      const template = await templateEngine.createTemplate({
        name: 'Smart Template',
        type: 'bug',
        fields: [
          { id: 'title', name: 'Title', type: 'text', required: true },
          { id: 'priority', name: 'Priority', type: 'select', options: ['low', 'medium', 'high'], required: false }
        ]
      }, 'integration-test');

      expect(template.success).toBe(true);

      // Mock issue content for classification
      const issueContent = {
        title: 'Critical security vulnerability in authentication',
        description: 'Security issue that needs immediate attention'
      };

      // Classify to get suggestions
      const classification = await classificationEngine.classifyIssue(issueContent, {});
      expect(classification.predictions.length).toBeGreaterThan(0);

      // Apply template with classification-suggested priority
      const suggestedPriority = classification.predictions.find(p => 
        ['low', 'medium', 'high', 'critical'].includes(p.label)
      );

      const templateData = {
        ...issueContent,
        priority: suggestedPriority ? 
          (suggestedPriority.label === 'critical' ? 'high' : suggestedPriority.label) : 
          'medium'
      };

      const applied = await templateEngine.applyTemplate(
        template.template.id,
        templateData
      );

      expect(applied.success).toBe(true);
      expect(applied.appliedTemplate.fields.find(f => f.fieldId === 'priority').transformedValue)
        .toBe(templateData.priority);
    });

    test('should integrate workflow state changes with template updates', async () => {
      const issueId = 789;
      
      // Initialize workflow
      await workflowEngine.stateManager.initializeState(issueId, {
        stateId: 'open',
        workflowId: 'yolo-pro-issue-lifecycle'
      });

      // Create template for state-specific information
      const stateTemplate = await templateEngine.createTemplate({
        name: 'State Update Template',
        type: 'update',
        fields: [
          { id: 'state_change', name: 'State Change', type: 'text', required: true },
          { id: 'reason', name: 'Reason', type: 'textarea', required: true }
        ]
      }, 'integration-test');

      expect(stateTemplate.success).toBe(true);

      // Update workflow state
      const stateUpdate = await workflowEngine.updateWorkflowState(
        issueId, 
        'in_progress',
        { 
          userId: 'integration-test',
          metadata: { reason: 'Developer assigned to issue' }
        }
      );

      expect(stateUpdate.success).toBe(true);

      // Apply template to document the state change
      const templateApplication = await templateEngine.applyTemplate(
        stateTemplate.template.id,
        {
          state_change: `${stateUpdate.previousState.id} → ${stateUpdate.newState.id}`,
          reason: 'Developer assigned to issue'
        }
      );

      expect(templateApplication.success).toBe(true);
      expect(templateApplication.appliedTemplate.fields).toHaveLength(2);
    });

    test('should integrate all three engines with CLI commands', async () => {
      // Test complete integration through CLI
      
      // Step 1: Create template
      const templateResult = await cliCommands.execute({
        subcommand: 'create-template',
        options: {
          name: 'Full Integration Template',
          type: 'bug'
        }
      });

      expect(templateResult.success).toBe(true);

      // Step 2: Mock issue for classification
      mockGitHubClient.request.mockResolvedValueOnce({
        data: {
          number: 999,
          title: 'Integration test issue',
          body: 'Full system integration test'
        }
      });

      // Step 3: Classify issue
      const classifyResult = await cliCommands.execute({
        subcommand: 'classify-issue',
        options: {
          issue: '999',
          repo: 'test-owner/test-repo'
        }
      });

      expect(classifyResult.success).toBe(true);

      // Step 4: Start workflow
      const workflowResult = await cliCommands.execute({
        subcommand: 'start-workflow',
        options: {
          issue: '999',
          workflow: 'yolo-pro-issue-lifecycle'
        }
      });

      expect(workflowResult.success).toBe(true);

      // Step 5: Get metrics
      const metricsResult = await cliCommands.execute({
        subcommand: 'workflow-metrics',
        options: {
          format: 'json'
        }
      });

      expect(metricsResult.success).toBe(true);
      expect(metricsResult.metrics).toHaveProperty('templates');
      expect(metricsResult.metrics).toHaveProperty('workflows');
      expect(metricsResult.metrics).toHaveProperty('classification');
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle high-volume template operations efficiently', async () => {
      const startTime = Date.now();
      
      // Create 50 templates concurrently
      const templatePromises = Array.from({ length: 50 }, (_, i) => 
        templateEngine.createTemplate({
          name: `Performance Test Template ${i}`,
          type: 'test',
          fields: [
            { id: 'field1', name: 'Field 1', type: 'text', required: true }
          ]
        }, 'perf-test')
      );

      const results = await Promise.all(templatePromises);
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // All should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Should complete within reasonable time (10 seconds for 50 templates)
      expect(totalTime).toBeLessThan(10000);

      // Average processing time should be reasonable
      const avgTime = totalTime / results.length;
      expect(avgTime).toBeLessThan(200); // Less than 200ms per template
    });

    test('should handle concurrent workflow executions', async () => {
      const startTime = Date.now();
      
      // Start 20 workflows concurrently
      const workflowPromises = Array.from({ length: 20 }, (_, i) => 
        workflowEngine.executeWorkflow('yolo-pro-issue-lifecycle', 5000 + i)
      );

      const results = await Promise.all(workflowPromises);
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // All should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Should complete within reasonable time
      expect(totalTime).toBeLessThan(15000); // 15 seconds for 20 workflows

      // Check metrics
      const metrics = workflowEngine.getMetrics();
      expect(metrics.workflowsExecuted).toBeGreaterThanOrEqual(20);
    });

    test('should maintain cache efficiency under load', async () => {
      // Create a template to cache
      const template = await templateEngine.createTemplate({
        name: 'Cache Test Template',
        type: 'cache-test',
        fields: [{ id: 'test', name: 'Test', type: 'text', required: true }]
      }, 'cache-test');

      const templateId = template.template.id;

      // Access template multiple times to populate cache
      await templateEngine.getTemplate(templateId);
      await templateEngine.getTemplate(templateId);
      await templateEngine.getTemplate(templateId);

      // Apply template multiple times
      const applyPromises = Array.from({ length: 100 }, () => 
        templateEngine.applyTemplate(templateId, { test: 'cache test' })
      );

      await Promise.all(applyPromises);

      // Check cache metrics
      const metrics = templateEngine.getMetrics();
      expect(metrics.cacheStats.hitRatio).toBeGreaterThan(0.8); // 80% hit ratio
    });

    test('should handle batch classification efficiently', async () => {
      // Create 100 mock issues
      const issues = Array.from({ length: 100 }, (_, i) => ({
        content: {
          title: `Performance test issue ${i}`,
          body: `Description for performance test issue ${i}`
        },
        metadata: { issueId: 6000 + i }
      }));

      const startTime = Date.now();
      
      const result = await classificationEngine.batchClassifyIssues(issues, {
        concurrency: 10
      });
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      expect(result.success).toBe(true);
      expect(result.results.successful).toHaveLength(100);

      // Should complete within reasonable time (30 seconds for 100 issues)
      expect(totalTime).toBeLessThan(30000);

      // Average processing time per issue
      const avgTime = totalTime / issues.length;
      expect(avgTime).toBeLessThan(300); // Less than 300ms per issue
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle GitHub API failures gracefully', async () => {
      // Mock GitHub API failure
      mockGitHubClient.request.mockRejectedValueOnce(new Error('API rate limit exceeded'));

      const result = await cliCommands.classifyIssue({
        issue: '888',
        repo: 'test-owner/test-repo'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to fetch issue #888');
    });

    test('should handle template validation failures', async () => {
      const invalidTemplate = {
        // Missing required fields
        type: 'invalid'
      };

      const result = await templateEngine.createTemplate(invalidTemplate, 'error-test');
      
      expect(result).rejects.toThrow();
    });

    test('should handle workflow state inconsistencies', async () => {
      const issueId = 9999;

      // Try to update state without initializing
      await expect(workflowEngine.updateWorkflowState(issueId, 'in_progress'))
        .rejects.toThrow('No current state found for issue');
    });

    test('should handle classification model failures', async () => {
      // Mock model failure
      classificationEngine.modelManager.getActiveModel = jest.fn()
        .mockRejectedValue(new Error('Model loading failed'));

      await expect(classificationEngine.classifyIssue(
        { title: 'Test', body: 'Test' },
        {}
      )).rejects.toThrow('Classification failed: Model loading failed');
    });
  });

  describe('Memory and Resource Management', () => {
    test('should manage memory efficiently with large datasets', async () => {
      const initialMemory = process.memoryUsage();

      // Process large number of operations
      for (let batch = 0; batch < 10; batch++) {
        const templates = Array.from({ length: 50 }, (_, i) => ({
          name: `Memory Test Template ${batch}-${i}`,
          type: 'memory-test',
          fields: [{ id: 'test', name: 'Test', type: 'text', required: true }]
        }));

        const results = await Promise.all(
          templates.map(template => 
            templateEngine.createTemplate(template, 'memory-test')
          )
        );

        // All should succeed
        results.forEach(result => {
          expect(result.success).toBe(true);
        });

        // Clear caches periodically to manage memory
        if (batch % 3 === 0) {
          templateEngine.clearCache();
        }
      }

      const finalMemory = process.memoryUsage();
      
      // Memory increase should be reasonable (less than 100MB)
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // 100MB
    });

    test('should clean up resources properly', async () => {
      const template = await templateEngine.createTemplate({
        name: 'Cleanup Test Template',
        type: 'cleanup',
        fields: []
      }, 'cleanup-test');

      const templateId = template.template.id;

      // Use the template
      await templateEngine.getTemplate(templateId);
      await templateEngine.applyTemplate(templateId, {});

      // Clear cache and check cleanup
      templateEngine.clearCache();
      
      const metrics = templateEngine.getMetrics();
      expect(metrics.cacheStats.size).toBe(0);
    });
  });

  describe('System Monitoring and Observability', () => {
    test('should provide comprehensive system metrics', async () => {
      // Perform various operations
      const template = await templateEngine.createTemplate({
        name: 'Metrics Template',
        type: 'metrics',
        fields: []
      }, 'metrics-test');

      await templateEngine.applyTemplate(template.template.id, {});
      await workflowEngine.executeWorkflow('yolo-pro-issue-lifecycle', 8888);
      await classificationEngine.classifyIssue(
        { title: 'Metrics test', body: 'Test' },
        {}
      );

      // Get combined metrics
      const metrics = await cliCommands.getWorkflowMetrics({ format: 'json' });

      expect(metrics.success).toBe(true);
      expect(metrics.metrics).toHaveProperty('templates');
      expect(metrics.metrics).toHaveProperty('workflows');
      expect(metrics.metrics).toHaveProperty('classification');

      // Verify metric values are reasonable
      expect(metrics.metrics.templates.created).toBeGreaterThan(0);
      expect(metrics.metrics.templates.applied).toBeGreaterThan(0);
      expect(metrics.metrics.workflows.executed).toBeGreaterThan(0);
      expect(metrics.metrics.classification.performed).toBeGreaterThan(0);
    });

    test('should track performance trends', async () => {
      const performanceData = [];

      // Collect performance data over multiple operations
      for (let i = 0; i < 10; i++) {
        const startTime = Date.now();
        
        await templateEngine.createTemplate({
          name: `Performance Template ${i}`,
          type: 'performance',
          fields: []
        }, 'perf-test');

        const endTime = Date.now();
        performanceData.push(endTime - startTime);
      }

      // Calculate performance metrics
      const avgTime = performanceData.reduce((sum, time) => sum + time, 0) / performanceData.length;
      const maxTime = Math.max(...performanceData);
      const minTime = Math.min(...performanceData);

      // Performance should be consistent
      expect(maxTime - minTime).toBeLessThan(1000); // Variation less than 1 second
      expect(avgTime).toBeLessThan(200); // Average less than 200ms
    });
  });
});