const { PullRequestOperations } = require('../../src/operations/pull-requests');

describe('PullRequestOperations', () => {
  let prOps;
  let mockClient;

  const mockPR = {
    id: 123456,
    number: 1,
    title: 'Test Pull Request',
    body: 'This is a test PR description',
    state: 'open',
    draft: false,
    user: {
      login: 'author',
      id: 12345
    },
    head: {
      ref: 'feature-branch',
      sha: 'abc123',
      repo: {
        full_name: 'owner/repo'
      }
    },
    base: {
      ref: 'main',
      sha: 'def456',
      repo: {
        full_name: 'owner/repo'
      }
    },
    mergeable: true,
    mergeable_state: 'clean',
    rebaseable: true,
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-06-01T00:00:00Z',
    closed_at: null,
    merged_at: null,
    merge_commit_sha: null,
    requested_reviewers: [
      { login: 'reviewer1', id: 54321 }
    ],
    requested_teams: [],
    labels: [],
    assignees: [],
    html_url: 'https://github.com/owner/repo/pull/1',
    commits: 3,
    additions: 50,
    deletions: 10,
    changed_files: 5
  };

  const mockFile = {
    filename: 'src/test.js',
    status: 'modified',
    additions: 20,
    deletions: 5,
    changes: 25,
    patch: '@@ -1,3 +1,3 @@...'
  };

  const mockCommit = {
    sha: 'commit123',
    commit: {
      message: 'Add new feature',
      author: {
        name: 'Author Name',
        email: 'author@example.com',
        date: '2023-01-01T00:00:00Z'
      },
      committer: {
        name: 'Author Name',
        email: 'author@example.com',
        date: '2023-01-01T00:00:00Z'
      },
      verification: {
        verified: true
      }
    }
  };

  const mockReview = {
    id: 987654,
    user: {
      login: 'reviewer1',
      id: 54321
    },
    body: 'Looks good to me!',
    state: 'APPROVED',
    submitted_at: '2023-01-02T00:00:00Z',
    html_url: 'https://github.com/owner/repo/pull/1#pullrequestreview-987654'
  };

  beforeEach(() => {
    mockClient = {
      request: jest.fn()
    };
    prOps = new PullRequestOperations(mockClient);
  });

  describe('getPullRequest', () => {
    it('should get single pull request with enhanced data', async () => {
      mockClient.request.mockResolvedValue({ data: mockPR });

      const result = await prOps.getPullRequest('owner', 'repo', 1);

      expect(mockClient.request).toHaveBeenCalledWith('GET', '/repos/owner/repo/pulls/1');
      expect(result).toHaveProperty('computed');
      expect(result.computed).toHaveProperty('age_days');
      expect(result.computed).toHaveProperty('review_status');
      expect(result.computed).toHaveProperty('ci_status');
      expect(result.computed.has_conflicts).toBe(false);
      expect(result.computed.cross_repo).toBe(false);
    });

    it('should detect cross-repository pull requests', async () => {
      const crossRepoPR = {
        ...mockPR,
        head: { ...mockPR.head, repo: { full_name: 'fork/repo' } }
      };
      mockClient.request.mockResolvedValue({ data: crossRepoPR });

      const result = await prOps.getPullRequest('owner', 'repo', 1);

      expect(result.computed.cross_repo).toBe(true);
    });
  });

  describe('listPullRequests', () => {
    it('should list pull requests with default parameters', async () => {
      mockClient.request.mockResolvedValue({ 
        data: [mockPR],
        headers: { link: '<https://api.github.com/repos/owner/repo/pulls?page=2>; rel="next"' }
      });

      const result = await prOps.listPullRequests('owner', 'repo');

      expect(mockClient.request).toHaveBeenCalledWith('GET', '/repos/owner/repo/pulls', {
        state: 'open',
        sort: 'created',
        direction: 'desc',
        per_page: 30,
        page: 1
      });
      expect(result.pullRequests).toHaveLength(1);
      expect(result.pagination).toEqual({ next: 2 });
    });

    it('should handle branch filtering', async () => {
      mockClient.request.mockResolvedValue({ data: [], headers: {} });

      await prOps.listPullRequests('owner', 'repo', {
        head: 'feature-branch',
        base: 'develop'
      });

      expect(mockClient.request).toHaveBeenCalledWith('GET', '/repos/owner/repo/pulls',
        expect.objectContaining({
          head: 'feature-branch',
          base: 'develop'
        })
      );
    });
  });

  describe('createPullRequest', () => {
    it('should create pull request', async () => {
      const newPR = { ...mockPR, title: 'New Feature' };
      mockClient.request.mockResolvedValue({ data: newPR });

      const result = await prOps.createPullRequest('owner', 'repo', {
        title: 'New Feature',
        head: 'feature-branch',
        base: 'main',
        body: 'Add new feature'
      });

      expect(mockClient.request).toHaveBeenCalledWith('POST', '/repos/owner/repo/pulls', {
        title: 'New Feature',
        head: 'feature-branch',
        base: 'main',
        body: 'Add new feature',
        maintainer_can_modify: true,
        draft: false
      });
      expect(result.title).toBe('New Feature');
    });

    it('should require title', async () => {
      await expect(prOps.createPullRequest('owner', 'repo', {
        head: 'feature',
        base: 'main'
      })).rejects.toThrow('Pull request title is required');

      await expect(prOps.createPullRequest('owner', 'repo', {
        title: '   ',
        head: 'feature',
        base: 'main'
      })).rejects.toThrow('Pull request title is required');
    });

    it('should require head and base branches', async () => {
      await expect(prOps.createPullRequest('owner', 'repo', {
        title: 'Test',
        base: 'main'
      })).rejects.toThrow('Both head and base branches are required');

      await expect(prOps.createPullRequest('owner', 'repo', {
        title: 'Test',
        head: 'feature'
      })).rejects.toThrow('Both head and base branches are required');
    });

    it('should create draft pull request', async () => {
      mockClient.request.mockResolvedValue({ data: { ...mockPR, draft: true } });

      await prOps.createPullRequest('owner', 'repo', {
        title: 'Draft PR',
        head: 'feature',
        base: 'main',
        draft: true
      });

      expect(mockClient.request).toHaveBeenCalledWith('POST', '/repos/owner/repo/pulls',
        expect.objectContaining({ draft: true })
      );
    });
  });

  describe('updatePullRequest', () => {
    it('should update pull request', async () => {
      const updatedPR = { ...mockPR, title: 'Updated Title' };
      mockClient.request.mockResolvedValue({ data: updatedPR });

      const result = await prOps.updatePullRequest('owner', 'repo', 1, {
        title: 'Updated Title'
      });

      expect(mockClient.request).toHaveBeenCalledWith('PATCH', '/repos/owner/repo/pulls/1', {
        title: 'Updated Title'
      });
      expect(result.title).toBe('Updated Title');
    });
  });

  describe('Pull Request State Management', () => {
    it('should close pull request', async () => {
      const closedPR = { ...mockPR, state: 'closed' };
      mockClient.request.mockResolvedValue({ data: closedPR });

      const result = await prOps.closePullRequest('owner', 'repo', 1);

      expect(mockClient.request).toHaveBeenCalledWith('PATCH', '/repos/owner/repo/pulls/1', {
        state: 'closed'
      });
      expect(result.state).toBe('closed');
    });

    it('should reopen pull request', async () => {
      const reopenedPR = { ...mockPR, state: 'open' };
      mockClient.request.mockResolvedValue({ data: reopenedPR });

      const result = await prOps.reopenPullRequest('owner', 'repo', 1);

      expect(mockClient.request).toHaveBeenCalledWith('PATCH', '/repos/owner/repo/pulls/1', {
        state: 'open'
      });
      expect(result.state).toBe('open');
    });

    it('should convert to draft', async () => {
      const draftPR = { ...mockPR, draft: true };
      mockClient.request.mockResolvedValue({ data: draftPR });

      const result = await prOps.convertToDraft('owner', 'repo', 1);

      expect(mockClient.request).toHaveBeenCalledWith('POST', 
        '/repos/owner/repo/pulls/1/convert_to_draft',
        null,
        { headers: { 'Accept': 'application/vnd.github.shadow-cat-preview+json' } }
      );
      expect(result.draft).toBe(true);
    });

    it('should mark as ready for review', async () => {
      const readyPR = { ...mockPR, draft: false };
      mockClient.request.mockResolvedValue({ data: readyPR });

      const result = await prOps.markReadyForReview('owner', 'repo', 1);

      expect(mockClient.request).toHaveBeenCalledWith('POST', 
        '/repos/owner/repo/pulls/1/ready_for_review',
        null,
        { headers: { 'Accept': 'application/vnd.github.shadow-cat-preview+json' } }
      );
      expect(result.draft).toBe(false);
    });
  });

  describe('mergePullRequest', () => {
    it('should merge pull request with default method', async () => {
      const mergeResponse = {
        sha: 'merge123',
        merged: true,
        message: 'Pull request successfully merged'
      };
      mockClient.request.mockResolvedValue({ data: mergeResponse });

      const result = await prOps.mergePullRequest('owner', 'repo', 1);

      expect(mockClient.request).toHaveBeenCalledWith('PUT', '/repos/owner/repo/pulls/1/merge', {
        merge_method: 'merge'
      });
      expect(result.success).toBe(true);
      expect(result.sha).toBe('merge123');
    });

    it('should merge with squash method', async () => {
      const mergeResponse = { sha: 'squash123', merged: true, message: 'Merged' };
      mockClient.request.mockResolvedValue({ data: mergeResponse });

      await prOps.mergePullRequest('owner', 'repo', 1, { merge_method: 'squash' });

      expect(mockClient.request).toHaveBeenCalledWith('PUT', '/repos/owner/repo/pulls/1/merge',
        expect.objectContaining({ merge_method: 'squash' })
      );
    });

    it('should validate merge method', async () => {
      await expect(prOps.mergePullRequest('owner', 'repo', 1, { merge_method: 'invalid' }))
        .rejects.toThrow('Invalid merge method');
    });

    it('should include custom commit message', async () => {
      const mergeResponse = { sha: 'merge123', merged: true, message: 'Merged' };
      mockClient.request.mockResolvedValue({ data: mergeResponse });

      await prOps.mergePullRequest('owner', 'repo', 1, {
        commit_title: 'Custom Title',
        commit_message: 'Custom message'
      });

      expect(mockClient.request).toHaveBeenCalledWith('PUT', '/repos/owner/repo/pulls/1/merge',
        expect.objectContaining({
          commit_title: 'Custom Title',
          commit_message: 'Custom message'
        })
      );
    });
  });

  describe('checkMergeability', () => {
    it('should check if pull request is mergeable', async () => {
      mockClient.request.mockResolvedValue({ data: mockPR });

      const result = await prOps.checkMergeability('owner', 'repo', 1);

      expect(result.mergeable).toBe(true);
      expect(result.mergeable_state).toBe('clean');
      expect(result.can_merge).toBe(true);
      expect(result.blocking_issues).toEqual([]);
    });

    it('should identify merge conflicts', async () => {
      const conflictedPR = { ...mockPR, mergeable: false, mergeable_state: 'blocked' };
      mockClient.request.mockResolvedValue({ data: conflictedPR });

      const result = await prOps.checkMergeability('owner', 'repo', 1);

      expect(result.can_merge).toBe(false);
      expect(result.blocking_issues).toEqual([
        expect.objectContaining({ type: 'merge_conflict' }),
        expect.objectContaining({ type: 'required_checks' })
      ]);
    });

    it('should identify draft blockers', async () => {
      const draftPR = { ...mockPR, draft: true };
      mockClient.request.mockResolvedValue({ data: draftPR });

      const result = await prOps.checkMergeability('owner', 'repo', 1);

      expect(result.blocking_issues).toEqual([
        expect.objectContaining({ type: 'draft' })
      ]);
    });
  });

  describe('getFiles', () => {
    it('should get pull request files with summary', async () => {
      const files = [mockFile, { ...mockFile, filename: 'test.py', additions: 10, deletions: 2 }];
      mockClient.request.mockResolvedValue({ data: files, headers: {} });

      const result = await prOps.getFiles('owner', 'repo', 1);

      expect(result.files).toHaveLength(2);
      expect(result.summary.total_files).toBe(2);
      expect(result.summary.additions).toBe(30);
      expect(result.summary.deletions).toBe(7);
      expect(result.files[0]).toHaveProperty('computed');
      expect(result.files[0].computed.file_type).toBe('javascript');
    });

    it('should categorize file sizes', async () => {
      const files = [
        { ...mockFile, changes: 5 },    // small
        { ...mockFile, changes: 25 },   // medium  
        { ...mockFile, changes: 100 },  // large
        { ...mockFile, changes: 500 }   // very_large
      ];
      mockClient.request.mockResolvedValue({ data: files, headers: {} });

      const result = await prOps.getFiles('owner', 'repo', 1);

      expect(result.files[0].computed.size_category).toBe('small');
      expect(result.files[1].computed.size_category).toBe('medium');
      expect(result.files[2].computed.size_category).toBe('large');
      expect(result.files[3].computed.size_category).toBe('very_large');
    });
  });

  describe('getCommits', () => {
    it('should get pull request commits with summary', async () => {
      const commits = [mockCommit, { ...mockCommit, sha: 'commit456' }];
      mockClient.request.mockResolvedValue({ data: commits, headers: {} });

      const result = await prOps.getCommits('owner', 'repo', 1);

      expect(result.commits).toHaveLength(2);
      expect(result.summary.total_commits).toBe(2);
      expect(result.summary.unique_authors).toBe(1);
      expect(result.commits[0]).toHaveProperty('computed');
      expect(result.commits[0].computed.has_gpg_signature).toBe(true);
    });
  });

  describe('Reviews Management', () => {
    it('should get pull request reviews with summary', async () => {
      const reviews = [mockReview, { ...mockReview, id: 2, state: 'CHANGES_REQUESTED' }];
      mockClient.request.mockResolvedValue({ data: reviews, headers: {} });

      const result = await prOps.getReviews('owner', 'repo', 1);

      expect(result.reviews).toHaveLength(2);
      expect(result.summary.total_reviews).toBe(2);
      expect(result.summary.approvals).toBe(1);
      expect(result.summary.change_requests).toBe(1);
      expect(result.reviews[0]).toHaveProperty('computed');
    });

    it('should create review', async () => {
      mockClient.request.mockResolvedValue({ data: mockReview });

      const result = await prOps.createReview('owner', 'repo', 1, {
        body: 'Great work!',
        event: 'APPROVE',
        comments: [
          { path: 'test.js', line: 10, body: 'Nice code!' }
        ]
      });

      expect(mockClient.request).toHaveBeenCalledWith('POST', '/repos/owner/repo/pulls/1/reviews', {
        body: 'Great work!',
        event: 'APPROVE',
        comments: [
          { path: 'test.js', line: 10, body: 'Nice code!', side: 'RIGHT' }
        ]
      });
      expect(result.state).toBe('APPROVED');
    });

    it('should validate review event', async () => {
      await expect(prOps.createReview('owner', 'repo', 1, { event: 'INVALID' }))
        .rejects.toThrow('Invalid review event');
    });

    it('should submit pending review', async () => {
      mockClient.request.mockResolvedValue({ data: mockReview });

      const result = await prOps.submitReview('owner', 'repo', 1, 987654, 'LGTM!', 'APPROVE');

      expect(mockClient.request).toHaveBeenCalledWith('POST', 
        '/repos/owner/repo/pulls/1/reviews/987654/events', 
        { body: 'LGTM!', event: 'APPROVE' }
      );
    });

    it('should dismiss review', async () => {
      const dismissedReview = { ...mockReview, state: 'DISMISSED' };
      mockClient.request.mockResolvedValue({ data: dismissedReview });

      const result = await prOps.dismissReview('owner', 'repo', 1, 987654, 'No longer relevant');

      expect(mockClient.request).toHaveBeenCalledWith('PUT', 
        '/repos/owner/repo/pulls/1/reviews/987654/dismissals',
        { message: 'No longer relevant' }
      );
    });
  });

  describe('Reviewer Management', () => {
    it('should request reviewers', async () => {
      mockClient.request.mockResolvedValue({ data: mockPR });

      const result = await prOps.requestReviewers('owner', 'repo', 1, {
        reviewers: ['user1', 'user2'],
        team_reviewers: ['team1']
      });

      expect(mockClient.request).toHaveBeenCalledWith('POST', 
        '/repos/owner/repo/pulls/1/requested_reviewers', 
        {
          reviewers: ['user1', 'user2'],
          team_reviewers: ['team1']
        }
      );
    });

    it('should require at least one reviewer', async () => {
      await expect(prOps.requestReviewers('owner', 'repo', 1, {}))
        .rejects.toThrow('At least one reviewer');
    });

    it('should remove requested reviewers', async () => {
      mockClient.request.mockResolvedValue({ data: mockPR });

      await prOps.removeRequestedReviewers('owner', 'repo', 1, {
        reviewers: ['user1']
      });

      expect(mockClient.request).toHaveBeenCalledWith('DELETE', 
        '/repos/owner/repo/pulls/1/requested_reviewers',
        { reviewers: ['user1'] }
      );
    });
  });

  describe('Status Checks and CI', () => {
    const mockStatuses = [
      { state: 'success', context: 'ci/test' },
      { state: 'pending', context: 'ci/build' },
      { state: 'failure', context: 'ci/lint' }
    ];

    it('should get status checks', async () => {
      mockClient.request
        .mockResolvedValueOnce({ data: mockPR }) // getPullRequest
        .mockResolvedValueOnce({ // getStatus
          data: { 
            state: 'failure', 
            statuses: mockStatuses,
            total_count: 3
          }
        });

      const result = await prOps.getStatusChecks('owner', 'repo', 1);

      expect(result.state).toBe('failure');
      expect(result.total_count).toBe(3);
      expect(result.summary.success).toBe(1);
      expect(result.summary.pending).toBe(1);
      expect(result.summary.failure).toBe(1);
    });

    it('should handle PR without head SHA', async () => {
      const prWithoutSHA = { ...mockPR, head: null };
      mockClient.request.mockResolvedValueOnce({ data: prWithoutSHA });

      await expect(prOps.getStatusChecks('owner', 'repo', 1))
        .rejects.toThrow('Cannot retrieve status checks');
    });

    const mockCheckRuns = [
      { id: 1, status: 'completed', conclusion: 'success', name: 'test' },
      { id: 2, status: 'in_progress', conclusion: null, name: 'build' },
      { id: 3, status: 'completed', conclusion: 'failure', name: 'lint' }
    ];

    it('should get check runs', async () => {
      mockClient.request
        .mockResolvedValueOnce({ data: mockPR }) // getPullRequest
        .mockResolvedValueOnce({ // getCheckRuns
          data: { 
            check_runs: mockCheckRuns,
            total_count: 3
          },
          headers: {}
        });

      const result = await prOps.getCheckRuns('owner', 'repo', 1);

      expect(result.total_count).toBe(3);
      expect(result.summary.completed).toBe(2);
      expect(result.summary.in_progress).toBe(1);
      expect(result.summary.success).toBe(1);
      expect(result.summary.failure).toBe(1);
    });

    it('should filter check runs by name', async () => {
      mockClient.request
        .mockResolvedValueOnce({ data: mockPR })
        .mockResolvedValueOnce({ data: { check_runs: [], total_count: 0 }, headers: {} });

      await prOps.getCheckRuns('owner', 'repo', 1, { check_name: 'test' });

      expect(mockClient.request).toHaveBeenLastCalledWith('GET',
        `/repos/owner/repo/commits/${mockPR.head.sha}/check-runs`,
        expect.objectContaining({ check_name: 'test' })
      );
    });
  });

  describe('searchPullRequests', () => {
    it('should search pull requests', async () => {
      const searchResults = {
        total_count: 50,
        incomplete_results: false,
        items: [
          { ...mockPR, pull_request: { url: 'https://api.github.com/repos/owner/repo/pulls/1' } }
        ]
      };
      mockClient.request.mockResolvedValue({ 
        data: searchResults,
        headers: {}
      });

      const result = await prOps.searchPullRequests('is:pr is:open repo:owner/repo');

      expect(result.total_count).toBe(50);
      expect(result.pullRequests).toHaveLength(1);
      expect(mockClient.request).toHaveBeenCalledWith('GET', '/search/issues', {
        q: 'is:pr is:open repo:owner/repo',
        sort: 'created',
        order: 'desc',
        per_page: 30,
        page: 1
      });
    });

    it('should filter out non-PR items', async () => {
      const searchResults = {
        total_count: 2,
        incomplete_results: false,
        items: [
          { id: 1, title: 'Issue without pull_request' },
          { ...mockPR, pull_request: { url: 'https://api.github.com/repos/owner/repo/pulls/1' } }
        ]
      };
      mockClient.request.mockResolvedValue({ data: searchResults, headers: {} });

      const result = await prOps.searchPullRequests('is:pr');

      expect(result.pullRequests).toHaveLength(1);
    });
  });

  describe('getDiff', () => {
    it('should get diff format', async () => {
      const diffContent = 'diff --git a/test.js b/test.js\n...';
      mockClient.request.mockResolvedValue({ data: diffContent });

      const result = await prOps.getDiff('owner', 'repo', 1, 'diff');

      expect(result.format).toBe('diff');
      expect(result.content).toBe(diffContent);
      expect(mockClient.request).toHaveBeenCalledWith('GET', '/repos/owner/repo/pulls/1',
        null,
        { headers: { 'Accept': 'application/vnd.github.v3.diff' } }
      );
    });

    it('should get patch format', async () => {
      const patchContent = 'From abc123 Mon Sep 17 00:00:00 2001\n...';
      mockClient.request.mockResolvedValue({ data: patchContent });

      const result = await prOps.getDiff('owner', 'repo', 1, 'patch');

      expect(result.format).toBe('patch');
      expect(mockClient.request).toHaveBeenCalledWith('GET', '/repos/owner/repo/pulls/1',
        null,
        { headers: { 'Accept': 'application/vnd.github.v3.patch' } }
      );
    });

    it('should validate format', async () => {
      await expect(prOps.getDiff('owner', 'repo', 1, 'invalid'))
        .rejects.toThrow('Invalid format');
    });
  });

  describe('updateBranch', () => {
    it('should update pull request branch', async () => {
      const updateResponse = {
        message: 'Updating pull request branch.',
        url: 'https://github.com/owner/repo/pull/1'
      };
      mockClient.request.mockResolvedValue({ data: updateResponse });

      const result = await prOps.updateBranch('owner', 'repo', 1);

      expect(result.success).toBe(true);
      expect(result.message).toBe(updateResponse.message);
      expect(mockClient.request).toHaveBeenCalledWith('PUT', 
        '/repos/owner/repo/pulls/1/update-branch',
        {},
        { headers: { 'Accept': 'application/vnd.github.lydian-preview+json' } }
      );
    });

    it('should handle update failures', async () => {
      const error = {
        response: {
          status: 422,
          data: {
            message: 'Update failed',
            errors: ['Branch is up to date']
          }
        }
      };
      mockClient.request.mockRejectedValue(error);

      const result = await prOps.updateBranch('owner', 'repo', 1);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Update failed');
      expect(result.errors).toEqual(['Branch is up to date']);
    });

    it('should include expected head SHA', async () => {
      mockClient.request.mockResolvedValue({ data: { message: 'Updated' } });

      await prOps.updateBranch('owner', 'repo', 1, 'abc123');

      expect(mockClient.request).toHaveBeenCalledWith('PUT',
        '/repos/owner/repo/pulls/1/update-branch',
        { expected_head_sha: 'abc123' },
        expect.any(Object)
      );
    });
  });

  describe('Bulk Operations', () => {
    it('should perform bulk operations on pull requests', async () => {
      const prNumbers = [1, 2, 3];
      const mockOperation = jest.fn()
        .mockResolvedValueOnce({ number: 1, state: 'closed' })
        .mockResolvedValueOnce({ number: 2, state: 'closed' })
        .mockResolvedValueOnce({ number: 3, state: 'closed' });

      const result = await prOps.bulkOperation('owner', 'repo', prNumbers, mockOperation);

      expect(result.total).toBe(3);
      expect(result.successful).toBe(3);
      expect(result.failed).toBe(0);
      expect(mockOperation).toHaveBeenCalledTimes(3);
    });

    it('should handle bulk operation failures', async () => {
      const prNumbers = [1, 2];
      const mockOperation = jest.fn()
        .mockResolvedValueOnce({ number: 1 })
        .mockRejectedValueOnce(new Error('PR not found'));

      const result = await prOps.bulkOperation('owner', 'repo', prNumbers, mockOperation, {
        continueOnError: true
      });

      expect(result.total).toBe(2);
      expect(result.successful).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.results[1].success).toBe(false);
    });

    it('should require valid PR numbers array', async () => {
      await expect(prOps.bulkOperation('owner', 'repo', [], () => {}))
        .rejects.toThrow('PR numbers array is required');
    });
  });

  describe('Statistics', () => {
    it('should get pull request statistics', async () => {
      const openPRs = { pagination: { last: 5 } };
      const closedPRs = { pagination: { last: 10 } };
      const mergedPRs = { total_count: 8 };

      mockClient.request
        .mockResolvedValueOnce({ data: [], headers: { link: '<page=5>; rel="last"' } })
        .mockResolvedValueOnce({ data: [], headers: { link: '<page=10>; rel="last"' } })
        .mockResolvedValueOnce({ data: mergedPRs, headers: {} });

      const result = await prOps.getStatistics('owner', 'repo');

      expect(result.open).toBe(150); // 5 * 30
      expect(result.closed).toBe(300); // 10 * 30
      expect(result.merged).toBe(8);
      expect(result.mergeRate).toBe('1.8'); // 8/450 * 100
    });
  });

  describe('Helper Methods', () => {
    it('should determine review status', () => {
      const prWithReviewers = { requested_reviewers: ['user1'] };
      const prNoReviewers = { requested_reviewers: [] };

      expect(prOps.determineReviewStatus(prWithReviewers)).toBe('pending_review');
      expect(prOps.determineReviewStatus(prNoReviewers)).toBe('review_complete');
    });

    it('should determine CI status', () => {
      expect(prOps.determineCIStatus({ mergeable_state: 'clean' })).toBe('passing');
      expect(prOps.determineCIStatus({ mergeable_state: 'unstable' })).toBe('failing');
      expect(prOps.determineCIStatus({ mergeable_state: 'pending' })).toBe('pending');
      expect(prOps.determineCIStatus({ mergeable_state: 'unknown' })).toBe('unknown');
    });

    it('should get file type from filename', () => {
      expect(prOps.getFileType('test.js')).toBe('javascript');
      expect(prOps.getFileType('component.tsx')).toBe('tsx');
      expect(prOps.getFileType('README.md')).toBe('markdown');
      expect(prOps.getFileType('unknown.xyz')).toBe('xyz');
    });

    it('should categorize file sizes', () => {
      expect(prOps.categorizeFileSize(5)).toBe('small');
      expect(prOps.categorizeFileSize(25)).toBe('medium');
      expect(prOps.categorizeFileSize(100)).toBe('large');
      expect(prOps.categorizeFileSize(500)).toBe('very_large');
    });

    it('should group files by type', () => {
      const files = [
        { filename: 'test.js', additions: 10, deletions: 2, changes: 12 },
        { filename: 'style.css', additions: 5, deletions: 1, changes: 6 },
        { filename: 'app.js', additions: 8, deletions: 3, changes: 11 }
      ];

      const groups = prOps.groupFilesByType(files);

      expect(groups.javascript.count).toBe(2);
      expect(groups.javascript.additions).toBe(18);
      expect(groups.css.count).toBe(1);
      expect(groups.css.additions).toBe(5);
    });
  });
});