/**
 * YOLO-PRO Workflow Engine Test Suite
 * Comprehensive TDD tests for workflow automation system
 * Implements SPARC Phase 4: Refinement testing methodology
 */

const { describe, test, expect, beforeEach, afterEach, jest } = require('@jest/globals');
const { WorkflowEngine, WorkflowError, WorkflowValidationError } = require('../../src/workflows/WorkflowEngine');

describe('WorkflowEngine', () => {
  let workflowEngine;
  let mockConfig;

  beforeEach(() => {
    mockConfig = {
      maxConcurrentWorkflows: 50,
      executionTimeout: 30000,
      retryAttempts: 3,
      stateTransitionTimeout: 5000,
      queueMaxSize: 1000,
      stateStore: { type: 'memory' },
      eventConfig: {},
      ruleDefinitions: {},
      transitionConfig: {},
      queueConfig: {},
      actionConfig: {}
    };

    workflowEngine = new WorkflowEngine(mockConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Event Processing', () => {
    test('should process valid workflow event successfully', async () => {
      const workflowEvent = {
        workflowId: 'yolo-pro-issue-lifecycle',
        issueId: 123,
        type: 'issue_assigned',
        data: {
          assignee: 'test-user',
          timestamp: Date.now()
        }
      };

      const result = await workflowEngine.processEvent(workflowEvent);

      expect(result.success).toBe(true);
      expect(result.executionContext.eventId).toBeDefined();
      expect(result.results.processed).toBe(true);
      expect(result.results.ruleResults).toBeDefined();
    });

    test('should validate event structure before processing', async () => {
      const invalidEvent = {
        // Missing required fields
        type: 'test_event'
      };

      await expect(workflowEngine.processEvent(invalidEvent))
        .rejects.toThrow(WorkflowValidationError);
    });

    test('should handle non-existent workflow gracefully', async () => {
      const event = {
        workflowId: 'non-existent-workflow',
        issueId: 123,
        type: 'test_event'
      };

      await expect(workflowEngine.processEvent(event))
        .rejects.toThrow('Workflow not found');
    });

    test('should emit event:processed on successful processing', async () => {
      const workflowEvent = {
        workflowId: 'yolo-pro-issue-lifecycle',
        issueId: 456,
        type: 'issue_assigned'
      };

      const eventPromise = new Promise(resolve => {
        workflowEngine.once('event:processed', resolve);
      });

      await workflowEngine.processEvent(workflowEvent);

      const emittedEvent = await eventPromise;
      expect(emittedEvent.eventId).toBeDefined();
      expect(emittedEvent.workflowId).toBe('yolo-pro-issue-lifecycle');
      expect(emittedEvent.issueId).toBe(456);
    });

    test('should handle multiple concurrent events', async () => {
      const events = Array.from({ length: 5 }, (_, i) => ({
        workflowId: 'yolo-pro-issue-lifecycle',
        issueId: 100 + i,
        type: 'issue_assigned'
      }));

      const promises = events.map(event => workflowEngine.processEvent(event));
      const results = await Promise.all(promises);

      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Workflow Execution', () => {
    test('should execute workflow successfully', async () => {
      const workflowId = 'yolo-pro-issue-lifecycle';
      const issueId = 789;

      const result = await workflowEngine.executeWorkflow(workflowId, issueId, {
        userId: 'test-user'
      });

      expect(result.success).toBe(true);
      expect(result.executionId).toBeDefined();
      expect(result.workflowId).toBe(workflowId);
      expect(result.issueId).toBe(issueId);
      expect(result.executionTime).toBeGreaterThan(0);
    });

    test('should prevent concurrent workflow execution for same issue', async () => {
      const workflowId = 'yolo-pro-issue-lifecycle';
      const issueId = 999;

      // Start first execution
      const firstExecution = workflowEngine.executeWorkflow(workflowId, issueId);

      // Try to start second execution immediately
      await expect(workflowEngine.executeWorkflow(workflowId, issueId))
        .rejects.toThrow('Workflow is already executing');

      // Wait for first execution to complete
      await firstExecution;
    });

    test('should validate workflow and issue IDs', async () => {
      await expect(workflowEngine.executeWorkflow(null, 123))
        .rejects.toThrow(WorkflowValidationError);

      await expect(workflowEngine.executeWorkflow('test-workflow', null))
        .rejects.toThrow(WorkflowValidationError);
    });

    test('should emit workflow:completed on successful execution', async () => {
      const workflowId = 'yolo-pro-issue-lifecycle';
      const issueId = 555;

      const eventPromise = new Promise(resolve => {
        workflowEngine.once('workflow:completed', resolve);
      });

      await workflowEngine.executeWorkflow(workflowId, issueId);

      const emittedEvent = await eventPromise;
      expect(emittedEvent.executionId).toBeDefined();
      expect(emittedEvent.workflowId).toBe(workflowId);
      expect(emittedEvent.issueId).toBe(issueId);
    });

    test('should handle workflow execution errors gracefully', async () => {
      // Mock state manager to throw error
      workflowEngine.stateManager.getCurrentState = jest.fn()
        .mockRejectedValue(new Error('State retrieval failed'));

      await expect(workflowEngine.executeWorkflow('yolo-pro-issue-lifecycle', 123))
        .rejects.toThrow('Workflow execution failed');
    });
  });

  describe('State Management', () => {
    let testIssueId;

    beforeEach(async () => {
      testIssueId = Math.floor(Math.random() * 10000);
      
      // Initialize workflow state
      await workflowEngine.stateManager.initializeState(testIssueId, {
        stateId: 'open',
        workflowId: 'yolo-pro-issue-lifecycle',
        initializedAt: Date.now()
      });
    });

    test('should update workflow state successfully', async () => {
      const result = await workflowEngine.updateWorkflowState(testIssueId, 'in_progress', {
        userId: 'test-user',
        metadata: { reason: 'Issue assigned' }
      });

      expect(result.success).toBe(true);
      expect(result.newState.id).toBe('in_progress');
      expect(result.previousState.id).toBe('open');
    });

    test('should validate state transitions', async () => {
      // Try invalid transition (open -> closed, skipping intermediate states)
      await expect(workflowEngine.updateWorkflowState(testIssueId, 'closed'))
        .rejects.toThrow('Invalid state transition');
    });

    test('should require valid issue ID and state ID', async () => {
      await expect(workflowEngine.updateWorkflowState(null, 'in_progress'))
        .rejects.toThrow(WorkflowValidationError);

      await expect(workflowEngine.updateWorkflowState(testIssueId, null))
        .rejects.toThrow(WorkflowValidationError);
    });

    test('should emit state:updated event on successful update', async () => {
      const eventPromise = new Promise(resolve => {
        workflowEngine.once('state:updated', resolve);
      });

      await workflowEngine.updateWorkflowState(testIssueId, 'in_progress');

      const emittedEvent = await eventPromise;
      expect(emittedEvent.issueId).toBe(testIssueId);
      expect(emittedEvent.newState.id).toBe('in_progress');
      expect(emittedEvent.previousState.id).toBe('open');
    });

    test('should handle state update failures gracefully', async () => {
      // Mock transition handler to fail
      workflowEngine.transitionHandler.executeTransition = jest.fn()
        .mockResolvedValue({ success: false, error: 'Transition failed' });

      await expect(workflowEngine.updateWorkflowState(testIssueId, 'in_progress'))
        .rejects.toThrow('State transition failed');
    });
  });

  describe('Workflow Validation', () => {
    test('should validate correct workflow definition', async () => {
      const validWorkflow = {
        id: 'test-workflow',
        name: 'Test Workflow',
        states: [
          { id: 'start', name: 'Start', type: 'initial' },
          { id: 'middle', name: 'Middle', type: 'active' },
          { id: 'end', name: 'End', type: 'final' }
        ],
        transitions: [
          { id: 't1', from: 'start', to: 'middle', trigger: 'progress' },
          { id: 't2', from: 'middle', to: 'end', trigger: 'complete' }
        ],
        rules: [
          { id: 'r1', condition: { type: 'test' }, actions: [{ type: 'log' }] }
        ]
      };

      const result = await workflowEngine.validateWorkflow(validWorkflow);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should identify structural validation errors', async () => {
      const invalidWorkflow = {
        // Missing id
        name: 'Invalid Workflow',
        states: 'invalid-format', // Should be array
        transitions: []
      };

      const result = await workflowEngine.validateWorkflow(invalidWorkflow);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors).toContain('Workflow ID is required');
      expect(result.errors).toContain('Workflow states are required');
    });

    test('should validate state references in transitions', async () => {
      const workflowWithInvalidTransitions = {
        id: 'test-workflow',
        name: 'Test Workflow',
        states: [
          { id: 'state1', name: 'State 1' },
          { id: 'state2', name: 'State 2' }
        ],
        transitions: [
          { id: 't1', from: 'state1', to: 'nonexistent', trigger: 'test' }, // Invalid 'to' state
          { id: 't2', from: 'invalid', to: 'state2', trigger: 'test' } // Invalid 'from' state
        ]
      };

      const result = await workflowEngine.validateWorkflow(workflowWithInvalidTransitions);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid transition \'to\' state: nonexistent');
      expect(result.errors).toContain('Invalid transition \'from\' state: invalid');
    });

    test('should detect duplicate state IDs', async () => {
      const workflowWithDuplicates = {
        id: 'test-workflow',
        name: 'Test Workflow',
        states: [
          { id: 'state1', name: 'State 1' },
          { id: 'state1', name: 'Duplicate State' } // Duplicate ID
        ],
        transitions: []
      };

      const result = await workflowEngine.validateWorkflow(workflowWithDuplicates);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Duplicate state ID: state1');
    });

    test('should validate rule definitions', async () => {
      const workflowWithInvalidRules = {
        id: 'test-workflow',
        name: 'Test Workflow',
        states: [{ id: 'state1', name: 'State 1' }],
        transitions: [],
        rules: [
          { id: 'r1', actions: [] }, // Missing condition
          { condition: { type: 'test' }, actions: [] } // Missing ID
        ]
      };

      const result = await workflowEngine.validateWorkflow(workflowWithInvalidRules);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Rule condition is required for rule: r1');
      expect(result.errors).toContain('Rule ID is required');
    });
  });

  describe('Batch Operations', () => {
    test('should execute batch workflow operations successfully', async () => {
      const operations = [
        { workflowId: 'yolo-pro-issue-lifecycle', issueId: 1001, type: 'execute' },
        { workflowId: 'yolo-pro-issue-lifecycle', issueId: 1002, type: 'execute' },
        { workflowId: 'yolo-pro-issue-lifecycle', issueId: 1003, type: 'execute' }
      ];

      const result = await workflowEngine.batchExecuteWorkflows(operations, {
        concurrency: 2,
        continueOnError: true
      });

      expect(result.success).toBe(true);
      expect(result.results.successful).toHaveLength(3);
      expect(result.results.failed).toHaveLength(0);
      expect(result.summary.total).toBe(3);
    });

    test('should handle partial failures in batch operations', async () => {
      const operations = [
        { workflowId: 'yolo-pro-issue-lifecycle', issueId: 2001, type: 'execute' },
        { workflowId: 'non-existent-workflow', issueId: 2002, type: 'execute' }, // Should fail
        { workflowId: 'yolo-pro-issue-lifecycle', issueId: 2003, type: 'execute' }
      ];

      const result = await workflowEngine.batchExecuteWorkflows(operations, {
        continueOnError: true
      });

      expect(result.success).toBe(false);
      expect(result.results.successful).toHaveLength(2);
      expect(result.results.failed).toHaveLength(1);
    });

    test('should respect concurrency limits', async () => {
      const operations = Array.from({ length: 10 }, (_, i) => ({
        workflowId: 'yolo-pro-issue-lifecycle',
        issueId: 3000 + i,
        type: 'execute'
      }));

      const startTime = Date.now();
      
      const result = await workflowEngine.batchExecuteWorkflows(operations, {
        concurrency: 3
      });

      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(result.results.successful).toHaveLength(10);
      
      // With concurrency, should be faster than sequential
      expect(endTime - startTime).toBeLessThan(operations.length * 200);
    });

    test('should handle operation timeouts', async () => {
      const operations = [
        { workflowId: 'yolo-pro-issue-lifecycle', issueId: 4001, type: 'execute' }
      ];

      // Mock slow operation
      const originalExecute = workflowEngine._executeWorkflowOperation;
      workflowEngine._executeWorkflowOperation = jest.fn()
        .mockImplementation(() => new Promise(resolve => setTimeout(resolve, 2000)));

      const result = await workflowEngine.batchExecuteWorkflows(operations, {
        timeout: 1000
      });

      expect(result.success).toBe(false);
      expect(result.results.failed).toHaveLength(1);
      expect(result.results.failed[0].error).toContain('timeout');

      // Restore original method
      workflowEngine._executeWorkflowOperation = originalExecute;
    });
  });

  describe('Metrics and Performance', () => {
    test('should track execution metrics correctly', async () => {
      const initialMetrics = workflowEngine.getMetrics();

      await workflowEngine.executeWorkflow('yolo-pro-issue-lifecycle', 5001);

      const updatedMetrics = workflowEngine.getMetrics();

      expect(updatedMetrics.workflowsExecuted).toBe(initialMetrics.workflowsExecuted + 1);
      expect(updatedMetrics.averageExecutionTime).toBeGreaterThan(0);
    });

    test('should track state transition metrics', async () => {
      const issueId = Math.floor(Math.random() * 10000);
      
      await workflowEngine.stateManager.initializeState(issueId, {
        stateId: 'open',
        workflowId: 'yolo-pro-issue-lifecycle'
      });

      const initialMetrics = workflowEngine.getMetrics();

      await workflowEngine.updateWorkflowState(issueId, 'in_progress');

      const updatedMetrics = workflowEngine.getMetrics();

      expect(updatedMetrics.stateTransitions).toBe(initialMetrics.stateTransitions + 1);
    });

    test('should track event processing metrics', async () => {
      const initialMetrics = workflowEngine.getMetrics();

      const event = {
        workflowId: 'yolo-pro-issue-lifecycle',
        issueId: 6001,
        type: 'test_event'
      };

      await workflowEngine.processEvent(event);

      const updatedMetrics = workflowEngine.getMetrics();

      expect(updatedMetrics.eventProcessed).toBe(initialMetrics.eventProcessed + 1);
    });

    test('should provide comprehensive metrics', () => {
      const metrics = workflowEngine.getMetrics();

      expect(metrics).toHaveProperty('workflowsExecuted');
      expect(metrics).toHaveProperty('stateTransitions');
      expect(metrics).toHaveProperty('eventProcessed');
      expect(metrics).toHaveProperty('executionErrors');
      expect(metrics).toHaveProperty('averageExecutionTime');
      expect(metrics).toHaveProperty('activeWorkflows');
      expect(metrics).toHaveProperty('registeredWorkflows');
    });
  });

  describe('Error Handling', () => {
    test('should emit error events on failures', async () => {
      const invalidEvent = {
        workflowId: 'non-existent',
        issueId: 7001,
        type: 'test'
      };

      const errorPromise = new Promise(resolve => {
        workflowEngine.once('event:error', resolve);
      });

      try {
        await workflowEngine.processEvent(invalidEvent);
      } catch (error) {
        // Expected to throw
      }

      const errorEvent = await errorPromise;
      expect(errorEvent.event).toEqual(invalidEvent);
      expect(errorEvent.error).toBeDefined();
    });

    test('should handle state manager errors gracefully', async () => {
      const issueId = 8001;

      // Mock state manager to throw error
      workflowEngine.stateManager.getCurrentState = jest.fn()
        .mockRejectedValue(new Error('Database connection failed'));

      const event = {
        workflowId: 'yolo-pro-issue-lifecycle',
        issueId: issueId,
        type: 'test_event'
      };

      await expect(workflowEngine.processEvent(event))
        .rejects.toThrow('Event processing failed');
    });

    test('should track error metrics', async () => {
      const initialMetrics = workflowEngine.getMetrics();

      try {
        await workflowEngine.executeWorkflow('non-existent-workflow', 9001);
      } catch (error) {
        // Expected to fail
      }

      const updatedMetrics = workflowEngine.getMetrics();
      expect(updatedMetrics.executionErrors).toBe(initialMetrics.executionErrors + 1);
    });
  });

  describe('Standard Workflows', () => {
    test('should have issue lifecycle workflow available', () => {
      expect(workflowEngine.standardWorkflows['yolo-pro-issue-lifecycle']).toBeDefined();
      
      const workflow = workflowEngine.standardWorkflows['yolo-pro-issue-lifecycle'];
      expect(workflow.states).toHaveLength(5); // open, in_progress, review, testing, closed
      expect(workflow.transitions.length).toBeGreaterThan(0);
      expect(workflow.rules.length).toBeGreaterThan(0);
    });

    test('should register standard workflows on initialization', () => {
      const metrics = workflowEngine.getMetrics();
      expect(metrics.registeredWorkflows).toBeGreaterThan(0);
    });
  });

  describe('Workflow Definition Management', () => {
    test('should retrieve workflow by ID', async () => {
      const workflow = await workflowEngine._getWorkflow('yolo-pro-issue-lifecycle');
      
      expect(workflow).toBeDefined();
      expect(workflow.id).toBe('yolo-pro-issue-lifecycle');
      expect(workflow.name).toBe('Issue Lifecycle Workflow');
    });

    test('should return null for non-existent workflow', async () => {
      const workflow = await workflowEngine._getWorkflow('non-existent');
      expect(workflow).toBeUndefined();
    });
  });

  describe('Concurrent Execution Management', () => {
    test('should track active executions correctly', async () => {
      const workflowId = 'yolo-pro-issue-lifecycle';
      const issueId = 10001;

      const initialActiveCount = workflowEngine.getMetrics().activeWorkflows;

      // Start execution (don't await)
      const executionPromise = workflowEngine.executeWorkflow(workflowId, issueId);

      // Check active count increased
      const duringExecutionCount = workflowEngine.getMetrics().activeWorkflows;
      expect(duringExecutionCount).toBe(initialActiveCount + 1);

      // Wait for completion
      await executionPromise;

      // Check active count returned to original
      const afterExecutionCount = workflowEngine.getMetrics().activeWorkflows;
      expect(afterExecutionCount).toBe(initialActiveCount);
    });

    test('should prevent execution beyond maximum concurrent limit', async () => {
      // Set low limit for testing
      workflowEngine.config.maxConcurrentWorkflows = 2;

      const promises = [];
      
      // Start maximum allowed executions
      for (let i = 0; i < 2; i++) {
        promises.push(workflowEngine.executeWorkflow('yolo-pro-issue-lifecycle', 11000 + i));
      }

      // This should be rejected due to limit
      await expect(workflowEngine.executeWorkflow('yolo-pro-issue-lifecycle', 11003))
        .rejects.toThrow('Maximum concurrent workflows exceeded');

      // Clean up
      await Promise.all(promises);
    });
  });
});