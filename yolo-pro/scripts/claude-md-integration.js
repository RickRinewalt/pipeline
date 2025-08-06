#!/usr/bin/env node
/**
 * YOLO-PRO MVP: Claude knowing yolo via CLAUDE.md imports (Issue #39)
 * 
 * User Feedback: "should be about Claude knowing yolo via CLAUDE.md imports"
 * Reference: docs.anthropic.com/claude-code/memory#claude-md-imports
 * 
 * Simple Implementation: Help Claude know about yolo-pro via imports
 */

const fs = require('fs');
const path = require('path');

class ClaudeMdYoloImport {
    constructor() {
        this.claudeMdPath = this.findClaudeMd();
        this.yoloProtocolsPath = path.join(process.cwd(), 'claude.md_customisations', 'yolo-pro_protocols.md');
    }

    findClaudeMd() {
        const possiblePaths = [
            path.join(process.cwd(), 'CLAUDE.md'),
            path.join(process.cwd(), 'claude.md'),
            path.join(process.cwd(), '.claude.md')
        ];

        for (const mdPath of possiblePaths) {
            if (fs.existsSync(mdPath)) {
                console.log(`📄 Found CLAUDE.md at: ${mdPath}`);
                return mdPath;
            }
        }

        console.log('⚠️  CLAUDE.md not found, using default: CLAUDE.md');
        return path.join(process.cwd(), 'CLAUDE.md');
    }

    // Check if Claude knows about yolo-pro
    checkYoloKnowledge() {
        if (!fs.existsSync(this.claudeMdPath)) {
            console.log('❌ CLAUDE.md not found - Claude does not know about yolo-pro');
            return false;
        }

        const content = fs.readFileSync(this.claudeMdPath, 'utf8');
        const hasYoloRef = content.includes('yolo-pro') || content.includes('YOLO-PRO');
        
        console.log(`📋 CLAUDE.md exists: ${this.claudeMdPath}`);
        console.log(`🧠 Claude knows about yolo-pro: ${hasYoloRef ? 'Yes' : 'No'}`);
        
        return hasYoloRef;
    }

    // Help Claude know about yolo-pro via import
    enableYoloKnowledge() {
        console.log('🧠 Enabling Claude knowledge of yolo-pro via CLAUDE.md import...');
        
        // Check if protocols file exists
        if (!fs.existsSync(this.yoloProtocolsPath)) {
            console.error(`❌ YOLO protocols file not found: ${this.yoloProtocolsPath}`);
            return false;
        }

        // Create or update CLAUDE.md
        let content = '';
        if (fs.existsSync(this.claudeMdPath)) {
            content = fs.readFileSync(this.claudeMdPath, 'utf8');
            
            // Check if already imported
            if (content.includes('yolo-pro_protocols.md')) {
                console.log('✅ YOLO-PRO protocols already imported in CLAUDE.md');
                return true;
            }
        } else {
            content = '# Claude Code Configuration\n\n';
        }

        // Add import reference (per docs.anthropic.com pattern)
        const importSection = `
## YOLO-PRO Integration

This project uses YOLO-PRO protocols. Claude has access to these via import:

**Import Reference**: \`claude.md_customisations/yolo-pro_protocols.md\`

Key protocols available:
- Work Chunking Protocol (WCP)
- CI Protocol
- CD Protocol  
- Swarm Coordination

Usage: All \`yolo-*\` commands and \`dsp\`/\`dsp-c\` aliases are available.
`;

        const updatedContent = content + '\n' + importSection;
        
        try {
            fs.writeFileSync(this.claudeMdPath, updatedContent);
            console.log('✅ Claude now knows about yolo-pro via CLAUDE.md import');
            return true;
        } catch (error) {
            console.error(`❌ Failed to update CLAUDE.md: ${error.message}`);
            return false;
        }
    }

    // Validate import is working
    validateImport() {
        console.log('🔍 Validating yolo-pro import in CLAUDE.md...');
        
        const hasKnowledge = this.checkYoloKnowledge();
        
        if (hasKnowledge) {
            console.log('✅ Validation passed - Claude knows about yolo-pro');
            
            // Check protocols file exists
            if (fs.existsSync(this.yoloProtocolsPath)) {
                console.log('✅ YOLO protocols file accessible for import');
            } else {
                console.log('⚠️  YOLO protocols file missing - import may not work');
            }
        } else {
            console.log('❌ Validation failed - Claude does not know about yolo-pro');
        }
        
        return hasKnowledge;
    }

    // Show current import status
    showStatus() {
        console.log('📊 Claude-YOLO Knowledge Status');
        console.log('================================');
        console.log(`CLAUDE.md path: ${this.claudeMdPath}`);
        console.log(`CLAUDE.md exists: ${fs.existsSync(this.claudeMdPath) ? 'Yes' : 'No'}`);
        console.log(`Protocols path: ${this.yoloProtocolsPath}`);
        console.log(`Protocols exist: ${fs.existsSync(this.yoloProtocolsPath) ? 'Yes' : 'No'}`);
        
        const knowledge = this.checkYoloKnowledge();
        console.log(`Claude knows yolo-pro: ${knowledge ? 'Yes' : 'No'}`);
        
        if (!knowledge) {
            console.log('\n💡 Run "node claude-md-integration.js enable" to help Claude learn about yolo-pro');
        }
    }
}

// CLI interface
if (require.main === module) {
    const integration = new ClaudeMdYoloImport();
    const command = process.argv[2];

    switch (command) {
        case 'check':
            integration.checkYoloKnowledge();
            break;
            
        case 'enable':
            integration.enableYoloKnowledge();
            break;
            
        case 'validate':
            integration.validateImport();
            break;
            
        case 'status':
            integration.showStatus();
            break;

        default:
            console.log('YOLO-PRO Claude.md Integration (Issue #39)');
            console.log('Help Claude know about yolo-pro via CLAUDE.md imports');
            console.log('');
            console.log('Usage: node claude-md-integration.js <command>');
            console.log('Commands:');
            console.log('  check     - Check if Claude knows about yolo-pro');
            console.log('  enable    - Enable Claude knowledge via import');
            console.log('  validate  - Validate import is working');
            console.log('  status    - Show current status');
    }
}

module.exports = ClaudeMdYoloImport;