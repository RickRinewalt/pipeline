#!/usr/bin/env node
/**
 * YOLO-PRO MVP: Simple GitHub Label Check (Issue #38)
 * 
 * User Feedback: "just simple checking/creation needed"
 * 
 * Simple Implementation: Basic label validation and creation
 */

const { execSync } = require('child_process');

class SimpleGitHubLabelCheck {
    constructor() {
        this.basicLabels = [
            'yolo-pro',
            'epic',
            'feature', 
            'task',
            'enhancement'
        ];
    }

    // Check if labels exist
    checkLabels() {
        try {
            const output = execSync('gh api repos/:owner/:repo/labels', { encoding: 'utf8' });
            const existingLabels = JSON.parse(output).map(label => label.name);
            
            console.log(`📋 Found ${existingLabels.length} existing labels`);
            
            const missing = this.basicLabels.filter(label => !existingLabels.includes(label));
            
            if (missing.length > 0) {
                console.log(`❌ Missing labels: ${missing.join(', ')}`);
                return missing;
            } else {
                console.log('✅ All basic labels exist');
                return [];
            }
        } catch (error) {
            console.error('❌ Failed to check labels:', error.message);
            return null;
        }
    }

    // Create missing labels
    createLabels(missing) {
        const created = [];
        
        for (const label of missing) {
            try {
                execSync(`gh api repos/:owner/:repo/labels -f name="${label}" -f color="0366d6"`, { stdio: 'pipe' });
                console.log(`✅ Created label: ${label}`);
                created.push(label);
            } catch (error) {
                console.error(`❌ Failed to create ${label}:`, error.message);
            }
        }
        
        return created;
    }

    // Validate before issue creation
    validateForIssue(issueType) {
        console.log(`🏷️ Validating labels for ${issueType} issue...`);
        
        const missing = this.checkLabels();
        if (missing === null) return false;
        
        if (missing.length > 0) {
            console.log('🔧 Creating missing labels...');
            this.createLabels(missing);
        }
        
        return true;
    }
}

// CLI interface
if (require.main === module) {
    const checker = new SimpleGitHubLabelCheck();
    const command = process.argv[2];
    const args = process.argv.slice(3);

    switch (command) {
        case 'check':
            checker.checkLabels();
            break;
            
        case 'create':
            const missing = checker.checkLabels();
            if (missing && missing.length > 0) {
                checker.createLabels(missing);
            }
            break;
            
        case 'validate':
            const issueType = args[0] || 'feature';
            checker.validateForIssue(issueType);
            break;

        default:
            console.log('YOLO-PRO Simple GitHub Label Check');
            console.log('Usage: node github-label-check.js <command>');
            console.log('Commands:');
            console.log('  check     - Check which labels exist');
            console.log('  create    - Create missing basic labels');
            console.log('  validate [type] - Validate labels for issue creation');
    }
}

module.exports = SimpleGitHubLabelCheck;