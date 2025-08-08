/**
 * End-to-End User Journey Tests
 * Complete user workflow testing from CLI invocation to final deployment
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const { Octokit } = require('@octokit/rest');

describe('Complete User Journey E2E Tests', () => {
  let testWorkspace;
  let testRepo;
  let githubToken;
  let originalCwd;
  
  beforeAll(async () => {
    // Setup isolated test environment
    originalCwd = process.cwd();
    testWorkspace = path.join(__dirname, '../tmp/e2e-workspace');
    
    await fs.mkdir(testWorkspace, { recursive: true });
    process.chdir(testWorkspace);
    
    // Setup test GitHub repository (using real or mock)
    githubToken = process.env.GITHUB_TOKEN || 'mock-token';
    testRepo = process.env.TEST_REPO || 'test-user/yolo-pro-e2e-test';
    
    // Initialize git repository
    await execCommand('git init');
    await execCommand('git config user.name \"YOLO-PRO Test\"');
    await execCommand('git config user.email \"test@yolo-pro.dev\"');
  });
  
  afterAll(async () => {
    process.chdir(originalCwd);
    
    // Cleanup test workspace
    try {
      await fs.rmdir(testWorkspace, { recursive: true });
    } catch (error) {
      console.warn('Failed to cleanup E2E test workspace:', error.message);
    }
  });

  describe('Project Initialization Journey', () => {
    it('should complete full project setup workflow', async () => {
      // Step 1: User runs yolo-pro init
      const initResult = await runYoloProCommand(['init', '--name', 'e2e-test-project']);
      
      expect(initResult.exitCode).toBe(0);
      expect(initResult.stdout).toContain('Project initialized successfully');
      
      // Verify project structure was created
      const projectFiles = await fs.readdir(testWorkspace);
      expect(projectFiles).toContain('package.json');
      expect(projectFiles).toContain('src');
      expect(projectFiles).toContain('tests');
      expect(projectFiles).toContain('.yolo-pro.config.json');
      
      // Step 2: Verify configuration file
      const config = JSON.parse(
        await fs.readFile('.yolo-pro.config.json', 'utf8')
      );
      
      expect(config).toMatchObject({
        projectName: 'e2e-test-project',
        repository: expect.any(String),
        workflows: expect.any(Object)
      });
    }, 30000);

    it('should handle GitHub integration setup', async () => {
      // Step 1: Link to GitHub repository
      const linkResult = await runYoloProCommand([
        'github', 'link', 
        '--repo', testRepo,
        '--token', githubToken
      ]);
      
      expect(linkResult.exitCode).toBe(0);
      expect(linkResult.stdout).toContain('Successfully linked to GitHub');
      
      // Step 2: Verify connection
      const statusResult = await runYoloProCommand(['github', 'status']);
      
      expect(statusResult.exitCode).toBe(0);
      expect(statusResult.stdout).toContain('Connected to');
      expect(statusResult.stdout).toContain(testRepo);
    }, 15000);
  });

  describe('Feature Development Journey', () => {
    const milestoneDefinition = {
      title: 'User Authentication System',
      description: 'Complete user authentication with login, logout, and profile management',
      features: [
        {
          title: 'User Login',
          description: 'Implement user login functionality',
          tasks: [
            'Create login form component',
            'Implement authentication API',
            'Add session management',
            'Write unit tests for login'
          ]
        },
        {
          title: 'User Registration', 
          description: 'Allow new users to register',
          tasks: [
            'Create registration form',
            'Implement user validation',
            'Add email confirmation',
            'Write registration tests'
          ]
        },
        {
          title: 'User Profile',
          description: 'User profile management',
          tasks: [
            'Create profile component',
            'Implement profile editing',
            'Add avatar upload',
            'Write profile tests'
          ]
        }
      ]
    };

    beforeAll(async () => {
      // Create milestone definition file
      await fs.writeFile(
        'milestone-auth.json',
        JSON.stringify(milestoneDefinition, null, 2)
      );
    });

    it('should execute complete milestone workflow', async () => {
      // Step 1: Run yolo-warp with milestone
      const warpResult = await runYoloProCommand([
        'yolo-warp',
        '--milestone-file', 'milestone-auth.json',
        '--auto-commit',
        '--create-prs',
        '--verbose'
      ]);
      
      expect(warpResult.exitCode).toBe(0);
      expect(warpResult.stdout).toContain('EPIC created successfully');
      expect(warpResult.stdout).toContain('Feature branches created');
      expect(warpResult.stdout).toContain('Pull requests opened');
      
      // Step 2: Verify GitHub issues were created
      const issueListResult = await runYoloProCommand(['github', 'issues', 'list']);
      
      expect(issueListResult.stdout).toContain('User Authentication System');
      expect(issueListResult.stdout).toContain('User Login');
      expect(issueListResult.stdout).toContain('User Registration');
      expect(issueListResult.stdout).toContain('User Profile');
      
      // Step 3: Verify branches were created
      const branchResult = await execCommand('git branch -a');
      
      expect(branchResult.stdout).toContain('feature/user-login');
      expect(branchResult.stdout).toContain('feature/user-registration');
      expect(branchResult.stdout).toContain('feature/user-profile');
      
      // Step 4: Verify file structure was created
      const srcFiles = await fs.readdir('src');
      expect(srcFiles).toContain('auth');
      
      const authFiles = await fs.readdir('src/auth');
      expect(authFiles.length).toBeGreaterThan(0);
      
      const testFiles = await fs.readdir('tests');
      expect(testFiles).toContain('auth');
    }, 120000);

    it('should handle feature development workflow', async () => {
      // Step 1: Switch to feature branch
      await execCommand('git checkout feature/user-login');
      
      // Step 2: Make some changes to simulate development
      await fs.writeFile('src/auth/login.js', `
        // User login implementation
        class LoginService {
          constructor() {
            this.authenticated = false;
          }
          
          async login(username, password) {
            // Mock login logic
            if (username && password) {
              this.authenticated = true;
              return { success: true, user: { username } };
            }
            return { success: false, error: 'Invalid credentials' };
          }
          
          logout() {
            this.authenticated = false;
          }
          
          isAuthenticated() {
            return this.authenticated;
          }
        }
        
        module.exports = LoginService;
      `);
      
      await fs.writeFile('tests/auth/login.test.js', `
        const LoginService = require('../../src/auth/login');
        
        describe('LoginService', () => {
          let loginService;
          
          beforeEach(() => {
            loginService = new LoginService();
          });
          
          test('should authenticate valid user', async () => {
            const result = await loginService.login('testuser', 'password');
            expect(result.success).toBe(true);
            expect(loginService.isAuthenticated()).toBe(true);
          });
          
          test('should reject invalid credentials', async () => {
            const result = await loginService.login('', '');
            expect(result.success).toBe(false);
            expect(loginService.isAuthenticated()).toBe(false);
          });
        });
      `);
      
      // Step 3: Run tests
      const testResult = await runYoloProCommand(['test']);
      expect(testResult.exitCode).toBe(0);
      expect(testResult.stdout).toContain('Tests passed');
      
      // Step 4: Complete feature
      const completeResult = await runYoloProCommand([
        'feature', 'complete', 'user-login',
        '--run-tests',
        '--create-pr'
      ]);
      
      expect(completeResult.exitCode).toBe(0);
      expect(completeResult.stdout).toContain('Feature completed successfully');
      expect(completeResult.stdout).toContain('Pull request created');
    }, 60000);
  });

  describe('CI/CD Integration Journey', () => {
    it('should trigger and monitor CI pipeline', async () => {
      // Step 1: Push feature branch
      await execCommand('git add .');
      await execCommand('git commit -m "feat: implement user login"');
      
      const pushResult = await runYoloProCommand(['git', 'push', '--set-upstream']);
      expect(pushResult.exitCode).toBe(0);
      
      // Step 2: Monitor CI status
      const ciResult = await runYoloProCommand([
        'ci', 'monitor',
        '--branch', 'feature/user-login',
        '--timeout', '300'
      ]);
      
      expect(ciResult.exitCode).toBe(0);
      expect(ciResult.stdout).toMatch(/CI Status: (success|pending)/);
      
      // Step 3: Handle CI success/failure
      if (ciResult.stdout.includes('CI Status: success')) {
        const mergeResult = await runYoloProCommand([
          'pr', 'merge',
          '--branch', 'feature/user-login',
          '--delete-branch'
        ]);
        
        expect(mergeResult.exitCode).toBe(0);
      }
    }, 180000);

    it('should handle deployment workflow', async () => {
      // Step 1: Deploy to staging
      const stagingResult = await runYoloProCommand([
        'deploy', 'staging',
        '--branch', 'main'
      ]);
      
      expect(stagingResult.exitCode).toBe(0);
      expect(stagingResult.stdout).toContain('Deployed to staging');
      
      // Step 2: Run smoke tests
      const smokeTestResult = await runYoloProCommand([
        'test', 'smoke',
        '--environment', 'staging'
      ]);
      
      expect(smokeTestResult.exitCode).toBe(0);
      
      // Step 3: Deploy to production (if smoke tests pass)
      if (smokeTestResult.exitCode === 0) {
        const prodResult = await runYoloProCommand([
          'deploy', 'production',
          '--confirm'
        ]);
        
        expect(prodResult.exitCode).toBe(0);
        expect(prodResult.stdout).toContain('Deployed to production');
      }
    }, 120000);
  });

  describe('Error Recovery Journey', () => {
    it('should handle workflow failures gracefully', async () => {
      // Step 1: Attempt operation that will fail
      const failingMilestone = {
        title: 'Failing Milestone',
        features: [{
          title: 'Invalid Feature',
          tasks: [] // No tasks - should cause validation error
        }]
      };
      
      await fs.writeFile(
        'failing-milestone.json',
        JSON.stringify(failingMilestone, null, 2)
      );
      
      const failResult = await runYoloProCommand([
        'yolo-warp',
        '--milestone-file', 'failing-milestone.json'
      ]);
      
      expect(failResult.exitCode).toBe(1);
      expect(failResult.stderr).toContain('Validation error');
      
      // Step 2: Verify cleanup occurred
      const statusResult = await runYoloProCommand(['status']);
      expect(statusResult.stdout).not.toContain('Partial milestone state');
      
      // Step 3: Verify rollback
      const branchResult = await execCommand('git branch');
      expect(branchResult.stdout).not.toContain('feature/invalid-feature');
    }, 30000);

    it('should recover from network failures', async () => {
      // Simulate network failure by using invalid GitHub token
      const networkFailResult = await runYoloProCommand([
        'github', 'status',
        '--token', 'invalid-token-12345'
      ]);
      
      expect(networkFailResult.exitCode).toBe(1);
      expect(networkFailResult.stderr).toContain('Authentication failed');
      
      // Verify graceful error message
      expect(networkFailResult.stderr).toContain('Please check your GitHub token');
      expect(networkFailResult.stderr).not.toContain('undefined');
      expect(networkFailResult.stderr).not.toContain('null');
    });
  });

  describe('Performance Under Real Conditions', () => {
    it('should complete large milestone within acceptable time', async () => {
      const largeMilestone = {
        title: 'Large E2E Milestone',
        features: Array.from({ length: 8 }, (_, i) => ({
          title: `Large Feature ${i + 1}`,
          description: `Feature ${i + 1} for performance testing`,
          tasks: Array.from({ length: 6 }, (_, j) => `Task ${j + 1} of Feature ${i + 1}`)
        }))
      };
      
      await fs.writeFile(
        'large-milestone.json',
        JSON.stringify(largeMilestone, null, 2)
      );
      
      const startTime = Date.now();
      
      const result = await runYoloProCommand([
        'yolo-warp',
        '--milestone-file', 'large-milestone.json',
        '--parallel',
        '--verbose'
      ]);
      
      const duration = Date.now() - startTime;
      
      expect(result.exitCode).toBe(0);
      expect(duration).toBeLessThan(300000); // 5 minutes max
      
      console.log(`Large milestone completed in ${duration}ms`);
    }, 360000);
  });

  // Helper functions
  async function runYoloProCommand(args, options = {}) {
    const yoloProPath = path.resolve(__dirname, '../../../yolo-pro/src/cli/index.js');
    
    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      
      const child = spawn('node', [yoloProPath, ...args], {
        cwd: testWorkspace,
        env: {
          ...process.env,
          GITHUB_TOKEN: githubToken,
          NODE_ENV: 'test'
        },
        ...options
      });
      
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      child.on('close', (code) => {
        resolve({
          exitCode: code,
          stdout: stdout.trim(),
          stderr: stderr.trim()
        });
      });
      
      // Set timeout for long-running commands
      setTimeout(() => {
        child.kill();
        resolve({
          exitCode: -1,
          stdout,
          stderr: stderr + '\\nCommand timed out'
        });
      }, options.timeout || 60000);
    });
  }
  
  async function execCommand(command) {
    const { exec } = require('child_process');
    
    return new Promise((resolve, reject) => {
      exec(command, { cwd: testWorkspace }, (error, stdout, stderr) => {
        if (error) {
          reject({ error, stdout, stderr });
        } else {
          resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
        }
      });
    });
  }
});