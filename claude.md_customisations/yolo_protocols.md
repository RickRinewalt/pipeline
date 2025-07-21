> Append following to CLAUDE.md:

#### Work Chunking Protocol (WCP)
Feature-based agile development with CI integration using EPICs, Features, and Issues with coordinated swarm approach:

##### 🎯 PHASE 1: EPIC Creation & Planning
1. **CREATE EPIC ISSUE**: Comprehensive GitHub issue tracking initiative
   - Title: Clear business-focused name
   - Content: Objectives, requirements, success criteria, dependencies
   - Labels: `epic`, `enhancement`, domain labels

2. **FEATURE BREAKDOWN**: 3-7 logical Features
   - Sequence by dependencies/value
   - 1-3 days completion each
   - Independently testable/deployable
   - Incremental business value

3. **ISSUE DECOMPOSITION**: 1-3 Issues per Feature
   - Specific testable acceptance criteria
   - Linked to parent feature
   - Priority labeled (high/medium/low)

##### 🔗 PHASE 2: GitHub Structure & Sub-Issues
4. **CREATE PROPER SUB-ISSUES** (GitHub CLI + GraphQL):
   ```bash
   # 1. Create issues normally
   gh issue create --title "Parent Feature" --body "Description"
   gh issue create --title "Sub-Issue Task" --body "Description"
   
   # 2. Get GraphQL IDs  
   gh api graphql --header 'X-Github-Next-Global-ID:1' -f query='
   { repository(owner: "OWNER", name: "REPO") { 
       issue(number: PARENT_NUM) { id }
   }}'
   
   # 3. Add sub-issue relationship
   gh api graphql --header 'X-Github-Next-Global-ID:1' -f query='
   mutation { addSubIssue(input: {
     issueId: "PARENT_GraphQL_ID"
     subIssueId: "CHILD_GraphQL_ID"
   }) { issue { id } subIssue { id } }}'
   ```

5. **EPIC TEMPLATE**:
   ```markdown
   # EPIC: [Name]
   
   ## Business Objective
   [Goal and value]
   
   ## Technical Requirements
   - [ ] Requirement 1-N
   
   ## Features (Linked)
   - [ ] Feature 1: #[num] - [Status]
   
   ## Success Criteria
   - [ ] Criteria 1-N
   - [ ] CI/CD: 100% success
   
   ## CI Protocol
   Per CLAUDE.md: 100% CI before progression, implementation-first, swarm coordination
   
   ## Dependencies
   [List external dependencies]
   ```

6. **FEATURE TEMPLATE**:
   ```markdown
   # Feature: [Name]
   **Parent**: #[EPIC]
   
   ## Description
   [What feature accomplishes]
   
   ## Sub-Issues (Proper GitHub hierarchy)
   - [ ] Sub-Issue 1: #[num] - [Status]
   
   ## Acceptance Criteria
   - [ ] Functional requirements
   - [ ] Tests pass (100% CI)
   - [ ] Review/docs complete
   
   ## Definition of Done
   - [ ] Implemented/tested
   - [ ] CI passing
   - [ ] PR approved
   - [ ] Deployed
   ```

##### 🚀 PHASE 3: Execution
6. **ONE FEATURE AT A TIME**:
   - Complete current feature (100% CI) before next
   - No parallel features
   - One PR per feature
   - CI gate enforcement

7. **SWARM DEPLOYMENT**: For complex features (2+ issues)
   - Hierarchical topology
   - Agent specialization
   - Memory coordination

##### 🔄 PHASE 4: CI Integration
8. **MANDATORY CI COMPLIANCE**:
   - Phase 1: Research via swarm
   - Phase 2: Implementation-first
   - Phase 3: Continuous monitoring
   - Gate: 100% success required

9. **CI MONITORING**:
   ```bash
   # Monitor feature branch
   gh run list --repo owner/repo --branch feature/[name] --limit 10
   
   # View run details
   gh run view [RUN_ID] --repo owner/repo --log-failed
   
   # Automated hooks
   npx claude-flow@alpha hooks ci-monitor-init --branch feature/[name]
   ```

##### 📊 PHASE 5: Progress Tracking
10. **VISUAL TRACKING**:
    ```
    📊 EPIC: [Name]
       ├── Features: X total
       ├── ✅ Complete: X (X%)
       ├── 🔄 Current: [Feature] (X/3 issues)
       ├── ⭕ Pending: X
       └── 🎯 CI: [PASS/FAIL]
    ```

11. **ISSUE UPDATES**:
    ```bash
    gh issue edit [NUM] --add-label "in-progress"
    gh issue edit [NUM] --body "Parent: #[FEATURE]"
    gh issue close [NUM] --comment "Completed in #[FEATURE]"
    ```

##### 🎯 WORKFLOW
1. Create EPIC with features/issues
2. Select next feature → Deploy swarm if complex → Apply CI Protocol
3. Achieve 100% CI → Full CD to production
4. Close issues → Update EPIC → Next feature

##### 🚨 SUCCESS FACTORS
- ONE feature at a time until production
- 100% CI + production deployment before next
- Swarm for complex features
- Implementation-first focus
- Continuous CI/CD monitoring
- Proper issue linking
- Max 3 issues/feature, 7 features/EPIC

##### 🏆 METRICS
- Feature velocity: 1-3 days to production
- CI/CD success rate: % achieving 100%
- Deployment lead time
- Issue completion rate
- EPIC progress vs timeline

#### Continuous Integration (CI) Protocol
Fix → Test → Commit → Push → Monitor → Repeat until 100% success. Automated cycles with intelligent monitoring:

##### 🔬 PHASE 1: Research & Analysis
1. **RESEARCH SWARM**: Deploy coordinated swarm
   - Init: `mcp__claude-flow__swarm_init`
   - Spawn agents: researcher, analyst, detective
   - Store findings in memory

2. **MULTI-SOURCE RESEARCH**:
   - Context7 MCP: Product/platform intel
   - WebSearch: Best practices, solutions
   - Codebase: Grep/Glob/Read analysis
   - GitHub: Issues, PRs, workflows

3. **ANALYSIS**:
   - Root causes vs symptoms
   - Categorize by severity/component
   - Document in GitHub with labels
   - Store in swarm memory

4. **TARGETED FIXES**: Focus on specific CI failures
   - TypeScript violations, console.log, unused vars
   - Fix identified files only
   - Target original failure items

##### 🎯 PHASE 2: Implementation
5. **IMPLEMENTATION-FIRST**:
   - Fix logic, not test expectations
   - Handle edge + main cases
   - Realistic test thresholds
   - Working functionality focus

6. **SWARM EXECUTION**:
   - Systematic TDD approach
   - Coordinate via hooks/memory
   - Target 100% per component
   - Branch and update issues

##### 🚀 PHASE 3: Monitoring & Integration
7. **ACTIVE MONITORING**:
   ```bash
   gh run list --repo owner/repo --limit N
   gh run view RUN_ID --repo owner/repo
   ```
   - ALWAYS check after pushing
   - Automated polling during CI
   - Analyze failures immediately
   - Target specific failure items

8. **INTELLIGENT MONITORING**:
   ```bash
   npx claude-flow@alpha hooks ci-monitor-init --adaptive true
   ```
   - Smart backoff (2s-5min)
   - Auto-merge capabilities
   - Swarm coordination

9. **PROTOCOL COMPLIANCE**:
   - Always check `gh run list/view` after push
   - Use monitoring hooks
   - Analyze failures with `--log-failed`

10. **INTEGRATION**:
    - Regular descriptive commits
    - Push at intervals for CI
    - PR on milestones
    - Review/merge on success

11. **ISSUE MANAGEMENT**:
    - Close with resolution summaries
    - Update tracking issues
    - Document methodologies
    - Label appropriately

12. **ITERATE TO DEPLOYMENT**:
    - Continue phases 1-11 until deploy success
    - Apply lessons learned
    - Scale swarm by complexity
    - Maintain coordination

##### 🏆 METRICS:
- 100% test success target
- Monitor: memory, performance, coverage
- Document breakthrough methods
- Coordinate via swarm memory/hooks

#### Continuous Deployment (CD) Protocol
Deploy → E2E Test → Monitor → Validate → Auto-promote to production. Automated with rollback and zero-downtime:

##### 🚀 PHASE 1: Staging
1. **AUTO-DEPLOY**: After CI passes
   ```bash
   gh workflow run deploy-staging.yml --ref feature/[name]
   ```
   - Blue-green deployment
   - Infrastructure as code
   - Store deployment metadata

2. **VALIDATE**: Environment health
   - Smoke tests
   - Service/DB connectivity
   - Configuration/secrets
   - Resource baselines

##### 🧪 PHASE 2: E2E Testing
3. **E2E EXECUTION**:
   - User journey tests
   - Cross-service integration
   - Security/access validation
   - Performance/load tests

4. **RESULT ANALYSIS**:
   - Deploy analysis swarm on failures
   - Categorize: flaky/environment/code
   - Auto-retry with backoff
   - Block on critical failures

##### 🔍 PHASE 3: Production Readiness
5. **SECURITY**: SAST/DAST scans
   - Container vulnerabilities
   - Compliance validation
   - SSL/encryption checks

6. **PERFORMANCE**: SLA validation
   - Load tests
   - Response/throughput metrics
   - Compare baselines
   - Generate reports

##### 🎯 PHASE 4: Production
7. **DEPLOY**: Safety controls
   - Canary: 5%→25%→50%→100%
   - Monitor each phase
   - Auto-rollback on spikes
   - Feature flags

8. **MONITOR**: Health tracking
   - App metrics: errors, response, throughput
   - Infrastructure: CPU, memory, disk, network
   - Automated alerts
   - Deployment notifications

##### 🔄 PHASE 5: Validation & Cleanup
9. **VALIDATE**: Production success
   - Smoke tests
   - Synthetic monitoring
   - Business metrics
   - Service health

10. **CLEANUP**:
    - Archive logs/metrics
    - Clean temp resources
    - Update docs/runbooks
    - Tag in VCS

11. **COMPLETE**: Feature closure
    - Update GitHub issues/boards
    - Close deployment items
    - Generate summary
    - Update swarm memory

##### 🏆 METRICS:
- Zero-downtime, <1% error rate
- Monitor: frequency, lead time, MTTR, failure rate
- Document patterns/rollback procedures
- Track via swarm memory
