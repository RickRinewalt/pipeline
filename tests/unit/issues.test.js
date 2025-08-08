const { IssueOperations } = require('../../src/operations/issues');

describe('IssueOperations', () => {
  let issueOps;
  let mockClient;

  const mockIssue = {
    id: 123456,
    number: 1,
    title: 'Test Issue',
    body: 'This is a test issue description',
    state: 'open',
    user: {
      login: 'testuser',
      id: 12345,
      type: 'User'
    },
    labels: [
      { id: 1, name: 'bug', color: 'red' },
      { id: 2, name: 'high priority', color: 'orange' }
    ],
    assignees: [
      { login: 'assignee1', id: 54321 }
    ],
    milestone: {
      id: 1,
      title: 'v1.0.0',
      number: 1
    },
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-06-01T00:00:00Z',
    closed_at: null,
    html_url: 'https://github.com/owner/repo/issues/1',
    comments: 5,
    reactions: {
      '+1': 2,
      '-1': 0,
      'laugh': 1,
      'hooray': 0,
      'confused': 0,
      'heart': 1,
      'rocket': 0,
      'eyes': 3
    }
  };

  const mockComment = {
    id: 987654,
    body: 'This is a test comment',
    user: {
      login: 'commenter',
      id: 98765
    },
    created_at: '2023-03-01T00:00:00Z',
    updated_at: '2023-03-01T00:00:00Z',
    html_url: 'https://github.com/owner/repo/issues/1#issuecomment-987654'
  };

  beforeEach(() => {
    mockClient = {
      request: jest.fn()
    };
    issueOps = new IssueOperations(mockClient);
  });

  describe('getIssue', () => {
    it('should get single issue with enhanced data', async () => {
      mockClient.request.mockResolvedValue({ data: mockIssue });

      const result = await issueOps.getIssue('owner', 'repo', 1);

      expect(mockClient.request).toHaveBeenCalledWith('GET', '/repos/owner/repo/issues/1');
      expect(result).toHaveProperty('computed');
      expect(result.computed).toHaveProperty('age_days');
      expect(result.computed).toHaveProperty('priority');
      expect(result.computed).toHaveProperty('has_description');
      expect(result.computed.priority).toBe('high'); // Due to 'high priority' label
      expect(result.computed.has_description).toBe(true);
    });

    it('should calculate issue age correctly', async () => {
      const issue = { ...mockIssue, created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() };
      mockClient.request.mockResolvedValue({ data: issue });

      const result = await issueOps.getIssue('owner', 'repo', 1);

      expect(result.computed.age_days).toBe(5);
    });
  });

  describe('listIssues', () => {
    it('should list issues with default parameters', async () => {
      mockClient.request.mockResolvedValue({ 
        data: [mockIssue],
        headers: { link: '<https://api.github.com/repos/owner/repo/issues?page=2>; rel="next"' }
      });

      const result = await issueOps.listIssues('owner', 'repo');

      expect(mockClient.request).toHaveBeenCalledWith('GET', '/repos/owner/repo/issues', {
        state: 'open',
        sort: 'created',
        direction: 'desc',
        per_page: 30,
        page: 1
      });
      expect(result.issues).toHaveLength(1);
      expect(result.pagination).toEqual({ next: 2 });
    });

    it('should handle issue filtering parameters', async () => {
      mockClient.request.mockResolvedValue({ data: [], headers: {} });

      await issueOps.listIssues('owner', 'repo', {
        state: 'closed',
        labels: ['bug', 'enhancement'],
        assignee: 'testuser',
        milestone: 1,
        since: '2023-01-01T00:00:00Z'
      });

      expect(mockClient.request).toHaveBeenCalledWith('GET', '/repos/owner/repo/issues', 
        expect.objectContaining({
          state: 'closed',
          labels: 'bug,enhancement',
          assignee: 'testuser',
          milestone: 1,
          since: '2023-01-01T00:00:00.000Z'
        })
      );
    });

    it('should handle array and string labels', async () => {
      mockClient.request.mockResolvedValue({ data: [], headers: {} });

      // Test with array
      await issueOps.listIssues('owner', 'repo', { labels: ['bug', 'feature'] });
      expect(mockClient.request).toHaveBeenCalledWith('GET', '/repos/owner/repo/issues',
        expect.objectContaining({ labels: 'bug,feature' })
      );

      // Test with string
      await issueOps.listIssues('owner', 'repo', { labels: 'bug' });
      expect(mockClient.request).toHaveBeenLastCalledWith('GET', '/repos/owner/repo/issues',
        expect.objectContaining({ labels: 'bug' })
      );
    });
  });

  describe('createIssue', () => {
    it('should create issue with required fields', async () => {
      const newIssue = { ...mockIssue, title: 'New Issue' };
      mockClient.request.mockResolvedValue({ data: newIssue });

      const result = await issueOps.createIssue('owner', 'repo', {
        title: 'New Issue',
        body: 'Issue description',
        labels: ['bug'],
        assignees: ['user1']
      });

      expect(mockClient.request).toHaveBeenCalledWith('POST', '/repos/owner/repo/issues', {
        title: 'New Issue',
        body: 'Issue description',
        assignees: ['user1'],
        labels: ['bug']
      });
      expect(result.title).toBe('New Issue');
    });

    it('should handle single assignee as string', async () => {
      mockClient.request.mockResolvedValue({ data: mockIssue });

      await issueOps.createIssue('owner', 'repo', {
        title: 'Test',
        assignees: 'single-user'
      });

      expect(mockClient.request).toHaveBeenCalledWith('POST', '/repos/owner/repo/issues',
        expect.objectContaining({
          assignees: ['single-user']
        })
      );
    });

    it('should require issue title', async () => {
      await expect(issueOps.createIssue('owner', 'repo', {}))
        .rejects.toThrow('Issue title is required');

      await expect(issueOps.createIssue('owner', 'repo', { title: '   ' }))
        .rejects.toThrow('Issue title is required');
    });

    it('should add issue to projects if specified', async () => {
      mockClient.request
        .mockResolvedValueOnce({ data: { ...mockIssue, number: 5 } }) // Create issue
        .mockResolvedValueOnce({ data: { id: 'card1' } }) // Add to project 1
        .mockResolvedValueOnce({ data: { id: 'card2' } }); // Add to project 2

      // Mock the addIssueToProjects method
      issueOps.addIssueToProjects = jest.fn().mockResolvedValue([
        { success: true, projectId: 1 },
        { success: true, projectId: 2 }
      ]);

      const result = await issueOps.createIssue('owner', 'repo', {
        title: 'Test Issue',
        projects: [1, 2]
      });

      expect(issueOps.addIssueToProjects).toHaveBeenCalledWith('owner', 'repo', 5, [1, 2]);
    });
  });

  describe('updateIssue', () => {
    it('should update issue', async () => {
      const updatedIssue = { ...mockIssue, title: 'Updated Title' };
      mockClient.request.mockResolvedValue({ data: updatedIssue });

      const result = await issueOps.updateIssue('owner', 'repo', 1, {
        title: 'Updated Title'
      });

      expect(mockClient.request).toHaveBeenCalledWith('PATCH', '/repos/owner/repo/issues/1', {
        title: 'Updated Title'
      });
      expect(result.title).toBe('Updated Title');
    });
  });

  describe('Issue State Management', () => {
    it('should close issue', async () => {
      const closedIssue = { ...mockIssue, state: 'closed' };
      mockClient.request.mockResolvedValue({ data: closedIssue });

      const result = await issueOps.closeIssue('owner', 'repo', 1, 'completed');

      expect(mockClient.request).toHaveBeenCalledWith('PATCH', '/repos/owner/repo/issues/1', {
        state: 'closed',
        state_reason: 'completed'
      });
      expect(result.state).toBe('closed');
    });

    it('should close issue without reason', async () => {
      const closedIssue = { ...mockIssue, state: 'closed' };
      mockClient.request.mockResolvedValue({ data: closedIssue });

      await issueOps.closeIssue('owner', 'repo', 1);

      expect(mockClient.request).toHaveBeenCalledWith('PATCH', '/repos/owner/repo/issues/1', {
        state: 'closed'
      });
    });

    it('should reopen issue', async () => {
      const reopenedIssue = { ...mockIssue, state: 'open' };
      mockClient.request.mockResolvedValue({ data: reopenedIssue });

      const result = await issueOps.reopenIssue('owner', 'repo', 1);

      expect(mockClient.request).toHaveBeenCalledWith('PATCH', '/repos/owner/repo/issues/1', {
        state: 'open'
      });
      expect(result.state).toBe('open');
    });

    it('should lock issue', async () => {
      mockClient.request.mockResolvedValue({});

      const result = await issueOps.lockIssue('owner', 'repo', 1, 'spam');

      expect(mockClient.request).toHaveBeenCalledWith('PUT', '/repos/owner/repo/issues/1/lock', {
        lock_reason: 'spam'
      });
      expect(result.success).toBe(true);
    });

    it('should unlock issue', async () => {
      mockClient.request.mockResolvedValue({});

      const result = await issueOps.unlockIssue('owner', 'repo', 1);

      expect(mockClient.request).toHaveBeenCalledWith('DELETE', '/repos/owner/repo/issues/1/lock');
      expect(result.success).toBe(true);
    });
  });

  describe('searchIssues', () => {
    it('should search issues across repositories', async () => {
      const searchResults = {
        total_count: 100,
        incomplete_results: false,
        items: [mockIssue]
      };
      mockClient.request.mockResolvedValue({ 
        data: searchResults,
        headers: {}
      });

      const result = await issueOps.searchIssues('is:issue is:open label:bug');

      expect(mockClient.request).toHaveBeenCalledWith('GET', '/search/issues', {
        q: 'is:issue is:open label:bug',
        sort: 'created',
        order: 'desc',
        per_page: 30,
        page: 1
      });
      expect(result.total_count).toBe(100);
      expect(result.issues).toHaveLength(1);
    });
  });

  describe('Comments Management', () => {
    it('should get issue comments', async () => {
      mockClient.request.mockResolvedValue({ 
        data: [mockComment],
        headers: {}
      });

      const result = await issueOps.getComments('owner', 'repo', 1);

      expect(mockClient.request).toHaveBeenCalledWith('GET', '/repos/owner/repo/issues/1/comments', {
        sort: 'created',
        direction: 'asc',
        per_page: 30,
        page: 1
      });
      expect(result.comments).toHaveLength(1);
      expect(result.comments[0]).toHaveProperty('computed');
    });

    it('should create comment', async () => {
      mockClient.request.mockResolvedValue({ data: mockComment });

      const result = await issueOps.createComment('owner', 'repo', 1, 'Test comment');

      expect(mockClient.request).toHaveBeenCalledWith('POST', '/repos/owner/repo/issues/1/comments', {
        body: 'Test comment'
      });
      expect(result.body).toBe('This is a test comment');
    });

    it('should require comment body', async () => {
      await expect(issueOps.createComment('owner', 'repo', 1, ''))
        .rejects.toThrow('Comment body is required');

      await expect(issueOps.createComment('owner', 'repo', 1, '   '))
        .rejects.toThrow('Comment body is required');
    });

    it('should update comment', async () => {
      const updatedComment = { ...mockComment, body: 'Updated comment' };
      mockClient.request.mockResolvedValue({ data: updatedComment });

      const result = await issueOps.updateComment('owner', 'repo', 987654, 'Updated comment');

      expect(mockClient.request).toHaveBeenCalledWith('PATCH', '/repos/owner/repo/issues/comments/987654', {
        body: 'Updated comment'
      });
      expect(result.body).toBe('Updated comment');
    });

    it('should delete comment', async () => {
      mockClient.request.mockResolvedValue({});

      const result = await issueOps.deleteComment('owner', 'repo', 987654);

      expect(mockClient.request).toHaveBeenCalledWith('DELETE', '/repos/owner/repo/issues/comments/987654');
      expect(result.success).toBe(true);
    });
  });

  describe('Reactions Management', () => {
    const mockReactions = [
      { id: 1, content: '+1', user: { login: 'user1' } },
      { id: 2, content: '+1', user: { login: 'user2' } },
      { id: 3, content: 'heart', user: { login: 'user3' } }
    ];

    it('should get issue reactions', async () => {
      mockClient.request.mockResolvedValue({ data: mockReactions });

      const result = await issueOps.getReactions('owner', 'repo', 1);

      expect(mockClient.request).toHaveBeenCalledWith('GET', '/repos/owner/repo/issues/1/reactions',
        null,
        { headers: { 'Accept': 'application/vnd.github.squirrel-girl-preview+json' } }
      );
      expect(result.summary['+1']).toBe(2);
      expect(result.summary.heart).toBe(1);
      expect(result.total).toBe(3);
      expect(result.details).toEqual(mockReactions);
    });

    it('should add reaction to issue', async () => {
      const newReaction = { id: 4, content: 'rocket', user: { login: 'user4' } };
      mockClient.request.mockResolvedValue({ data: newReaction });

      const result = await issueOps.addReaction('owner', 'repo', 1, 'rocket');

      expect(mockClient.request).toHaveBeenCalledWith('POST', '/repos/owner/repo/issues/1/reactions',
        { content: 'rocket' },
        { headers: { 'Accept': 'application/vnd.github.squirrel-girl-preview+json' } }
      );
      expect(result.content).toBe('rocket');
    });

    it('should validate reaction content', async () => {
      await expect(issueOps.addReaction('owner', 'repo', 1, 'invalid'))
        .rejects.toThrow('Invalid reaction');
    });

    it('should remove reaction from issue', async () => {
      mockClient.request.mockResolvedValue({});

      const result = await issueOps.removeReaction('owner', 'repo', 1, 4);

      expect(mockClient.request).toHaveBeenCalledWith('DELETE', '/repos/owner/repo/issues/1/reactions/4',
        null,
        { headers: { 'Accept': 'application/vnd.github.squirrel-girl-preview+json' } }
      );
      expect(result.success).toBe(true);
    });
  });

  describe('Bulk Operations', () => {
    it('should perform bulk updates on issues', async () => {
      const issueNumbers = [1, 2, 3];
      const updates = { labels: ['bug', 'high-priority'] };

      mockClient.request
        .mockResolvedValueOnce({ data: { ...mockIssue, number: 1, labels: updates.labels } })
        .mockResolvedValueOnce({ data: { ...mockIssue, number: 2, labels: updates.labels } })
        .mockResolvedValueOnce({ data: { ...mockIssue, number: 3, labels: updates.labels } });

      const result = await issueOps.bulkUpdate('owner', 'repo', issueNumbers, updates);

      expect(result.total).toBe(3);
      expect(result.successful).toBe(3);
      expect(result.failed).toBe(0);
      expect(mockClient.request).toHaveBeenCalledTimes(3);
    });

    it('should handle bulk update failures', async () => {
      const issueNumbers = [1, 2];
      
      mockClient.request
        .mockResolvedValueOnce({ data: mockIssue })
        .mockRejectedValueOnce(new Error('Issue not found'));

      const result = await issueOps.bulkUpdate('owner', 'repo', issueNumbers, {}, {
        continueOnError: true
      });

      expect(result.total).toBe(2);
      expect(result.successful).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.results[1].success).toBe(false);
    });

    it('should require valid issue numbers array', async () => {
      await expect(issueOps.bulkUpdate('owner', 'repo', [], {}))
        .rejects.toThrow('Issue numbers array is required');

      await expect(issueOps.bulkUpdate('owner', 'repo', 'invalid', {}))
        .rejects.toThrow('Issue numbers array is required');
    });
  });

  describe('Issue Templates', () => {
    it('should get issue templates from .github directory', async () => {
      const templateFiles = [
        { name: 'bug_report.md', path: '.github/ISSUE_TEMPLATE/bug_report.md', download_url: 'https://example.com/bug.md' },
        { name: 'feature_request.yml', path: '.github/ISSUE_TEMPLATE/feature_request.yml', download_url: 'https://example.com/feature.yml' }
      ];

      mockClient.request
        .mockResolvedValueOnce({ data: templateFiles }) // Directory listing
        .mockResolvedValueOnce({ data: '# Bug Report Template' }) // Bug template content
        .mockResolvedValueOnce({ data: 'name: Feature Request' }); // Feature template content

      const result = await issueOps.getIssueTemplates('owner', 'repo');

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('bug_report.md');
      expect(result[0].type).toBe('markdown');
      expect(result[1].name).toBe('feature_request.yml');
      expect(result[1].type).toBe('yaml');
    });

    it('should handle repositories without templates', async () => {
      mockClient.request.mockRejectedValue({ response: { status: 404 } });

      const result = await issueOps.getIssueTemplates('owner', 'repo');

      expect(result).toEqual([]);
    });

    it('should create issue from template', async () => {
      const templates = [{
        name: 'bug_report.md',
        content: '# Bug: {{title}}\n\n## Description\n{{description}}'
      }];

      // Mock getIssueTemplates
      issueOps.getIssueTemplates = jest.fn().mockResolvedValue(templates);
      
      // Mock createIssue
      mockClient.request.mockResolvedValue({ data: mockIssue });

      const result = await issueOps.createFromTemplate('owner', 'repo', 'bug_report.md', {
        title: 'Login Error',
        variables: {
          title: 'Login Error',
          description: 'User cannot login'
        }
      });

      expect(issueOps.getIssueTemplates).toHaveBeenCalledWith('owner', 'repo');
      expect(mockClient.request).toHaveBeenCalledWith('POST', '/repos/owner/repo/issues',
        expect.objectContaining({
          title: 'Login Error',
          body: '# Bug: Login Error\n\n## Description\nUser cannot login'
        })
      );
    });

    it('should handle missing template', async () => {
      issueOps.getIssueTemplates = jest.fn().mockResolvedValue([]);

      await expect(issueOps.createFromTemplate('owner', 'repo', 'missing.md', {}))
        .rejects.toThrow("Template 'missing.md' not found");
    });
  });

  describe('Timeline', () => {
    const mockTimeline = [
      { event: 'created', created_at: '2023-01-01T00:00:00Z', actor: { login: 'creator' } },
      { event: 'labeled', created_at: '2023-01-02T00:00:00Z', actor: { login: 'maintainer' } },
      { event: 'assigned', created_at: '2023-01-03T00:00:00Z', actor: { login: 'maintainer' } }
    ];

    it('should get issue timeline', async () => {
      mockClient.request.mockResolvedValue({ 
        data: mockTimeline,
        headers: {}
      });

      const result = await issueOps.getTimeline('owner', 'repo', 1);

      expect(mockClient.request).toHaveBeenCalledWith('GET', '/repos/owner/repo/issues/1/timeline',
        { per_page: 30, page: 1 },
        { headers: { 'Accept': 'application/vnd.github.mockingbird-preview' } }
      );
      expect(result.timeline).toHaveLength(3);
      expect(result.timeline[0]).toHaveProperty('computed');
      expect(result.timeline[0].computed).toHaveProperty('event_category');
    });

    it('should categorize timeline events', () => {
      const event1 = issueOps.enhanceTimelineEvent({ event: 'created', created_at: '2023-01-01T00:00:00Z' });
      const event2 = issueOps.enhanceTimelineEvent({ event: 'labeled', created_at: '2023-01-01T00:00:00Z' });
      const event3 = issueOps.enhanceTimelineEvent({ event: 'assigned', created_at: '2023-01-01T00:00:00Z' });

      expect(event1.computed.event_category).toBe('lifecycle');
      expect(event2.computed.event_category).toBe('metadata');
      expect(event3.computed.event_category).toBe('assignment');
    });
  });

  describe('Statistics', () => {
    it('should get issue statistics', async () => {
      const openIssues = { issues: [], pagination: { last: 10 } };
      const closedIssues = { issues: [], pagination: { last: 15 } };
      const recentIssues = { 
        issues: [
          { ...mockIssue, created_at: new Date().toISOString() },
          { ...mockIssue, number: 2, closed_at: new Date().toISOString() }
        ] 
      };

      mockClient.request
        .mockResolvedValueOnce({ data: [], headers: { link: '<page=10>; rel="last"' } }) // Open issues
        .mockResolvedValueOnce({ data: [], headers: { link: '<page=15>; rel="last"' } }) // Closed issues  
        .mockResolvedValueOnce({ data: recentIssues.issues, headers: {} }); // Recent issues

      const result = await issueOps.getStatistics('owner', 'repo');

      expect(result.open).toBe(300); // 10 * 30
      expect(result.closed).toBe(450); // 15 * 30
      expect(result.total).toBe(750);
      expect(result.closeRate).toBe('60.0');
      expect(result.recent).toBe(2);
    });
  });

  describe('Helper Methods', () => {
    it('should determine issue priority from labels', () => {
      const highPriorityIssue = { labels: [{ name: 'high priority' }, { name: 'bug' }] };
      const normalIssue = { labels: [{ name: 'enhancement' }] };
      const criticalIssue = { labels: [{ name: 'critical' }] };
      const lowIssue = { labels: [{ name: 'low priority' }] };

      expect(issueOps.determinePriority(highPriorityIssue)).toBe('high');
      expect(issueOps.determinePriority(normalIssue)).toBe('normal');
      expect(issueOps.determinePriority(criticalIssue)).toBe('critical');
      expect(issueOps.determinePriority(lowIssue)).toBe('low');
    });

    it('should aggregate reactions correctly', () => {
      const reactions = [
        { content: '+1', user: { login: 'user1' } },
        { content: '+1', user: { login: 'user2' } },
        { content: 'heart', user: { login: 'user3' } }
      ];

      const result = issueOps.aggregateReactions(reactions);

      expect(result.summary['+1']).toBe(2);
      expect(result.summary.heart).toBe(1);
      expect(result.summary.total).toBe(3);
      expect(result.details).toEqual(reactions);
    });

    it('should calculate average close time', () => {
      const closedIssues = [
        { 
          created_at: '2023-01-01T00:00:00Z', 
          closed_at: '2023-01-03T00:00:00Z' 
        }, // 2 days
        { 
          created_at: '2023-01-01T00:00:00Z', 
          closed_at: '2023-01-05T00:00:00Z' 
        } // 4 days
      ];

      const averageTime = issueOps.calculateAverageCloseTime(closedIssues);
      expect(averageTime).toBe(3); // (2 + 4) / 2 = 3 days
    });

    it('should return null for empty closed issues', () => {
      const result = issueOps.calculateAverageCloseTime([]);
      expect(result).toBeNull();
    });
  });
});