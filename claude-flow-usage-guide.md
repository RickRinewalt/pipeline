# 🚀 Claude Flow Usage Guide - Real-World Patterns & Best Practices

## 📖 Table of Contents
1. [Quick Start - Get Going in 60 Seconds](#quick-start)
2. [Understanding Claude Flow - What It Actually Does](#understanding)
3. [Common Usage Patterns - How rUv Uses It](#usage-patterns)
4. [Real-World Examples](#examples)
5. [Troubleshooting & FAQs](#troubleshooting)
6. [Cost Optimization Tips](#cost-optimization)
7. [Advanced Workflows](#advanced)

---

## 🎯 Quick Start - Get Going in 60 Seconds {#quick-start}

### First Time Setup
```bash
# 1. Install Claude Code first (required!)
npm install -g @anthropic-ai/claude-code
claude --dangerously-skip-permissions

# 2. Initialize Claude Flow
npx claude-flow@alpha init --force

# 3. Quick AI task (90% of use cases)
npx claude-flow@alpha swarm "build a REST API with authentication" --claude
```

### That's it! You're using Claude Flow! 🎉

---

## 🧠 Understanding Claude Flow - What It Actually Does {#understanding}

### The Simple Truth
Claude Flow is a **coordination layer** for Claude Code. Think of it like this:

- **Claude Code** = The worker that writes code, creates files, runs commands
- **Claude Flow** = The manager that coordinates how Claude Code approaches complex tasks

### Key Concept: Coordination, Not Execution
```
❌ Claude Flow DOES NOT:
- Write files
- Generate code  
- Execute commands
- Create content

✅ Claude Flow DOES:
- Break down complex tasks
- Coordinate multi-step workflows
- Remember context across sessions
- Optimize how Claude Code works
```

---

## 📋 Common Usage Patterns - How rUv Uses It {#usage-patterns}

Based on actual usage analysis, here are the most common patterns:

### 1. Quick Single-Task Coordination (80% of use cases)
```bash
# For most tasks, just use swarm
npx claude-flow@alpha swarm "implement user authentication with JWT" --claude
npx claude-flow@alpha swarm "add password reset functionality" --claude
npx claude-flow@alpha swarm "create unit tests for auth module" --claude
```

### 2. Complex Multi-Feature Projects (15% of use cases)
```bash
# Initialize once per project
npx claude-flow@alpha init --force

# Use hive-mind for persistent sessions
npx claude-flow@alpha hive-mind wizard
npx claude-flow@alpha hive-mind spawn "e-commerce platform" --claude

# Resume later
npx claude-flow@alpha hive-mind status
npx claude-flow@alpha hive-mind resume session-xxxxx
```

### 3. Cost-Optimized Development (5% of use cases)
```bash
# Use different models for different complexity
# (Feature coming soon - currently uses Opus 4 for everything)
npx claude-flow@alpha swarm "complex architecture design" --model opus-4 --claude
npx claude-flow@alpha swarm "simple CRUD operations" --model sonnet-4 --claude
```

---

## 🔧 Real-World Examples {#examples}

### Example 1: Building a REST API
```bash
# One command does everything
npx claude-flow@alpha swarm "build REST API with Express, user auth, and PostgreSQL" --claude

# What happens:
# 1. Claude Flow creates a coordination plan
# 2. Spawns specialized agents (architect, coder, tester)
# 3. Claude Code executes the actual implementation
# 4. Files are created in your current directory
```

### Example 2: Adding Features to Existing Project
```bash
# Navigate to your project
cd my-project

# Add a feature
npx claude-flow@alpha swarm "add email verification to existing auth system" --claude

# Claude Flow will:
# - Analyze existing code
# - Plan the integration
# - Claude Code implements it
```

### Example 3: Research and Analysis
```bash
# Research patterns
npx claude-flow@alpha swarm "research microservices patterns and create comparison doc" --claude

# Complex analysis
npx claude-flow@alpha hive-mind spawn "analyze codebase for performance bottlenecks" --claude
```

### Example 4: Detailed Prompts for Complex Projects (Best Practice!)

Based on real usage (see [Issue #130](https://github.com/ruvnet/claude-flow/issues/130)), detailed prompts dramatically improve results:

**Simple Prompt (Limited Results):**
```bash
npx claude-flow@alpha swarm "update documentation" --claude
```

**Detailed Prompt (Professional Results):**
```bash
npx claude-flow@alpha swarm "Update Claude Flow documentation: Review all v2.0.0 features, create comprehensive user guides covering installation, quick start, and common workflows. Include visual diagrams for swarm topology, working code examples for each MCP tool, and integration guides for Claude Code. Structure with clear sections, cross-references, and ensure beginner-friendly language. Output: Complete documentation set with README, user guide, API reference, and troubleshooting guide." --claude
```

**Pro Tip: Use Markdown Files for Complex Prompts**
```bash
# Create a detailed prompt file
cat > project-spec.md << 'EOF'
# E-Commerce Platform Development

## Objective
Build a complete e-commerce platform with:
- User authentication (JWT)
- Product catalog with search
- Shopping cart functionality
- Payment integration (Stripe)
- Admin dashboard

## Technical Requirements
- Backend: Node.js + Express
- Database: PostgreSQL
- Frontend: React + TypeScript
- Testing: Jest + Supertest
- API Documentation: OpenAPI/Swagger

## Deliverables
1. Complete backend API
2. Database schema with migrations
3. API documentation
4. Test suite with >80% coverage
5. Docker configuration
EOF

# Use the file as your prompt
npx claude-flow@alpha swarm "$(cat project-spec.md)" --claude
```

### How Specs Are Generated

Currently, there are several ways to create detailed specifications:

**1. Manual Creation (Current Best Practice)**
- Write detailed markdown files like Issue #130
- Use templates from successful projects
- Include: objectives, requirements, deliverables, constraints

**2. Hive-Mind Wizard (Interactive Guidance)**
```bash
npx claude-flow@alpha hive-mind wizard
# Walks you through:
# - Task description
# - Complexity assessment  
# - Feature requirements
# - Timeline preferences
```

**3. SPARC Spec Mode (Specification Generation)**
```bash
# Use SPARC's spec-pseudocode mode to help create specifications
npx claude-flow@alpha sparc spec-pseudocode "Create spec for e-commerce platform"
```

**4. Coming Soon: Interview Mode (Issue #388)**
```bash
# Proposed feature for interactive spec creation
npx claude-flow@alpha swarm "build API" --interviewme

# Would ask questions like:
# - What type of API (REST/GraphQL)?
# - Authentication method?
# - Database preferences?
# - Expected endpoints?
# - Performance requirements?
```

**Template for Creating Your Own Specs:**
```markdown
# [Project Name]

## Objective
[Clear, concise statement of what you want to build]

## Context & Background
[Any existing code, constraints, or requirements]

## Technical Requirements
- Language/Framework: [specifics]
- Database: [type and specific needs]
- Testing: [coverage requirements]
- Performance: [specific metrics]

## Features
1. [Feature 1 with details]
2. [Feature 2 with details]
3. [Feature 3 with details]

## Deliverables
- [ ] Working code
- [ ] Tests with X% coverage
- [ ] Documentation
- [ ] Deployment configuration

## Success Criteria
[How you'll know the project is complete]
```

### Example 5: Finding & Resuming Previous Sessions

**Where is Memory Stored?**
```bash
# SQLite database location
.swarm/memory.db          # All memory data
.hive-mind/config.json    # Hive configuration
.hive-mind/sessions/      # Session metadata

# Check if memory exists
ls -la .swarm/
ls -la .hive-mind/
```

**Finding Previous Sessions:**
```bash
# Method 1: List all hive-mind sessions
npx claude-flow@alpha hive-mind sessions
# Shows: session IDs, dates, objectives

# Method 2: Check recent memory activity
npx claude-flow@alpha memory query --recent --limit 10

# Method 3: Search by project/namespace
npx claude-flow@alpha memory list --namespace "project-name"

# Method 4: Look for specific keywords
npx claude-flow@alpha memory search "user authentication"
```

**Resuming a Session:**
```bash
# Option 1: Resume specific hive-mind session
npx claude-flow@alpha hive-mind resume session-xxxxx-xxxxx

# Option 2: Continue with swarm using namespace
npx claude-flow@alpha swarm "continue the implementation" --memory-namespace project-name --claude

# Option 3: Load context and continue
npx claude-flow@alpha memory query "implementation decisions" --namespace project-name
npx claude-flow@alpha swarm "continue based on previous decisions" --claude
```

**Pro Tip: Always Use Namespaces**
```bash
# When starting work - set a namespace
npx claude-flow@alpha hive-mind spawn "build auth system" --namespace auth-project --claude

# When continuing - use same namespace
npx claude-flow@alpha swarm "add password reset" --memory-namespace auth-project --claude

# Check what's in a namespace
npx claude-flow@alpha memory list --namespace auth-project
```

---

## 🔍 Troubleshooting & FAQs {#troubleshooting}

### Common Issues & Solutions

#### 1. "Command not found" Error
```bash
# Solution: Use npx
npx claude-flow@alpha <command>

# Or install globally
npm install -g claude-flow@alpha
```

#### 2. SQLite/Database Errors
```bash
# Windows users - SQLite might fail, Claude Flow auto-uses in-memory storage
# For persistent storage on Windows:
npx claude-flow@alpha init --force --memory-type inmemory
```

#### 3. Files Created in Wrong Location
```bash
# Control output directory (feature request - not yet implemented)
# Current workaround: cd to desired directory first
cd src/components
npx claude-flow@alpha swarm "create user profile component" --claude
```

#### 4. "Permission Denied" Errors
```bash
# Make sure Claude Code has permissions
claude --dangerously-skip-permissions

# Re-initialize Claude Flow
npx claude-flow@alpha init --force
```

### FAQs

**Q: When should I use `swarm` vs `hive-mind`?**
- Use `swarm` for quick tasks (90% of cases)
- Use `hive-mind` for multi-day projects with persistent memory

**Q: Do I need to manage agents manually?**
- No! Claude Flow auto-spawns the right agents for your task

**Q: Can I see what Claude Flow is planning?**
- Yes! Use `--verbose` flag: `npx claude-flow@alpha swarm "task" --claude --verbose`

**Q: How do I continue yesterday's work?**
- Check status: `npx claude-flow@alpha hive-mind status`
- Resume: `npx claude-flow@alpha hive-mind resume session-xxxxx`

**Q: Can swarm agents review each other's work in real-time?**
- **No.** Despite the "swarm" name, agents work independently, not collaboratively
- They share memory (async) but don't actively coordinate or review each other
- See "Understanding Swarm Limitations" section below for patterns that actually work

---

## 🚨 Understanding Swarm Limitations {#swarm-limitations}

### The Reality of "Swarms"

**Important:** Claude Flow's "swarm" agents are actually **parallel independent workers**, not a collaborative team. Understanding this limitation helps you use the tool effectively.

#### What Swarms DON'T Do:
- ❌ Agents don't review each other's work in real-time
- ❌ No direct agent-to-agent communication
- ❌ No "reviewer watching implementer" pattern
- ❌ No true collaborative decision-making

#### What Swarms DO:
- ✅ Execute tasks in parallel (faster)
- ✅ Share memory asynchronously
- ✅ Break down complex tasks
- ✅ Work independently on assigned pieces

### Working WITH the Limitations

#### Pattern 1: Phased Review Approach
```bash
# Phase 1: Implementation
npx claude-flow@alpha swarm "Implement user auth with TDD" --memory-namespace project --claude

# Phase 2: Review (separate command)
npx claude-flow@alpha swarm "Review all code in src/ for TDD compliance, list violations" --memory-namespace project --claude

# Phase 3: Fix issues
npx claude-flow@alpha swarm "Fix the TDD violations found in review" --memory-namespace project --claude
```

#### Pattern 2: Self-Review Instructions
```bash
# Embed review requirements in each task
npx claude-flow@alpha swarm "Implement user service with:
1. Write failing test first (London TDD)
2. Implement minimal code to pass
3. Refactor if needed
4. SELF-CHECK: Verify SOLID principles before moving on
5. Document any compromises in memory" --claude
```

#### Pattern 3: Checkpoint Pattern
```bash
# Use memory as checkpoints
npx claude-flow@alpha swarm "Implement feature X. 
After EACH file: Store in memory:
- File purpose
- TDD approach used
- SOLID principles applied
- Any technical debt incurred" --memory-namespace project --claude

# Later, review the checkpoints
npx claude-flow@alpha memory query "technical debt" --namespace project
```

### Best Practices for Quality Control

1. **Don't Fight the Architecture**
   - Accept that agents work independently
   - Use sequential phases for review/fix cycles
   - Embed quality checks in individual agent instructions

2. **Leverage Memory Effectively**
   ```bash
   # Store decisions and rationale
   npx claude-flow@alpha memory store "architecture/auth" "Using JWT because..." --namespace project
   
   # Query before continuing
   npx claude-flow@alpha memory query "architecture" --namespace project
   ```

3. **Use Explicit Review Phases**
   ```bash
   # After implementation phase
   npx claude-flow@alpha swarm "Audit codebase for:
   - TDD compliance (tests written first?)
   - SOLID violations
   - Modular boundaries
   Output: detailed report with specific files/lines" --claude
   ```

### Example: Complex Project with Reviews

```bash
# Day 1: Initial implementation
npx claude-flow@alpha hive-mind spawn "Build user management module with London TDD" --agents 6 --claude

# Day 2: Review phase
npx claude-flow@alpha swarm "Review yesterday's implementation for TDD/SOLID compliance" --continue-session --claude

# Day 3: Fix issues
npx claude-flow@alpha swarm "Address all issues from review, maintain TDD approach" --continue-session --claude

# Throughout: Use memory for coordination
npx claude-flow@alpha memory store "review/findings" "Auth module violates SRP in UserService" --namespace project
```

---

## 💰 Cost Optimization Tips {#cost-optimization}

### Current State
- Claude Flow currently uses Opus 4 for all operations
- This ensures highest quality but can be expensive

### Best Practices
1. **Be Specific** - Clear, detailed prompts reduce iterations
2. **Use Memory** - Avoid re-explaining context
3. **Batch Related Tasks** - Do multiple related things in one session

### Example of Cost-Effective Usage
```bash
# Instead of multiple commands:
❌ npx claude-flow@alpha swarm "create user model" --claude
❌ npx claude-flow@alpha swarm "create user controller" --claude  
❌ npx claude-flow@alpha swarm "create user routes" --claude

# Do everything at once:
✅ npx claude-flow@alpha swarm "create complete user module with model, controller, routes, and tests" --claude
```

---

## 🚀 Advanced Workflows {#advanced}

### Using Hooks for Automation
```bash
# Hooks auto-configure during init
# They provide:
- Auto-formatting after code generation
- Memory updates after each operation
- Progress notifications
- Session persistence
```

### Memory Management
```bash
# Store project context
npx claude-flow@alpha memory store "project-requirements" "E-commerce platform with..."

# Query specific memories
npx claude-flow@alpha memory query "authentication"

# Export memory for backup
npx claude-flow@alpha memory export my-project-backup.json
```

### SPARC Development Modes
```bash
# Test-Driven Development
npx claude-flow@alpha sparc tdd "user authentication module" --claude

# Architecture-First
npx claude-flow@alpha sparc architect "microservices system" --claude
```

### GitHub Integration
```bash
# Analyze repository
npx claude-flow@alpha github repo-analyze --deep

# Manage pull requests
npx claude-flow@alpha github pr-enhance --pr-number 123

# Coordinate releases
npx claude-flow@alpha github release-coord --version 2.0.0
```

---

## 📝 Summary Cheat Sheet

### 90% of Your Usage
```bash
# Initialize once
npx claude-flow@alpha init --force

# For simple tasks (quick results)
npx claude-flow@alpha swarm "what you want to build" --claude

# For better results (recommended)
npx claude-flow@alpha swarm "Detailed description: What to build, technical requirements, expected output, specific features" --claude

# For complex projects (best practice)
echo "Detailed project specification..." > spec.md
npx claude-flow@alpha swarm "$(cat spec.md)" --claude
```

### When Things Go Wrong
1. Check you have Claude Code installed
2. Re-run init: `npx claude-flow@alpha init --force`
3. Use `--verbose` to see what's happening
4. Check memory: `npx claude-flow@alpha memory stats`

### Key Commands to Remember
```bash
# Main commands
swarm        # Quick tasks
hive-mind    # Complex projects
memory       # Check/store context
hooks        # Automation

# Useful flags
--claude     # Use Claude Code (always add this!)
--verbose    # See coordination details
--help       # Get command help
```

---

## 🎯 The Golden Rule

**Remember**: Claude Flow coordinates, Claude Code creates. 

When you run a Claude Flow command, it's planning and organizing how Claude Code will approach your task. All the actual work (writing files, running commands, generating code) is done by Claude Code.

---

## Need Help?

- **Issues**: https://github.com/ruvnet/claude-flow/issues
- **Discord**: https://discord.agentics.org
- **Docs**: https://github.com/ruvnet/claude-flow

Happy building with Claude Flow! 🚀
