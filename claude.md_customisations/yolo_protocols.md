# Claude.md customisations

## Protocols (a.k.a. YOLO Protocols)
Standard protocols to be executed when asked, e.g. "Initialize CI protocol": 

### Continuous Integration (CI) protocol
Enhanced protocol with research capabilities and proven implementation-first strategy. For systematic CI fixing, testing, committing regularly, push, PR, review, monitor build, repeat. The whole thing should run and repeat unattended with zero intervention; the monitoring of the active action and automated merge where possible is critical:

## 🔬 PHASE 1: Research & Analysis
1. **RESEARCH SWARM DEPLOYMENT**: Deploy coordinated research swarm using Claude Flow MCP tools:
   - Initialize swarm: `mcp__claude-flow__swarm_init` with appropriate topology
   - Spawn research agents: `mcp__claude-flow__agent_spawn` (researcher, analyst, detective types)
   - Store findings: `mcp__claude-flow__memory_usage` for coordination

2. **MULTI-SOURCE RESEARCH**: Gather intelligence using all available resources:
   - **Context7 MCP**: Search for intel on specific products, platforms, technologies (add Context7 MCP if not available)
   - **WebSearch**: Search for latest best practices, error patterns, and solutions
   - **Codebase Analysis**: Use Grep, Glob, Read tools to understand current state
   - **GitHub Integration**: Check issues, PRs, workflow history using `gh` commands

3. **SYSTEMATIC ANALYSIS**: Apply proven analysis patterns:
   - Identify root causes vs symptoms
   - Categorize issues by severity and component
   - Document findings in GitHub issues with proper labels (check what labels are available, add new labels if required before creating/modifying issues)
   - Store research results in swarm memory for coordination

## 🎯 PHASE 2: Implementation-First Strategy
4. **IMPLEMENTATION-FIRST FIXES**: Apply proven methodology that achieves 100% test success:
   - Fix actual implementation logic rather than relaxing test expectations
   - Handle both edge cases and main use cases simultaneously  
   - Use realistic thresholds for test environment while maintaining production standards
   - Focus on working functionality over perfect pattern matching

5. **SWARM COORDINATION**: Execute fixes using coordinated parallel approach:
   - Use swarm to fix problems systematically with TDD approach
   - All agents MUST coordinate via Claude Flow hooks and memory
   - Target 100% test success for each component
   - Create branches for changes, update issues with progress

## 🚀 PHASE 3: Continuous Monitoring & Integration
6. **ACTIVE MONITORING**: Monitor GitHub Actions workflows continuously:
   - Use `gh run list --repo owner/repo --limit N` to track workflow status
   - Monitor specific runs: `gh run view RUN_ID --repo owner/repo`
   - Set up automated polling during CI execution
   - Analyze results immediately when CI finishes

7. **SYSTEMATIC INTEGRATION**: Follow proven integration workflow:
   - Commit regularly with descriptive messages including methodology
   - Push at appropriate intervals to trigger CI workflows
   - Create PRs when significant milestones achieved (e.g., component 100% success)
   - Review and merge when tests pass and code quality verified

8. **ISSUE LIFECYCLE MANAGEMENT**: Maintain clear issue tracking:
   - Close resolved issues with detailed resolution summaries
   - Update tracking issues with breakthrough achievements
   - Document successful methodologies for future reference
   - Label appropriately (bug, enhancement, critical, resolved, etc.)

9. **ITERATIVE IMPROVEMENT**: Continue until deployment success:
   - Keep iterating through phases 1-8 until build successfully deploys
   - Apply lessons learned from previous iterations
   - Scale swarm size based on problem complexity
   - Maintain coordination through Claude Flow memory across iterations

## 🏆 SUCCESS METRICS:
- Target: 100% test success for critical components
- Monitor: Memory usage, performance thresholds, code coverage
- Document: Methodologies that achieve breakthrough results
- Coordinate: All agents use swarm memory and hooks for alignment
