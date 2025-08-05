#!/usr/bin/env node

/**
 * COMPREHENSIVE TEST RUNNER
 * Executes all deep tests and generates a detailed report
 * Tracks test quality, coverage, and system resilience
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');

class ComprehensiveTestRunner {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: 0
      },
      categories: {},
      failures: [],
      performance: {},
      coverage: {}
    };
    
    this.testSuites = [
      {
        name: 'Real Integration Tests',
        file: 'real-integration.test.js',
        category: 'integration',
        description: 'Tests with zero mocks, real database operations'
      },
      {
        name: 'Property-Based Tests',
        file: 'property-based-gaussian.test.js',
        category: 'property',
        description: 'Mathematical correctness of Gaussian plume model'
      },
      {
        name: 'API Contract Tests',
        file: 'api-contract.test.js',
        category: 'contract',
        description: 'API endpoint schema validation and contracts'
      },
      {
        name: 'Chaos Engineering Tests',
        file: 'chaos-engineering.test.js',
        category: 'chaos',
        description: 'System resilience under failure conditions'
      },
      {
        name: 'Load Tests',
        file: 'load-testing.test.js',
        category: 'load',
        description: 'Performance under various load conditions'
      }
    ];
  }

  async runTestSuite(suite) {
    return new Promise((resolve) => {
      console.log(chalk.blue(`\n▶️  Running ${suite.name}...`));
      console.log(chalk.gray(`   ${suite.description}`));
      
      const startTime = Date.now();
      const testProcess = spawn('npx', ['jest', suite.file, '--json', '--no-coverage'], {
        cwd: __dirname,
        stdio: ['inherit', 'pipe', 'pipe']
      });

      let output = '';
      let errorOutput = '';

      testProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      testProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
        process.stderr.write(chalk.gray(data.toString()));
      });

      testProcess.on('close', (code) => {
        const duration = Date.now() - startTime;
        
        try {
          // Parse Jest JSON output
          const jsonStart = output.indexOf('{');
          const jsonEnd = output.lastIndexOf('}') + 1;
          
          if (jsonStart >= 0 && jsonEnd > jsonStart) {
            const jsonOutput = output.substring(jsonStart, jsonEnd);
            const testResults = JSON.parse(jsonOutput);
            
            resolve({
              suite: suite.name,
              category: suite.category,
              passed: code === 0,
              duration,
              stats: {
                total: testResults.numTotalTests || 0,
                passed: testResults.numPassedTests || 0,
                failed: testResults.numFailedTests || 0,
                pending: testResults.numPendingTests || 0
              },
              failures: testResults.testResults?.flatMap(r => 
                r.assertionResults?.filter(a => a.status === 'failed')
                  .map(a => ({
                    title: a.title,
                    message: a.failureMessages?.join('\n')
                  }))
              ) || []
            });
          } else {
            // Fallback if JSON parsing fails
            resolve({
              suite: suite.name,
              category: suite.category,
              passed: code === 0,
              duration,
              stats: { total: 0, passed: 0, failed: 0, pending: 0 },
              failures: [],
              error: 'Could not parse test output'
            });
          }
        } catch (error) {
          resolve({
            suite: suite.name,
            category: suite.category,
            passed: false,
            duration,
            error: error.message,
            stats: { total: 0, passed: 0, failed: 0, pending: 0 },
            failures: []
          });
        }
      });

      testProcess.on('error', (error) => {
        resolve({
          suite: suite.name,
          category: suite.category,
          passed: false,
          duration: Date.now() - startTime,
          error: error.message,
          stats: { total: 0, passed: 0, failed: 0, pending: 0 },
          failures: []
        });
      });

      // Timeout after 5 minutes
      setTimeout(() => {
        testProcess.kill('SIGTERM');
        resolve({
          suite: suite.name,
          category: suite.category,
          passed: false,
          duration: Date.now() - startTime,
          error: 'Test suite timed out',
          stats: { total: 0, passed: 0, failed: 0, pending: 0 },
          failures: []
        });
      }, 300000);
    });
  }

  async runMutationTesting() {
    console.log(chalk.blue('\n🧬 Running Mutation Testing...'));
    
    return new Promise((resolve) => {
      const mutationProcess = spawn('node', ['mutation-testing.js', '--max', '20'], {
        cwd: __dirname,
        stdio: ['inherit', 'pipe', 'pipe']
      });

      let output = '';

      mutationProcess.stdout.on('data', (data) => {
        output += data.toString();
        process.stdout.write(data);
      });

      mutationProcess.stderr.on('data', (data) => {
        process.stderr.write(chalk.red(data.toString()));
      });

      mutationProcess.on('close', (code) => {
        // Extract mutation score from output
        const scoreMatch = output.match(/Mutation Score: ([\d.]+)%/);
        const score = scoreMatch ? parseFloat(scoreMatch[1]) : 0;

        resolve({
          suite: 'Mutation Testing',
          category: 'quality',
          passed: score >= 60, // Pass if mutation score >= 60%
          mutationScore: score,
          details: output
        });
      });

      mutationProcess.on('error', (error) => {
        resolve({
          suite: 'Mutation Testing',
          category: 'quality',
          passed: false,
          error: error.message
        });
      });

      // Timeout after 10 minutes
      setTimeout(() => {
        mutationProcess.kill('SIGTERM');
        resolve({
          suite: 'Mutation Testing',
          category: 'quality',
          passed: false,
          error: 'Mutation testing timed out'
        });
      }, 600000);
    });
  }

  async analyzeTestQuality() {
    console.log(chalk.blue('\n📊 Analyzing Test Quality...'));
    
    const quality = {
      realTests: 0,
      mockedTests: 0,
      assertions: 0,
      coverage: {},
      depth: 'unknown'
    };

    // Count real vs mocked tests
    try {
      const files = await fs.readdir(__dirname);
      const testFiles = files.filter(f => f.endsWith('.test.js'));
      
      for (const file of testFiles) {
        const content = await fs.readFile(path.join(__dirname, file), 'utf8');
        
        // Count mocks
        const mockMatches = content.match(/jest\.fn\(|jest\.mock\(/g);
        const mockCount = mockMatches ? mockMatches.length : 0;
        
        // Count assertions
        const assertMatches = content.match(/expect\(/g);
        const assertCount = assertMatches ? assertMatches.length : 0;
        
        quality.assertions += assertCount;
        
        if (mockCount === 0) {
          quality.realTests++;
        } else {
          quality.mockedTests++;
        }
      }
      
      // Determine test depth
      if (quality.realTests > quality.mockedTests * 2) {
        quality.depth = 'Deep - Mostly real tests';
      } else if (quality.realTests > quality.mockedTests) {
        quality.depth = 'Good - Balanced real and mocked';
      } else {
        quality.depth = 'Shallow - Too many mocks';
      }
      
    } catch (error) {
      console.error('Error analyzing test quality:', error);
    }
    
    return quality;
  }

  async generateReport() {
    console.log(chalk.bold.blue('\n\n' + '='.repeat(60)));
    console.log(chalk.bold.blue('         COMPREHENSIVE TEST REPORT'));
    console.log(chalk.bold.blue('='.repeat(60)));
    
    // Summary
    console.log(chalk.white('\n📈 OVERALL SUMMARY'));
    console.log(chalk.gray('─'.repeat(40)));
    console.log(`  Total Test Suites: ${Object.keys(this.results.categories).length}`);
    console.log(`  Total Tests: ${this.results.summary.total}`);
    console.log(chalk.green(`  ✅ Passed: ${this.results.summary.passed}`));
    console.log(chalk.red(`  ❌ Failed: ${this.results.summary.failed}`));
    console.log(chalk.yellow(`  ⏭️  Skipped: ${this.results.summary.skipped}`));
    console.log(`  ⏱️  Total Duration: ${(this.results.summary.duration / 1000).toFixed(2)}s`);
    
    const passRate = this.results.summary.total > 0 
      ? (this.results.summary.passed / this.results.summary.total * 100).toFixed(1)
      : 0;
    console.log(`  📊 Pass Rate: ${passRate}%`);
    
    // Category Breakdown
    console.log(chalk.white('\n📂 CATEGORY BREAKDOWN'));
    console.log(chalk.gray('─'.repeat(40)));
    
    for (const [category, data] of Object.entries(this.results.categories)) {
      const icon = data.passed ? '✅' : '❌';
      const color = data.passed ? chalk.green : chalk.red;
      console.log(color(`  ${icon} ${category.toUpperCase()}`));
      
      if (data.stats) {
        console.log(chalk.gray(`     Tests: ${data.stats.total} | Passed: ${data.stats.passed} | Failed: ${data.stats.failed}`));
      }
      
      if (data.duration) {
        console.log(chalk.gray(`     Duration: ${(data.duration / 1000).toFixed(2)}s`));
      }
      
      if (data.mutationScore !== undefined) {
        const scoreColor = data.mutationScore >= 80 ? chalk.green 
          : data.mutationScore >= 60 ? chalk.yellow 
          : chalk.red;
        console.log(scoreColor(`     Mutation Score: ${data.mutationScore}%`));
      }
    }
    
    // Test Quality Analysis
    if (this.results.quality) {
      console.log(chalk.white('\n🔍 TEST QUALITY ANALYSIS'));
      console.log(chalk.gray('─'.repeat(40)));
      console.log(`  Real Tests: ${this.results.quality.realTests}`);
      console.log(`  Mocked Tests: ${this.results.quality.mockedTests}`);
      console.log(`  Total Assertions: ${this.results.quality.assertions}`);
      console.log(`  Test Depth: ${this.results.quality.depth}`);
    }
    
    // Failures
    if (this.results.failures.length > 0) {
      console.log(chalk.red('\n⚠️  FAILURES'));
      console.log(chalk.gray('─'.repeat(40)));
      
      this.results.failures.slice(0, 5).forEach((failure, i) => {
        console.log(chalk.red(`  ${i + 1}. ${failure.suite}`));
        if (failure.title) {
          console.log(chalk.gray(`     Test: ${failure.title}`));
        }
        if (failure.message) {
          const shortMessage = failure.message.split('\n')[0].substring(0, 100);
          console.log(chalk.gray(`     Error: ${shortMessage}...`));
        }
      });
      
      if (this.results.failures.length > 5) {
        console.log(chalk.gray(`  ... and ${this.results.failures.length - 5} more`));
      }
    }
    
    // Recommendations
    console.log(chalk.white('\n💡 RECOMMENDATIONS'));
    console.log(chalk.gray('─'.repeat(40)));
    
    const recommendations = [];
    
    if (passRate < 90) {
      recommendations.push('⚠️  Pass rate below 90% - investigate failing tests');
    }
    
    if (this.results.quality?.mockedTests > this.results.quality?.realTests) {
      recommendations.push('📝 Consider replacing mocked tests with real integration tests');
    }
    
    if (this.results.categories.chaos && !this.results.categories.chaos.passed) {
      recommendations.push('🔥 Chaos tests failing - system may not be resilient to failures');
    }
    
    if (this.results.categories.load && this.results.categories.load.performance?.p95 > 1000) {
      recommendations.push('🐌 p95 latency > 1s - consider performance optimization');
    }
    
    if (this.results.categories.quality?.mutationScore < 60) {
      recommendations.push('🧬 Low mutation score - tests may not be catching bugs effectively');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('✨ Excellent! All tests are in good shape');
    }
    
    recommendations.forEach(rec => console.log(`  ${rec}`));
    
    // Final Grade
    console.log(chalk.bold.white('\n🎯 FINAL GRADE'));
    console.log(chalk.gray('─'.repeat(40)));
    
    let grade = 'F';
    let gradeColor = chalk.red;
    
    if (passRate >= 95 && this.results.quality?.depth !== 'Shallow') {
      grade = 'A+';
      gradeColor = chalk.green;
    } else if (passRate >= 90) {
      grade = 'A';
      gradeColor = chalk.green;
    } else if (passRate >= 80) {
      grade = 'B';
      gradeColor = chalk.yellow;
    } else if (passRate >= 70) {
      grade = 'C';
      gradeColor = chalk.yellow;
    } else if (passRate >= 60) {
      grade = 'D';
      gradeColor = chalk.red;
    }
    
    console.log(gradeColor.bold(`  Grade: ${grade}`));
    console.log(gradeColor(`  Pass Rate: ${passRate}%`));
    
    // Save JSON report
    const reportPath = path.join(__dirname, 'comprehensive-test-report.json');
    await fs.writeFile(reportPath, JSON.stringify(this.results, null, 2));
    console.log(chalk.gray(`\n💾 Detailed report saved to ${reportPath}`));
    
    console.log(chalk.bold.blue('\n' + '='.repeat(60)));
  }

  async run() {
    console.log(chalk.bold.blue('🚀 COMPREHENSIVE TEST SUITE'));
    console.log(chalk.gray('Starting deep test execution...'));
    
    const startTime = Date.now();
    
    // Run test suites sequentially to avoid resource conflicts
    for (const suite of this.testSuites) {
      const result = await this.runTestSuite(suite);
      
      // Update results
      this.results.categories[result.category] = result;
      this.results.summary.total += result.stats.total;
      this.results.summary.passed += result.stats.passed;
      this.results.summary.failed += result.stats.failed;
      this.results.summary.skipped += result.stats.pending;
      
      if (result.failures && result.failures.length > 0) {
        this.results.failures.push(...result.failures.map(f => ({
          ...f,
          suite: suite.name
        })));
      }
      
      // Print immediate feedback
      if (result.passed) {
        console.log(chalk.green(`✅ ${suite.name} completed successfully`));
      } else {
        console.log(chalk.red(`❌ ${suite.name} failed`));
        if (result.error) {
          console.log(chalk.gray(`   Error: ${result.error}`));
        }
      }
    }
    
    // Run mutation testing
    const mutationResult = await this.runMutationTesting();
    this.results.categories.quality = mutationResult;
    
    // Analyze test quality
    this.results.quality = await this.analyzeTestQuality();
    
    // Calculate total duration
    this.results.summary.duration = Date.now() - startTime;
    
    // Generate and print report
    await this.generateReport();
    
    // Exit with appropriate code
    const exitCode = this.results.summary.failed > 0 ? 1 : 0;
    process.exit(exitCode);
  }
}

// CLI Entry Point
async function main() {
  const runner = new ComprehensiveTestRunner();
  
  // Handle command line arguments
  const args = process.argv.slice(2);
  
  if (args.includes('--help')) {
    console.log(`
Comprehensive Test Runner

Usage: node run-comprehensive-tests.js [options]

Options:
  --help     Show this help message
  --quick    Run only essential tests (skip mutation and load tests)
  --report   Generate report without running tests

This runner executes all deep tests including:
- Real integration tests (zero mocks)
- Property-based tests
- API contract tests
- Chaos engineering tests
- Load tests
- Mutation tests

Results are saved to comprehensive-test-report.json
    `);
    process.exit(0);
  }
  
  if (args.includes('--quick')) {
    // Remove load and mutation tests for quick run
    runner.testSuites = runner.testSuites.filter(s => 
      !['load', 'mutation'].includes(s.category)
    );
  }
  
  await runner.run();
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error(chalk.red('\n❌ Fatal error:'), error);
    process.exit(1);
  });
}

module.exports = ComprehensiveTestRunner;