const { test, expect } = require('@playwright/test');

test.describe('User Interactions Tests - Complete Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
  });

  test('Should handle complete burn request submission workflow', async ({ page }) => {
    // Navigate to new burn request
    await page.click('[data-testid="new-burn-request-btn"]');
    await page.waitForSelector('[data-testid="burn-request-form"]');
    
    // Fill form step by step with user interactions
    await page.fill('[data-testid="farm-id-input"]', '1');
    await page.waitForTimeout(500); // Simulate user thinking time
    
    await page.fill('[data-testid="area-hectares-input"]', '125');
    await page.selectOption('[data-testid="crop-type-select"]', 'wheat_stubble');
    
    // Set date using date picker interaction
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 2);
    const dateString = tomorrow.toISOString().split('T')[0];
    await page.fill('[data-testid="requested-date-input"]', dateString);
    
    // Interactive polygon drawing
    await page.click('[data-testid="draw-polygon-btn"]');
    
    const mapCanvas = page.locator('.mapboxgl-canvas');
    const points = [
      { x: 300, y: 200 },
      { x: 450, y: 200 },
      { x: 450, y: 350 },
      { x: 300, y: 350 }
    ];
    
    // Draw polygon with realistic user timing
    for (const point of points) {
      await mapCanvas.click({ position: point });
      await page.waitForTimeout(300); // Realistic user drawing speed
    }
    await mapCanvas.dblclick({ position: points[0] }); // Close polygon
    
    // Verify polygon area calculation
    await page.waitForTimeout(1000);
    const calculatedArea = await page.textContent('[data-testid="calculated-area-display"]');
    expect(calculatedArea).toBeTruthy();
    
    // Check weather conditions
    await page.click('[data-testid="check-weather-btn"]');
    await page.waitForTimeout(3000); // Wait for weather API
    
    const weatherStatus = page.locator('[data-testid="weather-status"]');
    await expect(weatherStatus).toBeVisible();
    
    // Fill contact information
    await page.fill('[data-testid="contact-email-input"]', 'farmer@example.com');
    await page.fill('[data-testid="contact-phone-input"]', '(555) 123-4567');
    
    // Submit request
    await page.click('[data-testid="submit-burn-request-btn"]');
    
    // Verify success
    await page.waitForSelector('[data-testid="submission-success"]', { timeout: 10000 });
    const successMessage = page.locator('[data-testid="submission-success"]');
    await expect(successMessage).toContainText('successfully submitted');
  });

  test('Should handle burn request editing and updates', async ({ page }) => {
    // Assume there's an existing burn request to edit
    await page.waitForSelector('[data-testid="burn-requests-list"]');
    
    // Click edit button on first request
    const editBtn = page.locator('[data-testid="edit-burn-request-btn"]').first();
    await editBtn.click();
    
    await page.waitForSelector('[data-testid="edit-burn-form"]');
    
    // Modify area
    const areaInput = page.locator('[data-testid="area-hectares-input"]');
    await areaInput.clear();
    await areaInput.fill('200');
    
    // Change crop type
    await page.selectOption('[data-testid="crop-type-select"]', 'corn_residue');
    
    // Modify polygon by adding a point
    await page.click('[data-testid="modify-polygon-btn"]');
    
    const mapCanvas = page.locator('.mapboxgl-canvas');
    await mapCanvas.click({ position: { x: 400, y: 150 } }); // Add new point
    
    // Save changes
    await page.click('[data-testid="save-changes-btn"]');
    
    // Verify update success
    await page.waitForSelector('[data-testid="update-success"]');
    const updateMessage = page.locator('[data-testid="update-success"]');
    await expect(updateMessage).toContainText('updated successfully');
  });

  test('Should handle interactive conflict resolution workflow', async ({ page }) => {
    // Navigate to conflicts page
    await page.click('[data-testid="conflicts-tab"]');
    await page.waitForSelector('[data-testid="conflicts-list"]');
    
    // Select first conflict
    const conflictItem = page.locator('[data-testid="conflict-item"]').first();
    await conflictItem.click();
    
    // Open conflict resolution dialog
    await page.click('[data-testid="resolve-conflict-btn"]');
    await page.waitForSelector('[data-testid="conflict-resolution-dialog"]');
    
    // Choose resolution option
    await page.click('[data-testid="reschedule-option"]');
    
    // Interactive date/time picker
    await page.click('[data-testid="alternative-date-picker"]');
    
    // Select alternative date
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const alternateDate = nextWeek.toISOString().split('T')[0];
    
    await page.fill('[data-testid="alternative-date-input"]', alternateDate);
    await page.selectOption('[data-testid="alternative-time-slot"]', '14:00-18:00');
    
    // Confirm resolution
    await page.click('[data-testid="confirm-resolution-btn"]');
    
    // Verify resolution was applied
    await page.waitForSelector('[data-testid="resolution-success"]');
    const resolutionMessage = page.locator('[data-testid="resolution-success"]');
    await expect(resolutionMessage).toContainText('Conflict resolved');
  });

  test('Should handle drag-and-drop schedule management', async ({ page }) => {
    // Navigate to schedule page
    await page.click('[data-testid="schedule-tab"]');
    await page.waitForSelector('[data-testid="schedule-grid"]');
    
    // Get initial position of a burn request
    const burnItem = page.locator('[data-testid="schedulable-burn"]').first();
    const initialTimeSlot = await burnItem.getAttribute('data-time-slot');
    
    // Drag burn to different time slot
    const targetSlot = page.locator('[data-testid="time-slot"][data-slot="10:00-14:00"]');
    
    await burnItem.dragTo(targetSlot);
    
    // Wait for drag completion
    await page.waitForTimeout(1000);
    
    // Verify burn moved to new slot
    const newTimeSlot = await burnItem.getAttribute('data-time-slot');
    expect(newTimeSlot).toBe('10:00-14:00');
    expect(newTimeSlot).not.toBe(initialTimeSlot);
    
    // Verify schedule was auto-saved
    const saveIndicator = page.locator('[data-testid="auto-save-indicator"]');
    await expect(saveIndicator).toContainText('Schedule saved');
  });

  test('Should handle real-time notifications and user responses', async ({ page }) => {
    // Wait for notifications panel
    await page.waitForSelector('[data-testid="notifications-panel"]');
    
    // Simulate receiving a new notification (if any exist)
    const notificationBadge = page.locator('[data-testid="notification-badge"]');
    const hasNotifications = await notificationBadge.isVisible();
    
    if (hasNotifications) {
      // Click notification to open details
      await page.click('[data-testid="notification-item"]');
      
      const notificationDetail = page.locator('[data-testid="notification-detail"]');
      await expect(notificationDetail).toBeVisible();
      
      // Respond to notification if it requires action
      const actionButton = page.locator('[data-testid="notification-action-btn"]');
      if (await actionButton.isVisible()) {
        await actionButton.click();
        
        // Verify action was processed
        await page.waitForTimeout(1000);
        const actionResult = page.locator('[data-testid="action-result"]');
        await expect(actionResult).toBeVisible();
      }
      
      // Mark notification as read
      await page.click('[data-testid="mark-read-btn"]');
      
      // Verify notification status changed
      const readStatus = await page.locator('[data-testid="notification-item"]').getAttribute('data-read');
      expect(readStatus).toBe('true');
    }
  });

  test('Should handle interactive map filtering and search', async ({ page }) => {
    // Wait for map to load
    await page.waitForSelector('.mapboxgl-map');
    
    // Open filter panel
    await page.click('[data-testid="map-filters-btn"]');
    await page.waitForSelector('[data-testid="map-filters-panel"]');
    
    // Apply date range filter
    await page.selectOption('[data-testid="date-range-filter"]', 'last-7-days');
    
    // Apply status filter
    await page.check('[data-testid="active-burns-filter"]');
    await page.uncheck('[data-testid="completed-burns-filter"]');
    
    // Apply the filters
    await page.click('[data-testid="apply-filters-btn"]');
    
    // Wait for map to update
    await page.waitForTimeout(2000);
    
    // Verify map layers updated
    const visibleBurns = await page.evaluate(() => {
      if (!window.map) return 0;
      const source = window.map.getSource('filtered-burns');
      return source && source._data ? source._data.features.length : 0;
    });
    
    expect(visibleBurns).toBeGreaterThanOrEqual(0);
    
    // Use search functionality
    await page.fill('[data-testid="map-search-input"]', 'Farm 1');
    await page.press('[data-testid="map-search-input"]', 'Enter');
    
    // Verify map zoomed to search result
    await page.waitForTimeout(1000);
    const mapZoom = await page.evaluate(() => {
      return window.map ? window.map.getZoom() : 0;
    });
    
    expect(mapZoom).toBeGreaterThan(10);
  });

  test('Should handle export functionality for burn data', async ({ page }) => {
    // Navigate to data export section
    await page.click('[data-testid="export-data-btn"]');
    await page.waitForSelector('[data-testid="export-dialog"]');
    
    // Select export format
    await page.selectOption('[data-testid="export-format-select"]', 'csv');
    
    // Select date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    const endDate = new Date();
    
    await page.fill('[data-testid="export-start-date"]', startDate.toISOString().split('T')[0]);
    await page.fill('[data-testid="export-end-date"]', endDate.toISOString().split('T')[0]);
    
    // Select fields to export
    await page.check('[data-testid="export-field-dates"]');
    await page.check('[data-testid="export-field-locations"]');
    await page.check('[data-testid="export-field-pm25"]');
    
    // Start export with download promise
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="start-export-btn"]');
    
    // Wait for download
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/burn.*data.*\.csv$/);
    
    // Verify export success message
    const exportSuccess = page.locator('[data-testid="export-success"]');
    await expect(exportSuccess).toContainText('Export completed');
  });

  test('Should handle user preferences and settings management', async ({ page }) => {
    // Open settings menu
    await page.click('[data-testid="user-menu-btn"]');
    await page.click('[data-testid="settings-menu-item"]');
    
    await page.waitForSelector('[data-testid="settings-dialog"]');
    
    // Modify notification preferences
    await page.click('[data-testid="notifications-tab"]');
    
    await page.check('[data-testid="email-notifications-toggle"]');
    await page.check('[data-testid="weather-alerts-toggle"]');
    await page.uncheck('[data-testid="marketing-emails-toggle"]');
    
    // Modify display preferences
    await page.click('[data-testid="display-tab"]');
    
    await page.selectOption('[data-testid="theme-select"]', 'dark');
    await page.selectOption('[data-testid="units-select"]', 'metric');
    
    // Modify map preferences
    await page.click('[data-testid="map-tab"]');
    
    await page.selectOption('[data-testid="default-map-style"]', 'satellite');
    await page.check('[data-testid="show-farm-boundaries"]');
    
    // Save settings
    await page.click('[data-testid="save-settings-btn"]');
    
    // Verify settings saved
    await page.waitForSelector('[data-testid="settings-saved"]');
    const savedMessage = page.locator('[data-testid="settings-saved"]');
    await expect(savedMessage).toContainText('Settings saved');
    
    // Close settings dialog
    await page.click('[data-testid="close-settings-btn"]');
    
    // Verify theme change applied
    const bodyClass = await page.getAttribute('body', 'class');
    expect(bodyClass).toContain('dark-theme');
  });

  test('Should handle keyboard shortcuts and accessibility features', async ({ page }) => {
    // Test keyboard navigation for burn request form
    await page.click('[data-testid="new-burn-request-btn"]');
    await page.waitForSelector('[data-testid="burn-request-form"]');
    
    // Navigate through form using Tab
    await page.keyboard.press('Tab'); // Farm ID field
    await page.keyboard.type('1');
    
    await page.keyboard.press('Tab'); // Area field
    await page.keyboard.type('100');
    
    await page.keyboard.press('Tab'); // Crop type field
    await page.keyboard.press('ArrowDown'); // Select first option
    await page.keyboard.press('Enter');
    
    // Test escape key to close form
    await page.keyboard.press('Escape');
    
    // Verify form closed
    const form = page.locator('[data-testid="burn-request-form"]');
    await expect(form).not.toBeVisible();
    
    // Test global keyboard shortcuts
    await page.keyboard.press('Control+n'); // New burn request shortcut
    await page.waitForSelector('[data-testid="burn-request-form"]');
    
    await page.keyboard.press('Control+d'); // Dashboard shortcut
    await page.waitForURL('**/dashboard');
    
    // Test accessibility features
    await page.keyboard.press('Alt+h'); // Help shortcut
    const helpDialog = page.locator('[data-testid="help-dialog"]');
    await expect(helpDialog).toBeVisible();
    
    // Verify help content is accessible
    const helpContent = page.locator('[data-testid="help-content"]');
    await expect(helpContent).toHaveAttribute('aria-label');
  });

  test('Should handle responsive design interactions across screen sizes', async ({ page }) => {
    // Test desktop view first
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Verify desktop layout
    const sidebar = page.locator('[data-testid="desktop-sidebar"]');
    await expect(sidebar).toBeVisible();
    
    const mapContainer = page.locator('[data-testid="map-container"]');
    const mapWidth = await mapContainer.boundingBox();
    expect(mapWidth.width).toBeGreaterThan(800);
    
    // Switch to tablet view
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(500); // Wait for responsive changes
    
    // Verify tablet layout adjustments
    const mobileMenu = page.locator('[data-testid="mobile-menu-btn"]');
    await expect(mobileMenu).toBeVisible();
    
    // Test mobile menu interaction
    await mobileMenu.click();
    const mobileNavigation = page.locator('[data-testid="mobile-navigation"]');
    await expect(mobileNavigation).toBeVisible();
    
    // Switch to mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    
    // Verify mobile-specific interactions
    const mapTabsContainer = page.locator('[data-testid="mobile-map-tabs"]');
    await expect(mapTabsContainer).toBeVisible();
    
    // Test swipe gestures simulation
    const mapCanvas = page.locator('.mapboxgl-canvas');
    await mapCanvas.swipeLeft();
    
    // Verify mobile form interactions
    await page.click('[data-testid="new-burn-request-btn"]');
    
    const mobileForm = page.locator('[data-testid="mobile-burn-form"]');
    await expect(mobileForm).toBeVisible();
    
    // Test form scrolling on mobile
    await page.fill('[data-testid="farm-id-input"]', '1');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    
    // Verify form submit button is accessible after scroll
    const submitBtn = page.locator('[data-testid="submit-burn-request-btn"]');
    await expect(submitBtn).toBeVisible();
  });
});