/**
 * BURNWISE Phase 5: Dock Navigation Tests
 * Tests the 4-icon bottom dock replacing 8 navigation tabs
 * macOS-inspired minimalist navigation
 */

const { test, expect } = require('@playwright/test');

test.describe('Dock Navigation - 4-Icon Bottom Bar', () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    // Login with real test user
    await page.goto('http://localhost:3000/login');
    await page.fill('input[type="email"]', 'robert@goldenfields.com');
    await page.fill('input[type="password"]', 'TestPassword123!');
    await page.click('button:has-text("Sign In")');
    
    // Handle onboarding if it appears
    const onboardingUrl = await page.url();
    if (onboardingUrl.includes('onboarding')) {
      // Skip onboarding
      await page.click('button:has-text("Skip Setup")');
    }
    
    // Wait for spatial interface
    await page.waitForURL('**/spatial');
    await page.waitForLoadState('networkidle');
  });

  test('Dock appears at bottom with exactly 4 icons', async ({ page }) => {
    console.log('🎯 Testing 4-icon dock...');
    
    // Find dock navigation
    const dock = page.locator('.dock-navigation, .dock, .bottom-dock, [data-testid="dock"]');
    await expect(dock).toBeVisible();
    
    // Verify position at bottom
    const dockBox = await dock.boundingBox();
    const viewport = page.viewportSize();
    
    // Dock should be near bottom of viewport
    expect(dockBox.y + dockBox.height).toBeGreaterThan(viewport.height - 100);
    console.log('✅ Dock positioned at bottom');
    
    // Count dock items
    const dockItems = dock.locator('.dock-item, .dock-icon, [role="button"]');
    const itemCount = await dockItems.count();
    
    // Should have exactly 4 icons (replaced 8 tabs)
    expect(itemCount).toBe(4);
    console.log('✅ Exactly 4 icons in dock (simplified from 8 tabs)');
    
    // Verify the 4 essential functions
    const expectedIcons = ['map', 'ai', 'burns', 'settings'];
    for (let i = 0; i < itemCount; i++) {
      const item = dockItems.nth(i);
      const label = await item.getAttribute('aria-label') || 
                   await item.getAttribute('title') ||
                   await item.textContent();
      
      const hasExpectedIcon = expectedIcons.some(icon => 
        label.toLowerCase().includes(icon) ||
        label.toLowerCase().includes('layer') || // Map layers
        label.toLowerCase().includes('assistant') || // AI
        label.toLowerCase().includes('active') || // Active burns
        label.toLowerCase().includes('user') // Settings/user
      );
      
      expect(hasExpectedIcon).toBeTruthy();
    }
  });

  test('Dock icons have magnetic snap animations on hover', async ({ page }) => {
    console.log('🧲 Testing magnetic snap animations...');
    
    const dock = page.locator('.dock-navigation, .dock');
    const dockItems = dock.locator('.dock-item, .dock-icon');
    
    // Get first dock item
    const firstItem = dockItems.first();
    const initialBox = await firstItem.boundingBox();
    
    // Hover over item
    await firstItem.hover();
    await page.waitForTimeout(200); // Wait for animation
    
    // Check if transform/scale is applied
    const hoverStyles = await firstItem.evaluate(el => {
      const computed = window.getComputedStyle(el);
      return {
        transform: computed.transform,
        scale: computed.scale,
        transition: computed.transition
      };
    });
    
    // Should have transform or scale effect
    const hasAnimation = 
      (hoverStyles.transform && hoverStyles.transform !== 'none') ||
      (hoverStyles.scale && hoverStyles.scale !== '1');
    
    expect(hasAnimation).toBeTruthy();
    console.log('✅ Magnetic snap animations on hover');
    
    // Move away and verify return to normal
    await page.mouse.move(0, 0);
    await page.waitForTimeout(200);
    
    const normalStyles = await firstItem.evaluate(el => {
      const computed = window.getComputedStyle(el);
      return computed.transform;
    });
    
    expect(normalStyles).toMatch(/none|matrix\(1/); // Back to normal
  });

  test('Active burns badge shows real-time count', async ({ page }) => {
    console.log('🔢 Testing active burns badge...');
    
    const dock = page.locator('.dock-navigation, .dock');
    
    // Find burns icon (should have badge)
    const burnsIcon = dock.locator('.dock-item').filter({ 
      hasText: /burn|active/i 
    }).or(dock.locator('[aria-label*="burn" i], [title*="burn" i]'));
    
    if (await burnsIcon.count() > 0) {
      // Look for badge
      const badge = burnsIcon.locator('.badge, .dock-badge, .count');
      
      if (await badge.count() > 0) {
        await expect(badge).toBeVisible();
        
        const badgeText = await badge.textContent();
        expect(badgeText).toMatch(/\d+/); // Should be a number
        
        const count = parseInt(badgeText);
        expect(count).toBeGreaterThanOrEqual(0);
        console.log(`✅ Active burns badge shows: ${count}`);
      } else {
        console.log('ℹ️ No active burns currently');
      }
    }
  });

  test('Dock icons open respective panels/overlays', async ({ page }) => {
    console.log('🎨 Testing dock icon functionality...');
    
    const dock = page.locator('.dock-navigation, .dock');
    const dockItems = dock.locator('.dock-item, .dock-icon');
    
    // Test each dock icon
    for (let i = 0; i < await dockItems.count(); i++) {
      const item = dockItems.nth(i);
      const label = await item.getAttribute('aria-label') || 
                   await item.getAttribute('title') || '';
      
      await item.click();
      await page.waitForTimeout(500); // Wait for panel animation
      
      // Check what opened based on icon type
      if (label.toLowerCase().includes('layer') || label.toLowerCase().includes('map')) {
        // Map layers panel
        const layersPanel = page.locator('.layers-panel, .map-controls, [data-testid="layers"]');
        expect(await layersPanel.count()).toBeGreaterThan(0);
        console.log('✅ Map layers panel opens');
      } else if (label.toLowerCase().includes('ai') || label.toLowerCase().includes('assistant')) {
        // AI assistant
        const aiPanel = page.locator('.floating-ai.expanded, .ai-chat-interface');
        expect(await aiPanel.count()).toBeGreaterThan(0);
        console.log('✅ AI assistant opens');
      } else if (label.toLowerCase().includes('burn') || label.toLowerCase().includes('active')) {
        // Active burns panel
        const burnsPanel = page.locator('.burns-panel, .active-burns, [data-testid="burns"]');
        expect(await burnsPanel.count()).toBeGreaterThan(0);
        console.log('✅ Active burns panel opens');
      } else if (label.toLowerCase().includes('setting') || label.toLowerCase().includes('user')) {
        // Settings panel
        const settingsPanel = page.locator('.settings-panel, .user-menu, [data-testid="settings"]');
        expect(await settingsPanel.count()).toBeGreaterThan(0);
        console.log('✅ Settings panel opens');
      }
      
      // Close panel if possible
      const closeButton = page.locator('.close-panel, .panel-close, [aria-label="Close"]').first();
      if (await closeButton.count() > 0 && await closeButton.isVisible()) {
        await closeButton.click();
        await page.waitForTimeout(300);
      }
    }
  });

  test('Glass morphism effect on dock', async ({ page }) => {
    console.log('🥃 Testing glass morphism design...');
    
    const dock = page.locator('.dock-navigation, .dock, .dock-container');
    
    // Get computed styles
    const styles = await dock.evaluate(el => {
      const computed = window.getComputedStyle(el);
      return {
        backdropFilter: computed.backdropFilter,
        background: computed.background,
        border: computed.border,
        borderRadius: computed.borderRadius,
        boxShadow: computed.boxShadow
      };
    });
    
    // Verify glass morphism properties
    expect(styles.backdropFilter).toContain('blur');
    expect(styles.background).toMatch(/rgba|transparent/);
    expect(styles.borderRadius).not.toBe('0px');
    
    console.log('✅ Glass morphism effect applied to dock');
    
    // Check semi-transparency
    const opacity = await dock.evaluate(el => {
      const bg = window.getComputedStyle(el).backgroundColor;
      const match = bg.match(/rgba?\([\d\s,]+\)/);
      if (match && bg.includes('rgba')) {
        const alpha = bg.match(/[\d.]+(?=\))/)[0];
        return parseFloat(alpha);
      }
      return 1;
    });
    
    expect(opacity).toBeLessThan(1);
    console.log(`✅ Semi-transparent background (opacity: ${opacity})`);
  });

  test('NO traditional 8-tab navigation exists', async ({ page }) => {
    console.log('🚫 Verifying 8 tabs replaced by 4 icons...');
    
    // Check for old navigation elements that should NOT exist
    const oldNavElements = [
      '.nav-tabs',
      '.navigation-tabs',
      'nav.primary-nav',
      '.main-menu',
      'ul.nav',
      '[role="tablist"]'
    ];
    
    for (const selector of oldNavElements) {
      const count = await page.locator(selector).count();
      expect(count).toBe(0);
    }
    
    // Specifically check for the old 8 tab labels
    const oldTabs = [
      'Dashboard',
      'Map View', 
      'Schedule',
      'Request Burn',
      'Analytics',
      'Alerts',
      'Agent Chat',
      'Settings'
    ];
    
    for (const tabName of oldTabs) {
      // These should not exist as navigation tabs
      const tabElement = page.locator(`nav >> text="${tabName}"`);
      expect(await tabElement.count()).toBe(0);
    }
    
    console.log('✅ Successfully replaced 8 tabs with 4-icon dock');
  });
});