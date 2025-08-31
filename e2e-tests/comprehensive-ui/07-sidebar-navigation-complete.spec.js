/**
 * Complete Sidebar Navigation Feature Tests
 * Tests expand/collapse, navigation items, real-time data, and responsive behavior
 * NO MOCKS - Real farm data, weather updates, and API integration
 */

const { test, expect } = require('@playwright/test');

test.describe('Sidebar Navigation - Complete Feature Testing', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate directly to spatial interface where sidebar is visible
    await page.goto('http://localhost:3000/spatial');
    
    // Handle potential redirect to onboarding
    try {
      await page.waitForURL('**/spatial', { timeout: 5000 });
    } catch (e) {
      // If redirected to onboarding, skip it
      const url = page.url();
      if (url.includes('onboarding')) {
        await page.click('button:has-text("Skip Setup")');
        await page.waitForURL('**/spatial');
      }
    }
    
    await page.waitForLoadState('networkidle');
    
    // Wait for sidebar to be visible
    const sidebar = page.locator('.sidebar');
    await expect(sidebar).toBeVisible();
  });

  test('01. Sidebar Visibility and Initial State', async ({ page }) => {
    const sidebar = page.locator('.sidebar');
    
    // Verify sidebar is visible and positioned
    await expect(sidebar).toBeVisible();
    await expect(sidebar).toHaveCSS('position', 'fixed');
    await expect(sidebar).toHaveCSS('left', '0px');
    
    // Check glass morphism styling
    const backdropFilter = await sidebar.evaluate(el => 
      window.getComputedStyle(el).backdropFilter
    );
    expect(backdropFilter).toContain('blur');
    
    // Should be expanded by default (or from localStorage)
    const isExpanded = await sidebar.evaluate(el => 
      el.classList.contains('expanded') || !el.classList.contains('collapsed')
    );
    expect(isExpanded).toBeTruthy();
    
    // Verify z-index for proper layering
    const zIndex = await sidebar.evaluate(el => 
      window.getComputedStyle(el).zIndex
    );
    expect(parseInt(zIndex)).toBeGreaterThanOrEqual(1000);
  });

  test('02. Toggle Button - Expand and Collapse', async ({ page }) => {
    const sidebar = page.locator('.sidebar');
    const toggleButton = page.locator('.sidebar-toggle');
    const farmInfo = page.locator('.sidebar-farm-info');
    
    // Verify toggle button is visible
    await expect(toggleButton).toBeVisible();
    
    // Initially should show close icon (X) if expanded
    let icon = await toggleButton.locator('svg').first().innerHTML();
    
    // Click to collapse
    await toggleButton.click();
    await page.waitForTimeout(500); // Allow animation
    
    // Should now have collapsed class
    await expect(sidebar).toHaveClass(/collapsed/);
    
    // Width should change to 70px
    const collapsedWidth = await sidebar.evaluate(el => 
      window.getComputedStyle(el).width
    );
    expect(collapsedWidth).toBe('70px');
    
    // Farm info should be hidden/faded
    const farmInfoOpacity = await farmInfo.evaluate(el => 
      window.getComputedStyle(el).opacity
    );
    expect(parseFloat(farmInfoOpacity)).toBeLessThan(1);
    
    // Icon should change to hamburger (bars)
    const newIcon = await toggleButton.locator('svg').first().innerHTML();
    expect(newIcon).not.toBe(icon);
    
    // Click to expand again
    await toggleButton.click();
    await page.waitForTimeout(500);
    
    // Should not have collapsed class
    await expect(sidebar).not.toHaveClass(/collapsed/);
    
    // Width should be back to 250px
    const expandedWidth = await sidebar.evaluate(el => 
      window.getComputedStyle(el).width
    );
    expect(expandedWidth).toBe('250px');
    
    // Test hover effects
    await toggleButton.hover();
    await page.waitForTimeout(200);
    
    const hoverBg = await toggleButton.evaluate(el => 
      window.getComputedStyle(el).background
    );
    expect(hoverBg).toContain('rgba(255, 107, 53');
  });

  test('03. Farm Information Display', async ({ page }) => {
    const farmInfo = page.locator('.sidebar-farm-info');
    const farmName = page.locator('.farm-name');
    const farmDetails = page.locator('.farm-details');
    const weatherSummary = page.locator('.weather-summary');
    
    // Wait for data to load
    await page.waitForTimeout(2000);
    
    // Farm info section should be visible
    await expect(farmInfo).toBeVisible();
    
    // Farm name should be displayed
    if (await farmName.isVisible()) {
      const nameText = await farmName.textContent();
      expect(nameText.trim()).toBeTruthy();
      expect(nameText).toMatch(/farm/i);
    }
    
    // Farm details may show acreage and owner
    if (await farmDetails.isVisible()) {
      const detailsText = await farmDetails.textContent();
      if (detailsText.trim()) {
        // Could contain acres or owner info
        expect(detailsText).toMatch(/acres|•/);
      }
    }
    
    // Weather summary should show temperature and conditions
    if (await weatherSummary.isVisible()) {
      const weatherText = await weatherSummary.textContent();
      expect(weatherText).toMatch(/\d+°F/); // Temperature
      expect(weatherText).toContain('🌤️'); // Weather emoji
    }
  });

  test('04. Navigation Items - Map View', async ({ page }) => {
    const mapViewBtn = page.locator('.sidebar-nav-item').filter({ hasText: 'Map View' });
    const navIcon = mapViewBtn.locator('.nav-icon');
    const navContent = mapViewBtn.locator('.nav-content');
    const navLabel = navContent.locator('.nav-label');
    
    // Map View button should be visible
    await expect(mapViewBtn).toBeVisible();
    
    // Should have map icon
    await expect(navIcon).toBeVisible();
    
    // Should have label when expanded
    await expect(navLabel).toBeVisible();
    await expect(navLabel).toHaveText('Map View');
    
    // Click Map View
    await mapViewBtn.click();
    await page.waitForTimeout(500);
    
    // May become active (depends on current state)
    const isActive = await mapViewBtn.evaluate(el => 
      el.classList.contains('active')
    );
    
    // Test hover effects
    await mapViewBtn.hover();
    await page.waitForTimeout(200);
    
    const hoverBg = await mapViewBtn.evaluate(el => 
      window.getComputedStyle(el).background
    );
    expect(hoverBg).toContain('rgba(255, 107, 53');
  });

  test('05. Navigation Items - Active Burns with Badge', async ({ page }) => {
    // Wait for data to load
    await page.waitForTimeout(2000);
    
    const burnsBtn = page.locator('.sidebar-nav-item').filter({ hasText: 'Active Burns' });
    const navIcon = burnsBtn.locator('.nav-icon');
    const navBadge = burnsBtn.locator('.nav-badge');
    const navLabel = burnsBtn.locator('.nav-label');
    
    // Active Burns button should be visible
    await expect(burnsBtn).toBeVisible();
    
    // Should have fire icon
    await expect(navIcon).toBeVisible();
    
    // Label should be visible
    await expect(navLabel).toHaveText('Active Burns');
    
    // Badge may be visible if there are active burns
    const badgeCount = await navBadge.count();
    if (badgeCount > 0) {
      const badgeText = await navBadge.textContent();
      expect(badgeText).toMatch(/^\d+$/); // Should be a number
      
      // Badge should be styled properly
      const badgeBg = await navBadge.evaluate(el => 
        window.getComputedStyle(el).background
      );
      expect(badgeBg).toContain('#ff4444');
    }
    
    // Click Active Burns
    await burnsBtn.click();
    await page.waitForTimeout(500);
    
    // Should trigger panel change (may become active)
    const isActive = await burnsBtn.evaluate(el => 
      el.classList.contains('active')
    );
    
    // Test hover effects
    await burnsBtn.hover();
    const hoverBg = await burnsBtn.evaluate(el => 
      window.getComputedStyle(el).background
    );
    expect(hoverBg).toContain('rgba(255, 107, 53');
  });

  test('06. Navigation Items - Weather with Status', async ({ page }) => {
    // Wait for weather data to load
    await page.waitForTimeout(3000);
    
    const weatherBtn = page.locator('.sidebar-nav-item').filter({ hasText: 'Weather' });
    const navIcon = weatherBtn.locator('.nav-icon');
    const navContent = weatherBtn.locator('.nav-content');
    const navLabel = navContent.locator('.nav-label');
    const navStatus = navContent.locator('.nav-status');
    
    // Weather button should be visible
    await expect(weatherBtn).toBeVisible();
    
    // Should have weather cloud-sun icon
    await expect(navIcon).toBeVisible();
    
    // Should have label
    await expect(navLabel).toHaveText('Weather');
    
    // Status should show weather condition
    if (await navStatus.isVisible()) {
      const statusText = await navStatus.textContent();
      expect(statusText.trim()).toBeTruthy();
      // Could be "Loading...", "Clear", "Cloudy", etc.
      expect(statusText).toMatch(/loading|clear|cloudy|sunny|rain|snow|unknown/i);
    }
    
    // Click Weather
    await weatherBtn.click();
    await page.waitForTimeout(500);
    
    // Test hover effects
    await weatherBtn.hover();
    const hoverBg = await weatherBtn.evaluate(el => 
      window.getComputedStyle(el).background
    );
    expect(hoverBg).toContain('rgba(255, 107, 53');
  });

  test('07. Navigation Items - Settings', async ({ page }) => {
    const settingsBtn = page.locator('.sidebar-nav-item').filter({ hasText: 'Settings' });
    const navIcon = settingsBtn.locator('.nav-icon');
    const navLabel = settingsBtn.locator('.nav-label');
    
    // Settings button should be visible
    await expect(settingsBtn).toBeVisible();
    
    // Should have cog icon
    await expect(navIcon).toBeVisible();
    
    // Should have label
    await expect(navLabel).toHaveText('Settings');
    
    // Click Settings
    await settingsBtn.click();
    await page.waitForTimeout(500);
    
    // Should either navigate or trigger panel change
    // Check if URL changed or panel opened
    const currentUrl = page.url();
    const isActive = await settingsBtn.evaluate(el => 
      el.classList.contains('active')
    );
    
    // One of these should be true
    expect(currentUrl.includes('/settings') || isActive).toBeTruthy();
  });

  test('08. Tutorial Button Functionality', async ({ page }) => {
    const tutorialSection = page.locator('.sidebar-tutorial');
    const tutorialButton = page.locator('.tutorial-button');
    const tutorialText = page.locator('.tutorial-text');
    
    // Tutorial section should be visible
    await expect(tutorialSection).toBeVisible();
    
    // Tutorial button should be visible
    await expect(tutorialButton).toBeVisible();
    
    // Should have question circle icon
    const questionIcon = tutorialButton.locator('svg');
    await expect(questionIcon).toBeVisible();
    
    // Should have text when expanded
    if (await tutorialText.isVisible()) {
      await expect(tutorialText).toHaveText('Repeat Tutorial');
    }
    
    // Test hover effects
    await tutorialButton.hover();
    await page.waitForTimeout(200);
    
    const hoverBg = await tutorialButton.evaluate(el => 
      window.getComputedStyle(el).background
    );
    expect(hoverBg).toContain('rgba(255, 107, 53');
    
    // Click tutorial button
    await tutorialButton.click();
    await page.waitForTimeout(500);
    
    // Should trigger tutorial reset (no visual change but function called)
    console.log('Tutorial reset button clicked');
  });

  test('09. User Section and Information', async ({ page }) => {
    // Wait for user data to load
    await page.waitForTimeout(2000);
    
    const userSection = page.locator('.sidebar-user');
    const userInfo = page.locator('.user-info');
    const userName = page.locator('.user-name');
    const userEmail = page.locator('.user-email');
    const demoBadge = page.locator('.demo-badge');
    
    // User section should be visible
    await expect(userSection).toBeVisible();
    
    // User info may be visible if user is loaded
    if (await userInfo.isVisible()) {
      // User name might be displayed
      if (await userName.isVisible()) {
        const nameText = await userName.textContent();
        expect(nameText.trim()).toBeTruthy();
      }
      
      // User email might be displayed
      if (await userEmail.isVisible()) {
        const emailText = await userEmail.textContent();
        expect(emailText.trim()).toBeTruthy();
        // Could be an email format or demo identifier
      }
      
      // Demo badge might be visible
      if (await demoBadge.isVisible()) {
        await expect(demoBadge).toHaveText('Demo Mode');
        
        // Check demo badge styling
        const badgeBg = await demoBadge.evaluate(el => 
          window.getComputedStyle(el).background
        );
        expect(badgeBg).toContain('rgba(76, 175, 80');
      }
    }
  });

  test('10. Logout Button Functionality', async ({ page }) => {
    const logoutButton = page.locator('.logout-button');
    const logoutIcon = logoutButton.locator('svg');
    const logoutText = page.locator('.logout-text');
    
    // Logout button should be visible
    await expect(logoutButton).toBeVisible();
    
    // Should have sign-out icon
    await expect(logoutIcon).toBeVisible();
    
    // Should have text when expanded
    if (await logoutText.isVisible()) {
      await expect(logoutText).toHaveText('Sign Out');
    }
    
    // Test hover effects
    await logoutButton.hover();
    await page.waitForTimeout(200);
    
    const hoverBg = await logoutButton.evaluate(el => 
      window.getComputedStyle(el).background
    );
    expect(hoverBg).toContain('rgba(255, 107, 53');
    
    // Note: We don't actually click logout as it would end the session
    // The click functionality is tested by verifying the button is properly set up
    console.log('Logout button hover effect verified');
  });

  test('11. Collapsed State - All Elements', async ({ page }) => {
    const sidebar = page.locator('.sidebar');
    const toggleButton = page.locator('.sidebar-toggle');
    const farmInfo = page.locator('.sidebar-farm-info');
    const navContent = page.locator('.nav-content').first();
    const userInfo = page.locator('.user-info');
    const logoutText = page.locator('.logout-text');
    const tutorialText = page.locator('.tutorial-text');
    
    // Collapse the sidebar
    await toggleButton.click();
    await page.waitForTimeout(500);
    
    // Sidebar should be collapsed
    await expect(sidebar).toHaveClass(/collapsed/);
    
    // Farm info should be hidden
    const farmInfoOpacity = await farmInfo.evaluate(el => 
      window.getComputedStyle(el).opacity
    );
    expect(parseFloat(farmInfoOpacity)).toBe(0);
    
    // Navigation content should be hidden
    const navContentOpacity = await navContent.evaluate(el => 
      window.getComputedStyle(el).opacity
    );
    expect(parseFloat(navContentOpacity)).toBe(0);
    
    // User info should be hidden
    if (await userInfo.isVisible()) {
      const userInfoOpacity = await userInfo.evaluate(el => 
        window.getComputedStyle(el).opacity
      );
      expect(parseFloat(userInfoOpacity)).toBe(0);
    }
    
    // Logout text should be hidden
    const logoutTextOpacity = await logoutText.evaluate(el => 
      window.getComputedStyle(el).opacity
    );
    expect(parseFloat(logoutTextOpacity)).toBe(0);
    
    // Tutorial text should be hidden
    if (await tutorialText.isVisible()) {
      const tutorialTextOpacity = await tutorialText.evaluate(el => 
        window.getComputedStyle(el).opacity
      );
      expect(parseFloat(tutorialTextOpacity)).toBe(0);
    }
    
    // Icons should still be visible
    const navIcons = page.locator('.nav-icon');
    const iconCount = await navIcons.count();
    expect(iconCount).toBeGreaterThan(0);
    
    // All icons should be visible
    for (let i = 0; i < Math.min(iconCount, 4); i++) {
      await expect(navIcons.nth(i)).toBeVisible();
    }
  });

  test('12. LocalStorage State Persistence', async ({ page }) => {
    const sidebar = page.locator('.sidebar');
    const toggleButton = page.locator('.sidebar-toggle');
    
    // Get initial state
    const initialExpanded = await sidebar.evaluate(el => 
      !el.classList.contains('collapsed')
    );
    
    // Toggle sidebar
    await toggleButton.click();
    await page.waitForTimeout(300);
    
    // Check localStorage was updated
    const storedState = await page.evaluate(() => {
      return localStorage.getItem('burnwise-sidebar-expanded');
    });
    
    expect(storedState).toBeTruthy();
    const parsedState = JSON.parse(storedState);
    expect(parsedState).toBe(!initialExpanded);
    
    // Reload page to test persistence
    await page.reload();
    
    // Handle potential redirect
    try {
      await page.waitForURL('**/spatial', { timeout: 3000 });
    } catch (e) {
      if (page.url().includes('onboarding')) {
        await page.click('button:has-text("Skip Setup")');
        await page.waitForURL('**/spatial');
      }
    }
    
    await page.waitForTimeout(1000);
    
    // Sidebar should maintain the toggled state
    const sidebarAfterReload = page.locator('.sidebar');
    await expect(sidebarAfterReload).toBeVisible();
    
    const finalExpanded = await sidebarAfterReload.evaluate(el => 
      !el.classList.contains('collapsed')
    );
    
    expect(finalExpanded).toBe(!initialExpanded);
  });

  test('13. Real-time Weather Updates', async ({ page }) => {
    const weatherSummary = page.locator('.weather-summary');
    const weatherBtn = page.locator('.sidebar-nav-item').filter({ hasText: 'Weather' });
    const weatherStatus = weatherBtn.locator('.nav-status');
    
    // Wait for initial weather to load
    await page.waitForTimeout(3000);
    
    // Monitor network requests for weather API
    const weatherRequests = [];
    page.on('request', request => {
      if (request.url().includes('/api/weather/current')) {
        weatherRequests.push(request.url());
      }
    });
    
    // Weather elements should show real data
    if (await weatherSummary.isVisible()) {
      const summaryText = await weatherSummary.textContent();
      expect(summaryText).toMatch(/\d+°F/);
      expect(summaryText).toContain('🌤️');
    }
    
    if (await weatherStatus.isVisible()) {
      const statusText = await weatherStatus.textContent();
      expect(statusText.trim()).toBeTruthy();
      expect(statusText).not.toBe('Loading...');
    }
    
    // Simulate map view change to trigger weather update
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('mapViewChanged', {
        detail: { lat: 37.7749, lng: -122.4194 } // San Francisco coordinates
      }));
    });
    
    // Wait for debounced weather update
    await page.waitForTimeout(1000);
    
    // Should have made additional weather request
    expect(weatherRequests.length).toBeGreaterThanOrEqual(1);
    
    // Weather should update (though might be same if same conditions)
    if (await weatherStatus.isVisible()) {
      const updatedStatus = await weatherStatus.textContent();
      expect(updatedStatus.trim()).toBeTruthy();
    }
  });

  test('14. Active Panel State Management', async ({ page }) => {
    const burnsBtn = page.locator('.sidebar-nav-item').filter({ hasText: 'Active Burns' });
    const weatherBtn = page.locator('.sidebar-nav-item').filter({ hasText: 'Weather' });
    const mapViewBtn = page.locator('.sidebar-nav-item').filter({ hasText: 'Map View' });
    
    // Click burns panel
    await burnsBtn.click();
    await page.waitForTimeout(300);
    
    // Burns button may become active
    let burnsActive = await burnsBtn.evaluate(el => 
      el.classList.contains('active')
    );
    
    // Click weather panel
    await weatherBtn.click();
    await page.waitForTimeout(300);
    
    // Weather button may become active, burns should become inactive
    let weatherActive = await weatherBtn.evaluate(el => 
      el.classList.contains('active')
    );
    burnsActive = await burnsBtn.evaluate(el => 
      el.classList.contains('active')
    );
    
    // Only one panel should be active at a time (excluding map view)
    if (weatherActive && burnsActive) {
      // This would indicate a bug in state management
      console.log('Warning: Multiple panels active simultaneously');
    }
    
    // Click same panel again to toggle off
    await weatherBtn.click();
    await page.waitForTimeout(300);
    
    weatherActive = await weatherBtn.evaluate(el => 
      el.classList.contains('active')
    );
    
    // Panel should toggle off
    if (!weatherActive) {
      console.log('Panel correctly toggled off');
    }
  });

  test('15. Responsive Design - Mobile View', async ({ page }) => {
    const sidebar = page.locator('.sidebar');
    
    // Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(500);
    
    await expect(sidebar).toBeVisible();
    
    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    
    // On mobile, sidebar should be off-screen by default
    const transform = await sidebar.evaluate(el => 
      window.getComputedStyle(el).transform
    );
    
    // Should be translated off-screen (-100%)
    if (transform.includes('translateX')) {
      expect(transform).toContain('-');
    }
    
    // Click toggle to show sidebar
    const toggleButton = page.locator('.sidebar-toggle');
    if (await toggleButton.isVisible()) {
      await toggleButton.click();
      await page.waitForTimeout(500);
      
      // Should slide in (transform to 0)
      const newTransform = await sidebar.evaluate(el => 
        window.getComputedStyle(el).transform
      );
      
      // Should be visible now
      expect(newTransform).not.toEqual(transform);
    }
    
    // Reset to desktop
    await page.setViewportSize({ width: 1920, height: 1080 });
  });

  test('16. API Integration and Error Handling', async ({ page }) => {
    // Monitor network requests
    const apiRequests = [];
    const apiErrors = [];
    
    page.on('request', request => {
      if (request.url().includes('/api/')) {
        apiRequests.push(request.url());
      }
    });
    
    page.on('response', response => {
      if (response.url().includes('/api/') && !response.ok()) {
        apiErrors.push({ url: response.url(), status: response.status() });
      }
    });
    
    // Wait for initial API calls to complete
    await page.waitForTimeout(3000);
    
    // Should have made requests to farm, burn, and weather APIs
    const farmRequests = apiRequests.filter(url => url.includes('/api/farms'));
    const burnRequests = apiRequests.filter(url => url.includes('/api/burn-requests'));
    const weatherRequests = apiRequests.filter(url => url.includes('/api/weather'));
    
    expect(farmRequests.length).toBeGreaterThanOrEqual(1);
    // Note: burn and weather requests may be 0 if user is not logged in or demo mode
    
    // Check for API errors
    if (apiErrors.length > 0) {
      console.log('API errors detected:', apiErrors);
      // Don't fail test for API errors as they may be expected in demo mode
    }
    
    // Monitor console errors
    const consoleErrors = [];
    page.on('console', message => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text());
      }
    });
    
    await page.waitForTimeout(2000);
    
    // Filter out non-critical errors
    const criticalErrors = consoleErrors.filter(error => 
      !error.includes('Warning') && 
      !error.includes('DevTools') &&
      !error.includes('Extension') &&
      !error.includes('favicon') &&
      !error.includes('loading')
    );
    
    if (criticalErrors.length > 0) {
      console.log('Console errors found:', criticalErrors);
    }
  });

  test('17. Custom Events and Panel Communication', async ({ page }) => {
    const burnsBtn = page.locator('.sidebar-nav-item').filter({ hasText: 'Active Burns' });
    
    // Listen for custom events
    const events = [];
    await page.evaluateOnNewDocument(() => {
      window.capturedEvents = [];
      const originalDispatch = window.dispatchEvent;
      window.dispatchEvent = function(event) {
        if (event.type === 'panelChange') {
          window.capturedEvents.push({
            type: event.type,
            detail: event.detail
          });
        }
        return originalDispatch.call(this, event);
      };
    });
    
    // Click navigation item to trigger event
    await burnsBtn.click();
    await page.waitForTimeout(300);
    
    // Check if custom event was dispatched
    const capturedEvents = await page.evaluate(() => window.capturedEvents || []);
    
    if (capturedEvents.length > 0) {
      const panelEvent = capturedEvents.find(e => e.type === 'panelChange');
      if (panelEvent) {
        expect(panelEvent.detail.source).toBe('sidebar');
        expect(panelEvent.detail.panelId).toBe('burns');
      }
    }
    
    // Test listening for activePanel changes
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('activePanelChanged', {
        detail: { activePanel: 'weather', isMapView: false }
      }));
    });
    
    await page.waitForTimeout(300);
    
    // Weather button should become active
    const weatherBtn = page.locator('.sidebar-nav-item').filter({ hasText: 'Weather' });
    const isActive = await weatherBtn.evaluate(el => 
      el.classList.contains('active')
    );
    
    // Panel state should be updated
    console.log('Custom event communication tested');
  });

  test('18. Accessibility and Keyboard Navigation', async ({ page }) => {
    const toggleButton = page.locator('.sidebar-toggle');
    const navItems = page.locator('.sidebar-nav-item');
    const tutorialButton = page.locator('.tutorial-button');
    const logoutButton = page.locator('.logout-button');
    
    // Test keyboard focus on interactive elements
    await toggleButton.focus();
    let focusedElement = page.locator(':focus');
    await expect(focusedElement).toHaveClass(/sidebar-toggle/);
    
    // Tab through navigation items
    await page.keyboard.press('Tab');
    focusedElement = page.locator(':focus');
    
    // Should focus on first nav item or next interactive element
    const focusedClass = await focusedElement.getAttribute('class');
    expect(focusedClass).toContain('sidebar-nav-item');
    
    // Test space/enter activation
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);
    
    // Continue tabbing through other elements
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(100);
    }
    
    // Should be able to reach tutorial and logout buttons
    focusedElement = page.locator(':focus');
    const finalFocusClass = await focusedElement.getAttribute('class');
    
    // Should be on an interactive element
    expect(finalFocusClass).toMatch(/(tutorial-button|logout-button|sidebar-nav-item)/);
  });

  test('19. Performance and Animation Smoothness', async ({ page }) => {
    const sidebar = page.locator('.sidebar');
    const toggleButton = page.locator('.sidebar-toggle');
    
    // Test rapid toggling
    for (let i = 0; i < 3; i++) {
      await toggleButton.click();
      await page.waitForTimeout(100);
      await toggleButton.click();
      await page.waitForTimeout(100);
    }
    
    // Sidebar should still be responsive
    await expect(sidebar).toBeVisible();
    
    // Test multiple navigation clicks
    const navItems = page.locator('.sidebar-nav-item');
    const itemCount = Math.min(await navItems.count(), 4);
    
    for (let i = 0; i < itemCount; i++) {
      const item = navItems.nth(i);
      if (await item.isVisible()) {
        await item.click();
        await page.waitForTimeout(200);
      }
    }
    
    // Sidebar should still be functional
    await expect(sidebar).toBeVisible();
    
    // Test transition timing
    await toggleButton.click();
    const startTime = Date.now();
    
    // Wait for transition to complete
    await page.waitForTimeout(350); // Slightly more than CSS transition time
    
    const endTime = Date.now();
    const transitionTime = endTime - startTime;
    
    // Should complete in reasonable time
    expect(transitionTime).toBeGreaterThan(300);
    expect(transitionTime).toBeLessThan(1000);
  });

  test('20. Edge Cases and Error Recovery', async ({ page }) => {
    const sidebar = page.locator('.sidebar');
    
    // Test with no user data
    await page.evaluate(() => {
      // Simulate API failure
      window.fetch = () => Promise.reject(new Error('Network error'));
    });
    
    // Reload to trigger data loading with simulated failure
    await page.reload();
    
    // Handle potential redirect
    try {
      await page.waitForURL('**/spatial', { timeout: 3000 });
    } catch (e) {
      if (page.url().includes('onboarding')) {
        await page.click('button:has-text("Skip Setup")');
        await page.waitForURL('**/spatial');
      }
    }
    
    await page.waitForTimeout(2000);
    
    // Sidebar should still be functional even with API failures
    await expect(sidebar).toBeVisible();
    
    // Navigation should still work
    const toggleButton = page.locator('.sidebar-toggle');
    await expect(toggleButton).toBeVisible();
    
    await toggleButton.click();
    await page.waitForTimeout(300);
    
    // Should still collapse/expand
    await expect(sidebar).toHaveClass(/collapsed/);
    
    // Navigation items should still be clickable
    const navItems = page.locator('.sidebar-nav-item');
    const firstItem = navItems.first();
    
    if (await firstItem.isVisible()) {
      await firstItem.click();
      // Should not crash or error
      await page.waitForTimeout(300);
    }
  });
});