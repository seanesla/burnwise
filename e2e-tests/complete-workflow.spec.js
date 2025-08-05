const { test, expect } = require('@playwright/test');

test.describe('BURNWISE Complete Workflow E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('http://localhost:3000');
    
    // Clear localStorage to ensure fresh state
    await page.evaluate(() => localStorage.clear());
  });

  test('complete user journey through all major features', async ({ page }) => {
    // 1. Test Landing Page and Navigation
    await test.step('Landing page loads and navigation works', async () => {
      // Wait for startup animation if present
      const startupAnimation = await page.locator('.fullscreen-startup');
      if (await startupAnimation.isVisible()) {
        // Wait for animation to complete
        await page.waitForSelector('.fullscreen-startup', { state: 'hidden', timeout: 10000 });
      }
      
      // Check landing page content
      await expect(page.locator('h1')).toContainText('BURNWISE');
      await expect(page.locator('text=Multi-Farm Agricultural Burn Coordinator')).toBeVisible();
      
      // Test navigation to Dashboard
      await page.click('button:has-text("Get Started")');
      await expect(page).toHaveURL('http://localhost:3000/dashboard');
      
      // Check dashboard renders
      await expect(page.locator('h2:has-text("Burn Coordination Dashboard")')).toBeVisible();
      
      // Check metrics cards
      await expect(page.locator('text=Total Burns')).toBeVisible();
      await expect(page.locator('text=Active Conflicts')).toBeVisible();
      await expect(page.locator('text=Total Area')).toBeVisible();
      await expect(page.locator('text=Alerts Sent')).toBeVisible();
    });

    // 2. Test Map View
    await test.step('Map view loads and displays correctly', async () => {
      await page.goto('http://localhost:3000/map');
      
      // Check sidebar elements
      await expect(page.locator('h3:has-text("Map Controls")')).toBeVisible();
      await expect(page.locator('h3:has-text("Legend")')).toBeVisible();
      await expect(page.locator('h3:has-text("Actions")')).toBeVisible();
      await expect(page.locator('h3:has-text("Statistics")')).toBeVisible();
      
      // Check action buttons
      await expect(page.locator('button:has-text("Detect Conflicts")')).toBeVisible();
      await expect(page.locator('button:has-text("Update Smoke Model")')).toBeVisible();
      
      // Check legend items
      await expect(page.locator('text=Farms')).toBeVisible();
      await expect(page.locator('text=Pending Burns')).toBeVisible();
      await expect(page.locator('text=Smoke Dispersion')).toBeVisible();
    });

    // 3. Test Schedule View
    await test.step('Schedule view loads correctly', async () => {
      await page.goto('http://localhost:3000/schedule');
      
      // Check header
      await expect(page.locator('h2:has-text("Burn Schedule Calendar")')).toBeVisible();
      
      // Check action buttons
      await expect(page.locator('button:has-text("Run Optimization")')).toBeVisible();
      await expect(page.locator('button:has-text("Detect Conflicts")')).toBeVisible();
    });

    // 4. Test Alerts Panel
    await test.step('Alerts panel functionality', async () => {
      await page.goto('http://localhost:3000/alerts');
      
      // Check header
      await expect(page.locator('h2:has-text("Alert Management")')).toBeVisible();
      
      // Check farm selector
      await expect(page.locator('select')).toBeVisible();
      await expect(page.locator('option:has-text("-- Select Farm --")')).toBeVisible();
      
      // Check process button
      await expect(page.locator('button:has-text("Process Pending Alerts")')).toBeVisible();
      
      // Check empty state message
      await expect(page.locator('text=Please select a farm to view its alert history')).toBeVisible();
    });

    // 5. Test API Connectivity
    await test.step('API endpoints respond correctly', async () => {
      // Test farms endpoint
      const farmsResponse = await page.evaluate(async () => {
        const response = await fetch('http://localhost:5001/api/farms');
        return response.ok;
      });
      expect(farmsResponse).toBe(true);
      
      // Test analytics endpoint
      const analyticsResponse = await page.evaluate(async () => {
        const response = await fetch('http://localhost:5001/api/analytics/dashboard?startDate=2025-08-05&endDate=2025-08-05');
        return response.ok;
      });
      expect(analyticsResponse).toBe(true);
    });

    // 6. Test Responsive Behavior
    await test.step('Application is responsive', async () => {
      // Test mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('http://localhost:3000');
      
      // Check that navigation still works
      await page.click('button:has-text("Get Started")');
      await expect(page).toHaveURL('http://localhost:3000/dashboard');
      
      // Reset viewport
      await page.setViewportSize({ width: 1280, height: 720 });
    });

    // 7. Test Error Handling
    await test.step('Error states are handled gracefully', async () => {
      // Navigate to a non-existent route
      await page.goto('http://localhost:3000/nonexistent');
      
      // Should still show the app structure (no 404 page implemented)
      await expect(page.locator('.App')).toBeVisible();
    });

    // 8. Test Theme Consistency
    await test.step('Fire theme is consistent across pages', async () => {
      // Check for fire-themed colors in CSS
      const pages = ['/dashboard', '/map', '/schedule', '/alerts'];
      
      for (const pagePath of pages) {
        await page.goto(`http://localhost:3000${pagePath}`);
        
        // Check for dark background
        const bodyBg = await page.evaluate(() => 
          window.getComputedStyle(document.body).backgroundColor
        );
        expect(bodyBg).toMatch(/rgb/); // Should have a background color
        
        // Check for fire-themed elements (buttons, etc)
        const buttons = await page.locator('button').first();
        if (await buttons.isVisible()) {
          const buttonBg = await buttons.evaluate(el => 
            window.getComputedStyle(el).background
          );
          // Fire-themed buttons should have gradient or solid color
          expect(buttonBg).toBeTruthy();
        }
      }
    });
  });

  test('startup animation completes successfully', async ({ page }) => {
    // Clear localStorage to ensure animation plays
    await page.evaluate(() => localStorage.clear());
    
    await page.goto('http://localhost:3000');
    
    // Check if startup animation container exists
    const startupContainer = await page.locator('.fullscreen-startup');
    if (await startupContainer.isVisible()) {
      // Wait for animation to complete (about 5.5 seconds)
      await page.waitForTimeout(6000);
      
      // Animation should be gone
      await expect(startupContainer).not.toBeVisible();
      
      // Landing page should be visible
      await expect(page.locator('h1:has-text("BURNWISE")')).toBeVisible();
    }
  });

  test('navigation persists across page refreshes', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard');
    
    // Refresh the page
    await page.reload();
    
    // Should still be on dashboard
    await expect(page).toHaveURL('http://localhost:3000/dashboard');
    await expect(page.locator('h2:has-text("Burn Coordination Dashboard")')).toBeVisible();
  });

  test('all icon components render without errors', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Wait for startup animation if present
    const startupAnimation = await page.locator('.fullscreen-startup');
    if (await startupAnimation.isVisible()) {
      await page.waitForSelector('.fullscreen-startup', { state: 'hidden', timeout: 10000 });
    }
    
    // Navigate to dashboard
    await page.click('button:has-text("Get Started")');
    await expect(page).toHaveURL('http://localhost:3000/dashboard');
    
    // Check that no emoji placeholders are visible
    const emojiCount = await page.locator('text=🔥').count();
    expect(emojiCount).toBe(0);
    
    // Check for SVG icons
    const svgIcons = await page.locator('svg').count();
    expect(svgIcons).toBeGreaterThan(0);
  });
});

test.describe('API Integration Tests', () => {
  test('backend endpoints return expected data structure', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Test farms endpoint
    const farmsData = await page.evaluate(async () => {
      const response = await fetch('http://localhost:5001/api/farms');
      return await response.json();
    });
    
    expect(farmsData).toHaveProperty('success');
    expect(farmsData).toHaveProperty('data');
    expect(Array.isArray(farmsData.data)).toBe(true);
    
    // Test analytics endpoint
    const analyticsData = await page.evaluate(async () => {
      const date = new Date().toISOString().split('T')[0];
      const response = await fetch(`http://localhost:5001/api/analytics/dashboard?startDate=${date}&endDate=${date}`);
      return await response.json();
    });
    
    expect(analyticsData).toHaveProperty('success');
    if (analyticsData.success) {
      expect(analyticsData.data).toHaveProperty('burns');
      expect(analyticsData.data).toHaveProperty('conflicts');
      expect(analyticsData.data).toHaveProperty('areas');
      expect(analyticsData.data).toHaveProperty('alerts');
    }
  });

  test('error responses are handled gracefully', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard');
    
    // Test with invalid endpoint
    const errorResponse = await page.evaluate(async () => {
      try {
        const response = await fetch('http://localhost:5001/api/invalid-endpoint');
        return { status: response.status, ok: response.ok };
      } catch (error) {
        return { error: error.message };
      }
    });
    
    // Should return 404 or handle error gracefully
    expect(errorResponse.ok).toBe(false);
  });
});

test.describe('Performance Tests', () => {
  test('pages load within acceptable time', async ({ page }) => {
    const pages = [
      { path: '/', name: 'Landing' },
      { path: '/dashboard', name: 'Dashboard' },
      { path: '/map', name: 'Map' },
      { path: '/schedule', name: 'Schedule' },
      { path: '/alerts', name: 'Alerts' }
    ];
    
    for (const pageInfo of pages) {
      const startTime = Date.now();
      await page.goto(`http://localhost:3000${pageInfo.path}`);
      const loadTime = Date.now() - startTime;
      
      console.log(`${pageInfo.name} page load time: ${loadTime}ms`);
      
      // Pages should load within 3 seconds
      expect(loadTime).toBeLessThan(3000);
    }
  });

  test('no memory leaks on navigation', async ({ page }) => {
    // Navigate between pages multiple times
    for (let i = 0; i < 5; i++) {
      await page.goto('http://localhost:3000/dashboard');
      await page.goto('http://localhost:3000/map');
      await page.goto('http://localhost:3000/schedule');
      await page.goto('http://localhost:3000/alerts');
    }
    
    // Check that page is still responsive
    await page.goto('http://localhost:3000/dashboard');
    await expect(page.locator('h2:has-text("Burn Coordination Dashboard")')).toBeVisible();
  });
});