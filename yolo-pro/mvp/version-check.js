#!/usr/bin/env node

/**
 * YOLO-PRO MVP: Version Check (Issue #9)
 * Validates version compatibility for claude-flow, Claude Code, and YOLO-PRO components
 * Integrates with existing swarm initialization patterns
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class YoloProVersionChecker {
  constructor() {
    this.compatibilityMatrix = this.loadCompatibilityMatrix();
    this.currentVersions = {};
  }

  loadCompatibilityMatrix() {
    try {
      const matrixPath = path.join(__dirname, '..', 'config', 'compatibility-matrix.json');
      return JSON.parse(fs.readFileSync(matrixPath, 'utf8'));
    } catch (error) {
      console.warn('⚠️  Compatibility matrix not found, using defaults');
      return this.getDefaultMatrix();
    }
  }

  getDefaultMatrix() {
    return {
      "claude-flow": {
        "minimum": "2.0.0",
        "recommended": "2.1.0+",
        "deprecated": ["1.x.x"]
      },
      "claude-code": {
        "minimum": "1.0.0",
        "recommended": "latest",
        "deprecated": []
      },
      "yolo-pro": {
        "minimum": "1.0.0",
        "recommended": "latest",
        "deprecated": []
      },
      "node": {
        "minimum": "18.0.0",
        "recommended": "20.0.0+",
        "deprecated": ["<16.0.0"]
      }
    };
  }

  async checkClaudeFlowVersion() {
    try {
      const output = execSync('npx claude-flow@alpha --version', { encoding: 'utf8' });
      const version = output.trim();
      this.currentVersions['claude-flow'] = version;
      return { version, available: true };
    } catch (error) {
      console.error('❌ Claude Flow not available:', error.message);
      return { version: null, available: false };
    }
  }

  async checkClaudeCodeVersion() {
    try {
      // Check if Claude Code is available via CLI
      const output = execSync('claude --version', { encoding: 'utf8' });
      const version = output.trim();
      this.currentVersions['claude-code'] = version;
      return { version, available: true };
    } catch (error) {
      console.warn('⚠️  Claude Code version check failed, may need authentication');
      return { version: 'unknown', available: false };
    }
  }

  async checkNodeVersion() {
    const version = process.version;
    this.currentVersions['node'] = version;
    return { version, available: true };
  }

  async checkYoloProVersion() {
    try {
      const packagePath = path.join(__dirname, '..', '..', 'package.json');
      if (fs.existsSync(packagePath)) {
        const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        const version = pkg.version || '1.0.0';
        this.currentVersions['yolo-pro'] = version;
        return { version, available: true };
      }
    } catch (error) {
      console.warn('⚠️  YOLO-PRO version not determinable');
    }
    return { version: '1.0.0', available: true };
  }

  compareVersions(current, minimum) {
    // Simple version comparison (extend for more complex semver if needed)
    const currentParts = current.replace(/[^\d.]/g, '').split('.').map(Number);
    const minimumParts = minimum.split('.').map(Number);
    
    for (let i = 0; i < Math.max(currentParts.length, minimumParts.length); i++) {
      const currentPart = currentParts[i] || 0;
      const minimumPart = minimumParts[i] || 0;
      
      if (currentPart > minimumPart) return 1;
      if (currentPart < minimumPart) return -1;
    }
    return 0;
  }

  validateCompatibility() {
    const results = {
      compatible: true,
      warnings: [],
      errors: [],
      recommendations: []
    };

    Object.entries(this.currentVersions).forEach(([component, version]) => {
      const requirements = this.compatibilityMatrix[component];
      if (!requirements) return;

      const comparison = this.compareVersions(version, requirements.minimum);
      
      if (comparison < 0) {
        results.compatible = false;
        results.errors.push(
          `❌ ${component} v${version} is below minimum required v${requirements.minimum}`
        );
      } else if (version !== requirements.recommended) {
        results.warnings.push(
          `⚠️  ${component} v${version} works but v${requirements.recommended} is recommended`
        );
      }

      // Check for deprecated versions
      if (requirements.deprecated.some(dep => version.startsWith(dep))) {
        results.warnings.push(
          `⚠️  ${component} v${version} is deprecated, please upgrade`
        );
      }
    });

    return results;
  }

  async performFullCheck() {
    console.log('🔍 YOLO-PRO Version Compatibility Check');
    console.log('=====================================');

    // Check all components
    await Promise.all([
      this.checkClaudeFlowVersion(),
      this.checkClaudeCodeVersion(),
      this.checkNodeVersion(),
      this.checkYoloProVersion()
    ]);

    // Display current versions
    console.log('📋 Current Versions:');
    Object.entries(this.currentVersions).forEach(([component, version]) => {
      console.log(`   ${component}: ${version}`);
    });

    // Validate compatibility
    const validation = this.validateCompatibility();

    console.log('\n🧪 Compatibility Results:');
    if (validation.compatible) {
      console.log('✅ All components are compatible!');
    } else {
      console.log('❌ Compatibility issues detected');
    }

    // Show errors
    if (validation.errors.length > 0) {
      console.log('\n🚨 Critical Issues:');
      validation.errors.forEach(error => console.log(`   ${error}`));
    }

    // Show warnings
    if (validation.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      validation.warnings.forEach(warning => console.log(`   ${warning}`));
    }

    // Integration check for existing patterns
    this.checkExistingIntegration();

    return validation;
  }

  checkExistingIntegration() {
    console.log('\n🔗 Integration Status:');
    
    // Check if CLAUDE.md exists (from README.md line 92)
    const claudeMdPath = path.join(process.cwd(), 'CLAUDE.md');
    if (fs.existsSync(claudeMdPath)) {
      console.log('   ✅ CLAUDE.md found - existing integration preserved');
      
      // Check if yolo-pro protocols are appended (README.md line 93)
      const content = fs.readFileSync(claudeMdPath, 'utf8');
      if (content.includes('YOLO-PRO Protocols') || content.includes('Work Chunking Protocol')) {
        console.log('   ✅ YOLO-PRO protocols integrated');
      } else {
        console.log('   ⚠️  YOLO-PRO protocols not found in CLAUDE.md');
        console.log('      Run: Append yolo-pro_protocols.md to CLAUDE.md');
      }
    } else {
      console.log('   ⚠️  CLAUDE.md not found - create for enhanced integration');
    }

    // Check for existing usage patterns (README.md lines 123-147)
    console.log('   ℹ️  Existing swarm commands will continue to work:');
    console.log('      npx claude-flow@alpha swarm "Research topic X..."');
    console.log('      npx claude-flow@alpha swarm "...technical options analysis..."');
  }

  // Static method for easy CLI usage
  static async check() {
    const checker = new YoloProVersionChecker();
    return await checker.performFullCheck();
  }
}

// CLI execution
if (require.main === module) {
  YoloProVersionChecker.check().then(result => {
    process.exit(result.compatible ? 0 : 1);
  }).catch(error => {
    console.error('🚨 Version check failed:', error);
    process.exit(1);
  });
}

module.exports = YoloProVersionChecker;