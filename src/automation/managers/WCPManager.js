const { MilestoneProcessor } = require('../processors/MilestoneProcessor');
const { v4: uuidv4 } = require('uuid');

/**
 * WCPManager
 * Work Chunking Protocol implementation for agile feature delivery
 */
class WCPManager {
  constructor(config, logger) {
    this.config = {
      wcp: {
        maxFeaturesPerEpic: 7,
        maxIssuesPerFeature: 3,
        enableSwarmDeployment: true,
        concurrentFeatures: false,
        ...config.wcp
      },
      ...config
    };

    this.logger = logger;
    this.milestoneProcessor = new MilestoneProcessor(config, logger);
    this.activeEpics = new Map();
    this.completedEpics = new Map();
    this.featureHistory = new Map();
    this.velocityData = new Map();

    this.logger.info('WCP Manager initialized', {
      maxFeaturesPerEpic: this.config.wcp.maxFeaturesPerEpic,
      maxIssuesPerFeature: this.config.wcp.maxIssuesPerFeature
    });
  }

  /**
   * Initialize Work Chunking Protocol for an EPIC
   * @param {Object} epicData - EPIC specification
   * @returns {Object} WCP initialization result
   */
  async initializeWCP(epicData) {
    try {
      this.logger.info('Initializing WCP for EPIC', {
        milestoneId: epicData.milestoneId,
        title: epicData.title
      });

      // Validate EPIC data
      const validation = this.validateEpicData(epicData);
      if (!validation.valid) {
        return {
          success: false,
          error: `Invalid EPIC data: ${validation.errors.join(', ')}`
        };
      }

      const epicId = `wcp-epic-${uuidv4()}`;

      // Process associated milestone if provided
      let milestoneAnalysis;
      if (epicData.milestoneId) {
        milestoneAnalysis = await this.milestoneProcessor.processMilestone(
          epicData.milestoneId
        );

        if (!milestoneAnalysis.success) {
          return {
            success: false,
            error: `Milestone processing failed: ${milestoneAnalysis.error}`
          };
        }
      }

      // Analyze EPIC complexity and generate breakdown
      const epicAnalysis = this.analyzeEpicComplexity(epicData, milestoneAnalysis);
      const wcpBreakdown = this.generateWCPBreakdown(epicAnalysis);

      // Create EPIC structure
      const epic = {
        id: epicId,
        milestoneId: epicData.milestoneId,
        title: epicData.title,
        description: epicData.description,
        businessObjective: epicData.businessObjective,
        requirements: epicData.requirements || [],
        features: [],
        startTime: Date.now(),
        status: 'initialized',
        complexity: epicAnalysis.complexity,
        wcpCompliant: wcpBreakdown.compliant,
        suggestedFeatures: wcpBreakdown.suggestedFeatures,
        targetDate: epicData.targetDate,
        assignedTeam: epicData.assignedTeam
      };

      // Generate EPIC template
      const epicTemplate = this.milestoneProcessor.generateEpicTemplate({
        title: epic.title,
        objective: epic.businessObjective,
        features: wcpBreakdown.suggestedFeatureNames,
        requirements: epic.requirements,
        dependencies: epicData.dependencies
      });

      // Store active EPIC
      this.activeEpics.set(epicId, epic);

      const result = {
        success: true,
        epicId,
        milestoneId: epicData.milestoneId,
        complexity: epicAnalysis.complexity,
        suggestedFeatures: wcpBreakdown.suggestedFeatureNames,
        recommendedFeatureCount: wcpBreakdown.features,
        requiresSwarmDeployment: epicAnalysis.complexity === 'high' || 
                                wcpBreakdown.features > 3,
        wcpStructure: {
          epic: {
            number: epic.milestoneId,
            title: epic.title,
            complexity: epic.complexity
          },
          features: wcpBreakdown.features,
          maxIssuesPerFeature: this.config.wcp.maxIssuesPerFeature
        },
        epicTemplate,
        estimatedDuration: wcpBreakdown.estimatedDuration,
        milestoneAnalysis: milestoneAnalysis || null
      };

      this.logger.info(`WCP initialized for EPIC ${epicId}`, {
        features: wcpBreakdown.features,
        complexity: epicAnalysis.complexity,
        swarmRequired: result.requiresSwarmDeployment
      });

      return result;

    } catch (error) {
      this.logger.error('Error initializing WCP', {
        error: error.message,
        epicData: epicData.title
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Process individual feature within WCP structure
   * @param {Object} featureData - Feature specification
   * @returns {Object} Feature processing result
   */
  async processFeature(featureData) {
    try {
      this.logger.info('Processing WCP feature', {
        name: featureData.name,
        epicNumber: featureData.epicNumber
      });

      // Validate feature against WCP constraints
      const wcpValidation = this.validateWCPCompliance(featureData);
      if (!wcpValidation.compliant) {
        return {
          success: false,
          error: wcpValidation.violations.join('; '),
          wcpViolation: true,
          suggestedBreakdown: wcpValidation.suggestedBreakdown
        };
      }

      // Check if feature is too complex and needs breakdown
      const complexityCheck = this.checkFeatureComplexity(featureData);
      if (!complexityCheck.suitable) {
        return {
          success: false,
          reason: 'Feature too complex for WCP compliance',
          suggestedBreakdown: complexityCheck.suggestedBreakdown,
          error: complexityCheck.reason
        };
      }

      // Create feature issue structure
      const featureNumber = await this.createFeatureIssue(featureData);
      if (!featureNumber.success) {
        return featureNumber; // Return error
      }

      // Create sub-issues
      const subIssueResult = await this.milestoneProcessor.createSubIssues(
        {
          number: featureNumber.issueNumber,
          title: featureData.name,
          body: this.generateFeatureDescription(featureData),
          milestone: featureData.epicNumber ? { number: featureData.epicNumber } : null
        },
        featureData.subTasks.map(task => ({
          title: task.title,
          body: task.description || `Sub-task: ${task.title}`,
          labels: ['sub-task', 'wcp-compliant'],
          estimate: task.estimate
        }))
      );

      if (!subIssueResult.success) {
        return {
          success: false,
          error: `Failed to create sub-issues: ${subIssueResult.error}`
        };
      }

      // Calculate feature metrics
      const estimatedDuration = featureData.subTasks
        .reduce((total, task) => total + (task.estimate || 0), 0);

      const result = {
        success: true,
        featureNumber: featureNumber.issueNumber,
        featureName: featureData.name,
        subIssues: subIssueResult.issues,
        subIssueCount: subIssueResult.subIssuesCreated,
        wcpCompliant: true,
        estimatedDuration,
        ciIntegration: this.generateCIIntegration(featureData),
        recommendedTopology: this.recommendSwarmTopology(featureData),
        swarmRequired: complexityCheck.requiresSwarm
      };

      // Track feature in EPIC if applicable
      if (featureData.epicId) {
        this.trackFeatureInEpic(featureData.epicId, result);
      }

      this.logger.info(`Feature processed successfully`, {
        feature: featureData.name,
        subIssues: subIssueResult.subIssuesCreated,
        duration: estimatedDuration
      });

      return result;

    } catch (error) {
      this.logger.error('Error processing feature', {
        error: error.message,
        feature: featureData.name
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get WCP status for an EPIC
   * @param {string} epicId - EPIC ID
   * @returns {Object} WCP status
   */
  getWCPStatus(epicId) {
    const epic = this.activeEpics.get(epicId) || this.completedEpics.get(epicId);

    if (!epic) {
      return {
        found: false,
        error: `EPIC ${epicId} not found`
      };
    }

    // Calculate feature progress
    const totalFeatures = epic.features.length;
    const completedFeatures = epic.features.filter(f => f.status === 'completed').length;
    const inProgressFeatures = epic.features.filter(f => f.status === 'in-progress').length;
    const pendingFeatures = epic.features.filter(f => f.status === 'pending').length;

    // Calculate issue progress across all features
    const allIssues = epic.features.reduce((acc, feature) => {
      return acc.concat(feature.issues || []);
    }, []);

    const totalIssues = allIssues.length;
    const completedIssues = allIssues.filter(issue => issue.status === 'closed').length;

    const overallProgress = totalFeatures > 0 ? 
      Math.round((completedFeatures / totalFeatures) * 100) : 0;
    const issueProgress = totalIssues > 0 ? 
      Math.round((completedIssues / totalIssues) * 100) : 0;

    // Check WCP compliance
    const wcpCompliance = this.checkEpicWCPCompliance(epic);

    const status = {
      epicId,
      title: epic.title,
      status: epic.status,
      startTime: epic.startTime,
      totalFeatures,
      completedFeatures,
      inProgressFeatures,
      pendingFeatures,
      overallProgress,
      issueProgress,
      totalIssues,
      completedIssues,
      wcpCompliant: wcpCompliance.compliant,
      violations: wcpCompliance.violations,
      complexity: epic.complexity,
      estimatedCompletion: this.calculateEstimatedCompletion(epic),
      velocity: this.calculateVelocity(epicId),
      daysRemaining: this.calculateDaysRemaining(epic),
      features: epic.features.map(feature => ({
        name: feature.name,
        status: feature.status,
        progress: feature.progress || 0,
        issues: feature.issues?.length || 0,
        completedIssues: feature.issues?.filter(i => i.status === 'closed').length || 0
      }))
    };

    return status;
  }

  /**
   * Generate comprehensive WCP report
   * @param {string} epicId - EPIC ID
   * @returns {Object} WCP report
   */
  async generateWCPReport(epicId) {
    const status = this.getWCPStatus(epicId);
    
    if (!status.found) {
      return status;
    }

    const epic = this.activeEpics.get(epicId) || this.completedEpics.get(epicId);

    // Generate detailed analysis
    const featureBreakdown = epic.features.map(feature => {
      const featureIssues = feature.issues || [];
      return {
        name: feature.name,
        status: feature.status,
        issueCount: featureIssues.length,
        wcpCompliant: featureIssues.length <= this.config.wcp.maxIssuesPerFeature,
        estimatedDuration: feature.estimatedDuration || 0,
        actualDuration: feature.completedAt ? 
          feature.completedAt - feature.startTime : null,
        velocity: this.calculateFeatureVelocity(epicId, feature.name)
      };
    });

    // WCP metrics
    const wcpMetrics = {
      compliant: status.wcpCompliant,
      violations: status.violations,
      featuresWithinLimit: epic.features.length <= this.config.wcp.maxFeaturesPerEpic,
      averageIssuesPerFeature: status.totalIssues / Math.max(status.totalFeatures, 1),
      maxIssuesPerFeatureLimit: this.config.wcp.maxIssuesPerFeature,
      maxFeaturesPerEpicLimit: this.config.wcp.maxFeaturesPerEpic
    };

    // Generate recommendations
    const recommendations = this.generateWCPRecommendations(epic, wcpMetrics);

    const report = {
      epicId,
      title: epic.title,
      generatedAt: Date.now(),
      summary: {
        overallProgress: status.overallProgress,
        wcpCompliant: status.wcpCompliant,
        totalFeatures: status.totalFeatures,
        completedFeatures: status.completedFeatures,
        estimatedCompletion: status.estimatedCompletion
      },
      featureBreakdown,
      wcpMetrics,
      recommendations,
      velocityTrends: this.getVelocityTrends(epicId),
      timeline: this.generateEpicTimeline(epic),
      riskAnalysis: this.analyzeRisks(epic)
    };

    return report;
  }

  /**
   * Validate EPIC data structure
   * @private
   */
  validateEpicData(epicData) {
    const errors = [];

    if (!epicData.title || epicData.title.trim() === '') {
      errors.push('EPIC title is required');
    }

    if (!epicData.milestoneId && !epicData.businessObjective) {
      errors.push('Either milestone ID or business objective is required');
    }

    if (epicData.requirements && !Array.isArray(epicData.requirements)) {
      errors.push('Requirements must be an array');
    }

    if (epicData.features && !Array.isArray(epicData.features)) {
      errors.push('Features must be an array');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Analyze EPIC complexity
   * @private
   */
  analyzeEpicComplexity(epicData, milestoneAnalysis) {
    let complexityScore = 0;

    // Factor 1: Number of requirements
    const requirementCount = epicData.requirements?.length || 0;
    if (requirementCount > 10) complexityScore += 3;
    else if (requirementCount > 5) complexityScore += 2;
    else if (requirementCount > 2) complexityScore += 1;

    // Factor 2: Milestone complexity
    if (milestoneAnalysis) {
      if (milestoneAnalysis.complexity === 'high') complexityScore += 3;
      else if (milestoneAnalysis.complexity === 'medium') complexityScore += 2;
      else complexityScore += 1;
    }

    // Factor 3: Feature count estimate
    const estimatedFeatures = epicData.features?.length || 
      Math.ceil(requirementCount / 2);
    if (estimatedFeatures > 5) complexityScore += 2;
    else if (estimatedFeatures > 3) complexityScore += 1;

    // Factor 4: Dependencies
    if (epicData.dependencies && epicData.dependencies.length > 0) {
      complexityScore += Math.min(epicData.dependencies.length, 2);
    }

    // Determine final complexity
    let complexity = 'low';
    if (complexityScore >= 6) complexity = 'high';
    else if (complexityScore >= 3) complexity = 'medium';

    return {
      complexity,
      complexityScore,
      requirementCount,
      estimatedFeatures,
      dependencyCount: epicData.dependencies?.length || 0,
      milestoneComplexity: milestoneAnalysis?.complexity
    };
  }

  /**
   * Generate WCP breakdown recommendations
   * @private
   */
  generateWCPBreakdown(epicAnalysis) {
    const maxFeatures = this.config.wcp.maxFeaturesPerEpic;
    const maxIssuesPerFeature = this.config.wcp.maxIssuesPerFeature;

    let recommendedFeatures;
    
    if (epicAnalysis.complexity === 'high') {
      recommendedFeatures = Math.min(maxFeatures, epicAnalysis.estimatedFeatures);
    } else if (epicAnalysis.complexity === 'medium') {
      recommendedFeatures = Math.min(maxFeatures, Math.max(2, epicAnalysis.estimatedFeatures));
    } else {
      recommendedFeatures = Math.max(1, Math.min(3, epicAnalysis.estimatedFeatures));
    }

    const issuesPerFeature = Math.ceil(
      (epicAnalysis.requirementCount || 3) / recommendedFeatures
    );

    const compliant = recommendedFeatures <= maxFeatures && 
                     issuesPerFeature <= maxIssuesPerFeature;

    // Generate suggested feature names based on requirements
    const suggestedFeatureNames = this.generateFeatureNames(
      epicAnalysis,
      recommendedFeatures
    );

    return {
      features: recommendedFeatures,
      issuesPerFeature: Math.min(issuesPerFeature, maxIssuesPerFeature),
      compliant,
      estimatedDuration: this.estimateEpicDuration(
        recommendedFeatures, 
        issuesPerFeature, 
        epicAnalysis.complexity
      ),
      suggestedFeatureNames,
      requiresBreakdown: !compliant,
      swarmRecommended: epicAnalysis.complexity === 'high'
    };
  }

  /**
   * Validate WCP compliance for a feature
   * @private
   */
  validateWCPCompliance(featureData) {
    const violations = [];
    const maxIssues = this.config.wcp.maxIssuesPerFeature;

    if (!featureData.subTasks || !Array.isArray(featureData.subTasks)) {
      violations.push('Feature must have sub-tasks array');
    } else if (featureData.subTasks.length > maxIssues) {
      violations.push(`Feature exceeds WCP limit of ${maxIssues} issues per feature (has ${featureData.subTasks.length})`);
    }

    if (featureData.subTasks && featureData.subTasks.length === 0) {
      violations.push('Feature must have at least one sub-task');
    }

    const suggestedBreakdown = violations.length > 0 ? 
      this.suggestFeatureBreakdown(featureData) : null;

    return {
      compliant: violations.length === 0,
      violations,
      suggestedBreakdown
    };
  }

  /**
   * Check feature complexity and suitability
   * @private
   */
  checkFeatureComplexity(featureData) {
    const subTasks = featureData.subTasks || [];
    const totalEstimate = subTasks.reduce((sum, task) => sum + (task.estimate || 0), 0);
    const averageTaskSize = totalEstimate / Math.max(subTasks.length, 1);

    // Complexity thresholds (in story points or hours)
    const maxFeatureSize = 20; // Max story points
    const maxAverageTaskSize = 8; // Max average task size
    const maxIssues = this.config.wcp.maxIssuesPerFeature;

    const issues = [];
    let requiresSwarm = false;

    if (totalEstimate > maxFeatureSize) {
      issues.push(`Feature too large (${totalEstimate} points, max ${maxFeatureSize})`);
    }

    if (averageTaskSize > maxAverageTaskSize) {
      issues.push(`Tasks too complex (avg ${averageTaskSize} points, max ${maxAverageTaskSize})`);
    }

    if (subTasks.length > maxIssues) {
      issues.push(`Too many sub-tasks (${subTasks.length}, max ${maxIssues})`);
    }

    // Determine if swarm deployment is recommended
    if (totalEstimate > 15 || subTasks.length === maxIssues) {
      requiresSwarm = true;
    }

    const suitable = issues.length === 0;

    return {
      suitable,
      requiresSwarm,
      issues,
      reason: issues.join('; '),
      totalEstimate,
      averageTaskSize,
      suggestedBreakdown: suitable ? null : this.suggestFeatureBreakdown(featureData)
    };
  }

  /**
   * Generate feature names based on requirements
   * @private
   */
  generateFeatureNames(epicAnalysis, featureCount) {
    // Default feature names if no specific requirements
    const defaultNames = [
      'Core Implementation',
      'User Interface',
      'Data Management', 
      'Integration Layer',
      'Security & Validation',
      'Testing & QA',
      'Documentation & Deployment'
    ];

    // Try to derive from requirements if available
    if (epicAnalysis.requirements && epicAnalysis.requirements.length > 0) {
      // Group requirements into logical features
      return epicAnalysis.requirements
        .slice(0, featureCount)
        .map((req, index) => {
          // Simple heuristic to create feature names from requirements
          const words = req.split(' ').slice(0, 3);
          return words.map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
          ).join(' ');
        });
    }

    return defaultNames.slice(0, featureCount);
  }

  /**
   * Additional helper methods
   */

  async createFeatureIssue(featureData) {
    // This would integrate with GitHub API to create the main feature issue
    // For now, return a mock implementation
    return {
      success: true,
      issueNumber: Math.floor(Math.random() * 1000) + 100 // Mock issue number
    };
  }

  generateFeatureDescription(featureData) {
    let description = `# Feature: ${featureData.name}\n\n`;
    
    if (featureData.description) {
      description += `${featureData.description}\n\n`;
    }

    description += '## Acceptance Criteria\n';
    if (featureData.acceptanceCriteria) {
      featureData.acceptanceCriteria.forEach(criteria => {
        description += `- [ ] ${criteria}\n`;
      });
    }

    description += '\n## Sub-Tasks\n';
    featureData.subTasks.forEach(task => {
      description += `- [ ] ${task.title} (${task.estimate || 'TBD'} points)\n`;
    });

    return description;
  }

  generateCIIntegration(featureData) {
    return {
      required: featureData.ciRequired !== false,
      branch: `feature/${featureData.name.toLowerCase().replace(/\s+/g, '-')}`,
      coverageTarget: featureData.testCoverageTarget || 80,
      qualityGates: ['build', 'test', 'lint', 'security'],
      deploymentStage: featureData.deploymentStage || 'staging'
    };
  }

  recommendSwarmTopology(featureData) {
    const complexity = this.checkFeatureComplexity(featureData);
    
    if (complexity.totalEstimate > 15) {
      return 'hierarchical';
    } else if (featureData.subTasks?.length >= 3) {
      return 'mesh';
    } else {
      return 'star';
    }
  }

  trackFeatureInEpic(epicId, featureResult) {
    const epic = this.activeEpics.get(epicId);
    if (epic) {
      epic.features.push({
        name: featureResult.featureName,
        number: featureResult.featureNumber,
        status: 'pending',
        issues: featureResult.subIssues,
        estimatedDuration: featureResult.estimatedDuration,
        startTime: Date.now()
      });
    }
  }

  checkEpicWCPCompliance(epic) {
    const violations = [];
    const maxFeatures = this.config.wcp.maxFeaturesPerEpic;
    const maxIssuesPerFeature = this.config.wcp.maxIssuesPerFeature;

    if (epic.features.length > maxFeatures) {
      violations.push(`EPIC exceeds feature limit (${epic.features.length}/${maxFeatures})`);
    }

    epic.features.forEach((feature, index) => {
      const issueCount = feature.issues?.length || 0;
      if (issueCount > maxIssuesPerFeature) {
        violations.push(`Feature ${feature.number || index + 1} exceeds issue limit (${issueCount}/${maxIssuesPerFeature})`);
      }
    });

    return {
      compliant: violations.length === 0,
      violations
    };
  }

  // Additional methods for velocity, estimation, and reporting would be implemented here
  calculateEstimatedCompletion(epic) {
    // Simplified estimation logic
    const remainingFeatures = epic.features.filter(f => f.status !== 'completed').length;
    const avgFeatureTime = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
    return Date.now() + (remainingFeatures * avgFeatureTime);
  }

  calculateVelocity(epicId) {
    // Mock velocity calculation
    return {
      featuresPerWeek: 1.2,
      issuesPerWeek: 3.5,
      trend: 'stable'
    };
  }

  calculateDaysRemaining(epic) {
    const completion = this.calculateEstimatedCompletion(epic);
    return Math.ceil((completion - Date.now()) / (24 * 60 * 60 * 1000));
  }

  suggestFeatureBreakdown(featureData) {
    // Simple breakdown suggestion
    const tasks = featureData.subTasks || [];
    if (tasks.length <= this.config.wcp.maxIssuesPerFeature) {
      return null;
    }

    const chunksNeeded = Math.ceil(tasks.length / this.config.wcp.maxIssuesPerFeature);
    return {
      suggestedFeatures: chunksNeeded,
      tasksPerFeature: this.config.wcp.maxIssuesPerFeature,
      reason: 'Break down into smaller features to maintain WCP compliance'
    };
  }

  generateWCPRecommendations(epic, wcpMetrics) {
    const recommendations = [];

    if (!wcpMetrics.compliant) {
      recommendations.push('Consider breaking down EPIC to maintain WCP compliance');
    }

    if (!wcpMetrics.featuresWithinLimit) {
      recommendations.push(`Reduce features to ${this.config.wcp.maxFeaturesPerEpic} or less`);
    }

    if (wcpMetrics.averageIssuesPerFeature > this.config.wcp.maxIssuesPerFeature) {
      recommendations.push('Break down features with too many sub-issues');
    }

    if (epic.complexity === 'high') {
      recommendations.push('Consider hierarchical swarm deployment for complex EPIC');
    }

    return recommendations;
  }

  getVelocityTrends(epicId) {
    // Mock implementation
    return {
      weekly: [1.0, 1.2, 1.1, 1.3],
      trend: 'increasing',
      prediction: 1.4
    };
  }

  generateEpicTimeline(epic) {
    return {
      startDate: epic.startTime,
      estimatedEndDate: this.calculateEstimatedCompletion(epic),
      milestones: epic.features.map(f => ({
        name: f.name,
        dueDate: f.estimatedDuration ? Date.now() + f.estimatedDuration * 24 * 60 * 60 * 1000 : null,
        status: f.status
      }))
    };
  }

  analyzeRisks(epic) {
    const risks = [];

    if (epic.features.length > this.config.wcp.maxFeaturesPerEpic) {
      risks.push({
        type: 'WCP_VIOLATION',
        severity: 'high',
        description: 'EPIC exceeds recommended feature count'
      });
    }

    if (epic.complexity === 'high') {
      risks.push({
        type: 'COMPLEXITY',
        severity: 'medium',
        description: 'High complexity may impact delivery timeline'
      });
    }

    return risks;
  }

  // Velocity tracking methods
  trackFeatureProgress(epicId, featureId, progressData) {
    if (!this.featureHistory.has(epicId)) {
      this.featureHistory.set(epicId, new Map());
    }
    
    const epicHistory = this.featureHistory.get(epicId);
    if (!epicHistory.has(featureId)) {
      epicHistory.set(featureId, []);
    }

    const featureHistory = epicHistory.get(featureId);
    featureHistory.push({
      timestamp: Date.now(),
      ...progressData
    });
  }

  getFeatureProgressHistory(epicId, featureId) {
    const epicHistory = this.featureHistory.get(epicId);
    return epicHistory?.get(featureId) || [];
  }

  addVelocityData(epicId, velocityData) {
    this.velocityData.set(epicId, velocityData);
  }

  calculateVelocityMetrics(epicId) {
    const data = this.velocityData.get(epicId) || [];
    
    if (data.length === 0) {
      return {
        averageVelocity: 0,
        trend: 'unknown',
        projectedCompletion: null
      };
    }

    const avgVelocity = data.reduce((sum, week) => sum + week.issuesCompleted, 0) / data.length;
    const trend = data.length > 1 ? 
      (data[data.length - 1].issuesCompleted > data[0].issuesCompleted ? 'increasing' : 'decreasing') :
      'stable';

    return {
      averageVelocity: Math.round(avgVelocity),
      trend,
      projectedCompletion: Date.now() + (7 * 24 * 60 * 60 * 1000) // Mock projection
    };
  }

  estimateEpicDuration(features, issuesPerFeature, complexity) {
    const baseTimePerIssue = {
      'low': 1,
      'medium': 2,
      'high': 3
    };

    const totalIssues = features * issuesPerFeature;
    const baseDays = totalIssues * baseTimePerIssue[complexity];
    
    // Add overhead for coordination
    const overheadFactor = features > 3 ? 1.2 : 1.1;
    
    return Math.ceil(baseDays * overheadFactor);
  }

  calculateFeatureVelocity(epicId, featureName) {
    // Mock implementation
    return {
      issuesPerDay: 0.8,
      daysToComplete: 5,
      efficiency: 85
    };
  }
}

module.exports = { WCPManager };