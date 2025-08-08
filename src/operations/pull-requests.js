const { chunkArray, parseGitHubUrl } = require('../utils/helpers');

/**
 * GitHub Pull Request Operations
 * Comprehensive PR management, reviews, and CI integration
 */
class PullRequestOperations {
  constructor(client) {
    this.client = client;
  }

  /**
   * Get single pull request
   */
  async getPullRequest(owner, repo, prNumber) {
    const response = await this.client.request('GET', `/repos/${owner}/${repo}/pulls/${prNumber}`);
    return this.enhancePRData(response.data);
  }

  /**
   * List pull requests with filtering
   */
  async listPullRequests(owner, repo, options = {}) {
    const {
      state = 'open', // open, closed, all
      head,
      base,
      sort = 'created',
      direction = 'desc',
      per_page = 30,
      page = 1
    } = options;

    const params = {
      state,
      sort,
      direction,
      per_page: Math.min(per_page, 100),
      page
    };

    if (head) params.head = head;
    if (base) params.base = base;

    const response = await this.client.request('GET', `/repos/${owner}/${repo}/pulls`, params);
    
    return {
      pullRequests: response.data.map(pr => this.enhancePRData(pr)),
      pagination: this.extractPaginationInfo(response.headers.link)
    };
  }

  /**
   * Create new pull request
   */
  async createPullRequest(owner, repo, prData) {
    const {
      title,
      head,
      base,
      body = '',
      maintainer_can_modify = true,
      draft = false
    } = prData;

    if (!title || title.trim().length === 0) {
      throw new Error('Pull request title is required');
    }

    if (!head || !base) {
      throw new Error('Both head and base branches are required');
    }

    const payload = {
      title: title.trim(),
      head,
      base,
      body,
      maintainer_can_modify,
      draft
    };

    const response = await this.client.request('POST', `/repos/${owner}/${repo}/pulls`, payload);
    return this.enhancePRData(response.data);
  }

  /**
   * Update existing pull request
   */
  async updatePullRequest(owner, repo, prNumber, updates) {
    const response = await this.client.request('PATCH', 
      `/repos/${owner}/${repo}/pulls/${prNumber}`, 
      updates
    );
    return this.enhancePRData(response.data);
  }

  /**
   * Close pull request
   */
  async closePullRequest(owner, repo, prNumber) {
    return await this.updatePullRequest(owner, repo, prNumber, { state: 'closed' });
  }

  /**
   * Reopen pull request
   */
  async reopenPullRequest(owner, repo, prNumber) {
    return await this.updatePullRequest(owner, repo, prNumber, { state: 'open' });
  }

  /**
   * Convert to draft
   */
  async convertToDraft(owner, repo, prNumber) {
    const response = await this.client.request('POST', 
      `/repos/${owner}/${repo}/pulls/${prNumber}/convert_to_draft`,
      null,
      { headers: { 'Accept': 'application/vnd.github.shadow-cat-preview+json' } }
    );
    return this.enhancePRData(response.data);
  }

  /**
   * Mark as ready for review
   */
  async markReadyForReview(owner, repo, prNumber) {
    const response = await this.client.request('POST', 
      `/repos/${owner}/${repo}/pulls/${prNumber}/ready_for_review`,
      null,
      { headers: { 'Accept': 'application/vnd.github.shadow-cat-preview+json' } }
    );
    return this.enhancePRData(response.data);
  }

  /**
   * Merge pull request
   */
  async mergePullRequest(owner, repo, prNumber, options = {}) {
    const {
      commit_title,
      commit_message,
      merge_method = 'merge' // merge, squash, rebase
    } = options;

    const validMethods = ['merge', 'squash', 'rebase'];
    if (!validMethods.includes(merge_method)) {
      throw new Error(`Invalid merge method. Must be one of: ${validMethods.join(', ')}`);
    }

    const payload = { merge_method };
    if (commit_title) payload.commit_title = commit_title;
    if (commit_message) payload.commit_message = commit_message;

    const response = await this.client.request('PUT', 
      `/repos/${owner}/${repo}/pulls/${prNumber}/merge`, 
      payload
    );
    
    return {
      success: true,
      sha: response.data.sha,
      merged: response.data.merged,
      message: response.data.message
    };
  }

  /**
   * Check if pull request is mergeable
   */
  async checkMergeability(owner, repo, prNumber) {
    const pr = await this.getPullRequest(owner, repo, prNumber);
    
    return {
      mergeable: pr.mergeable,
      mergeable_state: pr.mergeable_state,
      rebaseable: pr.rebaseable,
      can_merge: pr.mergeable === true && pr.mergeable_state === 'clean',
      blocking_issues: this.identifyMergeBlockers(pr)
    };
  }

  /**
   * Get pull request files
   */
  async getFiles(owner, repo, prNumber, options = {}) {
    const { per_page = 30, page = 1 } = options;

    const params = {
      per_page: Math.min(per_page, 100),
      page
    };

    const response = await this.client.request('GET', 
      `/repos/${owner}/${repo}/pulls/${prNumber}/files`, 
      params
    );
    
    return {
      files: response.data.map(file => this.enhanceFileData(file)),
      pagination: this.extractPaginationInfo(response.headers.link),
      summary: this.calculateFilesSummary(response.data)
    };
  }

  /**
   * Get pull request commits
   */
  async getCommits(owner, repo, prNumber, options = {}) {
    const { per_page = 30, page = 1 } = options;

    const params = {
      per_page: Math.min(per_page, 100),
      page
    };

    const response = await this.client.request('GET', 
      `/repos/${owner}/${repo}/pulls/${prNumber}/commits`, 
      params
    );
    
    return {
      commits: response.data.map(commit => this.enhanceCommitData(commit)),
      pagination: this.extractPaginationInfo(response.headers.link),
      summary: this.calculateCommitsSummary(response.data)
    };
  }

  /**
   * Get pull request reviews
   */
  async getReviews(owner, repo, prNumber, options = {}) {
    const { per_page = 30, page = 1 } = options;

    const params = {
      per_page: Math.min(per_page, 100),
      page
    };

    const response = await this.client.request('GET', 
      `/repos/${owner}/${repo}/pulls/${prNumber}/reviews`, 
      params
    );
    
    return {
      reviews: response.data.map(review => this.enhanceReviewData(review)),
      pagination: this.extractPaginationInfo(response.headers.link),
      summary: this.calculateReviewsSummary(response.data)
    };
  }

  /**
   * Create pull request review
   */
  async createReview(owner, repo, prNumber, reviewData) {
    const {
      body = '',
      event = 'COMMENT', // COMMENT, APPROVE, REQUEST_CHANGES
      comments = []
    } = reviewData;

    const validEvents = ['COMMENT', 'APPROVE', 'REQUEST_CHANGES'];
    if (!validEvents.includes(event)) {
      throw new Error(`Invalid review event. Must be one of: ${validEvents.join(', ')}`);
    }

    const payload = {
      body,
      event,
      comments: comments.map(comment => ({
        path: comment.path,
        line: comment.line,
        body: comment.body,
        side: comment.side || 'RIGHT'
      }))
    };

    const response = await this.client.request('POST', 
      `/repos/${owner}/${repo}/pulls/${prNumber}/reviews`, 
      payload
    );
    
    return this.enhanceReviewData(response.data);
  }

  /**
   * Submit pending review
   */
  async submitReview(owner, repo, prNumber, reviewId, body, event) {
    const validEvents = ['APPROVE', 'REQUEST_CHANGES', 'COMMENT'];
    if (!validEvents.includes(event)) {
      throw new Error(`Invalid review event. Must be one of: ${validEvents.join(', ')}`);
    }

    const payload = { body, event };

    const response = await this.client.request('POST', 
      `/repos/${owner}/${repo}/pulls/${prNumber}/reviews/${reviewId}/events`, 
      payload
    );
    
    return this.enhanceReviewData(response.data);
  }

  /**
   * Dismiss review
   */
  async dismissReview(owner, repo, prNumber, reviewId, message) {
    const response = await this.client.request('PUT', 
      `/repos/${owner}/${repo}/pulls/${prNumber}/reviews/${reviewId}/dismissals`,
      { message }
    );
    
    return this.enhanceReviewData(response.data);
  }

  /**
   * Request reviewers
   */
  async requestReviewers(owner, repo, prNumber, reviewers) {
    const {
      reviewers: individualReviewers = [],
      team_reviewers = []
    } = reviewers;

    if (individualReviewers.length === 0 && team_reviewers.length === 0) {
      throw new Error('At least one reviewer (individual or team) is required');
    }

    const payload = {};
    if (individualReviewers.length > 0) payload.reviewers = individualReviewers;
    if (team_reviewers.length > 0) payload.team_reviewers = team_reviewers;

    const response = await this.client.request('POST', 
      `/repos/${owner}/${repo}/pulls/${prNumber}/requested_reviewers`, 
      payload
    );
    
    return this.enhancePRData(response.data);
  }

  /**
   * Remove requested reviewers
   */
  async removeRequestedReviewers(owner, repo, prNumber, reviewers) {
    const {
      reviewers: individualReviewers = [],
      team_reviewers = []
    } = reviewers;

    const payload = {};
    if (individualReviewers.length > 0) payload.reviewers = individualReviewers;
    if (team_reviewers.length > 0) payload.team_reviewers = team_reviewers;

    const response = await this.client.request('DELETE', 
      `/repos/${owner}/${repo}/pulls/${prNumber}/requested_reviewers`, 
      payload
    );
    
    return this.enhancePRData(response.data);
  }

  /**
   * Get pull request status checks
   */
  async getStatusChecks(owner, repo, prNumber) {
    const pr = await this.getPullRequest(owner, repo, prNumber);
    
    if (!pr.head || !pr.head.sha) {
      throw new Error('Cannot retrieve status checks: PR head SHA not available');
    }

    const response = await this.client.request('GET', 
      `/repos/${owner}/${repo}/commits/${pr.head.sha}/status`
    );
    
    return {
      state: response.data.state,
      statuses: response.data.statuses.map(status => this.enhanceStatusData(status)),
      total_count: response.data.total_count,
      summary: this.calculateStatusSummary(response.data.statuses)
    };
  }

  /**
   * Get pull request check runs (GitHub Actions, etc.)
   */
  async getCheckRuns(owner, repo, prNumber, options = {}) {
    const pr = await this.getPullRequest(owner, repo, prNumber);
    
    if (!pr.head || !pr.head.sha) {
      throw new Error('Cannot retrieve check runs: PR head SHA not available');
    }

    const {
      check_name,
      status, // queued, in_progress, completed
      filter = 'latest',
      per_page = 30,
      page = 1
    } = options;

    const params = {
      filter,
      per_page: Math.min(per_page, 100),
      page
    };

    if (check_name) params.check_name = check_name;
    if (status) params.status = status;

    const response = await this.client.request('GET', 
      `/repos/${owner}/${repo}/commits/${pr.head.sha}/check-runs`,
      params
    );
    
    return {
      check_runs: response.data.check_runs.map(run => this.enhanceCheckRunData(run)),
      total_count: response.data.total_count,
      pagination: this.extractPaginationInfo(response.headers.link),
      summary: this.calculateCheckRunsSummary(response.data.check_runs)
    };
  }

  /**
   * Search pull requests
   */
  async searchPullRequests(query, options = {}) {
    const {
      sort = 'created',
      order = 'desc',
      per_page = 30,
      page = 1
    } = options;

    const params = {
      q: query,
      sort,
      order,
      per_page: Math.min(per_page, 100),
      page
    };

    const response = await this.client.request('GET', '/search/issues', params);
    
    // Filter only pull requests from the results
    const pullRequests = response.data.items.filter(item => item.pull_request);
    
    return {
      total_count: response.data.total_count,
      incomplete_results: response.data.incomplete_results,
      pullRequests: pullRequests.map(pr => this.enhancePRData(pr)),
      pagination: this.extractPaginationInfo(response.headers.link)
    };
  }

  /**
   * Get pull request diff
   */
  async getDiff(owner, repo, prNumber, format = 'diff') {
    const validFormats = ['diff', 'patch'];
    if (!validFormats.includes(format)) {
      throw new Error(`Invalid format. Must be one of: ${validFormats.join(', ')}`);
    }

    const acceptHeader = format === 'diff' 
      ? 'application/vnd.github.v3.diff'
      : 'application/vnd.github.v3.patch';

    const response = await this.client.request('GET', 
      `/repos/${owner}/${repo}/pulls/${prNumber}`,
      null,
      { headers: { 'Accept': acceptHeader } }
    );
    
    return {
      format,
      content: response.data,
      size: response.data.length
    };
  }

  /**
   * Update pull request branch
   */
  async updateBranch(owner, repo, prNumber, expectedHeadSha = null) {
    const payload = {};
    if (expectedHeadSha) {
      payload.expected_head_sha = expectedHeadSha;
    }

    try {
      const response = await this.client.request('PUT', 
        `/repos/${owner}/${repo}/pulls/${prNumber}/update-branch`,
        payload,
        { headers: { 'Accept': 'application/vnd.github.lydian-preview+json' } }
      );
      
      return {
        success: true,
        message: response.data.message,
        url: response.data.url
      };
    } catch (error) {
      if (error.response?.status === 422) {
        return {
          success: false,
          message: error.response.data.message,
          errors: error.response.data.errors
        };
      }
      throw error;
    }
  }

  /**
   * Bulk operations on pull requests
   */
  async bulkOperation(owner, repo, prNumbers, operation, options = {}) {
    const { concurrency = 3, continueOnError = true, delay = 1000 } = options;
    
    if (!Array.isArray(prNumbers) || prNumbers.length === 0) {
      throw new Error('PR numbers array is required');
    }

    const batches = chunkArray(prNumbers, concurrency);
    const results = [];

    for (const batch of batches) {
      const batchPromises = batch.map(async (prNumber, index) => {
        try {
          // Add delay to avoid overwhelming the API
          if (index > 0) {
            await new Promise(resolve => setTimeout(resolve, delay * index));
          }

          const result = await operation(prNumber);
          return { success: true, prNumber, data: result };
        } catch (error) {
          if (!continueOnError) {
            throw error;
          }
          return { 
            success: false, 
            prNumber, 
            error: error.message 
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return {
      total: prNumbers.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    };
  }

  /**
   * Get pull request statistics for repository
   */
  async getStatistics(owner, repo, options = {}) {
    const { days = 30 } = options;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const [openPRs, closedPRs, mergedPRs] = await Promise.allSettled([
      this.listPullRequests(owner, repo, { state: 'open', per_page: 1 }),
      this.listPullRequests(owner, repo, { state: 'closed', per_page: 1 }),
      this.searchPullRequests(`repo:${owner}/${repo} is:pr is:merged merged:>${since.split('T')[0]}`)
    ]);

    const stats = {
      open: this.extractTotalCount(openPRs.value?.pagination) || 0,
      closed: this.extractTotalCount(closedPRs.value?.pagination) || 0,
      merged: mergedPRs.status === 'fulfilled' ? mergedPRs.value.total_count : 0
    };

    stats.total = stats.open + stats.closed;
    stats.mergeRate = stats.total > 0 ? ((stats.merged / stats.total) * 100).toFixed(1) : 0;

    return stats;
  }

  // Helper methods

  /**
   * Enhance pull request data with computed fields
   */
  enhancePRData(pr) {
    const createdDate = new Date(pr.created_at);
    const updatedDate = new Date(pr.updated_at);
    const now = new Date();

    return {
      ...pr,
      computed: {
        age_days: Math.floor((now - createdDate) / (1000 * 60 * 60 * 24)),
        days_since_update: Math.floor((now - updatedDate) / (1000 * 60 * 60 * 24)),
        is_stale: (now - updatedDate) > (7 * 24 * 60 * 60 * 1000), // 7 days
        is_draft: pr.draft || false,
        has_conflicts: pr.mergeable === false,
        review_status: this.determineReviewStatus(pr),
        ci_status: this.determineCIStatus(pr),
        branch_ahead: pr.head?.sha !== pr.base?.sha,
        cross_repo: pr.head?.repo?.full_name !== pr.base?.repo?.full_name
      }
    };
  }

  /**
   * Enhance file data with computed fields
   */
  enhanceFileData(file) {
    return {
      ...file,
      computed: {
        file_type: this.getFileType(file.filename),
        is_binary: file.additions === 0 && file.deletions === 0 && file.changes > 0,
        change_ratio: file.changes > 0 ? (file.additions / file.changes) : 0,
        size_category: this.categorizeFileSize(file.changes)
      }
    };
  }

  /**
   * Enhance commit data
   */
  enhanceCommitData(commit) {
    return {
      ...commit,
      computed: {
        age_days: Math.floor((Date.now() - new Date(commit.commit.committer.date).getTime()) / (1000 * 60 * 60 * 24)),
        message_length: commit.commit.message.length,
        has_gpg_signature: !!commit.commit.verification?.verified
      }
    };
  }

  /**
   * Enhance review data
   */
  enhanceReviewData(review) {
    return {
      ...review,
      computed: {
        age_days: Math.floor((Date.now() - new Date(review.submitted_at).getTime()) / (1000 * 60 * 60 * 24)),
        has_comments: review.body && review.body.trim().length > 0,
        review_type: this.categorizeReviewType(review.state)
      }
    };
  }

  /**
   * Enhance status check data
   */
  enhanceStatusData(status) {
    return {
      ...status,
      computed: {
        age_minutes: Math.floor((Date.now() - new Date(status.created_at).getTime()) / (1000 * 60)),
        is_successful: status.state === 'success',
        is_pending: status.state === 'pending'
      }
    };
  }

  /**
   * Enhance check run data
   */
  enhanceCheckRunData(checkRun) {
    const startedAt = new Date(checkRun.started_at);
    const completedAt = checkRun.completed_at ? new Date(checkRun.completed_at) : null;

    return {
      ...checkRun,
      computed: {
        duration_minutes: completedAt 
          ? Math.floor((completedAt - startedAt) / (1000 * 60))
          : null,
        is_successful: checkRun.conclusion === 'success',
        is_failed: checkRun.conclusion === 'failure',
        is_running: checkRun.status === 'in_progress'
      }
    };
  }

  /**
   * Determine review status
   */
  determineReviewStatus(pr) {
    if (!pr.requested_reviewers && !pr.requested_teams) {
      return 'no_reviewers';
    }
    
    const hasReviewers = (pr.requested_reviewers && pr.requested_reviewers.length > 0) ||
                        (pr.requested_teams && pr.requested_teams.length > 0);
    
    if (hasReviewers) {
      return 'pending_review';
    }
    
    return 'review_complete';
  }

  /**
   * Determine CI status
   */
  determineCIStatus(pr) {
    // This is a basic implementation - in practice you'd check actual CI status
    if (pr.mergeable_state === 'clean') return 'passing';
    if (pr.mergeable_state === 'unstable') return 'failing';
    if (pr.mergeable_state === 'pending') return 'pending';
    return 'unknown';
  }

  /**
   * Get file type from filename
   */
  getFileType(filename) {
    const extension = filename.split('.').pop().toLowerCase();
    const typeMap = {
      'js': 'javascript',
      'ts': 'typescript',
      'py': 'python',
      'rb': 'ruby',
      'go': 'go',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'php': 'php',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'md': 'markdown',
      'json': 'json',
      'xml': 'xml',
      'yml': 'yaml',
      'yaml': 'yaml'
    };
    
    return typeMap[extension] || extension || 'unknown';
  }

  /**
   * Categorize file size by changes
   */
  categorizeFileSize(changes) {
    if (changes <= 10) return 'small';
    if (changes <= 50) return 'medium';
    if (changes <= 200) return 'large';
    return 'very_large';
  }

  /**
   * Categorize review type
   */
  categorizeReviewType(state) {
    const types = {
      'APPROVED': 'approval',
      'CHANGES_REQUESTED': 'change_request',
      'COMMENTED': 'comment',
      'DISMISSED': 'dismissed'
    };
    
    return types[state] || 'unknown';
  }

  /**
   * Calculate files summary
   */
  calculateFilesSummary(files) {
    return {
      total_files: files.length,
      additions: files.reduce((sum, file) => sum + file.additions, 0),
      deletions: files.reduce((sum, file) => sum + file.deletions, 0),
      changes: files.reduce((sum, file) => sum + file.changes, 0),
      file_types: this.groupFilesByType(files)
    };
  }

  /**
   * Calculate commits summary
   */
  calculateCommitsSummary(commits) {
    const authors = new Set(commits.map(c => c.commit.author.email));
    
    return {
      total_commits: commits.length,
      unique_authors: authors.size,
      authors: Array.from(authors),
      first_commit: commits[commits.length - 1]?.sha,
      last_commit: commits[0]?.sha
    };
  }

  /**
   * Calculate reviews summary
   */
  calculateReviewsSummary(reviews) {
    const summary = {
      total_reviews: reviews.length,
      approvals: 0,
      change_requests: 0,
      comments: 0,
      dismissed: 0,
      unique_reviewers: new Set()
    };

    reviews.forEach(review => {
      summary.unique_reviewers.add(review.user.login);
      
      switch (review.state) {
        case 'APPROVED':
          summary.approvals++;
          break;
        case 'CHANGES_REQUESTED':
          summary.change_requests++;
          break;
        case 'COMMENTED':
          summary.comments++;
          break;
        case 'DISMISSED':
          summary.dismissed++;
          break;
      }
    });

    summary.unique_reviewers = Array.from(summary.unique_reviewers);
    summary.reviewer_count = summary.unique_reviewers.length;
    
    return summary;
  }

  /**
   * Calculate status summary
   */
  calculateStatusSummary(statuses) {
    const summary = {
      total: statuses.length,
      success: 0,
      pending: 0,
      failure: 0,
      error: 0
    };

    statuses.forEach(status => {
      summary[status.state] = (summary[status.state] || 0) + 1;
    });

    return summary;
  }

  /**
   * Calculate check runs summary
   */
  calculateCheckRunsSummary(checkRuns) {
    const summary = {
      total: checkRuns.length,
      queued: 0,
      in_progress: 0,
      completed: 0,
      success: 0,
      failure: 0,
      neutral: 0,
      cancelled: 0,
      skipped: 0,
      stale: 0,
      timed_out: 0
    };

    checkRuns.forEach(run => {
      summary[run.status]++;
      if (run.conclusion) {
        summary[run.conclusion]++;
      }
    });

    return summary;
  }

  /**
   * Group files by type
   */
  groupFilesByType(files) {
    const groups = {};
    
    files.forEach(file => {
      const type = this.getFileType(file.filename);
      if (!groups[type]) {
        groups[type] = {
          count: 0,
          additions: 0,
          deletions: 0,
          changes: 0
        };
      }
      
      groups[type].count++;
      groups[type].additions += file.additions;
      groups[type].deletions += file.deletions;
      groups[type].changes += file.changes;
    });

    return groups;
  }

  /**
   * Identify merge blockers
   */
  identifyMergeBlockers(pr) {
    const blockers = [];

    if (pr.mergeable === false) {
      blockers.push({
        type: 'merge_conflict',
        message: 'Pull request has merge conflicts that must be resolved'
      });
    }

    if (pr.mergeable_state === 'blocked') {
      blockers.push({
        type: 'required_checks',
        message: 'Required status checks are not passing'
      });
    }

    if (pr.mergeable_state === 'behind') {
      blockers.push({
        type: 'behind_base',
        message: 'Pull request is behind the base branch'
      });
    }

    if (pr.draft) {
      blockers.push({
        type: 'draft',
        message: 'Pull request is in draft state'
      });
    }

    return blockers;
  }

  /**
   * Extract pagination info from Link header
   */
  extractPaginationInfo(linkHeader) {
    if (!linkHeader) return null;

    const links = {};
    const parts = linkHeader.split(',');

    for (const part of parts) {
      const section = part.split(';');
      if (section.length !== 2) continue;

      const url = section[0].replace(/<(.*)>/, '$1').trim();
      const rel = section[1].replace(/rel="(.*)"/, '$1').trim();
      
      const pageMatch = url.match(/[?&]page=(\d+)/);
      if (pageMatch) {
        links[rel] = parseInt(pageMatch[1]);
      }
    }

    return links;
  }

  /**
   * Extract total count from pagination info
   */
  extractTotalCount(pagination) {
    if (!pagination || !pagination.last) return null;
    return pagination.last * 30; // Approximate (assumes 30 per page)
  }
}

module.exports = { PullRequestOperations };