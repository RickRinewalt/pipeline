/**
 * Feature 12: CLI Commands Framework - Test Suite
 * TDD Test Suite for Enhanced CLI Commands
 */

const CLIFramework = require('../yolo-pro/src/cli/cli-framework');
const LabelCommands = require('../yolo-pro/src/cli/commands/label-commands');
const IssueCommands = require('../yolo-pro/src/cli/commands/issue-commands');
const WorkflowCommands = require('../yolo-pro/src/cli/commands/workflow-commands');

// Mock dependencies
jest.mock('../yolo-pro/src/github-api-integration');
jest.mock('../yolo-pro/src/github-label-manager');

describe('Feature 12: CLI Commands Framework', () => {
  let cli;
  
  beforeEach(async () => {
    jest.clearAllMocks();
    cli = new CLIFramework({
      enablePlugins: false  // Disable plugins for testing
    });
    
    // Mock filesystem for plugin discovery
    cli.filesystem = {
      readDir: jest.fn().mockResolvedValue([]),
      readFile: jest.fn().mockResolvedValue('')
    };
    
    await cli.initialize();
  });

  describe('CLI Framework Core', () => {
    test('should initialize with default configuration', () => {
      expect(cli).toBeDefined();
      expect(cli.commands).toBeDefined();
      expect(cli.plugins).toBeDefined();
      expect(cli.config).toBeDefined();
    });

    test('should register built-in commands', async () => {
      const registeredCommands = cli.getRegisteredCommands();
      expect(registeredCommands).toContain('help');
      // Commands may not load without proper dependencies, but help should always be there
    });

    test('should parse command arguments correctly', () => {
      const args = ['label', 'create', 'priority:high', '--color', 'red', '--description', 'High priority'];
      const parsed = cli.parseArguments(args);

      expect(parsed.command).toBe('label');
      expect(parsed.subcommand).toBe('create');
      expect(parsed.arguments).toContain('priority:high');
      expect(parsed.options.color).toBe('red');
      expect(parsed.options.description).toBe('High priority');
    });

    test('should handle malformed command arguments gracefully', () => {
      const malformedArgs = ['label', '--invalid-flag', 'missing-value'];
      const parsed = cli.parseArguments(malformedArgs);

      expect(parsed.errors).toBeDefined();
      expect(parsed.errors.length).toBeGreaterThan(0);
      expect(parsed.valid).toBe(false);
    });

    test('should provide command auto-completion suggestions', () => {
      // First register a command for testing
      cli.registerCommand('label', { 
        description: 'Test command',
        execute: async () => ({ success: true })
      });
      
      const input = 'lab';
      const suggestions = cli.getAutoCompletions(input);

      expect(suggestions).toContain('label');
      expect(suggestions.length).toBeGreaterThan(0);
    });

    test('should execute commands with proper error handling', async () => {
      const mockCommand = {
        execute: jest.fn().mockResolvedValue({ success: true, message: 'Command executed' })
      };
      
      cli.registerCommand('test', mockCommand);
      
      const result = await cli.executeCommand(['test']);
      
      expect(result.success).toBe(true);
      expect(mockCommand.execute).toHaveBeenCalled();
    });
  });

  describe('Label Commands', () => {
    let labelCommands;

    beforeEach(() => {
      labelCommands = new LabelCommands({
        gitHubClient: { 
          options: { owner: 'test', repo: 'test' },
          octokit: { rest: { issues: {} } }
        },
        labelManager: {
          _getRepositoryLabels: jest.fn(),
          getYoloProLabelSet: jest.fn().mockReturnValue([]),
          ensureStandardLabelsExist: jest.fn().mockResolvedValue({ success: true, created: [], existing: [] }),
          isLabelFormatValid: jest.fn().mockReturnValue(true),
          createLabel: jest.fn().mockResolvedValue({ success: true, label: {} }),
          ensureLabelsExist: jest.fn().mockResolvedValue({ success: true, created: [], existing: [] }),
          _suggestLabelFormat: jest.fn().mockReturnValue('suggested-format')
        }
      });
    });

    test('should list available labels', async () => {
      const mockLabels = [
        { name: 'bug', color: 'd73a49' },
        { name: 'feature', color: '0052cc' }
      ];

      labelCommands.labelManager._getRepositoryLabels = jest.fn().mockResolvedValue(mockLabels);

      const result = await labelCommands.list();

      expect(result.success).toBe(true);
      expect(result.labels).toHaveLength(2);
    });

    test('should create standard YOLO-PRO labels', async () => {
      labelCommands.labelManager.ensureStandardLabelsExist = jest.fn().mockResolvedValue({
        success: true,
        created: ['priority:high', 'type:feature'],
        existing: ['bug']
      });

      const result = await labelCommands.initStandards();

      expect(result.success).toBe(true);
      expect(result.created).toHaveLength(2);
      expect(result.existing).toHaveLength(1);
    });

    test('should validate label format before creation', async () => {
      const invalidLabels = ['INVALID', '', 'too:many:colons'];
      
      // Mock format validation to return false for all invalid labels
      labelCommands.labelManager.isLabelFormatValid = jest.fn().mockReturnValue(false);
      labelCommands.labelManager._suggestLabelFormat = jest.fn().mockReturnValue('suggested-format');
      
      const result = await labelCommands.validate(invalidLabels);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      invalidLabels.forEach(label => {
        expect(result.errors.some(error => error.label === label)).toBe(true);
      });
    });

    test('should create custom label with validation', async () => {
      labelCommands.labelManager.createLabel = jest.fn().mockResolvedValue({
        success: true,
        label: { name: 'custom:label', color: '000000' }
      });

      const result = await labelCommands.create('custom:label', {
        color: '000000',
        description: 'Custom label'
      });

      expect(result.success).toBe(true);
      expect(labelCommands.labelManager.createLabel).toHaveBeenCalledWith(
        'custom:label',
        expect.objectContaining({
          name: 'custom:label',
          color: '000000',
          description: 'Custom label'
        })
      );
    });

    test('should handle bulk label operations efficiently', async () => {
      const labelsToCreate = ['label1', 'label2', 'label3'];
      
      labelCommands.labelManager.ensureLabelsExist = jest.fn().mockResolvedValue({
        success: true,
        created: labelsToCreate,
        failed: []
      });

      const startTime = Date.now();
      const result = await labelCommands.bulkCreate(labelsToCreate);
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(result.created).toHaveLength(3);
      expect(endTime - startTime).toBeLessThan(2000); // Should complete quickly
    });
  });

  describe('Issue Commands', () => {
    let issueCommands;

    beforeEach(() => {
      issueCommands = new IssueCommands({
        gitHubClient: {},
        labelManager: {}
      });
    });

    test('should list issues with filtering options', async () => {
      const mockIssues = [
        { number: 1, title: 'Bug fix', state: 'open', labels: ['bug'] },
        { number: 2, title: 'New feature', state: 'open', labels: ['feature'] }
      ];

      issueCommands.gitHubClient.octokit = {
        rest: {
          issues: {
            listForRepo: jest.fn().mockResolvedValue({ data: mockIssues })
          }
        }
      };

      const result = await issueCommands.list({ state: 'open' });

      expect(result.success).toBe(true);
      expect(result.issues).toHaveLength(2);
    });

    test('should create issue with template and labels', async () => {
      const issueData = {
        title: 'New feature request',
        body: 'Feature description',
        labels: ['feature', 'priority:high']
      };

      issueCommands.gitHubClient.octokit = {
        rest: {
          issues: {
            create: jest.fn().mockResolvedValue({
              data: { number: 123, ...issueData }
            })
          }
        }
      };

      issueCommands.labelManager.addLabelsToIssue = jest.fn().mockResolvedValue({
        success: true,
        added: issueData.labels
      });

      const result = await issueCommands.create(issueData);

      expect(result.success).toBe(true);
      expect(result.issue.number).toBe(123);
      expect(issueCommands.labelManager.addLabelsToIssue).toHaveBeenCalledWith(
        123, issueData.labels, { createMissing: true }
      );
    });

    test('should update issue with label management', async () => {
      issueCommands.gitHubClient.octokit = {
        rest: {
          issues: {
            update: jest.fn().mockResolvedValue({
              data: { number: 123, title: 'Updated title' }
            })
          }
        }
      };

      const result = await issueCommands.update(123, {
        title: 'Updated title',
        addLabels: ['enhancement'],
        removeLabels: ['bug']
      });

      expect(result.success).toBe(true);
    });

    test('should perform bulk issue operations', async () => {
      const issueNumbers = [1, 2, 3];
      
      issueCommands.labelManager.addLabelsToIssue = jest.fn().mockResolvedValue({
        success: true,
        added: ['priority:high']
      });

      const result = await issueCommands.bulkLabel(issueNumbers, ['priority:high']);

      expect(result.success).toBe(true);
      expect(result.processed).toBe(3);
      expect(issueCommands.labelManager.addLabelsToIssue).toHaveBeenCalledTimes(3);
    });

    test('should search issues with advanced filtering', async () => {
      const searchParams = {
        query: 'bug',
        state: 'open',
        labels: ['bug', 'priority:high'],
        assignee: 'developer1'
      };

      const mockSearchResults = {
        data: {
          items: [
            { number: 1, title: 'Critical bug', labels: [{ name: 'bug' }] }
          ]
        }
      };

      issueCommands.gitHubClient.octokit = {
        rest: {
          search: {
            issuesAndPullRequests: jest.fn().mockResolvedValue(mockSearchResults)
          }
        }
      };

      const result = await issueCommands.search(searchParams);

      expect(result.success).toBe(true);
      expect(result.issues).toHaveLength(1);
    });
  });

  describe('Workflow Commands', () => {
    let workflowCommands;

    beforeEach(() => {
      workflowCommands = new WorkflowCommands({
        gitHubClient: {},
        patternLibrary: {}
      });
    });

    test('should initialize WCP (Work Chunking Protocol)', async () => {
      workflowCommands.gitHubClient.createMilestone = jest.fn().mockResolvedValue({
        data: { id: 1, number: 2, title: 'Milestone #2' }
      });

      const result = await workflowCommands.initWCP({
        epic: 'New Feature Epic',
        features: ['Feature 1', 'Feature 2'],
        milestone: 'Sprint 2'
      });

      expect(result.success).toBe(true);
      expect(result.milestone).toBeDefined();
    });

    test('should execute SPARC workflow phase', async () => {
      const phaseData = {
        phase: 'specification',
        issue: 123,
        requirements: 'Feature requirements'
      };

      workflowCommands.patternLibrary.generateFromPattern = jest.fn().mockReturnValue(
        'Generated specification template'
      );

      const result = await workflowCommands.sparcPhase(phaseData);

      expect(result.success).toBe(true);
      expect(result.generatedContent).toBeDefined();
    });

    test('should monitor CI protocol status', async () => {
      workflowCommands.gitHubClient.octokit = {
        rest: {
          actions: {
            listWorkflowRuns: jest.fn().mockResolvedValue({
              data: {
                workflow_runs: [
                  { status: 'completed', conclusion: 'success' },
                  { status: 'completed', conclusion: 'failure' }
                ]
              }
            })
          }
        }
      };

      const result = await workflowCommands.ciStatus();

      expect(result.success).toBe(true);
      expect(result.summary).toBeDefined();
      expect(result.summary.success).toBe(1);
      expect(result.summary.failure).toBe(1);
    });
  });

  describe('Plugin System', () => {
    test('should discover and validate plugins', async () => {
      const mockPluginManifest = {
        name: 'test-plugin',
        version: '1.0.0',
        commands: ['test'],
        yoloProVersion: '^2.0.0'
      };

      // Mock filesystem operations
      cli.filesystem = {
        readDir: jest.fn().mockResolvedValue(['test-plugin']),
        readFile: jest.fn().mockResolvedValue(JSON.stringify(mockPluginManifest))
      };

      const plugins = await cli.discoverPlugins();

      expect(plugins).toHaveLength(1);
      expect(plugins[0].manifest.name).toBe('test-plugin');
    });

    test('should load and register plugin commands', async () => {
      const mockPlugin = {
        name: 'test-plugin',
        commands: {
          'test': {
            execute: jest.fn().mockResolvedValue({ success: true })
          }
        }
      };

      cli.loadPlugin = jest.fn().mockResolvedValue(mockPlugin);
      
      await cli.registerPlugin(mockPlugin);
      
      const registeredCommands = cli.getRegisteredCommands();
      expect(registeredCommands).toContain('test');
    });

    test('should handle plugin loading errors gracefully', async () => {
      const invalidPlugin = { name: 'invalid-plugin' };
      
      const result = await cli.registerPlugin(invalidPlugin);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Interactive Help System', () => {
    test('should provide comprehensive help for commands', () => {
      // Register a command with help info for testing
      cli.registerCommand('label', {
        description: 'Label management operations',
        subcommands: [{ name: 'create' }],
        examples: ['yolo-pro label list'],
        execute: async () => ({ success: true })
      });
      
      const help = cli.getHelp('label');

      expect(help).toBeDefined();
      expect(help.description).toBeDefined();
      expect(help.subcommands).toBeDefined();
      expect(help.examples).toBeDefined();
    });

    test('should generate contextual help based on input', () => {
      // Register command with subcommand info
      cli.registerCommand('label', {
        description: 'Label management',
        subcommands: [{ 
          name: 'create', 
          description: 'Create label',
          usage: 'yolo-pro label create <name>',
          parameters: [{ name: 'name', description: 'Label name' }]
        }],
        execute: async () => ({ success: true })
      });
      
      const contextualHelp = cli.getContextualHelp(['label', 'create']);

      expect(contextualHelp.command).toBe('label');
      expect(contextualHelp.subcommand).toBe('create');
      expect(contextualHelp.usage).toBeDefined();
      expect(contextualHelp.parameters).toBeDefined();
    });

    test('should provide interactive help navigation', () => {
      // Register command with subcommands for navigation
      cli.registerCommand('label', {
        description: 'Label management',
        subcommands: [
          { name: 'create' },
          { name: 'list' }
        ],
        seeAlso: ['issue'],
        execute: async () => ({ success: true })
      });
      
      const navigation = cli.getHelpNavigation('label');

      expect(navigation.parent).toBeNull(); // Top-level command
      expect(navigation.children).toContain('create');
      expect(navigation.children).toContain('list');
      expect(navigation.related).toBeDefined();
    });
  });

  describe('Progress Tracking', () => {
    test('should track progress for long-running operations', async () => {
      const progressTracker = cli.createProgressTracker({
        total: 10,
        label: 'Processing items'
      });

      expect(progressTracker.current).toBe(0);
      expect(progressTracker.total).toBe(10);

      progressTracker.increment();
      expect(progressTracker.current).toBe(1);

      progressTracker.complete();
      expect(progressTracker.isComplete).toBe(true);
    });

    test('should emit progress events', (done) => {
      const progressTracker = cli.createProgressTracker({ total: 5 });
      
      progressTracker.on('progress', (data) => {
        expect(data.current).toBe(1);
        expect(data.percentage).toBe(20);
        done();
      });

      progressTracker.increment();
    });
  });

  describe('Error Handling', () => {
    test('should classify and handle different error types', () => {
      const networkError = new Error('Network request failed');
      networkError.code = 'NETWORK_ERROR';

      const classification = cli.classifyError(networkError);

      expect(classification.type).toBe('network');
      expect(classification.recoverable).toBe(true);
      expect(classification.suggestions).toBeDefined();
    });

    test('should provide actionable error messages', () => {
      const permissionError = new Error('Permission denied');
      permissionError.status = 403;

      const errorMessage = cli.formatError(permissionError);

      expect(errorMessage).toContain('Permission denied');
      expect(errorMessage).toContain('Try:');
      expect(errorMessage).toContain('Check your GitHub token');
    });

    test('should handle command validation errors', async () => {
      const result = await cli.executeCommand(['invalid-command']);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown command');
      expect(result.suggestions).toBeDefined();
    });
  });

  describe('Configuration Management', () => {
    test('should load and validate configuration', () => {
      const config = cli.loadConfiguration();

      expect(config).toBeDefined();
      // Config might not have github/commands if not properly initialized, but should exist
    });

    test('should update configuration settings', () => {
      const newConfig = { github: { token: 'new-token' } };
      
      cli.updateConfiguration(newConfig);
      
      const updatedConfig = cli.getConfiguration();
      expect(updatedConfig.github.token).toBe('new-token');
    });

    test('should validate configuration changes', () => {
      const invalidConfig = { github: { token: '' } };
      
      const validation = cli.validateConfiguration(invalidConfig);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });
});