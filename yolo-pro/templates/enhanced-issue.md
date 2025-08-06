# Task: [Task Title]

**Parent Feature**: #[feature-issue-number]

## Task Description
[Clear, specific description of what needs to be accomplished]

## Context
[Background information, why this task is needed, and how it fits into the larger feature/epic]

## Acceptance Criteria
- [ ] Specific outcome 1
- [ ] Specific outcome 2  
- [ ] Specific outcome 3
- [ ] All tests passing
- [ ] Code review completed

## Technical Details

### Scope of Work
[Detailed breakdown of what needs to be implemented/changed/fixed]

### Files/Components Affected
- [ ] File/Component 1: [Description of changes]
- [ ] File/Component 2: [Description of changes]
- [ ] File/Component 3: [Description of changes]

### Implementation Notes
[Technical notes, approach, algorithms, or specific requirements]

### Testing Requirements
- [ ] Unit tests for [specific functionality]
- [ ] Integration test for [specific integration]
- [ ] Manual testing steps documented

## YOLO-PRO Task Management

### Agent Assignment
- **Assigned Agent Type**: [coder/tester/researcher/reviewer]
- **Agent Capabilities Required**: [List specific capabilities needed]
- **Complexity Level**: [Simple/Medium/Complex]
- **Estimated Effort**: [Small: <4hrs, Medium: 4-8hrs, Large: 1+ day]

### Context Integration
```bash
# Set task context
yolo-context set "task.[task-id].status" "assigned"
yolo-context set "task.[task-id].agent" "[agent-type]"
yolo-context set "task.[task-id].parent_feature" "#[feature-number]"
```

### Enhanced Commands
```bash
# If research needed
yolo-research "[specific research question or requirement]"

# Direct implementation (most common)
yolo-dev

# Post-completion validation
yolo-validate
```

## Definition of Done
- [ ] Implementation completed as specified
- [ ] Code follows project standards and conventions
- [ ] Unit tests written and passing
- [ ] Integration tests updated (if needed)
- [ ] Code review completed and approved
- [ ] Manual testing completed
- [ ] Documentation updated (if applicable)
- [ ] CI/CD pipeline passing
- [ ] Feature branch merged to main
- [ ] Task linked to parent feature updated

## Dependencies
### Prerequisites (Must be done first)
- [ ] Dependency 1: [Description] - Issue: #[number]
- [ ] Dependency 2: [Description] - Issue: #[number]

### Related Tasks (May need coordination)
- [ ] Related Task 1: [Description] - Issue: #[number]
- [ ] Related Task 2: [Description] - Issue: #[number]

## Risk Factors
- **Technical Risk**: [Any technical challenges or unknowns]
- **Timeline Risk**: [Any factors that could delay completion]
- **Dependency Risk**: [External factors that could block progress]

*Risk Level*: [Low/Medium/High]

## Testing Approach

### Unit Testing
- [ ] Test coverage for new functionality
- [ ] Edge cases covered
- [ ] Error handling tested

### Integration Testing  
- [ ] Integration points validated
- [ ] End-to-end workflow tested
- [ ] Performance impact assessed

### Manual Testing
```
1. [Step-by-step manual test procedure]
2. [Expected results for each step]
3. [Validation criteria]
```

## Additional Notes
[Any additional context, decisions made, or important considerations]

## Success Criteria
**Functional**: [How to verify the task works correctly]
**Non-Functional**: [Performance, security, usability considerations]
**Integration**: [How this integrates with existing system]

## Rollback Plan
- [ ] Changes can be easily reverted
- [ ] No database migrations that can't be rolled back
- [ ] Feature flag available (if applicable)

---

**YOLO-PRO Enhancement Notes:**
- Task benefits from enhanced agent validation
- Context tracking maintains link to parent feature
- Enhanced CI monitoring provides immediate feedback
- Version compatibility checked automatically
- Integrates seamlessly with existing swarm patterns

**Labels**: `task`, `yolo-pro`
**Feature**: #[feature-number]
**Epic**: #[epic-number] (inherited)
**Assignee**: [Person or agent type]
**Estimate**: [Time estimate]
**Priority**: [High/Medium/Low]