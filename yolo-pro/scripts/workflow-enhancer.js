#!/usr/bin/env node

/**
 * YOLO-PRO Workflow Enhancer
 * Extends existing workflow patterns from README.md with enhanced coordination
 * Integrates all MVP solutions into cohesive workflow improvements
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Import our MVP components
const YoloProVersionChecker = require('../mvp/version-check.js');
const YoloProRelay = require('../mvp/relay-method.js');
const YoloProAgentValidator = require('../mvp/agent-validation.js');
const YoloProCommonContext = require('../mvp/common-context.js');
const GitHubLabelChecker = require('./github-label-check.js');
const ClaudeMdIntegration = require('./claude-md-integration.js');

class YoloProWorkflowEnhancer {
  constructor(options = {}) {
    this.sessionId = options.sessionId || `yolo-enhanced-${Date.now()}`;
    this.workingDir = options.workingDir || process.cwd();
    this.enabledFeatures = {
      versionCheck: true,
      agentValidation: true,
      contextManagement: true,
      githubIntegration: true,
      relaySystem: true,
      ...options.features
    };
    
    // Initialize components
    this.initializeComponents();
  }

  async initializeComponents() {
    console.log('🚀 Initializing YOLO-PRO Workflow Enhancement...');

    // Initialize common context
    if (this.enabledFeatures.contextManagement) {
      this.context = new YoloProCommonContext({
        sessionId: this.sessionId
      });
      console.log('💾 Context management initialized');
    }

    // Initialize relay system
    if (this.enabledFeatures.relaySystem) {
      this.relay = YoloProRelay.createForYoloProSwarm({
        sessionId: this.sessionId
      });
      console.log('📡 Relay system initialized');
    }

    // Initialize GitHub integration
    if (this.enabledFeatures.githubIntegration) {
      this.githubChecker = new GitHubLabelChecker();
      console.log('🐙 GitHub integration initialized');
    }

    // Initialize CLAUDE.md integration
    this.claudeMdIntegration = new ClaudeMdIntegration();
    console.log('📄 CLAUDE.md integration initialized');

    console.log('✅ All components initialized');
  }

  /**
   * Enhanced Research Workflow (extends README.md line 127)
   * Original: "npx claude-flow@alpha swarm 'Research topic X, use a 3 agent swarm...'"
   */
  async enhancedResearchWorkflow(topic, options = {}) {
    console.log(`🔍 Enhanced Research Workflow: ${topic}`);
    
    const workflowId = `research-${Date.now()}`;
    this.context?.setWorkflowProgress('research', {
      topic,
      status: 'starting',
      workflowId,
      timestamp: Date.now()
    });

    // Pre-flight validation
    if (this.enabledFeatures.versionCheck) {
      console.log('🔧 Running pre-flight checks...');
      const versionCheck = await YoloProVersionChecker.check();
      if (!versionCheck.compatible) {
        throw new Error('Version compatibility issues detected');
      }
    }

    // Agent validation for research workflow
    if (this.enabledFeatures.agentValidation) {
      const agentValidation = await YoloProAgentValidator.validate({
        agents: [
          { type: 'researcher', capabilities: ['research', 'analysis', 'web-search'] },
          { type: 'analyst', capabilities: ['analysis', 'data-processing'] },
          { type: 'coordinator', capabilities: ['coordination', 'task-management'] }
        ],
        swarm: {
          topology: 'mesh',
          agents: ['researcher', 'analyst', 'coordinator']
        }
      });

      if (!agentValidation.overall) {
        console.warn('⚠️  Agent validation issues detected, continuing with warnings');
      }
    }

    // Set up context for agents
    this.context?.setSharedContext('research.topic', topic);
    this.context?.setSharedContext('research.workflow_id', workflowId);
    this.context?.setSharedContext('research.agents', ['researcher', 'analyst', 'coordinator']);

    // Enhanced swarm command with context
    const enhancedCommand = this.generateEnhancedSwarmCommand('research', {
      topic,
      workflowId,
      agents: ['researcher', 'analyst', 'coordinator'],
      contextKeys: [`research.${workflowId}`]
    });

    console.log('🌐 Executing enhanced research swarm...');
    console.log(`Command: ${enhancedCommand}`);

    // Execute the enhanced command
    try {
      const result = execSync(enhancedCommand, { 
        encoding: 'utf8',
        cwd: this.workingDir
      });

      // Update context with results
      this.context?.setWorkflowProgress('research', {
        topic,
        status: 'completed',
        workflowId,
        result: result.substring(0, 500), // First 500 chars
        timestamp: Date.now()
      });

      console.log('✅ Enhanced research workflow completed');
      return { success: true, workflowId, result };
    } catch (error) {
      console.error(`❌ Research workflow failed: ${error.message}`);
      this.context?.setWorkflowProgress('research', {
        topic,
        status: 'failed',
        workflowId,
        error: error.message,
        timestamp: Date.now()
      });
      throw error;
    }
  }

  /**
   * Enhanced Technical Analysis Workflow (extends README.md line 133)
   */
  async enhancedTechnicalAnalysisWorkflow(issue, criteria, options = {}) {
    console.log(`⚙️ Enhanced Technical Analysis Workflow: ${issue}`);
    
    const workflowId = `analysis-${Date.now()}`;
    
    // Validate GitHub issue if it's an issue reference
    if (this.enabledFeatures.githubIntegration && issue.startsWith('#')) {
      try {
        const issueNumber = issue.substring(1);
        const issueInfo = JSON.parse(execSync(`gh issue view ${issueNumber} --json title,body,labels`, { encoding: 'utf8' }));
        
        // Store issue context
        this.context?.setIssueContext(issueNumber, {
          title: issueInfo.title,
          labels: issueInfo.labels.map(l => l.name),
          analysisWorkflowId: workflowId
        });
        
        console.log(`📋 GitHub issue #${issueNumber} context loaded`);
      } catch (error) {
        console.warn(`⚠️  Could not load GitHub issue ${issue}: ${error.message}`);
      }
    }

    // Set up enhanced analysis context
    this.context?.setWorkflowProgress('technical-analysis', {
      issue,
      criteria,
      status: 'starting',
      workflowId,
      timestamp: Date.now()
    });

    // Agent setup for technical analysis
    const analysisAgents = [
      { type: 'researcher', capabilities: ['research', 'technical-evaluation'] },
      { type: 'architect', capabilities: ['architecture', 'system-design'] },
      { type: 'analyst', capabilities: ['analysis', 'comparison', 'recommendation'] }
    ];

    // Validate agents
    if (this.enabledFeatures.agentValidation) {
      await YoloProAgentValidator.validate({
        agents: analysisAgents,
        swarm: { topology: 'hierarchical', agents: analysisAgents.map(a => a.type) }
      });
    }

    // Enhanced command with full context
    const enhancedCommand = this.generateEnhancedSwarmCommand('technical-analysis', {
      issue,
      criteria,
      workflowId,
      agents: analysisAgents.map(a => a.type),
      contextKeys: [`analysis.${workflowId}`, `github.issue.${issue.substring(1)}`]
    });

    console.log('🔬 Executing enhanced technical analysis...');
    
    try {
      const result = execSync(enhancedCommand, { 
        encoding: 'utf8',
        cwd: this.workingDir
      });

      // Store comprehensive results
      this.context?.setWorkflowProgress('technical-analysis', {
        issue,
        criteria,
        status: 'completed',
        workflowId,
        recommendations: result.substring(0, 1000),
        timestamp: Date.now()
      });

      console.log('✅ Enhanced technical analysis completed');
      return { success: true, workflowId, result };
    } catch (error) {
      console.error(`❌ Technical analysis failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Enhanced Specification Workflow (extends README.md line 139)
   */
  async enhancedSpecificationWorkflow(issue, options = {}) {
    console.log(`📝 Enhanced Specification Workflow: ${issue}`);
    
    const workflowId = `spec-${Date.now()}`;

    // Pre-validate GitHub integration
    if (this.enabledFeatures.githubIntegration) {
      // Check labels before creating issues
      const labelValidation = await this.githubChecker.validateLabelsForIssue('epic', ['yolo-pro', 'specification']);
      if (!labelValidation.valid) {
        console.log('🏷️  Creating missing labels for specification workflow...');
        await this.githubChecker.createMissingLabels(labelValidation.missing);
      }
    }

    // Comprehensive context setup
    this.context?.setWorkflowProgress('specification', {
      issue,
      status: 'starting',
      workflowId,
      timestamp: Date.now()
    });

    // Load any previous analysis results
    const previousAnalysis = this.context?.getWorkflowProgress('technical-analysis');
    if (previousAnalysis) {
      console.log('📊 Loading previous technical analysis results...');
      this.context?.setSharedContext(`spec.${workflowId}.previous_analysis`, previousAnalysis);
    }

    // Specification-specific agents
    const specAgents = [
      { type: 'planner', capabilities: ['planning', 'project-breakdown'] },
      { type: 'architect', capabilities: ['architecture', 'system-design'] },
      { type: 'reviewer', capabilities: ['review', 'validation', 'quality-check'] }
    ];

    // Enhanced command with YOLO-PRO WCP integration
    const enhancedCommand = this.generateEnhancedSwarmCommand('specification', {
      issue,
      workflowId,
      agents: specAgents.map(a => a.type),
      wcpEnabled: true,
      contextKeys: [`spec.${workflowId}`, `analysis.previous`]
    });

    console.log('📋 Executing enhanced specification workflow with WCP...');

    try {
      const result = execSync(enhancedCommand, { 
        encoding: 'utf8',
        cwd: this.workingDir
      });

      // Parse and store specification results
      this.context?.setWorkflowProgress('specification', {
        issue,
        status: 'completed',
        workflowId,
        specification: result.substring(0, 2000),
        timestamp: Date.now()
      });

      console.log('✅ Enhanced specification workflow completed');
      return { success: true, workflowId, result };
    } catch (error) {
      console.error(`❌ Specification workflow failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Enhanced Development Workflow (extends README.md line 145)
   */
  async enhancedDevelopmentWorkflow(options = {}) {
    console.log('⚡ Enhanced Rapid Development Workflow');
    
    const workflowId = `dev-${Date.now()}`;

    // Full system validation before development
    console.log('🔧 Running comprehensive pre-development validation...');
    
    if (this.enabledFeatures.versionCheck) {
      await YoloProVersionChecker.check();
    }

    if (this.enabledFeatures.agentValidation) {
      await YoloProAgentValidator.validate({
        agents: [
          { type: 'coder', capabilities: ['coding', 'implementation'] },
          { type: 'tester', capabilities: ['testing', 'validation'] },
          { type: 'reviewer', capabilities: ['review', 'quality-check'] },
          { type: 'cicd-engineer', capabilities: ['ci-cd', 'deployment'] }
        ]
      });
    }

    // Load all previous workflow context
    const researchContext = this.context?.getWorkflowProgress('research');
    const analysisContext = this.context?.getWorkflowProgress('technical-analysis');
    const specContext = this.context?.getWorkflowProgress('specification');

    // Comprehensive development context
    this.context?.setWorkflowProgress('development', {
      status: 'starting',
      workflowId,
      previousWorkflows: {
        research: researchContext?.workflowId,
        analysis: analysisContext?.workflowId,
        specification: specContext?.workflowId
      },
      timestamp: Date.now()
    });

    // Enhanced development command with full YOLO-PRO integration
    const enhancedCommand = this.generateEnhancedSwarmCommand('development', {
      workflowId,
      fullYoloProIntegration: true,
      cicdEnabled: true,
      contextKeys: ['development.full_context'],
      previousWorkflows: [researchContext, analysisContext, specContext].filter(Boolean)
    });

    console.log('⚡ Executing enhanced development workflow with full YOLO-PRO protocols...');

    try {
      const result = execSync(enhancedCommand, { 
        encoding: 'utf8',
        cwd: this.workingDir,
        timeout: 300000 // 5 minutes timeout
      });

      this.context?.setWorkflowProgress('development', {
        status: 'completed',
        workflowId,
        deploymentResult: result.substring(0, 1000),
        timestamp: Date.now()
      });

      console.log('✅ Enhanced development workflow completed');
      return { success: true, workflowId, result };
    } catch (error) {
      console.error(`❌ Development workflow failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate enhanced swarm commands that preserve original patterns
   */
  generateEnhancedSwarmCommand(workflowType, options = {}) {
    const {
      topic,
      issue,
      criteria,
      workflowId,
      agents = [],
      contextKeys = [],
      wcpEnabled = false,
      fullYoloProIntegration = false,
      cicdEnabled = false,
      previousWorkflows = []
    } = options;

    // Base command preserves README.md patterns
    let baseCommand = 'npx claude-flow@alpha swarm "';
    
    // Build enhanced command content based on workflow type
    switch (workflowType) {
      case 'research':
        baseCommand += `Research topic ${topic}, use a 3 agent swarm for the task, only ever use the swarm to complete tasks. Follow YOLO-PRO WCP for task management, keep tasks and status up to date.`;
        break;
        
      case 'technical-analysis':
        baseCommand += `Based on research in issue ${issue}, expand on this with further research and technical options analysis. Explore a range of different approaches and variations, and provide your recommendations`;
        if (criteria) {
          baseCommand += ` based on the following criteria: ${criteria}`;
        }
        baseCommand += '. Swarm it up, only ever use the swarm to complete tasks. Follow YOLO-PRO WCP for task management';
        break;
        
      case 'specification':
        baseCommand += `Based on issue ${issue}, following your recommendations generate a detailed technical specification. Based on the specification, using YOLO-PRO WCP create an Epic, with linked Features, and sub-tasks for the entire project, and keep going and don't stop until all the planning is done. Go the swarm!`;
        break;
        
      case 'development':
        baseCommand += `Review all the open issues and crack on with deploying the project feature-by-feature, following the full YOLO-PRO protocols. When completing features, always follow CI/CD; branch, PR, merge if you can, sync, repeat. Keep going and don't stop! Good luck on your mission 🫡`;
        break;
    }

    // Add enhancements while preserving original pattern
    const enhancements = [];

    if (contextKeys.length > 0) {
      enhancements.push(`Use context keys: ${contextKeys.join(', ')}`);
    }

    if (agents.length > 0) {
      enhancements.push(`Assign agents: ${agents.join(', ')}`);
    }

    if (wcpEnabled) {
      enhancements.push('Use enhanced YOLO-PRO WCP with validation');
    }

    if (fullYoloProIntegration) {
      enhancements.push('Enable full YOLO-PRO enhancement suite with MVP solutions');
    }

    if (cicdEnabled) {
      enhancements.push('Use enhanced CI/CD monitoring with hooks');
    }

    if (previousWorkflows.length > 0) {
      enhancements.push(`Integrate previous workflow results: ${previousWorkflows.length} workflows`);
    }

    // Session and tracking
    enhancements.push(`Session: ${this.sessionId}`);
    enhancements.push(`Workflow: ${workflowId}`);

    if (enhancements.length > 0) {
      baseCommand += ` [ENHANCED: ${enhancements.join('; ')}]`;
    }

    baseCommand += '"';

    return baseCommand;
  }

  /**
   * Complete Enhanced Workflow (yolo-full equivalent)
   */
  async runCompleteEnhancedWorkflow(topic, options = {}) {
    console.log(`🎯 Complete Enhanced YOLO-PRO Workflow: ${topic}`);
    
    const fullWorkflowId = `complete-${Date.now()}`;
    const results = {
      workflowId: fullWorkflowId,
      steps: [],
      success: false,
      errors: []
    };

    try {
      // Step 1: Enhanced Research
      console.log('🔍 Step 1/4: Enhanced Research');
      const researchResult = await this.enhancedResearchWorkflow(topic);
      results.steps.push({ step: 'research', ...researchResult });

      // Step 2: Enhanced Analysis
      console.log('⚙️ Step 2/4: Enhanced Technical Analysis');
      const analysisResult = await this.enhancedTechnicalAnalysisWorkflow(topic, 'feasibility, scalability, maintainability');
      results.steps.push({ step: 'analysis', ...analysisResult });

      // Step 3: Enhanced Specification
      console.log('📝 Step 3/4: Enhanced Specification');
      const specResult = await this.enhancedSpecificationWorkflow(topic);
      results.steps.push({ step: 'specification', ...specResult });

      // Step 4: Enhanced Development
      console.log('⚡ Step 4/4: Enhanced Development');
      const devResult = await this.enhancedDevelopmentWorkflow();
      results.steps.push({ step: 'development', ...devResult });

      results.success = true;
      console.log('🎉 Complete Enhanced YOLO-PRO Workflow finished successfully!');

      // Store complete workflow results
      this.context?.setWorkflowProgress('complete', {
        topic,
        status: 'completed',
        workflowId: fullWorkflowId,
        steps: results.steps.map(s => ({ step: s.step, workflowId: s.workflowId })),
        timestamp: Date.now()
      });

    } catch (error) {
      results.errors.push(error.message);
      console.error(`❌ Complete workflow failed at step ${results.steps.length + 1}: ${error.message}`);
    }

    return results;
  }

  /**
   * Status and monitoring
   */
  getWorkflowStatus() {
    const status = {
      sessionId: this.sessionId,
      enabledFeatures: this.enabledFeatures,
      components: {
        context: this.context ? this.context.getStatus() : null,
        relay: this.relay ? this.relay.getStatus() : null
      },
      workflows: {}
    };

    // Get workflow progress for each type
    const workflowTypes = ['research', 'technical-analysis', 'specification', 'development', 'complete'];
    workflowTypes.forEach(type => {
      const progress = this.context?.getWorkflowProgress(type);
      if (progress) {
        status.workflows[type] = {
          status: progress.status,
          workflowId: progress.workflowId,
          timestamp: progress.timestamp
        };
      }
    });

    return status;
  }

  /**
   * CLI interface
   */
  static async cli(args) {
    const [action, ...params] = args;
    const enhancer = new YoloProWorkflowEnhancer();

    try {
      switch (action) {
        case 'research':
          const topic = params.join(' ');
          if (!topic) {
            console.error('❌ Usage: research "topic description"');
            return 1;
          }
          await enhancer.enhancedResearchWorkflow(topic);
          return 0;

        case 'analyze':
          const [issue, ...criteriaArgs] = params;
          const criteria = criteriaArgs.join(' ');
          if (!issue) {
            console.error('❌ Usage: analyze "issue" [criteria]');
            return 1;
          }
          await enhancer.enhancedTechnicalAnalysisWorkflow(issue, criteria);
          return 0;

        case 'spec':
          const specIssue = params.join(' ');
          if (!specIssue) {
            console.error('❌ Usage: spec "issue"');
            return 1;
          }
          await enhancer.enhancedSpecificationWorkflow(specIssue);
          return 0;

        case 'dev':
          await enhancer.enhancedDevelopmentWorkflow();
          return 0;

        case 'complete':
          const completeTopic = params.join(' ');
          if (!completeTopic) {
            console.error('❌ Usage: complete "project topic"');
            return 1;
          }
          const result = await enhancer.runCompleteEnhancedWorkflow(completeTopic);
          console.log(`Results: ${result.success ? 'SUCCESS' : 'FAILED'} (${result.steps.length} steps completed)`);
          return result.success ? 0 : 1;

        case 'status':
          const status = enhancer.getWorkflowStatus();
          console.log('📊 YOLO-PRO Workflow Status:');
          console.log(JSON.stringify(status, null, 2));
          return 0;

        default:
          console.error('❌ Unknown action:', action);
          console.log('Available actions: research, analyze, spec, dev, complete, status');
          return 1;
      }
    } catch (error) {
      console.error('❌ Error:', error.message);
      return 1;
    }
  }
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  
  YoloProWorkflowEnhancer.cli(args)
    .then(exitCode => process.exit(exitCode))
    .catch(error => {
      console.error('🚨 CLI error:', error);
      process.exit(1);
    });
}

module.exports = YoloProWorkflowEnhancer;