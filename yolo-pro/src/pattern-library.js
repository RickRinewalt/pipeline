/**
 * YOLO-PRO Pattern Library System
 * Manages reusable development patterns and templates
 */

class PatternLibrary {
  constructor() {
    this.patterns = new Map();
    this.templates = new Map();
    this.loadDefaultPatterns();
  }

  loadDefaultPatterns() {
    // SPARC methodology patterns
    this.addPattern('sparc-specification', {
      name: 'SPARC Specification Template',
      type: 'methodology',
      template: `# Specification: {{name}}

## Requirements
{{requirements}}

## Acceptance Criteria
{{criteria}}

## Dependencies
{{dependencies}}`,
      variables: ['name', 'requirements', 'criteria', 'dependencies']
    });

    this.addPattern('tdd-test-structure', {
      name: 'TDD Test Structure',
      type: 'testing',
      template: `describe('{{component}}', () => {
  beforeEach(() => {
    // Setup
  });

  test('should {{behavior}}', () => {
    // Arrange
    // Act  
    // Assert
  });
});`,
      variables: ['component', 'behavior']
    });

    this.addPattern('github-issue-epic', {
      name: 'GitHub Epic Issue Template',
      type: 'github',
      template: `# EPIC: {{title}}

## Objective
{{objective}}

## Features
{{features}}

## Success Criteria
{{criteria}}

## Dependencies
{{dependencies}}`,
      variables: ['title', 'objective', 'features', 'criteria', 'dependencies']
    });

    this.addPattern('yolo-warp-workflow', {
      name: 'YOLO-WARP Workflow Pattern',
      type: 'workflow',
      template: `// YOLO-WARP Feature Implementation
// Feature: {{feature}}
// Branch: feature/{{number}}-{{slug}}

// 1. SPARC Specification
// 2. TDD Implementation  
// 3. Integration Testing
// 4. Merge to main
// 5. Next feature`,
      variables: ['feature', 'number', 'slug']
    });
  }

  addPattern(id, pattern) {
    this.patterns.set(id, {
      id,
      ...pattern,
      createdAt: new Date().toISOString()
    });
  }

  getPattern(id) {
    return this.patterns.get(id);
  }

  listPatterns(type = null) {
    const patterns = Array.from(this.patterns.values());
    return type ? patterns.filter(p => p.type === type) : patterns;
  }

  generateFromPattern(patternId, variables = {}) {
    const pattern = this.getPattern(patternId);
    if (!pattern) {
      throw new Error(`Pattern '${patternId}' not found`);
    }

    let output = pattern.template;
    
    // Replace template variables
    pattern.variables.forEach(variable => {
      const value = variables[variable] || `{{${variable}}}`;
      const regex = new RegExp(`{{${variable}}}`, 'g');
      output = output.replace(regex, value);
    });

    return output;
  }

  validatePattern(pattern) {
    const required = ['name', 'type', 'template', 'variables'];
    const missing = required.filter(field => !pattern[field]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }

    return true;
  }
}

module.exports = PatternLibrary;