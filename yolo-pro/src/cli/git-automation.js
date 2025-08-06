const { execSync, exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

/**
 * Git automation utilities for yolo-warp workflow
 */
class GitAutomation {
  constructor({ workingDir = process.cwd(), defaultBranch = 'main', dryRun = false } = {}) {
    this.workingDir = workingDir;
    this.defaultBranch = defaultBranch;
    this.dryRun = dryRun;
    this.executionLogs = [];
  }

  /**
   * Execute git command with logging and error handling
   */
  async executeGitCommand(command, options = {}) {
    const fullCommand = `git ${command}`;
    
    this.log(`Executing: ${fullCommand}`, 'debug');

    if (this.dryRun) {
      this.log(`[DRY RUN] Would execute: ${fullCommand}`, 'info');
      return { stdout: '[DRY RUN] Command not executed', stderr: '' };
    }

    try {
      const result = await execAsync(fullCommand, {
        cwd: this.workingDir,
        ...options,
      });

      this.log(`Git command successful: ${command}`, 'success');
      return result;
    } catch (error) {
      this.log(`Git command failed: ${command} - ${error.message}`, 'error');
      throw new Error(`Git command failed: ${error.message}`);
    }
  }

  /**
   * Get current branch name
   */
  async getCurrentBranch() {
    try {
      const result = await this.executeGitCommand('branch --show-current');
      return result.stdout.trim();
    } catch (error) {
      // Fallback for older git versions
      try {
        const result = await this.executeGitCommand('rev-parse --abbrev-ref HEAD');
        return result.stdout.trim();
      } catch (fallbackError) {
        throw new Error('Unable to determine current branch');
      }
    }
  }

  /**
   * Check if repository is clean (no uncommitted changes)
   */
  async isRepoClean() {
    try {
      const result = await this.executeGitCommand('status --porcelain');
      return result.stdout.trim().length === 0;
    } catch (error) {
      throw new Error(`Failed to check repository status: ${error.message}`);
    }
  }

  /**
   * Get repository status
   */
  async getRepoStatus() {
    try {
      const statusResult = await this.executeGitCommand('status --porcelain');
      const branchResult = await this.executeGitCommand('branch --show-current');
      
      const changes = statusResult.stdout.trim().split('\n').filter(line => line.length > 0);
      
      return {
        currentBranch: branchResult.stdout.trim(),
        clean: changes.length === 0,
        changes: changes.map(line => ({
          status: line.substring(0, 2),
          file: line.substring(3),
        })),
        totalChanges: changes.length,
      };
    } catch (error) {
      throw new Error(`Failed to get repository status: ${error.message}`);
    }
  }

  /**
   * Create a feature branch for milestone work
   */
  async createFeatureBranch(milestoneTitle, milestoneNumber = null) {
    try {
      // Ensure we're on the default branch and it's up to date
      await this.switchToBranch(this.defaultBranch);
      await this.pullLatest();

      // Generate branch name
      const sanitizedTitle = milestoneTitle
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 50);
      
      const branchName = milestoneNumber 
        ? `milestone-${milestoneNumber}-${sanitizedTitle}`
        : `milestone-${sanitizedTitle}`;

      this.log(`Creating feature branch: ${branchName}`, 'info');

      // Check if branch already exists
      try {
        await this.executeGitCommand(`show-ref --verify refs/heads/${branchName}`);
        this.log(`Branch ${branchName} already exists, switching to it`, 'warning');
        await this.switchToBranch(branchName);
        return branchName;
      } catch (error) {
        // Branch doesn't exist, create it
      }

      await this.executeGitCommand(`checkout -b ${branchName}`);
      
      this.log(`Feature branch ${branchName} created successfully`, 'success');
      return branchName;
    } catch (error) {
      throw new Error(`Failed to create feature branch: ${error.message}`);
    }
  }

  /**
   * Switch to specified branch
   */
  async switchToBranch(branchName) {
    try {
      this.log(`Switching to branch: ${branchName}`, 'info');
      await this.executeGitCommand(`checkout ${branchName}`);
      this.log(`Successfully switched to branch: ${branchName}`, 'success');
      return true;
    } catch (error) {
      throw new Error(`Failed to switch to branch ${branchName}: ${error.message}`);
    }
  }

  /**
   * Pull latest changes from remote
   */
  async pullLatest(branch = null) {
    try {
      const targetBranch = branch || await this.getCurrentBranch();
      this.log(`Pulling latest changes for branch: ${targetBranch}`, 'info');
      
      await this.executeGitCommand(`pull origin ${targetBranch}`);
      this.log(`Successfully pulled latest changes`, 'success');
      return true;
    } catch (error) {
      // If pull fails, it might be a new branch - that's okay
      if (error.message.includes('no tracking information')) {
        this.log('Branch has no tracking information, skipping pull', 'warning');
        return true;
      }
      throw new Error(`Failed to pull latest changes: ${error.message}`);
    }
  }

  /**
   * Stage all changes
   */
  async stageAllChanges() {
    try {
      this.log('Staging all changes', 'info');
      await this.executeGitCommand('add -A');
      this.log('Successfully staged all changes', 'success');
      return true;
    } catch (error) {
      throw new Error(`Failed to stage changes: ${error.message}`);
    }
  }

  /**
   * Commit changes with a message
   */
  async commitChanges(message, options = {}) {
    try {
      // Check if there are changes to commit
      const isClean = await this.isRepoClean();
      if (isClean) {
        this.log('No changes to commit', 'warning');
        return { noChanges: true };
      }

      // Stage changes unless specifically told not to
      if (options.skipStaging !== true) {
        await this.stageAllChanges();
      }

      // Commit with message
      const escapedMessage = message.replace(/"/g, '\\"');
      await this.executeGitCommand(`commit -m "${escapedMessage}"`);
      
      this.log(`Successfully committed changes: ${message}`, 'success');
      return { committed: true, message };
    } catch (error) {
      throw new Error(`Failed to commit changes: ${error.message}`);
    }
  }

  /**
   * Push branch to remote
   */
  async pushBranch(branchName = null, setUpstream = false) {
    try {
      const targetBranch = branchName || await this.getCurrentBranch();
      
      let pushCommand = `push origin ${targetBranch}`;
      if (setUpstream) {
        pushCommand = `push -u origin ${targetBranch}`;
      }

      this.log(`Pushing branch: ${targetBranch}`, 'info');
      await this.executeGitCommand(pushCommand);
      
      this.log(`Successfully pushed branch: ${targetBranch}`, 'success');
      return { pushed: true, branch: targetBranch };
    } catch (error) {
      throw new Error(`Failed to push branch: ${error.message}`);
    }
  }

  /**
   * Merge branch into target (usually main)
   */
  async mergeBranch(sourceBranch, targetBranch = null) {
    try {
      const target = targetBranch || this.defaultBranch;
      
      this.log(`Merging ${sourceBranch} into ${target}`, 'info');

      // Switch to target branch
      await this.switchToBranch(target);
      
      // Pull latest changes
      await this.pullLatest(target);

      // Merge source branch
      await this.executeGitCommand(`merge --no-ff ${sourceBranch} -m "Merge ${sourceBranch} into ${target}"`);
      
      this.log(`Successfully merged ${sourceBranch} into ${target}`, 'success');
      return { merged: true, source: sourceBranch, target };
    } catch (error) {
      // Handle merge conflicts
      if (error.message.includes('CONFLICT')) {
        this.log(`Merge conflict detected between ${sourceBranch} and ${targetBranch}`, 'error');
        throw new Error(`Merge conflict detected. Please resolve conflicts manually.`);
      }
      throw new Error(`Failed to merge branch: ${error.message}`);
    }
  }

  /**
   * Clean up feature branch after successful merge
   */
  async cleanupBranch(branchName, deleteRemote = true) {
    try {
      this.log(`Cleaning up branch: ${branchName}`, 'info');

      // Ensure we're not on the branch we want to delete
      const currentBranch = await this.getCurrentBranch();
      if (currentBranch === branchName) {
        await this.switchToBranch(this.defaultBranch);
      }

      // Delete local branch
      await this.executeGitCommand(`branch -D ${branchName}`);
      this.log(`Deleted local branch: ${branchName}`, 'success');

      // Delete remote branch if requested
      if (deleteRemote) {
        try {
          await this.executeGitCommand(`push origin --delete ${branchName}`);
          this.log(`Deleted remote branch: ${branchName}`, 'success');
        } catch (error) {
          this.log(`Failed to delete remote branch (may not exist): ${error.message}`, 'warning');
        }
      }

      return { cleaned: true, branch: branchName };
    } catch (error) {
      throw new Error(`Failed to cleanup branch: ${error.message}`);
    }
  }

  /**
   * Create and push a tag
   */
  async createTag(tagName, message = null) {
    try {
      const tagMessage = message || `Tag: ${tagName}`;
      
      this.log(`Creating tag: ${tagName}`, 'info');
      await this.executeGitCommand(`tag -a ${tagName} -m "${tagMessage}"`);
      
      this.log(`Pushing tag: ${tagName}`, 'info');
      await this.executeGitCommand(`push origin ${tagName}`);
      
      this.log(`Successfully created and pushed tag: ${tagName}`, 'success');
      return { created: true, tag: tagName };
    } catch (error) {
      throw new Error(`Failed to create tag: ${error.message}`);
    }
  }

  /**
   * Get commit history for branch
   */
  async getCommitHistory(branchName = null, limit = 10) {
    try {
      const branch = branchName || await this.getCurrentBranch();
      const format = '--pretty=format:"%H|%an|%ae|%ad|%s" --date=iso';
      
      const result = await this.executeGitCommand(`log ${branch} ${format} -${limit}`);
      
      const commits = result.stdout.trim().split('\n').map(line => {
        const [hash, author, email, date, subject] = line.replace(/"/g, '').split('|');
        return { hash, author, email, date, subject };
      });

      return commits;
    } catch (error) {
      throw new Error(`Failed to get commit history: ${error.message}`);
    }
  }

  /**
   * Check if there are any merge conflicts
   */
  async hasConflicts() {
    try {
      const result = await this.executeGitCommand('diff --name-only --diff-filter=U');
      return result.stdout.trim().length > 0;
    } catch (error) {
      return false; // If command fails, assume no conflicts
    }
  }

  /**
   * Get list of conflicted files
   */
  async getConflictedFiles() {
    try {
      const result = await this.executeGitCommand('diff --name-only --diff-filter=U');
      return result.stdout.trim().split('\n').filter(file => file.length > 0);
    } catch (error) {
      return [];
    }
  }

  /**
   * Abort merge in case of conflicts
   */
  async abortMerge() {
    try {
      await this.executeGitCommand('merge --abort');
      this.log('Merge aborted successfully', 'info');
      return true;
    } catch (error) {
      throw new Error(`Failed to abort merge: ${error.message}`);
    }
  }

  /**
   * Create a backup branch before risky operations
   */
  async createBackupBranch(suffix = 'backup') {
    try {
      const currentBranch = await this.getCurrentBranch();
      const backupBranch = `${currentBranch}-${suffix}-${Date.now()}`;
      
      await this.executeGitCommand(`checkout -b ${backupBranch}`);
      await this.switchToBranch(currentBranch);
      
      this.log(`Created backup branch: ${backupBranch}`, 'success');
      return backupBranch;
    } catch (error) {
      throw new Error(`Failed to create backup branch: ${error.message}`);
    }
  }

  /**
   * Validate repository state before operations
   */
  async validateRepoState() {
    try {
      // Check if we're in a git repository
      await this.executeGitCommand('rev-parse --git-dir');
      
      // Check for basic git configuration
      const configResult = await this.executeGitCommand('config --list');
      const hasUserName = configResult.stdout.includes('user.name');
      const hasUserEmail = configResult.stdout.includes('user.email');
      
      if (!hasUserName || !hasUserEmail) {
        throw new Error('Git user configuration missing. Please set user.name and user.email.');
      }

      // Check if remote exists
      try {
        await this.executeGitCommand('remote get-url origin');
      } catch (error) {
        this.log('No remote origin configured', 'warning');
      }

      return {
        valid: true,
        hasRemote: true,
        configured: hasUserName && hasUserEmail,
      };
    } catch (error) {
      throw new Error(`Repository validation failed: ${error.message}`);
    }
  }

  /**
   * Logging utility
   */
  log(message, level = 'info') {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      component: 'GitAutomation',
    };

    this.executionLogs.push(logEntry);

    // Keep only last 500 log entries
    if (this.executionLogs.length > 500) {
      this.executionLogs = this.executionLogs.slice(-500);
    }

    // Console output for development
    const colors = {
      error: '\x1b[31m',
      warning: '\x1b[33m',
      success: '\x1b[32m',
      info: '\x1b[36m',
      debug: '\x1b[90m',
      reset: '\x1b[0m',
    };

    console.log(`${colors[level] || colors.info}[GitAutomation] ${message}${colors.reset}`);
  }

  /**
   * Get execution logs
   */
  getExecutionLogs(level = null, limit = null) {
    let logs = [...this.executionLogs];

    if (level) {
      logs = logs.filter(log => log.level === level);
    }

    if (limit) {
      logs = logs.slice(-limit);
    }

    return logs;
  }

  /**
   * Clear execution logs
   */
  clearLogs() {
    this.executionLogs = [];
  }

  /**
   * Set dry run mode
   */
  setDryRun(dryRun = true) {
    this.dryRun = dryRun;
    this.log(`Dry run mode ${dryRun ? 'enabled' : 'disabled'}`, 'info');
  }
}

module.exports = GitAutomation;