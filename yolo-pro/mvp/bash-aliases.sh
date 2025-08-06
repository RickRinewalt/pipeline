#!/bin/bash

# YOLO-PRO MVP: Bash Aliases (Issue #10)
# Simple bash aliases: dsp and dsp-c only

# Color codes for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Loading YOLO-PRO Bash Aliases (dsp, dsp-c)...${NC}"

# dsp - Display current status/progress
alias dsp='_yolo_display_progress'
_yolo_display_progress() {
    echo -e "${BLUE}📊 YOLO-PRO Progress Display${NC}"
    echo -e "${BLUE}===========================${NC}"
    
    echo -e "\n${GREEN}🧪 CI Status:${NC}"
    if command -v gh &> /dev/null; then
        gh run list --limit 3
    else
        echo "GitHub CLI not available"
    fi
    
    echo -e "\n${GREEN}📋 Recent Issues:${NC}"
    if command -v gh &> /dev/null; then
        gh issue list --limit 5
    else
        echo "GitHub CLI not available"
    fi
    
    echo -e "\n${GREEN}🌿 Current Branch:${NC}"
    git branch --show-current 2>/dev/null || echo "Not in a git repository"
}

# dsp-c - Display with context (enhanced version)
alias dsp-c='_yolo_display_progress_context'
_yolo_display_progress_context() {
    echo -e "${BLUE}📊 YOLO-PRO Progress Display (with Context)${NC}"
    echo -e "${BLUE}============================================${NC}"
    
    # Basic display
    dsp
    
    echo -e "\n${GREEN}📄 Workflow Context:${NC}"
    echo "Active Protocols: YOLO-PRO WCP, CI, CD"
    echo "Agent Coordination: Follow swarm patterns from CLAUDE.md"
    echo "Reference Links:"
    echo "  - Memory Rules: @/claude.md_customisations/MEMORY_LEAK_PREVENTION_RULES.md"
    echo "  - Hooks Fix: @/claude.md_customisations/CLAUDE_FLOW_GENERIC_HOOKS_FIX.md"
    echo "  - YOLO Protocols: @/claude.md_customisations/yolo-pro_protocols.md"
}

echo -e "${GREEN}✅ YOLO-PRO aliases loaded: dsp, dsp-c${NC}"