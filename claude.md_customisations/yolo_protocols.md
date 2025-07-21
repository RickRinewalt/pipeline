> Append below to CLAUDE.md:

## Protocols (a.k.a. YOLO Protocols)
Standard protocols to be executed when asked, e.g. "Initialize CI protocol": 

### Agile Delivery Protocols
Structure work into manageable chunks and deliver them through fully automated pipelines with minimal manual intervention. 

#### Work Chunking Protocol (WCP)
Enhanced agile development protocol for feature-based work organization with CI integration. For systematic feature development using EPICs, Features, and Issues in a coordinated swarm approach:

##### 🎯 PHASE 1: EPIC Creation & Planning
1. **CREATE EPIC ISSUE**: Create comprehensive EPIC issue in GitHub to track overall initiative:
   - **Title**: Clear, business-focused EPIC name (e.g., "EPIC: Neural Bridge System Integration")
   - **Description**: Include business objectives, technical requirements, success criteria
   - **Labels**: `epic`, `enhancement`, appropriate domain labels
   - **Acceptance Criteria**: Clear definition of done for entire EPIC
   - **Dependencies**: List any external dependencies or blockers

2. **FEATURE BREAKDOWN**: Decompose EPIC into 3-7 logical Features:
   - **Logical Sequencing**: Order features based on dependencies and business value
   - **Feature Sizing**: Each feature should be completable in 1-3 days maximum
   - **Clear Boundaries**: Each feature should be independently testable and deployable
   - **Business Value**: Each feature should deliver incremental business value

3. **ISSUE DECOMPOSITION**: Break each Feature into 1-3 specific Issues:
   - **Maximum 3 Issues per Feature**: Keep features focused and manageable
   - **Clear Scope**: Each issue should have specific, testable acceptance criteria
   - **Proper Linking**: Link all issues to their parent feature using GitHub issue relationships
   - **Priority Assignment**: Use GitHub labels for priority (high, medium, low)

##### 🔗 PHASE 2: GitHub Issue Structure & Linking
4. **EPIC ISSUE TEMPLATE**:
   ```markdown
   # EPIC: [Epic Name]
   
   ## Business Objective
   [Clear business goal and value proposition]
   
   ## Technical Requirements
   - [ ] Requirement 1
   - [ ] Requirement 2
   - [ ] Requirement 3
   
   ## Features (Linked Issues)
   - [ ] Feature 1: [Link to Feature Issue] - [Status]
   - [ ] Feature 2: [Link to Feature Issue] - [Status]
   - [ ] Feature 3: [Link to Feature Issue] - [Status]
   
   ## Success Criteria
   - [ ] Criteria 1
   - [ ] Criteria 2
   - [ ] CI/CD Pipeline: 100% success rate
   
   ## CI Protocol Integration
   This EPIC follows the **CI (YOLO) Protocol** as per CLAUDE.md:
   - All features must achieve 100% CI success before progression
   - Implementation-first strategy for all development work
   - Coordinated swarm deployment for complex features
   - Continuous monitoring of GitHub Actions workflows
   
   ## Dependencies
   - External Dependency 1
   - External Dependency 2
   ```

5. **FEATURE ISSUE TEMPLATE**:
   ```markdown
   # Feature: [Feature Name]
   
   **Parent EPIC**: [Link to EPIC Issue]
   
   ## Feature Description
   [Clear description of what this feature accomplishes]
   
   ## Issues (Implementation Tasks)
   - [ ] Issue 1: [Link to Implementation Issue] - [Status]
   - [ ] Issue 2: [Link to Implementation Issue] - [Status]
   - [ ] Issue 3: [Link to Implementation Issue] - [Status]
   
   ## Acceptance Criteria
   - [ ] Functional requirement 1
   - [ ] Functional requirement 2
   - [ ] All tests pass (100% CI success)
   - [ ] Code review completed
   - [ ] Documentation updated
   
   ## CI Protocol Compliance
   - [ ] Swarm coordination deployed if complex
   - [ ] Implementation-first methodology applied
   - [ ] CI monitoring active throughout development
   - [ ] All GitHub Actions workflows passing
   
   ## Definition of Done
   - [ ] Feature implemented and tested
   - [ ] CI pipeline passing (100% success)
   - [ ] PR created and approved
   - [ ] Feature deployed to staging/production
   ```

##### 🚀 PHASE 3: Agile Execution Pattern
6. **ONE FEATURE AT A TIME**: Strict sequential feature development:
   - **Complete Current Feature**: Achieve 100% CI success before moving to next feature
   - **No Parallel Features**: Focus on one feature completely before starting another
   - **Feature-Based PRs**: Create one PR per feature containing all related issues
   - **CI Gate**: Each feature MUST pass CI protocol before progression

7. **COORDINATED SWARM DEPLOYMENT**: Use Claude Flow coordination for complex features:
   - **Feature Complexity Assessment**: Deploy swarm for features with 2+ issues
   - **Swarm Strategy**: Use hierarchical topology for feature development
   - **Agent Specialization**: Assign agents based on feature requirements
   - **Memory Coordination**: Store feature progress in swarm memory for continuity

##### 🔄 PHASE 4: CI Protocol Integration
8. **MANDATORY CI COMPLIANCE**: Every feature MUST follow CI (YOLO) Protocol:
   - **Phase 1**: Research & Analysis using coordinated swarm
   - **Phase 2**: Implementation-first strategy with parallel execution
   - **Phase 3**: Continuous monitoring with GitHub Actions
   - **Success Gate**: 100% CI success required before feature completion

9. **FEATURE-LEVEL CI MONITORING**:
   ```bash
   # Monitor CI status for current feature branch
   gh run list --repo owner/repo --branch feature/[feature-name] --limit 10
   
   # View specific CI run details
   gh run view [RUN_ID] --repo owner/repo --log-failed
   
   # Automated CI monitoring with hooks
   npx claude-flow@alpha hooks ci-monitor-init --branch feature/[feature-name]
   ```

##### 📊 PHASE 5: Progress Tracking & Reporting
10. **VISUAL PROGRESS TRACKING**: Use standardized progress format:
    ```
    📊 EPIC Progress: [EPIC Name]
       ├── Total Features: X
       ├── ✅ Completed: X (X%)
       ├── 🔄 Current: [Feature Name] (X/3 issues)
       ├── ⭕ Pending: X features
       └── 🎯 CI Status: [PASSING/FAILING]
    
    🔄 Current Feature: [Feature Name]
       ├── 🔴 HIGH: Issue 1 - Implementation task ▶
       ├── 🟡 MED: Issue 2 - Testing task ▶
       └── 🟢 LOW: Issue 3 - Documentation task ▶
    
    ⭕ Next Features:
       ├── Feature 2: [Description]
       ├── Feature 3: [Description]
       └── Feature 4: [Description]
    ```

11. **AUTOMATED ISSUE UPDATES**: Use GitHub CLI for progress tracking:
    ```bash
    # Update issue status
    gh issue edit [ISSUE_NUMBER] --add-label "in-progress"
    
    # Link issues to features
    gh issue edit [ISSUE_NUMBER] --body "Parent Feature: #[FEATURE_NUMBER]"
    
    # Close completed issues
    gh issue close [ISSUE_NUMBER] --comment "Completed as part of Feature #[FEATURE_NUMBER]"
    ```

##### 🎯 EXECUTION WORKFLOW

###### Step 1: EPIC & Feature Planning
- Create EPIC issue with full business context
- Break down into logical, sequenced features
- Create feature issues with linked implementation issues
- Ensure all issues properly linked and labeled

###### Step 2: Feature Development Loop
- Select next feature in sequence
- Deploy coordinated swarm if complex (2+ issues)
- Apply CI (YOLO) Protocol throughout development
- Complete ALL feature issues before progression

###### Step 3: CI/CD Gate Validation
- Achieve 100% CI success for current feature
- Execute complete CD protocol: Deploy → E2E Test → Production
- Create feature-based PR with all related changes
- Monitor CI/CD pipeline status continuously
- Do NOT progress to next feature until fully deployed to production

###### Step 4: Feature Completion
- Validate production deployment success
- Close all feature issues and deployment tasks
- Update EPIC progress with deployment status
- Archive feature branch after successful deployment
- Begin next feature in sequence only after full CD completion

##### 🚨 CRITICAL SUCCESS FACTORS

1. **NO FEATURE PARALLELISM**: Work on ONE feature at a time until full production deployment
2. **CI/CD GATE ENFORCEMENT**: 100% CI success AND production deployment required before next feature
3. **SWARM COORDINATION**: Use Claude Flow MCP tools for complex features and deployments
4. **IMPLEMENTATION-FIRST**: Focus on working functionality over perfect tests
5. **CONTINUOUS MONITORING**: Active CI/CD pipeline monitoring throughout development and deployment
6. **PROPER LINKING**: All issues linked to features, features linked to EPIC
7. **AGILE SIZING**: Maximum 3 issues per feature, maximum 7 features per EPIC

#### 🏆 SUCCESS METRICS
- **Feature Velocity**: Average time to complete feature including full deployment (target: 1-3 days)
- **CI/CD Success Rate**: Percentage of features achieving 100% CI and successful production deployment
- **Deployment Lead Time**: Time from feature completion to production deployment
- **Issue Completion**: Percentage of issues completed within feature scope
- **EPIC Progress**: Overall completion rate against original timeline including deployment status

#### Continuous Integration (CI) protocol
Execute systematic CI fixing in automated cycles: Fix → Test → Commit → Push → Monitor CI → Repeat until 100% success. Run continuously without manual intervention using intelligent CI monitoring and auto-merge capabilities:

##### 🔬 PHASE 1: Research & Analysis
1. **RESEARCH SWARM DEPLOYMENT**: Deploy coordinated research swarm using Claude Flow MCP tools:
   - Initialize swarm: `mcp__claude-flow__swarm_init` with appropriate topology
   - Spawn research agents: `mcp__claude-flow__agent_spawn` (researcher, analyst, detective types)
   - Store findings: `mcp__claude-flow__memory_usage` for coordination

2. **MULTI-SOURCE RESEARCH**: Gather intelligence using all available resources:
   - **Context7 MCP**: Search for intel on specific products, platforms, technologies (add Context7 MCP if not available)
   - **WebSearch**: Search for latest best practices, error patterns, and solutions
   - **Codebase Analysis**: Use Grep, Glob, Read tools to understand current state
   - **GitHub Integration**: Check issues, PRs, workflow history using `gh` commands

3. **SYSTEMATIC ANALYSIS**: Apply analysis patterns:
   - Identify root causes vs symptoms
   - Categorize issues by severity and component
   - Document findings in GitHub issues with proper labels (check what labels are available, add new labels if required before creating/modifying issues)
   - Store research results in swarm memory for coordination

4. **TARGETED CI FAILURE RESOLUTION**: Focus on specific CI failure items mentioned in GitHub Actions output:
   - Address TypeScript strict mode violations, console.log removal, unused variables
   - Target original failure items rather than comprehensive codebase cleanup
   - Fix specific linting errors in identified files vs. fixing all codebase issues

##### 🎯 PHASE 2: Implementation-First Strategy
5. **IMPLEMENTATION-FIRST FIXES**: Apply implementation-first methodology:
   - Fix actual implementation logic rather than relaxing test expectations
   - Handle both edge cases and main use cases simultaneously  
   - Use realistic thresholds for test environment while maintaining production standards
   - Focus on working functionality over perfect pattern matching

6. **SWARM COORDINATION**: Execute fixes using coordinated parallel approach:
   - Use swarm to fix problems systematically with TDD approach
   - All agents MUST coordinate via Claude Flow hooks and memory
   - Target 100% test success for each component
   - Create branches for changes, update issues with progress

##### 🚀 PHASE 3: Continuous Monitoring & Integration
7. **ACTIVE MONITORING**: Monitor GitHub Actions workflows continuously:
   - Use `gh run list --repo owner/repo --limit N` to track workflow status
   - Monitor specific runs: `gh run view RUN_ID --repo owner/repo`
   - **CRITICAL**: Always check CI status after pushing changes - never assume success
   - Set up automated polling during CI execution using intelligent CI monitoring hooks
   - Analyze results immediately when CI finishes - target specific failure items first
   - Use targeted fixes for specific CI failure items rather than broad codebase cleanup

8. **INTELLIGENT CI MONITORING SYSTEM**: Deploy automated CI monitoring:
   - Use command: `npx claude-flow@alpha hooks ci-monitor-init --adaptive true`
   - Deploy hooks for automated CI monitoring instead of manual polling
   - Use smart backoff (2s-5min intervals), auto-merge capabilities, swarm coordination

9. **CI PROTOCOL VIOLATION DETECTION**: Prevent protocol violations:
   - ALWAYS check `gh run list` and `gh run view` after pushing changes
   - Use intelligent CI monitoring hooks to prevent protocol violations
   - When CI fails, immediately analyze with `gh run view --log-failed`

10. **SYSTEMATIC INTEGRATION**: Follow integration workflow:
    - Commit regularly with descriptive messages including methodology
    - Push at appropriate intervals to trigger CI workflows
    - Create PRs when significant milestones achieved (e.g., component 100% success)
    - Review and merge when tests pass and code quality verified

11. **ISSUE LIFECYCLE MANAGEMENT**: Maintain clear issue tracking:
    - Close resolved issues with detailed resolution summaries
    - Update tracking issues with breakthrough achievements
    - Document successful methodologies for future reference
    - Label appropriately (bug, enhancement, critical, resolved, etc.)

12. **ITERATIVE IMPROVEMENT**: Continue until deployment success:
    - Keep iterating through phases 1-11 until build successfully deploys
    - Apply lessons learned from previous iterations
    - Scale swarm size based on problem complexity
    - Maintain coordination through Claude Flow memory across iterations

##### 🏆 SUCCESS METRICS:
- Target: 100% test success for critical components
- Monitor: Memory usage, performance thresholds, code coverage
- Document: Methodologies that achieve breakthrough results
- Coordinate: All agents use swarm memory and hooks for alignment

#### Continuous Deployment (CD) protocol
Execute automated deployment pipeline after CI success: Deploy → E2E Test → Monitor → Validate → Auto-promote until production. Run fully automated with rollback capabilities and zero-downtime deployment strategies:

##### 🚀 PHASE 1: Staging Deployment
1. **AUTOMATED STAGING DEPLOY**: Deploy to staging environment immediately after CI passes:
   - Trigger deployment pipeline: `gh workflow run deploy-staging.yml --ref feature/[name]`
   - Use blue-green deployment strategy for zero downtime
   - Deploy using infrastructure as code (Terraform, CloudFormation, etc.)
   - Store deployment metadata: `mcp__claude-flow__memory_usage` for tracking

2. **ENVIRONMENT VALIDATION**: Validate staging environment health:
   - Run smoke tests to verify basic functionality
   - Check service health endpoints and database connectivity  
   - Validate environment configuration and secrets
   - Monitor resource usage and performance baselines

##### 🧪 PHASE 2: End-to-End Testing
3. **E2E TEST EXECUTION**: Run comprehensive end-to-end tests in staging:
   - Execute full user journey tests with real data flows
   - Test cross-service integrations and external API connections
   - Validate security policies and access controls
   - Run performance and load tests under realistic conditions

4. **TEST RESULT ANALYSIS**: Analyze E2E test results with swarm coordination:
   - Deploy analysis swarm if failures detected: `mcp__claude-flow__swarm_init`
   - Categorize failures: flaky tests, environment issues, or code defects
   - Auto-retry flaky tests with exponential backoff
   - Block promotion on any critical test failures

##### 🔍 PHASE 3: Production Readiness
5. **SECURITY SCANNING**: Execute comprehensive security validation:
   - Run SAST/DAST security scans on deployed application
   - Validate container image vulnerabilities and dependencies
   - Check compliance with security policies and standards
   - Verify SSL certificates and encryption configurations

6. **PERFORMANCE VALIDATION**: Validate performance against SLA requirements:
   - Run load tests against staging environment
   - Measure response times, throughput, and resource utilization
   - Compare metrics against production baselines and SLA targets
   - Generate performance reports and alerts for regressions

##### 🎯 PHASE 4: Production Deployment
7. **PRODUCTION DEPLOYMENT**: Deploy to production with safety controls:
   - Use canary deployment strategy (5% → 25% → 50% → 100% traffic)
   - Monitor key metrics during each canary phase
   - Implement automatic rollback on error rate or latency spikes
   - Use feature flags for gradual feature enablement

8. **POST-DEPLOYMENT MONITORING**: Monitor production deployment health:
   - Track application metrics: error rates, response times, throughput
   - Monitor infrastructure: CPU, memory, disk, network utilization
   - Set up automated alerts for anomalies and threshold breaches
   - Generate deployment success/failure notifications

##### 🔄 PHASE 5: Validation & Cleanup
9. **PRODUCTION VALIDATION**: Validate production deployment success:
   - Run production smoke tests to verify critical functionality
   - Validate user experience with synthetic transaction monitoring
   - Check business metrics and conversion rates for regressions
   - Confirm all services are healthy and responding correctly

10. **DEPLOYMENT CLEANUP**: Clean up deployment artifacts and environments:
    - Archive deployment logs and metrics for auditing
    - Clean up temporary resources and staging environments
    - Update deployment documentation and runbooks
    - Tag successful deployment in version control system

11. **FEATURE COMPLETION**: Mark feature as fully deployed:
    - Update feature status in GitHub issues and project boards
    - Close deployment-related issues and PRs
    - Generate deployment summary and lessons learned
    - Update `mcp__claude-flow__memory_usage` with deployment success

##### 🏆 SUCCESS METRICS:
- Target: Zero-downtime deployments with <1% error rate
- Monitor: Deployment frequency, lead time, MTTR, change failure rate
- Document: Successful deployment patterns and rollback procedures  
- Coordinate: All deployment steps use swarm memory for tracking
