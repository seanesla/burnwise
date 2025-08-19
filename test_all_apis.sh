#!/bin/bash

echo "🔍 TESTING ALL API ENDPOINTS FOR REAL DATA (NO MOCKS)"
echo "======================================================"

BASE_URL="http://localhost:5001/api"

# Test each endpoint
test_endpoint() {
    local endpoint=$1
    local description=$2
    
    echo -e "\n📌 Testing: $description"
    echo "   Endpoint: $endpoint"
    
    response=$(curl -s -w "\n%{http_code}" "$BASE_URL$endpoint")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    # Check for mock indicators
    if echo "$body" | grep -q "mock\|fake\|demo\|test\|placeholder" 2>/dev/null; then
        echo "   ⚠️  WARNING: Response contains mock indicators!"
    fi
    
    # Check response
    if [ "$http_code" = "200" ]; then
        # Check if response has real data
        if echo "$body" | jq -e '.success == true' > /dev/null 2>&1; then
            count=$(echo "$body" | jq '.data | length' 2>/dev/null || echo "N/A")
            echo "   ✅ Status: $http_code - Success"
            echo "   📊 Data items: $count"
            
            # Show sample of actual data
            if [ "$count" != "N/A" ] && [ "$count" != "0" ]; then
                echo "   📄 Sample data:"
                echo "$body" | jq '.data[0]' 2>/dev/null | head -5
            fi
        else
            echo "   ❌ Status: $http_code - But no success flag"
        fi
    else
        echo "   ❌ Status: $http_code - FAILED"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
    fi
}

# Test all endpoints
test_endpoint "/farms" "Get all farms"
test_endpoint "/burn-requests" "Get burn requests"
test_endpoint "/weather/current" "Get current weather"
test_endpoint "/schedule/timeline/2025-08-18" "Get timeline for specific date"
test_endpoint "/analytics/dashboard" "Get dashboard analytics"
test_endpoint "/alerts" "Get alerts"
test_endpoint "/agents/status" "Get agent status"

echo -e "\n======================================================"
echo "✅ API Testing Complete"
