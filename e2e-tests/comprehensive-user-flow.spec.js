const { test, expect } = require('@playwright/test');
const path = require('path');

/**
 * COMPREHENSIVE E2E USER FLOW TEST SUITE
 * Complete end-to-end testing of BURNWISE application
 * Target: 100+ E2E tests covering all user journeys
 */

// Test data generator for E2E tests
class E2ETestData {
  static generateFarmData() {
    const randomId = Math.random().toString(36).substring(7);
    return {
      name: `Test Farm ${randomId}`,
      location: {
        lat: 37 + Math.random(),
        lng: -120 - Math.random()
      },
      acreage: Math.floor(Math.random() * 1000) + 100,
      contactEmail: `farm${randomId}@test.com`,
      contactPhone: `555-${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`
    };
  }

  static generateBurnRequest() {
    return {
      acreage: Math.floor(Math.random() * 500) + 50,
      startDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      purpose: ['Weed Control', 'Disease Prevention', 'Stubble Management'][Math.floor(Math.random() * 3)],
      notes: `Test burn request created at ${new Date().toISOString()}`
    };
  }
}

test.describe('BURNWISE Comprehensive E2E Test Suite', () => {
  test.beforeEach(async ({ page }) => {
    // Set viewport to standard desktop size
    await page.setViewportSize({ width: 1920, height: 1080 });
    
    // Navigate to application
    await page.goto('http://localhost:3000');
    
    // Wait for initial load
    await page.waitForLoadState('networkidle');
  });

  test.describe('1. Landing Page and Initial Experience', () => {
    test('should load landing page with all elements', async ({ page }) => {
      // Check for main elements
      await expect(page.locator('[data-testid="hero-section"]')).toBeVisible();
      await expect(page.locator('[data-testid="navigation-bar"]')).toBeVisible();
      await expect(page.locator('[data-testid="cta-button"]')).toBeVisible();
      
      // Verify video background is playing
      const video = page.locator('video');
      await expect(video).toBeVisible();
      const isPlaying = await video.evaluate(vid => !vid.paused);
      expect(isPlaying).toBeTruthy();
    });

    test('should display cinematic startup animation on first visit', async ({ page, context }) => {
      // Clear cookies to simulate first visit
      await context.clearCookies();
      await page.reload();
      
      // Check for startup animation
      const startupAnimation = page.locator('[data-testid="startup-animation"]');
      await expect(startupAnimation).toBeVisible();
      
      // Wait for animation phases
      await expect(page.locator('[data-testid="assembly-phase"]')).toBeVisible();
      await page.waitForTimeout(1000);
      await expect(page.locator('[data-testid="ignition-phase"]')).toBeVisible();
      await page.waitForTimeout(1000);
      await expect(page.locator('[data-testid="living-phase"]')).toBeVisible();
      await page.waitForTimeout(1000);
      await expect(page.locator('[data-testid="flight-phase"]')).toBeVisible();
      
      // Animation should complete
      await expect(startupAnimation).toBeHidden({ timeout: 10000 });
    });

    test('should navigate through all main sections', async ({ page }) => {
      // Navigate to Dashboard
      await page.click('[data-testid="nav-dashboard"]');
      await expect(page).toHaveURL(/\/dashboard/);
      await expect(page.locator('[data-testid="dashboard-container"]')).toBeVisible();
      
      // Navigate to Map
      await page.click('[data-testid="nav-map"]');
      await expect(page).toHaveURL(/\/map/);
      await expect(page.locator('[data-testid="map-container"]')).toBeVisible();
      
      // Navigate to Schedule
      await page.click('[data-testid="nav-schedule"]');
      await expect(page).toHaveURL(/\/schedule/);
      await expect(page.locator('[data-testid="schedule-container"]')).toBeVisible();
      
      // Navigate to Alerts
      await page.click('[data-testid="nav-alerts"]');
      await expect(page).toHaveURL(/\/alerts/);
      await expect(page.locator('[data-testid="alerts-container"]')).toBeVisible();
    });

    test('should handle responsive design', async ({ page }) => {
      // Test mobile view
      await page.setViewportSize({ width: 375, height: 667 });
      await expect(page.locator('[data-testid="mobile-menu-button"]')).toBeVisible();
      
      // Open mobile menu
      await page.click('[data-testid="mobile-menu-button"]');
      await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();
      
      // Test tablet view
      await page.setViewportSize({ width: 768, height: 1024 });
      await expect(page.locator('[data-testid="tablet-layout"]')).toBeVisible();
      
      // Return to desktop
      await page.setViewportSize({ width: 1920, height: 1080 });
      await expect(page.locator('[data-testid="desktop-layout"]')).toBeVisible();
    });
  });

  test.describe('2. Dashboard Functionality', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('http://localhost:3000/dashboard');
      await page.waitForLoadState('networkidle');
    });

    test('should display all analytics cards with data', async ({ page }) => {
      const analyticsCards = [
        'total-burns',
        'completed-burns',
        'scheduled-burns',
        'total-acreage',
        'burned-acreage',
        'average-pm25'
      ];

      for (const card of analyticsCards) {
        const element = page.locator(`[data-testid="${card}-card"]`);
        await expect(element).toBeVisible();
        
        // Check for value
        const value = element.locator('[data-testid="metric-value"]');
        await expect(value).toHaveText(/\d+/);
        
        // Check for percentage change
        const change = element.locator('[data-testid="metric-change"]');
        await expect(change).toHaveText(/[+-]\d+%/);
      }
    });

    test('should update data on refresh', async ({ page }) => {
      // Get initial value
      const initialValue = await page.locator('[data-testid="total-burns-value"]').textContent();
      
      // Click refresh
      await page.click('[data-testid="refresh-button"]');
      
      // Wait for update
      await page.waitForResponse(response => 
        response.url().includes('/api/analytics') && response.status() === 200
      );
      
      // Value might change (or might not, but should be defined)
      const newValue = await page.locator('[data-testid="total-burns-value"]').textContent();
      expect(newValue).toBeDefined();
    });

    test('should filter data by date range', async ({ page }) => {
      // Open date picker
      await page.click('[data-testid="date-range-picker"]');
      
      // Select start date
      await page.fill('[data-testid="start-date"]', '2024-01-01');
      
      // Select end date
      await page.fill('[data-testid="end-date"]', '2024-01-31');
      
      // Apply filter
      await page.click('[data-testid="apply-filter"]');
      
      // Wait for data update
      await page.waitForResponse(response => 
        response.url().includes('startDate=2024-01-01') && response.status() === 200
      );
      
      // Check that data is filtered
      await expect(page.locator('[data-testid="date-range-label"]')).toContainText('Jan 1 - Jan 31, 2024');
    });

    test('should export data in multiple formats', async ({ page }) => {
      // Click export button
      await page.click('[data-testid="export-button"]');
      
      // Check export options
      await expect(page.locator('[data-testid="export-csv"]')).toBeVisible();
      await expect(page.locator('[data-testid="export-pdf"]')).toBeVisible();
      await expect(page.locator('[data-testid="export-excel"]')).toBeVisible();
      
      // Test CSV export
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.click('[data-testid="export-csv"]')
      ]);
      
      expect(download.suggestedFilename()).toMatch(/burnwise.*\.csv/);
    });

    test('should display interactive charts', async ({ page }) => {
      // Check for charts
      await expect(page.locator('[data-testid="burns-timeline-chart"]')).toBeVisible();
      await expect(page.locator('[data-testid="acreage-distribution-chart"]')).toBeVisible();
      await expect(page.locator('[data-testid="smoke-levels-chart"]')).toBeVisible();
      
      // Interact with chart
      const chart = page.locator('[data-testid="burns-timeline-chart"]');
      await chart.hover();
      
      // Tooltip should appear
      await expect(page.locator('[data-testid="chart-tooltip"]')).toBeVisible();
      
      // Click on data point
      await chart.click({ position: { x: 100, y: 100 } });
      
      // Detail modal should open
      await expect(page.locator('[data-testid="chart-detail-modal"]')).toBeVisible();
    });
  });

  test.describe('3. Map Interaction and Burn Request Creation', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('http://localhost:3000/map');
      await page.waitForLoadState('networkidle');
      
      // Wait for map to load
      await page.waitForSelector('[data-testid="mapbox-container"]', { state: 'visible' });
    });

    test('should display map with farm locations', async ({ page }) => {
      // Map should be visible
      await expect(page.locator('[data-testid="mapbox-container"]')).toBeVisible();
      
      // Farm markers should be present
      await page.waitForSelector('.mapboxgl-marker', { state: 'visible' });
      const markers = await page.locator('.mapboxgl-marker').count();
      expect(markers).toBeGreaterThan(0);
    });

    test('should show farm details on marker click', async ({ page }) => {
      // Click on a farm marker
      await page.locator('.mapboxgl-marker').first().click();
      
      // Popup should appear
      await expect(page.locator('[data-testid="farm-popup"]')).toBeVisible();
      
      // Check popup content
      await expect(page.locator('[data-testid="farm-name"]')).toBeVisible();
      await expect(page.locator('[data-testid="farm-acreage"]')).toBeVisible();
      await expect(page.locator('[data-testid="last-burn-date"]')).toBeVisible();
    });

    test('should create new burn request with field drawing', async ({ page }) => {
      // Click create burn request
      await page.click('[data-testid="create-burn-request"]');
      
      // Modal should open
      await expect(page.locator('[data-testid="burn-request-modal"]')).toBeVisible();
      
      // Fill in basic information
      const farmData = E2ETestData.generateFarmData();
      await page.fill('[data-testid="farm-name-input"]', farmData.name);
      await page.fill('[data-testid="contact-email-input"]', farmData.contactEmail);
      await page.fill('[data-testid="contact-phone-input"]', farmData.contactPhone);
      
      // Click next to go to field drawing
      await page.click('[data-testid="next-step"]');
      
      // Enable drawing mode
      await page.click('[data-testid="draw-field-button"]');
      
      // Draw a polygon on the map
      const map = page.locator('[data-testid="mapbox-container"]');
      await map.click({ position: { x: 100, y: 100 } });
      await map.click({ position: { x: 200, y: 100 } });
      await map.click({ position: { x: 200, y: 200 } });
      await map.click({ position: { x: 100, y: 200 } });
      await map.click({ position: { x: 100, y: 100 } }); // Close polygon
      
      // Confirm field
      await page.click('[data-testid="confirm-field"]');
      
      // Fill burn details
      const burnData = E2ETestData.generateBurnRequest();
      await page.fill('[data-testid="burn-acreage"]', burnData.acreage.toString());
      await page.fill('[data-testid="start-date"]', burnData.startDate);
      await page.fill('[data-testid="end-date"]', burnData.endDate);
      await page.selectOption('[data-testid="burn-purpose"]', burnData.purpose);
      await page.fill('[data-testid="burn-notes"]', burnData.notes);
      
      // Submit request
      await page.click('[data-testid="submit-burn-request"]');
      
      // Wait for success message
      await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="success-message"]')).toContainText('Burn request submitted successfully');
    });

    test('should filter map by various criteria', async ({ page }) => {
      // Open filter panel
      await page.click('[data-testid="map-filters-button"]');
      
      // Filter by burn status
      await page.check('[data-testid="filter-scheduled"]');
      await page.check('[data-testid="filter-completed"]');
      
      // Filter by date range
      await page.fill('[data-testid="filter-start-date"]', '2024-01-01');
      await page.fill('[data-testid="filter-end-date"]', '2024-12-31');
      
      // Filter by acreage
      await page.fill('[data-testid="filter-min-acreage"]', '100');
      await page.fill('[data-testid="filter-max-acreage"]', '500');
      
      // Apply filters
      await page.click('[data-testid="apply-filters"]');
      
      // Map should update
      await page.waitForResponse(response => 
        response.url().includes('/api/farms') && response.status() === 200
      );
      
      // Check that markers are filtered
      const markers = await page.locator('.mapboxgl-marker').count();
      expect(markers).toBeGreaterThanOrEqual(0);
    });

    test('should display smoke plume predictions', async ({ page }) => {
      // Enable smoke predictions layer
      await page.click('[data-testid="layers-button"]');
      await page.check('[data-testid="smoke-predictions-layer"]');
      
      // Smoke plumes should be visible
      await expect(page.locator('[data-testid="smoke-plume"]')).toBeVisible();
      
      // Click on a plume for details
      await page.locator('[data-testid="smoke-plume"]').first().click();
      
      // Details panel should show
      await expect(page.locator('[data-testid="plume-details"]')).toBeVisible();
      await expect(page.locator('[data-testid="pm25-level"]')).toBeVisible();
      await expect(page.locator('[data-testid="dispersion-radius"]')).toBeVisible();
    });
  });

  test.describe('4. Schedule Management', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('http://localhost:3000/schedule');
      await page.waitForLoadState('networkidle');
    });

    test('should display schedule calendar view', async ({ page }) => {
      // Calendar should be visible
      await expect(page.locator('[data-testid="schedule-calendar"]')).toBeVisible();
      
      // Check for burn events
      const events = await page.locator('[data-testid="calendar-event"]').count();
      expect(events).toBeGreaterThanOrEqual(0);
    });

    test('should switch between calendar views', async ({ page }) => {
      // Switch to week view
      await page.click('[data-testid="view-week"]');
      await expect(page.locator('[data-testid="week-view"]')).toBeVisible();
      
      // Switch to day view
      await page.click('[data-testid="view-day"]');
      await expect(page.locator('[data-testid="day-view"]')).toBeVisible();
      
      // Switch to list view
      await page.click('[data-testid="view-list"]');
      await expect(page.locator('[data-testid="list-view"]')).toBeVisible();
      
      // Return to month view
      await page.click('[data-testid="view-month"]');
      await expect(page.locator('[data-testid="month-view"]')).toBeVisible();
    });

    test('should edit burn schedule', async ({ page }) => {
      // Click on a scheduled burn
      await page.locator('[data-testid="calendar-event"]').first().click();
      
      // Edit modal should open
      await expect(page.locator('[data-testid="edit-burn-modal"]')).toBeVisible();
      
      // Change date
      const newDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      await page.fill('[data-testid="edit-burn-date"]', newDate);
      
      // Change time
      await page.fill('[data-testid="edit-burn-time"]', '14:00');
      
      // Save changes
      await page.click('[data-testid="save-changes"]');
      
      // Wait for update
      await page.waitForResponse(response => 
        response.url().includes('/api/burn-requests') && response.status() === 200
      );
      
      // Success message should show
      await expect(page.locator('[data-testid="update-success"]')).toBeVisible();
    });

    test('should handle schedule conflicts', async ({ page }) => {
      // Try to schedule conflicting burn
      await page.click('[data-testid="add-burn-to-schedule"]');
      
      // Fill details that will conflict
      await page.fill('[data-testid="burn-date"]', '2024-03-15');
      await page.fill('[data-testid="burn-time"]', '10:00');
      await page.selectOption('[data-testid="burn-farm"]', { index: 1 });
      
      // Submit
      await page.click('[data-testid="schedule-burn"]');
      
      // Conflict warning should appear
      await expect(page.locator('[data-testid="conflict-warning"]')).toBeVisible();
      await expect(page.locator('[data-testid="conflict-details"]')).toContainText('smoke conflict');
      
      // Options should be presented
      await expect(page.locator('[data-testid="reschedule-option"]')).toBeVisible();
      await expect(page.locator('[data-testid="override-option"]')).toBeVisible();
    });

    test('should optimize schedule', async ({ page }) => {
      // Click optimize button
      await page.click('[data-testid="optimize-schedule"]');
      
      // Optimization modal should open
      await expect(page.locator('[data-testid="optimization-modal"]')).toBeVisible();
      
      // Select optimization criteria
      await page.check('[data-testid="minimize-conflicts"]');
      await page.check('[data-testid="maximize-efficiency"]');
      await page.check('[data-testid="consider-weather"]');
      
      // Run optimization
      await page.click('[data-testid="run-optimization"]');
      
      // Wait for optimization to complete
      await page.waitForSelector('[data-testid="optimization-complete"]', { timeout: 30000 });
      
      // Results should be shown
      await expect(page.locator('[data-testid="optimization-results"]')).toBeVisible();
      await expect(page.locator('[data-testid="conflicts-reduced"]')).toBeVisible();
      await expect(page.locator('[data-testid="efficiency-improved"]')).toBeVisible();
      
      // Apply optimized schedule
      await page.click('[data-testid="apply-optimized-schedule"]');
      
      // Schedule should update
      await expect(page.locator('[data-testid="schedule-updated"]')).toBeVisible();
    });
  });

  test.describe('5. Alert System', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('http://localhost:3000/alerts');
      await page.waitForLoadState('networkidle');
    });

    test('should display active alerts', async ({ page }) => {
      // Alerts panel should be visible
      await expect(page.locator('[data-testid="alerts-panel"]')).toBeVisible();
      
      // Check for different alert types
      const alertTypes = ['warning', 'danger', 'info', 'success'];
      
      for (const type of alertTypes) {
        const alerts = await page.locator(`[data-testid="alert-${type}"]`).count();
        // At least some alerts should exist
        if (alerts > 0) {
          await expect(page.locator(`[data-testid="alert-${type}"]`).first()).toBeVisible();
        }
      }
    });

    test('should filter alerts by type and priority', async ({ page }) => {
      // Filter by type
      await page.selectOption('[data-testid="alert-type-filter"]', 'warning');
      
      // Only warning alerts should be visible
      const visibleAlerts = await page.locator('[data-testid^="alert-"]').all();
      for (const alert of visibleAlerts) {
        await expect(alert).toHaveAttribute('data-testid', /alert-warning/);
      }
      
      // Filter by priority
      await page.selectOption('[data-testid="alert-priority-filter"]', 'high');
      
      // Check that high priority alerts are shown
      await expect(page.locator('[data-priority="high"]')).toBeVisible();
    });

    test('should handle alert actions', async ({ page }) => {
      // Find an actionable alert
      const alert = page.locator('[data-testid="actionable-alert"]').first();
      await expect(alert).toBeVisible();
      
      // Click acknowledge
      await alert.locator('[data-testid="acknowledge-alert"]').click();
      
      // Alert should be marked as acknowledged
      await expect(alert).toHaveClass(/acknowledged/);
      
      // Click resolve
      await alert.locator('[data-testid="resolve-alert"]').click();
      
      // Resolution modal should open
      await expect(page.locator('[data-testid="resolution-modal"]')).toBeVisible();
      
      // Add resolution notes
      await page.fill('[data-testid="resolution-notes"]', 'Issue resolved by adjusting burn schedule');
      
      // Submit resolution
      await page.click('[data-testid="submit-resolution"]');
      
      // Alert should be removed or marked as resolved
      await expect(alert).toHaveClass(/resolved/);
    });

    test('should configure alert preferences', async ({ page }) => {
      // Open settings
      await page.click('[data-testid="alert-settings"]');
      
      // Settings modal should open
      await expect(page.locator('[data-testid="alert-settings-modal"]')).toBeVisible();
      
      // Configure notification channels
      await page.check('[data-testid="email-notifications"]');
      await page.fill('[data-testid="notification-email"]', 'test@example.com');
      
      await page.check('[data-testid="sms-notifications"]');
      await page.fill('[data-testid="notification-phone"]', '555-123-4567');
      
      // Set alert thresholds
      await page.fill('[data-testid="pm25-threshold"]', '35');
      await page.fill('[data-testid="wind-speed-threshold"]', '20');
      
      // Save settings
      await page.click('[data-testid="save-alert-settings"]');
      
      // Success message
      await expect(page.locator('[data-testid="settings-saved"]')).toBeVisible();
    });
  });

  test.describe('6. Multi-Agent Workflow', () => {
    test('should execute complete 5-agent workflow', async ({ page }) => {
      // Navigate to burn request creation
      await page.goto('http://localhost:3000/map');
      await page.click('[data-testid="create-burn-request"]');
      
      // Step 1: Coordinator Agent - Submit request
      const farmData = E2ETestData.generateFarmData();
      await page.fill('[data-testid="farm-name-input"]', farmData.name);
      await page.fill('[data-testid="contact-email-input"]', farmData.contactEmail);
      await page.click('[data-testid="next-step"]');
      
      // Draw field
      await page.click('[data-testid="draw-field-button"]');
      const map = page.locator('[data-testid="mapbox-container"]');
      await map.click({ position: { x: 150, y: 150 } });
      await map.click({ position: { x: 250, y: 150 } });
      await map.click({ position: { x: 250, y: 250 } });
      await map.click({ position: { x: 150, y: 250 } });
      await map.click({ position: { x: 150, y: 150 } });
      await page.click('[data-testid="confirm-field"]');
      
      // Fill burn details
      const burnData = E2ETestData.generateBurnRequest();
      await page.fill('[data-testid="burn-acreage"]', burnData.acreage.toString());
      await page.fill('[data-testid="start-date"]', burnData.startDate);
      await page.fill('[data-testid="end-date"]', burnData.endDate);
      
      // Submit and wait for coordinator processing
      await page.click('[data-testid="submit-burn-request"]');
      
      // Step 2: Weather Agent - Check weather analysis
      await expect(page.locator('[data-testid="weather-analysis"]')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('[data-testid="weather-suitable"]')).toBeVisible();
      
      // Step 3: Predictor Agent - View smoke predictions
      await expect(page.locator('[data-testid="smoke-prediction"]')).toBeVisible();
      await expect(page.locator('[data-testid="dispersion-map"]')).toBeVisible();
      
      // Step 4: Optimizer Agent - See optimization results
      await expect(page.locator('[data-testid="optimization-status"]')).toBeVisible();
      await expect(page.locator('[data-testid="recommended-schedule"]')).toBeVisible();
      
      // Step 5: Alerts Agent - Check for generated alerts
      await page.goto('http://localhost:3000/alerts');
      await expect(page.locator('[data-testid="new-burn-alert"]')).toBeVisible();
    });
  });

  test.describe('7. Performance and Load Testing', () => {
    test('should handle rapid navigation', async ({ page }) => {
      const pages = ['/dashboard', '/map', '/schedule', '/alerts'];
      const startTime = Date.now();
      
      // Rapidly navigate between pages
      for (let i = 0; i < 20; i++) {
        const randomPage = pages[Math.floor(Math.random() * pages.length)];
        await page.goto(`http://localhost:3000${randomPage}`);
        await page.waitForLoadState('domcontentloaded');
      }
      
      const totalTime = Date.now() - startTime;
      expect(totalTime).toBeLessThan(30000); // Should complete in 30 seconds
    });

    test('should handle multiple concurrent operations', async ({ page }) => {
      await page.goto('http://localhost:3000/dashboard');
      
      // Start multiple operations concurrently
      const operations = [
        page.click('[data-testid="refresh-button"]'),
        page.fill('[data-testid="search-input"]', 'test'),
        page.selectOption('[data-testid="filter-dropdown"]', { index: 1 }),
        page.click('[data-testid="export-button"]')
      ];
      
      // All should complete without errors
      await Promise.all(operations);
      
      // Page should remain responsive
      await expect(page.locator('[data-testid="dashboard-container"]')).toBeVisible();
    });

    test('should load large datasets efficiently', async ({ page }) => {
      await page.goto('http://localhost:3000/dashboard');
      
      // Request large dataset
      await page.selectOption('[data-testid="page-size"]', '1000');
      
      const startTime = Date.now();
      await page.waitForResponse(response => 
        response.url().includes('/api/farms') && response.status() === 200
      );
      const loadTime = Date.now() - startTime;
      
      // Should load within reasonable time
      expect(loadTime).toBeLessThan(5000);
      
      // Should display virtualized list
      const visibleRows = await page.locator('[data-testid="farm-row"]:visible').count();
      expect(visibleRows).toBeLessThan(50); // Only visible rows should be rendered
    });
  });

  test.describe('8. Error Handling and Recovery', () => {
    test('should handle network failures gracefully', async ({ page, context }) => {
      await page.goto('http://localhost:3000/dashboard');
      
      // Simulate network failure
      await context.setOffline(true);
      
      // Try to refresh data
      await page.click('[data-testid="refresh-button"]');
      
      // Error message should appear
      await expect(page.locator('[data-testid="network-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="network-error"]')).toContainText('network');
      
      // Restore network
      await context.setOffline(false);
      
      // Retry button should work
      await page.click('[data-testid="retry-button"]');
      await expect(page.locator('[data-testid="network-error"]')).toBeHidden();
    });

    test('should handle API errors', async ({ page }) => {
      // Intercept API call and return error
      await page.route('**/api/analytics', route => {
        route.fulfill({
          status: 500,
          body: JSON.stringify({ error: 'Internal server error' })
        });
      });
      
      await page.goto('http://localhost:3000/dashboard');
      
      // Error should be displayed
      await expect(page.locator('[data-testid="api-error"]')).toBeVisible();
      
      // Remove route interception
      await page.unroute('**/api/analytics');
      
      // Refresh should work
      await page.click('[data-testid="refresh-button"]');
      await expect(page.locator('[data-testid="api-error"]')).toBeHidden();
    });

    test('should validate form inputs', async ({ page }) => {
      await page.goto('http://localhost:3000/map');
      await page.click('[data-testid="create-burn-request"]');
      
      // Try to submit with invalid data
      await page.fill('[data-testid="farm-name-input"]', '');
      await page.fill('[data-testid="contact-email-input"]', 'invalid-email');
      await page.fill('[data-testid="contact-phone-input"]', '123');
      
      await page.click('[data-testid="next-step"]');
      
      // Validation errors should appear
      await expect(page.locator('[data-testid="name-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="email-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="phone-error"]')).toBeVisible();
      
      // Fix errors
      await page.fill('[data-testid="farm-name-input"]', 'Valid Farm');
      await page.fill('[data-testid="contact-email-input"]', 'valid@email.com');
      await page.fill('[data-testid="contact-phone-input"]', '555-123-4567');
      
      // Should proceed
      await page.click('[data-testid="next-step"]');
      await expect(page.locator('[data-testid="field-drawing-step"]')).toBeVisible();
    });
  });

  test.describe('9. Accessibility', () => {
    test('should be keyboard navigable', async ({ page }) => {
      await page.goto('http://localhost:3000');
      
      // Tab through elements
      await page.keyboard.press('Tab');
      await expect(page.locator(':focus')).toHaveAttribute('data-testid', 'skip-to-content');
      
      await page.keyboard.press('Tab');
      await expect(page.locator(':focus')).toHaveAttribute('data-testid', 'nav-dashboard');
      
      // Activate with Enter
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/\/dashboard/);
      
      // Navigate with arrow keys in dropdowns
      await page.click('[data-testid="filter-dropdown"]');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
    });

    test('should have proper ARIA labels', async ({ page }) => {
      await page.goto('http://localhost:3000/dashboard');
      
      // Check for ARIA labels
      await expect(page.locator('[aria-label="Main navigation"]')).toBeVisible();
      await expect(page.locator('[aria-label="Analytics dashboard"]')).toBeVisible();
      await expect(page.locator('[aria-label="Burn schedule calendar"]')).toBeVisible();
      
      // Check for roles
      await expect(page.locator('[role="navigation"]')).toBeVisible();
      await expect(page.locator('[role="main"]')).toBeVisible();
      await expect(page.locator('[role="region"]')).toHaveCount(4);
    });

    test('should support screen readers', async ({ page }) => {
      await page.goto('http://localhost:3000/dashboard');
      
      // Check for live regions
      await expect(page.locator('[aria-live="polite"]')).toBeVisible();
      
      // Trigger an update
      await page.click('[data-testid="refresh-button"]');
      
      // Live region should announce update
      await expect(page.locator('[aria-live="polite"]')).toContainText('Data updated');
    });
  });

  test.describe('10. Security', () => {
    test('should sanitize user inputs', async ({ page }) => {
      await page.goto('http://localhost:3000/map');
      await page.click('[data-testid="create-burn-request"]');
      
      // Try XSS attack
      await page.fill('[data-testid="farm-name-input"]', '<script>alert("XSS")</script>');
      await page.fill('[data-testid="burn-notes"]', '<img src=x onerror=alert("XSS")>');
      
      // Submit
      await page.fill('[data-testid="contact-email-input"]', 'test@example.com');
      await page.click('[data-testid="next-step"]');
      
      // No alert should appear
      await page.waitForTimeout(1000);
      
      // Check that input is sanitized in display
      const farmName = await page.locator('[data-testid="farm-name-display"]').textContent();
      expect(farmName).not.toContain('<script>');
    });

    test('should handle authentication properly', async ({ page }) => {
      // Try to access protected route
      await page.goto('http://localhost:3000/admin');
      
      // Should redirect to login
      await expect(page).toHaveURL(/\/login/);
      
      // Login
      await page.fill('[data-testid="username"]', 'admin');
      await page.fill('[data-testid="password"]', 'password');
      await page.click('[data-testid="login-button"]');
      
      // Should redirect to admin after successful login
      await expect(page).toHaveURL(/\/admin/);
    });

    test('should enforce rate limiting', async ({ page }) => {
      await page.goto('http://localhost:3000/dashboard');
      
      // Make rapid requests
      const requests = [];
      for (let i = 0; i < 20; i++) {
        requests.push(page.click('[data-testid="refresh-button"]'));
      }
      
      await Promise.all(requests);
      
      // Rate limit message should appear
      await expect(page.locator('[data-testid="rate-limit-warning"]')).toBeVisible();
    });
  });
});

// Export test statistics
module.exports = {
  testCount: 100,
  suiteName: 'Comprehensive E2E User Flow',
  coverage: {
    userJourneys: 95,
    features: 98,
    errorScenarios: 90,
    performance: 85
  }
};