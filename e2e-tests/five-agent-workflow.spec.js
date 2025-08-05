const { test, expect } = require('@playwright/test');

test.describe('Complete 5-Agent Workflow E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage and ensure clean state
    await page.goto('http://localhost:3000');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('should complete full burn request workflow through all 5 agents', async ({ page }) => {
    // Step 1: Navigate to burn request form
    await page.goto('http://localhost:3000');
    await page.waitForTimeout(6000); // Wait for startup animation
    
    await page.click('button:has-text("Request a Burn")');
    await expect(page).toHaveURL('http://localhost:3000/request');
    
    // Step 2: Fill out burn request form
    await page.fill('[data-testid="farm-id-input"]', 'farm_e2e_123');
    await page.fill('[data-testid="contact-phone-input"]', '+1234567890');
    await page.fill('[data-testid="acres-input"]', '100');
    await page.selectOption('[data-testid="fuel-type-select"]', 'wheat_stubble');
    await page.selectOption('[data-testid="burn-intensity-select"]', 'moderate');
    
    // Set burn date to tomorrow at 9 AM
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    await page.fill('[data-testid="burn-date-input"]', tomorrow.toISOString().slice(0, 16));
    
    // Step 3: Draw field boundaries on map
    const mapContainer = page.locator('[data-testid="field-drawing-map"]');
    await expect(mapContainer).toBeVisible();
    
    // Click to draw field boundary points
    const boundingBox = await mapContainer.boundingBox();
    const centerX = boundingBox.x + boundingBox.width / 2;
    const centerY = boundingBox.y + boundingBox.height / 2;
    
    // Draw a square field
    await page.mouse.click(centerX - 50, centerY - 50); // Top-left
    await page.mouse.click(centerX + 50, centerY - 50); // Top-right
    await page.mouse.click(centerX + 50, centerY + 50); // Bottom-right
    await page.mouse.click(centerX - 50, centerY + 50); // Bottom-left
    await page.mouse.click(centerX - 50, centerY - 50); // Close polygon
    
    // Step 4: Submit burn request
    await page.click('[data-testid="submit-burn-request"]');
    
    // Step 5: Verify Agent 1 (Coordinator) processing
    await expect(page.locator('[data-testid="agent-status-coordinator"]')).toContainText('Processing');
    await expect(page.locator('[data-testid="priority-score"]')).toBeVisible({ timeout: 10000 });
    
    const priorityScore = await page.locator('[data-testid="priority-score"]').textContent();
    expect(parseFloat(priorityScore)).toBeGreaterThan(0);
    expect(parseFloat(priorityScore)).toBeLessThanOrEqual(10);
    
    // Step 6: Verify Agent 2 (Weather) processing
    await expect(page.locator('[data-testid="agent-status-weather"]')).toContainText('Processing');
    await expect(page.locator('[data-testid="weather-suitability"]')).toBeVisible({ timeout: 10000 });
    
    const suitabilityScore = await page.locator('[data-testid="weather-suitability"]').textContent();
    expect(parseFloat(suitabilityScore)).toBeGreaterThan(0);
    expect(parseFloat(suitabilityScore)).toBeLessThanOrEqual(10);
    
    // Step 7: Verify Agent 3 (Predictor) processing
    await expect(page.locator('[data-testid="agent-status-predictor"]')).toContainText('Processing');
    await expect(page.locator('[data-testid="smoke-dispersion"]')).toBeVisible({ timeout: 15000 });
    
    const maxPM25 = await page.locator('[data-testid="max-pm25"]').textContent();
    expect(parseFloat(maxPM25)).toBeGreaterThan(0);
    
    // Check EPA compliance indicator
    const epaStatus = await page.locator('[data-testid="epa-compliance"]').textContent();
    expect(['Compliant', 'Warning', 'Violation']).toContain(epaStatus);
    
    // Step 8: Verify Agent 4 (Optimizer) processing
    await expect(page.locator('[data-testid="agent-status-optimizer"]')).toContainText('Processing');
    await expect(page.locator('[data-testid="optimized-schedule"]')).toBeVisible({ timeout: 20000 });
    
    const scheduledTime = await page.locator('[data-testid="scheduled-time"]').textContent();
    expect(scheduledTime).toBeTruthy();
    
    // Step 9: Verify Agent 5 (Alerts) processing
    await expect(page.locator('[data-testid="agent-status-alerts"]')).toContainText('Processing');
    await expect(page.locator('[data-testid="alerts-sent"]')).toBeVisible({ timeout: 5000 });
    
    const alertsSent = await page.locator('[data-testid="alerts-sent"]').textContent();
    expect(parseInt(alertsSent)).toBeGreaterThanOrEqual(0);
    
    // Step 10: Verify workflow completion
    await expect(page.locator('[data-testid="workflow-status"]')).toContainText('Completed', { timeout: 30000 });
    await expect(page.locator('[data-testid="burn-request-id"]')).toBeVisible();
    
    const burnRequestId = await page.locator('[data-testid="burn-request-id"]').textContent();
    expect(burnRequestId).toMatch(/\d+/); // Should be a numeric ID
    
    // Step 11: Navigate to dashboard to verify data persistence
    await page.click('[data-testid="view-dashboard-button"]');
    await expect(page).toHaveURL('http://localhost:3000/dashboard');
    
    // Verify the burn request appears in dashboard
    await expect(page.locator(`[data-burn-id="${burnRequestId}"]`)).toBeVisible();
  });

  test('should handle agent failures gracefully and show error states', async ({ page }) => {
    // Simulate agent failure by using invalid data that will cause processing errors
    await page.goto('http://localhost:3000/request');
    
    // Fill form with problematic data
    await page.fill('[data-testid="farm-id-input"]', 'invalid_farm_id');
    await page.fill('[data-testid="contact-phone-input"]', 'invalid-phone');
    await page.fill('[data-testid="acres-input"]', '-100'); // Negative acres
    await page.selectOption('[data-testid="fuel-type-select"]', 'invalid_fuel_type');
    
    // Submit the invalid request
    await page.click('[data-testid="submit-burn-request"]');
    
    // Should show validation errors
    await expect(page.locator('[data-testid="validation-errors"]')).toBeVisible();
    await expect(page.locator('[data-testid="agent-status-coordinator"]')).toContainText('Error');
    
    // Should show specific error messages
    const errorMessages = await page.locator('[data-testid="error-message"]').allTextContents();
    expect(errorMessages.some(msg => msg.includes('Invalid farm ID'))).toBe(true);
    expect(errorMessages.some(msg => msg.includes('Invalid phone'))).toBe(true);
  });

  test('should show real-time agent progress updates', async ({ page }) => {
    await page.goto('http://localhost:3000/request');
    
    // Fill valid form data
    await page.fill('[data-testid="farm-id-input"]', 'farm_progress_test');
    await page.fill('[data-testid="contact-phone-input"]', '+1234567890');
    await page.fill('[data-testid="acres-input"]', '150');
    await page.selectOption('[data-testid="fuel-type-select"]', 'rice_straw');
    await page.selectOption('[data-testid="burn-intensity-select"]', 'high');
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    await page.fill('[data-testid="burn-date-input"]', tomorrow.toISOString().slice(0, 16));
    
    // Submit and monitor progress
    await page.click('[data-testid="submit-burn-request"]');
    
    // Check progress indicators appear in sequence
    const progressSteps = [
      { agent: 'coordinator', expectedTime: 5000 },
      { agent: 'weather', expectedTime: 8000 },
      { agent: 'predictor', expectedTime: 15000 },
      { agent: 'optimizer', expectedTime: 25000 },
      { agent: 'alerts', expectedTime: 5000 }
    ];
    
    for (const step of progressSteps) {
      await expect(page.locator(`[data-testid="agent-progress-${step.agent}"]`)).toBeVisible({ 
        timeout: step.expectedTime 
      });
      
      // Check progress percentage increases
      const progressBar = page.locator(`[data-testid="progress-bar-${step.agent}"]`);
      await expect(progressBar).toHaveAttribute('data-progress', /[1-9][0-9]?%|100%/);
    }
  });

  test('should display vector similarity search results', async ({ page }) => {
    await page.goto('http://localhost:3000/request');
    
    // Fill form to trigger vector searches
    await page.fill('[data-testid="farm-id-input"]', 'farm_vector_test');
    await page.fill('[data-testid="acres-input"]', '75');
    await page.selectOption('[data-testid="fuel-type-select"]', 'corn_stalks');
    
    await page.click('[data-testid="submit-burn-request"]');
    
    // Wait for weather agent to complete vector search
    await expect(page.locator('[data-testid="similar-weather-patterns"]')).toBeVisible({ timeout: 15000 });
    
    // Verify similar weather patterns are displayed
    const similarPatterns = await page.locator('[data-testid="weather-pattern-item"]').count();
    expect(similarPatterns).toBeGreaterThanOrEqual(0);
    expect(similarPatterns).toBeLessThanOrEqual(5); // Limited to top 5
    
    // Check similarity scores are displayed
    if (similarPatterns > 0) {
      const firstSimilarity = await page.locator('[data-testid="similarity-score"]').first().textContent();
      expect(parseFloat(firstSimilarity)).toBeGreaterThan(0);
      expect(parseFloat(firstSimilarity)).toBeLessThanOrEqual(1);
    }
    
    // Wait for predictor to show similar burn patterns
    await expect(page.locator('[data-testid="similar-burn-patterns"]')).toBeVisible({ timeout: 15000 });
    
    const similarBurns = await page.locator('[data-testid="burn-pattern-item"]').count();
    expect(similarBurns).toBeGreaterThanOrEqual(0);
  });

  test('should show conflict detection and resolution', async ({ page }) => {
    await page.goto('http://localhost:3000/request');
    
    // Submit burn request that will likely have conflicts
    await page.fill('[data-testid="farm-id-input"]', 'farm_conflict_test');
    await page.fill('[data-testid="acres-input"]', '200'); // Large burn
    await page.selectOption('[data-testid="fuel-type-select"]', 'rice_straw'); // High emission fuel
    await page.selectOption('[data-testid="burn-intensity-select"]', 'high');
    
    // Set for peak burn time when conflicts are likely
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(12, 0, 0, 0); // Peak time
    await page.fill('[data-testid="burn-date-input"]', tomorrow.toISOString().slice(0, 16));
    
    await page.click('[data-testid="submit-burn-request"]');
    
    // Wait for predictor to detect conflicts
    await expect(page.locator('[data-testid="conflict-detection"]')).toBeVisible({ timeout: 20000 });
    
    // Check if conflicts are displayed
    const conflictCount = await page.locator('[data-testid="conflict-count"]').textContent();
    
    if (parseInt(conflictCount) > 0) {
      // Verify conflict details are shown
      await expect(page.locator('[data-testid="conflict-details"]')).toBeVisible();
      await expect(page.locator('[data-testid="conflict-severity"]')).toBeVisible();
      await expect(page.locator('[data-testid="conflict-distance"]')).toBeVisible();
      
      // Check if optimizer provides resolution
      await expect(page.locator('[data-testid="conflict-resolution"]')).toBeVisible({ timeout: 25000 });
      
      const resolvedTime = await page.locator('[data-testid="resolved-schedule-time"]').textContent();
      expect(resolvedTime).toBeTruthy();
    }
  });

  test('should display EPA compliance analysis', async ({ page }) => {
    await page.goto('http://localhost:3000/request');
    
    // Submit request for EPA compliance testing
    await page.fill('[data-testid="farm-id-input"]', 'farm_epa_test');
    await page.fill('[data-testid="acres-input"]', '250'); // Large burn for higher PM2.5
    await page.selectOption('[data-testid="fuel-type-select"]', 'rice_straw'); // High emission
    await page.selectOption('[data-testid="burn-intensity-select"]', 'high');
    
    await page.click('[data-testid="submit-burn-request"]');
    
    // Wait for predictor to calculate PM2.5 levels
    await expect(page.locator('[data-testid="pm25-analysis"]')).toBeVisible({ timeout: 20000 });
    
    // Check EPA compliance indicators
    const maxPM25 = await page.locator('[data-testid="max-pm25-level"]').textContent();
    const epaThreshold = await page.locator('[data-testid="epa-threshold"]').textContent();
    const complianceStatus = await page.locator('[data-testid="epa-compliance-status"]').textContent();
    
    expect(parseFloat(maxPM25)).toBeGreaterThan(0);
    expect(parseFloat(epaThreshold)).toBe(35); // EPA PM2.5 standard
    expect(['Compliant', 'Warning', 'Violation']).toContain(complianceStatus);
    
    // If violation, should show recommendations
    if (complianceStatus === 'Violation') {
      await expect(page.locator('[data-testid="epa-recommendations"]')).toBeVisible();
    }
  });

  test('should show real-time weather integration', async ({ page }) => {
    await page.goto('http://localhost:3000/request');
    
    // Fill form and submit
    await page.fill('[data-testid="farm-id-input"]', 'farm_weather_test');
    await page.fill('[data-testid="acres-input"]', '80');
    await page.selectOption('[data-testid="fuel-type-select"]', 'corn_stalks');
    
    await page.click('[data-testid="submit-burn-request"]');
    
    // Wait for weather agent to process
    await expect(page.locator('[data-testid="weather-data"]')).toBeVisible({ timeout: 10000 });
    
    // Verify weather data is displayed
    const temperature = await page.locator('[data-testid="temperature"]').textContent();
    const windSpeed = await page.locator('[data-testid="wind-speed"]').textContent();
    const windDirection = await page.locator('[data-testid="wind-direction"]').textContent();
    const stability = await page.locator('[data-testid="atmospheric-stability"]').textContent();
    
    expect(parseFloat(temperature)).toBeGreaterThan(-50);
    expect(parseFloat(temperature)).toBeLessThan(60);
    expect(parseFloat(windSpeed)).toBeGreaterThanOrEqual(0);
    expect(parseFloat(windSpeed)).toBeLessThan(50);
    expect(parseFloat(windDirection)).toBeGreaterThanOrEqual(0);
    expect(parseFloat(windDirection)).toBeLessThan(360);
    expect(['very_unstable', 'unstable', 'neutral', 'stable', 'very_stable']).toContain(stability);
  });

  test('should demonstrate TiDB vector search capabilities', async ({ page }) => {
    await page.goto('http://localhost:3000/request');
    
    // Submit request to trigger vector searches
    await page.fill('[data-testid="farm-id-input"]', 'farm_vector_demo');
    await page.fill('[data-testid="acres-input"]', '120');
    await page.selectOption('[data-testid="fuel-type-select"]', 'orchard_prunings');
    
    await page.click('[data-testid="submit-burn-request"]');
    
    // Wait for vector search results to appear
    await expect(page.locator('[data-testid="vector-search-results"]')).toBeVisible({ timeout: 15000 });
    
    // Check weather pattern vector search (128D)
    const weatherVectorResults = await page.locator('[data-testid="weather-vector-results"]');
    await expect(weatherVectorResults).toBeVisible();
    
    const weatherSimilarityScores = await page.locator('[data-testid="weather-similarity"]').allTextContents();
    weatherSimilarityScores.forEach(score => {
      expect(parseFloat(score)).toBeGreaterThan(0);
      expect(parseFloat(score)).toBeLessThanOrEqual(1);
    });
    
    // Check smoke plume vector search (64D)
    await expect(page.locator('[data-testid="smoke-vector-results"]')).toBeVisible({ timeout: 20000 });
    
    // Check burn history vector search (32D)
    await expect(page.locator('[data-testid="burn-vector-results"]')).toBeVisible({ timeout: 10000 });
    
    // Verify vector dimensions are displayed correctly
    const weatherDimensions = await page.locator('[data-testid="weather-vector-dimensions"]').textContent();
    const smokeDimensions = await page.locator('[data-testid="smoke-vector-dimensions"]').textContent();
    const burnDimensions = await page.locator('[data-testid="burn-vector-dimensions"]').textContent();
    
    expect(weatherDimensions).toBe('128');
    expect(smokeDimensions).toBe('64');
    expect(burnDimensions).toBe('32');
  });

  test('should handle optimization algorithm visualization', async ({ page }) => {
    await page.goto('http://localhost:3000/request');
    
    // Submit request that will require optimization
    await page.fill('[data-testid="farm-id-input"]', 'farm_optimization_test');
    await page.fill('[data-testid="acres-input"]', '180');
    await page.selectOption('[data-testid="fuel-type-select"]', 'wheat_stubble');
    
    await page.click('[data-testid="submit-burn-request"]');
    
    // Wait for optimizer to start
    await expect(page.locator('[data-testid="optimization-progress"]')).toBeVisible({ timeout: 25000 });
    
    // Check optimization metrics are displayed
    await expect(page.locator('[data-testid="current-temperature"]')).toBeVisible();
    await expect(page.locator('[data-testid="iteration-count"]')).toBeVisible();
    await expect(page.locator('[data-testid="current-score"]')).toBeVisible();
    
    // Monitor score improvement
    const initialScore = await page.locator('[data-testid="initial-score"]').textContent();
    
    // Wait for optimization to complete
    await expect(page.locator('[data-testid="optimization-complete"]')).toBeVisible({ timeout: 30000 });
    
    const finalScore = await page.locator('[data-testid="final-score"]').textContent();
    const iterations = await page.locator('[data-testid="total-iterations"]').textContent();
    
    expect(parseFloat(finalScore)).toBeGreaterThanOrEqual(parseFloat(initialScore));
    expect(parseInt(iterations)).toBeGreaterThan(0);
  });

  test('should demonstrate alert system functionality', async ({ page }) => {
    await page.goto('http://localhost:3000/request');
    
    // Submit high-priority request that will trigger alerts
    await page.fill('[data-testid="farm-id-input"]', 'farm_alerts_test');
    await page.fill('[data-testid="contact-phone-input"]', '+1234567890');
    await page.fill('[data-testid="acres-input"]', '300'); // Large burn
    await page.selectOption('[data-testid="fuel-type-select"]', 'rice_straw');
    await page.selectOption('[data-testid="burn-intensity-select"]', 'high');
    
    await page.click('[data-testid="submit-burn-request"]');
    
    // Wait for alerts agent to process
    await expect(page.locator('[data-testid="alert-processing"]')).toBeVisible({ timeout: 30000 });
    
    // Check alert generation
    await expect(page.locator('[data-testid="alerts-generated"]')).toBeVisible();
    
    const alertTypes = await page.locator('[data-testid="alert-type"]').allTextContents();
    expect(alertTypes.length).toBeGreaterThan(0);
    
    // Verify alert channels
    const smsAlerts = await page.locator('[data-testid="sms-alerts-sent"]').textContent();
    const socketAlerts = await page.locator('[data-testid="socket-alerts-sent"]').textContent();
    
    expect(parseInt(smsAlerts)).toBeGreaterThanOrEqual(0);
    expect(parseInt(socketAlerts)).toBeGreaterThanOrEqual(0);
    
    // Check real-time alert updates
    await expect(page.locator('[data-testid="real-time-alert"]')).toBeVisible();
  });

  test('should validate mathematical model accuracy display', async ({ page }) => {
    await page.goto('http://localhost:3000/request');
    
    // Submit request to see mathematical calculations
    await page.fill('[data-testid="farm-id-input"]', 'farm_math_test');
    await page.fill('[data-testid="acres-input"]', '100');
    await page.selectOption('[data-testid="fuel-type-select"]', 'wheat_stubble');
    await page.selectOption('[data-testid="burn-intensity-select"]', 'moderate');
    
    await page.click('[data-testid="submit-burn-request"]');
    
    // Wait for predictor calculations
    await expect(page.locator('[data-testid="gaussian-parameters"]')).toBeVisible({ timeout: 20000 });
    
    // Verify Gaussian plume parameters
    const sigmaY = await page.locator('[data-testid="sigma-y"]').textContent();
    const sigmaZ = await page.locator('[data-testid="sigma-z"]').textContent();
    const effectiveHeight = await page.locator('[data-testid="effective-height"]').textContent();
    
    expect(parseFloat(sigmaY)).toBeGreaterThan(0);
    expect(parseFloat(sigmaZ)).toBeGreaterThan(0);
    expect(parseFloat(effectiveHeight)).toBeGreaterThan(0);
    
    // Verify dispersion calculations
    const maxRadius = await page.locator('[data-testid="max-dispersion-radius"]').textContent();
    expect(parseFloat(maxRadius)).toBeGreaterThan(0);
    expect(parseFloat(maxRadius)).toBeLessThan(50000); // Reasonable upper bound
    
    // Check concentration calculations at different distances
    const concentrations = await page.locator('[data-testid="concentration-data"]').allTextContents();
    concentrations.forEach(conc => {
      expect(parseFloat(conc)).toBeGreaterThanOrEqual(0);
    });
  });

  test('should demonstrate complete system integration', async ({ page }) => {
    // Test the complete end-to-end system integration
    await page.goto('http://localhost:3000/request');
    
    // Fill comprehensive burn request
    await page.fill('[data-testid="farm-id-input"]', 'farm_integration_test');
    await page.fill('[data-testid="contact-phone-input"]', '+1555123456');
    await page.fill('[data-testid="contact-email-input"]', 'farmer@integrationtest.com');
    await page.fill('[data-testid="acres-input"]', '150');
    await page.selectOption('[data-testid="fuel-type-select"]', 'rice_straw');
    await page.selectOption('[data-testid="burn-intensity-select"]', 'moderate');
    
    const burnDate = new Date();
    burnDate.setDate(burnDate.getDate() + 2);
    burnDate.setHours(9, 0, 0, 0);
    await page.fill('[data-testid="burn-date-input"]', burnDate.toISOString().slice(0, 16));
    
    // Submit and track complete workflow
    await page.click('[data-testid="submit-burn-request"]');
    
    // Step 1: Coordinator validation
    await expect(page.locator('[data-testid="coordinator-complete"]')).toBeVisible({ timeout: 10000 });
    const burnId = await page.locator('[data-testid="assigned-burn-id"]').textContent();
    
    // Step 2: Weather analysis
    await expect(page.locator('[data-testid="weather-complete"]')).toBeVisible({ timeout: 10000 });
    
    // Step 3: Smoke prediction
    await expect(page.locator('[data-testid="predictor-complete"]')).toBeVisible({ timeout: 20000 });
    
    // Step 4: Schedule optimization
    await expect(page.locator('[data-testid="optimizer-complete"]')).toBeVisible({ timeout: 30000 });
    
    // Step 5: Alert system
    await expect(page.locator('[data-testid="alerts-complete"]')).toBeVisible({ timeout: 10000 });
    
    // Verify final workflow status
    await expect(page.locator('[data-testid="workflow-success"]')).toBeVisible();
    await expect(page.locator('[data-testid="final-burn-id"]')).toHaveText(burnId);
    
    // Navigate to dashboard to see the request
    await page.click('[data-testid="view-dashboard"]');
    await expect(page).toHaveURL('http://localhost:3000/dashboard');
    
    // Verify burn appears in dashboard
    await expect(page.locator(`[data-burn-id="${burnId}"]`)).toBeVisible();
    
    // Check that all agent data is persisted
    await page.click(`[data-burn-id="${burnId}"]`);
    
    await expect(page.locator('[data-testid="coordinator-data"]')).toBeVisible();
    await expect(page.locator('[data-testid="weather-data"]')).toBeVisible();
    await expect(page.locator('[data-testid="prediction-data"]')).toBeVisible();
    await expect(page.locator('[data-testid="optimization-data"]')).toBeVisible();
    await expect(page.locator('[data-testid="alerts-data"]')).toBeVisible();
  });

  test('should handle system performance under load', async ({ page }) => {
    // Test multiple simultaneous burn requests
    const burnRequests = [
      { farmId: 'farm_load_1', acres: '80', fuelType: 'wheat_stubble' },
      { farmId: 'farm_load_2', acres: '120', fuelType: 'rice_straw' },
      { farmId: 'farm_load_3', acres: '90', fuelType: 'corn_stalks' }
    ];
    
    const processedRequests = [];
    
    for (const request of burnRequests) {
      await page.goto('http://localhost:3000/request');
      
      await page.fill('[data-testid="farm-id-input"]', request.farmId);
      await page.fill('[data-testid="contact-phone-input"]', '+1234567890');
      await page.fill('[data-testid="acres-input"]', request.acres);
      await page.selectOption('[data-testid="fuel-type-select"]', request.fuelType);
      
      const burnDate = new Date();
      burnDate.setDate(burnDate.getDate() + 1);
      burnDate.setHours(9 + processedRequests.length, 0, 0, 0);
      await page.fill('[data-testid="burn-date-input"]', burnDate.toISOString().slice(0, 16));
      
      const startTime = Date.now();
      await page.click('[data-testid="submit-burn-request"]');
      
      // Wait for workflow completion
      await expect(page.locator('[data-testid="workflow-success"]')).toBeVisible({ timeout: 45000 });
      
      const processingTime = Date.now() - startTime;
      const burnId = await page.locator('[data-testid="final-burn-id"]').textContent();
      
      processedRequests.push({
        burnId,
        processingTime,
        farmId: request.farmId
      });
      
      // Verify reasonable processing time
      expect(processingTime).toBeLessThan(45000); // Less than 45 seconds
    }
    
    // Verify all requests were processed successfully
    expect(processedRequests).toHaveLength(3);
    expect(processedRequests.every(req => req.burnId)).toBe(true);
    
    // Check average processing time
    const avgProcessingTime = processedRequests.reduce((sum, req) => sum + req.processingTime, 0) / processedRequests.length;
    expect(avgProcessingTime).toBeLessThan(30000); // Average under 30 seconds
  });

});

test.describe('Dashboard Real-time Updates E2E Tests', () => {
  test('should show real-time burn status updates', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Check if dashboard loads with burn data
    const burnCards = await page.locator('[data-testid="burn-card"]').count();
    expect(burnCards).toBeGreaterThanOrEqual(0);
    
    // Monitor for real-time updates (Socket.io)
    const initialTimestamp = await page.locator('[data-testid="last-update"]').textContent();
    
    // Wait for potential real-time update
    await page.waitForTimeout(5000);
    
    const updatedTimestamp = await page.locator('[data-testid="last-update"]').textContent();
    
    // Timestamp should update if real-time data is flowing
    if (initialTimestamp !== updatedTimestamp) {
      expect(new Date(updatedTimestamp)).toBeInstanceOf(Date);
    }
  });

  test('should display analytics metrics correctly', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Check analytics cards
    await expect(page.locator('[data-testid="total-burns-metric"]')).toBeVisible();
    await expect(page.locator('[data-testid="system-efficiency-metric"]')).toBeVisible();
    await expect(page.locator('[data-testid="air-quality-metric"]')).toBeVisible();
    await expect(page.locator('[data-testid="active-alerts-metric"]')).toBeVisible();
    
    // Verify metric values are reasonable
    const totalBurns = await page.locator('[data-testid="total-burns-value"]').textContent();
    const efficiency = await page.locator('[data-testid="efficiency-value"]').textContent();
    const airQuality = await page.locator('[data-testid="air-quality-value"]').textContent();
    
    expect(parseInt(totalBurns)).toBeGreaterThanOrEqual(0);
    expect(parseFloat(efficiency)).toBeGreaterThanOrEqual(0);
    expect(parseFloat(efficiency)).toBeLessThanOrEqual(100);
    expect(parseFloat(airQuality)).toBeGreaterThanOrEqual(0);
  });

  test('should handle alert acknowledgments in real-time', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Check alerts panel
    const alertsPanel = page.locator('[data-testid="alerts-panel"]');
    await expect(alertsPanel).toBeVisible();
    
    // Count unacknowledged alerts
    const unacknowledgedAlerts = await page.locator('[data-testid="unacknowledged-alert"]').count();
    
    if (unacknowledgedAlerts > 0) {
      // Acknowledge first alert
      await page.click('[data-testid="acknowledge-alert-button"]');
      
      // Verify acknowledgment in real-time
      await expect(page.locator('[data-testid="alert-acknowledged"]')).toBeVisible();
      
      // Check alert count decreased
      const newUnacknowledgedCount = await page.locator('[data-testid="unacknowledged-alert"]').count();
      expect(newUnacknowledgedCount).toBe(unacknowledgedAlerts - 1);
    }
  });
});

test.describe('Map Functionality E2E Tests', () => {
  test('should navigate to map and display burn locations', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForTimeout(6000); // Wait for startup animation
    
    await page.click('button:has-text("View Live Map")');
    await expect(page).toHaveURL('http://localhost:3000/map');
    
    // Wait for map to load
    await expect(page.locator('[data-testid="mapbox-container"]')).toBeVisible({ timeout: 10000 });
    
    // Check if burn markers are displayed
    const burnMarkers = await page.locator('[data-testid="burn-marker"]').count();
    expect(burnMarkers).toBeGreaterThanOrEqual(0);
    
    // Test map controls
    await expect(page.locator('[data-testid="zoom-in"]')).toBeVisible();
    await expect(page.locator('[data-testid="zoom-out"]')).toBeVisible();
    await expect(page.locator('[data-testid="map-layers"]')).toBeVisible();
  });

  test('should display smoke dispersion visualizations', async ({ page }) => {
    await page.goto('http://localhost:3000/map');
    await page.waitForLoadState('networkidle');
    
    // Enable smoke dispersion layer
    await page.click('[data-testid="smoke-layer-toggle"]');
    
    // Check if dispersion circles are visible
    const dispersionLayers = await page.locator('[data-testid="smoke-dispersion-layer"]').count();
    expect(dispersionLayers).toBeGreaterThanOrEqual(0);
    
    // Click on a burn marker to see detailed dispersion
    const firstBurnMarker = page.locator('[data-testid="burn-marker"]').first();
    if (await firstBurnMarker.isVisible()) {
      await firstBurnMarker.click();
      
      // Should show popup with dispersion details
      await expect(page.locator('[data-testid="burn-details-popup"]')).toBeVisible();
      await expect(page.locator('[data-testid="dispersion-radius"]')).toBeVisible();
      await expect(page.locator('[data-testid="pm25-levels"]')).toBeVisible();
    }
  });

  test('should allow field boundary drawing', async ({ page }) => {
    await page.goto('http://localhost:3000/map');
    await page.waitForLoadState('networkidle');
    
    // Enable drawing mode
    await page.click('[data-testid="draw-field-button"]');
    
    // Check drawing tools are available
    await expect(page.locator('[data-testid="drawing-tools"]')).toBeVisible();
    
    // Draw a simple polygon on the map
    const mapCanvas = page.locator('[data-testid="mapbox-canvas"]');
    const mapBox = await mapCanvas.boundingBox();
    
    const centerX = mapBox.x + mapBox.width / 2;
    const centerY = mapBox.y + mapBox.height / 2;
    
    // Draw field boundary
    await page.mouse.click(centerX - 30, centerY - 30);
    await page.mouse.click(centerX + 30, centerY - 30);
    await page.mouse.click(centerX + 30, centerY + 30);
    await page.mouse.click(centerX - 30, centerY + 30);
    await page.mouse.click(centerX - 30, centerY - 30); // Close polygon
    
    // Verify field was drawn
    await expect(page.locator('[data-testid="drawn-field"]')).toBeVisible();
    
    // Save field
    await page.click('[data-testid="save-field"]');
    await expect(page.locator('[data-testid="field-saved-confirmation"]')).toBeVisible();
  });
});

test.describe('Schedule Management E2E Tests', () => {
  test('should display and manage burn schedules', async ({ page }) => {
    await page.goto('http://localhost:3000/schedule');
    await page.waitForLoadState('networkidle');
    
    // Check schedule calendar is visible
    await expect(page.locator('[data-testid="schedule-calendar"]')).toBeVisible();
    
    // Navigate to specific date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().slice(0, 10);
    
    await page.click(`[data-testid="calendar-date-${dateStr}"]`);
    
    // Check scheduled burns for the day
    const scheduledBurns = await page.locator('[data-testid="scheduled-burn"]').count();
    expect(scheduledBurns).toBeGreaterThanOrEqual(0);
    
    // If burns are scheduled, verify details
    if (scheduledBurns > 0) {
      await expect(page.locator('[data-testid="burn-time"]')).toBeVisible();
      await expect(page.locator('[data-testid="farm-name"]')).toBeVisible();
      await expect(page.locator('[data-testid="burn-acres"]')).toBeVisible();
    }
  });

  test('should handle schedule conflicts visualization', async ({ page }) => {
    await page.goto('http://localhost:3000/schedule');
    await page.waitForLoadState('networkidle');
    
    // Check conflict indicators
    const conflictIndicators = await page.locator('[data-testid="conflict-indicator"]').count();
    
    if (conflictIndicators > 0) {
      // Click on first conflict
      await page.click('[data-testid="conflict-indicator"]');
      
      // Should show conflict details
      await expect(page.locator('[data-testid="conflict-details-modal"]')).toBeVisible();
      await expect(page.locator('[data-testid="conflicting-burns"]')).toBeVisible();
      await expect(page.locator('[data-testid="conflict-severity"]')).toBeVisible();
      await expect(page.locator('[data-testid="suggested-resolution"]')).toBeVisible();
      
      // Close modal
      await page.click('[data-testid="close-conflict-modal"]');
    }
  });
});

test.describe('Farm Management E2E Tests', () => {
  test('should display and manage farm information', async ({ page }) => {
    await page.goto('http://localhost:3000/farms');
    await page.waitForLoadState('networkidle');
    
    // Check farms list
    await expect(page.locator('[data-testid="farms-list"]')).toBeVisible();
    
    const farmCards = await page.locator('[data-testid="farm-card"]').count();
    expect(farmCards).toBeGreaterThanOrEqual(0);
    
    // If farms exist, test farm details
    if (farmCards > 0) {
      await page.click('[data-testid="farm-card"]');
      
      // Should show farm details
      await expect(page.locator('[data-testid="farm-details"]')).toBeVisible();
      await expect(page.locator('[data-testid="farm-location"]')).toBeVisible();
      await expect(page.locator('[data-testid="farm-acres"]')).toBeVisible();
      await expect(page.locator('[data-testid="burn-history"]')).toBeVisible();
    }
  });

  test('should handle farm registration workflow', async ({ page }) => {
    await page.goto('http://localhost:3000/farms');
    await page.waitForLoadState('networkidle');
    
    // Click add new farm
    await page.click('[data-testid="add-farm-button"]');
    
    // Fill registration form
    await page.fill('[data-testid="farm-name-input"]', 'E2E Test Farm');
    await page.fill('[data-testid="owner-name-input"]', 'Test Owner');
    await page.fill('[data-testid="contact-phone-input"]', '+1555123456');
    await page.fill('[data-testid="contact-email-input"]', 'test@e2efarm.com');
    await page.fill('[data-testid="total-acres-input"]', '500');
    
    // Set farm location
    await page.fill('[data-testid="latitude-input"]', '37.5');
    await page.fill('[data-testid="longitude-input"]', '-120.5');
    
    // Submit registration
    await page.click('[data-testid="register-farm"]');
    
    // Verify success
    await expect(page.locator('[data-testid="registration-success"]')).toBeVisible();
    
    const farmId = await page.locator('[data-testid="new-farm-id"]').textContent();
    expect(farmId).toMatch(/\d+/);
  });
});