const { RepositoryOperations } = require('../../src/operations/repository');

describe('RepositoryOperations', () => {
  let repoOps;
  let mockClient;

  const mockRepo = {
    id: 123456,
    name: 'test-repo',
    full_name: 'testowner/test-repo',
    owner: {
      login: 'testowner',
      id: 12345,
      type: 'User'
    },
    description: 'A test repository',
    private: false,
    html_url: 'https://github.com/testowner/test-repo',
    clone_url: 'https://github.com/testowner/test-repo.git',
    ssh_url: 'git@github.com:testowner/test-repo.git',
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-06-01T00:00:00Z',
    pushed_at: '2023-06-01T00:00:00Z',
    size: 1024,
    stargazers_count: 10,
    watchers_count: 5,
    forks_count: 2,
    open_issues_count: 3,
    language: 'JavaScript',
    archived: false,
    disabled: false,
    default_branch: 'main'
  };

  beforeEach(() => {
    mockClient = {
      request: jest.fn()
    };
    repoOps = new RepositoryOperations(mockClient);
  });

  describe('getRepository', () => {
    it('should get repository information', async () => {
      mockClient.request.mockResolvedValue({ data: mockRepo });

      const result = await repoOps.getRepository('testowner', 'test-repo');

      expect(mockClient.request).toHaveBeenCalledWith('GET', '/repos/testowner/test-repo');
      expect(result).toHaveProperty('computed');
      expect(result.computed).toHaveProperty('age_days');
      expect(result.computed).toHaveProperty('size_mb');
      expect(result.computed).toHaveProperty('is_active');
    });

    it('should enhance repository data with computed fields', async () => {
      mockClient.request.mockResolvedValue({ data: mockRepo });

      const result = await repoOps.getRepository('testowner', 'test-repo');

      expect(result.computed.size_mb).toBe('1.00');
      expect(result.computed.fork_ratio).toBe('5.00'); // 10 stars / 2 forks
      expect(typeof result.computed.age_days).toBe('number');
      expect(typeof result.computed.last_update_days).toBe('number');
      expect(typeof result.computed.is_active).toBe('boolean');
    });
  });

  describe('listRepositories', () => {
    it('should list repositories for a user', async () => {
      const mockRepos = [mockRepo];
      mockClient.request.mockResolvedValue({ 
        data: mockRepos,
        headers: { link: '<https://api.github.com/user/repos?page=2>; rel="next"' }
      });

      const result = await repoOps.listRepositories('testowner');

      expect(mockClient.request).toHaveBeenCalledWith('GET', '/users/testowner/repos', {
        type: 'all',
        sort: 'updated',
        direction: 'desc',
        per_page: 30,
        page: 1,
        visibility: 'all'
      });
      expect(result.repositories).toHaveLength(1);
      expect(result.pagination).toEqual({ next: 2 });
    });

    it('should handle organization repositories', async () => {
      mockClient.request.mockResolvedValue({ data: [], headers: {} });

      await repoOps.listRepositories('orgs/testorg');

      expect(mockClient.request).toHaveBeenCalledWith('GET', '/orgs/testorg/repos', expect.any(Object));
    });

    it('should respect pagination parameters', async () => {
      mockClient.request.mockResolvedValue({ data: [], headers: {} });

      await repoOps.listRepositories('testowner', { per_page: 50, page: 2 });

      expect(mockClient.request).toHaveBeenCalledWith('GET', '/users/testowner/repos', 
        expect.objectContaining({
          per_page: 50,
          page: 2
        })
      );
    });
  });

  describe('createRepository', () => {
    it('should create a repository', async () => {
      const newRepo = { ...mockRepo, name: 'new-repo' };
      mockClient.request.mockResolvedValue({ data: newRepo });

      const result = await repoOps.createRepository({
        name: 'new-repo',
        description: 'A new repository',
        private: false
      });

      expect(mockClient.request).toHaveBeenCalledWith('POST', '/user/repos', {
        name: 'new-repo',
        description: 'A new repository',
        private: false,
        has_issues: true,
        has_projects: true,
        has_wiki: true,
        auto_init: false,
        allow_squash_merge: true,
        allow_merge_commit: true,
        allow_rebase_merge: true,
        delete_branch_on_merge: false,
        archived: false,
        visibility: 'public'
      });
      expect(result.name).toBe('new-repo');
    });

    it('should create organization repository', async () => {
      mockClient.request.mockResolvedValue({ data: mockRepo });

      await repoOps.createRepository({
        name: 'org-repo',
        organization: 'testorg'
      });

      expect(mockClient.request).toHaveBeenCalledWith('POST', '/orgs/testorg/repos', expect.any(Object));
    });

    it('should validate repository name', async () => {
      await expect(repoOps.createRepository({ name: '' }))
        .rejects.toThrow('Invalid repository name');

      await expect(repoOps.createRepository({ name: '.invalid' }))
        .rejects.toThrow('Invalid repository name');
    });
  });

  describe('updateRepository', () => {
    it('should update repository settings', async () => {
      const updatedRepo = { ...mockRepo, description: 'Updated description' };
      mockClient.request.mockResolvedValue({ data: updatedRepo });

      const result = await repoOps.updateRepository('testowner', 'test-repo', {
        description: 'Updated description'
      });

      expect(mockClient.request).toHaveBeenCalledWith('PATCH', '/repos/testowner/test-repo', {
        description: 'Updated description'
      });
      expect(result.description).toBe('Updated description');
    });
  });

  describe('deleteRepository', () => {
    it('should delete repository with confirmation', async () => {
      mockClient.request.mockResolvedValue({});

      const result = await repoOps.deleteRepository('testowner', 'test-repo', 'test-repo');

      expect(mockClient.request).toHaveBeenCalledWith('DELETE', '/repos/testowner/test-repo');
      expect(result.success).toBe(true);
    });

    it('should reject deletion without proper confirmation', async () => {
      await expect(repoOps.deleteRepository('testowner', 'test-repo', 'wrong-name'))
        .rejects.toThrow('Repository name confirmation required');
    });
  });

  describe('archiveRepository', () => {
    it('should archive repository', async () => {
      const archivedRepo = { ...mockRepo, archived: true };
      mockClient.request.mockResolvedValue({ data: archivedRepo });

      const result = await repoOps.archiveRepository('testowner', 'test-repo', true);

      expect(mockClient.request).toHaveBeenCalledWith('PATCH', '/repos/testowner/test-repo', {
        archived: true
      });
      expect(result.archived).toBe(true);
    });
  });

  describe('transferRepository', () => {
    it('should transfer repository ownership', async () => {
      const transferredRepo = { ...mockRepo, owner: { login: 'newowner' } };
      mockClient.request.mockResolvedValue({ data: transferredRepo });

      const result = await repoOps.transferRepository('testowner', 'test-repo', 'newowner');

      expect(mockClient.request).toHaveBeenCalledWith('POST', '/repos/testowner/test-repo/transfer', {
        new_owner: 'newowner'
      });
      expect(result.owner.login).toBe('newowner');
    });
  });

  describe('Topics Management', () => {
    it('should get repository topics', async () => {
      const topics = { names: ['javascript', 'node', 'api'] };
      mockClient.request.mockResolvedValue({ data: topics });

      const result = await repoOps.getTopics('testowner', 'test-repo');

      expect(mockClient.request).toHaveBeenCalledWith('GET', '/repos/testowner/test-repo/topics', 
        null, 
        { headers: { 'Accept': 'application/vnd.github.mercy-preview+json' } }
      );
      expect(result.names).toEqual(['javascript', 'node', 'api']);
    });

    it('should set repository topics', async () => {
      const topics = ['javascript', 'node'];
      mockClient.request.mockResolvedValue({ data: { names: topics } });

      const result = await repoOps.setTopics('testowner', 'test-repo', topics);

      expect(mockClient.request).toHaveBeenCalledWith('PUT', '/repos/testowner/test-repo/topics',
        { names: topics },
        { headers: { 'Accept': 'application/vnd.github.mercy-preview+json' } }
      );
      expect(result.names).toEqual(topics);
    });

    it('should validate topics array', async () => {
      await expect(repoOps.setTopics('testowner', 'test-repo', 'invalid'))
        .rejects.toThrow('Topics must be an array');

      const tooManyTopics = new Array(25).fill('topic');
      await expect(repoOps.setTopics('testowner', 'test-repo', tooManyTopics))
        .rejects.toThrow('maximum 20 items');
    });
  });

  describe('Languages', () => {
    it('should get repository languages with percentages', async () => {
      const languages = { 
        JavaScript: 2000, 
        TypeScript: 1000, 
        CSS: 500 
      };
      mockClient.request.mockResolvedValue({ data: languages });

      const result = await repoOps.getLanguages('testowner', 'test-repo');

      expect(result.languages).toEqual(languages);
      expect(result.total).toBe(3500);
      expect(result.percentages.JavaScript).toBe('57.1');
      expect(result.percentages.TypeScript).toBe('28.6');
      expect(result.percentages.CSS).toBe('14.3');
      expect(result.primary).toBe('JavaScript');
    });

    it('should handle empty languages', async () => {
      mockClient.request.mockResolvedValue({ data: {} });

      const result = await repoOps.getLanguages('testowner', 'test-repo');

      expect(result.total).toBe(0);
      expect(result.primary).toBeNull();
    });
  });

  describe('Branch Management', () => {
    const mockBranches = [
      { name: 'main', commit: { sha: 'abc123' }, protected: true },
      { name: 'develop', commit: { sha: 'def456' }, protected: false }
    ];

    it('should get repository branches', async () => {
      mockClient.request.mockResolvedValue({ 
        data: mockBranches,
        headers: {}
      });

      const result = await repoOps.getBranches('testowner', 'test-repo');

      expect(result.branches).toEqual(mockBranches);
      expect(mockClient.request).toHaveBeenCalledWith('GET', '/repos/testowner/test-repo/branches', {
        per_page: 30,
        page: 1
      });
    });

    it('should filter protected branches', async () => {
      mockClient.request.mockResolvedValue({ data: mockBranches, headers: {} });

      await repoOps.getBranches('testowner', 'test-repo', { protected_only: true });

      expect(mockClient.request).toHaveBeenCalledWith('GET', '/repos/testowner/test-repo/branches',
        expect.objectContaining({ protected: true })
      );
    });

    it('should get branch protection', async () => {
      const protection = { required_status_checks: null, enforce_admins: false };
      mockClient.request.mockResolvedValue({ data: protection });

      const result = await repoOps.getBranchProtection('testowner', 'test-repo', 'main');

      expect(result).toEqual(protection);
      expect(mockClient.request).toHaveBeenCalledWith('GET', 
        '/repos/testowner/test-repo/branches/main/protection'
      );
    });

    it('should return null for unprotected branch', async () => {
      mockClient.request.mockRejectedValue({ response: { status: 404 } });

      const result = await repoOps.getBranchProtection('testowner', 'test-repo', 'feature');

      expect(result).toBeNull();
    });

    it('should update branch protection', async () => {
      const protection = { enforce_admins: true };
      mockClient.request.mockResolvedValue({ data: protection });

      const result = await repoOps.updateBranchProtection('testowner', 'test-repo', 'main', {
        enforce_admins: true
      });

      expect(result).toEqual(protection);
      expect(mockClient.request).toHaveBeenCalledWith('PUT',
        '/repos/testowner/test-repo/branches/main/protection',
        expect.objectContaining({ enforce_admins: true })
      );
    });

    it('should remove branch protection', async () => {
      mockClient.request.mockResolvedValue({});

      const result = await repoOps.removeBranchProtection('testowner', 'test-repo', 'main');

      expect(result.success).toBe(true);
      expect(mockClient.request).toHaveBeenCalledWith('DELETE',
        '/repos/testowner/test-repo/branches/main/protection'
      );
    });
  });

  describe('Webhook Management', () => {
    const mockWebhook = {
      id: 12345,
      name: 'web',
      active: true,
      events: ['push', 'pull_request'],
      config: {
        url: 'https://example.com/webhook',
        content_type: 'json'
      }
    };

    it('should get webhooks', async () => {
      mockClient.request.mockResolvedValue({ data: [mockWebhook] });

      const result = await repoOps.getWebhooks('testowner', 'test-repo');

      expect(result).toEqual([mockWebhook]);
      expect(mockClient.request).toHaveBeenCalledWith('GET', '/repos/testowner/test-repo/hooks');
    });

    it('should create webhook', async () => {
      mockClient.request.mockResolvedValue({ data: mockWebhook });

      const result = await repoOps.createWebhook('testowner', 'test-repo', {
        config: { url: 'https://example.com/webhook' },
        events: ['push']
      });

      expect(result).toEqual(mockWebhook);
      expect(mockClient.request).toHaveBeenCalledWith('POST', '/repos/testowner/test-repo/hooks', {
        name: 'web',
        config: {
          url: 'https://example.com/webhook',
          content_type: 'json',
          insecure_ssl: '0'
        },
        events: ['push'],
        active: true
      });
    });

    it('should require webhook URL', async () => {
      await expect(repoOps.createWebhook('testowner', 'test-repo', {}))
        .rejects.toThrow('Webhook URL is required');
    });

    it('should update webhook', async () => {
      mockClient.request.mockResolvedValue({ data: mockWebhook });

      const result = await repoOps.updateWebhook('testowner', 'test-repo', 12345, {
        active: false
      });

      expect(result).toEqual(mockWebhook);
      expect(mockClient.request).toHaveBeenCalledWith('PATCH', 
        '/repos/testowner/test-repo/hooks/12345', 
        { active: false }
      );
    });

    it('should delete webhook', async () => {
      mockClient.request.mockResolvedValue({});

      const result = await repoOps.deleteWebhook('testowner', 'test-repo', 12345);

      expect(result.success).toBe(true);
      expect(mockClient.request).toHaveBeenCalledWith('DELETE', 
        '/repos/testowner/test-repo/hooks/12345'
      );
    });

    it('should test webhook', async () => {
      mockClient.request.mockResolvedValue({});

      const result = await repoOps.testWebhook('testowner', 'test-repo', 12345);

      expect(result.success).toBe(true);
      expect(mockClient.request).toHaveBeenCalledWith('POST', 
        '/repos/testowner/test-repo/hooks/12345/tests'
      );
    });
  });

  describe('Repository Statistics', () => {
    it('should get comprehensive statistics', async () => {
      // Mock all the API calls
      mockClient.request
        .mockResolvedValueOnce({ data: mockRepo }) // repository
        .mockResolvedValueOnce({ data: [{ login: 'user1' }, { login: 'user2' }] }) // contributors
        .mockResolvedValueOnce({ data: { JavaScript: 1000 } }) // languages (via getLanguages)
        .mockResolvedValueOnce({ data: [{ commit: { committer: { date: '2023-06-01T00:00:00Z' } } }], headers: { link: '<page=10>; rel="last"' } }) // commits
        .mockResolvedValueOnce({ data: [{ tag_name: 'v1.0.0' }] }) // releases
        .mockResolvedValueOnce({ data: [], headers: { link: '<page=5>; rel="last"' } }) // issues
        .mockResolvedValueOnce({ data: [], headers: { link: '<page=3>; rel="last"' } }); // pull requests

      const result = await repoOps.getStatistics('testowner', 'test-repo');

      expect(result).toHaveProperty('repository');
      expect(result).toHaveProperty('contributors');
      expect(result).toHaveProperty('languages');
      expect(result).toHaveProperty('activity');
      expect(result).toHaveProperty('releases');
      expect(result.contributors.count).toBe(2);
      expect(result.releases.count).toBe(1);
    });
  });

  describe('Search', () => {
    it('should search repositories', async () => {
      const searchResults = {
        total_count: 1,
        incomplete_results: false,
        items: [mockRepo]
      };
      mockClient.request.mockResolvedValue({ 
        data: searchResults,
        headers: {}
      });

      const result = await repoOps.searchRepositories('test');

      expect(result.total_count).toBe(1);
      expect(result.repositories).toHaveLength(1);
      expect(mockClient.request).toHaveBeenCalledWith('GET', '/search/repositories', {
        q: 'test',
        sort: 'best-match',
        order: 'desc',
        per_page: 30,
        page: 1
      });
    });
  });

  describe('Batch Operations', () => {
    it('should perform batch operations on repositories', async () => {
      const repositories = ['owner1/repo1', 'owner2/repo2'];
      const mockOperation = jest.fn()
        .mockResolvedValueOnce({ name: 'repo1' })
        .mockResolvedValueOnce({ name: 'repo2' });

      const result = await repoOps.batchOperation(repositories, mockOperation);

      expect(result.total).toBe(2);
      expect(result.successful).toBe(2);
      expect(result.failed).toBe(0);
      expect(mockOperation).toHaveBeenCalledTimes(2);
    });

    it('should handle batch operation failures', async () => {
      const repositories = [{ owner: 'owner1', repo: 'repo1' }];
      const mockOperation = jest.fn().mockRejectedValue(new Error('API Error'));

      const result = await repoOps.batchOperation(repositories, mockOperation, {
        continueOnError: true
      });

      expect(result.total).toBe(1);
      expect(result.successful).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.results[0].success).toBe(false);
    });
  });

  describe('Helper Methods', () => {
    it('should parse repository string correctly', () => {
      const result = repoOps.parseRepoString('testowner/test-repo');
      expect(result).toEqual({ owner: 'testowner', repo: 'test-repo' });
    });

    it('should validate repository string format', () => {
      expect(() => repoOps.parseRepoString('invalid'))
        .toThrow('Invalid repository format');

      expect(() => repoOps.parseRepoString('owner/'))
        .toThrow('Invalid repository name');
    });

    it('should calculate repository health score', () => {
      const stats = {
        repository: { description: 'A good description' },
        activity: { totalCommits: 10, lastCommitDate: '2023-06-01T00:00:00Z' },
        releases: { count: 2 },
        contributors: { count: 3 }
      };

      const health = repoOps.calculateRepoHealth(stats);
      expect(health).toBeGreaterThan(100); // Should get bonuses
    });

    it('should analyze repository activity', () => {
      const stats = {
        activity: { 
          totalCommits: 50,
          lastCommitDate: '2023-06-01T00:00:00Z'
        },
        contributors: { count: 2 }
      };

      const activity = repoOps.analyzeActivity(stats);
      expect(activity).toHaveProperty('level');
      expect(activity).toHaveProperty('daysSinceLastCommit');
      expect(activity.totalCommits).toBe(50);
    });
  });
});