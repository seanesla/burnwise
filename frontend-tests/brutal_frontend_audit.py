#!/usr/bin/env python3
"""
BRUTAL Frontend Audit Script
Finds EVERY issue with zero tolerance
NO MOCKS, NO DEMOS, NO HARDCODED STUFF
"""

import asyncio
import json
import re
from playwright.async_api import async_playwright
from datetime import datetime
import subprocess
import time

class BrutalFrontendAuditor:
    def __init__(self):
        self.issues = []
        self.critical = []
        self.warnings = []
        self.test_results = {}
        
    async def run_audit(self):
        """Run comprehensive frontend audit"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=False)
            context = await browser.new_context()
            page = await context.new_page()
            
            # Login first
            await page.goto('http://localhost:3000/login')
            await page.fill('input[type="email"]', 'robert@goldenfields.com')
            await page.fill('input[type="password"]', 'TestPassword123!')
            await page.click('button:has-text("Sign In")')
            
            # Skip onboarding if needed
            await page.wait_for_timeout(1000)
            if 'onboarding' in page.url:
                await page.click('button:has-text("Skip Setup")')
            
            await page.wait_for_url('**/spatial')
            await page.wait_for_timeout(2000)  # Let everything load
            
            # Test 1: Check console errors
            console_messages = []
            page.on('console', lambda msg: console_messages.append({
                'type': msg.type,
                'text': msg.text,
                'location': msg.location
            }))
            
            # Test 2: Check network failures
            failed_requests = []
            page.on('requestfailed', lambda req: failed_requests.append({
                'url': req.url,
                'failure': req.failure
            }))
            
            # Test 3: Check all dock icons work
            print("\n🔍 TESTING DOCK NAVIGATION...")
            dock_icons = await page.locator('.dock-icon').all()
            
            for i, icon in enumerate(dock_icons):
                try:
                    await icon.click()
                    await page.wait_for_timeout(500)
                    
                    # Check if something happened
                    active = await page.locator('.dock-icon.active').count()
                    if active == 0:
                        self.critical.append(f"❌ Dock icon {i} doesn't activate!")
                    else:
                        print(f"✅ Dock icon {i} works")
                except Exception as e:
                    self.critical.append(f"❌ Dock icon {i} BROKEN: {str(e)}")
            
            # Test 4: Check AI Assistant opens
            print("\n🔍 TESTING AI ASSISTANT...")
            ai_icon = await page.locator('.animated-flame-logo').first
            await ai_icon.click()
            await page.wait_for_timeout(1000)
            
            # Check if FloatingAI panel appears
            floating_ai = await page.locator('.floating-ai-panel').count()
            if floating_ai == 0:
                self.critical.append("❌ CRITICAL: FloatingAI panel NEVER appears!")
                
                # Check if component is imported
                spatial_js = subprocess.run(
                    ['grep', '-c', 'FloatingAI', 'frontend/src/components/SpatialInterface.js'],
                    capture_output=True, text=True
                )
                if spatial_js.stdout.strip() == '1':
                    self.critical.append("❌ FloatingAI imported but NOT RENDERED!")
                else:
                    self.critical.append("❌ FloatingAI NOT EVEN IMPORTED!")
            
            # Test 5: Check Timeline Scrubber
            print("\n🔍 TESTING TIMELINE SCRUBBER...")
            timeline = await page.locator('.timeline-scrubber').count()
            if timeline > 0:
                # Try to drag the timeline
                scrubber = await page.locator('.timeline-handle').first()
                await scrubber.drag_to(await page.locator('.timeline-track'), target_position={'x': 200, 'y': 0})
                print("✅ Timeline scrubber draggable")
            else:
                self.critical.append("❌ Timeline scrubber missing!")
            
            # Test 6: Check API data sources
            print("\n🔍 CHECKING API DATA SOURCES...")
            
            # Intercept API calls
            api_calls = []
            page.on('response', lambda resp: api_calls.append(resp.url) if 'localhost:5001' in resp.url else None)
            
            # Reload to catch all API calls
            await page.reload()
            await page.wait_for_timeout(3000)
            
            # Check for hardcoded data
            page_content = await page.content()
            hardcoded_patterns = [
                r'Mock\w+',
                r'DEMO_\w+',
                r'fake\w+',
                r'dummy\w+',
                r'placeholder',
                r'Lorem ipsum'
            ]
            
            for pattern in hardcoded_patterns:
                matches = re.findall(pattern, page_content, re.IGNORECASE)
                if matches:
                    self.critical.append(f"❌ HARDCODED DATA FOUND: {matches[:3]}...")
            
            # Test 7: Check button states
            print("\n🔍 TESTING ALL BUTTONS...")
            buttons = await page.locator('button').all()
            for i, btn in enumerate(buttons[:10]):  # Test first 10 buttons
                try:
                    is_disabled = await btn.is_disabled()
                    is_visible = await btn.is_visible()
                    text = await btn.text_content()
                    
                    if is_visible and not is_disabled:
                        await btn.click()
                        await page.wait_for_timeout(100)
                        print(f"✅ Button '{text}' clickable")
                except Exception as e:
                    self.warnings.append(f"⚠️ Button {i} issue: {str(e)}")
            
            # Test 8: Check CSS rendering
            print("\n🔍 CHECKING CSS RENDERING...")
            
            # Check for glass morphism
            glass_elements = await page.locator('[class*="glass"], [class*="blur"]').count()
            if glass_elements < 3:
                self.warnings.append(f"⚠️ Only {glass_elements} glass morphism elements found")
            
            # Check font consistency
            fonts = await page.evaluate('''() => {
                const elements = document.querySelectorAll('*');
                const fontFamilies = new Set();
                elements.forEach(el => {
                    const style = window.getComputedStyle(el);
                    if (style.fontFamily) fontFamilies.add(style.fontFamily);
                });
                return Array.from(fontFamilies);
            }''')
            
            if 'Arial' in str(fonts):
                self.warnings.append("⚠️ Arial font detected (should be Inter)")
            
            # Test 9: Check z-index layers
            print("\n🔍 CHECKING Z-INDEX LAYERING...")
            z_indexes = await page.evaluate('''() => {
                const elements = document.querySelectorAll('*');
                const zIndexes = [];
                elements.forEach(el => {
                    const style = window.getComputedStyle(el);
                    const z = parseInt(style.zIndex);
                    if (!isNaN(z) && z !== 0) {
                        zIndexes.push({
                            element: el.className,
                            zIndex: z
                        });
                    }
                });
                return zIndexes.sort((a, b) => b.zIndex - a.zIndex);
            }''')
            
            # Check for overlapping issues
            if len(z_indexes) > 0:
                print(f"Found {len(z_indexes)} z-indexed elements")
                
            # Test 10: Performance check
            print("\n🔍 CHECKING PERFORMANCE...")
            metrics = await page.evaluate('''() => {
                const perf = performance.getEntriesByType('navigation')[0];
                return {
                    domContentLoaded: perf.domContentLoadedEventEnd - perf.domContentLoadedEventStart,
                    loadComplete: perf.loadEventEnd - perf.loadEventStart,
                    domInteractive: perf.domInteractive
                };
            }''')
            
            if metrics['loadComplete'] > 3000:
                self.warnings.append(f"⚠️ Slow load time: {metrics['loadComplete']}ms")
            
            # Generate report
            self.generate_report(console_messages, failed_requests, api_calls)
            
            await browser.close()
    
    def generate_report(self, console_msgs, failed_reqs, api_calls):
        """Generate comprehensive audit report"""
        
        print("\n" + "="*80)
        print("🔥 BRUTAL FRONTEND AUDIT REPORT 🔥")
        print("="*80)
        
        # Critical Issues
        if self.critical:
            print(f"\n❌ CRITICAL ISSUES ({len(self.critical)}):")
            for issue in self.critical:
                print(f"   {issue}")
        
        # Console Errors
        errors = [m for m in console_msgs if m['type'] == 'error']
        if errors:
            print(f"\n❌ CONSOLE ERRORS ({len(errors)}):")
            for err in errors[:5]:
                print(f"   {err['text'][:100]}...")
        
        # Failed Requests
        if failed_reqs:
            print(f"\n❌ FAILED REQUESTS ({len(failed_reqs)}):")
            for req in failed_reqs[:5]:
                print(f"   {req['url']} - {req['failure']}")
        
        # API Calls
        print(f"\n📡 API CALLS MADE ({len(api_calls)}):")
        unique_apis = set(api_calls)
        for api in list(unique_apis)[:10]:
            if '/api/' in api:
                endpoint = api.split('/api/')[1].split('/')[0]
                print(f"   ✅ {endpoint}")
        
        # Warnings
        if self.warnings:
            print(f"\n⚠️ WARNINGS ({len(self.warnings)}):")
            for warn in self.warnings:
                print(f"   {warn}")
        
        # Summary
        total_issues = len(self.critical) + len(errors) + len(failed_reqs)
        print("\n" + "="*80)
        print(f"📊 TOTAL ISSUES: {total_issues}")
        print(f"   🔴 Critical: {len(self.critical)}")
        print(f"   🟡 Warnings: {len(self.warnings)}")
        print(f"   🔵 Console Errors: {len(errors)}")
        print("="*80)
        
        if total_issues == 0:
            print("\n✅ FRONTEND IS PERFECT! NO ISSUES FOUND!")
        else:
            print(f"\n❌ FRONTEND HAS {total_issues} ISSUES THAT NEED FIXING!")
        
        # Save report
        with open('frontend-audit-report.json', 'w') as f:
            json.dump({
                'timestamp': datetime.now().isoformat(),
                'critical': self.critical,
                'warnings': self.warnings,
                'console_errors': errors[:10],
                'failed_requests': failed_reqs[:10],
                'api_calls': list(unique_apis)[:20],
                'total_issues': total_issues
            }, f, indent=2)
        
        print("\n📄 Full report saved to frontend-audit-report.json")

if __name__ == "__main__":
    auditor = BrutalFrontendAuditor()
    asyncio.run(auditor.run_audit())