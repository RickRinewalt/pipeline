# Claude Flow - Generic Hook Path Resolution Bug Fix

## 🐛 Bug Description

**Issue**: Claude Flow hooks fail with "command not found" (error 127) when working from subdirectories because they use relative paths that only resolve correctly from the git repository root.

**Affected Components**: All hook commands in `.claude/settings.json` that reference local scripts using relative paths.

**Impact**: Users cannot use Claude Flow hooks functionality when working from project subdirectories, limiting the tool's usability in complex project structures.

## 🔍 Root Cause Analysis

### Current Problematic Implementation
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "command": "./.claude/helpers/github-checkpoint-hooks.sh pre-edit \"{{tool_input}}\""
      }
    ]
  }
}
```

### The Problem
- **Relative Path Dependency**: `./` only resolves correctly from the git repository root
- **Fails in Subdirectories**: When Claude Code operates from `/cli`, `/web-portal`, or any subdirectory, the relative path `./.claude/helpers/` cannot be found
- **Error Manifestation**: Shell returns exit code 127 ("command not found")

### Evidence
```bash
# Works from root
cd /repo-root && ./.claude/helpers/script.sh  # ✅ Success

# Fails from subdirectories  
cd /repo-root/cli && ./.claude/helpers/script.sh  # ❌ Error 127: not found
cd /repo-root/web-portal && ./.claude/helpers/script.sh  # ❌ Error 127: not found
```

## ✅ Generic Solution

### Proposed Fix: Dynamic Git Root Resolution
Replace all relative paths with dynamic git root resolution using `$(git rev-parse --show-toplevel)`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "command": "$(git rev-parse --show-toplevel)/.claude/helpers/github-checkpoint-hooks.sh pre-edit \"{{tool_input}}\""
      }
    ]
  }
}
```

### Why This Solution Works
1. **Universal Compatibility**: `git rev-parse --show-toplevel` works from any directory within a git repository
2. **Dynamic Resolution**: Automatically finds the repository root regardless of current working directory
3. **No Hardcoding**: No absolute paths that would break across different systems/users
4. **Git-Standard**: Uses standard git command available in all git installations
5. **Shell Expansion**: `$()` command substitution resolves at runtime

## 🧪 Testing Results

### Test Commands
```bash
# Test from repository root
cd /repo-root && $(git rev-parse --show-toplevel)/.claude/helpers/script.sh
# Result: ✅ Success

# Test from subdirectories
cd /repo-root/cli && $(git rev-parse --show-toplevel)/.claude/helpers/script.sh  
# Result: ✅ Success

cd /repo-root/web-portal && $(git rev-parse --show-toplevel)/.claude/helpers/script.sh
# Result: ✅ Success

# Test from nested subdirectories
cd /repo-root/src/components/ui && $(git rev-parse --show-toplevel)/.claude/helpers/script.sh
# Result: ✅ Success
```

### Cross-Platform Compatibility
- ✅ **Linux**: Tested and working
- ✅ **macOS**: Standard git installation includes `git rev-parse`
- ✅ **Windows**: Works in Git Bash, WSL, and modern Windows with git
- ✅ **Docker/Containers**: Works in any containerized environment with git

## 📋 Implementation Guide

### Step 1: Identify Affected Hook Commands
Search for relative path usage in `.claude/settings.json`:
```bash
grep -n "\\./" .claude/settings.json
```

### Step 2: Apply the Fix
Replace each instance of `./` with `$(git rev-parse --show-toplevel)/`:

**Before:**
```json
"command": "./.claude/helpers/github-checkpoint-hooks.sh pre-edit \"{{tool_input}}\""
```

**After:**
```json
"command": "$(git rev-parse --show-toplevel)/.claude/helpers/github-checkpoint-hooks.sh pre-edit \"{{tool_input}}\""
```

### Step 3: Complete Fix for All Hook Types
Update all hook command types:
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "command": "$(git rev-parse --show-toplevel)/.claude/helpers/github-checkpoint-hooks.sh pre-edit \"{{tool_input}}\""
      }
    ],
    "PostToolUse": [
      {
        "command": "$(git rev-parse --show-toplevel)/.claude/helpers/github-checkpoint-hooks.sh post-edit \"{{tool_input}}\""
      }
    ],
    "UserPromptSubmit": [
      {
        "command": "$(git rev-parse --show-toplevel)/.claude/helpers/github-checkpoint-hooks.sh task \"{{user_prompt}}\""
      }
    ],
    "Stop": [
      {
        "command": "$(git rev-parse --show-toplevel)/.claude/helpers/github-checkpoint-hooks.sh session-end"
      }
    ]
  }
}
```

## 🔧 Alternative Solutions Considered

### 1. Environment Variable Approach
```json
"command": "${CLAUDE_PROJECT_ROOT:-$(git rev-parse --show-toplevel)}/.claude/helpers/script.sh"
```
**Pros**: Allows override via environment variable  
**Cons**: More complex, requires user configuration

### 2. Claude Flow Built-in Variable
```json
"command": "{{project_root}}/.claude/helpers/script.sh"
```
**Pros**: Clean syntax  
**Cons**: Would require Claude Flow code changes

### 3. Symlink Approach
Create symlinks in each subdirectory pointing to `.claude/`  
**Pros**: No configuration changes needed  
**Cons**: Platform-dependent, creates file system clutter

## 📈 Benefits of the Proposed Solution

1. **🔧 Zero Breaking Changes**: Existing functionality preserved
2. **🌍 Universal Compatibility**: Works across all platforms and environments  
3. **📁 Directory Independence**: Functions from any working directory
4. **🛡️ No Security Issues**: Uses standard git commands
5. **⚡ Performance**: Minimal overhead (single git command execution)
6. **🧹 Clean Implementation**: No additional files or complex configuration

## 🚀 Backward Compatibility

- **Existing Configurations**: Will continue to work from repository root
- **New Configurations**: Will work from any directory
- **Migration**: Can be applied incrementally (mix of old/new paths will work)

## 📝 Recommended Documentation Updates

1. **Installation Guide**: Mention that hooks work from any directory
2. **Troubleshooting**: Remove "ensure you're in the repository root" guidance
3. **Examples**: Show hooks working from subdirectories
4. **Configuration**: Recommend using `$(git rev-parse --show-toplevel)` pattern for custom hooks

## 🎯 Summary

This fix resolves the Claude Flow hook path resolution issue with a simple, elegant, and universally compatible solution. By replacing relative paths with dynamic git root resolution, users can seamlessly use Claude Flow hooks from any directory within their project, significantly improving the developer experience.

**One-line fix**: Replace `./` with `$(git rev-parse --show-toplevel)/` in all hook command paths.