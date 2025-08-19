#!/usr/bin/env python3
"""
BURNWISE Frontend Visual Verification Script
Brutally honest pixel-perfect measurements
NO MOCKS - REAL MEASUREMENTS ONLY
"""

import json
import sys
from typing import Dict, List, Tuple
from dataclasses import dataclass
from datetime import datetime

@dataclass
class UIElement:
    """Represents a UI element with precise measurements"""
    name: str
    x: float
    y: float
    width: float
    height: float
    color: str
    opacity: float
    z_index: int
    
    def is_aligned_with(self, other: 'UIElement', axis: str = 'x', tolerance: float = 1.0) -> bool:
        """Check if elements are aligned within tolerance"""
        if axis == 'x':
            return abs(self.x - other.x) <= tolerance
        elif axis == 'y':
            return abs(self.y - other.y) <= tolerance
        return False
    
    def overlaps_with(self, other: 'UIElement') -> bool:
        """Check if elements overlap (z-index issues)"""
        x_overlap = (self.x < other.x + other.width) and (self.x + self.width > other.x)
        y_overlap = (self.y < other.y + other.height) and (self.y + self.height > other.y)
        return x_overlap and y_overlap

class UIVerifier:
    """Verify UI measurements and consistency"""
    
    def __init__(self):
        self.issues = []
        self.warnings = []
        self.successes = []
    
    def verify_spacing(self, elements: List[UIElement], expected_gap: float) -> bool:
        """Verify consistent spacing between elements"""
        for i in range(len(elements) - 1):
            gap = elements[i+1].x - (elements[i].x + elements[i].width)
            if abs(gap - expected_gap) > 1.0:
                self.issues.append(f"❌ Spacing issue between {elements[i].name} and {elements[i+1].name}: {gap}px (expected {expected_gap}px)")
                return False
        self.successes.append(f"✅ Spacing consistent: {expected_gap}px")
        return True
    
    def verify_golden_ratio(self, width: float, height: float, name: str) -> bool:
        """Verify if element follows golden ratio (1.618)"""
        ratio = width / height if height > 0 else 0
        golden = 1.618
        if abs(ratio - golden) > 0.1:
            self.warnings.append(f"⚠️  {name} ratio: {ratio:.3f} (golden ratio: {golden})")
            return False
        self.successes.append(f"✅ {name} follows golden ratio: {ratio:.3f}")
        return True
    
    def verify_glass_morphism(self, backdrop_filter: str, background: str, element_name: str) -> bool:
        """Verify glass morphism effect is properly applied"""
        issues = []
        
        # Check backdrop filter
        if 'blur' not in backdrop_filter:
            issues.append(f"Missing blur in backdrop-filter")
        
        # Check background transparency
        if 'rgba' not in background or 'hsla' not in background:
            if not any(x in background for x in ['transparent', 'opacity']):
                issues.append(f"Background not transparent")
        
        if issues:
            self.issues.append(f"❌ Glass morphism broken on {element_name}: {', '.join(issues)}")
            return False
        
        self.successes.append(f"✅ Glass morphism correct on {element_name}")
        return True
    
    def verify_color_consistency(self, colors: Dict[str, List[str]]) -> bool:
        """Verify color palette consistency"""
        primary_colors = {
            'orange': ['#FF6B35', '#FFA500', '#FF8C00'],
            'blue': ['#4A90E2', '#5CA0F2', '#3B82F6'],
            'dark': ['#1A1A1A', '#2D2D2D', '#333333'],
            'light': ['#FFFFFF', '#F5F5F5', '#FAFAFA']
        }
        
        inconsistent = []
        for component, used_colors in colors.items():
            for color in used_colors:
                color_upper = color.upper()
                found = False
                for palette_name, palette_colors in primary_colors.items():
                    if color_upper in palette_colors:
                        found = True
                        break
                if not found and color_upper not in ['TRANSPARENT', 'INHERIT', 'CURRENTCOLOR']:
                    inconsistent.append(f"{component}: {color}")
        
        if inconsistent:
            self.issues.append(f"❌ Color inconsistency detected: {', '.join(inconsistent)}")
            return False
        
        self.successes.append(f"✅ Color palette consistent")
        return True
    
    def verify_z_index_hierarchy(self, elements: List[UIElement]) -> bool:
        """Verify z-index doesn't cause visual issues"""
        # Expected hierarchy
        expected_order = {
            'map': 0,
            'markers': 100,
            'overlays': 200,
            'panels': 300,
            'dock': 400,
            'modal': 500,
            'tooltip': 600
        }
        
        issues = []
        for elem in elements:
            elem_type = self._get_element_type(elem.name)
            expected_z = expected_order.get(elem_type, 0)
            
            # Check if z-index is wildly off
            if abs(elem.z_index - expected_z) > 100:
                issues.append(f"{elem.name}: z-index {elem.z_index} (expected ~{expected_z})")
        
        if issues:
            self.issues.append(f"❌ Z-index hierarchy issues: {', '.join(issues)}")
            return False
        
        self.successes.append(f"✅ Z-index hierarchy correct")
        return True
    
    def _get_element_type(self, name: str) -> str:
        """Determine element type from name"""
        name_lower = name.lower()
        if 'map' in name_lower:
            return 'map'
        elif 'marker' in name_lower:
            return 'markers'
        elif 'overlay' in name_lower:
            return 'overlays'
        elif 'panel' in name_lower or 'floating' in name_lower:
            return 'panels'
        elif 'dock' in name_lower:
            return 'dock'
        elif 'modal' in name_lower:
            return 'modal'
        elif 'tooltip' in name_lower:
            return 'tooltip'
        return 'unknown'
    
    def generate_report(self) -> str:
        """Generate comprehensive test report"""
        report = []
        report.append("=" * 60)
        report.append("BURNWISE FRONTEND VISUAL VERIFICATION REPORT")
        report.append(f"Timestamp: {datetime.now().isoformat()}")
        report.append("=" * 60)
        
        if self.issues:
            report.append("\n🚨 CRITICAL ISSUES:")
            for issue in self.issues:
                report.append(f"  {issue}")
        
        if self.warnings:
            report.append("\n⚠️  WARNINGS:")
            for warning in self.warnings:
                report.append(f"  {warning}")
        
        if self.successes:
            report.append("\n✅ PASSED CHECKS:")
            for success in self.successes:
                report.append(f"  {success}")
        
        # Summary
        total = len(self.issues) + len(self.warnings) + len(self.successes)
        pass_rate = (len(self.successes) / total * 100) if total > 0 else 0
        
        report.append("\n" + "=" * 60)
        report.append(f"SUMMARY: {len(self.successes)}/{total} passed ({pass_rate:.1f}%)")
        if self.issues:
            report.append("STATUS: ❌ FAILED - CRITICAL ISSUES FOUND")
        elif self.warnings:
            report.append("STATUS: ⚠️  PASSED WITH WARNINGS")
        else:
            report.append("STATUS: ✅ PERFECT - NO ISSUES")
        report.append("=" * 60)
        
        return "\n".join(report)

if __name__ == "__main__":
    # This will be populated by Playwright measurements
    verifier = UIVerifier()
    
    # Test data will come from Playwright
    # For now, print structure
    print("UI Verification Script Ready")
    print("Waiting for Playwright measurements...")