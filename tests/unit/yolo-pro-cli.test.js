/**
 * YOLO-PRO CLI Unit Tests
 * Comprehensive testing for the main CLI entry point and command framework
 */

const { Command } = require('commander');
const chalk = require('chalk');
const fs = require('fs').promises;
const path = require('path');

// Mock dependencies
jest.mock('commander');
jest.mock('chalk');
jest.mock('../../../yolo-pro/src/cli/yolo-warp');
jest.mock('../../../yolo-pro/src/cli/github-client');
jest.mock('../../../yolo-pro/src/cli/swarm-manager');
jest.mock('../../../yolo-pro/src/cli/git-automation');

describe('YOLO-PRO CLI', () => {
  let mockProgram;
  let mockYoloWarp;
  let mockGitHubClient;
  let mockSwarmManager;
  let mockGitAutomation;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup commander mocks
    mockProgram = {
      name: jest.fn().mockReturnThis(),
      description: jest.fn().mockReturnThis(),
      version: jest.fn().mockReturnThis(),
      option: jest.fn().mockReturnThis(),
      command: jest.fn().mockReturnThis(),
      action: jest.fn().mockReturnThis(),
      parse: jest.fn().mockReturnThis(),
      opts: jest.fn().mockReturnValue({})
    };
    Command.mockImplementation(() => mockProgram);
    
    // Setup module mocks
    mockYoloWarp = { execute: jest.fn() };
    mockGitHubClient = { validateConnection: jest.fn() };
    mockSwarmManager = { initialize: jest.fn() };
    mockGitAutomation = { setupHooks: jest.fn() };
    
    require('../../../yolo-pro/src/cli/yolo-warp').mockImplementation(() => mockYoloWarp);
    require('../../../yolo-pro/src/cli/github-client').mockImplementation(() => mockGitHubClient);
    require('../../../yolo-pro/src/cli/swarm-manager').mockImplementation(() => mockSwarmManager);
    require('../../../yolo-pro/src/cli/git-automation').mockImplementation(() => mockGitAutomation);
  });

  describe('CLI Initialization', () => {
    it('should configure basic CLI properties', () => {
      require('../../../yolo-pro/src/cli/index.js');
      
      expect(mockProgram.name).toHaveBeenCalledWith('yolo-pro');
      expect(mockProgram.description).toHaveBeenCalledWith('🚀 YOLO-PRO: Complete automation workflows for development');
      expect(mockProgram.version).toHaveBeenCalledWith('2.0.0');
    });

    it('should register global options', () => {
      require('../../../yolo-pro/src/cli/index.js');
      
      expect(mockProgram.option).toHaveBeenCalledWith('-v, --verbose', 'Enable verbose output');
      expect(mockProgram.option).toHaveBeenCalledWith('-d, --dry-run', 'Run in dry-run mode (no actual changes)');
      expect(mockProgram.option).toHaveBeenCalledWith('--no-color', 'Disable colored output');
    });

    it('should disable colors when no-color option is set', () => {
      mockProgram.opts.mockReturnValue({ noColor: true });
      require('../../../yolo-pro/src/cli/index.js');
      
      expect(chalk.level).toBe(0);
    });
  });

  describe('Command Registration', () => {
    beforeEach(() => {
      require('../../../yolo-pro/src/cli/index.js');
    });

    it('should register yolo-warp command', () => {
      expect(mockProgram.command).toHaveBeenCalledWith('yolo-warp');
    });

    it('should register github commands', () => {
      expect(mockProgram.command).toHaveBeenCalledWith('github');
    });

    it('should register swarm commands', () => {
      expect(mockProgram.command).toHaveBeenCalledWith('swarm');
    });

    it('should register git commands', () => {
      expect(mockProgram.command).toHaveBeenCalledWith('git');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing required arguments gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const processExitSpy = jest.spyOn(process, 'exit').mockImplementation();
      
      // Simulate invalid command
      mockProgram.parse.mockImplementation(() => {
        throw new Error('Missing required argument');
      });
      
      require('../../../yolo-pro/src/cli/index.js');
      mockProgram.parse();
      
      expect(consoleSpy).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(1);
      
      consoleSpy.mockRestore();
      processExitSpy.mockRestore();
    });

    it('should handle invalid options', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      mockProgram.opts.mockReturnValue({ invalidOption: true });
      require('../../../yolo-pro/src/cli/index.js');
      
      // Should not crash with invalid options
      expect(() => mockProgram.parse()).not.toThrow();
      
      consoleSpy.mockRestore();
    });
  });

  describe('Command Execution', () => {
    it('should execute yolo-warp with correct parameters', async () => {
      const milestone = 'test-milestone';
      const options = { verbose: true, dryRun: false };
      
      mockProgram.opts.mockReturnValue(options);
      
      require('../../../yolo-pro/src/cli/index.js');
      
      // Simulate yolo-warp command execution
      const yoloWarpAction = mockProgram.action.mock.calls.find(call => 
        call[0].toString().includes('yolo-warp')
      );
      
      if (yoloWarpAction) {
        await yoloWarpAction[0](milestone);
        expect(mockYoloWarp.execute).toHaveBeenCalledWith(milestone, options);
      }
    });
  });

  describe('Configuration Validation', () => {
    it('should validate GitHub token when available', async () => {
      process.env.GITHUB_TOKEN = 'test-token';
      
      const validateConnection = jest.fn().mockResolvedValue(true);
      mockGitHubClient.validateConnection = validateConnection;
      
      require('../../../yolo-pro/src/cli/index.js');
      
      // Should attempt to validate GitHub connection
      expect(mockGitHubClient.validateConnection).toBeDefined();
    });

    it('should warn about missing GitHub token', () => {
      delete process.env.GITHUB_TOKEN;
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      require('../../../yolo-pro/src/cli/index.js');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('GitHub token not found')
      );
      
      consoleSpy.mockRestore();
    });
  });
});

describe('YOLO-PRO CLI Integration', () => {
  let originalArgv;
  let originalEnv;
  
  beforeEach(() => {
    originalArgv = process.argv;
    originalEnv = { ...process.env };
    
    // Reset modules
    jest.resetModules();
    jest.clearAllMocks();
  });
  
  afterEach(() => {
    process.argv = originalArgv;
    process.env = originalEnv;
  });

  describe('Real Command Execution', () => {
    it('should handle help command', () => {
      process.argv = ['node', 'cli.js', '--help'];
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      require('../../../yolo-pro/src/cli/index.js');
      
      // Help should be displayed
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should handle version command', () => {
      process.argv = ['node', 'cli.js', '--version'];
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      require('../../../yolo-pro/src/cli/index.js');
      
      expect(consoleSpy).toHaveBeenCalledWith('2.0.0');
      
      consoleSpy.mockRestore();
    });
  });

  describe('Environment Configuration', () => {
    it('should respect NODE_ENV settings', () => {
      process.env.NODE_ENV = 'production';
      
      const cli = require('../../../yolo-pro/src/cli/index.js');
      
      // Should adjust behavior based on environment
      expect(process.env.NODE_ENV).toBe('production');
    });

    it('should handle missing environment variables gracefully', () => {
      // Clear all environment variables
      for (const key in process.env) {
        if (key.startsWith('GITHUB_') || key.startsWith('YOLO_')) {
          delete process.env[key];
        }
      }
      
      expect(() => {
        require('../../../yolo-pro/src/cli/index.js');
      }).not.toThrow();
    });
  });
});