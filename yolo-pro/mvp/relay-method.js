#!/usr/bin/env node
/**
 * YOLO-PRO MVP: Relay Method Implementation (Issue #7)
 * 
 * Original Requirement: "Adding a final instruction to every message reminding 
 * the next agent that you speak to about the principles and patterns in use in 
 * the current workflow, with links to these."
 * 
 * Simple Implementation: Append workflow context to agent messages
 */

const fs = require('fs');
const path = require('path');

class YoloProRelayMethod {
    constructor() {
        this.contextTemplate = this.loadContextTemplate();
    }

    loadContextTemplate() {
        return `

---
**🔄 WORKFLOW CONTEXT RELAY**
Remember these principles and patterns for this workflow:

📋 **Active Protocols**: YOLO-PRO WCP, CI, CD
🤖 **Agent Coordination**: Follow swarm patterns from CLAUDE.md
📚 **Reference Links**:
- Memory Rules: @/claude.md_customisations/MEMORY_LEAK_PREVENTION_RULES.md
- Hooks Fix: @/claude.md_customisations/CLAUDE_FLOW_GENERIC_HOOKS_FIX.md  
- YOLO Protocols: @/claude.md_customisations/yolo-pro_protocols.md

🎯 **Current Workflow**: Continue following established patterns and maintain context consistency.
---`;
    }

    // Main relay method - appends context to agent messages
    appendWorkflowContext(originalMessage) {
        return originalMessage + this.contextTemplate;
    }

    // Apply relay method to swarm command
    enhanceSwarmCommand(command) {
        if (command.includes('swarm "')) {
            // Find the closing quote and insert context before it
            const lastQuoteIndex = command.lastIndexOf('"');
            if (lastQuoteIndex > 0) {
                const beforeQuote = command.substring(0, lastQuoteIndex);
                const afterQuote = command.substring(lastQuoteIndex);
                return beforeQuote + this.contextTemplate + afterQuote;
            }
        }
        return command;
    }

    // For testing the relay method
    test() {
        const testMessage = 'Research authentication methods for the project';
        const enhanced = this.appendWorkflowContext(testMessage);
        console.log('📡 Original message:');
        console.log(testMessage);
        console.log('\n📡 Enhanced with relay context:');
        console.log(enhanced);
    }
}

// CLI interface
if (require.main === module) {
    const relay = new YoloProRelayMethod();
    
    const command = process.argv[2];

    switch (command) {
        case 'test':
            relay.test();
            break;
            
        case 'enhance':
            const message = process.argv.slice(3).join(' ');
            if (message) {
                console.log(relay.appendWorkflowContext(message));
            } else {
                console.log('Usage: node relay-method.js enhance "Your message"');
            }
            break;

        default:
            console.log('YOLO-PRO Relay Method (Issue #7)');
            console.log('Usage: node relay-method.js <command>');
            console.log('Commands:');
            console.log('  test     - Test relay functionality');
            console.log('  enhance "msg" - Add workflow context to message');
    }
}

module.exports = YoloProRelayMethod;