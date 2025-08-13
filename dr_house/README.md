# Dr House Validator - Brutal Honest Issue Validation

## 🩺 Overview

This repository contains the Dr House Validator system - a brutally honest validation framework for your codebase, including reviewing documentation recorded in GitHub issues and milestones. Inspired by the fictional diagnostician's catchphrase "Everybody lies," this toolset validates claimed implementations against deployed reality with zero sugar-coating.

### Files

- **`dr_house_agent.md`** - Claude Code sub-agent definition for automated validation
- **`dr_house_issue_validation_protocol.md`** - Interactive prompt for single issue validation
- **`dr_house_milestone_validation_protocol.md`** - Interactive prompt for milestone-wide validation

Note: The protocol files are interactive - they will prompt you for the information needed.

## 💊 High-Level Description

The Dr House Validator is designed to expose the gap between what developers claim they've built and what actually exists in production. It performs deep validation checks comparing:

- **Claimed implementations** vs **Deployed reality**
- **Test coverage** vs **Actual functionality**
- **Documentation promises** vs **Code truth**
- **Issue completion status** vs **Production readiness**

### Core Philosophy

- **"Everybody lies"** - Documentation, comments, commit messages, and issue descriptions often misrepresent reality
- **Evidence over claims** - Only what can be proven in production counts
- **No sugar-coating** - Brutal honesty prevents production failures
- **Tests are often theater** - Many tests test nothing important

### Key Features

- Autonomous validation of GitHub issues against actual deployments
- Sardonic medical-themed feedback (diagnostic emojis: 🩺 💊 💉 ☠️)
- Comprehensive gap analysis between promises and reality
- Differential diagnosis format for identifying root problems
- Treatment plans (what to fix) without performing the fixes

## 🚀 Setup Instructions

### For Claude Code Sub-Agent (`dr_house_agent.md`)

1. **Prerequisites**
   - Claude Code CLI installed and configured
   - Access to target GitHub repository
   - Access to deployed infrastructure/codebase

2. **Installation**
   ```bash
   # Create agents directory if it doesn't exist
   mkdir -p ~/.claude-code/agents
   
   # Copy the agent definition
   cp dr_house_agent.md ~/.claude-code/agents/
   
   # Verify installation
   claude-code agents list
   # Should show "dr-house-validator" in the list
   ```

3. **Configuration**
   ```bash
   # The agent is pre-configured with:
   # - 900 second max execution time
   # - 200 max file operations
   # - Full read access (no write permissions - diagnosis only)
   # - Bash and web search capabilities for verification
   ```

### For Manual Prompts

The two protocol files are interactive prompts that can be used directly in any Claude interface:
1. Copy the entire content from the respective `.md` file
2. Paste into Claude with access to your codebase
3. The prompt will ask for the required URLs - no editing needed
4. Provide the requested GitHub URLs when prompted

## 📖 Usage Guidelines

### Using the Dr House Agent (Automated)

```bash
# Validate a single issue
claude-code agent:dr-house-validator validate issue #42

# Trigger with various commands
claude-code agent:dr-house-validator dr house check
claude-code agent:dr-house-validator brutal assessment of authentication
claude-code agent:dr-house-validator verify deployment
```

**Agent Capabilities:**
- Reads all files to verify implementations
- Runs bash commands to check infrastructure
- Performs web searches to verify external claims
- Creates detailed validation reports
- Cannot modify code (diagnosis only, no treatment)

### Using Single Issue Validation Protocol

**When to use:** Validating individual GitHub issues after implementation

1. Open `dr_house_issue_validation_protocol.md`
2. Copy the entire prompt content
3. Paste into Claude with repository access
4. The prompt will ask for your GitHub issue URL (e.g., `https://github.com/username/repo/issues/42`)
5. Creates a new VALIDATION issue with format:
   ```
   VALIDATION: [Original Issue Title] - Dr House Assessment
   ```

**Output includes:**
- Patient History (original issue details)
- Chief Complaint (what was promised)
- Examination Findings (what actually exists)
- The Lies (discrepancies found)
- Missing Organs (critical gaps)
- Differential Diagnosis (root problems)
- Treatment Plan (specific fixes needed)
- Prescription (sardonic recommendations)

### Using Milestone Validation Protocol

**When to use:** Validating entire milestones with multiple issues

1. Open `dr_house_milestone_validation_protocol.md`
2. Copy the entire prompt content
3. Paste into Claude with repository access
4. The prompt will interactively ask for:
   - Source milestone URL (e.g., `https://github.com/cgbarlow/pipeline/milestone/2`)
   - Validation milestone URL (e.g., `https://github.com/cgbarlow/pipeline/milestone/3`)
5. Creates validation issues for EVERY issue in the source milestone

**Process:**
- No need to edit placeholders - the prompt asks for inputs
- Systematically validates both open and closed issues
- Creates corresponding validation issues in target milestone
- Maintains reference links to original issues
- Provides comprehensive milestone health assessment

## 🔍 Validation Criteria

The Dr House Validator examines:

1. **Functionality** - Does it actually work or just pretend to?
2. **Performance** - Fast enough or slower than a dying patient?
3. **Security** - Secure or wide open like a teaching hospital?
4. **Reliability** - Stable or more crashes than House's motorcycle?
5. **Documentation** - Accurate or more fiction than Vicodin prescriptions?

## ⚠️ Red Flags Detected

- "Works on my machine" syndrome
- "We'll fix it in the next sprint" disease  
- "The tests pass" delusion
- "It's documented" hallucination
- "Minor edge case" denial

## 📋 Example Output

Reference implementation: https://github.com/cgbarlow/price-guard/issues/90

The validator creates issues with:
- Brutal honesty about implementation gaps
- Evidence-based assertions with code snippets
- Clear differentiation between working and broken components
- Specific, actionable treatment plans
- Sardonic medical humor throughout

## 🏥 Best Practices

1. **Run before marking issues as complete** - Prevent lies from reaching production
2. **Use for milestone reviews** - Validate entire feature sets systematically
3. **Include in CI/CD pipelines** - Automated reality checks
4. **Share validation issues with team** - Truth hurts but prevents disasters
5. **Don't take it personally** - The goal is system health, not hurt feelings

## 💀 Warning

This validator is intentionally harsh. It's designed to find problems, not make friends. If you want gentle feedback and participation trophies, this isn't the tool for you. 

Remember: **"It's not lupus. It's never lupus. Except when it is."**

---

*Created for those who value working code over comforting lies.*
