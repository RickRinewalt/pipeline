const { WCPManager } = require('../../../src/automation/managers/WCPManager');
const { MilestoneProcessor } = require('../../../src/automation/processors/MilestoneProcessor');

jest.mock('../../../src/automation/processors/MilestoneProcessor');

describe('WCPManager', () => {
  let manager;
  let mockLogger;
  let mockConfig;
  let mockMilestoneProcessor;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    };

    mockConfig = {
      wcp: {
        maxFeaturesPerEpic: 7,
        maxIssuesPerFeature: 3,
        enableSwarmDeployment: true,
        concurrentFeatures: false
      },
      github: {
        owner: 'test-owner',
        repo: 'test-repo',
        token: 'test-token'
      }
    };

    mockMilestoneProcessor = {
      processMilestone: jest.fn(),
      createSubIssues: jest.fn(),
      generateEpicTemplate: jest.fn(),
      generateFeatureTemplate: jest.fn(),
      getMilestoneStatus: jest.fn()
    };

    MilestoneProcessor.mockImplementation(() => mockMilestoneProcessor);
    manager = new WCPManager(mockConfig, mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with proper dependencies', () => {
      expect(manager).toBeDefined();
      expect(manager.config).toBe(mockConfig);
      expect(manager.logger).toBe(mockLogger);
      expect(MilestoneProcessor).toHaveBeenCalledWith(mockConfig, mockLogger);
    });

    it('should use default WCP configuration', () => {
      const defaultManager = new WCPManager({}, mockLogger);
      expect(defaultManager.config.wcp.maxFeaturesPerEpic).toBe(7);
      expect(defaultManager.config.wcp.maxIssuesPerFeature).toBe(3);
    });
  });

  describe('initializeWCP', () => {
    const epicData = {
      milestoneId: 123,
      title: 'User Authentication System',
      description: 'Complete user authentication implementation',
      businessObjective: 'Enable secure user access',
      requirements: [
        'User login/logout',
        'Password reset',
        'Session management'
      ]
    };

    it('should initialize WCP with EPIC breakdown', async () => {
      mockMilestoneProcessor.processMilestone.mockResolvedValue({
        success: true,
        issuesAnalyzed: 8,
        complexity: 'medium'
      });

      mockMilestoneProcessor.generateEpicTemplate.mockReturnValue(
        '# EPIC: User Authentication System\n## Business Objective\nEnable secure user access'
      );

      const result = await manager.initializeWCP(epicData);

      expect(result.success).toBe(true);
      expect(result.epicId).toBeDefined();
      expect(result.suggestedFeatures).toBeDefined();
      expect(result.wcpStructure).toHaveProperty('epic');
      expect(result.wcpStructure).toHaveProperty('features');
      
      expect(mockMilestoneProcessor.processMilestone).toHaveBeenCalledWith(123);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Initializing WCP')
      );
    });

    it('should handle complex EPICs requiring breakdown', async () => {
      const complexEpic = {
        ...epicData,
        requirements: Array.from({ length: 15 }, (_, i) => `Requirement ${i + 1}`)
      };

      mockMilestoneProcessor.processMilestone.mockResolvedValue({
        success: true,
        issuesAnalyzed: 20,
        complexity: 'high',
        suggestedBreakdown: {
          features: 6,
          issuesPerFeature: 3
        }
      });

      const result = await manager.initializeWCP(complexEpic);

      expect(result.success).toBe(true);
      expect(result.complexity).toBe('high');
      expect(result.suggestedFeatures).toHaveLength(6);
      expect(result.requiresSwarmDeployment).toBe(true);
    });

    it('should validate EPIC data', async () => {
      const invalidEpic = {
        milestoneId: null,
        title: ''
      };

      const result = await manager.initializeWCP(invalidEpic);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid EPIC data');
    });

    it('should handle milestone processing failure', async () => {
      mockMilestoneProcessor.processMilestone.mockRejectedValue(
        new Error('Milestone not found')
      );

      const result = await manager.initializeWCP(epicData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Milestone not found');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('processFeature', () => {
    const featureData = {
      name: 'User Login',
      description: 'Implement user login functionality',
      epicNumber: 100,
      acceptanceCriteria: [
        'Users can login with email/password',
        'Invalid credentials show error',
        'Successful login redirects to dashboard'
      ],
      subTasks: [
        { title: 'Create login API endpoint', estimate: 4 },
        { title: 'Implement authentication middleware', estimate: 6 },
        { title: 'Create login UI component', estimate: 3 }
      ]
    };

    it('should process feature with proper WCP structure', async () => {
      mockMilestoneProcessor.createSubIssues.mockResolvedValue({
        success: true,
        subIssuesCreated: 3,
        issues: [
          { number: 101, title: 'Create login API endpoint' },
          { number: 102, title: 'Implement authentication middleware' },
          { number: 103, title: 'Create login UI component' }
        ]
      });

      mockMilestoneProcessor.generateFeatureTemplate.mockReturnValue(
        '# Feature: User Login\n**Parent**: #100\n## Description\nImplement user login functionality'
      );

      const result = await manager.processFeature(featureData);

      expect(result.success).toBe(true);
      expect(result.featureNumber).toBeDefined();
      expect(result.subIssues).toHaveLength(3);
      expect(result.estimatedDuration).toBe(13); // Sum of estimates
      expect(result.wcpCompliant).toBe(true);

      expect(mockMilestoneProcessor.createSubIssues).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'User Login',
          body: expect.stringContaining('Parent: #100')
        }),
        expect.arrayContaining([
          expect.objectContaining({ title: 'Create login API endpoint' })
        ])
      );
    });

    it('should enforce WCP limits on sub-issues', async () => {
      const featureWithTooManyIssues = {
        ...featureData,
        subTasks: Array.from({ length: 5 }, (_, i) => ({
          title: `Task ${i + 1}`,
          estimate: 2
        }))
      };

      const result = await manager.processFeature(featureWithTooManyIssues);

      expect(result.success).toBe(false);
      expect(result.error).toContain('exceeds WCP limit');
      expect(result.wcpViolation).toBe(true);
    });

    it('should suggest feature breakdown for complex features', async () => {
      const complexFeature = {
        ...featureData,
        subTasks: [
          { title: 'Complex task 1', estimate: 15 },
          { title: 'Complex task 2', estimate: 12 },
          { title: 'Complex task 3', estimate: 8 }
        ]
      };

      const result = await manager.processFeature(complexFeature);

      expect(result.success).toBe(false);
      expect(result.suggestedBreakdown).toBeDefined();
      expect(result.reason).toContain('Feature too complex');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Feature exceeds complexity threshold')
      );
    });

    it('should handle GitHub API errors gracefully', async () => {
      mockMilestoneProcessor.createSubIssues.mockRejectedValue(
        new Error('API rate limit exceeded')
      );

      const result = await manager.processFeature(featureData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('API rate limit exceeded');
    });
  });

  describe('getWCPStatus', () => {
    const epicId = 'wcp-epic-123';

    beforeEach(() => {
      manager.activeEpics.set(epicId, {
        id: epicId,
        title: 'Test EPIC',
        features: [
          { 
            number: 101, 
            title: 'Feature 1', 
            status: 'completed',
            issues: [
              { number: 201, status: 'closed' },
              { number: 202, status: 'closed' }
            ]
          },
          { 
            number: 102, 
            title: 'Feature 2', 
            status: 'in-progress',
            issues: [
              { number: 203, status: 'closed' },
              { number: 204, status: 'open' },
              { number: 205, status: 'open' }
            ]
          },
          { 
            number: 103, 
            title: 'Feature 3', 
            status: 'pending',
            issues: []
          }
        ],
        startTime: Date.now() - 86400000, // 1 day ago
        targetDate: Date.now() + 604800000 // 1 week from now
      });
    });

    it('should calculate comprehensive WCP status', () => {
      const status = manager.getWCPStatus(epicId);

      expect(status.epicId).toBe(epicId);
      expect(status.totalFeatures).toBe(3);
      expect(status.completedFeatures).toBe(1);
      expect(status.inProgressFeatures).toBe(1);
      expect(status.pendingFeatures).toBe(1);
      expect(status.overallProgress).toBe(33); // 1/3 features completed
      expect(status.issueProgress).toBe(60); // 3/5 issues completed
      expect(status.wcpCompliant).toBe(true);
    });

    it('should detect WCP violations', () => {
      // Add a feature with too many issues
      const epic = manager.activeEpics.get(epicId);
      epic.features.push({
        number: 104,
        title: 'Violating Feature',
        status: 'pending',
        issues: Array.from({ length: 5 }, (_, i) => ({ 
          number: 300 + i, 
          status: 'open' 
        }))
      });

      const status = manager.getWCPStatus(epicId);

      expect(status.wcpCompliant).toBe(false);
      expect(status.violations).toContain('Feature 104 exceeds issue limit');
    });

    it('should calculate estimated completion time', () => {
      mockMilestoneProcessor.getMilestoneStatus.mockResolvedValue({
        estimatedCompletion: Date.now() + 432000000 // 5 days from now
      });

      const status = manager.getWCPStatus(epicId);

      expect(status.estimatedCompletion).toBeDefined();
      expect(status.daysRemaining).toBeGreaterThan(0);
    });

    it('should return not found for invalid epic ID', () => {
      const status = manager.getWCPStatus('invalid-id');

      expect(status.found).toBe(false);
      expect(status.error).toContain('EPIC not found');
    });
  });

  describe('generateWCPReport', () => {
    it('should generate comprehensive WCP report', async () => {
      const epicId = 'test-epic';
      manager.activeEpics.set(epicId, {
        id: epicId,
        title: 'Test EPIC',
        features: [
          { number: 101, title: 'Feature 1', status: 'completed' },
          { number: 102, title: 'Feature 2', status: 'in-progress' }
        ]
      });

      const report = await manager.generateWCPReport(epicId);

      expect(report.epicId).toBe(epicId);
      expect(report.summary).toBeDefined();
      expect(report.featureBreakdown).toBeDefined();
      expect(report.wcpMetrics).toBeDefined();
      expect(report.recommendations).toBeDefined();
      expect(report.generatedAt).toBeDefined();
    });

    it('should include WCP compliance metrics', async () => {
      const epicId = 'test-epic';
      manager.activeEpics.set(epicId, {
        id: epicId,
        features: Array.from({ length: 8 }, (_, i) => ({ // Violates max features limit
          number: 100 + i,
          title: `Feature ${i + 1}`,
          status: 'pending'
        }))
      });

      const report = await manager.generateWCPReport(epicId);

      expect(report.wcpMetrics.compliant).toBe(false);
      expect(report.wcpMetrics.violations).toContain('EPIC exceeds feature limit');
      expect(report.recommendations).toContain('Consider breaking down EPIC');
    });
  });

  describe('automated workflow integration', () => {
    it('should integrate with CI protocol requirements', async () => {
      const featureData = {
        name: 'User Registration',
        ciRequired: true,
        testCoverageTarget: 80,
        deploymentStage: 'staging'
      };

      const result = await manager.processFeature(featureData);

      expect(result.ciIntegration).toBeDefined();
      expect(result.ciIntegration.required).toBe(true);
      expect(result.ciIntegration.coverageTarget).toBe(80);
    });

    it('should recommend swarm deployment for complex features', async () => {
      const complexFeature = {
        name: 'Complex Integration',
        subTasks: [
          { title: 'Database migration', estimate: 8 },
          { title: 'API integration', estimate: 12 }
        ]
      };

      mockMilestoneProcessor.createSubIssues.mockResolvedValue({
        success: true,
        subIssuesCreated: 2
      });

      const result = await manager.processFeature(complexFeature);

      if (result.success) {
        expect(result.recommendedTopology).toBe('hierarchical');
        expect(result.swarmRequired).toBe(true);
      }
    });
  });

  describe('progress tracking', () => {
    it('should track feature progress over time', () => {
      const epicId = 'tracking-epic';
      const featureId = 101;

      manager.trackFeatureProgress(epicId, featureId, {
        issuesCompleted: 2,
        totalIssues: 3,
        status: 'in-progress'
      });

      const history = manager.getFeatureProgressHistory(epicId, featureId);
      
      expect(history).toBeDefined();
      expect(history.length).toBeGreaterThan(0);
      expect(history[0]).toHaveProperty('timestamp');
      expect(history[0]).toHaveProperty('progress');
    });

    it('should calculate velocity metrics', () => {
      const epicId = 'velocity-epic';
      
      // Add historical data
      manager.addVelocityData(epicId, [
        { week: 1, issuesCompleted: 5 },
        { week: 2, issuesCompleted: 7 },
        { week: 3, issuesCompleted: 6 }
      ]);

      const metrics = manager.calculateVelocityMetrics(epicId);

      expect(metrics.averageVelocity).toBe(6);
      expect(metrics.trend).toBeDefined();
      expect(metrics.projectedCompletion).toBeDefined();
    });
  });
});