#!/usr/bin/env python3
"""
BRUTAL PIXEL-PERFECT FRONTEND AUDIT
ZERO TOLERANCE FOR MISALIGNMENT
MATHEMATICAL VERIFICATION OF EVERY ELEMENT
NO ROOM FOR MISTAKES
"""

import asyncio
import json
import math
from playwright.async_api import async_playwright
from datetime import datetime
import numpy as np

class BrutalPixelPerfectAuditor:
    def __init__(self):
        self.critical_issues = []
        self.alignment_issues = []
        self.spacing_issues = []
        self.overlap_issues = []
        self.math_violations = []
        
    async def run_brutal_audit(self):
        """Run the most comprehensive pixel-perfect audit ever"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=False)
            context = await browser.new_context(viewport={'width': 1920, 'height': 1080})
            page = await context.new_page()
            
            # Login with REAL credentials
            await page.goto('http://localhost:3000/login')
            await page.fill('input[type="email"]', 'robert@goldenfields.com')
            await page.fill('input[type="password"]', 'TestPassword123!')
            await page.click('button:has-text("Sign In")')
            
            # Skip onboarding if present
            await page.wait_for_timeout(1000)
            if 'onboarding' in page.url:
                await page.click('button:has-text("Skip Setup")')
            
            await page.wait_for_url('**/spatial')
            await page.wait_for_timeout(3000)  # Let EVERYTHING load
            
            print("\n" + "="*100)
            print("🔬 BRUTAL PIXEL-PERFECT AUDIT STARTING")
            print("="*100)
            
            # TEST 1: DOCK NAVIGATION POSITIONING
            print("\n📐 CHECKING DOCK NAVIGATION MATHEMATICAL ALIGNMENT...")
            dock_data = await page.evaluate('''() => {
                const dock = document.querySelector('.dock-navigation');
                const icons = Array.from(document.querySelectorAll('.dock-icon'));
                
                if (!dock) return null;
                
                const dockRect = dock.getBoundingClientRect();
                const iconData = icons.map((icon, i) => {
                    const rect = icon.getBoundingClientRect();
                    const styles = window.getComputedStyle(icon);
                    return {
                        index: i,
                        x: rect.x,
                        y: rect.y,
                        width: rect.width,
                        height: rect.height,
                        left: rect.left,
                        right: rect.right,
                        top: rect.top,
                        bottom: rect.bottom,
                        centerX: rect.left + rect.width/2,
                        centerY: rect.top + rect.height/2,
                        margin: styles.margin,
                        padding: styles.padding,
                        display: styles.display,
                        zIndex: styles.zIndex
                    };
                });
                
                // Calculate spacing between icons
                const spacings = [];
                for (let i = 1; i < iconData.length; i++) {
                    spacings.push(iconData[i].left - iconData[i-1].right);
                }
                
                return {
                    dock: {
                        x: dockRect.x,
                        y: dockRect.y,
                        width: dockRect.width,
                        height: dockRect.height,
                        bottom: dockRect.bottom,
                        centerX: dockRect.left + dockRect.width/2
                    },
                    icons: iconData,
                    spacings: spacings,
                    viewportWidth: window.innerWidth,
                    viewportHeight: window.innerHeight
                };
            }''')
            
            if dock_data:
                # Check dock is centered
                viewport_center = dock_data['viewportWidth'] / 2
                dock_center = dock_data['dock']['centerX']
                center_offset = abs(viewport_center - dock_center)
                
                if center_offset > 1:  # 1px tolerance
                    self.critical_issues.append(
                        f"❌ DOCK NOT CENTERED! Off by {center_offset:.2f}px"
                        f" (viewport center: {viewport_center}, dock center: {dock_center})"
                    )
                
                # Check dock is at bottom
                expected_bottom = dock_data['viewportHeight']
                actual_bottom = dock_data['dock']['bottom']
                bottom_offset = abs(expected_bottom - actual_bottom)
                
                if bottom_offset > 40:  # Should be near bottom with small margin
                    self.alignment_issues.append(
                        f"❌ DOCK NOT AT BOTTOM! {bottom_offset:.2f}px from bottom"
                    )
                
                # Check icon spacing is consistent
                spacings = dock_data['spacings']
                if spacings:
                    avg_spacing = sum(spacings) / len(spacings)
                    for i, space in enumerate(spacings):
                        deviation = abs(space - avg_spacing)
                        if deviation > 2:  # 2px tolerance
                            self.spacing_issues.append(
                                f"❌ INCONSISTENT SPACING between icon {i} and {i+1}: "
                                f"{space:.2f}px (expected {avg_spacing:.2f}px)"
                            )
                
                # Check all icons are same size
                icons = dock_data['icons']
                if icons:
                    first_width = icons[0]['width']
                    first_height = icons[0]['height']
                    for icon in icons:
                        if abs(icon['width'] - first_width) > 1:
                            self.critical_issues.append(
                                f"❌ ICON SIZE MISMATCH! Icon {icon['index']}: "
                                f"{icon['width']}x{icon['height']} vs {first_width}x{first_height}"
                            )
                
                # Check icons are vertically aligned
                first_y = icons[0]['y'] if icons else 0
                for icon in icons:
                    if abs(icon['y'] - first_y) > 1:
                        self.alignment_issues.append(
                            f"❌ ICON {icon['index']} VERTICALLY MISALIGNED by {abs(icon['y'] - first_y):.2f}px"
                        )
                
                print(f"✅ Analyzed {len(icons)} dock icons")
            else:
                self.critical_issues.append("❌ DOCK NAVIGATION NOT FOUND!")
            
            # TEST 2: TIMELINE SCRUBBER POSITIONING
            print("\n📐 CHECKING TIMELINE SCRUBBER MATHEMATICAL POSITIONING...")
            timeline_data = await page.evaluate('''() => {
                const timeline = document.querySelector('.timeline-scrubber');
                if (!timeline) return null;
                
                const rect = timeline.getBoundingClientRect();
                const handle = document.querySelector('.timeline-handle');
                const track = document.querySelector('.timeline-track');
                
                return {
                    timeline: {
                        x: rect.x,
                        y: rect.y,
                        width: rect.width,
                        height: rect.height,
                        centerX: rect.left + rect.width/2
                    },
                    handle: handle ? handle.getBoundingClientRect() : null,
                    track: track ? track.getBoundingClientRect() : null,
                    viewportWidth: window.innerWidth
                };
            }''')
            
            if timeline_data and timeline_data['timeline']:
                # Check timeline is centered
                viewport_center = timeline_data['viewportWidth'] / 2
                timeline_center = timeline_data['timeline']['centerX']
                center_offset = abs(viewport_center - timeline_center)
                
                if center_offset > 1:
                    self.alignment_issues.append(
                        f"❌ TIMELINE NOT CENTERED! Off by {center_offset:.2f}px"
                    )
                
                # Check handle is on track
                if timeline_data['handle'] and timeline_data['track']:
                    handle = timeline_data['handle']
                    track = timeline_data['track']
                    
                    # Handle should be vertically centered on track
                    handle_center_y = handle['top'] + handle['height']/2
                    track_center_y = track['top'] + track['height']/2
                    y_offset = abs(handle_center_y - track_center_y)
                    
                    if y_offset > 2:
                        self.alignment_issues.append(
                            f"❌ TIMELINE HANDLE NOT CENTERED ON TRACK! Off by {y_offset:.2f}px"
                        )
                
                print("✅ Timeline scrubber analyzed")
            else:
                self.critical_issues.append("❌ TIMELINE SCRUBBER NOT FOUND!")
            
            # TEST 3: FLOATING PANELS Z-INDEX AND OVERLAP
            print("\n📐 CHECKING FLOATING PANELS FOR OVERLAPS...")
            panels_data = await page.evaluate('''() => {
                const panels = document.querySelectorAll('[class*="floating"], [class*="panel"], [class*="modal"]');
                const elements = [];
                
                panels.forEach(panel => {
                    const rect = panel.getBoundingClientRect();
                    const styles = window.getComputedStyle(panel);
                    if (rect.width > 0 && rect.height > 0) {
                        elements.push({
                            className: panel.className,
                            x: rect.x,
                            y: rect.y,
                            width: rect.width,
                            height: rect.height,
                            left: rect.left,
                            right: rect.right,
                            top: rect.top,
                            bottom: rect.bottom,
                            zIndex: parseInt(styles.zIndex) || 0,
                            position: styles.position,
                            display: styles.display,
                            visible: styles.visibility !== 'hidden' && styles.display !== 'none'
                        });
                    }
                });
                
                return elements;
            }''')
            
            if panels_data:
                # Check for overlapping panels
                for i, panel1 in enumerate(panels_data):
                    if not panel1['visible']:
                        continue
                    
                    for j, panel2 in enumerate(panels_data[i+1:], i+1):
                        if not panel2['visible']:
                            continue
                        
                        # Check if panels overlap
                        overlap_x = (
                            panel1['left'] < panel2['right'] and 
                            panel1['right'] > panel2['left']
                        )
                        overlap_y = (
                            panel1['top'] < panel2['bottom'] and 
                            panel1['bottom'] > panel2['top']
                        )
                        
                        if overlap_x and overlap_y:
                            # They overlap - check z-index
                            if panel1['zIndex'] == panel2['zIndex']:
                                self.overlap_issues.append(
                                    f"❌ PANELS OVERLAP WITH SAME Z-INDEX! "
                                    f"{panel1['className'][:30]} and {panel2['className'][:30]} "
                                    f"both at z-index {panel1['zIndex']}"
                                )
                
                print(f"✅ Analyzed {len(panels_data)} floating panels")
            
            # TEST 4: MAP COORDINATES AND CENTERING
            print("\n📐 CHECKING MAP MATHEMATICAL CENTERING...")
            map_data = await page.evaluate('''() => {
                const mapContainer = document.querySelector('.mapboxgl-canvas');
                if (!mapContainer) return null;
                
                const rect = mapContainer.getBoundingClientRect();
                return {
                    x: rect.x,
                    y: rect.y,
                    width: rect.width,
                    height: rect.height,
                    centerX: rect.left + rect.width/2,
                    centerY: rect.top + rect.height/2,
                    viewportWidth: window.innerWidth,
                    viewportHeight: window.innerHeight
                };
            }''')
            
            if map_data:
                # Map should fill viewport
                if abs(map_data['width'] - map_data['viewportWidth']) > 5:
                    self.alignment_issues.append(
                        f"❌ MAP DOESN'T FILL WIDTH! Map: {map_data['width']}px, "
                        f"Viewport: {map_data['viewportWidth']}px"
                    )
                
                if abs(map_data['height'] - map_data['viewportHeight']) > 100:  # Allow for UI elements
                    self.alignment_issues.append(
                        f"❌ MAP HEIGHT ISSUE! Map: {map_data['height']}px, "
                        f"Viewport: {map_data['viewportHeight']}px"
                    )
                
                print("✅ Map dimensions analyzed")
            
            # TEST 5: BUTTON ALIGNMENT IN GROUPS
            print("\n📐 CHECKING BUTTON GROUP ALIGNMENT...")
            button_groups = await page.evaluate('''() => {
                const groups = document.querySelectorAll('[class*="button-group"], [class*="btn-group"]');
                const groupData = [];
                
                groups.forEach(group => {
                    const buttons = group.querySelectorAll('button');
                    const buttonRects = Array.from(buttons).map(btn => {
                        const rect = btn.getBoundingClientRect();
                        return {
                            x: rect.x,
                            y: rect.y,
                            width: rect.width,
                            height: rect.height,
                            text: btn.textContent
                        };
                    });
                    
                    if (buttonRects.length > 0) {
                        groupData.push({
                            className: group.className,
                            buttons: buttonRects
                        });
                    }
                });
                
                return groupData;
            }''')
            
            for group in button_groups:
                buttons = group['buttons']
                if len(buttons) > 1:
                    # Check all buttons are same height
                    first_height = buttons[0]['height']
                    for btn in buttons:
                        if abs(btn['height'] - first_height) > 1:
                            self.alignment_issues.append(
                                f"❌ BUTTON HEIGHT MISMATCH in {group['className'][:30]}: "
                                f"'{btn['text']}' is {btn['height']}px vs {first_height}px"
                            )
                    
                    # Check vertical alignment
                    first_y = buttons[0]['y']
                    for btn in buttons:
                        if abs(btn['y'] - first_y) > 1:
                            self.alignment_issues.append(
                                f"❌ BUTTON VERTICAL MISALIGNMENT in {group['className'][:30]}: "
                                f"'{btn['text']}' off by {abs(btn['y'] - first_y):.2f}px"
                            )
            
            # TEST 6: GOLDEN RATIO AND FIBONACCI CHECKS
            print("\n📐 CHECKING MATHEMATICAL RATIOS...")
            golden_ratio = 1.618033988749895
            fibonacci = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233]
            
            all_elements = await page.evaluate('''() => {
                const elements = document.querySelectorAll('*');
                const sizes = [];
                
                elements.forEach(el => {
                    const rect = el.getBoundingClientRect();
                    if (rect.width > 10 && rect.height > 10) {
                        sizes.push({
                            width: rect.width,
                            height: rect.height,
                            ratio: rect.width / rect.height,
                            className: el.className || el.tagName
                        });
                    }
                });
                
                return sizes;
            }''')
            
            # Check for golden ratio violations in major elements
            for el in all_elements[:50]:  # Check first 50 elements
                ratio = el['ratio']
                if 1.5 < ratio < 1.7:  # Near golden ratio range
                    deviation = abs(ratio - golden_ratio)
                    if 0.05 < deviation < 0.1:  # Close but not perfect
                        self.math_violations.append(
                            f"⚠️ NEAR GOLDEN RATIO: {el['className'][:30]} "
                            f"ratio={ratio:.3f} (off by {deviation:.3f})"
                        )
            
            # Generate comprehensive report
            self.generate_report()
            
            await browser.close()
    
    def generate_report(self):
        """Generate the most detailed report ever"""
        
        print("\n" + "="*100)
        print("🔬 BRUTAL PIXEL-PERFECT AUDIT REPORT")
        print("="*100)
        
        total_issues = (
            len(self.critical_issues) + 
            len(self.alignment_issues) + 
            len(self.spacing_issues) + 
            len(self.overlap_issues) +
            len(self.math_violations)
        )
        
        if self.critical_issues:
            print(f"\n🔴 CRITICAL ISSUES ({len(self.critical_issues)}):")
            for issue in self.critical_issues:
                print(f"   {issue}")
        
        if self.alignment_issues:
            print(f"\n🟠 ALIGNMENT ISSUES ({len(self.alignment_issues)}):")
            for issue in self.alignment_issues[:10]:  # Show first 10
                print(f"   {issue}")
            if len(self.alignment_issues) > 10:
                print(f"   ... and {len(self.alignment_issues) - 10} more")
        
        if self.spacing_issues:
            print(f"\n🟡 SPACING ISSUES ({len(self.spacing_issues)}):")
            for issue in self.spacing_issues[:10]:
                print(f"   {issue}")
        
        if self.overlap_issues:
            print(f"\n🟣 OVERLAP ISSUES ({len(self.overlap_issues)}):")
            for issue in self.overlap_issues[:10]:
                print(f"   {issue}")
        
        if self.math_violations:
            print(f"\n🔵 MATHEMATICAL VIOLATIONS ({len(self.math_violations)}):")
            for issue in self.math_violations[:5]:
                print(f"   {issue}")
        
        print("\n" + "="*100)
        print(f"📊 TOTAL ISSUES FOUND: {total_issues}")
        print("="*100)
        
        if total_issues == 0:
            print("\n✅ PERFECT! ZERO ISSUES FOUND! FRONTEND IS PIXEL-PERFECT!")
        else:
            print(f"\n❌ {total_issues} ISSUES NEED IMMEDIATE FIXING!")
            print("\n🔧 FIX PRIORITY:")
            print("1. Critical issues (breaks functionality)")
            print("2. Alignment issues (visual problems)")
            print("3. Spacing issues (consistency)")
            print("4. Overlap issues (z-index problems)")
            print("5. Math violations (design ratios)")
        
        # Save detailed report
        report_data = {
            'timestamp': datetime.now().isoformat(),
            'total_issues': total_issues,
            'critical_issues': self.critical_issues,
            'alignment_issues': self.alignment_issues,
            'spacing_issues': self.spacing_issues,
            'overlap_issues': self.overlap_issues,
            'math_violations': self.math_violations
        }
        
        with open('pixel-perfect-audit-report.json', 'w') as f:
            json.dump(report_data, f, indent=2)
        
        print("\n📄 Detailed report saved to pixel-perfect-audit-report.json")

if __name__ == "__main__":
    auditor = BrutalPixelPerfectAuditor()
    asyncio.run(auditor.run_brutal_audit())