
---

## Protocols (a.k.a. YOLO Protocols)
Standard protocols executed on request, e.g. "Initialize CI protocol": 

### Model Protocol
Always use Claude Sonnet. Start every Claude session with `model /sonnet`.

### Agile Delivery Protocols
Deliver work in manageable chunks through fully automated pipelines. The goal is to deliver features and keep going unattended (don't stop!) until the feature is fully deployed.

#### Work Chunking Protocol (WCP)
Feature-based agile with CI integration using EPICs, Features, and Issues:

##### 🎯 PHASE 1: Planning
1. **EPIC ISSUE**: Business-focused GitHub issue with objectives, requirements, criteria, dependencies. Labels: `epic`, `enhancement`

2. **FEATURE BREAKDOWN**: 3-7 Features (1-3 days each, independently testable/deployable, incremental value)

3. **ISSUE DECOMPOSITION**: 1-3 Issues per Feature with testable criteria, linked to parent, priority labeled

##### 🔗 PHASE 2: GitHub Structure
4. **CREATE SUB-ISSUES** (GitHub CLI + GraphQL):
   ```bash
   # Create issues
   gh issue create --title "Parent Feature" --body "Description"
   gh issue create --title "Sub-Issue Task" --body "Description"
   
   # Get GraphQL IDs  
   gh api graphql --header 'X-Github-Next-Global-ID:1' -f query='
   { repository(owner: "OWNER", name: "REPO") { 
       issue(number: PARENT_NUM) { id }
   }}'
   
   # Add sub-issue relationship
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
7. **ONE FEATURE AT A TIME**: Complete current feature (100% CI) before next. No parallel features. One PR per feature.

8. **SWARM DEPLOYMENT**: For complex features (2+ issues) - hierarchical topology, agent specialization, memory coordination

##### 🔄 PHASE 4: CI Integration
9. **MANDATORY CI**: Research→Implementation→Monitoring. 100% success required.

10. **CI MONITORING**:
    ```bash
    gh run list --repo owner/repo --branch feature/[name] --limit 10
    gh run view [RUN_ID] --repo owner/repo --log-failed
    npx claude-flow@alpha hooks ci-monitor-init --branch feature/[name]
    ```

##### 📊 PHASE 5: Tracking
11. **VISUAL TRACKING**:
    ```
    📊 EPIC: [Name]
       ├── Features: X total
       ├── ✅ Complete: X (X%)
       ├── 🔄 Current: [Feature] (X/3 issues)
       ├── ⭕ Pending: X
       └── 🎯 CI: [PASS/FAIL]
    ```

12. **ISSUE UPDATES**: Add labels, link parents, close with comments

##### 🎯 KEY RULES
- ONE feature at a time to production
- 100% CI before progression
- Swarm for complex features
- Implementation-first focus
- Max 3 issues/feature, 7 features/EPIC

#### Continuous Integration (CI) Protocol
Fix→Test→Commit→Push→Monitor→Repeat until 100%:

##### 🔬 PHASE 1: Research
1. **SWARM**: Deploy researcher/analyst/detective via `mcp__claude-flow__swarm_init`

2. **SOURCES**: Context7 MCP, WebSearch, Codebase analysis, GitHub

3. **ANALYSIS**: Root causes vs symptoms, severity categorization, GitHub documentation

4. **TARGETED FIXES**: Focus on specific CI failures (TypeScript violations, console.log, unused vars)

##### 🎯 PHASE 2: Implementation
5. **IMPLEMENTATION-FIRST**: Fix logic not test expectations, handle edge cases, realistic thresholds

6. **SWARM EXECUTION**: Systematic TDD, coordinate via hooks/memory, target 100% per component

##### 🚀 PHASE 3: Monitoring
7. **ACTIVE MONITORING**: ALWAYS check after pushing
   ```bash
   gh run list --repo owner/repo --limit N
   gh run view RUN_ID --repo owner/repo
   ```

8. **INTELLIGENT MONITORING**:
   ```bash
   npx claude-flow@alpha hooks ci-monitor-init --adaptive true
   ```
   Smart backoff (2s-5min), auto-merge, swarm coordination

9. **INTEGRATION**: Regular commits, interval pushes, PR on milestones

10. **ISSUE MANAGEMENT**: Close with summaries, update tracking, document methods, label appropriately

11. **ITERATE**: Continue until deployment success, apply lessons, scale swarm by complexity

##### 🏆 TARGET: 100% test success

#### Continuous Deployment (CD) Protocol
Deploy→E2E→Monitor→Validate→Auto-promote:

##### 🚀 PHASE 1: Staging
1. **AUTO-DEPLOY**: Blue-green after CI passes
   ```bash
   gh workflow run deploy-staging.yml --ref feature/[name]
   ```

2. **VALIDATE**: Smoke tests, connectivity, configuration/secrets, resource baselines

##### 🧪 PHASE 2: E2E Testing
3. **EXECUTION**: User journeys, cross-service integration, security/access, performance/load

4. **ANALYSIS**: Deploy swarm on failures, categorize flaky/environment/code, auto-retry, block critical

##### 🔍 PHASE 3: Production Readiness
5. **SECURITY**: SAST/DAST, container vulnerabilities, compliance, SSL/encryption

6. **PERFORMANCE**: SLA validation, load tests, response/throughput metrics, baseline comparison

##### 🎯 PHASE 4: Production
7. **DEPLOY**: Canary 5%→25%→50%→100%, monitor phases, auto-rollback on spikes, feature flags

8. **MONITOR**: App metrics (errors/response/throughput), infrastructure (CPU/memory/disk/network), automated alerts

##### 🔄 PHASE 5: Validation
9. **VALIDATE**: Smoke tests, synthetic monitoring, business metrics, service health

10. **CLEANUP**: Archive logs/metrics, clean temp resources, update docs/runbooks, tag VCS

11. **COMPLETE**: Update GitHub issues/boards, generate summary, update swarm memory

##### 🏆 TARGETS: Zero-downtime, <1% error rate
