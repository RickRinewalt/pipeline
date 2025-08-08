#!/usr/bin/env node

/**
 * YOLO-WARP Automation Engine Example
 * Demonstrates complete milestone automation workflow
 */

const { createAutomationEngine, utils, constants } = require('../src/automation');

// Example usage with environment variables
async function runBasicAutomation() {
  console.log('🚀 Starting YOLO-WARP Automation Engine Example\n');

  // Create automation engine with basic configuration
  const engine = createAutomationEngine({
    github: {
      owner: process.env.GITHUB_OWNER || 'example-org',
      repo: process.env.GITHUB_REPO || 'example-repo',
      token: process.env.GITHUB_TOKEN || 'demo-token'
    },
    automation: {
      logLevel: 'info',
      maxConcurrentTasks: 3,
      retryAttempts: 2
    },
    sparc: {
      enableParallelProcessing: true,
      timeoutMs: 30000
    },
    wcp: {
      maxFeaturesPerEpic: 5,
      maxIssuesPerFeature: 3
    },
    ci: {
      qualityGates: {
        testCoverage: 85,
        lintErrors: 0,
        buildSuccess: true
      }
    }
  });

  // Define comprehensive workflow specification
  const workflowSpec = {
    milestoneId: 123,
    epicTitle: 'User Authentication System',
    businessObjective: 'Implement secure user authentication and authorization',
    sparcEnabled: true,
    wcpEnabled: true,
    ciEnabled: true,
    branch: 'feature/user-auth-system',
    allowPartialFailure: true,
    
    features: [
      {
        name: 'User Registration',
        description: 'Allow new users to create accounts',
        acceptanceCriteria: [
          'Users can register with email and password',
          'Email verification is required',
          'Password strength validation is enforced',
          'Duplicate email addresses are rejected'
        ],
        subTasks: [
          { title: 'Create registration API endpoint', estimate: 4 },
          { title: 'Implement email verification', estimate: 3 },
          { title: 'Add password validation', estimate: 2 }
        ]
      },
      
      {
        name: 'User Login',
        description: 'Enable users to authenticate and access the system',
        acceptanceCriteria: [
          'Users can login with email/password',
          'JWT tokens are generated for valid sessions',
          'Invalid credentials show appropriate errors',
          'Account lockout after failed attempts'
        ],
        subTasks: [
          { title: 'Create login API endpoint', estimate: 3 },
          { title: 'Implement JWT token generation', estimate: 4 },
          { title: 'Add account lockout mechanism', estimate: 3 }
        ]
      },
      
      {
        name: 'Password Management',
        description: 'Allow users to reset and change passwords',
        acceptanceCriteria: [
          'Users can request password reset via email',
          'Reset links expire after 1 hour',
          'Users can change passwords when logged in',
          'Password history prevents reuse'
        ],
        subTasks: [
          { title: 'Implement password reset flow', estimate: 5 },
          { title: 'Add password change functionality', estimate: 2 },
          { title: 'Create password history tracking', estimate: 3 }
        ]
      }
    ],

    qualityGates: {
      testCoverage: 90,
      lintErrors: 0,
      buildSuccess: true,
      securityIssues: 0
    },

    environment: {
      NODE_ENV: 'development',
      API_URL: 'https://api.dev.example.com'
    }
  };

  console.log('📋 Workflow Specification:');
  console.log(`- EPIC: ${workflowSpec.epicTitle}`);
  console.log(`- Features: ${workflowSpec.features.length}`);
  console.log(`- Milestone: ${workflowSpec.milestoneId}`);
  console.log(`- Branch: ${workflowSpec.branch}\n`);

  try {
    // Validate workflow specification
    console.log('✅ Validating workflow specification...');
    const validation = utils.validateWorkflowSpec(workflowSpec);
    if (!validation.valid) {
      console.error('❌ Validation failed:', validation.errors);
      return;
    }
    console.log('✅ Workflow specification is valid\n');

    // Execute automation workflow
    console.log('🔄 Starting automation workflow...');
    const startTime = Date.now();
    
    const result = await engine.automateWorkflow(workflowSpec);
    
    const duration = Date.now() - startTime;
    console.log(`⏱️  Workflow completed in ${duration}ms\n`);

    // Display results
    console.log('📊 Automation Results:');
    console.log(`- Success: ${result.success ? '✅' : '❌'}`);
    console.log(`- Workflow ID: ${result.workflowId}`);
    
    if (result.success) {
      console.log(`- Duration: ${result.duration}ms`);
      console.log('- Completed Components:');
      result.completedComponents?.forEach(component => {
        console.log(`  ✅ ${component}`);
      });
      
      if (result.components?.milestone) {
        console.log(`- Milestone: ${result.components.milestone.issuesAnalyzed} issues analyzed`);
      }
      
      if (result.components?.sparc) {
        console.log(`- SPARC: ${result.components.sparc.completedPhases}/5 phases completed`);
      }
      
      if (result.components?.wcp) {
        console.log(`- WCP: ${result.components.wcp.suggestedFeatures} features suggested`);
      }
      
      if (result.components?.ci) {
        console.log(`- CI: Pipeline ${result.components.ci.runId} started`);
      }
    } else {
      console.log(`- Error: ${result.error}`);
      
      if (result.partialSuccess) {
        console.log('- Partial Success - Some components completed:');
        result.completedComponents?.forEach(component => {
          console.log(`  ✅ ${component}`);
        });
        
        console.log('- Failed components:');
        result.failedComponents?.forEach(component => {
          console.log(`  ❌ ${component}`);
        });
      }
    }

    // Monitor workflow progress
    if (result.success || result.partialSuccess) {
      console.log('\n📈 Monitoring workflow progress...');
      
      let monitoringCount = 0;
      const maxMonitoring = 3; // Limit for demo
      
      while (monitoringCount < maxMonitoring) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
        
        const status = await engine.monitorWorkflow(result.workflowId);
        
        console.log(`⏱️  Progress Update ${monitoringCount + 1}:`);
        console.log(`- Overall Progress: ${status.overallProgress || 0}%`);
        console.log(`- Status: ${status.status}`);
        console.log(`- Elapsed: ${Math.round(status.duration / 1000)}s`);
        
        if (status.components) {
          Object.entries(status.components).forEach(([component, data]) => {
            if (data.progress !== undefined) {
              console.log(`  - ${component}: ${data.progress}%`);
            }
          });
        }
        
        monitoringCount++;
        
        if (status.status === constants.WORKFLOW_STATUS.COMPLETED || 
            status.status === constants.WORKFLOW_STATUS.FAILED) {
          break;
        }
      }
    }

    // Generate progress report
    console.log('\n📊 Generating comprehensive progress report...');
    const report = await engine.progressReporter.generateReport(result.workflowId);
    
    if (report.error) {
      console.log(`❌ Report generation failed: ${report.error}`);
    } else {
      console.log('✅ Progress Report Generated:');
      console.log(`- Workflow: ${report.workflowId}`);
      console.log(`- Status: ${report.status}`);
      console.log(`- Progress: ${report.overallProgress}%`);
      
      if (report.estimatedCompletion) {
        const eta = new Date(report.estimatedCompletion);
        console.log(`- ETA: ${eta.toLocaleString()}`);
      }
      
      if (report.bottlenecks?.length > 0) {
        console.log(`- Bottlenecks: ${report.bottlenecks.join(', ')}`);
      }
      
      if (report.recommendations?.length > 0) {
        console.log('- Recommendations:');
        report.recommendations.forEach(rec => {
          console.log(`  📝 ${rec}`);
        });
      }
    }

    // Display dashboard summary
    console.log('\n📈 Dashboard Summary:');
    const dashboard = engine.progressReporter.getDashboardData();
    
    console.log(`- Total Workflows: ${dashboard.summary.totalWorkflows}`);
    console.log(`- Completed: ${dashboard.summary.completedWorkflows}`);
    console.log(`- In Progress: ${dashboard.summary.inProgressWorkflows}`);
    console.log(`- Average Progress: ${Math.round(dashboard.summary.averageProgress)}%`);
    
    if (dashboard.activeWorkflows.length > 0) {
      console.log('- Active Workflows:');
      dashboard.activeWorkflows.slice(0, 3).forEach(workflow => {
        console.log(`  🔄 ${workflow.id}: ${workflow.progress}%`);
      });
    }

  } catch (error) {
    console.error('❌ Automation workflow failed:', error.message);
    console.error('Stack trace:', error.stack);
  }

  console.log('\n✨ YOLO-WARP Automation Engine Example Complete!');
}

// Advanced example with error handling and recovery
async function runAdvancedAutomation() {
  console.log('\n🚀 Advanced Automation Example with Error Handling\n');

  // Create enterprise-grade configuration
  const engine = createAutomationEngine({
    github: {
      owner: process.env.GITHUB_OWNER || 'enterprise-org',
      repo: process.env.GITHUB_REPO || 'enterprise-app',
      token: process.env.GITHUB_TOKEN || 'enterprise-token'
    },
    
    automation: {
      maxConcurrentTasks: 10,
      retryAttempts: 5,
      enableErrorRecovery: true
    },
    
    errorHandling: {
      enableAutoRetry: true,
      maxRetryAttempts: 5,
      backoffStrategy: 'exponential',
      enableCircuitBreaker: true,
      circuitBreakerThreshold: 3,
      enableGracefulDegradation: true
    },
    
    performance: {
      enableParallelExecution: true,
      maxParallelTasks: 15,
      enableCaching: true,
      resourceLimits: {
        maxMemoryMB: 4096,
        maxCpuPercent: 85
      }
    },

    security: {
      enableSecurityScanning: true,
      scanThresholds: {
        critical: 0,
        high: 0,
        medium: 2
      }
    }
  });

  const complexWorkflowSpec = {
    milestoneId: 456,
    epicTitle: 'E-commerce Platform Integration',
    businessObjective: 'Build comprehensive e-commerce functionality',
    sparcEnabled: true,
    wcpEnabled: true,
    ciEnabled: true,
    allowPartialFailure: true,
    
    features: [
      utils.createFeatureSpec('Product Catalog', [
        'Display products with images and descriptions',
        'Filter and search functionality',
        'Category-based navigation',
        'Product recommendations'
      ], { defaultEstimate: 4 }),
      
      utils.createFeatureSpec('Shopping Cart', [
        'Add/remove items from cart',
        'Update item quantities',
        'Calculate totals with tax',
        'Persist cart across sessions'
      ], { defaultEstimate: 3 }),
      
      utils.createFeatureSpec('Checkout Process', [
        'Secure payment processing',
        'Order confirmation system',
        'Inventory management',
        'Email notifications'
      ], { defaultEstimate: 5 })
    ],
    
    qualityGates: {
      testCoverage: 95,
      lintErrors: 0,
      buildSuccess: true,
      securityIssues: 0,
      performanceThreshold: 90
    }
  };

  try {
    console.log('🔧 Executing advanced automation with error recovery...');
    
    const result = await engine.automateWorkflow(complexWorkflowSpec);
    
    // Parse and display results
    const summary = utils.parseAutomationResults(result);
    
    console.log('📊 Advanced Automation Summary:');
    console.log(`- Success: ${summary.success ? '✅' : '❌'}`);
    console.log(`- Partial Success: ${summary.partialSuccess ? '✅' : '❌'}`);
    console.log(`- Components Status:`);
    
    Object.entries(summary.components || {}).forEach(([component, success]) => {
      console.log(`  - ${component}: ${success ? '✅' : '❌'}`);
    });

    // Demonstrate metrics collection
    console.log('\n📈 Collecting performance metrics...');
    const metrics = engine.getWorkflowMetrics({
      since: Date.now() - 3600000 // Last hour
    });
    
    console.log(`- Success Rate: ${metrics.successRate.toFixed(1)}%`);
    console.log(`- Average Duration: ${Math.round(metrics.averageDuration / 1000)}s`);
    console.log(`- Active Workflows: ${metrics.activeWorkflows}`);

  } catch (error) {
    console.error('❌ Advanced automation failed:', error.message);
    
    // Demonstrate error analysis
    if (error.componentFailures) {
      console.log('🔍 Component Failure Analysis:');
      error.componentFailures.forEach(failure => {
        console.log(`- ${failure.component}: ${failure.reason}`);
      });
    }
  }
}

// Export for use in other examples
module.exports = {
  runBasicAutomation,
  runAdvancedAutomation
};

// Run examples if executed directly
if (require.main === module) {
  (async () => {
    try {
      await runBasicAutomation();
      await runAdvancedAutomation();
    } catch (error) {
      console.error('Example execution failed:', error);
      process.exit(1);
    }
  })();
}