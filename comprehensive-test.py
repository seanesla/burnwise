#!/usr/bin/env python3
"""
Comprehensive BURNWISE System Test
Tests all components systematically with mathematical verification
"""

import requests
import json
import math
import numpy as np
from datetime import datetime, timedelta
import time
import sys

BASE_URL = "http://localhost:5001"
FRONTEND_URL = "http://localhost:3000"

class BurnwiseSystemTest:
    def __init__(self):
        self.results = {
            "passed": [],
            "failed": [],
            "warnings": []
        }
        
    def log_result(self, test_name, passed, details=""):
        if passed:
            self.results["passed"].append(test_name)
            print(f"✅ {test_name}")
        else:
            self.results["failed"].append((test_name, details))
            print(f"❌ {test_name}: {details}")
    
    def test_backend_health(self):
        """Test backend health endpoint"""
        try:
            resp = requests.get(f"{BASE_URL}/health")
            data = resp.json()
            
            # Check all agents are active
            agents = data.get("agents", {})
            all_active = all(status == "active" for status in agents.values())
            
            self.log_result(
                "Backend Health Check",
                resp.status_code == 200 and all_active,
                f"Status: {resp.status_code}, Agents: {agents}"
            )
            return resp.status_code == 200
        except Exception as e:
            self.log_result("Backend Health Check", False, str(e))
            return False
    
    def test_gaussian_plume_math(self):
        """Verify Gaussian plume calculations"""
        try:
            # Test parameters
            test_data = {
                "emissionRate": 1.0,  # kg/s
                "windSpeed": 5.0,     # m/s
                "windDirection": 0,
                "sourceHeight": 2.0,  # meters
                "receptorDistance": 1000,  # meters
                "stabilityClass": "D"
            }
            
            resp = requests.post(
                f"{BASE_URL}/api/predictor/gaussian-plume",
                json=test_data
            )
            
            if resp.status_code != 200:
                self.log_result("Gaussian Plume API", False, f"Status: {resp.status_code}")
                return False
            
            result = resp.json()
            concentration = result.get("concentration", 0)
            
            # Verify the math manually
            # Stability class D parameters
            a, b, c, d = 68.0, 0.894, 33.2, 0.725  # Approximations for class D
            
            x = test_data["receptorDistance"]
            sigma_y = a * (x / 1000) ** b
            sigma_z = c * (x / 1000) ** d
            
            # Gaussian plume equation (simplified for ground-level, centerline)
            Q = test_data["emissionRate"] * 1e6  # Convert to µg/s
            u = test_data["windSpeed"]
            H = test_data["sourceHeight"]
            
            expected = (Q / (math.pi * u * sigma_y * sigma_z)) * \
                      math.exp(-0.5 * (H / sigma_z) ** 2)
            
            # Check if within reasonable range (20% tolerance due to approximations)
            tolerance = 0.2
            ratio = concentration / expected if expected > 0 else 0
            within_range = 0.8 <= ratio <= 1.2
            
            self.log_result(
                "Gaussian Plume Math Verification",
                within_range,
                f"Calculated: {concentration:.2f}, Expected: {expected:.2f}, Ratio: {ratio:.2f}"
            )
            
            return within_range
            
        except Exception as e:
            self.log_result("Gaussian Plume Math Verification", False, str(e))
            return False
    
    def test_simulated_annealing_convergence(self):
        """Test that simulated annealing algorithm converges"""
        try:
            # Create test burn requests
            tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
            
            resp = requests.post(
                f"{BASE_URL}/api/schedule/optimize",
                json={"date": tomorrow}
            )
            
            if resp.status_code != 200:
                self.log_result("Simulated Annealing API", False, f"Status: {resp.status_code}")
                return False
            
            data = resp.json()
            
            # Check if optimization completed
            success = data.get("success", False)
            optimization_result = data.get("data", {}).get("optimization_result", {})
            
            # Verify convergence metrics
            metrics = optimization_result.get("metrics", {})
            has_metrics = len(metrics) > 0
            
            self.log_result(
                "Simulated Annealing Convergence",
                success and has_metrics,
                f"Success: {success}, Metrics: {metrics}"
            )
            
            return success
            
        except Exception as e:
            self.log_result("Simulated Annealing Convergence", False, str(e))
            return False
    
    def test_api_endpoints(self):
        """Test all critical API endpoints"""
        endpoints = [
            ("GET", "/api/farms", None),
            ("GET", "/api/weather/current?lat=38.5&lng=-121.7", None),
            ("GET", f"/api/schedule/{datetime.now().strftime('%Y-%m-%d')}", None),
            ("GET", "/api/analytics/burn-statistics", None),
            ("POST", "/api/agents/workflow", {
                "message": "Test message",
                "conversationId": "test-123",
                "userId": 1
            }),
            ("POST", "/api/predictor/conflict-check", {
                "location": {"lat": 38.5, "lng": -121.7},
                "date": datetime.now().strftime("%Y-%m-%d")
            })
        ]
        
        all_passed = True
        for method, endpoint, data in endpoints:
            try:
                if method == "GET":
                    resp = requests.get(f"{BASE_URL}{endpoint}")
                else:
                    resp = requests.post(f"{BASE_URL}{endpoint}", json=data)
                
                passed = resp.status_code in [200, 201]
                self.log_result(
                    f"API {method} {endpoint}",
                    passed,
                    f"Status: {resp.status_code}"
                )
                all_passed = all_passed and passed
                
            except Exception as e:
                self.log_result(f"API {method} {endpoint}", False, str(e))
                all_passed = False
        
        return all_passed
    
    def test_websocket_connection(self):
        """Test WebSocket connectivity"""
        try:
            import websocket
            
            ws = websocket.create_connection("ws://localhost:5001/socket.io/?EIO=4&transport=websocket")
            ws.close()
            
            self.log_result("WebSocket Connection", True)
            return True
            
        except ImportError:
            self.results["warnings"].append("WebSocket test skipped - install websocket-client")
            print("⚠️  WebSocket test skipped - install websocket-client")
            return None
        except Exception as e:
            self.log_result("WebSocket Connection", False, str(e))
            return False
    
    def test_frontend_availability(self):
        """Test frontend is accessible"""
        try:
            resp = requests.get(FRONTEND_URL)
            passed = resp.status_code == 200 and "BURNWISE" in resp.text
            
            self.log_result(
                "Frontend Availability",
                passed,
                f"Status: {resp.status_code}"
            )
            return passed
            
        except Exception as e:
            self.log_result("Frontend Availability", False, str(e))
            return False
    
    def test_database_queries(self):
        """Test database is responsive via API"""
        try:
            # Test farms endpoint which queries database
            resp = requests.get(f"{BASE_URL}/api/farms")
            
            if resp.status_code != 200:
                self.log_result("Database Query Test", False, f"Status: {resp.status_code}")
                return False
            
            data = resp.json()
            has_data = "farms" in data or "data" in data or isinstance(data, list)
            
            self.log_result(
                "Database Query Test",
                has_data,
                f"Response type: {type(data).__name__}"
            )
            return has_data
            
        except Exception as e:
            self.log_result("Database Query Test", False, str(e))
            return False
    
    def test_agent_workflow(self):
        """Test 5-agent workflow integration"""
        try:
            test_message = "I need to schedule a burn for tomorrow at my farm"
            
            resp = requests.post(
                f"{BASE_URL}/api/agents/workflow",
                json={
                    "message": test_message,
                    "conversationId": f"test-{int(time.time())}",
                    "userId": 1,
                    "burnData": {
                        "acres": 100,
                        "crop_type": "wheat",
                        "field_boundary": {
                            "type": "Polygon",
                            "coordinates": [[
                                [-121.7, 38.5],
                                [-121.7, 38.6],
                                [-121.6, 38.6],
                                [-121.6, 38.5],
                                [-121.7, 38.5]
                            ]]
                        }
                    }
                }
            )
            
            passed = resp.status_code == 200
            
            if passed:
                data = resp.json()
                # Check for agent handoffs
                has_agents = "currentAgent" in data or "agent" in data or "nextAgent" in data
                passed = has_agents
            
            self.log_result(
                "5-Agent Workflow Integration",
                passed,
                f"Status: {resp.status_code}"
            )
            return passed
            
        except Exception as e:
            self.log_result("5-Agent Workflow Integration", False, str(e))
            return False
    
    def run_all_tests(self):
        """Run all tests and generate report"""
        print("\n" + "="*60)
        print("BURNWISE COMPREHENSIVE SYSTEM TEST")
        print("="*60 + "\n")
        
        # Run tests in order
        tests = [
            ("Backend Services", self.test_backend_health),
            ("Frontend Services", self.test_frontend_availability),
            ("Database Connectivity", self.test_database_queries),
            ("API Endpoints", self.test_api_endpoints),
            ("Gaussian Plume Mathematics", self.test_gaussian_plume_math),
            ("Simulated Annealing Algorithm", self.test_simulated_annealing_convergence),
            ("5-Agent Workflow", self.test_agent_workflow),
            ("WebSocket Real-time", self.test_websocket_connection)
        ]
        
        print("Running tests...\n")
        
        for test_name, test_func in tests:
            print(f"\n{test_name}:")
            print("-" * 40)
            test_func()
        
        # Generate report
        print("\n" + "="*60)
        print("TEST RESULTS SUMMARY")
        print("="*60)
        
        total_tests = len(self.results["passed"]) + len(self.results["failed"])
        pass_rate = (len(self.results["passed"]) / total_tests * 100) if total_tests > 0 else 0
        
        print(f"\n✅ Passed: {len(self.results['passed'])}")
        print(f"❌ Failed: {len(self.results['failed'])}")
        print(f"⚠️  Warnings: {len(self.results['warnings'])}")
        print(f"\nPass Rate: {pass_rate:.1f}%")
        
        if self.results["failed"]:
            print("\nFailed Tests:")
            for test, details in self.results["failed"]:
                print(f"  - {test}: {details}")
        
        if self.results["warnings"]:
            print("\nWarnings:")
            for warning in self.results["warnings"]:
                print(f"  - {warning}")
        
        # Return exit code
        return 0 if len(self.results["failed"]) == 0 else 1

if __name__ == "__main__":
    tester = BurnwiseSystemTest()
    exit_code = tester.run_all_tests()
    sys.exit(exit_code)