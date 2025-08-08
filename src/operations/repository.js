const { parseGitHubUrl, isValidRepoName, isValidGitHubName, chunkArray } = require('../utils/helpers');

/**
 * GitHub Repository Operations
 * Comprehensive repository management and analysis
 */
class RepositoryOperations {
  constructor(client) {
    this.client = client;
  }

  /**
   * Get repository information
   */
  async getRepository(owner, repo) {
    const response = await this.client.request('GET', `/repos/${owner}/${repo}`);
    return this.enhanceRepositoryData(response.data);
  }

  /**
   * List repositories for a user or organization
   */
  async listRepositories(owner, options = {}) {
    const {
      type = 'all', // all, owner, member
      sort = 'updated',
      direction = 'desc',
      per_page = 30,
      page = 1,
      visibility = 'all' // all, public, private
    } = options;

    const params = {
      type,
      sort,
      direction,
      per_page: Math.min(per_page, 100),
      page,
      visibility
    };

    const endpoint = owner.startsWith('orgs/') 
      ? `/orgs/${owner.replace('orgs/', '')}/repos`
      : `/users/${owner}/repos`;

    const response = await this.client.request('GET', endpoint, params);
    
    return {
      repositories: response.data.map(repo => this.enhanceRepositoryData(repo)),
      pagination: this.extractPaginationInfo(response.headers.link)
    };
  }

  /**
   * Create a new repository
   */
  async createRepository(options) {
    const {
      name,
      description,
      private: isPrivate = false,
      has_issues = true,
      has_projects = true,
      has_wiki = true,
      auto_init = false,
      gitignore_template,
      license_template,
      allow_squash_merge = true,
      allow_merge_commit = true,
      allow_rebase_merge = true,
      delete_branch_on_merge = false,
      archived = false,
      visibility = isPrivate ? 'private' : 'public',
      ...additionalOptions
    } = options;

    if (!name || !isValidRepoName(name)) {
      throw new Error('Invalid repository name');
    }

    const payload = {
      name,
      description,
      private: isPrivate,
      has_issues,
      has_projects,
      has_wiki,
      auto_init,
      gitignore_template,
      license_template,
      allow_squash_merge,
      allow_merge_commit,
      allow_rebase_merge,
      delete_branch_on_merge,
      archived,
      visibility,
      ...additionalOptions
    };

    // Remove undefined values
    Object.keys(payload).forEach(key => {
      if (payload[key] === undefined) {
        delete payload[key];
      }
    });

    const endpoint = options.organization 
      ? `/orgs/${options.organization}/repos`
      : '/user/repos';

    const response = await this.client.request('POST', endpoint, payload);
    return this.enhanceRepositoryData(response.data);
  }

  /**
   * Update repository settings
   */
  async updateRepository(owner, repo, updates) {
    const response = await this.client.request('PATCH', `/repos/${owner}/${repo}`, updates);
    return this.enhanceRepositoryData(response.data);
  }

  /**
   * Delete a repository
   */
  async deleteRepository(owner, repo, confirmName) {
    if (confirmName !== repo) {
      throw new Error('Repository name confirmation required for deletion');
    }

    await this.client.request('DELETE', `/repos/${owner}/${repo}`);
    return { success: true, message: `Repository ${owner}/${repo} deleted successfully` };
  }

  /**
   * Archive/Unarchive repository
   */
  async archiveRepository(owner, repo, archived = true) {
    return await this.updateRepository(owner, repo, { archived });
  }

  /**
   * Transfer repository ownership
   */
  async transferRepository(owner, repo, newOwner, options = {}) {
    const payload = {
      new_owner: newOwner,
      ...options
    };

    const response = await this.client.request('POST', `/repos/${owner}/${repo}/transfer`, payload);
    return this.enhanceRepositoryData(response.data);
  }

  /**
   * Get repository topics
   */
  async getTopics(owner, repo) {
    const response = await this.client.request('GET', `/repos/${owner}/${repo}/topics`, null, {
      headers: { 'Accept': 'application/vnd.github.mercy-preview+json' }
    });
    return response.data;
  }

  /**
   * Replace repository topics
   */
  async setTopics(owner, repo, topics) {
    if (!Array.isArray(topics) || topics.length > 20) {
      throw new Error('Topics must be an array with maximum 20 items');
    }

    const response = await this.client.request('PUT', `/repos/${owner}/${repo}/topics`, 
      { names: topics }, 
      { headers: { 'Accept': 'application/vnd.github.mercy-preview+json' } }
    );
    return response.data;
  }

  /**
   * Get repository languages
   */
  async getLanguages(owner, repo) {
    const response = await this.client.request('GET', `/repos/${owner}/${repo}/languages`);
    
    const languages = response.data;
    const total = Object.values(languages).reduce((sum, bytes) => sum + bytes, 0);
    
    return {
      languages,
      total,
      percentages: Object.entries(languages).reduce((acc, [lang, bytes]) => {
        acc[lang] = ((bytes / total) * 100).toFixed(1);
        return acc;
      }, {}),
      primary: Object.entries(languages).sort(([,a], [,b]) => b - a)[0]?.[0] || null
    };
  }

  /**
   * Get repository statistics
   */
  async getStatistics(owner, repo) {
    const [
      repoData,
      contributors,
      languages,
      commits,
      releases,
      issues,
      pullRequests
    ] = await Promise.allSettled([
      this.getRepository(owner, repo),
      this.client.request('GET', `/repos/${owner}/${repo}/contributors`),
      this.getLanguages(owner, repo),
      this.client.request('GET', `/repos/${owner}/${repo}/commits`, { per_page: 1 }),
      this.client.request('GET', `/repos/${owner}/${repo}/releases`, { per_page: 10 }),
      this.client.request('GET', `/repos/${owner}/${repo}/issues`, { state: 'all', per_page: 1 }),
      this.client.request('GET', `/repos/${owner}/${repo}/pulls`, { state: 'all', per_page: 1 })
    ]);

    return {
      repository: repoData.status === 'fulfilled' ? repoData.value : null,
      contributors: {
        count: contributors.status === 'fulfilled' ? contributors.value.data.length : 0,
        data: contributors.status === 'fulfilled' ? contributors.value.data.slice(0, 10) : []
      },
      languages: languages.status === 'fulfilled' ? languages.value : { languages: {}, total: 0 },
      activity: {
        lastCommitDate: commits.status === 'fulfilled' && commits.value.data[0] 
          ? commits.value.data[0].commit.committer.date 
          : null,
        totalCommits: this.extractTotalFromLinkHeader(commits.value?.headers?.link) || 0
      },
      releases: {
        count: releases.status === 'fulfilled' ? releases.value.data.length : 0,
        latest: releases.status === 'fulfilled' ? releases.value.data[0] : null
      },
      issues: {
        total: this.extractTotalFromLinkHeader(issues.value?.headers?.link) || 0
      },
      pullRequests: {
        total: this.extractTotalFromLinkHeader(pullRequests.value?.headers?.link) || 0
      }
    };
  }

  /**
   * Search repositories
   */
  async searchRepositories(query, options = {}) {
    const {
      sort = 'best-match',
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

    const response = await this.client.request('GET', '/search/repositories', params);
    
    return {
      total_count: response.data.total_count,
      incomplete_results: response.data.incomplete_results,
      repositories: response.data.items.map(repo => this.enhanceRepositoryData(repo)),
      pagination: this.extractPaginationInfo(response.headers.link)
    };
  }

  /**
   * Get repository branches
   */
  async getBranches(owner, repo, options = {}) {
    const { protected_only = false, per_page = 30, page = 1 } = options;
    
    const params = { per_page: Math.min(per_page, 100), page };
    if (protected_only) {
      params.protected = true;
    }

    const response = await this.client.request('GET', `/repos/${owner}/${repo}/branches`, params);
    
    return {
      branches: response.data,
      pagination: this.extractPaginationInfo(response.headers.link)
    };
  }

  /**
   * Get branch protection
   */
  async getBranchProtection(owner, repo, branch) {
    try {
      const response = await this.client.request('GET', 
        `/repos/${owner}/${repo}/branches/${branch}/protection`
      );
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        return null; // Branch not protected
      }
      throw error;
    }
  }

  /**
   * Update branch protection
   */
  async updateBranchProtection(owner, repo, branch, protection) {
    const defaultProtection = {
      required_status_checks: null,
      enforce_admins: false,
      required_pull_request_reviews: null,
      restrictions: null,
      allow_force_pushes: false,
      allow_deletions: false
    };

    const payload = { ...defaultProtection, ...protection };

    const response = await this.client.request('PUT', 
      `/repos/${owner}/${repo}/branches/${branch}/protection`,
      payload
    );
    
    return response.data;
  }

  /**
   * Remove branch protection
   */
  async removeBranchProtection(owner, repo, branch) {
    await this.client.request('DELETE', 
      `/repos/${owner}/${repo}/branches/${branch}/protection`
    );
    return { success: true, message: `Branch protection removed from ${branch}` };
  }

  /**
   * Get repository webhooks
   */
  async getWebhooks(owner, repo) {
    const response = await this.client.request('GET', `/repos/${owner}/${repo}/hooks`);
    return response.data;
  }

  /**
   * Create webhook
   */
  async createWebhook(owner, repo, webhook) {
    const {
      name = 'web',
      config = {},
      events = ['push'],
      active = true
    } = webhook;

    if (!config.url) {
      throw new Error('Webhook URL is required');
    }

    const payload = {
      name,
      config: {
        url: config.url,
        content_type: config.content_type || 'json',
        secret: config.secret,
        insecure_ssl: config.insecure_ssl || '0'
      },
      events,
      active
    };

    const response = await this.client.request('POST', `/repos/${owner}/${repo}/hooks`, payload);
    return response.data;
  }

  /**
   * Update webhook
   */
  async updateWebhook(owner, repo, hookId, updates) {
    const response = await this.client.request('PATCH', 
      `/repos/${owner}/${repo}/hooks/${hookId}`, 
      updates
    );
    return response.data;
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(owner, repo, hookId) {
    await this.client.request('DELETE', `/repos/${owner}/${repo}/hooks/${hookId}`);
    return { success: true, message: `Webhook ${hookId} deleted successfully` };
  }

  /**
   * Test webhook
   */
  async testWebhook(owner, repo, hookId) {
    await this.client.request('POST', `/repos/${owner}/${repo}/hooks/${hookId}/tests`);
    return { success: true, message: `Webhook ${hookId} test triggered` };
  }

  /**
   * Batch operations for multiple repositories
   */
  async batchOperation(repositories, operation, options = {}) {
    const { concurrency = 5, continueOnError = true } = options;
    
    const batches = chunkArray(repositories, concurrency);
    const results = [];

    for (const batch of batches) {
      const batchPromises = batch.map(async (repoInfo) => {
        try {
          const { owner, repo } = typeof repoInfo === 'string' 
            ? this.parseRepoString(repoInfo) 
            : repoInfo;
          
          const result = await operation(owner, repo);
          return { success: true, owner, repo, data: result };
        } catch (error) {
          if (!continueOnError) {
            throw error;
          }
          return { 
            success: false, 
            owner: repoInfo.owner || 'unknown',
            repo: repoInfo.repo || repoInfo,
            error: error.message 
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return {
      total: repositories.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    };
  }

  /**
   * Clone repository (returns clone URL and instructions)
   */
  async getCloneInfo(owner, repo) {
    const repoData = await this.getRepository(owner, repo);
    
    return {
      repository: repoData,
      clone_urls: {
        https: repoData.clone_url,
        ssh: repoData.ssh_url,
        github_cli: `gh repo clone ${owner}/${repo}`
      },
      instructions: {
        https: `git clone ${repoData.clone_url}`,
        ssh: `git clone ${repoData.ssh_url}`,
        github_cli: `gh repo clone ${owner}/${repo}`
      }
    };
  }

  /**
   * Get repository insights and recommendations
   */
  async getInsights(owner, repo) {
    const stats = await this.getStatistics(owner, repo);
    const languages = await this.getLanguages(owner, repo);
    
    const insights = {
      health: this.calculateRepoHealth(stats),
      activity: this.analyzeActivity(stats),
      languages: languages,
      recommendations: this.generateRecommendations(stats, languages)
    };

    return insights;
  }

  // Helper methods

  /**
   * Enhance repository data with computed fields
   */
  enhanceRepositoryData(repo) {
    return {
      ...repo,
      computed: {
        age_days: Math.floor((Date.now() - new Date(repo.created_at).getTime()) / (1000 * 60 * 60 * 24)),
        last_update_days: Math.floor((Date.now() - new Date(repo.updated_at).getTime()) / (1000 * 60 * 60 * 24)),
        size_mb: (repo.size / 1024).toFixed(2),
        is_active: new Date(repo.updated_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Updated in last 30 days
        fork_ratio: repo.forks_count > 0 ? (repo.stargazers_count / repo.forks_count).toFixed(2) : 0
      }
    };
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
      
      // Extract page number from URL
      const pageMatch = url.match(/[?&]page=(\d+)/);
      if (pageMatch) {
        links[rel] = parseInt(pageMatch[1]);
      }
    }

    return links;
  }

  /**
   * Extract total count from Link header (last page estimation)
   */
  extractTotalFromLinkHeader(linkHeader) {
    if (!linkHeader) return 0;

    const lastMatch = linkHeader.match(/[?&]page=(\d+)[^>]*>;\s*rel="last"/);
    if (lastMatch) {
      return parseInt(lastMatch[1]) * 30; // Approximate (assumes 30 per page)
    }

    return 0;
  }

  /**
   * Parse repository string (owner/repo format)
   */
  parseRepoString(repoString) {
    const parts = repoString.split('/');
    if (parts.length !== 2) {
      throw new Error(`Invalid repository format: ${repoString}. Expected format: owner/repo`);
    }
    
    const [owner, repo] = parts;
    
    if (!isValidGitHubName(owner) || !isValidRepoName(repo)) {
      throw new Error(`Invalid repository name: ${repoString}`);
    }
    
    return { owner, repo };
  }

  /**
   * Calculate repository health score
   */
  calculateRepoHealth(stats) {
    let score = 100;
    
    // Penalize for lack of description
    if (!stats.repository?.description) {
      score -= 10;
    }
    
    // Penalize for no README (assuming no commits means no README)
    if (stats.activity.totalCommits === 0) {
      score -= 20;
    }
    
    // Penalize for no recent activity (30 days)
    const daysSinceLastCommit = stats.activity.lastCommitDate 
      ? Math.floor((Date.now() - new Date(stats.activity.lastCommitDate).getTime()) / (1000 * 60 * 60 * 24))
      : Infinity;
    
    if (daysSinceLastCommit > 30) {
      score -= 15;
    }
    
    // Bonus for having releases
    if (stats.releases.count > 0) {
      score += 5;
    }
    
    // Bonus for multiple contributors
    if (stats.contributors.count > 1) {
      score += 5;
    }
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Analyze repository activity
   */
  analyzeActivity(stats) {
    const daysSinceLastCommit = stats.activity.lastCommitDate 
      ? Math.floor((Date.now() - new Date(stats.activity.lastCommitDate).getTime()) / (1000 * 60 * 60 * 24))
      : null;
    
    let activityLevel = 'inactive';
    if (daysSinceLastCommit === null) {
      activityLevel = 'new';
    } else if (daysSinceLastCommit <= 7) {
      activityLevel = 'very_active';
    } else if (daysSinceLastCommit <= 30) {
      activityLevel = 'active';
    } else if (daysSinceLastCommit <= 90) {
      activityLevel = 'moderate';
    }
    
    return {
      level: activityLevel,
      daysSinceLastCommit,
      totalCommits: stats.activity.totalCommits,
      contributorCount: stats.contributors.count
    };
  }

  /**
   * Generate recommendations based on repository analysis
   */
  generateRecommendations(stats, languages) {
    const recommendations = [];
    
    if (!stats.repository?.description) {
      recommendations.push({
        type: 'documentation',
        priority: 'high',
        message: 'Add a repository description to help users understand the project purpose'
      });
    }
    
    if (stats.activity.totalCommits === 0) {
      recommendations.push({
        type: 'initialization',
        priority: 'high',
        message: 'Initialize the repository with a README file and initial commit'
      });
    }
    
    if (stats.releases.count === 0 && stats.activity.totalCommits > 10) {
      recommendations.push({
        type: 'versioning',
        priority: 'medium',
        message: 'Consider creating releases to mark stable versions of your project'
      });
    }
    
    if (stats.contributors.count === 1 && stats.repository?.forks_count > 0) {
      recommendations.push({
        type: 'collaboration',
        priority: 'medium',
        message: 'Review and merge pull requests from contributors to encourage collaboration'
      });
    }
    
    return recommendations;
  }
}

module.exports = { RepositoryOperations };