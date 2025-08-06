# YOLO-Pro CLI Usage Guide

> **Comprehensive reference for YOLO-Pro CLI commands and Claude-Flow integration patterns**

## Command Reference

### Work Chunking Protocol (WCP) Commands

#### `yolo-pro wcp init`
Initialize Work Chunking Protocol in current project.

**Syntax:**
```bash
yolo-pro wcp init [options]
```

**Options:**
- `--epic <name>` - Create initial EPIC issue
- `--integrate-claude-flow` - Setup claude-flow integration
- `--github-repo <repo>` - Specify GitHub repository
- `--template <template>` - Use custom EPIC template

**Example:**
```bash
yolo-pro wcp init --epic "User Management System" --integrate-claude-flow
```

**Integration with Claude-Flow:**
```bash
# Automatically executed during init
npx claude-flow@alpha memory_usage store "wcp_initialized" "true" --namespace yolo-protocols
npx claude-flow@alpha hooks pre-task --task "wcp-init" --sync-memory
```

#### `yolo-pro wcp feature <name>`
Start new feature following WCP structure.

**Syntax:**
```bash
yolo-pro wcp feature <feature-name> [options]
```

**Options:**
- `--epic <epic-number>` - Link to specific EPIC issue
- `--issues <count>` - Number of sub-issues to create (1-3)
- `--swarm-ready` - Prepare for claude-flow swarm deployment
- `--ci-monitor` - Enable automatic CI monitoring

**Example:**
```bash
yolo-pro wcp feature "user-authentication" --epic 21 --issues 3 --swarm-ready
```

**Behind the Scenes:**
1. Creates GitHub feature issue with proper template
2. Creates 1-3 sub-issues with parent relationships  
3. Sets up GitHub GraphQL issue linking
4. Initializes claude-flow memory with feature context
5. Prepares swarm topology if `--swarm-ready` specified

#### `yolo-pro wcp status`
Show current WCP state and progress.

**Syntax:**
```bash
yolo-pro wcp status [options]
```

**Options:**
- `--detailed` - Include sub-issue progress
- `--ci-status` - Include CI pipeline status
- `--epic <number>` - Focus on specific EPIC

**Example Output:**
```
📊 EPIC: User Management System (#21)
   ├── Features: 3 total
   ├── ✅ Complete: 1 (33%)
   ├── 🔄 Current: user-authentication (2/3 issues)
   ├── ⭕ Pending: 2
   └── 🎯 CI: PASS (100% success rate)

🔄 Current Feature: user-authentication
   ├── Issue #25: Setup auth service ✅
   ├── Issue #26: Implement JWT tokens 🔄 
   └── Issue #27: Add login UI ⭕

🤖 Claude-Flow Integration: ACTIVE
   ├── Memory namespace: yolo-protocols
   ├── Swarm status: READY (hierarchical, 3 agents)
   └── Hooks: pre-task, post-edit, post-task
```

### Continuous Integration (CI) Commands

#### `yolo-pro ci monitor`
Start intelligent CI monitoring with adaptive backoff.

**Syntax:**
```bash
yolo-pro ci monitor [options]
```

**Options:**
- `--adaptive` - Enable adaptive backoff (2s-5min)
- `--swarm-on-failure` - Deploy debugging swarm on failures
- `--auto-fix` - Attempt automatic fixes for common issues
- `--branch <branch>` - Monitor specific branch
- `--until-success` - Continue until 100% CI success

**Example:**
```bash
yolo-pro ci monitor --adaptive --swarm-on-failure --until-success
```

**Monitoring Phases:**
1. **Initial Check** (2s intervals): Fast feedback for quick fixes
2. **Escalated Monitoring** (30s intervals): After 3+ failures
3. **Deep Analysis** (5min intervals): Deploy claude-flow swarm for complex issues
4. **Success Validation**: Verify 100% test passage

#### `yolo-pro ci fix`
Execute automated CI problem resolution.

**Syntax:**
```bash
yolo-pro ci fix [options]
```

**Options:**
- `--implementation-first` - Fix logic before test expectations  
- `--target <type>` - Target specific issues (typescript, console, unused)
- `--swarm-deploy` - Deploy debugging swarm immediately
- `--realistic-thresholds` - Apply realistic performance/coverage thresholds

**Example:**
```bash
yolo-pro ci fix --implementation-first --target typescript,console --swarm-deploy
```

**Fix Priorities:**
1. **TypeScript Errors**: Type violations, interface mismatches
2. **Console Output**: Remove console.log, console.warn statements  
3. **Unused Variables**: Clean unused imports and variables
4. **Logic Issues**: Implementation flaws (via swarm analysis)

### GitHub Integration Commands

#### `yolo-pro gh epic create`
Create EPIC issue with proper WCP template.

**Syntax:**
```bash
yolo-pro gh epic create <title> [options]
```

**Options:**
- `--objectives <text>` - Business objectives
- `--requirements <file>` - Requirements from file
- `--features <count>` - Expected feature count (3-7)
- `--template <template>` - Use custom template

**Example:**
```bash
yolo-pro gh epic create "User Management System" --objectives "Secure user authentication and profile management" --features 5
```

**EPIC Template Applied:**
```markdown
# EPIC: User Management System

## Business Objective
Secure user authentication and profile management

## Technical Requirements
- [ ] Authentication service setup
- [ ] JWT token implementation
- [ ] User profile CRUD operations
- [ ] Password security compliance

## Features (Linked)
- [ ] Feature 1: #[auto-generated] - [Pending]

## Success Criteria
- [ ] 100% test coverage
- [ ] Security audit passed
- [ ] CI/CD: 100% success

## CI Protocol
Per CLAUDE.md: 100% CI before progression, implementation-first, swarm coordination
```

#### `yolo-pro gh sub-issue add`
Add sub-issue relationship using GitHub GraphQL.

**Syntax:**
```bash
yolo-pro gh sub-issue add <parent-issue> <child-issue> [options]
```

**Options:**
- `--batch <file>` - Add multiple relationships from file
- `--verify` - Verify relationship was created successfully

**Example:**
```bash
yolo-pro gh sub-issue add 25 26 --verify
# Creates GraphQL relationship: Issue #25 parent of Issue #26
```

**GraphQL Commands Executed:**
```bash
# Get GraphQL IDs
gh api graphql --header 'X-Github-Next-Global-ID:1' -f query='
{ repository(owner: "OWNER", name: "REPO") { 
    issue(number: 25) { id }
}}'

# Add relationship
gh api graphql --header 'X-Github-Next-Global-ID:1' -f query='
mutation { addSubIssue(input: {
  issueId: "PARENT_ID"
  subIssueId: "CHILD_ID" 
}) { issue { id } subIssue { id } }}'
```

### Claude-Flow Coordination Commands

#### `yolo-pro swarm deploy`
Deploy claude-flow swarm for complex feature development.

**Syntax:**
```bash
yolo-pro swarm deploy [options]
```

**Options:**
- `--topology <type>` - Swarm topology (hierarchical, mesh, ring, star)
- `--agents <count>` - Maximum agents (default: auto-determined)
- `--feature <issue>` - Deploy for specific feature
- `--specialization` - Enable agent specialization

**Example:**
```bash
yolo-pro swarm deploy --topology hierarchical --agents 5 --feature 25 --specialization
```

**Agent Specialization by Feature Complexity:**
- **Simple Feature** (1 issue): No swarm needed
- **Standard Feature** (2-3 issues): researcher, coder, tester
- **Complex Feature** (3+ issues): + architect, reviewer, performance-analyzer

#### `yolo-pro memory sync`
Synchronize protocol state with claude-flow memory systems.

**Syntax:**
```bash
yolo-pro memory sync [options]
```

**Options:**
- `--namespace <namespace>` - Target memory namespace
- `--bidirectional` - Two-way sync with claude-flow
- `--verify` - Verify sync completed successfully

**Example:**
```bash
yolo-pro memory sync --namespace yolo-protocols --bidirectional --verify
```

**Memory Keys Synchronized:**
- `wcp_current_epic` - Current EPIC being worked on
- `wcp_current_feature` - Active feature development  
- `wcp_feature_progress` - Feature completion status
- `ci_monitoring_state` - CI monitoring configuration
- `swarm_deployment_ready` - Swarm readiness status

### Quality & Validation Commands

#### `yolo-pro quality gate`
Execute comprehensive quality gate with CI protocol compliance.

**Syntax:**
```bash
yolo-pro quality gate [options]
```

**Options:**
- `--comprehensive` - Full quality validation suite
- `--implementation-first` - Validate implementation over test expectations
- `--swarm-qa` - Deploy multi-agent QA swarm
- `--block-on-failure` - Block progression until 100% success

**Example:**
```bash
yolo-pro quality gate --comprehensive --swarm-qa --block-on-failure
```

**Quality Gate Phases:**
1. **Pre-Gate Validation**
   - Working directory clean check
   - Current CI status verification
   - MCP coordination active status

2. **Implementation Validation**
   - Code completeness check
   - Edge case handling verification
   - Realistic threshold validation

3. **CI Protocol Adherence**
   - 100% test success requirement
   - TypeScript compliance
   - Console output elimination
   - Unused variable cleanup

4. **YOLO-Pro Standards**
   - WCP feature completion criteria
   - GitHub issue linking validation
   - Documentation completeness

#### `yolo-pro qa swarm`
Deploy specialized QA swarm for comprehensive validation.

**Syntax:**
```bash
yolo-pro qa swarm <component> [options]
```

**Options:**
- `--agents <list>` - Specific agent types to deploy
- `--comprehensive` - Deploy full 6-agent QA swarm
- `--focus <area>` - Focus on specific quality area

**Example:**
```bash
yolo-pro qa swarm user-authentication --comprehensive
```

**QA Swarm Agents:**
1. **Code Quality Agent**: Static analysis, style compliance
2. **Test Coverage Agent**: Unit/integration test completeness  
3. **Security Review Agent**: Vulnerability scanning, input validation
4. **Performance Agent**: Load testing, optimization opportunities
5. **Documentation Agent**: API docs, README completeness
6. **Integration Agent**: Cross-component compatibility

## Integration Patterns with Claude-Flow

### Memory-Driven Integration
YOLO-Pro stores protocol state in claude-flow memory for seamless coordination:

```bash
# YOLO-Pro stores state
yolo-pro wcp feature "auth" --store-memory

# Claude-Flow retrieves context  
npx claude-flow@alpha memory_usage retrieve "wcp_current_feature" --namespace yolo-protocols
```

### Hooks-Driven Integration
Automatic coordination via claude-flow hooks:

```bash
# Pre-command: Sync memory state
npx claude-flow@alpha hooks pre-task --task "yolo-pro-command" --sync-memory

# Post-command: Update protocol state
npx claude-flow@alpha hooks post-task --results "command-results" --update-protocols
```

### Swarm Coordination Pattern
Strategic handoff between protocol execution and swarm orchestration:

```bash
# YOLO-Pro initiates protocol
yolo-pro wcp feature "complex-auth" --complexity high

# Auto-triggers claude-flow swarm for 2+ issues
# YOLO-Pro coordinates with active swarm
# Shared memory maintains context across tools
```

## Configuration

### Global Configuration
```bash
# Configure default integration settings
yolo-pro config set claude-flow.integration true
yolo-pro config set github.auto-link true  
yolo-pro config set ci.adaptive-monitoring true
yolo-pro config set quality.implementation-first true
```

### Project Configuration
Create `.yolo-pro.config.json` in project root:

```json
{
  "wcp": {
    "maxIssuesPerFeature": 3,
    "maxFeaturesPerEpic": 7,
    "requireCI": true
  },
  "claudeFlow": {
    "integration": true,
    "memoryNamespace": "yolo-protocols",
    "autoSwarmDeployment": true,
    "swarmTopology": "hierarchical"
  },
  "github": {
    "autoLinkIssues": true,
    "useTemplates": true,
    "enforceHierarchy": true
  },
  "ci": {
    "adaptiveMonitoring": true,
    "autoFix": true,
    "implementationFirst": true,
    "require100Percent": true
  }
}
```

## Best Practices

### Protocol Compliance
1. **One Feature at a Time**: Never work on multiple features simultaneously
2. **100% CI Success**: Block all progression until CI passes completely
3. **Implementation-First**: Fix logic issues before adjusting test expectations
4. **Swarm for Complexity**: Use swarm deployment for features with 2+ issues

### Claude-Flow Integration
1. **Memory Synchronization**: Always sync protocol state with claude-flow
2. **Hooks Integration**: Enable hooks for automatic coordination
3. **Swarm Readiness**: Prepare swarm deployment for complex features
4. **Shared Context**: Maintain context across yolo-pro and claude-flow operations

### Team Workflow
1. **Standardized Commands**: Use identical yolo-pro commands across team
2. **Protocol Templates**: Use consistent EPIC/Feature templates
3. **Quality Gates**: Enforce quality gates before any deployment
4. **Documentation**: Keep protocol documentation updated

---

**Remember**: This guide should be referenced by Claude via CLAUDE.md imports for consistent protocol execution across all team interactions.