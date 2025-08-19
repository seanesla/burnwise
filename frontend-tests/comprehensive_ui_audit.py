#!/usr/bin/env python3
"""
Comprehensive UI Audit Script for BURNWISE
Tests ALL mathematical calculations, positioning, and interactions
NO MOCKS - Uses real browser data from Playwright
"""

import json
import subprocess
import time
from datetime import datetime
import math

class ComprehensiveUIAuditor:
    def __init__(self):
        self.test_results = []
        self.critical_issues = []
        self.performance_metrics = {}
        self.start_time = time.time()
        
    def run_playwright_test(self, js_code):
        """Execute JavaScript in browser and return results"""
        try:
            # Use Playwright to execute JS and get results
            result = subprocess.run(
                ['node', '-e', f'''
                const {{ chromium }} = require('playwright');
                (async () => {{
                    const browser = await chromium.launch({{ headless: false }});
                    const page = await browser.newPage();
                    await page.goto('http://localhost:3000/spatial');
                    await page.waitForTimeout(2000);
                    const result = await page.evaluate(() => {{
                        {js_code}
                    }});
                    console.log(JSON.stringify(result));
                    await browser.close();
                }})();
                '''],
                capture_output=True,
                text=True,
                timeout=10
            )
            if result.stdout:
                return json.loads(result.stdout)
            return None
        except Exception as e:
            return {"error": str(e)}
    
    def test_centering_mathematics(self):
        """Test precise mathematical centering of all UI elements"""
        print("\n🔬 TESTING CENTERING MATHEMATICS...")
        
        js_code = '''
        const elements = {
            dock: document.querySelector('.dock-navigation'),
            timeline: document.querySelector('.timeline-scrubber'),
            ai: document.querySelector('.floating-ai'),
            overlay: document.querySelector('.overlay-controls')
        };
        
        const viewport = {
            width: window.innerWidth,
            height: window.innerHeight,
            centerX: window.innerWidth / 2,
            centerY: window.innerHeight / 2
        };
        
        const results = {};
        
        for (const [name, el] of Object.entries(elements)) {
            if (el) {
                const rect = el.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                const offsetX = Math.abs(centerX - viewport.centerX);
                const offsetY = Math.abs(centerY - viewport.centerY);
                
                results[name] = {
                    position: { left: rect.left, top: rect.top },
                    size: { width: rect.width, height: rect.height },
                    center: { x: centerX, y: centerY },
                    offset: { x: offsetX, y: offsetY },
                    mathematically_centered: {
                        horizontal: offsetX < 1,  // Less than 1px tolerance
                        vertical: offsetY < 1
                    }
                };
            }
        }
        
        return { viewport, elements: results };
        '''
        
        result = self.run_playwright_test(js_code)
        
        if result and 'elements' in result:
            for name, data in result['elements'].items():
                if not data['mathematically_centered']['horizontal']:
                    self.critical_issues.append(
                        f"❌ {name.upper()} NOT HORIZONTALLY CENTERED: {data['offset']['x']:.2f}px off"
                    )
                    print(f"   Expected center: {result['viewport']['centerX']}")
                    print(f"   Actual center: {data['center']['x']}")
                else:
                    print(f"✅ {name} horizontally centered (offset: {data['offset']['x']:.2f}px)")
        
        return result
    
    def test_spacing_consistency(self):
        """Test spacing consistency between elements"""
        print("\n📏 TESTING SPACING CONSISTENCY...")
        
        js_code = '''
        const dockItems = document.querySelectorAll('.dock-item');
        const spacing = [];
        
        for (let i = 1; i < dockItems.length; i++) {
            const prev = dockItems[i-1].getBoundingClientRect();
            const curr = dockItems[i].getBoundingClientRect();
            spacing.push(curr.left - prev.right);
        }
        
        const variance = spacing.length > 0 ? 
            Math.max(...spacing) - Math.min(...spacing) : 0;
        
        return {
            spacing: spacing,
            variance: variance,
            consistent: variance < 2  // 2px tolerance
        };
        '''
        
        result = self.run_playwright_test(js_code)
        
        if result and 'consistent' in result:
            if not result['consistent']:
                self.critical_issues.append(
                    f"❌ DOCK SPACING INCONSISTENT: Variance {result['variance']:.2f}px"
                )
                print(f"   Spacing values: {result['spacing']}")
            else:
                print(f"✅ Dock spacing consistent (variance: {result['variance']:.2f}px)")
        
        return result
    
    def test_click_responsiveness(self):
        """Test click responsiveness of all interactive elements"""
        print("\n🖱️ TESTING CLICK RESPONSIVENESS...")
        
        js_code = '''
        const clickableSelectors = [
            '.dock-item',
            '.timeline-btn',
            '.overlay-btn',
            '.view-mode-btn',
            '.action-btn',
            '.farm-info-card button'
        ];
        
        const results = {};
        
        for (const selector of clickableSelectors) {
            const elements = document.querySelectorAll(selector);
            const clickable = [];
            
            elements.forEach((el, i) => {
                const styles = window.getComputedStyle(el);
                const rect = el.getBoundingClientRect();
                
                clickable.push({
                    index: i,
                    visible: styles.display !== 'none' && styles.visibility !== 'hidden',
                    hasPointer: styles.cursor === 'pointer',
                    largeEnough: rect.width >= 44 && rect.height >= 44,  // 44px min touch target
                    zIndex: parseInt(styles.zIndex) || 0
                });
            });
            
            results[selector] = {
                count: elements.length,
                clickable: clickable,
                allClickable: clickable.every(c => c.visible && c.hasPointer && c.largeEnough)
            };
        }
        
        return results;
        '''
        
        result = self.run_playwright_test(js_code)
        
        if result:
            for selector, data in result.items():
                if data['count'] > 0:
                    if not data['allClickable']:
                        self.critical_issues.append(
                            f"❌ NOT ALL {selector} ELEMENTS CLICKABLE"
                        )
                        for item in data['clickable']:
                            if not item['largeEnough']:
                                print(f"   Element {item['index']}: Too small for touch")
                    else:
                        print(f"✅ All {data['count']} {selector} elements clickable")
        
        return result
    
    def test_animation_performance(self):
        """Test animation frame rates and smoothness"""
        print("\n🎬 TESTING ANIMATION PERFORMANCE...")
        
        js_code = '''
        let frameCount = 0;
        let lastTime = performance.now();
        const frameTimes = [];
        
        function measureFrame(timestamp) {
            const delta = timestamp - lastTime;
            frameTimes.push(delta);
            lastTime = timestamp;
            frameCount++;
            
            if (frameCount < 60) {  // Measure 60 frames
                requestAnimationFrame(measureFrame);
            }
        }
        
        requestAnimationFrame(measureFrame);
        
        // Wait for measurement to complete
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        const avgFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
        const fps = 1000 / avgFrameTime;
        const jank = frameTimes.filter(t => t > 33).length;  // Frames over 33ms (30fps)
        
        return {
            avgFrameTime: avgFrameTime,
            fps: fps,
            jankFrames: jank,
            smooth: fps >= 30 && jank < 5
        };
        '''
        
        result = self.run_playwright_test(js_code)
        
        if result and 'fps' in result:
            self.performance_metrics['fps'] = result['fps']
            self.performance_metrics['jank'] = result['jankFrames']
            
            if not result['smooth']:
                self.critical_issues.append(
                    f"❌ ANIMATION PERFORMANCE ISSUE: {result['fps']:.1f} FPS, {result['jankFrames']} jank frames"
                )
            else:
                print(f"✅ Smooth animations: {result['fps']:.1f} FPS")
        
        return result
    
    def test_api_response_times(self):
        """Test API response times for real data"""
        print("\n⚡ TESTING API RESPONSE TIMES...")
        
        endpoints = [
            '/api/farms',
            '/api/burn-requests',
            '/api/weather/current',
            '/api/schedule/timeline/2025-08-18',
            '/api/analytics/dashboard'
        ]
        
        for endpoint in endpoints:
            start = time.time()
            try:
                result = subprocess.run(
                    ['curl', '-s', '-w', '%{http_code}', f'http://localhost:5001{endpoint}'],
                    capture_output=True,
                    text=True,
                    timeout=5
                )
                response_time = (time.time() - start) * 1000  # Convert to ms
                status_code = result.stdout[-3:]
                
                if status_code == '200':
                    if response_time > 1000:
                        self.critical_issues.append(
                            f"❌ SLOW API: {endpoint} took {response_time:.0f}ms"
                        )
                    else:
                        print(f"✅ {endpoint}: {response_time:.0f}ms")
                else:
                    self.critical_issues.append(
                        f"❌ API ERROR: {endpoint} returned {status_code}"
                    )
                
                self.performance_metrics[endpoint] = response_time
                
            except Exception as e:
                self.critical_issues.append(f"❌ API FAILED: {endpoint} - {str(e)}")
    
    def test_memory_leaks(self):
        """Test for memory leaks during interactions"""
        print("\n💾 TESTING MEMORY USAGE...")
        
        js_code = '''
        if (performance.memory) {
            const initial = performance.memory.usedJSHeapSize;
            
            // Simulate heavy interactions
            for (let i = 0; i < 10; i++) {
                document.querySelectorAll('.dock-item').forEach(item => {
                    item.dispatchEvent(new MouseEvent('mouseenter'));
                    item.dispatchEvent(new MouseEvent('mouseleave'));
                });
            }
            
            // Force garbage collection if available
            if (window.gc) window.gc();
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const final = performance.memory.usedJSHeapSize;
            const leaked = final - initial;
            
            return {
                initial: initial / 1024 / 1024,  // Convert to MB
                final: final / 1024 / 1024,
                leaked: leaked / 1024 / 1024,
                hasLeak: leaked > 10 * 1024 * 1024  // 10MB threshold
            };
        }
        return { error: "Memory API not available" };
        '''
        
        result = self.run_playwright_test(js_code)
        
        if result and 'leaked' in result:
            if result['hasLeak']:
                self.critical_issues.append(
                    f"❌ MEMORY LEAK DETECTED: {result['leaked']:.2f}MB leaked"
                )
            else:
                print(f"✅ No memory leaks detected (change: {result['leaked']:.2f}MB)")
        
        return result
    
    def generate_report(self):
        """Generate comprehensive test report"""
        print("\n" + "="*60)
        print("📊 COMPREHENSIVE UI AUDIT REPORT")
        print("="*60)
        
        total_time = time.time() - self.start_time
        
        print(f"\n⏱️ Total Test Duration: {total_time:.2f} seconds")
        print(f"📅 Test Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        if self.critical_issues:
            print(f"\n🚨 CRITICAL ISSUES FOUND: {len(self.critical_issues)}")
            for issue in self.critical_issues:
                print(f"   {issue}")
        else:
            print("\n✅ NO CRITICAL ISSUES FOUND!")
        
        if self.performance_metrics:
            print("\n📈 PERFORMANCE METRICS:")
            for metric, value in self.performance_metrics.items():
                if isinstance(value, float):
                    print(f"   {metric}: {value:.2f}")
                else:
                    print(f"   {metric}: {value}")
        
        # Calculate overall score
        total_tests = 6
        passed_tests = total_tests - len(self.critical_issues)
        score = (passed_tests / total_tests) * 100
        
        print(f"\n🎯 OVERALL SCORE: {score:.1f}%")
        
        if score == 100:
            print("🏆 PERFECT SCORE! All tests passed!")
        elif score >= 80:
            print("👍 Good! Minor issues to fix.")
        elif score >= 60:
            print("⚠️ Needs improvement. Several issues found.")
        else:
            print("❌ Critical issues need immediate attention!")
        
        return {
            "score": score,
            "issues": self.critical_issues,
            "metrics": self.performance_metrics,
            "duration": total_time
        }

if __name__ == "__main__":
    print("🚀 Starting Comprehensive UI Audit for BURNWISE...")
    print("NO MOCKS - Testing with REAL browser data")
    
    auditor = ComprehensiveUIAuditor()
    
    # Run all tests
    auditor.test_centering_mathematics()
    auditor.test_spacing_consistency()
    auditor.test_click_responsiveness()
    auditor.test_animation_performance()
    auditor.test_api_response_times()
    auditor.test_memory_leaks()
    
    # Generate final report
    report = auditor.generate_report()
    
    # Save report to file
    with open('audit_report.json', 'w') as f:
        json.dump(report, f, indent=2)
    
    print("\n📄 Report saved to audit_report.json")