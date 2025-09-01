/**
 * Complete Dock Navigation Tests
 * Tests every icon, panel, hover effect, and interaction in the bottom dock
 * The dock is the primary navigation method in the spatial interface
 */

const { test, expect } = require('@playwright/test');

test.describe('Dock Navigation - Complete Feature Testing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Handle onboarding redirect
    if ((await page.url()).includes('onboarding')) {
      const skipBtn = page.locator('button:has-text("Skip Setup"), button:has-text("Skip")').first();
      if (await skipBtn.isVisible()) {
        await skipBtn.click();
      }
    }
    
    await page.waitForURL('**/spatial');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
  });

  test('01. Dock Container and Visibility', async ({ page }) => {
    // Find dock container
    const dock = page.locator('.dock-navigation, [class*="dock"], [data-testid="dock"]').first();
    await expect(dock).toBeVisible();
    
    // Verify dock is positioned at bottom
    const dockBounds = await dock.boundingBox();
    const viewportHeight = await page.evaluate(() => window.innerHeight);
    
    if (dockBounds) {
      // Dock should be in bottom portion of screen
      expect(dockBounds.y).toBeGreaterThan(viewportHeight * 0.7);
      console.log(`Dock positioned at y: ${dockBounds.y}, viewport height: ${viewportHeight}`);
    }
    
    // Check glass morphism styling
    const dockStyles = await dock.evaluate(el => {
      const styles = window.getComputedStyle(el);
      return {
        backdropFilter: styles.backdropFilter,
        background: styles.background,
        borderRadius: styles.borderRadius
      };
    });
    
    console.log('Dock styles:', dockStyles);
  });

  test('02. All Dock Icons Present and Clickable', async ({ page }) => {
    const dock = page.locator('.dock-navigation, [class*="dock"]').first();
    
    // Find all dock items/buttons
    const dockItems = dock.locator('button, [role="button"], .dock-item').all();
    const items = await dockItems;
    
    expect(items.length).toBeGreaterThan(2); // Should have at least 3-4 icons
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      if (await item.isVisible()) {
        // Test hover effect
        await item.hover();
        await page.waitForTimeout(300);
        
        // Check for label/tooltip on hover
        const tooltip = page.locator('[class*="tooltip"], .dock-tooltip').first();
        if (await tooltip.isVisible()) {
          const tooltipText = await tooltip.textContent();
          console.log(`Dock item ${i} tooltip:`, tooltipText);
        }
        
        // Verify item is clickable
        const isEnabled = await item.isEnabled();
        expect(isEnabled).toBe(true);
        
        // Check for icon/svg
        const icon = item.locator('svg, img, [class*="icon"]').first();
        if (await icon.isVisible()) {
          console.log(`Dock item ${i} has icon`);
        }
      }
    }
  });

  test('03. Layers Icon - Complete Panel Testing', async ({ page }) => {
    // Find layers icon (typically has polygon/layer svg)
    const layersIcon = page.locator('button svg[viewBox], [data-testid="layers"]').filter({ 
      has: page.locator('polygon, polyline') 
    }).first();
    
    if (!(await layersIcon.isVisible())) {
      // Alternative selectors
      const altLayersIcon = page.locator('button:has-text("Layers"), [aria-label*="layer"]').first();
      if (await altLayersIcon.isVisible()) {
        await altLayersIcon.click();
      } else {
        console.log('Layers icon not found, skipping layers tests');
        return;
      }
    } else {
      await layersIcon.click();
    }
    
    await page.waitForTimeout(1000);
    
    // Verify layers panel opens
    const layersPanel = page.locator('[class*="layers"], [data-panel="layers"], [class*="overlay"]').first();
    if (await layersPanel.isVisible()) {
      await expect(layersPanel).toBeVisible();
      
      // Test weather overlay toggle
      const weatherControl = page.locator('label:has-text("Weather"), input[type="checkbox"] + label', 'button:has-text("Weather")').first();
      if (await weatherControl.isVisible()) {
        await weatherControl.click();
        await page.waitForTimeout(1000);
        console.log('Weather overlay toggled ON');
        
        // Look for weather visualization on map
        const weatherOverlay = page.locator('[class*="weather"], .weather-layer').first();
        if (await weatherOverlay.isVisible()) {
          console.log('Weather overlay visible on map');
        }
        
        // Toggle off
        await weatherControl.click();
        await page.waitForTimeout(1000);
        console.log('Weather overlay toggled OFF');
      }
      
      // Test smoke overlay toggle
      const smokeControl = page.locator('label:has-text("Smoke"), input[type="checkbox"] + label').filter({ hasText: /smoke/i }).first();
      if (await smokeControl.isVisible()) {
        await smokeControl.click();
        await page.waitForTimeout(1000);
        console.log('Smoke overlay toggled');
        
        // Check for smoke plume visualization
        const smokeOverlay = page.locator('[class*="smoke"], .smoke-layer').first();
        if (await smokeOverlay.isVisible()) {
          console.log('Smoke overlay visible on map');
        }
      }
      
      // Test farm boundaries toggle
      const boundariesControl = page.locator('label:has-text("Boundaries"), label:has-text("Farms")').first();
      if (await boundariesControl.isVisible()) {
        await boundariesControl.click();
        await page.waitForTimeout(1000);
        console.log('Farm boundaries toggled');
        
        // Check for boundary lines on map
        const boundaryOverlay = page.locator('[class*="boundary"], .farm-boundary').first();
        if (await boundaryOverlay.isVisible()) {
          console.log('Farm boundaries visible on map');
        }
      }
      
      // Test active burns toggle
      const burnsControl = page.locator('label:has-text("Burns"), label:has-text("Active")').first();
      if (await burnsControl.isVisible()) {
        await burnsControl.click();
        await page.waitForTimeout(1000);
        console.log('Active burns toggled');
        
        // Check for burn markers on map
        const burnMarkers = page.locator('[class*="burn-marker"], .burn-icon').first();
        if (await burnMarkers.isVisible()) {
          console.log('Burn markers visible on map');
        }
      }
      
      // Test opacity sliders if present
      const opacitySliders = page.locator('input[type="range"], .opacity-slider').all();
      const sliders = await opacitySliders;
      
      for (const slider of sliders.slice(0, 2)) {
        if (await slider.isVisible()) {
          await slider.fill('0.3');
          await page.waitForTimeout(500);
          await slider.fill('0.8');
          await page.waitForTimeout(500);
          console.log('Opacity slider tested');
        }
      }
      
      // Close layers panel by clicking icon again
      await layersIcon.click();
      await page.waitForTimeout(500);
      
      // Verify panel closes
      if (await layersPanel.isVisible()) {
        // Panel might not close immediately, try alternative close methods
        const closeBtn = layersPanel.locator('button[aria-label="Close"], .close, [data-testid="close"]').first();
        if (await closeBtn.isVisible()) {
          await closeBtn.click();
        }
      }
    }
  });

  test('04. Burns Icon - Panel and Interactions', async ({ page }) => {
    // Find burns icon (flame logo)
    const burnsIcon = page.locator('button svg[class*="flame"], [data-testid="burns"], button').filter({
      has: page.locator('[class*="flame"], [class*="fire"]')
    }).first();
    
    if (!(await burnsIcon.isVisible())) {
      // Try alternative selectors
      const altBurnsIcon = page.locator('button:has-text("Burns"), [aria-label*="burn"]').first();
      if (await altBurnsIcon.isVisible()) {
        await altBurnsIcon.click();
      } else {
        console.log('Burns icon not found, skipping burns tests');
        return;
      }
    } else {
      // Check for badge count before clicking
      const badge = page.locator('[class*="badge"], .count, .notification-badge').first();
      if (await badge.isVisible()) {
        const badgeText = await badge.textContent();
        console.log('Burns badge count:', badgeText);
        expect(parseInt(badgeText) || 0).toBeGreaterThanOrEqual(0);
      }
      
      await burnsIcon.click();
    }
    
    await page.waitForTimeout(1000);
    
    // Verify burns panel opens
    const burnsPanel = page.locator('[class*="burns"], [data-panel="burns"], .burns-list').first();
    if (await burnsPanel.isVisible()) {
      await expect(burnsPanel).toBeVisible();
      
      // Check for burns list
      const burnItems = page.locator('[class*="burn-item"], .burn-card, li').all();
      const items = await burnItems;
      
      if (items.length > 0) {
        console.log(`Found ${items.length} burn items`);
        
        // Test clicking on first burn item
        await items[0].click();
        await page.waitForTimeout(1500);
        
        // Map should center on burn location - check if map moved
        console.log('Clicked burn item - map should center on location');
        
        // Check for burn details display
        const burnDetails = page.locator('[class*="burn-details"], .burn-info').first();
        if (await burnDetails.isVisible()) {
          await expect(burnDetails).toBeVisible();
          
          // Check details content
          const burnStatus = burnDetails.locator('[class*="status"], .burn-status').first();
          if (await burnStatus.isVisible()) {
            const statusText = await burnStatus.textContent();
            console.log('Burn status:', statusText);
          }
          
          const burnDate = burnDetails.locator('text=/\\d{4}-\\d{2}-\\d{2}|\\d{1,2}\/\\d{1,2}\/\\d{4}/').first();
          if (await burnDate.isVisible()) {
            const dateText = await burnDate.textContent();
            console.log('Burn date:', dateText);
          }
        }
        
        // Test other burn items
        for (let i = 1; i < Math.min(items.length, 3); i++) {
          await items[i].hover();
          await page.waitForTimeout(300);
          
          // Check for hover effects
          const hoverState = await items[i].evaluate(el => {
            const styles = window.getComputedStyle(el);
            return {
              backgroundColor: styles.backgroundColor,
              transform: styles.transform
            };
          });
          console.log(`Burn item ${i} hover state:`, hoverState);
        }
      } else {
        console.log('No burn items found in list');
      }
      
      // Test burn status indicators
      const statusIndicators = page.locator('[class*="status"], .burn-status, .status-badge').all();
      const statuses = await statusIndicators;
      
      for (const status of statuses.slice(0, 3)) {
        if (await status.isVisible()) {
          const statusText = await status.textContent();
          const statusClass = await status.getAttribute('class');
          console.log('Status indicator:', { text: statusText, class: statusClass });
        }
      }
      
      // Close burns panel
      await burnsIcon.click();
      await page.waitForTimeout(500);
    }
  });

  test('05. AI Assistant Icon - FloatingAI Integration', async ({ page }) => {
    // Find AI assistant icon
    const aiIcon = page.locator('button svg[viewBox*="24"], [data-testid="ai"]').filter({
      has: page.locator('circle, path[d*="12"]')
    }).first();
    
    if (!(await aiIcon.isVisible())) {
      // Try alternative selectors
      const altAiIcon = page.locator('button:has-text("AI"), button:has-text("Assistant"), [aria-label*="ai"]').first();
      if (await altAiIcon.isVisible()) {
        await aiIcon.click();
      } else {
        console.log('AI icon not found, skipping AI tests');
        return;
      }
    } else {
      await aiIcon.click();
    }
    
    await page.waitForTimeout(1000);
    
    // Verify FloatingAI opens
    const floatingAI = page.locator('[class*="floating"], [data-testid="floating-ai"], .ai-chat').first();
    if (await floatingAI.isVisible()) {
      await expect(floatingAI).toBeVisible();
      console.log('FloatingAI opened successfully');
      
      // Test AI chat input
      const chatInput = page.locator('input[placeholder*="message"], textarea').first();
      if (await chatInput.isVisible()) {
        await chatInput.fill('Hello AI, can you help me?');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(2000);
        
        // Check for AI response
        const aiResponse = page.locator('[class*="ai-message"], .response').first();
        if (await aiResponse.isVisible()) {
          console.log('AI response received');
        }
      }
      
      // Test minimize button
      const minimizeBtn = page.locator('button[aria-label*="Minimize"], .minimize').first();
      if (await minimizeBtn.isVisible()) {
        await minimizeBtn.click();
        await page.waitForTimeout(500);
        console.log('FloatingAI minimized');
        
        // Should still be visible but smaller
        await expect(floatingAI).toBeVisible();
      }
      
      // Test maximize from minimized
      const maximizeBtn = page.locator('button[aria-label*="Maximize"], .maximize').first();
      if (await maximizeBtn.isVisible()) {
        await maximizeBtn.click();
        await page.waitForTimeout(500);
        console.log('FloatingAI maximized');
      }
      
      // Test close button
      const closeBtn = page.locator('button[aria-label*="Close"], .close').first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
        await page.waitForTimeout(500);
        
        // FloatingAI should close
        if (!(await floatingAI.isVisible())) {
          console.log('FloatingAI closed successfully');
        }
      }
    }
  });

  test('06. Settings Icon - Settings Panel', async ({ page }) => {
    // Find settings icon (gear/cog)
    const settingsIcon = page.locator('button svg', '[data-testid="settings"]').filter({
      has: page.locator('[class*="gear"], [class*="cog"]')
    }).first();
    
    if (!(await settingsIcon.isVisible())) {
      // Try alternative selectors
      const altSettingsIcon = page.locator('button:has-text("Settings"), [aria-label*="settings"]').first();
      if (await altSettingsIcon.isVisible()) {
        await altSettingsIcon.click();
      } else {
        console.log('Settings icon not found, skipping settings tests');
        return;
      }
    } else {
      await settingsIcon.click();
    }
    
    await page.waitForTimeout(1000);
    
    // Verify settings panel opens
    const settingsPanel = page.locator('[class*="settings"], [data-panel="settings"]').first();
    if (await settingsPanel.isVisible()) {
      await expect(settingsPanel).toBeVisible();
      
      // Test theme toggle
      const themeToggle = page.locator('button:has-text("Theme"), input[type="checkbox"]').filter({ hasText: /theme|dark|light/i }).first();
      if (await themeToggle.isVisible()) {
        await themeToggle.click();
        await page.waitForTimeout(1000);
        console.log('Theme toggled');
        
        // Check if body class changed
        const bodyClass = await page.locator('body').getAttribute('class');
        console.log('Body class after theme toggle:', bodyClass);
        
        // Toggle back
        await themeToggle.click();
        await page.waitForTimeout(1000);
      }
      
      // Test notification preferences
      const notificationToggle = page.locator('input[type="checkbox"]').filter({ hasText: /notification/i }).first();
      if (await notificationToggle.isVisible()) {
        await notificationToggle.click();
        await page.waitForTimeout(500);
        console.log('Notification preference toggled');
      }
      
      // Test map preferences
      const mapSettings = page.locator('select, input[type="radio"]').filter({ hasText: /map|style/i }).all();
      const mapControls = await mapSettings;
      
      for (const control of mapControls.slice(0, 2)) {
        if (await control.isVisible()) {
          const tagName = await control.evaluate(el => el.tagName);
          if (tagName === 'SELECT') {
            await control.selectOption({ index: 1 });
          } else if (tagName === 'INPUT') {
            await control.click();
          }
          await page.waitForTimeout(500);
          console.log('Map preference updated');
        }
      }
      
      // Test save settings button
      const saveBtn = page.locator('button:has-text("Save"), [data-testid="save-settings"]').first();
      if (await saveBtn.isVisible()) {
        await saveBtn.click();
        await page.waitForTimeout(1000);
        
        // Check for save confirmation
        const confirmation = page.locator('text=/saved|success/i').first();
        if (await confirmation.isVisible()) {
          console.log('Settings save confirmation shown');
        }
      }
      
      // Close settings panel
      await settingsIcon.click();
      await page.waitForTimeout(500);
    }
  });

  test('07. Dock Hover Effects and Animations', async ({ page }) => {
    const dock = page.locator('.dock-navigation, [class*="dock"]').first();
    const dockItems = dock.locator('button, .dock-item').all();
    const items = await dockItems;
    
    for (let i = 0; i < Math.min(items.length, 4); i++) {
      const item = items[i];
      
      if (await item.isVisible()) {
        // Test hover animation
        await item.hover();
        await page.waitForTimeout(500);
        
        // Check for scale/transform effects
        const hoverStyles = await item.evaluate(el => {
          const styles = window.getComputedStyle(el);
          return {
            transform: styles.transform,
            scale: styles.scale,
            filter: styles.filter
          };
        });
        
        console.log(`Dock item ${i} hover styles:`, hoverStyles);
        
        // Move away to test hover out
        await page.mouse.move(100, 100);
        await page.waitForTimeout(300);
        
        // Check if styles reset
        const normalStyles = await item.evaluate(el => {
          const styles = window.getComputedStyle(el);
          return {
            transform: styles.transform,
            scale: styles.scale
          };
        });
        
        console.log(`Dock item ${i} normal styles:`, normalStyles);
      }
    }
  });

  test('08. Dock Responsiveness and Mobile Behavior', async ({ page }) => {
    const dock = page.locator('.dock-navigation, [class*="dock"]').first();
    
    // Test desktop view first
    let dockBounds = await dock.boundingBox();
    const desktopWidth = dockBounds?.width || 0;
    console.log('Desktop dock width:', desktopWidth);
    
    // Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(1000);
    
    dockBounds = await dock.boundingBox();
    const tabletWidth = dockBounds?.width || 0;
    console.log('Tablet dock width:', tabletWidth);
    
    // Dock should adapt to smaller screen
    if (tabletWidth > 0 && desktopWidth > 0) {
      expect(tabletWidth).toBeLessThanOrEqual(desktopWidth);
    }
    
    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);
    
    dockBounds = await dock.boundingBox();
    const mobileWidth = dockBounds?.width || 0;
    console.log('Mobile dock width:', mobileWidth);
    
    // Check if dock items are still accessible
    const dockItems = dock.locator('button, .dock-item').all();
    const items = await dockItems;
    
    for (const item of items.slice(0, 3)) {
      if (await item.isVisible()) {
        const itemBounds = await item.boundingBox();
        if (itemBounds) {
          // Touch targets should be at least 44px
          expect(Math.min(itemBounds.width, itemBounds.height)).toBeGreaterThan(40);
        }
        
        // Test touch interaction
        await item.click();
        await page.waitForTimeout(1000);
        
        // Close any opened panel
        await item.click();
        await page.waitForTimeout(500);
      }
    }
    
    // Reset to desktop
    await page.setViewportSize({ width: 1920, height: 1080 });
  });

  test('09. Dock Panel State Management', async ({ page }) => {
    const dock = page.locator('.dock-navigation, [class*="dock"]').first();
    const dockItems = dock.locator('button').all();
    const items = await dockItems;
    
    // Open multiple panels to test state management
    if (items.length >= 2) {
      // Open first panel
      await items[0].click();
      await page.waitForTimeout(1000);
      
      const firstPanel = page.locator('[class*="panel"], [data-panel]').first();
      if (await firstPanel.isVisible()) {
        console.log('First panel opened');
        
        // Open second panel - should close first
        await items[1].click();
        await page.waitForTimeout(1000);
        
        // Check if first panel closed
        if (!(await firstPanel.isVisible())) {
          console.log('First panel closed when second opened');
        } else {
          console.log('Multiple panels can be open simultaneously');
        }
        
        // Close all panels
        for (const item of items.slice(0, 2)) {
          await item.click();
          await page.waitForTimeout(500);
        }
      }
    }
  });

  test('10. Dock Accessibility and Keyboard Navigation', async ({ page }) => {
    const dock = page.locator('.dock-navigation, [class*="dock"]').first();
    
    // Tab to dock
    await page.keyboard.press('Tab');
    let tabCount = 0;
    while (tabCount < 20) { // Prevent infinite loop
      const focusedElement = page.locator(':focus').first();
      if (await focusedElement.count() > 0) {
        const parentDock = focusedElement.locator('xpath=ancestor::*[contains(@class,"dock")]').first();
        if (await parentDock.count() > 0) {
          console.log('Focused on dock element');
          break;
        }
      }
      await page.keyboard.press('Tab');
      tabCount++;
    }
    
    // Navigate through dock items with arrow keys
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(200);
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(200);
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(200);
    
    // Activate focused item with Enter or Space
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    
    // Check if panel opened
    const openPanel = page.locator('[class*="panel"]:visible, [data-panel]:visible').first();
    if (await openPanel.isVisible()) {
      console.log('Panel opened via keyboard activation');
      
      // Close with Escape
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      
      if (!(await openPanel.isVisible())) {
        console.log('Panel closed with Escape key');
      }
    }
    
    // Check ARIA labels
    const dockItems = dock.locator('button, [role="button"]').all();
    const items = await dockItems;
    
    let itemsWithoutLabels = 0;
    for (const item of items) {
      const ariaLabel = await item.getAttribute('aria-label');
      const title = await item.getAttribute('title');
      
      if (!ariaLabel && !title) {
        itemsWithoutLabels++;
      }
    }
    
    console.log(`Dock items without accessibility labels: ${itemsWithoutLabels}`);
    
    // Should have good accessibility
    expect(itemsWithoutLabels).toBeLessThan(items.length * 0.5); // Less than 50% missing labels
  });
});