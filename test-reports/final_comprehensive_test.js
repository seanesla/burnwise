#!/usr/bin/env node
/**
 * FINAL COMPREHENSIVE TEST SUITE FOR BURNWISE
 * NO MOCKS - ALL REAL DATA FROM TIDB
 * Tests everything with extreme thoroughness
 */

const { chromium } = require('playwright');
const fs = require('fs');

class ComprehensiveTestSuite {
    constructor() {
        this.results = {
            passed: [],
            failed: [],
            performance: {},
            apiTests: {},
            uiTests: {},
            dataIntegrity: {}
        };
        this.startTime = Date.now();
    }

    async runAllTests() {
        console.log('🚀 STARTING COMPREHENSIVE TEST SUITE');
        console.log('=' .repeat(60));
        
        const browser = await chromium.launch({ headless: false });
        const context = await browser.newContext();
        const page = await context.newPage();
        
        try {
            // 1. Test Authentication Flow
            await this.testAuthentication(page);
            
            // 2. Test Spatial Interface
            await this.testSpatialInterface(page);
            
            // 3. Test All UI Components
            await this.testUIComponents(page);
            
            // 4. Test API Data Integrity
            await this.testAPIDataIntegrity(page);
            
            // 5. Test Performance Metrics
            await this.testPerformanceMetrics(page);
            
            // 6. Test Responsive Design
            await this.testResponsiveDesign(page);
            
            // 7. Test Error Handling
            await this.testErrorHandling(page);
            
        } finally {
            await browser.close();
        }
        
        this.generateReport();
    }
    
    async testAuthentication(page) {
        console.log('\n🔐 Testing Authentication...');
        
        try {
            // Clear session
            await page.goto('http://localhost:3000');
            await page.evaluate(() => {
                localStorage.clear();
                sessionStorage.clear();
            });
            
            // Navigate to login
            await page.goto('http://localhost:3000/login');
            
            // Check if redirected to onboarding (means auth is working)
            await page.waitForTimeout(2000);
            const url = page.url();
            
            if (url.includes('onboarding') || url.includes('spatial')) {
                this.results.passed.push('Authentication: Session persistence working');
                console.log('   ✅ Authentication working - session active');
            } else {
                this.results.failed.push('Authentication: Session not persisting');
                console.log('   ❌ Authentication failed');
            }
            
            // Go to spatial interface
            if (url.includes('onboarding')) {
                await page.click('button:has-text("Skip Setup")');
            }
            
        } catch (error) {
            this.results.failed.push(`Authentication: ${error.message}`);
            console.log(`   ❌ Authentication error: ${error.message}`);
        }
    }
    
    async testSpatialInterface(page) {
        console.log('\n🗺️ Testing Spatial Interface...');
        
        try {
            await page.waitForSelector('.map-container', { timeout: 5000 });
            
            // Check Mapbox initialization
            const mapInitialized = await page.evaluate(() => {
                return typeof window.mapboxgl !== 'undefined' && 
                       document.querySelector('.mapboxgl-canvas') !== null;
            });
            
            if (mapInitialized) {
                this.results.passed.push('Spatial: Mapbox initialized');
                console.log('   ✅ Mapbox GL JS initialized');
            } else {
                this.results.failed.push('Spatial: Mapbox not initialized');
                console.log('   ❌ Mapbox GL JS failed to initialize');
            }
            
            // Check coordinates display
            const coords = await page.evaluate(() => {
                const lng = document.querySelector('[class*="Lng"]');
                const lat = document.querySelector('[class*="Lat"]');
                return lng && lat;
            });
            
            if (coords) {
                this.results.passed.push('Spatial: Coordinates display working');
                console.log('   ✅ Coordinates display working');
            }
            
        } catch (error) {
            this.results.failed.push(`Spatial: ${error.message}`);
            console.log(`   ❌ Spatial interface error: ${error.message}`);
        }
    }
    
    async testUIComponents(page) {
        console.log('\n🎨 Testing UI Components...');
        
        const components = [
            { selector: '.dock-navigation', name: 'Dock Navigation' },
            { selector: '.timeline-scrubber', name: 'Timeline Scrubber' },
            { selector: '.overlay-controls', name: 'Overlay Controls' }
        ];
        
        for (const component of components) {
            try {
                const element = await page.$(component.selector);
                if (element) {
                    // Check visibility
                    const isVisible = await element.isVisible();
                    
                    // Check positioning
                    const box = await element.boundingBox();
                    
                    if (isVisible && box) {
                        // Check centering for dock and timeline
                        if (component.selector.includes('dock') || component.selector.includes('timeline')) {
                            const viewport = await page.viewportSize();
                            const centerX = box.x + box.width / 2;
                            const viewportCenterX = viewport.width / 2;
                            const offset = Math.abs(centerX - viewportCenterX);
                            
                            if (offset < 10) {
                                this.results.passed.push(`UI: ${component.name} centered`);
                                console.log(`   ✅ ${component.name} centered (offset: ${offset.toFixed(1)}px)`);
                            } else {
                                this.results.failed.push(`UI: ${component.name} not centered (${offset}px off)`);
                                console.log(`   ❌ ${component.name} not centered (${offset.toFixed(1)}px off)`);
                            }
                        } else {
                            this.results.passed.push(`UI: ${component.name} visible`);
                            console.log(`   ✅ ${component.name} visible`);
                        }
                    }
                } else {
                    this.results.failed.push(`UI: ${component.name} not found`);
                    console.log(`   ❌ ${component.name} not found`);
                }
            } catch (error) {
                this.results.failed.push(`UI: ${component.name} error`);
                console.log(`   ❌ ${component.name} error: ${error.message}`);
            }
        }
    }
    
    async testAPIDataIntegrity(page) {
        console.log('\n🔌 Testing API Data Integrity...');
        
        const endpoints = [
            '/api/farms',
            '/api/burn-requests',
            '/api/weather/current',
            '/api/schedule/timeline/2025-08-18'
        ];
        
        for (const endpoint of endpoints) {
            try {
                const response = await page.evaluate(async (url) => {
                    const res = await fetch(`http://localhost:5001${url}`);
                    return {
                        status: res.status,
                        data: await res.json()
                    };
                }, endpoint);
                
                if (response.status === 200 && response.data) {
                    // Check for mock indicators
                    const dataStr = JSON.stringify(response.data);
                    const hasMockData = /mock|fake|demo|test|placeholder/i.test(dataStr);
                    
                    if (!hasMockData) {
                        this.results.passed.push(`API: ${endpoint} returns real data`);
                        console.log(`   ✅ ${endpoint} - REAL data`);
                        
                        // Store sample data
                        this.results.apiTests[endpoint] = {
                            success: true,
                            hasData: response.data.data && response.data.data.length > 0
                        };
                    } else {
                        this.results.failed.push(`API: ${endpoint} contains mock data`);
                        console.log(`   ❌ ${endpoint} - Contains MOCK indicators`);
                    }
                } else {
                    this.results.failed.push(`API: ${endpoint} failed (${response.status})`);
                    console.log(`   ❌ ${endpoint} - Status ${response.status}`);
                }
            } catch (error) {
                this.results.failed.push(`API: ${endpoint} error`);
                console.log(`   ❌ ${endpoint} - Error: ${error.message}`);
            }
        }
    }
    
    async testPerformanceMetrics(page) {
        console.log('\n⚡ Testing Performance Metrics...');
        
        try {
            const metrics = await page.evaluate(() => {
                const perf = performance.getEntriesByType('navigation')[0];
                const memory = performance.memory || {};
                
                return {
                    loadTime: perf.loadEventEnd - perf.loadEventStart,
                    domContentLoaded: perf.domContentLoadedEventEnd - perf.domContentLoadedEventStart,
                    responseTime: perf.responseEnd - perf.requestStart,
                    memoryUsed: memory.usedJSHeapSize ? (memory.usedJSHeapSize / 1048576).toFixed(2) : 'N/A',
                    memoryLimit: memory.jsHeapSizeLimit ? (memory.jsHeapSizeLimit / 1048576).toFixed(2) : 'N/A'
                };
            });
            
            this.results.performance = metrics;
            
            console.log(`   📊 Page Load: ${metrics.loadTime}ms`);
            console.log(`   📊 DOM Content Loaded: ${metrics.domContentLoaded}ms`);
            console.log(`   📊 Server Response: ${metrics.responseTime}ms`);
            console.log(`   📊 Memory Used: ${metrics.memoryUsed}MB`);
            
            // Check performance thresholds
            if (metrics.loadTime < 3000) {
                this.results.passed.push('Performance: Page load < 3s');
                console.log('   ✅ Page load time acceptable');
            } else {
                this.results.failed.push(`Performance: Page load too slow (${metrics.loadTime}ms)`);
                console.log('   ❌ Page load time too slow');
            }
            
        } catch (error) {
            this.results.failed.push(`Performance: ${error.message}`);
            console.log(`   ❌ Performance test error: ${error.message}`);
        }
    }
    
    async testResponsiveDesign(page) {
        console.log('\n📱 Testing Responsive Design...');
        
        const viewports = [
            { width: 375, height: 667, name: 'Mobile' },
            { width: 768, height: 1024, name: 'Tablet' },
            { width: 1920, height: 1080, name: 'Desktop' }
        ];
        
        for (const viewport of viewports) {
            try {
                await page.setViewportSize(viewport);
                await page.waitForTimeout(1000);
                
                // Check if dock is still visible and functional
                const dockVisible = await page.isVisible('.dock-navigation');
                
                if (dockVisible) {
                    this.results.passed.push(`Responsive: ${viewport.name} layout working`);
                    console.log(`   ✅ ${viewport.name} (${viewport.width}x${viewport.height}) - Layout intact`);
                } else {
                    this.results.failed.push(`Responsive: ${viewport.name} layout broken`);
                    console.log(`   ❌ ${viewport.name} - Dock not visible`);
                }
                
            } catch (error) {
                this.results.failed.push(`Responsive: ${viewport.name} error`);
                console.log(`   ❌ ${viewport.name} error: ${error.message}`);
            }
        }
    }
    
    async testErrorHandling(page) {
        console.log('\n🛡️ Testing Error Handling...');
        
        // Listen for console errors
        const errors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') {
                errors.push(msg.text());
            }
        });
        
        // Navigate and interact
        await page.reload();
        await page.waitForTimeout(2000);
        
        if (errors.length === 0) {
            this.results.passed.push('Error Handling: No console errors');
            console.log('   ✅ No console errors detected');
        } else {
            this.results.failed.push(`Error Handling: ${errors.length} console errors`);
            console.log(`   ❌ ${errors.length} console errors found`);
            errors.slice(0, 3).forEach(err => {
                console.log(`      - ${err.substring(0, 80)}...`);
            });
        }
    }
    
    generateReport() {
        const duration = ((Date.now() - this.startTime) / 1000).toFixed(2);
        const totalTests = this.results.passed.length + this.results.failed.length;
        const passRate = ((this.results.passed.length / totalTests) * 100).toFixed(1);
        
        console.log('\n' + '='.repeat(60));
        console.log('📊 COMPREHENSIVE TEST REPORT');
        console.log('='.repeat(60));
        
        console.log(`\n⏱️  Duration: ${duration} seconds`);
        console.log(`📅 Date: ${new Date().toISOString()}`);
        console.log(`\n✅ Passed: ${this.results.passed.length}`);
        console.log(`❌ Failed: ${this.results.failed.length}`);
        console.log(`📈 Pass Rate: ${passRate}%`);
        
        if (this.results.failed.length > 0) {
            console.log('\n🚨 FAILED TESTS:');
            this.results.failed.forEach(test => {
                console.log(`   - ${test}`);
            });
        }
        
        console.log('\n💾 PERFORMANCE METRICS:');
        Object.entries(this.results.performance).forEach(([key, value]) => {
            console.log(`   ${key}: ${value}`);
        });
        
        // Save report to file
        const report = {
            timestamp: new Date().toISOString(),
            duration: duration,
            passRate: passRate,
            results: this.results
        };
        
        fs.writeFileSync('comprehensive_test_report.json', JSON.stringify(report, null, 2));
        console.log('\n📄 Report saved to comprehensive_test_report.json');
        
        // Exit code based on results
        process.exit(this.results.failed.length > 0 ? 1 : 0);
    }
}

// Run tests
const suite = new ComprehensiveTestSuite();
suite.runAllTests().catch(console.error);