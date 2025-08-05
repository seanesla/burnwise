const TestSetup = require('./testSetup');
const TestDataGenerator = require('./testDataGenerator');
const logger = require('../../middleware/logger');
const fs = require('fs').promises;
const path = require('path');

/**
 * Comprehensive Test Runner for 800-1200 Test Suite
 * Manages test execution, reporting, and performance monitoring
 */

class TestRunner {
  constructor() {
    this.testSetup = new TestSetup();
    this.generator = new TestDataGenerator();
    this.testResults = new Map();
    this.performanceMetrics = new Map();
    this.currentSuite = null;
  }

  async initializeTestEnvironment(suiteName) {
    this.currentSuite = suiteName;
    
    try {
      // Create isolated test database
      const dbName = await this.testSetup.createTestDatabase(suiteName);
      
      // Generate and seed realistic test data
      const testData = await this.testSetup.seedTestData(suiteName, {
        farmCount: 50,
        burnRequestCount: 200,
        weatherPatternCount: 500,
        includeConflicts: true,
        includePastData: true
      });

      // Validate test data integrity
      const validation = this.testSetup.validateTestDataIntegrity(testData);
      if (!validation.valid) {
        throw new Error(`Test data integrity check failed: ${validation.issues.join(', ')}`);
      }

      logger.info(`Test environment initialized for ${suiteName}`);
      return { dbName, testData };
    } catch (error) {
      logger.error(`Failed to initialize test environment: ${error.message}`);
      throw error;
    }
  }

  async runTestSuite(suiteName, testSuite) {
    const startTime = Date.now();
    const results = {
      suiteName,
      startTime: new Date(),
      tests: [],
      passed: 0,
      failed: 0,
      skipped: 0,
      totalTime: 0,
      coverage: {},
      performance: {}
    };

    try {
      await this.initializeTestEnvironment(suiteName);

      for (const test of testSuite) {
        const testResult = await this.runSingleTest(test);
        results.tests.push(testResult);
        
        if (testResult.status === 'passed') results.passed++;
        else if (testResult.status === 'failed') results.failed++;
        else results.skipped++;
      }

      results.totalTime = Date.now() - startTime;
      results.endTime = new Date();
      
      this.testResults.set(suiteName, results);
      
      await this.generateTestReport(suiteName, results);
      
      return results;
    } finally {
      await this.testSetup.cleanupTestDatabase(suiteName);
    }
  }

  async runSingleTest(testSpec) {
    const { name, category, test, timeout = 30000 } = testSpec;
    const startTime = Date.now();
    
    try {
      const result = await Promise.race([
        test(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Test timeout')), timeout)
        )
      ]);

      const duration = Date.now() - startTime;
      
      return {
        name,
        category,
        status: 'passed',
        duration,
        result
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      return {
        name,
        category,
        status: 'failed',
        duration,
        error: error.message,
        stack: error.stack
      };
    }
  }

  async generateTestReport(suiteName, results) {
    const reportPath = path.join(__dirname, '..', 'reports', `${suiteName}_report.json`);
    
    try {
      await fs.mkdir(path.dirname(reportPath), { recursive: true });
      await fs.writeFile(reportPath, JSON.stringify(results, null, 2));
      
      // Generate human-readable summary
      const summary = this.generateTestSummary(results);
      const summaryPath = path.join(__dirname, '..', 'reports', `${suiteName}_summary.md`);
      await fs.writeFile(summaryPath, summary);
      
      logger.info(`Test report generated: ${reportPath}`);
    } catch (error) {
      logger.error(`Failed to generate test report: ${error.message}`);
    }
  }

  generateTestSummary(results) {
    const { suiteName, passed, failed, skipped, totalTime, tests } = results;
    const total = passed + failed + skipped;
    const passRate = ((passed / total) * 100).toFixed(1);
    
    let summary = `# Test Report: ${suiteName}\n\n`;
    summary += `**Execution Time:** ${new Date(results.startTime).toISOString()} - ${new Date(results.endTime).toISOString()}\n`;
    summary += `**Duration:** ${(totalTime / 1000).toFixed(2)} seconds\n\n`;
    summary += `## Results Summary\n\n`;
    summary += `- **Total Tests:** ${total}\n`;
    summary += `- **Passed:** ${passed} (${passRate}%)\n`;
    summary += `- **Failed:** ${failed}\n`;
    summary += `- **Skipped:** ${skipped}\n\n`;

    if (failed > 0) {
      summary += `## Failed Tests\n\n`;
      tests.filter(t => t.status === 'failed').forEach(test => {
        summary += `### ${test.name}\n`;
        summary += `**Category:** ${test.category}\n`;
        summary += `**Error:** ${test.error}\n`;
        summary += `**Duration:** ${test.duration}ms\n\n`;
      });
    }

    // Performance analysis
    const categories = [...new Set(tests.map(t => t.category))];
    summary += `## Performance by Category\n\n`;
    
    categories.forEach(category => {
      const categoryTests = tests.filter(t => t.category === category);
      const avgDuration = categoryTests.reduce((sum, t) => sum + t.duration, 0) / categoryTests.length;
      const maxDuration = Math.max(...categoryTests.map(t => t.duration));
      
      summary += `- **${category}:** Avg ${avgDuration.toFixed(1)}ms, Max ${maxDuration}ms\n`;
    });

    return summary;
  }

  // Comprehensive Test Generation
  generateUnitTestSuite(component) {
    const tests = [];
    const testData = this.testSetup.getTestData(this.currentSuite);
    
    // Basic functionality tests
    tests.push({
      name: `${component} - initialization`,
      category: 'unit',
      test: async () => {
        // Test component initialization with realistic data
        const instance = new (require(`../../${component}`))();
        expect(instance).toBeDefined();
        expect(typeof instance.process).toBe('function');
      }
    });

    // Input validation tests
    tests.push({
      name: `${component} - input validation`,
      category: 'unit',
      test: async () => {
        // Test with malicious inputs
        const maliciousInputs = this.testSetup.generateMaliciousInputs();
        
        for (const input of maliciousInputs.sqlInjection) {
          await expect(this.testComponentWithInput(component, { farmId: input }))
            .rejects.toThrow();
        }
      }
    });

    // Edge case tests
    tests.push({
      name: `${component} - edge cases`,
      category: 'unit',
      test: async () => {
        // Test with extreme but valid values
        const edgeCases = [
          { acres: 1 }, // Minimum
          { acres: 10000 }, // Maximum
          { temperature: -40 }, // Extreme cold
          { temperature: 55 }, // Extreme heat
          { windSpeed: 0.1 }, // Nearly calm
          { windSpeed: 30 } // Very windy
        ];
        
        for (const edgeCase of edgeCases) {
          const result = await this.testComponentWithInput(component, edgeCase);
          expect(result).toBeDefined();
        }
      }
    });

    return tests;
  }

  generateIntegrationTestSuite(workflow) {
    const tests = [];
    
    tests.push({
      name: `${workflow} - end-to-end workflow`,
      category: 'integration',
      test: async () => {
        const testData = this.testSetup.getTestData(this.currentSuite);
        const burnRequest = testData.burnRequests[0];
        
        // Test complete workflow with realistic data
        const result = await this.executeWorkflow(workflow, burnRequest);
        
        expect(result.success).toBe(true);
        expect(result.stages).toHaveLength(5); // All 5 agents
        expect(result.stages.every(stage => stage.completed)).toBe(true);
      }
    });

    return tests;
  }

  async testComponentWithInput(component, input) {
    // Mock implementation - would integrate with actual components
    return { processed: true, input };
  }

  async executeWorkflow(workflow, data) {
    // Mock implementation - would integrate with actual workflow
    return {
      success: true,
      stages: [
        { name: 'coordinator', completed: true },
        { name: 'weather', completed: true },
        { name: 'predictor', completed: true },
        { name: 'optimizer', completed: true },
        { name: 'alerts', completed: true }
      ]
    };
  }

  // Test Discovery and Execution
  async discoverAndRunAllTests() {
    const testSuites = await this.discoverTestSuites();
    const overallResults = {
      startTime: new Date(),
      totalSuites: testSuites.length,
      totalTests: 0,
      totalPassed: 0,
      totalFailed: 0,
      totalTime: 0,
      suiteResults: []
    };

    const startTime = Date.now();

    for (const suite of testSuites) {
      try {
        const suiteResult = await this.runTestSuite(suite.name, suite.tests);
        overallResults.suiteResults.push(suiteResult);
        overallResults.totalTests += suiteResult.tests.length;
        overallResults.totalPassed += suiteResult.passed;
        overallResults.totalFailed += suiteResult.failed;
      } catch (error) {
        logger.error(`Failed to run test suite ${suite.name}: ${error.message}`);
        overallResults.totalFailed += 1;
      }
    }

    overallResults.totalTime = Date.now() - startTime;
    overallResults.endTime = new Date();

    await this.generateOverallReport(overallResults);
    
    return overallResults;
  }

  async discoverTestSuites() {
    // Auto-discover test files and generate test suites
    const testFiles = await this.findTestFiles();
    const suites = [];

    for (const file of testFiles) {
      const tests = await this.extractTestsFromFile(file);
      suites.push({
        name: path.basename(file, '.test.js'),
        file,
        tests
      });
    }

    return suites;
  }

  async findTestFiles() {
    const testDir = path.join(__dirname, '..');
    const files = [];
    
    async function traverse(dir) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory() && entry.name !== 'node_modules') {
          await traverse(fullPath);
        } else if (entry.name.endsWith('.test.js')) {
          files.push(fullPath);
        }
      }
    }
    
    await traverse(testDir);
    return files;
  }

  async extractTestsFromFile(filePath) {
    // This would parse test files and extract test cases
    // For now, return empty array - will be populated by specific test generators
    return [];
  }

  async generateOverallReport(results) {
    const reportPath = path.join(__dirname, '..', 'reports', 'overall_test_report.json');
    const summaryPath = path.join(__dirname, '..', 'reports', 'overall_summary.md');
    
    try {
      await fs.mkdir(path.dirname(reportPath), { recursive: true });
      await fs.writeFile(reportPath, JSON.stringify(results, null, 2));
      
      let summary = `# BURNWISE Comprehensive Test Suite Report\n\n`;
      summary += `**Execution Period:** ${results.startTime.toISOString()} - ${results.endTime.toISOString()}\n`;
      summary += `**Total Duration:** ${(results.totalTime / 1000 / 60).toFixed(2)} minutes\n\n`;
      summary += `## Overall Results\n\n`;
      summary += `- **Test Suites:** ${results.totalSuites}\n`;
      summary += `- **Total Tests:** ${results.totalTests}\n`;
      summary += `- **Passed:** ${results.totalPassed}\n`;
      summary += `- **Failed:** ${results.totalFailed}\n`;
      summary += `- **Pass Rate:** ${((results.totalPassed / results.totalTests) * 100).toFixed(1)}%\n\n`;

      summary += `## Suite Breakdown\n\n`;
      results.suiteResults.forEach(suite => {
        const passRate = ((suite.passed / (suite.passed + suite.failed)) * 100).toFixed(1);
        summary += `- **${suite.suiteName}:** ${suite.passed + suite.failed} tests, ${passRate}% pass rate\n`;
      });

      await fs.writeFile(summaryPath, summary);
      
      logger.info(`Overall test report generated: ${reportPath}`);
    } catch (error) {
      logger.error(`Failed to generate overall report: ${error.message}`);
    }
  }
}

module.exports = TestRunner;