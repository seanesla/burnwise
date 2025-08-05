#!/usr/bin/env node

/**
 * MUTATION TESTING FRAMEWORK
 * Verifies test quality by introducing controlled mutations and checking if tests detect them
 * This ensures our tests are actually testing what they claim to test
 */

const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const chalk = require('chalk');

class MutationTester {
  constructor() {
    this.mutations = [];
    this.results = {
      killed: 0,     // Mutations detected by tests
      survived: 0,   // Mutations not detected (BAD)
      timeout: 0,    // Tests timed out
      error: 0,      // Tests errored
      total: 0
    };
    this.mutators = {
      // Arithmetic operator mutations
      arithmetic: [
        { pattern: /\+/g, replacement: '-', name: 'Plus to Minus' },
        { pattern: /-/g, replacement: '+', name: 'Minus to Plus' },
        { pattern: /\*/g, replacement: '/', name: 'Multiply to Divide' },
        { pattern: /\//g, replacement: '*', name: 'Divide to Multiply' },
        { pattern: /%/g, replacement: '*', name: 'Modulo to Multiply' }
      ],
      
      // Comparison operator mutations
      comparison: [
        { pattern: /===/g, replacement: '!==', name: 'Strict Equal to Not Equal' },
        { pattern: /!==/g, replacement: '===', name: 'Not Equal to Strict Equal' },
        { pattern: /</g, replacement: '>', name: 'Less Than to Greater Than' },
        { pattern: />/g, replacement: '<', name: 'Greater Than to Less Than' },
        { pattern: /<=/g, replacement: '>', name: 'Less Equal to Greater' },
        { pattern: />=/g, replacement: '<', name: 'Greater Equal to Less' }
      ],
      
      // Logical operator mutations
      logical: [
        { pattern: /&&/g, replacement: '||', name: 'AND to OR' },
        { pattern: /\|\|/g, replacement: '&&', name: 'OR to AND' },
        { pattern: /!/g, replacement: '', name: 'Remove Negation' }
      ],
      
      // Boundary mutations
      boundary: [
        { pattern: /(\d+)/g, replacement: (match) => String(parseInt(match) + 1), name: 'Increment Number' },
        { pattern: /(\d+)/g, replacement: (match) => String(parseInt(match) - 1), name: 'Decrement Number' },
        { pattern: /(\d+)/g, replacement: '0', name: 'Replace with Zero' },
        { pattern: /(\d+)/g, replacement: '1', name: 'Replace with One' }
      ],
      
      // Return value mutations
      returnValue: [
        { pattern: /return true/g, replacement: 'return false', name: 'True to False' },
        { pattern: /return false/g, replacement: 'return true', name: 'False to True' },
        { pattern: /return (\w+)/g, replacement: 'return null', name: 'Return Null' },
        { pattern: /return (\w+)/g, replacement: 'return undefined', name: 'Return Undefined' }
      ],
      
      // Array mutations
      array: [
        { pattern: /\.push\(/g, replacement: '.pop(', name: 'Push to Pop' },
        { pattern: /\.pop\(/g, replacement: '.push(', name: 'Pop to Push' },
        { pattern: /\.shift\(/g, replacement: '.unshift(', name: 'Shift to Unshift' },
        { pattern: /\.map\(/g, replacement: '.filter(', name: 'Map to Filter' },
        { pattern: /\.filter\(/g, replacement: '.map(', name: 'Filter to Map' }
      ],
      
      // Conditional mutations
      conditional: [
        { pattern: /if\s*\(/g, replacement: 'if (!(', name: 'Negate If Condition' },
        { pattern: /while\s*\(/g, replacement: 'while (!(', name: 'Negate While Condition' },
        { pattern: /for\s*\([^;]+;\s*([^;]+);/g, replacement: (match, condition) => match.replace(condition, `!(${condition})`), name: 'Negate For Condition' }
      ],
      
      // Math function mutations
      math: [
        { pattern: /Math\.max/g, replacement: 'Math.min', name: 'Max to Min' },
        { pattern: /Math\.min/g, replacement: 'Math.max', name: 'Min to Max' },
        { pattern: /Math\.floor/g, replacement: 'Math.ceil', name: 'Floor to Ceil' },
        { pattern: /Math\.ceil/g, replacement: 'Math.floor', name: 'Ceil to Floor' },
        { pattern: /Math\.abs/g, replacement: '', name: 'Remove Abs' }
      ],
      
      // String mutations
      string: [
        { pattern: /\.toUpperCase\(\)/g, replacement: '.toLowerCase()', name: 'Upper to Lower' },
        { pattern: /\.toLowerCase\(\)/g, replacement: '.toUpperCase()', name: 'Lower to Upper' },
        { pattern: /\.trim\(\)/g, replacement: '', name: 'Remove Trim' },
        { pattern: /\.length/g, replacement: '.length + 1', name: 'Length Plus One' }
      ],
      
      // Callback mutations
      callback: [
        { pattern: /setTimeout\([^,]+,\s*(\d+)\)/g, replacement: (match, delay) => match.replace(delay, '0'), name: 'Zero Timeout' },
        { pattern: /setInterval\([^,]+,\s*(\d+)\)/g, replacement: (match, delay) => match.replace(delay, '0'), name: 'Zero Interval' }
      ]
    };
  }

  async loadTargetFiles() {
    const targetFiles = [
      '../../agents/coordinator.js',
      '../../agents/weather.js',
      '../../agents/predictor.js',
      '../../agents/optimizer.js',
      '../../agents/alerts.js',
      '../../db/connection.js',
      '../../middleware/rateLimiter.js'
    ];

    const files = [];
    for (const file of targetFiles) {
      const filePath = path.join(__dirname, file);
      try {
        const content = await fs.readFile(filePath, 'utf8');
        files.push({
          path: filePath,
          content,
          name: path.basename(filePath)
        });
      } catch (error) {
        console.warn(`⚠️  Could not load ${file}: ${error.message}`);
      }
    }
    
    return files;
  }

  generateMutations(file) {
    const mutations = [];
    
    // Apply each mutator category
    for (const [category, mutators] of Object.entries(this.mutators)) {
      for (const mutator of mutators) {
        const matches = file.content.match(mutator.pattern);
        
        if (matches && matches.length > 0) {
          // For each match, create a mutation
          let currentContent = file.content;
          let offset = 0;
          
          file.content.replace(mutator.pattern, (match, ...args) => {
            const index = args[args.length - 2]; // Get match index
            
            // Create mutated content
            let replacement;
            if (typeof mutator.replacement === 'function') {
              replacement = mutator.replacement(match);
            } else {
              replacement = mutator.replacement;
            }
            
            const mutatedContent = 
              currentContent.substring(0, index + offset) +
              replacement +
              currentContent.substring(index + offset + match.length);
            
            mutations.push({
              file: file.name,
              filePath: file.path,
              category,
              mutator: mutator.name,
              line: this.getLineNumber(file.content, index),
              original: match,
              mutated: replacement,
              content: mutatedContent
            });
            
            return match; // Don't actually replace in this pass
          });
        }
      }
    }
    
    return mutations;
  }

  getLineNumber(content, index) {
    const lines = content.substring(0, index).split('\n');
    return lines.length;
  }

  async applyMutation(mutation) {
    // Backup original file
    const backup = await fs.readFile(mutation.filePath, 'utf8');
    
    try {
      // Apply mutation
      await fs.writeFile(mutation.filePath, mutation.content, 'utf8');
      return backup;
    } catch (error) {
      // Restore on error
      await fs.writeFile(mutation.filePath, backup, 'utf8');
      throw error;
    }
  }

  async runTests(testFile = 'real-integration.test.js') {
    return new Promise((resolve) => {
      const testProcess = spawn('npm', ['test', '--', testFile], {
        cwd: path.join(__dirname, '../..'),
        stdio: 'pipe',
        timeout: 30000 // 30 second timeout
      });

      let output = '';
      let errorOutput = '';

      testProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      testProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      testProcess.on('close', (code) => {
        resolve({
          passed: code === 0,
          output,
          errorOutput,
          exitCode: code
        });
      });

      testProcess.on('error', (error) => {
        resolve({
          passed: false,
          output,
          errorOutput,
          error: error.message
        });
      });

      // Kill after timeout
      setTimeout(() => {
        testProcess.kill('SIGTERM');
        resolve({
          passed: false,
          timeout: true,
          output,
          errorOutput
        });
      }, 30000);
    });
  }

  async testMutation(mutation) {
    console.log(chalk.yellow(`\n🧬 Testing mutation: ${mutation.mutator} in ${mutation.file}:${mutation.line}`));
    console.log(chalk.gray(`   Original: ${mutation.original}`));
    console.log(chalk.gray(`   Mutated:  ${mutation.mutated}`));

    // Apply mutation
    let backup;
    try {
      backup = await this.applyMutation(mutation);
    } catch (error) {
      console.log(chalk.red(`   ❌ Failed to apply mutation: ${error.message}`));
      return { status: 'error', error: error.message };
    }

    // Run tests
    const testResult = await this.runTests();

    // Restore original
    await fs.writeFile(mutation.filePath, backup, 'utf8');

    // Analyze results
    if (testResult.timeout) {
      console.log(chalk.yellow(`   ⏱️  Tests timed out`));
      return { status: 'timeout' };
    }

    if (testResult.error) {
      console.log(chalk.red(`   ❌ Test error: ${testResult.error}`));
      return { status: 'error', error: testResult.error };
    }

    if (!testResult.passed) {
      console.log(chalk.green(`   ✅ Mutation KILLED (tests failed as expected)`));
      return { status: 'killed' };
    } else {
      console.log(chalk.red(`   ⚠️  Mutation SURVIVED (tests still passed!)`));
      return { status: 'survived' };
    }
  }

  async run(options = {}) {
    const {
      maxMutations = 50,
      categories = Object.keys(this.mutators),
      targetFiles = null
    } = options;

    console.log(chalk.bold.blue('\n🧬 MUTATION TESTING FRAMEWORK'));
    console.log(chalk.gray('=' .repeat(50)));

    // Load target files
    const files = targetFiles || await this.loadTargetFiles();
    console.log(chalk.cyan(`\n📁 Loaded ${files.length} target files`));

    // Generate mutations
    console.log(chalk.cyan('\n🔬 Generating mutations...'));
    for (const file of files) {
      const fileMutations = this.generateMutations(file);
      this.mutations.push(...fileMutations);
    }

    // Filter by categories
    this.mutations = this.mutations.filter(m => categories.includes(m.category));
    
    // Limit mutations
    if (this.mutations.length > maxMutations) {
      console.log(chalk.yellow(`\n⚠️  Limiting to ${maxMutations} mutations (found ${this.mutations.length})`));
      // Shuffle and take first N
      this.mutations = this.mutations
        .sort(() => Math.random() - 0.5)
        .slice(0, maxMutations);
    }

    console.log(chalk.cyan(`\n🧪 Testing ${this.mutations.length} mutations...`));

    // Test each mutation
    for (let i = 0; i < this.mutations.length; i++) {
      const mutation = this.mutations[i];
      console.log(chalk.blue(`\n[${i + 1}/${this.mutations.length}]`));
      
      const result = await this.testMutation(mutation);
      
      // Update results
      this.results.total++;
      this.results[result.status]++;
      
      // Store result
      mutation.result = result;
    }

    // Report results
    this.generateReport();
  }

  generateReport() {
    console.log(chalk.bold.blue('\n\n📊 MUTATION TESTING REPORT'));
    console.log(chalk.gray('=' .repeat(50)));

    const total = this.results.total;
    const killed = this.results.killed;
    const survived = this.results.survived;
    const timeout = this.results.timeout;
    const error = this.results.error;

    const mutationScore = total > 0 ? (killed / total * 100).toFixed(1) : 0;

    console.log(chalk.white(`\n📈 Overall Statistics:`));
    console.log(chalk.green(`   ✅ Killed:   ${killed}/${total} (${(killed/total*100).toFixed(1)}%)`));
    console.log(chalk.red(`   ⚠️  Survived: ${survived}/${total} (${(survived/total*100).toFixed(1)}%)`));
    console.log(chalk.yellow(`   ⏱️  Timeout:  ${timeout}/${total} (${(timeout/total*100).toFixed(1)}%)`));
    console.log(chalk.red(`   ❌ Error:    ${error}/${total} (${(error/total*100).toFixed(1)}%)`));

    console.log(chalk.bold.white(`\n🎯 Mutation Score: ${mutationScore}%`));

    if (mutationScore >= 80) {
      console.log(chalk.green('   Excellent! Tests are catching most mutations.'));
    } else if (mutationScore >= 60) {
      console.log(chalk.yellow('   Good, but room for improvement in test coverage.'));
    } else if (mutationScore >= 40) {
      console.log(chalk.yellow('   Fair. Consider adding more comprehensive tests.'));
    } else {
      console.log(chalk.red('   Poor. Tests are not catching enough mutations.'));
    }

    // Category breakdown
    console.log(chalk.white(`\n📊 By Category:`));
    const categoryStats = {};
    
    for (const mutation of this.mutations) {
      if (!categoryStats[mutation.category]) {
        categoryStats[mutation.category] = { killed: 0, survived: 0, total: 0 };
      }
      categoryStats[mutation.category].total++;
      if (mutation.result) {
        if (mutation.result.status === 'killed') {
          categoryStats[mutation.category].killed++;
        } else if (mutation.result.status === 'survived') {
          categoryStats[mutation.category].survived++;
        }
      }
    }

    for (const [category, stats] of Object.entries(categoryStats)) {
      const score = (stats.killed / stats.total * 100).toFixed(1);
      console.log(`   ${category}: ${stats.killed}/${stats.total} killed (${score}%)`);
    }

    // Surviving mutations (most problematic)
    const survived = this.mutations.filter(m => m.result && m.result.status === 'survived');
    if (survived.length > 0) {
      console.log(chalk.red(`\n⚠️  Surviving Mutations (Need Better Tests):`));
      survived.slice(0, 10).forEach(m => {
        console.log(chalk.yellow(`   - ${m.file}:${m.line} - ${m.mutator}`));
        console.log(chalk.gray(`     ${m.original} → ${m.mutated}`));
      });
      
      if (survived.length > 10) {
        console.log(chalk.gray(`   ... and ${survived.length - 10} more`));
      }
    }

    // Save detailed report
    const reportPath = path.join(__dirname, 'mutation-report.json');
    fs.writeFile(reportPath, JSON.stringify({
      summary: this.results,
      mutationScore,
      categoryStats,
      mutations: this.mutations.map(m => ({
        ...m,
        content: undefined // Don't save full file content
      }))
    }, null, 2)).then(() => {
      console.log(chalk.gray(`\n💾 Detailed report saved to ${reportPath}`));
    });
  }
}

// CLI interface
async function main() {
  const tester = new MutationTester();
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  const options = {
    maxMutations: 30,
    categories: ['arithmetic', 'comparison', 'logical', 'boundary', 'returnValue']
  };
  
  // Parse flags
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--max':
        options.maxMutations = parseInt(args[++i]);
        break;
      case '--category':
        options.categories = [args[++i]];
        break;
      case '--all-categories':
        options.categories = Object.keys(tester.mutators);
        break;
      case '--help':
        console.log(`
Mutation Testing Framework

Usage: node mutation-testing.js [options]

Options:
  --max <n>           Maximum number of mutations to test (default: 30)
  --category <name>   Test only specific category of mutations
  --all-categories    Test all mutation categories
  --help              Show this help message

Categories:
  ${Object.keys(tester.mutators).join(', ')}

Example:
  node mutation-testing.js --max 50 --category arithmetic
        `);
        process.exit(0);
    }
  }
  
  // Run mutation testing
  await tester.run(options);
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error(chalk.red(`\n❌ Fatal error: ${error.message}`));
    process.exit(1);
  });
}

module.exports = MutationTester;