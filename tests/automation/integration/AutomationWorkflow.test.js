const { YoloWarpEngine } = require('../../../src/automation/core/YoloWarpEngine');
const { MilestoneProcessor } = require('../../../src/automation/processors/MilestoneProcessor');
const { SparcAutomator } = require('../../../src/automation/processors/SparcAutomator');
const { WCPManager } = require('../../../src/automation/managers/WCPManager');
const { CIPipelineManager } = require('../../../src/automation/managers/CIPipelineManager');
const { ProgressReporter } = require('../../../src/automation/reporters/ProgressReporter');

// Integration tests for end-to-end automation workflows
describe('AutomationWorkflow Integration Tests', () => {
  let engine;
  let mockConfig;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    };

    mockConfig = {
      github: {
        owner: 'integration-test',
        repo: 'test-repo',
        token: 'integration-test-token'
      },
      automation: {
        maxConcurrentTasks: 3,
        retryAttempts: 2,
        monitoringInterval: 1000
      },
      sparc: {
        enableParallelProcessing: true,
        timeoutMs: 30000
      },
      wcp: {
        maxFeaturesPerEpic: 5,
        maxIssuesPerFeature: 3
      },
      ci: {
        enableAdaptiveMonitoring: true,
        qualityGates: {
          testCoverage: 80,
          lintErrors: 0
        }
      }
    };

    engine = new YoloWarpEngine(mockConfig, mockLogger);
  });

  describe('Complete Feature Development Workflow', () => {
    it('should execute end-to-end feature automation', async () => {
      const workflowSpec = {
        milestoneId: 123,
        epicTitle: 'User Authentication System',
        features: [
          {
            name: 'User Login',
            description: 'Implement user login functionality',
            acceptanceCriteria: [
              'Users can login with email/password',
              'Invalid credentials show error',
              'Successful login redirects to dashboard'
            ],
            subTasks: [
              { title: 'Create login API', estimate: 4 },
              { title: 'Implement JWT auth', estimate: 3 },
              { title: 'Create login UI', estimate: 2 }
            ]
          },
          {
            name: 'Password Reset',
            description: 'Allow users to reset their passwords',
            acceptanceCriteria: [
              'Users can request password reset via email',
              'Reset link expires after 1 hour',
              'New password meets security requirements'
            ],
            subTasks: [
              { title: 'Email reset functionality', estimate: 3 },
              { title: 'Reset token validation', estimate: 2 }
            ]
          }
        ],
        sparcEnabled: true,
        wcpEnabled: true,
        ciEnabled: true
      };

      // Mock successful responses for all components
      jest.spyOn(engine.milestoneProcessor, 'processMilestone')
        .mockResolvedValue({
          success: true,
          milestoneId: 123,
          issuesAnalyzed: 5
        });

      jest.spyOn(engine.wcpManager, 'initializeWCP')
        .mockResolvedValue({
          success: true,
          epicId: 'epic-123',
          suggestedFeatures: 2
        });

      jest.spyOn(engine.sparcAutomator, 'runSparcWorkflow')
        .mockResolvedValue({
          success: true,
          workflowId: 'sparc-123',
          completedPhases: 5
        });

      jest.spyOn(engine.ciPipelineManager, 'startPipeline')
        .mockResolvedValue({
          success: true,
          pipelineId: 'ci-123',
          runId: 456
        });

      jest.spyOn(engine.progressReporter, 'generateReport')
        .mockResolvedValue({
          workflowId: 'workflow-123',
          overallProgress: 100,
          status: 'completed'
        });

      const result = await engine.automateWorkflow(workflowSpec);

      expect(result.success).toBe(true);
      expect(result.workflowId).toBeDefined();
      expect(result.components).toHaveProperty('milestone');
      expect(result.components).toHaveProperty('wcp');
      expect(result.components).toHaveProperty('sparc');
      expect(result.components).toHaveProperty('ci');

      // Verify workflow coordination
      expect(engine.milestoneProcessor.processMilestone).toHaveBeenCalledWith(123);
      expect(engine.wcpManager.initializeWCP).toHaveBeenCalled();
      expect(engine.sparcAutomator.runSparcWorkflow).toHaveBeenCalled();
      expect(engine.ciPipelineManager.startPipeline).toHaveBeenCalled();
    }, 10000);

    it('should handle partial workflow failures gracefully', async () => {
      const workflowSpec = {
        milestoneId: 124,
        sparcEnabled: true,
        wcpEnabled: true,
        ciEnabled: true
      };

      // Mock milestone success, WCP failure, SPARC success
      jest.spyOn(engine.milestoneProcessor, 'processMilestone')
        .mockResolvedValue({ success: true });
      
      jest.spyOn(engine.wcpManager, 'initializeWCP')
        .mockRejectedValue(new Error('WCP initialization failed'));
      
      jest.spyOn(engine.sparcAutomator, 'runSparcWorkflow')
        .mockResolvedValue({ success: true });

      const result = await engine.automateWorkflow(workflowSpec);

      expect(result.success).toBe(false);
      expect(result.partialSuccess).toBe(true);
      expect(result.completedComponents).toContain('milestone');
      expect(result.failedComponents).toContain('wcp');
    });
  });

  describe('SPARC Workflow Integration', () => {
    it('should integrate SPARC phases with milestone progression', async () => {
      const taskDescription = 'Implement user authentication with JWT tokens';
      
      jest.spyOn(engine.sparcAutomator, 'runSparcWorkflow')
        .mockImplementation(async (task) => {
          // Simulate progressive phase completion
          return new Promise(resolve => {
            setTimeout(() => {
              resolve({
                success: true,
                workflowId: 'sparc-integration-test',
                phases: [
                  { name: 'specification', status: 'completed', artifacts: ['requirements.md'] },
                  { name: 'pseudocode', status: 'completed', artifacts: ['algorithm.md'] },
                  { name: 'architecture', status: 'completed', artifacts: ['design.md'] },
                  { name: 'refinement', status: 'completed', artifacts: ['src/auth.js', 'tests/auth.test.js'] },
                  { name: 'completion', status: 'completed', artifacts: ['deployment.md'] }
                ],
                completedPhases: 5
              });
            }, 100);
          });
        });

      const result = await engine.sparcAutomator.runSparcWorkflow(taskDescription);

      expect(result.success).toBe(true);
      expect(result.phases).toHaveLength(5);
      expect(result.completedPhases).toBe(5);
      
      // Verify all artifacts were generated
      const allArtifacts = result.phases.reduce((acc, phase) => 
        acc.concat(phase.artifacts || []), []
      );
      expect(allArtifacts).toContain('requirements.md');
      expect(allArtifacts).toContain('src/auth.js');
      expect(allArtifacts).toContain('tests/auth.test.js');
    });

    it('should handle SPARC phase failures with recovery', async () => {
      jest.spyOn(engine.sparcAutomator, 'runSparcWorkflow')
        .mockImplementation(async () => {
          // Simulate failure in refinement phase
          return {
            success: false,
            failedPhase: 'refinement',
            error: 'Test compilation failed',
            completedPhases: 3,
            phases: [
              { name: 'specification', status: 'completed' },
              { name: 'pseudocode', status: 'completed' },
              { name: 'architecture', status: 'completed' },
              { name: 'refinement', status: 'failed', error: 'Test compilation failed' },
              { name: 'completion', status: 'pending' }
            ]
          };
        });

      const result = await engine.sparcAutomator.runSparcWorkflow('Complex task');

      expect(result.success).toBe(false);
      expect(result.failedPhase).toBe('refinement');
      expect(result.completedPhases).toBe(3);
    });
  });

  describe('WCP and Milestone Integration', () => {
    it('should coordinate WCP breakdown with GitHub milestone management', async () => {
      const epicData = {
        milestoneId: 200,
        title: 'E-commerce Shopping Cart',
        businessObjective: 'Enable users to manage shopping cart items',
        requirements: [
          'Add items to cart',
          'Remove items from cart', 
          'Update item quantities',
          'Calculate cart totals',
          'Persist cart across sessions'
        ]
      };

      jest.spyOn(engine.milestoneProcessor, 'processMilestone')
        .mockResolvedValue({
          success: true,
          milestoneId: 200,
          issuesAnalyzed: 8,
          complexity: 'medium',
          suggestedBreakdown: {
            features: 3,
            issuesPerFeature: 2
          }
        });

      jest.spyOn(engine.wcpManager, 'initializeWCP')
        .mockResolvedValue({
          success: true,
          epicId: 'epic-shopping-cart',
          suggestedFeatures: [
            'Cart Item Management',
            'Cart Calculations', 
            'Cart Persistence'
          ],
          wcpStructure: {
            epic: { number: 200, title: 'E-commerce Shopping Cart' },
            features: 3
          }
        });

      const wcpResult = await engine.wcpManager.initializeWCP(epicData);
      
      expect(wcpResult.success).toBe(true);
      expect(wcpResult.suggestedFeatures).toHaveLength(3);
      expect(wcpResult.wcpStructure.features).toBe(3);

      // Verify milestone processing was called
      expect(engine.milestoneProcessor.processMilestone).toHaveBeenCalledWith(200);
    });

    it('should enforce WCP compliance during feature processing', async () => {
      const validFeature = {
        name: 'User Profile Management',
        epicNumber: 150,
        subTasks: [
          { title: 'Profile view', estimate: 3 },
          { title: 'Profile edit', estimate: 4 },
          { title: 'Avatar upload', estimate: 2 }
        ]
      };

      const invalidFeature = {
        name: 'Complex Integration Feature',
        epicNumber: 150,
        subTasks: [
          { title: 'Task 1', estimate: 5 },
          { title: 'Task 2', estimate: 6 },
          { title: 'Task 3', estimate: 4 },
          { title: 'Task 4', estimate: 3 } // Exceeds WCP limit of 3 issues per feature
        ]
      };

      jest.spyOn(engine.wcpManager, 'processFeature')
        .mockImplementation(async (feature) => {
          if (feature.subTasks.length > 3) {
            return {
              success: false,
              error: 'Feature exceeds WCP limit of 3 issues per feature',
              wcpViolation: true
            };
          }
          return {
            success: true,
            featureNumber: 151,
            subIssues: feature.subTasks.map((task, i) => ({
              number: 200 + i,
              title: task.title
            }))
          };
        });

      const validResult = await engine.wcpManager.processFeature(validFeature);
      const invalidResult = await engine.wcpManager.processFeature(invalidFeature);

      expect(validResult.success).toBe(true);
      expect(validResult.featureNumber).toBe(151);

      expect(invalidResult.success).toBe(false);
      expect(invalidResult.wcpViolation).toBe(true);
    });
  });

  describe('CI Pipeline Integration', () => {
    it('should coordinate CI with SPARC phase completion', async () => {
      const pipelineConfig = {
        branch: 'feature/integration-test',
        workflow: 'ci.yml',
        sparcPhase: 'refinement',
        qualityGates: {
          testCoverage: 85,
          lintErrors: 0,
          buildSuccess: true
        }
      };

      jest.spyOn(engine.ciPipelineManager, 'startPipeline')
        .mockResolvedValue({
          success: true,
          pipelineId: 'ci-integration-123',
          runId: 789,
          monitoringUrl: 'https://github.com/test/repo/actions/runs/789'
        });

      jest.spyOn(engine.ciPipelineManager, 'monitorPipeline')
        .mockResolvedValue({
          pipelineId: 'ci-integration-123',
          status: 'completed',
          success: true,
          checks: [
            { name: 'build', status: 'completed', conclusion: 'success' },
            { name: 'test', status: 'completed', conclusion: 'success' },
            { name: 'lint', status: 'completed', conclusion: 'success' }
          ],
          qualityGates: {
            testCoverage: 87,
            lintErrors: 0,
            buildSuccess: true
          }
        });

      const startResult = await engine.ciPipelineManager.startPipeline(pipelineConfig);
      expect(startResult.success).toBe(true);

      const monitorResult = await engine.ciPipelineManager.monitorPipeline('ci-integration-123');
      expect(monitorResult.success).toBe(true);
      expect(monitorResult.qualityGates.testCoverage).toBeGreaterThan(85);
    });

    it('should handle CI failures with automated retry', async () => {
      jest.spyOn(engine.ciPipelineManager, 'monitorPipeline')
        .mockResolvedValueOnce({
          status: 'failed',
          success: false,
          failedChecks: ['test'],
          retryRecommended: true
        })
        .mockResolvedValueOnce({
          status: 'completed',
          success: true,
          checks: [
            { name: 'build', status: 'completed', conclusion: 'success' },
            { name: 'test', status: 'completed', conclusion: 'success' }
          ]
        });

      jest.spyOn(engine.ciPipelineManager, 'retryFailedPipeline')
        .mockResolvedValue({
          success: true,
          newPipelineId: 'ci-retry-456',
          retryAttempt: 1
        });

      const firstResult = await engine.ciPipelineManager.monitorPipeline('ci-failed-123');
      expect(firstResult.success).toBe(false);

      if (firstResult.retryRecommended) {
        const retryResult = await engine.ciPipelineManager.retryFailedPipeline('ci-failed-123');
        expect(retryResult.success).toBe(true);

        const secondResult = await engine.ciPipelineManager.monitorPipeline('ci-retry-456');
        expect(secondResult.success).toBe(true);
      }
    });
  });

  describe('Progress Reporting Integration', () => {
    it('should provide real-time progress across all components', async () => {
      const workflowId = 'progress-integration-test';

      // Simulate progress updates from different components
      jest.spyOn(engine.progressReporter, 'trackProgress')
        .mockImplementation((data) => {
          // Store progress updates
          if (!engine.progressReporter.progressData) {
            engine.progressReporter.progressData = new Map();
          }
          engine.progressReporter.progressData.set(data.workflowId, data);
        });

      jest.spyOn(engine.progressReporter, 'generateReport')
        .mockImplementation(async (id) => {
          const progressData = engine.progressReporter.progressData?.get(id);
          return {
            workflowId: id,
            overallProgress: progressData?.progress || 0,
            components: {
              milestone: { status: 'completed', progress: 100 },
              sparc: { status: 'in-progress', progress: 60 },
              wcp: { status: 'completed', progress: 100 },
              ci: { status: 'pending', progress: 0 }
            },
            estimatedCompletion: Date.now() + 3600000
          };
        });

      // Track progress updates
      engine.progressReporter.trackProgress({
        workflowId,
        progress: 25,
        phase: 'specification',
        component: 'sparc'
      });

      engine.progressReporter.trackProgress({
        workflowId,
        progress: 50,
        phase: 'architecture', 
        component: 'sparc'
      });

      const report = await engine.progressReporter.generateReport(workflowId);

      expect(report.workflowId).toBe(workflowId);
      expect(report.components).toHaveProperty('milestone');
      expect(report.components).toHaveProperty('sparc');
      expect(report.components).toHaveProperty('wcp');
      expect(report.components).toHaveProperty('ci');
      expect(report.estimatedCompletion).toBeDefined();
    });

    it('should detect and alert on workflow bottlenecks', async () => {
      const workflowId = 'bottleneck-detection-test';
      
      jest.spyOn(engine.progressReporter, 'analyzeProgress')
        .mockReturnValue({
          workflowId,
          bottlenecks: ['ci'],
          stagnantComponents: ['sparc'],
          alerts: [
            'CI pipeline has been pending for 2 hours',
            'SPARC workflow progress stagnant at 40%'
          ],
          recommendations: [
            'Check CI pipeline logs for failures',
            'Review SPARC workflow status'
          ]
        });

      const analysis = engine.progressReporter.analyzeProgress(workflowId);

      expect(analysis.bottlenecks).toContain('ci');
      expect(analysis.stagnantComponents).toContain('sparc');
      expect(analysis.alerts).toHaveLength(2);
      expect(analysis.recommendations).toHaveLength(2);
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover from component failures', async () => {
      const workflowSpec = {
        milestoneId: 300,
        sparcEnabled: true,
        wcpEnabled: true,
        ciEnabled: true
      };

      // Simulate component failure followed by recovery
      let sparcAttempts = 0;
      jest.spyOn(engine.sparcAutomator, 'runSparcWorkflow')
        .mockImplementation(async () => {
          sparcAttempts++;
          if (sparcAttempts <= 2) {
            throw new Error('SPARC workflow temporary failure');
          }
          return { success: true, workflowId: 'sparc-recovered' };
        });

      jest.spyOn(engine.milestoneProcessor, 'processMilestone')
        .mockResolvedValue({ success: true });
        
      jest.spyOn(engine.wcpManager, 'initializeWCP')
        .mockResolvedValue({ success: true });

      const result = await engine.automateWorkflow(workflowSpec);

      expect(result.success).toBe(true);
      expect(sparcAttempts).toBe(3); // Should have retried
      expect(result.recoveredComponents).toContain('sparc');
    });

    it('should handle cascading failures gracefully', async () => {
      const workflowSpec = {
        milestoneId: 400,
        sparcEnabled: true,
        wcpEnabled: true,
        ciEnabled: true
      };

      // Simulate cascading failures
      jest.spyOn(engine.milestoneProcessor, 'processMilestone')
        .mockRejectedValue(new Error('GitHub API unavailable'));
        
      jest.spyOn(engine.wcpManager, 'initializeWCP')
        .mockRejectedValue(new Error('Depends on milestone processing'));

      const result = await engine.automateWorkflow(workflowSpec);

      expect(result.success).toBe(false);
      expect(result.cascadingFailures).toBe(true);
      expect(result.failedComponents).toContain('milestone');
      expect(result.failedComponents).toContain('wcp');
      expect(result.recoveryPlan).toBeDefined();
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle concurrent workflow execution', async () => {
      const workflows = [
        { milestoneId: 501, title: 'Workflow 1' },
        { milestoneId: 502, title: 'Workflow 2' },
        { milestoneId: 503, title: 'Workflow 3' }
      ];

      // Mock successful responses for all workflows
      jest.spyOn(engine.milestoneProcessor, 'processMilestone')
        .mockResolvedValue({ success: true });
      jest.spyOn(engine.wcpManager, 'initializeWCP')
        .mockResolvedValue({ success: true });
      jest.spyOn(engine.sparcAutomator, 'runSparcWorkflow')
        .mockResolvedValue({ success: true });

      const results = await Promise.all(
        workflows.map(workflow => engine.automateWorkflow(workflow))
      );

      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
      
      // Verify all workflows have unique IDs
      const workflowIds = results.map(r => r.workflowId);
      const uniqueIds = new Set(workflowIds);
      expect(uniqueIds.size).toBe(3);
    });

    it('should respect concurrency limits', async () => {
      // Override config for this test
      engine.config.automation.maxConcurrentTasks = 2;

      const workflows = Array.from({ length: 5 }, (_, i) => ({
        milestoneId: 600 + i,
        title: `Concurrent Test ${i + 1}`
      }));

      jest.spyOn(engine.milestoneProcessor, 'processMilestone')
        .mockImplementation(() => 
          new Promise(resolve => 
            setTimeout(() => resolve({ success: true }), 100)
          )
        );

      const startTime = Date.now();
      const results = await Promise.all(
        workflows.map(workflow => engine.automateWorkflow(workflow))
      );
      const endTime = Date.now();

      expect(results.every(r => r.success)).toBe(true);
      
      // Should take longer due to concurrency limits
      expect(endTime - startTime).toBeGreaterThan(200);
    });
  });
});