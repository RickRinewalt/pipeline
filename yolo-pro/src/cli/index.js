#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const YoloWarp = require('./yolo-warp');
const GitHubClient = require('./github-client');
const SwarmManager = require('./swarm-manager');
const GitAutomation = require('./git-automation');

/**
 * YOLO-PRO CLI - Main entry point for all commands
 * 
 * This CLI provides comprehensive automation tools for development workflows,
 * with the flagship yolo-warp command for complete milestone automation.
 */

const program = new Command();

// Global CLI configuration
program
  .name('yolo-pro')
  .description('🚀 YOLO-PRO: Complete automation workflows for development')
  .version('2.0.0')
  .option('-v, --verbose', 'Enable verbose output')
  .option('-d, --dry-run', 'Run in dry-run mode (no actual changes)')
  .option('--no-color', 'Disable colored output');

// Configure colors
if (program.opts().noColor) {
  chalk.level = 0;
}

/**
 * YOLO-WARP Command - Complete milestone automation
 */
program
  .command('warp')
  .alias('yolo-warp')
  .description('🎯 Complete automation workflow for milestone completion')
  .argument('<milestone>', 'Milestone number to process')
  .option('-o, --owner <owner>', 'GitHub repository owner')
  .option('-r, --repo <repo>', 'GitHub repository name')
  .option('-t, --token <token>', 'GitHub personal access token')
  .option('-w, --working-dir <dir>', 'Working directory', process.cwd())
  .option('--no-parallel', 'Disable parallel issue processing')
  .option('--max-retries <count>', 'Maximum retry attempts', '3')
  .option('--swarm-timeout <ms>', 'Swarm operation timeout in milliseconds', '300000')
  .option('--base-branch <branch>', 'Base branch for feature branch', 'main')
  .action(async (milestone, options) => {
    try {
      console.log(chalk.blue.bold('🚀 YOLO-WARP: Complete Milestone Automation\n'));

      // Validate required parameters
      const config = await validateWarpConfig(milestone, options);
      
      if (options.verbose) {
        console.log(chalk.gray('Configuration:'));
        console.log(chalk.gray(`  Milestone: #${milestone}`));
        console.log(chalk.gray(`  Repository: ${config.owner}/${config.repo}`));
        console.log(chalk.gray(`  Working Directory: ${config.workingDir}`));
        console.log(chalk.gray(`  Dry Run: ${config.dryRun ? 'Yes' : 'No'}\n`));
      }

      // Initialize YOLO-WARP
      const yoloWarp = new YoloWarp({
        owner: config.owner,
        repo: config.repo,
        token: config.token,
        workingDir: config.workingDir,
        options: {
          dryRun: config.dryRun,
          verbose: config.verbose,
          parallel: config.parallel,
          maxRetries: parseInt(config.maxRetries),
          swarmTimeout: parseInt(config.swarmTimeout),
        },
      });

      // Execute milestone automation
      console.log(chalk.yellow('🎯 Starting milestone automation...\n'));
      
      const startTime = Date.now();
      const result = await yoloWarp.executeMilestone(parseInt(milestone));
      const endTime = Date.now();

      // Display results
      if (result.success) {
        console.log(chalk.green.bold('✅ YOLO-WARP execution completed successfully!\n'));
        
        console.log(chalk.white('📊 Execution Summary:'));
        console.log(chalk.white(`  • Total Time: ${Math.floor((endTime - startTime) / 1000)}s`));
        console.log(chalk.white(`  • Milestone: #${milestone} - ${result.milestone.title}`));
        
        if (result.processingResults) {
          const { successful, failed, skipped } = result.processingResults;
          console.log(chalk.white(`  • Issues Processed: ${successful.length + failed.length + skipped.length}`));
          console.log(chalk.green(`    ✓ Successful: ${successful.length}`));
          
          if (failed.length > 0) {
            console.log(chalk.red(`    ✗ Failed: ${failed.length}`));
          }
          
          if (skipped.length > 0) {
            console.log(chalk.yellow(`    ⊝ Skipped: ${skipped.length}`));
          }
        }

        if (result.featureBranch) {
          console.log(chalk.white(`  • Feature Branch: ${result.featureBranch}`));
        }

        if (result.swarmId) {
          console.log(chalk.white(`  • Swarm ID: ${result.swarmId}`));
        }

        console.log(chalk.blue('\n📋 Next Steps:'));
        console.log(chalk.blue('  1. Review automated implementations'));
        console.log(chalk.blue('  2. Run integration tests'));
        console.log(chalk.blue('  3. Merge pull request'));
        console.log(chalk.blue('  4. Celebrate! 🎉'));

      } else {
        console.log(chalk.red.bold('❌ YOLO-WARP execution failed\n'));
        console.log(chalk.red(`Error: ${result.error}`));
        
        if (result.partialResults) {
          console.log(chalk.yellow('\n⚠️  Some issues may have been partially processed.'));
          console.log(chalk.yellow('Check the repository for any committed changes.'));
        }

        process.exit(1);
      }

    } catch (error) {
      console.error(chalk.red.bold('💥 Fatal Error:'), error.message);
      
      if (options.verbose) {
        console.error(chalk.red('\nStack Trace:'));
        console.error(chalk.gray(error.stack));
      }
      
      process.exit(1);
    }
  });

/**
 * GitHub Status Command - Check GitHub connectivity and permissions
 */
program
  .command('github-status')
  .description('🔗 Check GitHub connectivity and repository permissions')
  .option('-o, --owner <owner>', 'GitHub repository owner')
  .option('-r, --repo <repo>', 'GitHub repository name')
  .option('-t, --token <token>', 'GitHub personal access token')
  .action(async (options) => {
    try {
      console.log(chalk.blue.bold('🔗 Checking GitHub Status\n'));

      const config = await getGitHubConfig(options);
      const github = new GitHubClient(config);

      console.log(chalk.yellow('Validating GitHub permissions...'));
      const permissions = await github.validatePermissions();

      console.log(chalk.white('\n📊 GitHub Status:'));
      console.log(chalk.white(`  Repository: ${config.owner}/${config.repo}`));
      console.log(permissions.read ? chalk.green('  ✓ Read Access: Available') : chalk.red('  ✗ Read Access: Denied'));
      console.log(permissions.write ? chalk.green('  ✓ Write Access: Available') : chalk.red('  ✗ Write Access: Denied'));

      if (permissions.error) {
        console.log(chalk.red(`\n❌ Error: ${permissions.error}`));
      }

      if (permissions.read && permissions.write) {
        console.log(chalk.green.bold('\n✅ GitHub configuration is ready for YOLO-WARP!'));
      } else {
        console.log(chalk.red.bold('\n❌ GitHub configuration issues detected'));
        console.log(chalk.yellow('\nTroubleshooting:'));
        console.log(chalk.yellow('• Verify your GitHub token has the required scopes'));
        console.log(chalk.yellow('• Ensure you have write access to the repository'));
        console.log(chalk.yellow('• Check that the repository owner and name are correct'));
      }

    } catch (error) {
      console.error(chalk.red.bold('💥 GitHub Status Check Failed:'), error.message);
      process.exit(1);
    }
  });

/**
 * Repository Analysis Command - Analyze repository for YOLO-WARP readiness
 */
program
  .command('analyze')
  .description('🔍 Analyze repository structure and readiness for automation')
  .option('-o, --owner <owner>', 'GitHub repository owner')
  .option('-r, --repo <repo>', 'GitHub repository name')
  .option('-t, --token <token>', 'GitHub personal access token')
  .option('-w, --working-dir <dir>', 'Working directory', process.cwd())
  .action(async (options) => {
    try {
      console.log(chalk.blue.bold('🔍 Repository Analysis\n'));

      const config = await getGitHubConfig(options);
      const github = new GitHubClient(config);
      const git = new GitAutomation({ workingDir: options.workingDir || process.cwd() });

      console.log(chalk.yellow('Analyzing repository...'));

      // Git analysis
      console.log(chalk.white('\n📁 Git Repository:'));
      try {
        await git.validateRepoState();
        const status = await git.getRepoStatus();
        console.log(chalk.green('  ✓ Valid Git repository'));
        console.log(chalk.white(`  • Current Branch: ${status.currentBranch}`));
        console.log(status.clean ? chalk.green('  ✓ Clean working directory') : chalk.yellow(`  ⚠ ${status.totalChanges} uncommitted changes`));
      } catch (gitError) {
        console.log(chalk.red('  ✗ Git repository issues'));
        console.log(chalk.red(`    Error: ${gitError.message}`));
      }

      // GitHub analysis
      console.log(chalk.white('\n🐙 GitHub Repository:'));
      try {
        const repo = await github.getRepository();
        console.log(chalk.green('  ✓ Repository accessible'));
        console.log(chalk.white(`  • Name: ${repo.full_name}`));
        console.log(chalk.white(`  • Default Branch: ${repo.default_branch}`));
        console.log(chalk.white(`  • Open Issues: ${repo.open_issues_count}`));
        
        if (repo.has_issues) {
          console.log(chalk.green('  ✓ Issues enabled'));
        } else {
          console.log(chalk.red('  ✗ Issues disabled - required for YOLO-WARP'));
        }
      } catch (repoError) {
        console.log(chalk.red('  ✗ Repository access issues'));
        console.log(chalk.red(`    Error: ${repoError.message}`));
      }

      // Milestone analysis
      console.log(chalk.white('\n🎯 Milestones:'));
      try {
        // This would need to be implemented in GitHubClient
        console.log(chalk.gray('  • Milestone analysis coming soon...'));
      } catch (milestoneError) {
        console.log(chalk.yellow('  ⚠ Could not analyze milestones'));
      }

      console.log(chalk.blue.bold('\n✅ Repository analysis complete!'));

    } catch (error) {
      console.error(chalk.red.bold('💥 Repository Analysis Failed:'), error.message);
      process.exit(1);
    }
  });

/**
 * Swarm Test Command - Test swarm functionality
 */
program
  .command('test-swarm')
  .description('🤖 Test swarm orchestration functionality')
  .option('--topology <type>', 'Swarm topology (mesh, hierarchical, star)', 'mesh')
  .option('--agents <count>', 'Number of agents to spawn', '3')
  .option('--timeout <ms>', 'Test timeout in milliseconds', '60000')
  .action(async (options) => {
    try {
      console.log(chalk.blue.bold('🤖 Testing Swarm Orchestration\n'));

      const swarm = new SwarmManager({ timeout: parseInt(options.timeout) });

      console.log(chalk.yellow('Initializing test swarm...'));
      const swarmResult = await swarm.initializeSwarm({
        topology: options.topology,
        maxAgents: parseInt(options.agents),
        strategy: 'adaptive',
      });

      console.log(chalk.green(`✓ Swarm ${swarmResult.swarmId} initialized`));

      console.log(chalk.yellow('Spawning agents...'));
      const agentConfigs = [
        { type: 'researcher', capabilities: ['analysis'] },
        { type: 'coder', capabilities: ['implementation'] },
        { type: 'tester', capabilities: ['validation'] },
      ].slice(0, parseInt(options.agents));

      const agents = await swarm.spawnAgents(swarmResult.swarmId, agentConfigs);
      console.log(chalk.green(`✓ Spawned ${agents.length} agents`));

      console.log(chalk.yellow('Testing task orchestration...'));
      const taskResult = await swarm.orchestrateTask(swarmResult.swarmId, {
        description: 'Test task: Analyze a simple function and suggest improvements',
        priority: 'medium',
        strategy: 'adaptive',
      });

      if (taskResult.success) {
        console.log(chalk.green('✓ Task orchestration successful'));
        console.log(chalk.white(`  • Execution Time: ${taskResult.executionTime}ms`));
        console.log(chalk.white(`  • Assigned Agents: ${taskResult.assignedAgents?.length || 0}`));
      } else {
        console.log(chalk.red('✗ Task orchestration failed'));
      }

      console.log(chalk.yellow('Cleaning up swarm...'));
      await swarm.destroySwarm(swarmResult.swarmId);
      console.log(chalk.green('✓ Swarm cleanup complete'));

      console.log(chalk.blue.bold('\n✅ Swarm test completed successfully!'));

    } catch (error) {
      console.error(chalk.red.bold('💥 Swarm Test Failed:'), error.message);
      process.exit(1);
    }
  });

/**
 * Configuration Commands
 */
const configCmd = program
  .command('config')
  .description('⚙️  Configuration management');

configCmd
  .command('init')
  .description('Initialize YOLO-PRO configuration')
  .action(async () => {
    console.log(chalk.blue.bold('⚙️  Initializing YOLO-PRO Configuration\n'));
    console.log(chalk.yellow('Configuration initialization coming soon...'));
    console.log(chalk.gray('This will create a .yolo-pro.json config file'));
  });

configCmd
  .command('show')
  .description('Show current configuration')
  .action(async () => {
    console.log(chalk.blue.bold('⚙️  Current Configuration\n'));
    console.log(chalk.yellow('Configuration display coming soon...'));
  });

/**
 * Utility Functions
 */

async function validateWarpConfig(milestone, options) {
  // Get configuration from options, environment, or prompt
  const config = {
    milestone,
    owner: options.owner || process.env.GITHUB_OWNER,
    repo: options.repo || process.env.GITHUB_REPO,
    token: options.token || process.env.GITHUB_TOKEN,
    workingDir: options.workingDir || process.cwd(),
    dryRun: options.dryRun || false,
    verbose: options.verbose || false,
    parallel: options.parallel !== false,
    maxRetries: options.maxRetries || '3',
    swarmTimeout: options.swarmTimeout || '300000',
  };

  // Validate required fields
  const required = ['owner', 'repo', 'token'];
  const missing = required.filter(field => !config[field]);
  
  if (missing.length > 0) {
    console.error(chalk.red.bold('❌ Missing Required Configuration:'));
    for (const field of missing) {
      console.error(chalk.red(`  • ${field}: Use --${field} option or GITHUB_${field.toUpperCase()} environment variable`));
    }
    
    console.log(chalk.yellow('\nExample:'));
    console.log(chalk.gray('  yolo-pro warp 1 --owner myuser --repo myrepo --token ghp_xxx'));
    console.log(chalk.gray('  export GITHUB_TOKEN=ghp_xxx && yolo-pro warp 1 --owner myuser --repo myrepo'));
    
    process.exit(1);
  }

  // Validate milestone number
  const milestoneNum = parseInt(milestone);
  if (isNaN(milestoneNum) || milestoneNum <= 0) {
    console.error(chalk.red.bold('❌ Invalid milestone number:'), milestone);
    console.error(chalk.red('Milestone must be a positive integer'));
    process.exit(1);
  }

  return config;
}

async function getGitHubConfig(options) {
  const config = {
    owner: options.owner || process.env.GITHUB_OWNER,
    repo: options.repo || process.env.GITHUB_REPO,
    token: options.token || process.env.GITHUB_TOKEN,
  };

  const required = ['owner', 'repo', 'token'];
  const missing = required.filter(field => !config[field]);
  
  if (missing.length > 0) {
    console.error(chalk.red.bold('❌ Missing Required GitHub Configuration:'));
    for (const field of missing) {
      console.error(chalk.red(`  • ${field}: Use --${field} option or GITHUB_${field.toUpperCase()} environment variable`));
    }
    process.exit(1);
  }

  return config;
}

// Error handling for unhandled promises
process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red.bold('💥 Unhandled Promise Rejection:'));
  console.error(chalk.red(reason));
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n🛑 Interrupted by user'));
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log(chalk.yellow('\n🛑 Terminated'));
  process.exit(0);
});

// Parse command line arguments
program.parse();

// If no command provided, show help
if (!process.argv.slice(2).length) {
  console.log(chalk.blue.bold('🚀 YOLO-PRO: Complete Automation Workflows\n'));
  program.outputHelp();
  console.log(chalk.gray('\nExamples:'));
  console.log(chalk.gray('  yolo-pro warp 1 --owner myuser --repo myrepo --token ghp_xxx'));
  console.log(chalk.gray('  yolo-pro github-status --owner myuser --repo myrepo --token ghp_xxx'));
  console.log(chalk.gray('  yolo-pro test-swarm --topology hierarchical --agents 5'));
  console.log(chalk.gray('\nFor detailed help on any command:'));
  console.log(chalk.gray('  yolo-pro <command> --help'));
  console.log('');
}