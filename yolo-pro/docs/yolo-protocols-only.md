# YOLO Protocols Documentation

## Overview
Core YOLO protocols for workflow management.

## Work Chunking Protocol (WCP)
Break work into manageable chunks:
- Epic: High-level business objective
- Feature: Specific functionality 
- Task: Individual work items

## CI Protocol
Continuous Integration workflow:
- Automatic testing on commits
- Branch validation
- Merge requirements

## CD Protocol  
Continuous Deployment process:
- Automated deployment pipeline
- Environment progression
- Release management

## Swarm Coordination
Multi-agent coordination patterns:
- Agent assignment by capability
- Task distribution
- Progress tracking

## Basic Usage
```bash
# Display progress
dsp

# Display with context
dsp-c
```

## Integration
Claude knows about these protocols via `claude.md_customisations/yolo-pro_protocols.md`.