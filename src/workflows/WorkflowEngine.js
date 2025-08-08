/**
 * YOLO-PRO Workflow Automation Engine
 * Core workflow processing and state management system
 * Implements SPARC Phase 4: Refinement with TDD methodology
 */

const { v4: uuidv4 } = require('uuid');
const { EventEmitter } = require('events');

class WorkflowEngine extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      maxConcurrentWorkflows: config.maxConcurrentWorkflows || 100,
      executionTimeout: config.executionTimeout || 30000,
      retryAttempts: config.retryAttempts || 3,
      stateTransitionTimeout: config.stateTransitionTimeout || 5000,
      queueMaxSize: config.queueMaxSize || 10000,
      ...config
    };

    this.stateManager = new WorkflowStateManager(config.stateStore);
    this.eventProcessor = new WorkflowEventProcessor(config.eventConfig);
    this.ruleEngine = new WorkflowRuleEngine(config.ruleDefinitions);
    this.transitionHandler = new StateTransitionHandler(config.transitionConfig);
    this.executionQueue = new WorkflowExecutionQueue(config.queueConfig);
    this.actionExecutor = new WorkflowActionExecutor(config.actionConfig);

    this.workflows = new Map();
    this.activeExecutions = new Map();
    
    this.metrics = {
      workflowsExecuted: 0,
      stateTransitions: 0,
      eventProcessed: 0,
      executionErrors: 0,
      averageExecutionTime: 0,
      queueSize: 0
    };

    this._initializeStandardWorkflows();
  }

  /**
   * Process workflow event with comprehensive error handling
   */
  async processEvent(event, options = {}) {
    try {
      const startTime = Date.now();
      
      // Event validation
      const validation = this._validateEvent(event);
      if (!validation.valid) {
        throw new WorkflowValidationError('Invalid workflow event', validation.errors);
      }

      // Get current workflow state
      const currentState = await this.stateManager.getCurrentState(event.issueId);
      const workflow = await this._getWorkflow(event.workflowId);

      if (!workflow) {
        throw new WorkflowNotFoundError(`Workflow not found: ${event.workflowId}`);
      }

      // Create execution context
      const executionContext = {
        eventId: uuidv4(),
        workflowId: event.workflowId,
        issueId: event.issueId,
        event,
        currentState,
        workflow,
        startTime,
        options
      };

      // Process event through rule engine
      const ruleResults = await this.ruleEngine.evaluateRules(
        workflow.rules,
        event,
        currentState,
        { timeout: this.config.stateTransitionTimeout }
      );

      const results = {
        eventId: executionContext.eventId,
        processed: true,
        ruleResults: [],
        stateTransitions: [],
        actionsExecuted: [],
        errors: []
      };

      // Execute applicable rules
      for (const ruleResult of ruleResults.applicable) {
        try {
          const ruleExecutionResult = await this._executeRule(
            ruleResult,
            executionContext
          );
          
          results.ruleResults.push(ruleExecutionResult);

          // Handle state transitions
          if (ruleExecutionResult.transition) {
            const transitionResult = await this._executeStateTransition(
              ruleExecutionResult.transition,
              executionContext
            );
            
            results.stateTransitions.push(transitionResult);
          }

          // Handle actions
          if (ruleExecutionResult.actions && ruleExecutionResult.actions.length > 0) {
            const actionResults = await this._executeActions(
              ruleExecutionResult.actions,
              executionContext
            );
            
            results.actionsExecuted.push(...actionResults);
          }

        } catch (error) {
          results.errors.push({
            ruleId: ruleResult.id,
            error: error.message,
            timestamp: Date.now()
          });
        }
      }

      // Update metrics
      this.metrics.eventProcessed++;
      const processingTime = Date.now() - startTime;
      this.metrics.averageExecutionTime = 
        (this.metrics.averageExecutionTime + processingTime) / 2;

      // Emit event
      this.emit('event:processed', {
        eventId: executionContext.eventId,
        workflowId: event.workflowId,
        issueId: event.issueId,
        processingTime,
        results
      });

      return {
        success: true,
        executionContext: {
          eventId: executionContext.eventId,
          processingTime
        },
        results
      };

    } catch (error) {
      this.metrics.executionErrors++;
      
      this.emit('event:error', {
        event,
        error: error.message,
        timestamp: Date.now()
      });

      if (error instanceof WorkflowError) {
        throw error;
      }

      throw new WorkflowProcessingError(`Event processing failed: ${error.message}`);
    }
  }

  /**
   * Execute workflow with full state management
   */
  async executeWorkflow(workflowId, issueId, options = {}) {
    try {
      const startTime = Date.now();
      
      if (!workflowId || !issueId) {
        throw new WorkflowValidationError('Workflow ID and Issue ID are required');
      }

      // Get workflow definition
      const workflow = await this._getWorkflow(workflowId);
      if (!workflow) {
        throw new WorkflowNotFoundError(`Workflow not found: ${workflowId}`);
      }

      // Check if workflow is already executing
      const executionKey = `${workflowId}:${issueId}`;
      if (this.activeExecutions.has(executionKey)) {
        throw new WorkflowExecutionError('Workflow is already executing');
      }

      // Create execution context
      const executionContext = {
        executionId: uuidv4(),
        workflowId,
        issueId,
        workflow,
        startTime,
        options,
        status: 'running'
      };

      this.activeExecutions.set(executionKey, executionContext);

      try {
        // Initialize workflow state if needed
        let currentState = await this.stateManager.getCurrentState(issueId);
        
        if (!currentState) {
          currentState = await this._initializeWorkflowState(workflow, issueId);
        }

        // Execute workflow steps
        const executionResult = await this._executeWorkflowSteps(
          workflow,
          currentState,
          executionContext
        );

        // Update final state
        await this.stateManager.updateState(
          issueId,
          executionResult.finalState,
          {
            executionId: executionContext.executionId,
            completedAt: Date.now()
          }
        );

        executionContext.status = 'completed';
        this.metrics.workflowsExecuted++;

        const result = {
          success: true,
          executionId: executionContext.executionId,
          workflowId,
          issueId,
          initialState: currentState.id,
          finalState: executionResult.finalState.id,
          stepsExecuted: executionResult.steps,
          executionTime: Date.now() - startTime
        };

        this.emit('workflow:completed', result);

        return result;

      } finally {
        this.activeExecutions.delete(executionKey);
      }

    } catch (error) {
      this.metrics.executionErrors++;

      this.emit('workflow:error', {
        workflowId,
        issueId,
        error: error.message,
        timestamp: Date.now()
      });

      if (error instanceof WorkflowError) {
        throw error;
      }

      throw new WorkflowExecutionError(`Workflow execution failed: ${error.message}`);
    }
  }

  /**
   * Update workflow state with validation and history
   */
  async updateWorkflowState(issueId, newStateId, options = {}) {
    try {
      if (!issueId || !newStateId) {
        throw new WorkflowValidationError('Issue ID and state ID are required');
      }

      const currentState = await this.stateManager.getCurrentState(issueId);
      
      if (!currentState) {
        throw new WorkflowStateError('No current state found for issue');
      }

      // Validate state transition
      const workflow = await this._getWorkflow(currentState.workflowId);
      const isValidTransition = this._validateStateTransition(
        workflow,
        currentState.id,
        newStateId
      );

      if (!isValidTransition.valid) {
        throw new WorkflowStateError(
          `Invalid state transition: ${currentState.id} -> ${newStateId}`,
          isValidTransition.reason
        );
      }

      // Execute state transition
      const transitionResult = await this.transitionHandler.executeTransition({
        from: currentState.id,
        to: newStateId,
        issueId,
        workflow,
        metadata: options.metadata,
        triggeredBy: options.userId
      });

      if (!transitionResult.success) {
        throw new WorkflowStateError(
          'State transition failed',
          transitionResult.error
        );
      }

      // Update state
      const updatedState = await this.stateManager.updateState(
        issueId,
        newStateId,
        {
          transitionId: transitionResult.transitionId,
          previousState: currentState.id,
          updatedAt: Date.now(),
          updatedBy: options.userId,
          metadata: options.metadata
        }
      );

      this.metrics.stateTransitions++;

      const result = {
        success: true,
        issueId,
        previousState: currentState,
        newState: updatedState,
        transition: transitionResult
      };

      this.emit('state:updated', result);

      return result;

    } catch (error) {
      if (error instanceof WorkflowError) {
        throw error;
      }

      throw new WorkflowStateError(`State update failed: ${error.message}`);
    }
  }

  /**
   * Validate workflow definition
   */
  async validateWorkflow(definition, options = {}) {
    try {
      const validation = {
        valid: true,
        errors: [],
        warnings: []
      };

      // Basic structure validation
      if (!definition.id) {
        validation.errors.push('Workflow ID is required');
        validation.valid = false;
      }

      if (!definition.states || !Array.isArray(definition.states)) {
        validation.errors.push('Workflow states are required');
        validation.valid = false;
      }

      if (!definition.transitions || !Array.isArray(definition.transitions)) {
        validation.errors.push('Workflow transitions are required');
        validation.valid = false;
      }

      // State validation
      if (definition.states) {
        const stateIds = new Set();
        
        for (const state of definition.states) {
          if (!state.id) {
            validation.errors.push('State ID is required');
            validation.valid = false;
          } else if (stateIds.has(state.id)) {
            validation.errors.push(`Duplicate state ID: ${state.id}`);
            validation.valid = false;
          } else {
            stateIds.add(state.id);
          }

          if (!state.name) {
            validation.errors.push(`State name is required for state: ${state.id}`);
            validation.valid = false;
          }
        }
      }

      // Transition validation
      if (definition.transitions && definition.states) {
        const stateIds = new Set(definition.states.map(s => s.id));
        
        for (const transition of definition.transitions) {
          if (!transition.from || !stateIds.has(transition.from)) {
            validation.errors.push(`Invalid transition 'from' state: ${transition.from}`);
            validation.valid = false;
          }

          if (!transition.to || !stateIds.has(transition.to)) {
            validation.errors.push(`Invalid transition 'to' state: ${transition.to}`);
            validation.valid = false;
          }
        }

        // Check for circular dependencies
        const circularDeps = this._detectCircularDependencies(definition.transitions);
        if (circularDeps.length > 0) {
          validation.warnings.push(`Circular dependencies detected: ${circularDeps.join(', ')}`);
        }
      }

      // Rule validation
      if (definition.rules) {
        for (const rule of definition.rules) {
          if (!rule.id) {
            validation.errors.push('Rule ID is required');
            validation.valid = false;
          }

          if (!rule.condition) {
            validation.errors.push(`Rule condition is required for rule: ${rule.id}`);
            validation.valid = false;
          }
        }
      }

      return validation;

    } catch (error) {
      return {
        valid: false,
        errors: [`Validation error: ${error.message}`],
        warnings: []
      };
    }
  }

  /**
   * Batch execute workflow operations
   */
  async batchExecuteWorkflows(operations, options = {}) {
    try {
      const {
        concurrency = 10,
        continueOnError = true,
        timeout = 60000
      } = options;

      if (!Array.isArray(operations) || operations.length === 0) {
        throw new WorkflowValidationError('Operations array is required');
      }

      const results = {
        successful: [],
        failed: [],
        skipped: [],
        totalProcessed: 0
      };

      const startTime = Date.now();

      // Sort operations by priority and dependencies
      const sortedOperations = this._sortOperationsByPriorityAndDependencies(operations);

      // Process in batches
      const batches = this._createBatches(sortedOperations, concurrency);

      for (const batch of batches) {
        const batchPromises = batch.map(async (operation) => {
          try {
            // Check dependencies
            if (operation.dependencies && operation.dependencies.length > 0) {
              const dependenciesMet = await this._checkOperationDependencies(
                operation,
                results.successful
              );
              
              if (!dependenciesMet) {
                return {
                  success: false,
                  operation,
                  error: 'Dependencies not satisfied',
                  skipped: true
                };
              }
            }

            // Execute operation with timeout
            const result = await Promise.race([
              this._executeWorkflowOperation(operation),
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
          } else if (result.skipped) {
            results.skipped.push(result);
          } else {
            results.failed.push(result);
          }
        });
      }

      return {
        success: results.failed.length === 0,
        results,
        summary: {
          total: operations.length,
          successful: results.successful.length,
          failed: results.failed.length,
          skipped: results.skipped.length,
          processingTime: Date.now() - startTime
        }
      };

    } catch (error) {
      throw new WorkflowExecutionError(`Batch workflow execution failed: ${error.message}`);
    }
  }

  /**
   * Get workflow metrics and statistics
   */
  getMetrics() {
    return {
      ...this.metrics,
      activeWorkflows: this.activeExecutions.size,
      registeredWorkflows: this.workflows.size,
      queueStats: this.executionQueue.getStats(),
      stateManagerStats: this.stateManager.getStats()
    };
  }

  // Private methods

  _initializeStandardWorkflows() {
    this.standardWorkflows = {
      'yolo-pro-issue-lifecycle': {
        id: 'yolo-pro-issue-lifecycle',
        name: 'Issue Lifecycle Workflow',
        version: '1.0.0',
        states: [
          { id: 'open', name: 'Open', type: 'initial', labels: ['status:open'] },
          { id: 'in_progress', name: 'In Progress', type: 'active', labels: ['status:in-progress'] },
          { id: 'review', name: 'Under Review', type: 'active', labels: ['status:review'] },
          { id: 'testing', name: 'Testing', type: 'active', labels: ['status:testing'] },
          { id: 'closed', name: 'Closed', type: 'final', labels: ['status:closed'] }
        ],
        transitions: [
          { id: 't1', from: 'open', to: 'in_progress', trigger: 'assign' },
          { id: 't2', from: 'in_progress', to: 'review', trigger: 'pull_request' },
          { id: 't3', from: 'review', to: 'testing', trigger: 'approve' },
          { id: 't4', from: 'testing', to: 'closed', trigger: 'pass' },
          { id: 't5', from: 'testing', to: 'in_progress', trigger: 'fail' }
        ],
        rules: [
          {
            id: 'auto_progress_on_assign',
            condition: { type: 'issue_assigned' },
            actions: [{ type: 'transition', to: 'in_progress' }]
          }
        ]
      }
    };

    // Register standard workflows
    for (const [id, workflow] of Object.entries(this.standardWorkflows)) {
      this.workflows.set(id, workflow);
    }
  }

  _validateEvent(event) {
    const errors = [];

    if (!event || typeof event !== 'object') {
      errors.push('Event object is required');
    } else {
      if (!event.workflowId) {
        errors.push('Workflow ID is required');
      }
      
      if (!event.issueId) {
        errors.push('Issue ID is required');
      }
      
      if (!event.type) {
        errors.push('Event type is required');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  async _getWorkflow(workflowId) {
    return this.workflows.get(workflowId);
  }

  async _executeRule(ruleResult, executionContext) {
    const rule = ruleResult.rule;
    const result = {
      ruleId: rule.id,
      executed: true,
      transition: null,
      actions: [],
      executionTime: 0
    };

    const startTime = Date.now();

    try {
      // Check for transition
      if (rule.transition) {
        result.transition = {
          from: executionContext.currentState.id,
          to: rule.transition.to,
          trigger: rule.transition.trigger
        };
      }

      // Collect actions
      if (rule.actions && rule.actions.length > 0) {
        result.actions = rule.actions.map(action => ({
          type: action.type,
          parameters: action.parameters,
          id: uuidv4()
        }));
      }

      result.executionTime = Date.now() - startTime;
      return result;

    } catch (error) {
      result.executed = false;
      result.error = error.message;
      result.executionTime = Date.now() - startTime;
      return result;
    }
  }

  async _executeStateTransition(transition, executionContext) {
    try {
      const transitionResult = await this.transitionHandler.executeTransition({
        from: transition.from,
        to: transition.to,
        issueId: executionContext.issueId,
        workflow: executionContext.workflow,
        trigger: transition.trigger,
        executionContext
      });

      if (transitionResult.success) {
        await this.stateManager.updateState(
          executionContext.issueId,
          transition.to,
          {
            transitionId: transitionResult.transitionId,
            previousState: transition.from,
            executedAt: Date.now()
          }
        );
      }

      return transitionResult;

    } catch (error) {
      return {
        success: false,
        error: error.message,
        transition
      };
    }
  }

  async _executeActions(actions, executionContext) {
    const results = [];

    for (const action of actions) {
      try {
        const actionResult = await this.actionExecutor.execute(action, executionContext);
        results.push(actionResult);
      } catch (error) {
        results.push({
          actionId: action.id,
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }

  async _initializeWorkflowState(workflow, issueId) {
    const initialState = workflow.states.find(s => s.type === 'initial');
    
    if (!initialState) {
      throw new WorkflowStateError('No initial state found in workflow');
    }

    return await this.stateManager.initializeState(issueId, {
      stateId: initialState.id,
      workflowId: workflow.id,
      initializedAt: Date.now()
    });
  }

  async _executeWorkflowSteps(workflow, currentState, executionContext) {
    // Implement workflow step execution logic
    return {
      finalState: currentState,
      steps: []
    };
  }

  _validateStateTransition(workflow, fromStateId, toStateId) {
    const transition = workflow.transitions.find(
      t => t.from === fromStateId && t.to === toStateId
    );

    if (!transition) {
      return {
        valid: false,
        reason: 'No transition defined between states'
      };
    }

    return { valid: true };
  }

  _detectCircularDependencies(transitions) {
    // Implement circular dependency detection
    return [];
  }

  _sortOperationsByPriorityAndDependencies(operations) {
    // Implement operation sorting logic
    return operations;
  }

  async _checkOperationDependencies(operation, completedOperations) {
    // Implement dependency checking logic
    return true;
  }

  async _executeWorkflowOperation(operation) {
    // Implement operation execution logic
    return { success: true };
  }

  _createBatches(operations, batchSize) {
    const batches = [];
    for (let i = 0; i < operations.length; i += batchSize) {
      batches.push(operations.slice(i, i + batchSize));
    }
    return batches;
  }
}

// Error classes
class WorkflowError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = this.constructor.name;
    this.details = details;
  }
}

class WorkflowValidationError extends WorkflowError {}
class WorkflowNotFoundError extends WorkflowError {}
class WorkflowExecutionError extends WorkflowError {}
class WorkflowProcessingError extends WorkflowError {}
class WorkflowStateError extends WorkflowError {}

// Placeholder classes
class WorkflowStateManager {
  constructor(stateStore) {
    this.stateStore = stateStore;
    this.states = new Map();
  }

  async getCurrentState(issueId) {
    return this.states.get(issueId);
  }

  async updateState(issueId, stateId, metadata) {
    const state = { id: stateId, issueId, ...metadata };
    this.states.set(issueId, state);
    return state;
  }

  async initializeState(issueId, initialState) {
    const state = { ...initialState, issueId };
    this.states.set(issueId, state);
    return state;
  }

  getStats() {
    return { totalStates: this.states.size };
  }
}

class WorkflowEventProcessor {
  constructor(config) {
    this.config = config;
  }
}

class WorkflowRuleEngine {
  constructor(rules) {
    this.rules = rules;
  }

  async evaluateRules(workflowRules, event, currentState, options) {
    return {
      applicable: workflowRules.filter(rule => 
        rule.condition.type === event.type
      ).map(rule => ({ rule, id: rule.id }))
    };
  }
}

class StateTransitionHandler {
  constructor(config) {
    this.config = config;
  }

  async executeTransition(transition) {
    return {
      success: true,
      transitionId: uuidv4(),
      executedAt: Date.now()
    };
  }
}

class WorkflowExecutionQueue {
  constructor(config) {
    this.config = config;
    this.queue = [];
  }

  getStats() {
    return { queueSize: this.queue.length };
  }
}

class WorkflowActionExecutor {
  constructor(config) {
    this.config = config;
  }

  async execute(action, context) {
    return {
      actionId: action.id,
      success: true,
      executedAt: Date.now()
    };
  }
}

module.exports = {
  WorkflowEngine,
  WorkflowError,
  WorkflowValidationError,
  WorkflowNotFoundError,
  WorkflowExecutionError,
  WorkflowProcessingError,
  WorkflowStateError
};