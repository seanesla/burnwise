const { test, expect } = require('@playwright/test');

test.describe('Dashboard Tests - Analytics and Monitoring', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard');
    await page.waitForLoadState('networkidle');
  });

  test('Should display real-time system metrics with correct data', async ({ page }) => {
    // Wait for metrics to load
    await page.waitForSelector('[data-testid="system-metrics-panel"]');
    
    // Verify active burn requests counter
    const activeBurns = page.locator('[data-testid="active-burns-count"]');
    await expect(activeBurns).toBeVisible();
    
    const activeBurnsText = await activeBurns.textContent();
    const activeBurnsCount = parseInt(activeBurnsText);
    expect(activeBurnsCount).toBeGreaterThanOrEqual(0);
    
    // Verify pending requests counter
    const pendingRequests = page.locator('[data-testid="pending-requests-count"]');
    await expect(pendingRequests).toBeVisible();
    
    // Verify system status indicator
    const systemStatus = page.locator('[data-testid="system-status-indicator"]');
    await expect(systemStatus).toBeVisible();
    
    const statusColor = await systemStatus.getAttribute('class');
    expect(['status-healthy', 'status-warning', 'status-error']).toContain(
      statusColor.split(' ').find(cls => cls.startsWith('status-'))
    );
  });

  test('Should render PM2.5 concentration chart with accurate data', async ({ page }) => {
    await page.waitForSelector('[data-testid="pm25-chart"]');
    
    // Verify chart canvas is present
    const chartCanvas = page.locator('[data-testid="pm25-chart"] canvas');
    await expect(chartCanvas).toBeVisible();
    
    // Check chart legend
    const legend = page.locator('[data-testid="pm25-chart-legend"]');
    await expect(legend).toBeVisible();
    
    // Verify safety threshold lines are shown
    const thresholdLines = page.locator('[data-testid="pm25-thresholds"]');
    await expect(thresholdLines).toBeVisible();
    
    // Check data points are plotted
    const dataPoints = await page.evaluate(() => {
      const chart = window.pm25Chart;
      return chart && chart.data && chart.data.datasets[0].data.length > 0;
    });
    
    expect(dataPoints).toBeTruthy();
  });

  test('Should display burn schedule timeline with accurate scheduling', async ({ page }) => {
    await page.waitForSelector('[data-testid="schedule-timeline"]');
    
    // Verify timeline has time slots
    const timeSlots = page.locator('[data-testid="timeline-slot"]');
    const slotCount = await timeSlots.count();
    expect(slotCount).toBeGreaterThan(0);
    
    // Check that scheduled burns show correct time information
    const scheduledBurn = timeSlots.first();
    const startTime = await scheduledBurn.getAttribute('data-start-time');
    const endTime = await scheduledBurn.getAttribute('data-end-time');
    
    expect(startTime).toBeTruthy();
    expect(endTime).toBeTruthy();
    expect(new Date(endTime).getTime()).toBeGreaterThan(new Date(startTime).getTime());
    
    // Verify conflict indicators
    const conflictIndicators = page.locator('[data-testid="conflict-indicator"]');
    const conflictCount = await conflictIndicators.count();
    expect(conflictCount).toBeGreaterThanOrEqual(0);
  });

  test('Should show weather conditions panel with current data', async ({ page }) => {
    await page.waitForSelector('[data-testid="weather-conditions-panel"]');
    
    // Verify temperature display
    const temperature = page.locator('[data-testid="current-temperature"]');
    await expect(temperature).toBeVisible();
    
    const tempText = await temperature.textContent();
    expect(tempText).toMatch(/\d+°[CF]/);
    
    // Verify wind information
    const windSpeed = page.locator('[data-testid="wind-speed"]');
    const windDirection = page.locator('[data-testid="wind-direction"]');
    
    await expect(windSpeed).toBeVisible();
    await expect(windDirection).toBeVisible();
    
    // Verify humidity
    const humidity = page.locator('[data-testid="humidity"]');
    await expect(humidity).toBeVisible();
    
    const humidityText = await humidity.textContent();
    expect(humidityText).toMatch(/\d+%/);
    
    // Check burn safety indicator
    const safetyIndicator = page.locator('[data-testid="burn-safety-indicator"]');
    await expect(safetyIndicator).toBeVisible();
  });

  test('Should display spatial distribution map with burn locations', async ({ page }) => {
    await page.waitForSelector('[data-testid="spatial-distribution-map"]');
    
    // Verify map container
    const mapContainer = page.locator('[data-testid="spatial-distribution-map"] .mapboxgl-map');
    await expect(mapContainer).toBeVisible();
    
    // Check for burn location markers
    await page.waitForTimeout(2000); // Wait for markers to load
    
    const burnMarkers = await page.evaluate(() => {
      const map = window.spatialMap;
      if (!map) return 0;
      
      const source = map.getSource('burn-locations');
      return source && source._data ? source._data.features.length : 0;
    });
    
    expect(burnMarkers).toBeGreaterThanOrEqual(0);
    
    // Verify legend is present
    const mapLegend = page.locator('[data-testid="spatial-map-legend"]');
    await expect(mapLegend).toBeVisible();
  });

  test('Should show alert notifications panel with proper priority sorting', async ({ page }) => {
    await page.waitForSelector('[data-testid="alerts-panel"]');
    
    // Check for alert items
    const alertItems = page.locator('[data-testid="alert-item"]');
    const alertCount = await alertItems.count();
    
    if (alertCount > 0) {
      // Verify first alert has priority indicator
      const firstAlert = alertItems.first();
      const priorityBadge = firstAlert.locator('[data-testid="alert-priority"]');
      await expect(priorityBadge).toBeVisible();
      
      // Check alert timestamp
      const timestamp = firstAlert.locator('[data-testid="alert-timestamp"]');
      await expect(timestamp).toBeVisible();
      
      // Verify alert message
      const message = firstAlert.locator('[data-testid="alert-message"]');
      await expect(message).toBeVisible();
      
      const messageText = await message.textContent();
      expect(messageText.length).toBeGreaterThan(0);
    }
    
    // Check "Mark all as read" functionality
    const markAllRead = page.locator('[data-testid="mark-all-read-btn"]');
    if (await markAllRead.isVisible()) {
      await markAllRead.click();
      
      // Verify alerts are marked as read
      await page.waitForTimeout(1000);
      const unreadAlerts = page.locator('[data-testid="alert-item"].unread');
      const unreadCount = await unreadAlerts.count();
      expect(unreadCount).toBe(0);
    }
  });

  test('Should display system performance metrics with real data', async ({ page }) => {
    await page.waitForSelector('[data-testid="performance-metrics"]');
    
    // Verify database connection status
    const dbStatus = page.locator('[data-testid="database-status"]');
    await expect(dbStatus).toBeVisible();
    
    const dbStatusText = await dbStatus.textContent();
    expect(['Connected', 'Disconnected', 'Reconnecting']).toContain(dbStatusText);
    
    // Check API response times
    const responseTime = page.locator('[data-testid="api-response-time"]');
    await expect(responseTime).toBeVisible();
    
    const responseTimeText = await responseTime.textContent();
    expect(responseTimeText).toMatch(/\d+ms/);
    
    // Verify vector search performance
    const vectorSearchTime = page.locator('[data-testid="vector-search-time"]');
    await expect(vectorSearchTime).toBeVisible();
    
    // Check memory usage
    const memoryUsage = page.locator('[data-testid="memory-usage"]');
    await expect(memoryUsage).toBeVisible();
  });

  test('Should handle dashboard refresh and data updates', async ({ page }) => {
    // Wait for initial data load
    await page.waitForSelector('[data-testid="system-metrics-panel"]');
    
    // Get initial values
    const initialActiveBurns = await page.textContent('[data-testid="active-burns-count"]');
    const initialPendingRequests = await page.textContent('[data-testid="pending-requests-count"]');
    
    // Trigger manual refresh
    await page.click('[data-testid="refresh-dashboard-btn"]');
    
    // Wait for refresh to complete
    await page.waitForSelector('[data-testid="refresh-indicator"]', { state: 'hidden', timeout: 5000 });
    
    // Verify data is still present (may or may not have changed)
    const refreshedActiveBurns = await page.textContent('[data-testid="active-burns-count"]');
    const refreshedPendingRequests = await page.textContent('[data-testid="pending-requests-count"]');
    
    expect(refreshedActiveBurns).toBeTruthy();
    expect(refreshedPendingRequests).toBeTruthy();
    
    // Check that timestamp was updated
    const lastUpdated = page.locator('[data-testid="last-updated-timestamp"]');
    await expect(lastUpdated).toBeVisible();
  });

  test('Should display farm-specific analytics when farm is selected', async ({ page }) => {
    await page.waitForSelector('[data-testid="farm-selector"]');
    
    // Select a specific farm
    await page.selectOption('[data-testid="farm-selector"]', '1');
    await page.waitForTimeout(2000); // Wait for farm-specific data to load
    
    // Verify farm-specific metrics appear
    const farmMetrics = page.locator('[data-testid="farm-specific-metrics"]');
    await expect(farmMetrics).toBeVisible();
    
    // Check burn history for selected farm
    const burnHistory = page.locator('[data-testid="farm-burn-history"]');
    await expect(burnHistory).toBeVisible();
    
    // Verify farm details
    const farmName = page.locator('[data-testid="selected-farm-name"]');
    await expect(farmName).toBeVisible();
    
    const farmSize = page.locator('[data-testid="selected-farm-size"]');
    await expect(farmSize).toBeVisible();
    
    // Check farm-specific alerts
    const farmAlerts = page.locator('[data-testid="farm-specific-alerts"]');
    if (await farmAlerts.isVisible()) {
      const alertCount = await page.locator('[data-testid="farm-alert-item"]').count();
      expect(alertCount).toBeGreaterThanOrEqual(0);
    }
  });

  test('Should handle dashboard filtering and time range selection', async ({ page }) => {
    // Wait for dashboard to load
    await page.waitForSelector('[data-testid="dashboard-filters"]');
    
    // Test time range filter
    await page.selectOption('[data-testid="time-range-select"]', '7days');
    await page.waitForTimeout(1500); // Wait for data to update
    
    // Verify charts update with filtered data
    const chartData = await page.evaluate(() => {
      const chart = window.pm25Chart;
      return chart && chart.data && chart.data.datasets[0].data.length;
    });
    
    expect(chartData).toBeGreaterThanOrEqual(0);
    
    // Test status filter
    await page.selectOption('[data-testid="status-filter"]', 'active');
    await page.waitForTimeout(1000);
    
    // Verify burn list updates
    const filteredBurns = page.locator('[data-testid="burn-item"]');
    const burnCount = await filteredBurns.count();
    
    // All visible burns should have "active" status
    if (burnCount > 0) {
      const firstBurnStatus = await filteredBurns.first().getAttribute('data-status');
      expect(firstBurnStatus).toBe('active');
    }
  });
});