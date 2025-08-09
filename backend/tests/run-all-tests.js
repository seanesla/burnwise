#!/usr/bin/env node

/**
 * BURNWISE Ultra-Deep Testing Suite Runner
 * 
 * Executes all comprehensive test suites and provides detailed reporting.
 * This script runs the complete battery of tests designed to ensure
 * the system is production-ready and handles all edge cases.
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

class TestRunner {
  constructor() {
    this.testSuites = [
      {
        name: 'Vector Generation Tests',
        file: 'vector-generation.test.js',
        description: 'Tests all vector generation functions with edge cases',
        timeout: 120000 // 2 minutes
      },
      {
        name: 'Edge Case Tests', 
        file: 'edge-cases.test.js',
        description: 'Tests extreme edge cases and boundary conditions',
        timeout: 180000 // 3 minutes
      },
      {
        name: 'Concurrent Load Tests',
        file: 'concurrent-load.test.js', 
        description: 'Tests system under heavy concurrent load',
        timeout: 300000 // 5 minutes
      },
      {
        name: 'Vector Similarity Tests',
        file: 'vector-similarity.test.js',
        description: 'Tests TiDB vector operations and similarity search',
        timeout: 120000 // 2 minutes
      },
      {
        name: 'End-to-End Workflow Tests',
        file: 'e2e-workflow.test.js',
        description: 'Tests complete 5-agent workflow execution',
        timeout: 240000 // 4 minutes
      },
      {
        name: 'Performance Benchmark Tests',
        file: 'performance-benchmark.test.js',
        description: 'Benchmarks system performance and response times',
        timeout: 180000 // 3 minutes
      },
      {
        name: 'Database Constraint Tests',
        file: 'database-constraints.test.js',
        description: 'Tests database constraints and data integrity',
        timeout: 120000 // 2 minutes
      }
    ];
    
    this.results = [];
    this.startTime = null;
    this.endTime = null;
  }

  async runAllTests() {
    console.log('🔥 BURNWISE Ultra-Deep Testing Suite');
    console.log('=====================================\n');
    
    this.startTime = performance.now();
    
    // Check prerequisites
    await this.checkPrerequisites();
    
    // Run each test suite
    for (const suite of this.testSuites) {
      await this.runTestSuite(suite);
    }
    
    this.endTime = performance.now();
    
    // Generate comprehensive report
    this.generateReport();
  }

  async checkPrerequisites() {
    console.log('🔍 Checking Prerequisites...\n');
    
    const checks = [
      {
        name: 'Node.js Version',
        check: () => {
          const version = process.version;
          const majorVersion = parseInt(version.slice(1).split('.')[0]);
          return { passed: majorVersion >= 14, details: version };
        }
      },
      {
        name: 'Required Dependencies',
        check: () => {
          try {
            require('jest');
            require('supertest');
            require('../db/connection');
            return { passed: true, details: 'All dependencies available' };
          } catch (error) {
            return { passed: false, details: error.message };
          }
        }
      },
      {
        name: 'Environment Variables',
        check: () => {
          const required = ['TIDB_HOST', 'TIDB_USER', 'TIDB_PASSWORD', 'TIDB_DATABASE'];
          const missing = required.filter(env => !process.env[env]);
          return { 
            passed: missing.length === 0, 
            details: missing.length > 0 ? `Missing: ${missing.join(', ')}` : 'All environment variables set'
          };
        }
      },
      {
        name: 'Database Connection',
        check: async () => {
          try {
            const { initializeDatabase } = require('../db/connection');
            await initializeDatabase();
            return { passed: true, details: 'Database connection successful' };
          } catch (error) {
            return { passed: false, details: error.message };
          }
        }
      },
      {
        name: 'Server Startup',
        check: () => {
          try {
            require('../server');
            return { passed: true, details: 'Server module loads successfully' };
          } catch (error) {
            return { passed: false, details: error.message };
          }
        }
      }
    ];

    for (const check of checks) {
      const result = await check.check();
      console.log(`   ${result.passed ? '✅' : '❌'} ${check.name}: ${result.details}`);
      
      if (!result.passed) {
        console.error(`\n❌ Prerequisite check failed: ${check.name}`);
        console.error(`   Details: ${result.details}\n`);
        process.exit(1);
      }
    }
    
    console.log('\n✅ All prerequisites met\n');
  }

  async runTestSuite(suite) {
    console.log(`\n🧪 Running ${suite.name}...`);
    console.log(`   Description: ${suite.description}`);
    console.log(`   Timeout: ${suite.timeout / 1000}s`);
    console.log(`   File: ${suite.file}`);
    
    const startTime = performance.now();
    
    try {
      // Run Jest for this specific test file
      const jestCommand = [
        'npx', 'jest',
        `tests/${suite.file}`,
        '--verbose',
        '--no-cache',
        '--runInBand', // Run tests serially to avoid conflicts
        `--testTimeout=${suite.timeout}`,
        '--detectOpenHandles',
        '--forceExit'
      ];

      const result = await this.executeCommand(jestCommand, suite.timeout);
      const endTime = performance.now();
      const duration = endTime - startTime;

      const suiteResult = {
        name: suite.name,
        file: suite.file,
        duration,
        passed: result.success,
        output: result.output,
        error: result.error
      };

      this.results.push(suiteResult);

      if (result.success) {
        console.log(`   ✅ ${suite.name} completed successfully in ${(duration / 1000).toFixed(2)}s`);
      } else {
        console.log(`   ❌ ${suite.name} failed after ${(duration / 1000).toFixed(2)}s`);
        console.log(`   Error: ${result.error}`);
      }

    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;

      this.results.push({
        name: suite.name,
        file: suite.file,
        duration,
        passed: false,
        output: '',
        error: error.message
      });

      console.log(`   ❌ ${suite.name} failed with exception after ${(duration / 1000).toFixed(2)}s`);
      console.log(`   Exception: ${error.message}`);
    }
  }

  executeCommand(command, timeout) {
    return new Promise((resolve, reject) => {
      const process = spawn(command[0], command.slice(1), {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: timeout
      });

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        resolve({
          success: code === 0,
          output: stdout,
          error: stderr,
          exitCode: code
        });
      });

      process.on('error', (error) => {
        reject(error);
      });

      // Handle timeout
      setTimeout(() => {
        if (!process.killed) {
          process.kill('SIGTERM');
          reject(new Error(`Test suite timed out after ${timeout / 1000}s`));
        }
      }, timeout);
    });
  }

  generateReport() {
    const totalDuration = this.endTime - this.startTime;
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => r.passed === false).length;
    const successRate = (passed / this.results.length) * 100;

    console.log('\n' + '='.repeat(80));
    console.log('🔥 BURNWISE ULTRA-DEEP TESTING SUITE REPORT');
    console.log('='.repeat(80));
    
    console.log(`\n📊 SUMMARY:`);
    console.log(`   Total Test Suites: ${this.results.length}`);
    console.log(`   Passed: ${passed}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Success Rate: ${successRate.toFixed(1)}%`);
    console.log(`   Total Duration: ${(totalDuration / 1000 / 60).toFixed(2)} minutes`);
    
    console.log(`\n📋 DETAILED RESULTS:`);
    this.results.forEach((result, index) => {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      const duration = (result.duration / 1000).toFixed(2);
      
      console.log(`\n   ${index + 1}. ${result.name}`);
      console.log(`      Status: ${status}`);
      console.log(`      Duration: ${duration}s`);
      console.log(`      File: ${result.file}`);
      
      if (!result.passed) {
        console.log(`      Error: ${result.error.substring(0, 200)}${result.error.length > 200 ? '...' : ''}`);
      }
    });

    // Performance Analysis
    console.log(`\n⚡ PERFORMANCE ANALYSIS:`);
    const avgDuration = this.results.reduce((sum, r) => sum + r.duration, 0) / this.results.length;
    const slowestSuite = this.results.reduce((prev, current) => 
      prev.duration > current.duration ? prev : current
    );
    const fastestSuite = this.results.reduce((prev, current) => 
      prev.duration < current.duration ? prev : current
    );

    console.log(`   Average suite duration: ${(avgDuration / 1000).toFixed(2)}s`);
    console.log(`   Slowest suite: ${slowestSuite.name} (${(slowestSuite.duration / 1000).toFixed(2)}s)`);
    console.log(`   Fastest suite: ${fastestSuite.name} (${(fastestSuite.duration / 1000).toFixed(2)}s)`);

    // Test Coverage Analysis
    console.log(`\n🎯 TEST COVERAGE ANALYSIS:`);
    const coverageAreas = {
      'Vector Operations': ['Vector Generation Tests', 'Vector Similarity Tests'],
      'System Reliability': ['Edge Case Tests', 'Concurrent Load Tests'],
      'Workflow Integrity': ['End-to-End Workflow Tests'],
      'Performance': ['Performance Benchmark Tests'],
      'Data Integrity': ['Database Constraint Tests']
    };

    Object.entries(coverageAreas).forEach(([area, suites]) => {
      const coveredSuites = this.results.filter(r => suites.includes(r.name));
      const passedInArea = coveredSuites.filter(r => r.passed).length;
      const totalInArea = coveredSuites.length;
      const areaCoverage = totalInArea > 0 ? (passedInArea / totalInArea) * 100 : 0;
      
      console.log(`   ${area}: ${passedInArea}/${totalInArea} (${areaCoverage.toFixed(1)}%)`);
    });

    // System Readiness Assessment
    console.log(`\n🚀 SYSTEM READINESS ASSESSMENT:`);
    
    const readinessFactors = [
      { name: 'Core Functionality', weight: 0.3, passed: this.results.find(r => r.name.includes('End-to-End'))?.passed || false },
      { name: 'Performance', weight: 0.25, passed: this.results.find(r => r.name.includes('Performance'))?.passed || false },
      { name: 'Reliability', weight: 0.2, passed: this.results.find(r => r.name.includes('Concurrent Load'))?.passed || false },
      { name: 'Data Integrity', weight: 0.15, passed: this.results.find(r => r.name.includes('Database'))?.passed || false },
      { name: 'Edge Case Handling', weight: 0.1, passed: this.results.find(r => r.name.includes('Edge Case'))?.passed || false }
    ];

    let readinessScore = 0;
    readinessFactors.forEach(factor => {
      const score = factor.passed ? factor.weight * 100 : 0;
      readinessScore += score;
      console.log(`   ${factor.name}: ${factor.passed ? '✅' : '❌'} (${score.toFixed(1)}%)`);
    });

    console.log(`\n🎯 OVERALL READINESS SCORE: ${readinessScore.toFixed(1)}%`);
    
    if (readinessScore >= 90) {
      console.log(`   🎉 EXCELLENT - System is production-ready!`);
    } else if (readinessScore >= 75) {
      console.log(`   ✅ GOOD - System is mostly ready with minor issues`);
    } else if (readinessScore >= 50) {
      console.log(`   ⚠️ FAIR - System needs improvements before production`);
    } else {
      console.log(`   ❌ POOR - System requires significant fixes`);
    }

    // Recommendations
    console.log(`\n💡 RECOMMENDATIONS:`);
    const failedSuites = this.results.filter(r => !r.passed);
    
    if (failedSuites.length === 0) {
      console.log(`   🎊 All tests passed! System is ready for production deployment.`);
      console.log(`   📈 Consider implementing continuous integration to maintain quality.`);
      console.log(`   🔍 Monitor system performance in production environment.`);
    } else {
      console.log(`   🔧 Fix failed test suites before production deployment:`);
      failedSuites.forEach(suite => {
        console.log(`      - ${suite.name}: Address the issues in ${suite.file}`);
      });
      
      if (failedSuites.some(s => s.name.includes('End-to-End'))) {
        console.log(`   ⚠️ CRITICAL: Core workflow functionality is failing - must fix before deployment`);
      }
      
      if (failedSuites.some(s => s.name.includes('Performance'))) {
        console.log(`   📊 Performance issues detected - optimize before high-load deployment`);
      }
      
      if (failedSuites.some(s => s.name.includes('Database'))) {
        console.log(`   🗄️ Database integrity issues - verify schema and constraints`);
      }
    }

    // Write detailed report to file
    this.writeReportToFile();

    console.log(`\n📄 Detailed report written to: test-results-${new Date().toISOString().slice(0, 10)}.json`);
    console.log('\n' + '='.repeat(80));
  }

  writeReportToFile() {
    const reportData = {
      timestamp: new Date().toISOString(),
      summary: {
        totalSuites: this.results.length,
        passed: this.results.filter(r => r.passed).length,
        failed: this.results.filter(r => !r.passed).length,
        successRate: (this.results.filter(r => r.passed).length / this.results.length) * 100,
        totalDuration: this.endTime - this.startTime
      },
      results: this.results.map(r => ({
        name: r.name,
        file: r.file,
        passed: r.passed,
        duration: r.duration,
        error: r.error
      })),
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        memory: process.memoryUsage()
      }
    };

    const filename = `test-results-${new Date().toISOString().slice(0, 10)}.json`;
    fs.writeFileSync(filename, JSON.stringify(reportData, null, 2));
  }
}

// CLI Interface
if (require.main === module) {
  const runner = new TestRunner();
  
  runner.runAllTests()
    .then(() => {
      const successRate = (runner.results.filter(r => r.passed).length / runner.results.length) * 100;
      process.exit(successRate >= 75 ? 0 : 1); // Exit with error if less than 75% success
    })
    .catch((error) => {
      console.error('❌ Test runner failed:', error.message);
      process.exit(1);
    });
}

module.exports = TestRunner;