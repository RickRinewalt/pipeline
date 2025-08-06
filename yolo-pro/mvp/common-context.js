#!/usr/bin/env node
/**
 * YOLO-PRO MVP: Common Context Implementation (Issue #15)
 * 
 * Original Requirement: "Include phase-level context instructions in each feature, 
 * which refers to things like yolo-pro and patterns and principles"
 * 
 * Simple Implementation: Context template system for consistent workflow context
 */

const fs = require('fs');
const path = require('path');

class YoloProCommonContext {
    constructor() {
        this.contextDir = path.join(process.cwd(), '.yolo-pro', 'context');
        this.ensureContextDirectory();
        this.loadContextTemplate();
    }

    ensureContextDirectory() {
        if (!fs.existsSync(this.contextDir)) {
            fs.mkdirSync(this.contextDir, { recursive: true });
        }
    }

    loadContextTemplate() {
        this.contextTemplate = {
            // YOLO Protocol Context
            yoloProtocols: {
                currentPhase: 'Planning', // Planning/Implementation/Deployment
                activeProtocols: ['WCP', 'CI', 'CD', 'Swarm'],
                agentTypes: ['researcher', 'analyst', 'coder', 'tester'],
                patternLibrary: ['epic', 'feature', 'story']
            },
            
            // Technical Context
            technical: {
                repository: process.cwd(),
                branchStrategy: 'Feature branches',
                ciStatus: 'Active',
                dependencies: []
            },
            
            // Implementation Context
            implementation: {
                memoryLeakRules: '@/claude.md_customisations/MEMORY_LEAK_PREVENTION_RULES.md',
                hooksIntegration: '@/claude.md_customisations/CLAUDE_FLOW_GENERIC_HOOKS_FIX.md',
                yoloProtocols: '@/claude.md_customisations/yolo-pro_protocols.md'
            }
        };
    }

    // Generate common context template for issues
    generateContextTemplate(phase = 'Planning') {
        return `## Common Context Template

### YOLO Protocol Context
- Current Phase: ${phase}
- Active Protocols: ${this.contextTemplate.yoloProtocols.activeProtocols.join('/')}
- Agent Types Available: ${this.contextTemplate.yoloProtocols.agentTypes.join(', ')}
- Pattern Library: ${this.contextTemplate.yoloProtocols.patternLibrary.join(', ')}

### Technical Context
- Repository: ${this.contextTemplate.technical.repository}
- Branch Strategy: ${this.contextTemplate.technical.branchStrategy}
- CI Status: ${this.contextTemplate.technical.ciStatus}
- Dependencies: ${this.contextTemplate.technical.dependencies.join(', ') || 'None'}

### Implementation Context
- Memory Leak Rules: ${this.contextTemplate.implementation.memoryLeakRules}
- Hooks Integration: ${this.contextTemplate.implementation.hooksIntegration}
- YOLO Protocols: ${this.contextTemplate.implementation.yoloProtocols}`;
    }

    // Apply context to issue (simple key-value storage)
    setContext(key, value) {
        const contextFile = path.join(this.contextDir, 'current-context.json');
        
        let context = {};
        if (fs.existsSync(contextFile)) {
            try {
                context = JSON.parse(fs.readFileSync(contextFile, 'utf8'));
            } catch (error) {
                console.warn('Failed to load existing context:', error.message);
            }
        }

        context[key] = {
            value: value,
            timestamp: Date.now(),
            phase: this.contextTemplate.yoloProtocols.currentPhase
        };

        fs.writeFileSync(contextFile, JSON.stringify(context, null, 2));
        console.log(`💾 Context stored: ${key}`);
        
        return context[key];
    }

    // Get context value
    getContext(key) {
        const contextFile = path.join(this.contextDir, 'current-context.json');
        
        if (!fs.existsSync(contextFile)) {
            return null;
        }

        try {
            const context = JSON.parse(fs.readFileSync(contextFile, 'utf8'));
            return context[key] || null;
        } catch (error) {
            console.error('Failed to read context:', error.message);
            return null;
        }
    }

    // List all context keys
    listContext() {
        const contextFile = path.join(this.contextDir, 'current-context.json');
        
        if (!fs.existsSync(contextFile)) {
            return {};
        }

        try {
            const context = JSON.parse(fs.readFileSync(contextFile, 'utf8'));
            return context;
        } catch (error) {
            console.error('Failed to read context:', error.message);
            return {};
        }
    }

    // Apply context template to issue
    applyToIssue(issueNumber) {
        const template = this.generateContextTemplate();
        console.log(`📋 Applying context template to issue ${issueNumber}:`);
        console.log(template);
        
        // Store the context application
        this.setContext(`issue-${issueNumber}`, {
            template: template,
            applied: true,
            appliedAt: Date.now()
        });
        
        return template;
    }

    // Update current phase
    setPhase(phase) {
        this.contextTemplate.yoloProtocols.currentPhase = phase;
        console.log(`📌 Current phase updated to: ${phase}`);
    }

    // Get current status
    getStatus() {
        const context = this.listContext();
        const contextCount = Object.keys(context).length;
        
        return {
            currentPhase: this.contextTemplate.yoloProtocols.currentPhase,
            activeProtocols: this.contextTemplate.yoloProtocols.activeProtocols,
            contextEntries: contextCount,
            lastActivity: contextCount > 0 ? Math.max(...Object.values(context).map(v => v.timestamp)) : null
        };
    }
}

// CLI interface
if (require.main === module) {
    const context = new YoloProCommonContext();
    
    const command = process.argv[2];
    const args = process.argv.slice(3);

    switch (command) {
        case 'set':
            const [key, value] = args;
            if (!key || !value) {
                console.log('Usage: node common-context.js set "key" "value"');
                process.exit(1);
            }
            context.setContext(key, value);
            break;

        case 'get':
            const result = context.getContext(args[0]);
            if (result) {
                console.log(JSON.stringify(result, null, 2));
            } else {
                console.log('null');
            }
            break;

        case 'list':
            const allContext = context.listContext();
            Object.entries(allContext).forEach(([key, entry]) => {
                console.log(`${key}: ${JSON.stringify(entry.value).substring(0, 50)}...`);
            });
            break;

        case 'template':
            const phase = args[0] || 'Planning';
            console.log(context.generateContextTemplate(phase));
            break;

        case 'apply':
            const issueNumber = args[0];
            if (!issueNumber) {
                console.log('Usage: node common-context.js apply ISSUE_NUMBER');
                process.exit(1);
            }
            context.applyToIssue(issueNumber);
            break;

        case 'phase':
            const newPhase = args[0];
            if (!newPhase) {
                console.log('Usage: node common-context.js phase PHASE_NAME');
                process.exit(1);
            }
            context.setPhase(newPhase);
            break;

        case 'status':
            const status = context.getStatus();
            console.log('📊 YOLO-PRO Common Context Status');
            console.log('=================================');
            console.log(`Current Phase: ${status.currentPhase}`);
            console.log(`Active Protocols: ${status.activeProtocols.join(', ')}`);
            console.log(`Context Entries: ${status.contextEntries}`);
            break;

        default:
            console.log('YOLO-PRO Common Context (Issue #15)');
            console.log('Usage: node common-context.js <command>');
            console.log('Commands:');
            console.log('  set "key" "value"  - Set context value');
            console.log('  get "key"         - Get context value');
            console.log('  list              - List all context');
            console.log('  template [phase]  - Show context template');
            console.log('  apply ISSUE       - Apply context to issue');
            console.log('  phase PHASE       - Set current phase');
            console.log('  status            - Show status');
    }
}

module.exports = YoloProCommonContext;