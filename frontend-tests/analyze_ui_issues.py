#!/usr/bin/env python3
"""
BRUTALLY HONEST UI Analysis Script
Finding every single visual issue - NO EXCUSES
"""

import json
import math

# Measurements from Playwright
measurements = {
    "viewport": {"width": 1200, "height": 721},
    "elements": [
        {
            "name": "dock",
            "x": 594, "y": 627, "width": 347, "height": 74,
            "backdropFilter": "none", "zIndex": 500
        },
        {
            "name": "dock-icons-0",
            "x": 615, "y": 640, "width": 48, "height": 48,
            "backgroundColor": "rgba(255, 255, 255, 0.05)",
            "backdropFilter": "none", "borderRadius": "12px"
        },
        {
            "name": "dock-icons-1", 
            "x": 671, "y": 640, "width": 48, "height": 48,
            "backgroundColor": "rgba(255, 255, 255, 0.05)",
            "backdropFilter": "none", "borderRadius": "12px"
        },
        {
            "name": "dock-icons-2",
            "x": 727, "y": 640, "width": 48, "height": 48,
            "backgroundColor": "rgba(255, 255, 255, 0.05)",
            "backdropFilter": "none", "borderRadius": "12px"
        },
        {
            "name": "dock-icons-3",
            "x": 783, "y": 640, "width": 48, "height": 48,
            "backgroundColor": "rgba(255, 255, 255, 0.05)",
            "backdropFilter": "none", "borderRadius": "12px"
        },
        {
            "name": "dock-icons-4",
            "x": 872, "y": 640, "width": 48, "height": 48,
            "backgroundColor": "rgba(255, 255, 255, 0.05)",
            "backdropFilter": "none", "borderRadius": "12px"
        },
        {
            "name": "timeline",
            "x": 594, "y": 417, "width": 950.3984375, "height": 204,
            "backgroundColor": "rgba(30, 30, 30, 0.9)",
            "backdropFilter": "blur(20px) saturate(1.8)",
            "borderRadius": "16px", "zIndex": 400,
            "boxShadow": "rgba(0, 0, 0, 0.4) 0px 20px 40px 0px, rgba(255, 255, 255, 0.1) 0px 1px 0px 0px inset"
        },
        {
            "name": "coordinates",
            "x": 20, "y": 90, "width": 283.984375, "height": 34,
            "backgroundColor": "rgba(0, 0, 0, 0.7)",
            "backdropFilter": "blur(10px)",
            "borderRadius": "8px", "zIndex": 100,
            "fontSize": "12px", "fontFamily": '"SF Mono", monospace'
        },
        {
            "name": "weather-toggle-0",
            "x": 994.3671875, "y": 90, "width": 92.140625, "height": 37.5,
            "backgroundColor": "rgba(255, 107, 53, 0.8)",
            "backdropFilter": "blur(10px)",
            "borderRadius": "8px",
            "fontSize": "13.3333px", "fontFamily": "Arial"
        },
        {
            "name": "weather-toggle-1",
            "x": 1096.5078125, "y": 90, "width": 83.4921875, "height": 37.5,
            "backgroundColor": "rgba(255, 107, 53, 0.8)",
            "backdropFilter": "blur(10px)",
            "borderRadius": "8px",
            "fontSize": "13.3333px", "fontFamily": "Arial"
        }
    ],
    "spacing": {
        "dockIcons": [8, 8, 8, 41]
    },
    "emojisFound": [],
    "fonts": {
        "dock": {"family": "Inter, -apple-system", "size": "16px"},
        "timeline": {"family": "Inter, -apple-system", "size": "16px"},
        "coordinates": {"family": '"SF Mono", monospace', "size": "12px"},
        "weather-toggle": {"family": "Arial", "size": "13.3333px"}
    }
}

def analyze_issues():
    issues = []
    warnings = []
    
    print("=" * 80)
    print("BURNWISE FRONTEND BRUTAL HONESTY REPORT")
    print("NO MOCKS. NO DEMOS. NO EXCUSES.")
    print("=" * 80)
    
    # 1. CHECK DOCK ICON SPACING (CRITICAL)
    print("\n🔍 DOCK ICON SPACING ANALYSIS:")
    dock_spacing = measurements["spacing"]["dockIcons"]
    spacing_variance = max(dock_spacing) - min(dock_spacing)
    if spacing_variance > 2:
        issues.append(f"❌ CRITICAL: Dock icon spacing INCONSISTENT!")
        issues.append(f"   Expected: 8px between all icons")
        issues.append(f"   Actual: {dock_spacing}")
        issues.append(f"   Last icon has {dock_spacing[-1]}px gap - WHY?!")
        
        # Calculate what's wrong
        dock_icons = [e for e in measurements["elements"] if "dock-icons" in e["name"]]
        if len(dock_icons) == 5:
            # 5 icons but only 4 gaps? Missing icon!
            issues.append(f"   ANALYSIS: 5 dock icons detected but spacing suggests different layout")
            issues.append(f"   Icon positions: {[icon['x'] for icon in dock_icons]}")
            # Check if last icon is pushed right
            expected_x = dock_icons[3]["x"] + dock_icons[3]["width"] + 8
            actual_x = dock_icons[4]["x"]
            issues.append(f"   Icon 5 should be at x={expected_x}, but is at x={actual_x}")
            issues.append(f"   DIAGNOSIS: Last icon pushed {actual_x - expected_x}px to the right!")
    
    # 2. CHECK GLASS MORPHISM (CRITICAL)
    print("\n🔍 GLASS MORPHISM ANALYSIS:")
    for elem in measurements["elements"]:
        if "dock-icon" in elem["name"]:
            if elem["backdropFilter"] == "none":
                issues.append(f"❌ {elem['name']}: NO glass morphism effect!")
                issues.append(f"   Expected: blur(10px) or similar")
                issues.append(f"   Actual: {elem['backdropFilter']}")
    
    # 3. CHECK FONT CONSISTENCY (CRITICAL)
    print("\n🔍 FONT ANALYSIS:")
    if measurements["fonts"]["weather-toggle"]["family"] != measurements["fonts"]["dock"]["family"]:
        issues.append(f"❌ Font inconsistency detected!")
        issues.append(f"   Weather toggles use: {measurements['fonts']['weather-toggle']['family']}")
        issues.append(f"   Should use: Inter (like rest of UI)")
    
    if "13.3333px" in measurements["fonts"]["weather-toggle"]["size"]:
        issues.append(f"❌ Fractional font size: 13.3333px")
        issues.append(f"   This is a rendering artifact - should be 13px or 14px")
    
    # 4. CHECK Z-INDEX HIERARCHY
    print("\n🔍 Z-INDEX HIERARCHY:")
    z_indexes = {}
    for elem in measurements["elements"]:
        if "zIndex" in elem:
            z_indexes[elem["name"]] = elem["zIndex"]
    
    expected_hierarchy = {
        "dock": 500,
        "timeline": 400,
        "coordinates": 100
    }
    
    for name, expected_z in expected_hierarchy.items():
        if name in z_indexes:
            if z_indexes[name] != expected_z:
                issues.append(f"❌ {name} z-index wrong: {z_indexes[name]} (expected {expected_z})")
    
    # 5. CHECK ALIGNMENT
    print("\n🔍 ALIGNMENT ANALYSIS:")
    dock_icons = [e for e in measurements["elements"] if "dock-icons" in e["name"]]
    y_positions = [icon["y"] for icon in dock_icons]
    if len(set(y_positions)) > 1:
        issues.append(f"❌ Dock icons NOT vertically aligned!")
        issues.append(f"   Y positions: {y_positions}")
    
    # 6. CHECK BORDER RADIUS CONSISTENCY
    print("\n🔍 BORDER RADIUS ANALYSIS:")
    border_radii = {}
    for elem in measurements["elements"]:
        if "borderRadius" in elem:
            border_radii[elem["name"]] = elem["borderRadius"]
    
    # Group by radius value
    radius_groups = {}
    for name, radius in border_radii.items():
        if radius not in radius_groups:
            radius_groups[radius] = []
        radius_groups[radius].append(name)
    
    if len(radius_groups) > 3:
        warnings.append(f"⚠️  Too many different border radius values: {list(radius_groups.keys())}")
        warnings.append(f"   Consider using consistent design tokens")
    
    # 7. CHECK BOX SHADOWS
    print("\n🔍 BOX SHADOW ANALYSIS:")
    shadows_count = 0
    for elem in measurements["elements"]:
        if "boxShadow" in elem and elem.get("boxShadow") != "none":
            shadows_count += 1
    
    if shadows_count < 2:
        warnings.append(f"⚠️  Only {shadows_count} elements have shadows")
        warnings.append(f"   Floating elements should have shadows for depth")
    
    # 8. CHECK CENTERING
    print("\n🔍 CENTERING ANALYSIS:")
    viewport_center_x = measurements["viewport"]["width"] / 2
    
    # Check if dock is centered
    dock = next((e for e in measurements["elements"] if e["name"] == "dock"), None)
    if dock:
        dock_center = dock["x"] + dock["width"] / 2
        offset = abs(dock_center - viewport_center_x)
        if offset > 5:
            issues.append(f"❌ Dock NOT centered horizontally!")
            issues.append(f"   Dock center: {dock_center}px")
            issues.append(f"   Viewport center: {viewport_center_x}px")
            issues.append(f"   Offset: {offset}px")
    
    # 9. CHECK FOR FRACTIONAL PIXELS
    print("\n🔍 FRACTIONAL PIXEL ANALYSIS:")
    for elem in measurements["elements"]:
        if isinstance(elem.get("width"), float) and elem["width"] % 1 != 0:
            warnings.append(f"⚠️  {elem['name']} has fractional width: {elem['width']}px")
        if isinstance(elem.get("x"), float) and elem["x"] % 1 != 0:
            warnings.append(f"⚠️  {elem['name']} has fractional x position: {elem['x']}px")
    
    # 10. CHECK COLOR OPACITY
    print("\n🔍 COLOR OPACITY ANALYSIS:")
    for elem in measurements["elements"]:
        if "backgroundColor" in elem:
            bg = elem["backgroundColor"]
            if "rgba" in bg and "0.05)" in bg:
                warnings.append(f"⚠️  {elem['name']} has very low opacity (5%) - might be invisible")
    
    # FINAL REPORT
    print("\n" + "=" * 80)
    print("VERDICT:")
    print("=" * 80)
    
    if issues:
        print(f"\n🚨 {len(issues)} CRITICAL ISSUES FOUND:")
        for issue in issues:
            print(issue)
    
    if warnings:
        print(f"\n⚠️  {len(warnings)} WARNINGS:")
        for warning in warnings:
            print(warning)
    
    if not issues and not warnings:
        print("✅ PERFECT - No issues found (but I doubt it)")
    
    # MATHEMATICAL VERIFICATION
    print("\n" + "=" * 80)
    print("MATHEMATICAL VERIFICATION:")
    print("=" * 80)
    
    # Golden ratio check
    for elem in measurements["elements"]:
        if elem.get("width") and elem.get("height") and elem["height"] > 0:
            ratio = elem["width"] / elem["height"]
            golden = 1.618
            if abs(ratio - golden) < 0.1:
                print(f"✅ {elem['name']} follows golden ratio: {ratio:.3f}")
            elif elem["width"] == elem["height"]:
                print(f"📐 {elem['name']} is square: {elem['width']}x{elem['height']}")
    
    # Fibonacci sequence check for spacing
    fib = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89]
    for spacing in dock_spacing:
        if spacing in fib:
            print(f"✅ Spacing {spacing}px is in Fibonacci sequence")
        else:
            print(f"❌ Spacing {spacing}px is NOT in Fibonacci sequence")
    
    return len(issues), len(warnings)

if __name__ == "__main__":
    critical_issues, warnings = analyze_issues()
    
    print("\n" + "=" * 80)
    print(f"FINAL SCORE: {critical_issues} critical issues, {warnings} warnings")
    if critical_issues > 0:
        print("STATUS: ❌ FAILED - FIX THESE ISSUES NOW!")
        exit(1)
    else:
        print("STATUS: ⚠️  PASSED WITH WARNINGS")
        exit(0)