const { chunkArray, sanitizeString } = require('../utils/helpers');

/**
 * GitHub Issues Operations
 * Comprehensive issue management and automation
 */
class IssueOperations {
  constructor(client) {
    this.client = client;
  }

  /**
   * Get single issue
   */
  async getIssue(owner, repo, issueNumber) {
    const response = await this.client.request('GET', `/repos/${owner}/${repo}/issues/${issueNumber}`);
    return this.enhanceIssueData(response.data);
  }

  /**
   * List issues with advanced filtering
   */
  async listIssues(owner, repo, options = {}) {
    const {
      state = 'open', // open, closed, all
      labels,
      sort = 'created',
      direction = 'desc',
      since,
      per_page = 30,
      page = 1,
      assignee,
      creator,
      mentioned,
      milestone,
      ...filters
    } = options;

    const params = {
      state,
      sort,
      direction,
      per_page: Math.min(per_page, 100),
      page,
      ...filters
    };

    // Add optional parameters if provided
    if (labels) params.labels = Array.isArray(labels) ? labels.join(',') : labels;
    if (since) params.since = new Date(since).toISOString();
    if (assignee) params.assignee = assignee;
    if (creator) params.creator = creator;
    if (mentioned) params.mentioned = mentioned;
    if (milestone) params.milestone = milestone;

    const response = await this.client.request('GET', `/repos/${owner}/${repo}/issues`, params);
    
    return {
      issues: response.data.map(issue => this.enhanceIssueData(issue)),
      pagination: this.extractPaginationInfo(response.headers.link)
    };
  }

  /**
   * Create new issue
   */
  async createIssue(owner, repo, issueData) {
    const {
      title,
      body,
      assignees = [],
      milestone,
      labels = [],
      projects = []
    } = issueData;

    if (!title || title.trim().length === 0) {
      throw new Error('Issue title is required');
    }

    const payload = {
      title: title.trim(),
      body: body || '',
      assignees: Array.isArray(assignees) ? assignees : [assignees],
      labels: Array.isArray(labels) ? labels : [labels]
    };

    if (milestone) payload.milestone = milestone;

    const response = await this.client.request('POST', `/repos/${owner}/${repo}/issues`, payload);
    const issue = this.enhanceIssueData(response.data);

    // Add to projects if specified
    if (projects.length > 0) {
      await this.addIssueToProjects(owner, repo, issue.number, projects);
    }

    return issue;
  }

  /**
   * Update existing issue
   */
  async updateIssue(owner, repo, issueNumber, updates) {
    const response = await this.client.request('PATCH', 
      `/repos/${owner}/${repo}/issues/${issueNumber}`, 
      updates
    );
    return this.enhanceIssueData(response.data);
  }

  /**
   * Close issue
   */
  async closeIssue(owner, repo, issueNumber, reason = null) {
    const updates = { state: 'closed' };
    if (reason) {
      updates.state_reason = reason; // completed, not_planned
    }

    return await this.updateIssue(owner, repo, issueNumber, updates);
  }

  /**
   * Reopen issue
   */
  async reopenIssue(owner, repo, issueNumber) {
    return await this.updateIssue(owner, repo, issueNumber, { state: 'open' });
  }

  /**
   * Lock issue conversation
   */
  async lockIssue(owner, repo, issueNumber, lockReason = null) {
    const payload = {};
    if (lockReason) {
      payload.lock_reason = lockReason; // off-topic, too heated, resolved, spam
    }

    await this.client.request('PUT', 
      `/repos/${owner}/${repo}/issues/${issueNumber}/lock`, 
      payload
    );
    
    return { success: true, message: `Issue #${issueNumber} locked` };
  }

  /**
   * Unlock issue conversation
   */
  async unlockIssue(owner, repo, issueNumber) {
    await this.client.request('DELETE', `/repos/${owner}/${repo}/issues/${issueNumber}/lock`);
    return { success: true, message: `Issue #${issueNumber} unlocked` };
  }

  /**
   * Search issues across repositories
   */
  async searchIssues(query, options = {}) {
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
    
    return {
      total_count: response.data.total_count,
      incomplete_results: response.data.incomplete_results,
      issues: response.data.items.map(issue => this.enhanceIssueData(issue)),
      pagination: this.extractPaginationInfo(response.headers.link)
    };
  }

  /**
   * Get issue comments
   */
  async getComments(owner, repo, issueNumber, options = {}) {
    const {
      sort = 'created',
      direction = 'asc',
      since,
      per_page = 30,
      page = 1
    } = options;

    const params = {
      sort,
      direction,
      per_page: Math.min(per_page, 100),
      page
    };

    if (since) params.since = new Date(since).toISOString();

    const response = await this.client.request('GET', 
      `/repos/${owner}/${repo}/issues/${issueNumber}/comments`, 
      params
    );
    
    return {
      comments: response.data.map(comment => this.enhanceCommentData(comment)),
      pagination: this.extractPaginationInfo(response.headers.link)
    };
  }

  /**
   * Create issue comment
   */
  async createComment(owner, repo, issueNumber, body) {
    if (!body || body.trim().length === 0) {
      throw new Error('Comment body is required');
    }

    const response = await this.client.request('POST', 
      `/repos/${owner}/${repo}/issues/${issueNumber}/comments`, 
      { body: body.trim() }
    );
    
    return this.enhanceCommentData(response.data);
  }

  /**
   * Update comment
   */
  async updateComment(owner, repo, commentId, body) {
    const response = await this.client.request('PATCH', 
      `/repos/${owner}/${repo}/issues/comments/${commentId}`, 
      { body }
    );
    
    return this.enhanceCommentData(response.data);
  }

  /**
   * Delete comment
   */
  async deleteComment(owner, repo, commentId) {
    await this.client.request('DELETE', `/repos/${owner}/${repo}/issues/comments/${commentId}`);
    return { success: true, message: `Comment ${commentId} deleted` };
  }

  /**
   * Get issue reactions
   */
  async getReactions(owner, repo, issueNumber) {
    const response = await this.client.request('GET', 
      `/repos/${owner}/${repo}/issues/${issueNumber}/reactions`,
      null,
      { headers: { 'Accept': 'application/vnd.github.squirrel-girl-preview+json' } }
    );
    
    return this.aggregateReactions(response.data);
  }

  /**
   * Add reaction to issue
   */
  async addReaction(owner, repo, issueNumber, content) {
    const validReactions = ['+1', '-1', 'laugh', 'hooray', 'confused', 'heart', 'rocket', 'eyes'];
    
    if (!validReactions.includes(content)) {
      throw new Error(`Invalid reaction. Must be one of: ${validReactions.join(', ')}`);
    }

    const response = await this.client.request('POST', 
      `/repos/${owner}/${repo}/issues/${issueNumber}/reactions`,
      { content },
      { headers: { 'Accept': 'application/vnd.github.squirrel-girl-preview+json' } }
    );
    
    return response.data;
  }

  /**
   * Remove reaction from issue
   */
  async removeReaction(owner, repo, issueNumber, reactionId) {
    await this.client.request('DELETE', 
      `/repos/${owner}/${repo}/issues/${issueNumber}/reactions/${reactionId}`,
      null,
      { headers: { 'Accept': 'application/vnd.github.squirrel-girl-preview+json' } }
    );
    
    return { success: true, message: `Reaction ${reactionId} removed` };
  }

  /**
   * Bulk operations on issues
   */
  async bulkUpdate(owner, repo, issueNumbers, updates, options = {}) {
    const { concurrency = 5, continueOnError = true } = options;
    
    if (!Array.isArray(issueNumbers) || issueNumbers.length === 0) {
      throw new Error('Issue numbers array is required');
    }

    const batches = chunkArray(issueNumbers, concurrency);
    const results = [];

    for (const batch of batches) {
      const batchPromises = batch.map(async (issueNumber) => {
        try {
          const result = await this.updateIssue(owner, repo, issueNumber, updates);
          return { success: true, issueNumber, data: result };
        } catch (error) {
          if (!continueOnError) {
            throw error;
          }
          return { 
            success: false, 
            issueNumber, 
            error: error.message 
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return {
      total: issueNumbers.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    };
  }

  /**
   * Get issue templates
   */
  async getIssueTemplates(owner, repo) {
    const templates = [];
    
    try {
      // Check .github/ISSUE_TEMPLATE/ directory
      const response = await this.client.request('GET', 
        `/repos/${owner}/${repo}/contents/.github/ISSUE_TEMPLATE`
      );
      
      if (Array.isArray(response.data)) {
        for (const file of response.data) {
          if (file.name.endsWith('.md') || file.name.endsWith('.yml') || file.name.endsWith('.yaml')) {
            const content = await this.client.request('GET', file.download_url);
            templates.push({
              name: file.name,
              path: file.path,
              content: content.data,
              type: file.name.endsWith('.md') ? 'markdown' : 'yaml'
            });
          }
        }
      }
    } catch (error) {
      // Templates directory might not exist
    }

    // Also check for legacy templates
    try {
      const legacyTemplates = [
        '.github/ISSUE_TEMPLATE.md',
        'ISSUE_TEMPLATE.md',
        '.github/issue_template.md'
      ];

      for (const templatePath of legacyTemplates) {
        try {
          const response = await this.client.request('GET', 
            `/repos/${owner}/${repo}/contents/${templatePath}`
          );
          
          const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
          templates.push({
            name: templatePath,
            path: templatePath,
            content,
            type: 'markdown',
            legacy: true
          });
        } catch (e) {
          // Template doesn't exist, continue
        }
      }
    } catch (error) {
      // Legacy templates might not exist
    }

    return templates;
  }

  /**
   * Create issue from template
   */
  async createFromTemplate(owner, repo, templateName, data) {
    const templates = await this.getIssueTemplates(owner, repo);
    const template = templates.find(t => t.name === templateName);
    
    if (!template) {
      throw new Error(`Template '${templateName}' not found`);
    }

    let title = data.title || 'New Issue';
    let body = template.content;

    // Replace template variables
    if (data.variables) {
      for (const [key, value] of Object.entries(data.variables)) {
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
        title = title.replace(regex, value);
        body = body.replace(regex, value);
      }
    }

    return await this.createIssue(owner, repo, {
      title,
      body,
      ...data
    });
  }

  /**
   * Get issue timeline
   */
  async getTimeline(owner, repo, issueNumber, options = {}) {
    const { per_page = 30, page = 1 } = options;

    const response = await this.client.request('GET', 
      `/repos/${owner}/${repo}/issues/${issueNumber}/timeline`,
      { per_page: Math.min(per_page, 100), page },
      { headers: { 'Accept': 'application/vnd.github.mockingbird-preview' } }
    );
    
    return {
      timeline: response.data.map(event => this.enhanceTimelineEvent(event)),
      pagination: this.extractPaginationInfo(response.headers.link)
    };
  }

  /**
   * Add issues to projects
   */
  async addIssueToProjects(owner, repo, issueNumber, projectIds) {
    const results = [];
    
    for (const projectId of projectIds) {
      try {
        const response = await this.client.request('POST', 
          `/projects/${projectId}/cards`,
          { 
            content_id: issueNumber,
            content_type: 'Issue'
          },
          { headers: { 'Accept': 'application/vnd.github.inertia-preview+json' } }
        );
        
        results.push({ success: true, projectId, card: response.data });
      } catch (error) {
        results.push({ success: false, projectId, error: error.message });
      }
    }
    
    return results;
  }

  /**
   * Get issue statistics for repository
   */
  async getStatistics(owner, repo, options = {}) {
    const { days = 30 } = options;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const [openIssues, closedIssues, recentIssues] = await Promise.allSettled([
      this.listIssues(owner, repo, { state: 'open', per_page: 1 }),
      this.listIssues(owner, repo, { state: 'closed', per_page: 1 }),
      this.listIssues(owner, repo, { state: 'all', since, per_page: 100 })
    ]);

    const stats = {
      open: this.extractTotalCount(openIssues.value?.pagination) || 0,
      closed: this.extractTotalCount(closedIssues.value?.pagination) || 0,
      recent: recentIssues.status === 'fulfilled' ? recentIssues.value.issues.length : 0
    };

    stats.total = stats.open + stats.closed;
    stats.closeRate = stats.total > 0 ? ((stats.closed / stats.total) * 100).toFixed(1) : 0;

    // Analyze recent activity
    if (recentIssues.status === 'fulfilled' && recentIssues.value.issues.length > 0) {
      const issues = recentIssues.value.issues;
      stats.recentAnalysis = {
        opened: issues.filter(i => new Date(i.created_at) >= new Date(since)).length,
        closed: issues.filter(i => i.closed_at && new Date(i.closed_at) >= new Date(since)).length,
        averageCloseTime: this.calculateAverageCloseTime(issues.filter(i => i.closed_at))
      };
    }

    return stats;
  }

  // Helper methods

  /**
   * Enhance issue data with computed fields
   */
  enhanceIssueData(issue) {
    const createdDate = new Date(issue.created_at);
    const updatedDate = new Date(issue.updated_at);
    const now = new Date();

    return {
      ...issue,
      computed: {
        age_days: Math.floor((now - createdDate) / (1000 * 60 * 60 * 24)),
        days_since_update: Math.floor((now - updatedDate) / (1000 * 60 * 60 * 24)),
        is_stale: (now - updatedDate) > (30 * 24 * 60 * 60 * 1000), // 30 days
        close_time_days: issue.closed_at 
          ? Math.floor((new Date(issue.closed_at) - createdDate) / (1000 * 60 * 60 * 24))
          : null,
        label_count: issue.labels ? issue.labels.length : 0,
        assignee_count: issue.assignees ? issue.assignees.length : 0,
        has_description: !!(issue.body && issue.body.trim().length > 0),
        priority: this.determinePriority(issue)
      }
    };
  }

  /**
   * Enhance comment data with computed fields
   */
  enhanceCommentData(comment) {
    const createdDate = new Date(comment.created_at);
    const updatedDate = new Date(comment.updated_at);

    return {
      ...comment,
      computed: {
        age_days: Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24)),
        is_edited: createdDate.getTime() !== updatedDate.getTime(),
        word_count: comment.body ? comment.body.split(/\s+/).length : 0,
        has_mentions: comment.body ? /@\w+/.test(comment.body) : false
      }
    };
  }

  /**
   * Enhance timeline event data
   */
  enhanceTimelineEvent(event) {
    return {
      ...event,
      computed: {
        age_days: Math.floor((Date.now() - new Date(event.created_at).getTime()) / (1000 * 60 * 60 * 24)),
        event_category: this.categorizeEvent(event.event)
      }
    };
  }

  /**
   * Determine issue priority based on labels and other factors
   */
  determinePriority(issue) {
    if (!issue.labels || !Array.isArray(issue.labels)) return 'normal';

    const priorityLabels = issue.labels.map(l => l.name.toLowerCase());
    
    if (priorityLabels.some(l => l.includes('critical') || l.includes('urgent'))) {
      return 'critical';
    }
    if (priorityLabels.some(l => l.includes('high') || l.includes('important'))) {
      return 'high';
    }
    if (priorityLabels.some(l => l.includes('low') || l.includes('minor'))) {
      return 'low';
    }
    
    return 'normal';
  }

  /**
   * Categorize timeline events
   */
  categorizeEvent(eventType) {
    const categories = {
      'created': 'lifecycle',
      'closed': 'lifecycle',
      'reopened': 'lifecycle',
      'labeled': 'metadata',
      'unlabeled': 'metadata',
      'assigned': 'assignment',
      'unassigned': 'assignment',
      'commented': 'discussion',
      'renamed': 'metadata',
      'locked': 'moderation',
      'unlocked': 'moderation'
    };

    return categories[eventType] || 'other';
  }

  /**
   * Aggregate reactions into summary
   */
  aggregateReactions(reactions) {
    const summary = {
      '+1': 0,
      '-1': 0,
      'laugh': 0,
      'hooray': 0,
      'confused': 0,
      'heart': 0,
      'rocket': 0,
      'eyes': 0,
      total: reactions.length
    };

    reactions.forEach(reaction => {
      summary[reaction.content] = (summary[reaction.content] || 0) + 1;
    });

    return {
      summary,
      details: reactions
    };
  }

  /**
   * Calculate average close time for issues
   */
  calculateAverageCloseTime(closedIssues) {
    if (closedIssues.length === 0) return null;

    const totalTime = closedIssues.reduce((sum, issue) => {
      const created = new Date(issue.created_at);
      const closed = new Date(issue.closed_at);
      return sum + (closed - created);
    }, 0);

    const averageMs = totalTime / closedIssues.length;
    return Math.floor(averageMs / (1000 * 60 * 60 * 24)); // Convert to days
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

module.exports = { IssueOperations };