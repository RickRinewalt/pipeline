/**
 * YOLO-PRO Issue Template CLI Commands
 * Command-line interface for template management and workflow automation
 * Implements SPARC Phase 5: Completion with CLI integration
 */

const { TemplateEngine } = require('../templates/TemplateEngine');
const { WorkflowEngine } = require('../workflows/WorkflowEngine');
const { ClassificationEngine } = require('../classification/ClassificationEngine');

class IssueTemplateCommands {
  constructor(options = {}) {
    this.gitHubClient = options.gitHubClient;
    this.labelManager = options.labelManager;
    
    this.description = 'Issue template and workflow automation operations';
    this.usage = 'yolo-pro template <subcommand> [options]';
    
    // Initialize engines
    this.templateEngine = new TemplateEngine({
      storage: options.storage || { type: 'memory' },
      cacheSize: options.cacheSize || 100,
      validationRules: options.validationRules || {}
    });

    this.workflowEngine = new WorkflowEngine({
      stateStore: options.stateStore || { type: 'memory' },
      maxConcurrentWorkflows: options.maxConcurrentWorkflows || 50
    });

    this.classificationEngine = new ClassificationEngine({
      confidenceThreshold: options.confidenceThreshold || 0.7,
      modelConfig: options.modelConfig || {}
    });

    this.subcommands = [
      {
        name: 'create-template',
        description: 'Create a new issue template',
        usage: 'yolo-pro template create-template --name <name> --type <type> [--fields <fields>]',
        parameters: [
          { name: '--name', description: 'Template name (required)' },
          { name: '--type', description: 'Template type (bug, feature, epic, enhancement)' },
          { name: '--fields', description: 'JSON string of template fields' },
          { name: '--parent', description: 'Parent template ID for inheritance' },
          { name: '--description', description: 'Template description' }
        ]
      },
      {
        name: 'list-templates',
        description: 'List available templates',
        usage: 'yolo-pro template list-templates [--type <type>] [--format <format>]',
        parameters: [
          { name: '--type', description: 'Filter by template type' },
          { name: '--format', description: 'Output format (table, json)' }
        ]
      },
      {
        name: 'apply-template',
        description: 'Apply template to create GitHub issue',
        usage: 'yolo-pro template apply-template --template <id> --data <data> [--repo <repo>]',
        parameters: [
          { name: '--template', description: 'Template ID (required)' },
          { name: '--data', description: 'JSON string of issue data (required)' },
          { name: '--repo', description: 'Repository (owner/name)' },
          { name: '--labels', description: 'Additional labels to apply' }
        ]
      },
      {
        name: 'validate-template',
        description: 'Validate template definition',
        usage: 'yolo-pro template validate-template --file <file> [--strict]',
        parameters: [
          { name: '--file', description: 'Template definition file (required)' },
          { name: '--strict', description: 'Enable strict validation' }
        ]
      },
      {
        name: 'start-workflow',
        description: 'Start workflow for an issue',
        usage: 'yolo-pro template start-workflow --issue <number> --workflow <id>',
        parameters: [
          { name: '--issue', description: 'Issue number (required)' },
          { name: '--workflow', description: 'Workflow ID (required)' },
          { name: '--repo', description: 'Repository (owner/name)' }
        ]
      },
      {
        name: 'workflow-status',
        description: 'Check workflow status for an issue',
        usage: 'yolo-pro template workflow-status --issue <number> [--repo <repo>]',
        parameters: [
          { name: '--issue', description: 'Issue number (required)' },
          { name: '--repo', description: 'Repository (owner/name)' }
        ]
      },
      {
        name: 'classify-issue',
        description: 'Classify issue and suggest labels',
        usage: 'yolo-pro template classify-issue --issue <number> [--apply-labels]',
        parameters: [
          { name: '--issue', description: 'Issue number (required)' },
          { name: '--repo', description: 'Repository (owner/name)' },
          { name: '--apply-labels', description: 'Automatically apply suggested labels' },
          { name: '--confidence', description: 'Minimum confidence threshold' }
        ]
      },
      {
        name: 'batch-classify',
        description: 'Classify multiple issues in batch',
        usage: 'yolo-pro template batch-classify --issues <numbers> [--concurrency <n>]',
        parameters: [
          { name: '--issues', description: 'Comma-separated issue numbers (required)' },
          { name: '--repo', description: 'Repository (owner/name)' },
          { name: '--concurrency', description: 'Number of parallel classifications' },
          { name: '--apply-labels', description: 'Automatically apply suggested labels' }
        ]
      },
      {
        name: 'train-model',
        description: 'Train classification model with feedback data',
        usage: 'yolo-pro template train-model --data <file> [--deploy]',
        parameters: [
          { name: '--data', description: 'Training data file (JSON) (required)' },
          { name: '--deploy', description: 'Automatically deploy if performance improves' },
          { name: '--validation-split', description: 'Validation data split ratio' }
        ]
      },
      {
        name: 'workflow-metrics',
        description: 'Display workflow and template metrics',
        usage: 'yolo-pro template workflow-metrics [--format <format>]',
        parameters: [
          { name: '--format', description: 'Output format (table, json)' }
        ]
      }
    ];

    this.examples = [
      'yolo-pro template create-template --name "Bug Report" --type bug',
      'yolo-pro template apply-template --template bug-template --data \'{"title":"App crash","description":"..."}\'',
      'yolo-pro template classify-issue --issue 123 --apply-labels',
      'yolo-pro template start-workflow --issue 456 --workflow issue-lifecycle',
      'yolo-pro template batch-classify --issues "1,2,3,4,5" --concurrency 3'
    ];
  }

  async execute(context) {
    const { subcommand, arguments: args, options, flags } = context;
    
    try {
      switch (subcommand) {
        case 'create-template':
          return await this.createTemplate(options);
        case 'list-templates':
          return await this.listTemplates(options);
        case 'apply-template':
          return await this.applyTemplate(options);
        case 'validate-template':
          return await this.validateTemplate(options);
        case 'start-workflow':
          return await this.startWorkflow(options);
        case 'workflow-status':
          return await this.getWorkflowStatus(options);
        case 'classify-issue':
          return await this.classifyIssue(options);
        case 'batch-classify':
          return await this.batchClassifyIssues(options);
        case 'train-model':
          return await this.trainClassificationModel(options);
        case 'workflow-metrics':
          return await this.getWorkflowMetrics(options);
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

  async createTemplate(options = {}) {
    try {
      if (!options.name) {
        return {
          success: false,
          error: 'Template name is required',
          usage: 'yolo-pro template create-template --name <name> --type <type>'
        };
      }

      if (!options.type) {
        return {
          success: false,
          error: 'Template type is required',
          usage: 'yolo-pro template create-template --name <name> --type <type>'
        };
      }

      // Parse fields if provided
      let fields = [];
      if (options.fields) {
        try {
          fields = JSON.parse(options.fields);
        } catch (error) {
          return {
            success: false,
            error: 'Invalid JSON format for fields',
            details: error.message
          };
        }
      } else {
        // Use default fields based on type
        fields = this._getDefaultFieldsForType(options.type);
      }

      const templateDefinition = {
        name: options.name,
        type: options.type,
        description: options.description,
        fields: fields,
        parent: options.parent
      };

      const result = await this.templateEngine.createTemplate(
        templateDefinition,
        'cli-user' // TODO: Get actual user from context
      );

      return {
        success: true,
        template: result.template,
        message: `Template "${options.name}" created successfully`,
        templateId: result.template.id,
        processingTime: result.processingTime
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        type: 'template-creation-error'
      };
    }
  }

  async listTemplates(options = {}) {
    try {
      // TODO: Implement template listing from repository
      const templates = []; // Placeholder

      const filteredTemplates = options.type
        ? templates.filter(t => t.type === options.type)
        : templates;

      if (options.format === 'json') {
        return {
          success: true,
          templates: filteredTemplates,
          total: filteredTemplates.length
        };
      }

      // Format as table
      return {
        success: true,
        templates: filteredTemplates,
        total: filteredTemplates.length,
        formatted: this._formatTemplatesAsTable(filteredTemplates)
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        type: 'template-listing-error'
      };
    }
  }

  async applyTemplate(options = {}) {
    try {
      if (!options.template) {
        return {
          success: false,
          error: 'Template ID is required',
          usage: 'yolo-pro template apply-template --template <id> --data <data>'
        };
      }

      if (!options.data) {
        return {
          success: false,
          error: 'Issue data is required',
          usage: 'yolo-pro template apply-template --template <id> --data <data>'
        };
      }

      // Parse issue data
      let issueData;
      try {
        issueData = JSON.parse(options.data);
      } catch (error) {
        return {
          success: false,
          error: 'Invalid JSON format for issue data',
          details: error.message
        };
      }

      // Apply template
      const templateResult = await this.templateEngine.applyTemplate(
        options.template,
        issueData,
        { userId: 'cli-user' }
      );

      if (!templateResult.success) {
        return {
          success: false,
          error: 'Template application failed',
          details: templateResult.error
        };
      }

      // If repository specified, create GitHub issue
      if (options.repo && this.gitHubClient) {
        const [owner, repo] = options.repo.split('/');
        
        const githubIssue = await this._createGitHubIssue({
          owner,
          repo,
          appliedTemplate: templateResult.appliedTemplate,
          additionalLabels: options.labels ? options.labels.split(',') : []
        });

        return {
          success: true,
          appliedTemplate: templateResult.appliedTemplate,
          githubIssue: githubIssue,
          message: `Issue created successfully: ${githubIssue.url}`
        };
      }

      return {
        success: true,
        appliedTemplate: templateResult.appliedTemplate,
        message: 'Template applied successfully'
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        type: 'template-application-error'
      };
    }
  }

  async validateTemplate(options = {}) {
    try {
      if (!options.file) {
        return {
          success: false,
          error: 'Template file is required',
          usage: 'yolo-pro template validate-template --file <file>'
        };
      }

      // Read template file
      const fs = require('fs').promises;
      let templateDefinition;
      
      try {
        const fileContent = await fs.readFile(options.file, 'utf8');
        templateDefinition = JSON.parse(fileContent);
      } catch (error) {
        return {
          success: false,
          error: 'Failed to read or parse template file',
          details: error.message
        };
      }

      // Validate template
      const validation = await this.templateEngine.validateTemplate(
        templateDefinition,
        { strict: options.strict }
      );

      return {
        success: validation.valid,
        validation: validation,
        message: validation.valid
          ? 'Template is valid'
          : `Template validation failed: ${validation.errors.join(', ')}`
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        type: 'template-validation-error'
      };
    }
  }

  async startWorkflow(options = {}) {
    try {
      if (!options.issue) {
        return {
          success: false,
          error: 'Issue number is required',
          usage: 'yolo-pro template start-workflow --issue <number> --workflow <id>'
        };
      }

      if (!options.workflow) {
        return {
          success: false,
          error: 'Workflow ID is required',
          usage: 'yolo-pro template start-workflow --issue <number> --workflow <id>'
        };
      }

      const issueNumber = parseInt(options.issue);
      if (isNaN(issueNumber)) {
        return {
          success: false,
          error: 'Invalid issue number'
        };
      }

      // Execute workflow
      const result = await this.workflowEngine.executeWorkflow(
        options.workflow,
        issueNumber,
        { userId: 'cli-user' }
      );

      return {
        success: true,
        workflow: {
          executionId: result.executionId,
          workflowId: options.workflow,
          issueId: issueNumber,
          initialState: result.initialState,
          finalState: result.finalState,
          executionTime: result.executionTime
        },
        message: `Workflow started for issue #${issueNumber}`
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        type: 'workflow-execution-error'
      };
    }
  }

  async getWorkflowStatus(options = {}) {
    try {
      if (!options.issue) {
        return {
          success: false,
          error: 'Issue number is required',
          usage: 'yolo-pro template workflow-status --issue <number>'
        };
      }

      const issueNumber = parseInt(options.issue);
      if (isNaN(issueNumber)) {
        return {
          success: false,
          error: 'Invalid issue number'
        };
      }

      // Get workflow state
      const currentState = await this.workflowEngine.stateManager.getCurrentState(issueNumber);

      if (!currentState) {
        return {
          success: false,
          error: `No workflow found for issue #${issueNumber}`,
          suggestion: 'Use start-workflow command to initialize a workflow'
        };
      }

      return {
        success: true,
        workflowStatus: {
          issueId: issueNumber,
          currentState: currentState.id,
          workflowId: currentState.workflowId,
          lastUpdated: currentState.updatedAt,
          stateHistory: await this._getStateHistory(issueNumber)
        },
        message: `Issue #${issueNumber} is in "${currentState.id}" state`
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        type: 'workflow-status-error'
      };
    }
  }

  async classifyIssue(options = {}) {
    try {
      if (!options.issue) {
        return {
          success: false,
          error: 'Issue number is required',
          usage: 'yolo-pro template classify-issue --issue <number>'
        };
      }

      const issueNumber = parseInt(options.issue);
      if (isNaN(issueNumber)) {
        return {
          success: false,
          error: 'Invalid issue number'
        };
      }

      // Get issue content from GitHub
      let issueContent;
      if (this.gitHubClient && options.repo) {
        const [owner, repo] = options.repo.split('/');
        
        try {
          const issue = await this.gitHubClient.request('GET', `/repos/${owner}/${repo}/issues/${issueNumber}`);
          issueContent = {
            title: issue.data.title,
            body: issue.data.body
          };
        } catch (error) {
          return {
            success: false,
            error: `Failed to fetch issue #${issueNumber}`,
            details: error.message
          };
        }
      } else {
        return {
          success: false,
          error: 'Repository information is required to fetch issue content',
          usage: 'yolo-pro template classify-issue --issue <number> --repo <owner/name>'
        };
      }

      // Classify issue
      const classificationResult = await this.classificationEngine.classifyIssue(
        issueContent,
        { issueId: issueNumber },
        { confidenceThreshold: options.confidence ? parseFloat(options.confidence) : undefined }
      );

      // Apply labels if requested
      let labelResult = null;
      if (options['apply-labels'] && this.labelManager) {
        const suggestedLabels = classificationResult.predictions.map(p => p.label);
        
        try {
          labelResult = await this.labelManager.addLabelsToIssue(
            issueNumber,
            suggestedLabels,
            { createMissing: true }
          );
        } catch (error) {
          // Continue even if label application fails
          labelResult = { error: error.message };
        }
      }

      return {
        success: true,
        classification: {
          issueId: issueNumber,
          predictions: classificationResult.predictions,
          overallConfidence: classificationResult.overallConfidence,
          modelVersion: classificationResult.modelVersion,
          processingTime: classificationResult.processingTime
        },
        labelApplication: labelResult,
        message: `Issue #${issueNumber} classified with ${classificationResult.predictions.length} predictions`
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        type: 'classification-error'
      };
    }
  }

  async batchClassifyIssues(options = {}) {
    try {
      if (!options.issues) {
        return {
          success: false,
          error: 'Issue numbers are required',
          usage: 'yolo-pro template batch-classify --issues <numbers>'
        };
      }

      const issueNumbers = options.issues.split(',').map(n => {
        const num = parseInt(n.trim());
        if (isNaN(num)) {
          throw new Error(`Invalid issue number: ${n}`);
        }
        return num;
      });

      if (!options.repo || !this.gitHubClient) {
        return {
          success: false,
          error: 'Repository information and GitHub client are required',
          usage: 'yolo-pro template batch-classify --issues <numbers> --repo <owner/name>'
        };
      }

      const [owner, repo] = options.repo.split('/');
      const concurrency = options.concurrency ? parseInt(options.concurrency) : 5;

      // Fetch all issues
      const issues = [];
      for (const issueNumber of issueNumbers) {
        try {
          const issue = await this.gitHubClient.request('GET', `/repos/${owner}/${repo}/issues/${issueNumber}`);
          issues.push({
            content: {
              title: issue.data.title,
              body: issue.data.body
            },
            metadata: { issueId: issueNumber }
          });
        } catch (error) {
          issues.push({
            error: `Failed to fetch issue #${issueNumber}: ${error.message}`,
            metadata: { issueId: issueNumber }
          });
        }
      }

      // Batch classify
      const classificationResult = await this.classificationEngine.batchClassifyIssues(
        issues.filter(i => !i.error),
        { concurrency }
      );

      // Apply labels if requested
      let labelResults = [];
      if (options['apply-labels'] && this.labelManager) {
        for (const result of classificationResult.results.successful) {
          const issueId = result.result.issueId;
          const suggestedLabels = result.result.predictions.map(p => p.label);
          
          try {
            const labelResult = await this.labelManager.addLabelsToIssue(
              issueId,
              suggestedLabels,
              { createMissing: true }
            );
            labelResults.push({ issueId, result: labelResult });
          } catch (error) {
            labelResults.push({ issueId, error: error.message });
          }
        }
      }

      return {
        success: classificationResult.success,
        batchClassification: {
          total: issueNumbers.length,
          successful: classificationResult.results.successful.length,
          failed: classificationResult.results.failed.length,
          results: classificationResult.results.successful.map(r => r.result),
          errors: classificationResult.results.failed.map(f => f.error),
          processingTime: classificationResult.results.summary.processingTime
        },
        labelApplication: labelResults,
        message: `Batch classified ${classificationResult.results.successful.length} of ${issueNumbers.length} issues`
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        type: 'batch-classification-error'
      };
    }
  }

  async trainClassificationModel(options = {}) {
    try {
      if (!options.data) {
        return {
          success: false,
          error: 'Training data file is required',
          usage: 'yolo-pro template train-model --data <file>'
        };
      }

      // Read training data
      const fs = require('fs').promises;
      let trainingData;
      
      try {
        const fileContent = await fs.readFile(options.data, 'utf8');
        trainingData = JSON.parse(fileContent);
      } catch (error) {
        return {
          success: false,
          error: 'Failed to read or parse training data file',
          details: error.message
        };
      }

      // Train model
      const trainingOptions = {
        validationSplit: options['validation-split'] ? parseFloat(options['validation-split']) : 0.2,
        forceDeployment: options.deploy === 'true'
      };

      const result = await this.classificationEngine.trainModel(trainingData, trainingOptions);

      return {
        success: true,
        training: {
          modelId: result.modelId,
          trainingTime: result.trainingTime,
          performance: result.performance,
          deployed: result.deployed
        },
        message: result.deployed
          ? `Model trained and deployed successfully (accuracy: ${result.performance.accuracy.toFixed(3)})`
          : `Model trained successfully but not deployed (accuracy: ${result.performance.accuracy.toFixed(3)})`
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        type: 'model-training-error'
      };
    }
  }

  async getWorkflowMetrics(options = {}) {
    try {
      const templateMetrics = this.templateEngine.getMetrics();
      const workflowMetrics = this.workflowEngine.getMetrics();
      const classificationMetrics = this.classificationEngine.getMetrics();

      const combinedMetrics = {
        templates: {
          created: templateMetrics.templatesCreated,
          applied: templateMetrics.templatesApplied,
          cacheHitRatio: templateMetrics.cacheStats.hitRatio,
          validationErrors: templateMetrics.validationErrors
        },
        workflows: {
          executed: workflowMetrics.workflowsExecuted,
          stateTransitions: workflowMetrics.stateTransitions,
          eventsProcessed: workflowMetrics.eventProcessed,
          averageExecutionTime: workflowMetrics.averageExecutionTime,
          activeWorkflows: workflowMetrics.activeWorkflows
        },
        classification: {
          performed: classificationMetrics.classificationsPerformed,
          averageConfidence: classificationMetrics.averageConfidence,
          feedbackReceived: classificationMetrics.feedbackReceived,
          modelsRetrained: classificationMetrics.modelsRetrained,
          cacheHitRatio: classificationMetrics.cacheHits / (classificationMetrics.cacheHits + classificationMetrics.cacheMisses) || 0
        }
      };

      if (options.format === 'json') {
        return {
          success: true,
          metrics: combinedMetrics
        };
      }

      return {
        success: true,
        metrics: combinedMetrics,
        formatted: this._formatMetricsAsTable(combinedMetrics)
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        type: 'metrics-error'
      };
    }
  }

  // Private helper methods

  _getDefaultFieldsForType(type) {
    const defaultFields = {
      bug: [
        { id: 'title', name: 'Title', type: 'text', required: true },
        { id: 'description', name: 'Description', type: 'textarea', required: true },
        { id: 'steps', name: 'Steps to Reproduce', type: 'textarea', required: true },
        { id: 'expected', name: 'Expected Behavior', type: 'textarea', required: true },
        { id: 'actual', name: 'Actual Behavior', type: 'textarea', required: true }
      ],
      feature: [
        { id: 'title', name: 'Title', type: 'text', required: true },
        { id: 'description', name: 'Description', type: 'textarea', required: true },
        { id: 'motivation', name: 'Motivation', type: 'textarea', required: true },
        { id: 'acceptance', name: 'Acceptance Criteria', type: 'textarea', required: true }
      ],
      epic: [
        { id: 'title', name: 'Title', type: 'text', required: true },
        { id: 'objective', name: 'Business Objective', type: 'textarea', required: true },
        { id: 'requirements', name: 'Requirements', type: 'textarea', required: true },
        { id: 'success_criteria', name: 'Success Criteria', type: 'textarea', required: true }
      ]
    };

    return defaultFields[type] || defaultFields.bug;
  }

  async _createGitHubIssue({ owner, repo, appliedTemplate, additionalLabels = [] }) {
    const title = this._extractFieldValue(appliedTemplate, 'title');
    const body = this._buildIssueBody(appliedTemplate);
    
    const issue = await this.gitHubClient.request('POST', `/repos/${owner}/${repo}/issues`, {
      title,
      body,
      labels: additionalLabels
    });

    return {
      number: issue.data.number,
      url: issue.data.html_url,
      title: issue.data.title
    };
  }

  _extractFieldValue(appliedTemplate, fieldId) {
    const field = appliedTemplate.fields.find(f => f.fieldId === fieldId);
    return field ? field.transformedValue || field.value : '';
  }

  _buildIssueBody(appliedTemplate) {
    let body = '';
    
    appliedTemplate.fields.forEach(field => {
      if (field.fieldId !== 'title' && field.value) {
        body += `## ${field.name}\n${field.transformedValue || field.value}\n\n`;
      }
    });

    body += `\n---\n*Generated using template: ${appliedTemplate.templateId}*\n`;
    
    return body;
  }

  _formatTemplatesAsTable(templates) {
    if (templates.length === 0) {
      return 'No templates found.';
    }

    const headers = ['ID', 'Name', 'Type', 'Fields', 'Created'];
    const rows = templates.map(t => [
      t.id.substring(0, 8) + '...',
      t.name,
      t.type,
      t.fields.length.toString(),
      new Date(t.metadata.createdAt).toLocaleDateString()
    ]);

    return this._createTable(headers, rows);
  }

  _formatMetricsAsTable(metrics) {
    const sections = [
      {
        title: 'Template Metrics',
        data: [
          ['Templates Created', metrics.templates.created],
          ['Templates Applied', metrics.templates.applied],
          ['Cache Hit Ratio', `${(metrics.templates.cacheHitRatio * 100).toFixed(1)}%`],
          ['Validation Errors', metrics.templates.validationErrors]
        ]
      },
      {
        title: 'Workflow Metrics',
        data: [
          ['Workflows Executed', metrics.workflows.executed],
          ['State Transitions', metrics.workflows.stateTransitions],
          ['Events Processed', metrics.workflows.eventsProcessed],
          ['Avg Execution Time', `${metrics.workflows.averageExecutionTime}ms`],
          ['Active Workflows', metrics.workflows.activeWorkflows]
        ]
      },
      {
        title: 'Classification Metrics',
        data: [
          ['Classifications Performed', metrics.classification.performed],
          ['Average Confidence', metrics.classification.averageConfidence.toFixed(3)],
          ['Feedback Received', metrics.classification.feedbackReceived],
          ['Models Retrained', metrics.classification.modelsRetrained],
          ['Cache Hit Ratio', `${(metrics.classification.cacheHitRatio * 100).toFixed(1)}%`]
        ]
      }
    ];

    let output = '';
    sections.forEach(section => {
      output += `\n${section.title}:\n`;
      output += this._createTable(['Metric', 'Value'], section.data);
      output += '\n';
    });

    return output;
  }

  _createTable(headers, rows) {
    // Simple table formatting (would use a proper table library in production)
    const colWidths = headers.map((header, i) => 
      Math.max(header.length, ...rows.map(row => String(row[i]).length))
    );

    const createRow = (data) => 
      data.map((cell, i) => String(cell).padEnd(colWidths[i])).join(' | ');

    const separator = colWidths.map(width => '-'.repeat(width)).join('-|-');

    return [
      createRow(headers),
      separator,
      ...rows.map(createRow)
    ].join('\n');
  }

  async _getStateHistory(issueId) {
    // TODO: Implement state history retrieval
    return [];
  }
}

module.exports = IssueTemplateCommands;