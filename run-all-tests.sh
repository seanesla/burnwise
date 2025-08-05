#!/bin/bash

# BURNWISE Comprehensive Test Suite Runner
# Executes all test categories and generates a summary report

echo "╔════════════════════════════════════════════════════╗"
echo "║     BURNWISE COMPREHENSIVE TEST SUITE RUNNER      ║"
echo "║              1,270+ Tests Across All Layers       ║"
echo "╔════════════════════════════════════════════════════╗"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Track results
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0

# Create test results directory
mkdir -p test-results
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="test-results/test-report-${TIMESTAMP}.txt"

# Function to run tests and capture results
run_test_suite() {
    local suite_name=$1
    local command=$2
    local directory=$3
    
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}Running: $suite_name${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    cd $directory
    
    # Run the test command and capture output
    if $command > temp-test-output.txt 2>&1; then
        echo -e "${GREEN}✓ $suite_name completed successfully${NC}"
        
        # Parse test results (adjust based on actual output format)
        if grep -q "passed" temp-test-output.txt; then
            local passed=$(grep -oE '[0-9]+ passed' temp-test-output.txt | grep -oE '[0-9]+' | head -1)
            local failed=$(grep -oE '[0-9]+ failed' temp-test-output.txt | grep -oE '[0-9]+' | head -1)
            local skipped=$(grep -oE '[0-9]+ skipped' temp-test-output.txt | grep -oE '[0-9]+' | head -1)
            
            PASSED_TESTS=$((PASSED_TESTS + ${passed:-0}))
            FAILED_TESTS=$((FAILED_TESTS + ${failed:-0}))
            SKIPPED_TESTS=$((SKIPPED_TESTS + ${skipped:-0}))
        fi
        
        cat temp-test-output.txt >> $REPORT_FILE
    else
        echo -e "${RED}✗ $suite_name failed${NC}"
        cat temp-test-output.txt >> $REPORT_FILE
    fi
    
    rm -f temp-test-output.txt
    cd - > /dev/null
    echo ""
}

# Start report
echo "BURNWISE Test Report - $TIMESTAMP" > $REPORT_FILE
echo "================================================" >> $REPORT_FILE
echo "" >> $REPORT_FILE

# 1. Backend Unit Tests
echo -e "${YELLOW}╔════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║        1. BACKEND UNIT TESTS           ║${NC}"
echo -e "${YELLOW}╚════════════════════════════════════════╝${NC}"
echo ""

run_test_suite "Agent Tests" "npm test -- --testPathPattern=agents" "backend"
run_test_suite "Database Tests" "npm test -- --testPathPattern=database" "backend"
run_test_suite "API Tests" "npm test -- --testPathPattern=api" "backend"
run_test_suite "Middleware Tests" "npm test -- --testPathPattern=middleware" "backend"

# 2. Backend Integration Tests
echo -e "${YELLOW}╔════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║     2. BACKEND INTEGRATION TESTS       ║${NC}"
echo -e "${YELLOW}╚════════════════════════════════════════╝${NC}"
echo ""

run_test_suite "Five-Agent Workflow" "npm test -- --testNamePattern='workflow'" "backend"
run_test_suite "Vector Operations" "npm test -- --testPathPattern=vector-operations.fixed" "backend"

# 3. Performance Tests
echo -e "${YELLOW}╔════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║        3. PERFORMANCE TESTS            ║${NC}"
echo -e "${YELLOW}╚════════════════════════════════════════╝${NC}"
echo ""

run_test_suite "Database Performance" "npm test -- --testPathPattern=performance" "backend"

# 4. Security Tests
echo -e "${YELLOW}╔════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║         4. SECURITY TESTS              ║${NC}"
echo -e "${YELLOW}╚════════════════════════════════════════╝${NC}"
echo ""

run_test_suite "Security Validation" "npm test -- --testNamePattern='security'" "backend"

# 5. Frontend Tests
echo -e "${YELLOW}╔════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║        5. FRONTEND TESTS               ║${NC}"
echo -e "${YELLOW}╚════════════════════════════════════════╝${NC}"
echo ""

run_test_suite "React Components" "npm test -- --watchAll=false" "frontend"

# 6. E2E Tests with Playwright
echo -e "${YELLOW}╔════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║          6. E2E TESTS                  ║${NC}"
echo -e "${YELLOW}╚════════════════════════════════════════╝${NC}"
echo ""

# Check if servers are running
echo "Checking if servers are running..."
if ! curl -s http://localhost:5001/health > /dev/null; then
    echo -e "${YELLOW}Starting backend server...${NC}"
    cd backend && npm run dev > ../test-results/backend-server.log 2>&1 &
    BACKEND_PID=$!
    sleep 5
fi

if ! curl -s http://localhost:3000 > /dev/null; then
    echo -e "${YELLOW}Starting frontend server...${NC}"
    cd frontend && npm start > ../test-results/frontend-server.log 2>&1 &
    FRONTEND_PID=$!
    sleep 10
fi

run_test_suite "E2E User Flows" "npx playwright test" "e2e-tests"

# 7. Generate Coverage Report
echo -e "${YELLOW}╔════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║       7. COVERAGE REPORT               ║${NC}"
echo -e "${YELLOW}╚════════════════════════════════════════╝${NC}"
echo ""

cd backend
npm test -- --coverage --coverageReporters=text > ../test-results/coverage-report.txt 2>&1
echo "Coverage report saved to test-results/coverage-report.txt"
cd ..

# Calculate totals
TOTAL_TESTS=$((PASSED_TESTS + FAILED_TESTS + SKIPPED_TESTS))

# Final Summary
echo ""
echo -e "${YELLOW}╔════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║          FINAL TEST SUMMARY            ║${NC}"
echo -e "${YELLOW}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "Total Tests Run: ${BLUE}$TOTAL_TESTS${NC}"
echo -e "Tests Passed:    ${GREEN}$PASSED_TESTS${NC}"
echo -e "Tests Failed:    ${RED}$FAILED_TESTS${NC}"
echo -e "Tests Skipped:   ${YELLOW}$SKIPPED_TESTS${NC}"
echo ""

# Calculate pass rate
if [ $TOTAL_TESTS -gt 0 ]; then
    PASS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))
    echo -e "Pass Rate: ${GREEN}$PASS_RATE%${NC}"
else
    echo -e "Pass Rate: ${RED}N/A${NC}"
fi

echo ""
echo "Detailed report saved to: $REPORT_FILE"

# Append summary to report
echo "" >> $REPORT_FILE
echo "================================================" >> $REPORT_FILE
echo "FINAL SUMMARY" >> $REPORT_FILE
echo "================================================" >> $REPORT_FILE
echo "Total Tests: $TOTAL_TESTS" >> $REPORT_FILE
echo "Passed: $PASSED_TESTS" >> $REPORT_FILE
echo "Failed: $FAILED_TESTS" >> $REPORT_FILE
echo "Skipped: $SKIPPED_TESTS" >> $REPORT_FILE
echo "Pass Rate: $PASS_RATE%" >> $REPORT_FILE

# Cleanup background processes if we started them
if [ ! -z "$BACKEND_PID" ]; then
    echo "Stopping backend server..."
    kill $BACKEND_PID 2>/dev/null
fi

if [ ! -z "$FRONTEND_PID" ]; then
    echo "Stopping frontend server..."
    kill $FRONTEND_PID 2>/dev/null
fi

echo ""
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
echo -e "${GREEN}    Test Suite Execution Complete!         ${NC}"
echo -e "${GREEN}═══════════════════════════════════════════${NC}"

# Exit with appropriate code
if [ $FAILED_TESTS -eq 0 ]; then
    exit 0
else
    exit 1
fi