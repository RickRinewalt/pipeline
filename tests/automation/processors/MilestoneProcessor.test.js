const { MilestoneProcessor } = require('../../../src/automation/processors/MilestoneProcessor');
const { Octokit } = require('@octokit/rest');

jest.mock('@octokit/rest');

describe('MilestoneProcessor', () => {
  let processor;
  let mockOctokit;
  let mockLogger;
  let mockConfig;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    };

    mockConfig = {
      github: {
        owner: 'test-owner',
        repo: 'test-repo',
        token: 'test-token'
      }
    };

    mockOctokit = {
      rest: {
        issues: {
          listMilestones: jest.fn(),
          getMilestone: jest.fn(),
          listForRepo: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
          createComment: jest.fn()
        },
        projects: {
          listForRepo: jest.fn(),
          listColumns: jest.fn(),
          createCard: jest.fn()
        }
      },
      graphql: jest.fn()
    };

    Octokit.mockImplementation(() => mockOctokit);
    processor = new MilestoneProcessor(mockConfig, mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with GitHub client', () => {
      expect(processor).toBeDefined();
      expect(processor.config).toBe(mockConfig);
      expect(processor.logger).toBe(mockLogger);
      expect(Octokit).toHaveBeenCalledWith({
        auth: 'test-token'
      });
    });

    it('should throw error with invalid config', () => {
      expect(() => new MilestoneProcessor({}, mockLogger)).toThrow('GitHub configuration required');
    });
  });

  describe('processMilestone', () => {
    const milestoneId = 123;

    it('should process milestone and create feature breakdown', async () => {
      // Mock milestone data
      mockOctokit.rest.issues.getMilestone.mockResolvedValue({
        data: {
          id: milestoneId,
          title: 'Feature: User Authentication',
          description: 'Implement user authentication system',
          open_issues: 0,
          closed_issues: 0
        }
      });

      // Mock issues for milestone
      mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: [
          {
            number: 1,
            title: 'Implement login API',
            state: 'open',
            milestone: { id: milestoneId }
          },
          {
            number: 2,
            title: 'Create user registration',
            state: 'open',
            milestone: { id: milestoneId }
          }
        ]
      });

      const result = await processor.processMilestone(milestoneId);

      expect(result.success).toBe(true);
      expect(result.milestoneId).toBe(milestoneId);
      expect(result.issuesAnalyzed).toBe(2);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Processing milestone')
      );
    });

    it('should handle milestone not found', async () => {
      mockOctokit.rest.issues.getMilestone.mockRejectedValue(
        new Error('Not Found')
      );

      const result = await processor.processMilestone(999);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Milestone not found');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should analyze milestone complexity and suggest breakdown', async () => {
      mockOctokit.rest.issues.getMilestone.mockResolvedValue({
        data: {
          id: milestoneId,
          title: 'Complex Feature',
          description: 'Large feature requiring multiple components',
          open_issues: 12,
          closed_issues: 0
        }
      });

      mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: Array.from({ length: 12 }, (_, i) => ({
          number: i + 1,
          title: `Issue ${i + 1}`,
          state: 'open',
          milestone: { id: milestoneId }
        }))
      });

      const result = await processor.processMilestone(milestoneId);

      expect(result.success).toBe(true);
      expect(result.complexity).toBe('high');
      expect(result.suggestedBreakdown).toBeDefined();
      expect(result.recommendedFeatureCount).toBeGreaterThan(1);
    });
  });

  describe('createSubIssues', () => {
    const parentIssue = {
      number: 100,
      title: 'Parent Feature',
      body: 'Feature description'
    };

    const subIssues = [
      { title: 'Sub-task 1', body: 'First sub-task' },
      { title: 'Sub-task 2', body: 'Second sub-task' },
      { title: 'Sub-task 3', body: 'Third sub-task' }
    ];

    it('should create sub-issues with proper hierarchy', async () => {
      // Mock issue creation
      mockOctokit.rest.issues.create.mockImplementation(({ title }) => ({
        data: {
          number: title === 'Sub-task 1' ? 101 : title === 'Sub-task 2' ? 102 : 103,
          title,
          id: 'gid_' + Math.random()
        }
      }));

      // Mock GraphQL for sub-issue relationships
      mockOctokit.graphql.mockResolvedValue({
        repository: {
          issue: { id: 'parent-gid' }
        }
      });

      const result = await processor.createSubIssues(parentIssue, subIssues);

      expect(result.success).toBe(true);
      expect(result.subIssuesCreated).toBe(3);
      expect(mockOctokit.rest.issues.create).toHaveBeenCalledTimes(3);

      // Verify sub-issue creation with proper parent references
      expect(mockOctokit.rest.issues.create).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: 'test-owner',
          repo: 'test-repo',
          title: 'Sub-task 1',
          body: expect.stringContaining('Parent: #100')
        })
      );
    });

    it('should handle GitHub API errors gracefully', async () => {
      mockOctokit.rest.issues.create.mockRejectedValue(
        new Error('API rate limit exceeded')
      );

      const result = await processor.createSubIssues(parentIssue, subIssues);

      expect(result.success).toBe(false);
      expect(result.error).toContain('API rate limit exceeded');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should validate sub-issue data', async () => {
      const invalidSubIssues = [
        { title: '', body: 'No title' },
        { title: 'Valid title' } // Missing body
      ];

      const result = await processor.createSubIssues(parentIssue, invalidSubIssues);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid sub-issue data');
    });
  });

  describe('getMilestoneStatus', () => {
    const milestoneId = 123;

    it('should return comprehensive milestone status', async () => {
      mockOctokit.rest.issues.getMilestone.mockResolvedValue({
        data: {
          id: milestoneId,
          title: 'Test Milestone',
          open_issues: 3,
          closed_issues: 7,
          state: 'open',
          due_on: '2024-12-31T23:59:59Z'
        }
      });

      mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: Array.from({ length: 10 }, (_, i) => ({
          number: i + 1,
          state: i < 7 ? 'closed' : 'open',
          milestone: { id: milestoneId },
          assignee: i % 2 === 0 ? { login: 'developer1' } : { login: 'developer2' }
        }))
      });

      const status = await processor.getMilestoneStatus(milestoneId);

      expect(status.milestoneId).toBe(milestoneId);
      expect(status.progress).toBe(70); // 7 closed out of 10 total
      expect(status.openIssues).toBe(3);
      expect(status.closedIssues).toBe(7);
      expect(status.assigneeDistribution).toBeDefined();
      expect(status.estimatedCompletion).toBeDefined();
    });

    it('should handle milestone with no issues', async () => {
      mockOctokit.rest.issues.getMilestone.mockResolvedValue({
        data: {
          id: milestoneId,
          title: 'Empty Milestone',
          open_issues: 0,
          closed_issues: 0,
          state: 'open'
        }
      });

      mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: []
      });

      const status = await processor.getMilestoneStatus(milestoneId);

      expect(status.progress).toBe(0);
      expect(status.isEmpty).toBe(true);
    });
  });

  describe('generateEpicTemplate', () => {
    it('should generate comprehensive EPIC template', () => {
      const epicData = {
        title: 'User Management System',
        objective: 'Implement comprehensive user management',
        features: [
          'User Registration',
          'User Authentication',
          'User Profile Management'
        ],
        requirements: [
          'Secure password handling',
          'Email verification',
          'Role-based access control'
        ]
      };

      const template = processor.generateEpicTemplate(epicData);

      expect(template).toContain('# EPIC: User Management System');
      expect(template).toContain('## Business Objective');
      expect(template).toContain('## Technical Requirements');
      expect(template).toContain('## Features (Linked)');
      expect(template).toContain('## Success Criteria');
      expect(template).toContain('## CI Protocol');
      expect(template).toContain('Per CLAUDE.md: 100% CI before progression');
    });

    it('should handle minimal epic data', () => {
      const minimalEpic = {
        title: 'Simple Feature'
      };

      const template = processor.generateEpicTemplate(minimalEpic);

      expect(template).toContain('# EPIC: Simple Feature');
      expect(template).toContain('[To be defined]');
    });
  });

  describe('generateFeatureTemplate', () => {
    it('should generate feature template with proper structure', () => {
      const featureData = {
        title: 'User Authentication',
        description: 'Implement login and logout functionality',
        epicNumber: 100,
        subIssues: [
          { number: 101, title: 'Create login API' },
          { number: 102, title: 'Implement JWT tokens' }
        ],
        acceptanceCriteria: [
          'Users can log in with email/password',
          'JWT tokens are properly generated',
          'Session management works correctly'
        ]
      };

      const template = processor.generateFeatureTemplate(featureData);

      expect(template).toContain('# Feature: User Authentication');
      expect(template).toContain('**Parent**: #100');
      expect(template).toContain('## Description');
      expect(template).toContain('## Sub-Issues (Proper GitHub hierarchy)');
      expect(template).toContain('- [ ] Create login API: #101');
      expect(template).toContain('## Acceptance Criteria');
      expect(template).toContain('## Definition of Done');
    });
  });

  describe('updateMilestoneProgress', () => {
    const milestoneId = 123;

    it('should update milestone with progress information', async () => {
      const progressData = {
        completedIssues: 5,
        totalIssues: 10,
        blockers: ['Database migration pending'],
        nextSteps: ['Complete API testing', 'Deploy to staging']
      };

      mockOctokit.rest.issues.getMilestone.mockResolvedValue({
        data: {
          id: milestoneId,
          title: 'Feature Implementation',
          description: 'Original description'
        }
      });

      mockOctokit.rest.issues.update.mockResolvedValue({
        data: { id: milestoneId }
      });

      const result = await processor.updateMilestoneProgress(milestoneId, progressData);

      expect(result.success).toBe(true);
      expect(mockOctokit.rest.issues.update).toHaveBeenCalledWith(
        expect.objectContaining({
          milestone_number: milestoneId,
          description: expect.stringContaining('Progress: 50%')
        })
      );
    });
  });
});