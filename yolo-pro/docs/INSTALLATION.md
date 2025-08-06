# YOLO-Pro Installation Guide

> **Step-by-step setup for existing claude-flow pipeline users**

## Prerequisites

Before installing YOLO-Pro, ensure you have the existing claude-flow setup working:

### Required Existing Setup
- ✅ Claude Code with MCP server configured
- ✅ Claude-flow MCP server: `claude mcp add claude-flow npx claude-flow@alpha mcp start`
- ✅ GitHub CLI authenticated: `gh auth status`
- ✅ Node.js 18+ and npm
- ✅ Git configured with your repository access

### Verify Existing Setup
```bash
# Verify claude-flow MCP server
npx claude-flow@alpha status

# Verify GitHub CLI
gh auth status

# Verify Claude Code MCP integration
# In Claude Code: Should see claude-flow tools available
```

## Installation Methods

### Method 1: Global Installation (Recommended)
```bash
# Install yolo-pro CLI globally
npm install -g @yolo-pro/cli

# Verify installation
yolo-pro --version
yolo-pro --help
```

### Method 2: Project-Specific Installation
```bash
# Install in your project
npm install --save-dev @yolo-pro/cli

# Add to package.json scripts
npm pkg set scripts.yolo-pro="yolo-pro"

# Use via npm
npm run yolo-pro -- --version
```

### Method 3: Direct from Repository (Development)
```bash
# Clone and install development version
git clone https://github.com/yolo-pro/cli.git
cd cli
npm install
npm link

# Verify development installation
yolo-pro --version
```

## Integration Setup

### Step 1: Initialize YOLO-Pro with Claude-Flow Integration

```bash
# Navigate to your project directory
cd /path/to/your/project

# Initialize yolo-pro with claude-flow integration
yolo-pro init --integrate-claude-flow

# This creates:
# - .yolo-pro.config.json (project configuration)
# - Updates your project to use shared memory with claude-flow
# - Sets up protocol templates
```

**What happens during init:**
1. **Configuration Creation**: Creates `.yolo-pro.config.json` with claude-flow integration settings
2. **Memory Namespace Setup**: Configures `yolo-protocols` namespace in claude-flow memory
3. **GitHub Repository Detection**: Auto-detects GitHub repository from git remote
4. **Template Installation**: Installs WCP EPIC and Feature templates
5. **Hooks Integration**: Sets up claude-flow hooks for automatic coordination

### Step 2: Verify Integration

```bash
# Test basic yolo-pro functionality
yolo-pro wcp status

# Test claude-flow integration
yolo-pro memory sync --verify

# Test GitHub integration
yolo-pro gh status
```

**Expected Output:**
```
✅ YOLO-Pro CLI: v1.0.0
✅ Claude-Flow Integration: ACTIVE
✅ GitHub Repository: detected (your-org/your-repo)
✅ Memory Namespace: yolo-protocols configured
✅ Protocol Templates: installed
✅ Hooks Integration: enabled
```

### Step 3: Configure Team Settings

```bash
# Set up team-wide configuration
yolo-pro config set team.name "Your Team Name"
yolo-pro config set team.github-org "your-github-org"
yolo-pro config set team.default-reviewers "user1,user2"

# Configure default WCP settings
yolo-pro config set wcp.max-issues-per-feature 3
yolo-pro config set wcp.max-features-per-epic 7
yolo-pro config set wcp.require-ci true

# Configure CI settings
yolo-pro config set ci.adaptive-monitoring true
yolo-pro config set ci.implementation-first true
yolo-pro config set ci.auto-fix true
```

## Configuration Files

### `.yolo-pro.config.json` (Project Level)
Created automatically during `yolo-pro init`:

```json
{
  "version": "1.0",
  "project": {
    "name": "your-project-name",
    "github": {
      "owner": "your-github-org", 
      "repo": "your-repo-name"
    }
  },
  "claudeFlow": {
    "integration": true,
    "mcpServer": "claude-flow",
    "memoryNamespace": "yolo-protocols",
    "hooksEnabled": true,
    "autoSwarmDeployment": true,
    "defaultTopology": "hierarchical"
  },
  "wcp": {
    "maxIssuesPerFeature": 3,
    "maxFeaturesPerEpic": 7,
    "requireCI": true,
    "oneFeatureAtATime": true,
    "implementationFirst": true
  },
  "ci": {
    "adaptiveMonitoring": true,
    "autoFix": true,
    "require100Percent": true,
    "swarmOnFailure": true
  },
  "github": {
    "autoLinkIssues": true,
    "useTemplates": true,
    "enforceHierarchy": true,
    "defaultLabels": ["yolo-pro", "wcp"]
  },
  "quality": {
    "gates": {
      "preCommit": true,
      "preMerge": true,
      "preDeployment": true
    },
    "swarmQA": true,
    "implementationFirst": true
  }
}
```

### Global Configuration (`~/.yolo-pro/config.json`)
```json
{
  "defaults": {
    "claudeFlowIntegration": true,
    "githubAutoAuth": true,
    "verboseLogging": false
  },
  "team": {
    "name": "Your Team Name",
    "githubOrg": "your-github-org",
    "defaultReviewers": ["user1", "user2"]
  },
  "ui": {
    "colorOutput": true,
    "progressIndicators": true,
    "emojiStatus": true
  }
}
```

## Verification & Testing

### Test Basic Functionality
```bash
# Test WCP initialization
yolo-pro wcp init --dry-run

# Test GitHub integration
yolo-pro gh status --verbose

# Test CI monitoring
yolo-pro ci monitor --test-mode

# Test quality gates
yolo-pro quality gate --dry-run
```

### Test Claude-Flow Integration
```bash
# Test memory synchronization
yolo-pro memory sync --test

# Test swarm readiness
yolo-pro swarm deploy --dry-run --topology mesh

# Test hooks integration
yolo-pro hooks test
```

### Integration Health Check
```bash
# Comprehensive health check
yolo-pro doctor

# Expected output:
✅ YOLO-Pro CLI installation
✅ Claude-Flow MCP server connection
✅ GitHub CLI authentication
✅ Project configuration
✅ Memory namespace setup
✅ Hooks integration
✅ Template installation
```

## Upgrading Existing Projects

### From Manual Protocols to YOLO-Pro

If you've been using manual YOLO-Pro protocols from CLAUDE.md:

```bash
# Analyze existing project structure
yolo-pro migrate analyze

# Import existing GitHub issues into WCP structure
yolo-pro migrate import-issues --epic-detection

# Sync existing CI configuration
yolo-pro migrate ci-config

# Update project to use yolo-pro protocols
yolo-pro migrate complete
```

### From Previous YOLO-Pro Versions
```bash
# Check current version
yolo-pro --version

# Upgrade globally
npm update -g @yolo-pro/cli

# Update project configuration
yolo-pro config migrate

# Verify upgrade
yolo-pro doctor
```

## Team Onboarding

### New Team Member Setup

Create a team onboarding script:

```bash
#!/bin/bash
# team-yolo-pro-setup.sh

echo "🚀 Setting up YOLO-Pro for new team member..."

# Install yolo-pro CLI
npm install -g @yolo-pro/cli

# Clone team configuration
git clone git@github.com:your-org/yolo-pro-config.git ~/.yolo-pro-team

# Copy team configuration
cp ~/.yolo-pro-team/config.json ~/.yolo-pro/config.json

# Initialize in current project
yolo-pro init --integrate-claude-flow --team-config

# Verify setup
yolo-pro doctor

echo "✅ YOLO-Pro setup complete!"
echo "💡 Try: yolo-pro wcp status"
```

### Team Configuration Sharing

Share team configuration via git repository:

```bash
# Create team configuration repository
mkdir yolo-pro-team-config
cd yolo-pro-team-config

# Add shared configuration
cat > config.json << 'EOF'
{
  "team": {
    "name": "Your Team Name",
    "githubOrg": "your-github-org",
    "defaultReviewers": ["user1", "user2"],
    "protocols": {
      "wcp": {
        "epicTemplate": "custom-epic-template.md",
        "featureTemplate": "custom-feature-template.md"
      }
    }
  }
}
EOF

# Add custom templates
mkdir templates
# Add your custom EPIC and Feature templates

# Commit and share
git init
git add .
git commit -m "Initial team YOLO-Pro configuration"
git remote add origin git@github.com:your-org/yolo-pro-config.git
git push -u origin main
```

## Troubleshooting

### Common Installation Issues

#### Issue: `command not found: yolo-pro`
**Solution:**
```bash
# Check npm global bin directory
npm config get prefix

# Add to PATH if needed (add to ~/.bashrc or ~/.zshrc)
export PATH="$PATH:$(npm config get prefix)/bin"

# Reload shell
source ~/.bashrc  # or ~/.zshrc
```

#### Issue: Claude-Flow integration not working
**Solution:**
```bash
# Verify claude-flow MCP server
npx claude-flow@alpha status

# Reinstall MCP server if needed
claude mcp remove claude-flow
claude mcp add claude-flow npx claude-flow@alpha mcp start

# Re-initialize yolo-pro integration
yolo-pro init --integrate-claude-flow --force
```

#### Issue: GitHub authentication errors
**Solution:**
```bash
# Re-authenticate GitHub CLI
gh auth logout
gh auth login

# Verify authentication
gh auth status

# Test GitHub integration
yolo-pro gh status
```

### Getting Help

#### Built-in Help
```bash
# General help
yolo-pro --help

# Command-specific help
yolo-pro wcp --help
yolo-pro ci --help
yolo-pro gh --help

# Verbose error output
yolo-pro <command> --verbose
```

#### Diagnostic Information
```bash
# Generate diagnostic report
yolo-pro diagnose

# Check configuration
yolo-pro config list

# Validate integration
yolo-pro validate
```

## Next Steps

After successful installation:

1. **Read Usage Guide**: [USAGE-GUIDE.md](./USAGE-GUIDE.md)
2. **Explore Examples**: [EXAMPLES.md](./EXAMPLES.md) 
3. **Understand Architecture**: [ARCHITECTURE.md](./ARCHITECTURE.md)
4. **Start First Feature**: `yolo-pro wcp feature "your-feature-name"`

---

**Support**: If you encounter issues, create an issue at [GitHub Issues](https://github.com/yolo-pro/cli/issues) with the output from `yolo-pro diagnose`.