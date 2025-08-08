#!/usr/bin/env node

/**
 * YOLO-PRO CLI Entry Point
 */

const { program } = require('commander');
const chalk = require('chalk');
const YoloWarp = require('../src/cli/yolo-warp');
const GitHubIntegration = require('../src/github-api-integration');

program
  .name('yolo-pro')
  .description('YOLO-PRO development protocols and automation')
  .version('1.0.0');

// yolo-warp command
program
  .command('warp')
  .description('Execute complete milestone automation')
  .argument('[milestone]', 'milestone number')
  .option('--owner <owner>', 'repository owner')
  .option('--repo <repo>', 'repository name')
  .option('--token <token>', 'GitHub token')
  .action(async (milestone, options) => {
    console.log(chalk.blue('🚀 Starting YOLO-WARP automation...'));
    
    const warp = new YoloWarp(options);
    try {
      const result = await warp.executeMilestone(milestone);
      console.log(chalk.green('✅ YOLO-WARP completed successfully!'));
      console.log(result);
    } catch (error) {
      console.log(chalk.red('❌ YOLO-WARP failed:'), error.message);
      process.exit(1);
    }
  });

// GitHub integration commands
program
  .command('github')
  .description('GitHub API integration commands')
  .argument('<action>', 'action to perform')
  .option('--owner <owner>', 'repository owner')
  .option('--repo <repo>', 'repository name')
  .option('--token <token>', 'GitHub token')
  .action(async (action, options) => {
    const github = new GitHubIntegration(options);
    
    try {
      switch(action) {
        case 'status':
          const status = await github.analyzeRepository();
          console.log(chalk.blue('Repository Status:'), status);
          break;
        case 'sync':
          console.log(chalk.blue('🔄 Syncing with GitHub...'));
          await github.initialize();
          console.log(chalk.green('✅ Sync complete'));
          break;
        default:
          console.log(chalk.red('Unknown action:'), action);
      }
    } catch (error) {
      console.log(chalk.red('❌ GitHub command failed:'), error.message);
    }
  });

program.parse();