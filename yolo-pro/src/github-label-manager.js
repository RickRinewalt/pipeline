/**
 * YOLO-PRO GitHub Label Management System
 * Automated label validation, creation, and assignment for YOLO-PRO workflows
 */

class GitHubLabelManager {
  constructor(options = {}) {
    this.gitHubClient = options.gitHubClient;
    this.options = {
      owner: options.owner || (this.gitHubClient && this.gitHubClient.options.owner),
      repo: options.repo || (this.gitHubClient && this.gitHubClient.options.repo),
      retryAttempts: options.retryAttempts || 3,
      batchSize: options.batchSize || 10,
      cacheEnabled: options.cacheEnabled !== false,
      ...options
    };
    
    // Caching system
    this.labelCache = new Map();
    this.labelCacheTTL = 5 * 60 * 1000; // 5 minutes
    
    // Standard YOLO-PRO label definitions
    this.standardLabels = this._initializeStandardLabels();
  }

  /**
   * Initialize standard YOLO-PRO label definitions
   */
  _initializeStandardLabels() {
    return [
      // Core Workflow
      { name: 'yolo-pro', color: '0052cc', description: 'YOLO-PRO protocol issue', category: 'core' },
      
      // Epic and Issue Types
      { name: 'epic', color: '8b5a2b', description: 'Epic-level feature collection', category: 'epic' },
      { name: 'type:feature', color: '0052cc', description: 'New feature implementation', category: 'type' },
      { name: 'type:enhancement', color: '84b6eb', description: 'Enhancement to existing feature', category: 'type' },
      { name: 'type:bug', color: 'd73a49', description: 'Bug fix required', category: 'type' },
      { name: 'type:documentation', color: '0075ca', description: 'Documentation update', category: 'type' },
      
      // Priorities
      { name: 'priority:critical', color: 'b60205', description: 'Critical priority - immediate attention', category: 'priority' },
      { name: 'priority:high', color: 'd93f0b', description: 'High priority - urgent', category: 'priority' },
      { name: 'priority:medium', color: 'fbca04', description: 'Medium priority - normal', category: 'priority' },
      { name: 'priority:low', color: '0e8a16', description: 'Low priority - when possible', category: 'priority' },
      
      // Status Labels
      { name: 'status:planning', color: 'c5def5', description: 'In planning phase', category: 'status' },
      { name: 'status:in-progress', color: 'fbca04', description: 'Currently being worked on', category: 'status' },
      { name: 'status:blocked', color: 'd93f0b', description: 'Blocked by dependencies', category: 'status' },
      { name: 'status:review', color: '5319e7', description: 'Under review', category: 'status' },
      { name: 'status:testing', color: 'f9d0c4', description: 'In testing phase', category: 'status' },
      { name: 'status:ready', color: '0e8a16', description: 'Ready for deployment', category: 'status' },
      
      // SPARC Methodology
      { name: 'sparc:specification', color: 'c2e0c6', description: 'SPARC Specification phase', category: 'sparc' },
      { name: 'sparc:pseudocode', color: 'bfd4f2', description: 'SPARC Pseudocode phase', category: 'sparc' },
      { name: 'sparc:architecture', color: 'fef2c0', description: 'SPARC Architecture phase', category: 'sparc' },
      { name: 'sparc:refinement', color: 'f1c0e8', description: 'SPARC Refinement phase', category: 'sparc' },
      { name: 'sparc:completion', color: 'c0f0ff', description: 'SPARC Completion phase', category: 'sparc' },
      
      // Additional Categories
      { name: 'area:api', color: 'd876e3', description: 'API-related changes', category: 'area' },
      { name: 'area:cli', color: 'bb6bd9', description: 'CLI-related changes', category: 'area' },
      { name: 'area:security', color: '6f42c1', description: 'Security-related changes', category: 'area' },
      { name: 'area:performance', color: 'ff6b6b', description: 'Performance improvements', category: 'area' },
      { name: 'area:testing', color: '4ecdc4', description: 'Testing-related changes', category: 'area' }
    ];
  }

  /**
   * Get the complete YOLO-PRO standard label set
   */
  getYoloProLabelSet() {
    return this.standardLabels;
  }

  /**
   * Validate label format according to YOLO-PRO standards
   */
  isLabelFormatValid(labelName) {
    if (!labelName || typeof labelName !== 'string' || labelName.trim() === '') {
      return false;
    }

    const trimmed = labelName.trim();
    
    // Check basic format rules
    if (trimmed.length > 50) return false; // GitHub limit
    if (trimmed.includes(' ')) return false; // No spaces allowed
    if (trimmed.startsWith(':') || trimmed.endsWith(':')) return false;
    if (trimmed.toUpperCase() === trimmed && trimmed.length > 3) return false; // Avoid all caps
    
    return true;
  }

  /**
   * Validate labels against repository and YOLO-PRO standards
   */
  async validateLabels(labels, options = {}) {
    const { retries = 0 } = options;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const repoLabels = await this._getRepositoryLabels();
      const repoLabelNames = repoLabels.map(l => l.name);
      
      const validation = {
        success: true,
        valid: [],
        invalid: [],
        missing: [],
        suggestions: []
      };

      for (const label of labels) {
        if (!this.isLabelFormatValid(label)) {
          validation.invalid.push({
            label,
            reason: 'Invalid format',
            suggestion: this._suggestLabelFormat(label)
          });
          continue;
        }

        if (repoLabelNames.includes(label)) {
          validation.valid.push(label);
        } else {
          validation.missing.push(label);
          
          // Check if it's a standard label
          const standardLabel = this.standardLabels.find(l => l.name === label);
          if (standardLabel) {
            validation.suggestions.push({
              label,
              action: 'create_standard',
              definition: standardLabel
            });
          }
        }
      }

        return validation;

      } catch (error) {
        if (attempt === retries) {
          const result = {
            success: false,
            error: error.message,
            valid: [],
            invalid: [],
            missing: []
          };

          // Handle rate limit errors
          if (error.status === 403 && error.message.includes('rate limit')) {
            result.retryAfter = error.headers && error.headers['x-ratelimit-reset'] 
              ? parseInt(error.headers['x-ratelimit-reset']) 
              : 60;
          }

          return result;
        } else {
          // Wait before retry with exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }
    
    // This should never be reached
    return {
      success: false,
      error: 'Maximum retries exceeded',
      valid: [],
      invalid: [],
      missing: []
    };
  }

  /**
   * Ensure required labels exist in repository
   */
  async ensureLabelsExist(requiredLabels, options = {}) {
    try {
      const validation = await this.validateLabels(requiredLabels);
      
      if (!validation.success) {
        throw new Error(`Label validation failed: ${validation.error}`);
      }

      const results = {
        success: true,
        existing: validation.valid,
        created: [],
        failed: [],
        errors: []
      };

      // Create missing labels
      for (const missingLabel of validation.missing) {
        try {
          const createResult = await this.createLabel(missingLabel);
          if (createResult.success) {
            results.created.push(missingLabel);
          } else {
            results.failed.push({
              label: missingLabel,
              error: createResult.error
            });
            results.errors.push(createResult.error);
          }
        } catch (error) {
          results.failed.push({
            label: missingLabel,
            error: error.message
          });
          results.errors.push(error.message);
        }
      }

      // Invalidate cache after creation
      this._invalidateCache();

      return results;

    } catch (error) {
      return {
        success: false,
        error: error.message,
        existing: [],
        created: [],
        failed: []
      };
    }
  }

  /**
   * Create a single label in the repository
   */
  async createLabel(labelName, customDefinition = null) {
    try {
      // Check if standard label definition exists
      const labelDef = customDefinition || 
                      this.standardLabels.find(l => l.name === labelName) ||
                      this._generateDefaultLabelDefinition(labelName);

      const result = await this.gitHubClient.octokit.rest.issues.createLabel({
        owner: this.options.owner,
        repo: this.options.repo,
        name: labelDef.name,
        color: labelDef.color,
        description: labelDef.description
      });

      return {
        success: true,
        label: result.data,
        created: true
      };

    } catch (error) {
      if (error.status === 422) {
        // Label already exists
        return {
          success: false,
          error: `Label '${labelName}' already exists`,
          conflicted: true
        };
      }

      if (error.status === 403) {
        return {
          success: false,
          error: `Permission denied: Cannot create label '${labelName}'`,
          requiresPermission: true
        };
      }

      return {
        success: false,
        error: `Failed to create label: ${error.message}`,
        label: labelName
      };
    }
  }

  /**
   * Ensure all standard YOLO-PRO labels exist
   */
  async ensureStandardLabelsExist() {
    const standardLabelNames = this.standardLabels.map(l => l.name);
    return await this.ensureLabelsExist(standardLabelNames);
  }

  /**
   * Add labels to an issue
   */
  async addLabelsToIssue(issueNumber, labels, options = {}) {
    try {
      const validation = await this.validateLabels(labels);
      
      const results = {
        success: true,
        added: [],
        skipped: [],
        created: [],
        errors: []
      };

      // Handle invalid labels
      for (const invalid of validation.invalid) {
        results.skipped.push(invalid.reason);
      }

      // Create missing labels if requested
      if (options.createMissing && validation.missing.length > 0) {
        const creationResult = await this.ensureLabelsExist(validation.missing);
        results.created = creationResult.created;
        
        if (creationResult.failed.length > 0) {
          results.errors.push(...creationResult.errors);
        }
      }

      // Add valid labels (and newly created ones)
      const labelsToAdd = [
        ...validation.valid,
        ...(options.createMissing ? results.created : [])
      ];

      if (labelsToAdd.length > 0) {
        await this.gitHubClient.octokit.rest.issues.addLabels({
          owner: this.options.owner,
          repo: this.options.repo,
          issue_number: issueNumber,
          labels: labelsToAdd
        });

        results.added = labelsToAdd;
      }

      return results;

    } catch (error) {
      return {
        success: false,
        error: error.message,
        added: [],
        skipped: [],
        created: []
      };
    }
  }

  /**
   * Remove labels from an issue
   */
  async removeLabelsFromIssue(issueNumber, labels) {
    try {
      const results = {
        success: true,
        removed: [],
        skipped: [],
        errors: []
      };

      for (const label of labels) {
        try {
          await this.gitHubClient.octokit.rest.issues.removeLabel({
            owner: this.options.owner,
            repo: this.options.repo,
            issue_number: issueNumber,
            name: label
          });

          results.removed.push(label);

        } catch (error) {
          if (error.status === 404) {
            results.skipped.push(label);
          } else {
            results.errors.push(`Failed to remove ${label}: ${error.message}`);
          }
        }
      }

      return results;

    } catch (error) {
      return {
        success: false,
        error: error.message,
        removed: [],
        skipped: []
      };
    }
  }

  /**
   * Integrate with YOLO-PRO workflow chain
   */
  async integrateWithWorkflowChain(issueNumber, metadata) {
    try {
      const suggestedLabels = this._generateWorkflowLabels(metadata);
      
      const result = await this.addLabelsToIssue(issueNumber, suggestedLabels, {
        createMissing: true
      });

      return {
        success: result.success,
        appliedLabels: result.added,
        createdLabels: result.created,
        workflow: metadata,
        errors: result.errors
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        appliedLabels: []
      };
    }
  }

  /**
   * Suggest labels based on issue content
   */
  async suggestLabels(title, body, options = {}) {
    const suggestions = [];
    const content = `${title} ${body}`.toLowerCase();

    // Type suggestions
    if (content.includes('bug') || content.includes('fix') || content.includes('error')) {
      suggestions.push('type:bug');
    } else if (content.includes('feature') || content.includes('implement') || content.includes('add')) {
      suggestions.push('type:feature');
    } else if (content.includes('enhance') || content.includes('improve') || content.includes('optimize')) {
      suggestions.push('type:enhancement');
    }

    // Priority suggestions
    if (content.includes('critical') || content.includes('urgent') || content.includes('security')) {
      suggestions.push('priority:critical');
    } else if (content.includes('important') || content.includes('high')) {
      suggestions.push('priority:high');
    }

    // Area suggestions
    if (content.includes('api') || content.includes('endpoint')) {
      suggestions.push('area:api');
    }
    if (content.includes('cli') || content.includes('command')) {
      suggestions.push('area:cli');
    }
    if (content.includes('security') || content.includes('authentication')) {
      suggestions.push('area:security');
    }
    if (content.includes('performance') || content.includes('speed') || content.includes('optimize')) {
      suggestions.push('area:performance');
    }
    if (content.includes('test') || content.includes('spec') || content.includes('coverage')) {
      suggestions.push('area:testing');
    }

    return [...new Set(suggestions)]; // Remove duplicates
  }

  // Private helper methods

  async _getRepositoryLabels() {
    const cacheKey = `${this.options.owner}/${this.options.repo}`;
    
    // Check cache
    if (this.options.cacheEnabled && this.labelCache.has(cacheKey)) {
      const cached = this.labelCache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.labelCacheTTL) {
        return cached.data;
      }
    }

    // Fetch from API
    const response = await this.gitHubClient.octokit.rest.issues.listLabelsForRepo({
      owner: this.options.owner,
      repo: this.options.repo,
      per_page: 100
    });

    const labels = response.data;

    // Cache the results
    if (this.options.cacheEnabled) {
      this.labelCache.set(cacheKey, {
        data: labels,
        timestamp: Date.now()
      });
    }

    return labels;
  }

  _generateDefaultLabelDefinition(labelName) {
    // Generate a default definition for unknown labels
    const colors = ['0052cc', '0e8a16', 'd93f0b', 'fbca04', '5319e7', 'f9d0c4'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    return {
      name: labelName,
      color: randomColor,
      description: `Auto-generated label: ${labelName}`
    };
  }

  _generateWorkflowLabels(metadata) {
    const labels = [];

    // Always add YOLO-PRO label
    labels.push('yolo-pro');

    // Add type-based label
    if (metadata.type) {
      labels.push(`type:${metadata.type}`);
    }

    // Add priority-based label
    if (metadata.priority) {
      labels.push(`priority:${metadata.priority}`);
    }

    // Add SPARC phase label
    if (metadata.sparc_phase) {
      labels.push(`sparc:${metadata.sparc_phase}`);
    }

    // Add epic label if part of epic
    if (metadata.epic) {
      labels.push('epic');
    }

    // Add area-based labels
    if (metadata.area) {
      labels.push(`area:${metadata.area}`);
    }

    return labels;
  }

  _suggestLabelFormat(invalidLabel) {
    if (!invalidLabel) return null;
    
    // Basic cleanup
    let suggestion = invalidLabel.trim().toLowerCase();
    suggestion = suggestion.replace(/\s+/g, '-');
    suggestion = suggestion.replace(/[^a-zA-Z0-9:-]/g, '');
    
    return suggestion;
  }

  _invalidateCache() {
    this.labelCache.clear();
  }
}

module.exports = GitHubLabelManager;