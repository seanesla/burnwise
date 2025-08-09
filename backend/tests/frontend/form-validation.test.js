const { test, expect } = require('@playwright/test');

test.describe('Form Validation Tests - Burn Request Form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    
    // Open new burn request form
    await page.click('[data-testid="new-burn-request-btn"]');
    await page.waitForSelector('[data-testid="burn-request-form"]');
  });

  test('Should validate required farm ID field', async ({ page }) => {
    // Leave farm ID empty and submit
    await page.fill('[data-testid="area-hectares-input"]', '100');
    await page.selectOption('[data-testid="crop-type-select"]', 'wheat_stubble');
    await page.click('[data-testid="submit-burn-request-btn"]');
    
    // Check for validation error
    const errorMessage = page.locator('[data-testid="farm-id-error"]');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText('Farm ID is required');
    
    // Verify form doesn't submit
    const formStillVisible = page.locator('[data-testid="burn-request-form"]');
    await expect(formStillVisible).toBeVisible();
  });

  test('Should validate farm ID exists in database', async ({ page }) => {
    // Enter non-existent farm ID
    await page.fill('[data-testid="farm-id-input"]', '99999');
    await page.blur('[data-testid="farm-id-input"]'); // Trigger validation
    
    await page.waitForTimeout(1000); // Wait for async validation
    
    const errorMessage = page.locator('[data-testid="farm-id-error"]');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText('Farm ID does not exist');
  });

  test('Should validate area hectares numeric constraints', async ({ page }) => {
    await page.fill('[data-testid="farm-id-input"]', '1');
    
    // Test negative area
    await page.fill('[data-testid="area-hectares-input"]', '-50');
    await page.blur('[data-testid="area-hectares-input"]');
    
    let errorMessage = page.locator('[data-testid="area-hectares-error"]');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText('Area must be positive');
    
    // Test zero area
    await page.fill('[data-testid="area-hectares-input"]', '0');
    await page.blur('[data-testid="area-hectares-input"]');
    
    await expect(errorMessage).toContainText('Area must be greater than 0');
    
    // Test excessive area (over 10,000 hectares)
    await page.fill('[data-testid="area-hectares-input"]', '15000');
    await page.blur('[data-testid="area-hectares-input"]');
    
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText('Area exceeds maximum allowed');
  });

  test('Should validate decimal precision for area input', async ({ page }) => {
    await page.fill('[data-testid="farm-id-input"]', '1');
    
    // Test more than 2 decimal places
    await page.fill('[data-testid="area-hectares-input"]', '100.123456');
    await page.blur('[data-testid="area-hectares-input"]');
    
    // Should round to 2 decimal places
    const roundedValue = await page.inputValue('[data-testid="area-hectares-input"]');
    expect(roundedValue).toBe('100.12');
  });

  test('Should validate crop type selection is required', async ({ page }) => {
    await page.fill('[data-testid="farm-id-input"]', '1');
    await page.fill('[data-testid="area-hectares-input"]', '100');
    
    // Submit without selecting crop type
    await page.click('[data-testid="submit-burn-request-btn"]');
    
    const errorMessage = page.locator('[data-testid="crop-type-error"]');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText('Crop type is required');
  });

  test('Should validate crop type affects fuel load calculations', async ({ page }) => {
    await page.fill('[data-testid="farm-id-input"]', '1');
    await page.fill('[data-testid="area-hectares-input"]', '100');
    
    // Select wheat stubble (high fuel load)
    await page.selectOption('[data-testid="crop-type-select"]', 'wheat_stubble');
    
    const fuelLoadDisplay = page.locator('[data-testid="calculated-fuel-load"]');
    await expect(fuelLoadDisplay).toBeVisible();
    
    const wheatFuelLoad = await fuelLoadDisplay.textContent();
    
    // Change to grass hay (lower fuel load)
    await page.selectOption('[data-testid="crop-type-select"]', 'grass_hay');
    
    const grassFuelLoad = await fuelLoadDisplay.textContent();
    expect(grassFuelLoad).not.toBe(wheatFuelLoad);
  });

  test('Should validate requested date constraints', async ({ page }) => {
    await page.fill('[data-testid="farm-id-input"]', '1');
    await page.fill('[data-testid="area-hectares-input"]', '100');
    await page.selectOption('[data-testid="crop-type-select"]', 'wheat_stubble');
    
    // Test past date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const pastDate = yesterday.toISOString().split('T')[0];
    
    await page.fill('[data-testid="requested-date-input"]', pastDate);
    await page.blur('[data-testid="requested-date-input"]');
    
    const errorMessage = page.locator('[data-testid="requested-date-error"]');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText('Date cannot be in the past');
    
    // Test date too far in future (over 90 days)
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 100);
    const farFutureDate = futureDate.toISOString().split('T')[0];
    
    await page.fill('[data-testid="requested-date-input"]', farFutureDate);
    await page.blur('[data-testid="requested-date-input"]');
    
    await expect(errorMessage).toContainText('Date cannot be more than 90 days in future');
  });

  test('Should validate polygon drawing completeness', async ({ page }) => {
    await page.fill('[data-testid="farm-id-input"]', '1');
    await page.fill('[data-testid="area-hectares-input"]', '100');
    await page.selectOption('[data-testid="crop-type-select"]', 'wheat_stubble');
    
    // Start polygon drawing but don't complete it
    await page.click('[data-testid="draw-polygon-btn"]');
    
    const mapCanvas = page.locator('.mapboxgl-canvas');
    await mapCanvas.click({ position: { x: 300, y: 200 } });
    await mapCanvas.click({ position: { x: 400, y: 200 } });
    // Don't complete the polygon
    
    // Try to submit without completing polygon
    await page.click('[data-testid="submit-burn-request-btn"]');
    
    const errorMessage = page.locator('[data-testid="polygon-error"]');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText('Field polygon must be completed');
  });

  test('Should validate polygon area matches input area within tolerance', async ({ page }) => {
    await page.fill('[data-testid="farm-id-input"]', '1');
    await page.fill('[data-testid="area-hectares-input"]', '100');
    await page.selectOption('[data-testid="crop-type-select"]', 'wheat_stubble');
    
    // Draw a very small polygon that doesn't match the 100 hectare input
    await page.click('[data-testid="draw-polygon-btn"]');
    
    const mapCanvas = page.locator('.mapboxgl-canvas');
    await mapCanvas.click({ position: { x: 300, y: 200 } });
    await mapCanvas.click({ position: { x: 310, y: 200 } }); // Very small polygon
    await mapCanvas.click({ position: { x: 310, y: 210 } });
    await mapCanvas.click({ position: { x: 300, y: 210 } });
    await mapCanvas.dblclick({ position: { x: 300, y: 200 } });
    
    await page.waitForTimeout(1000); // Wait for area calculation
    
    // Try to submit
    await page.click('[data-testid="submit-burn-request-btn"]');
    
    const errorMessage = page.locator('[data-testid="area-mismatch-error"]');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText('Drawn area does not match specified area');
  });

  test('Should validate emergency priority requires justification', async ({ page }) => {
    await page.fill('[data-testid="farm-id-input"]', '1');
    await page.fill('[data-testid="area-hectares-input"]', '100');
    await page.selectOption('[data-testid="crop-type-select"]', 'wheat_stubble');
    
    // Select emergency priority
    await page.selectOption('[data-testid="priority-select"]', 'emergency');
    
    // Try to submit without justification
    await page.click('[data-testid="submit-burn-request-btn"]');
    
    const errorMessage = page.locator('[data-testid="emergency-justification-error"]');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText('Emergency burns require justification');
    
    // Fill justification and verify error disappears
    await page.fill('[data-testid="emergency-justification-textarea"]', 'Fire danger risk due to dry conditions');
    await page.blur('[data-testid="emergency-justification-textarea"]');
    
    await expect(errorMessage).not.toBeVisible();
  });

  test('Should validate contact information format', async ({ page }) => {
    await page.fill('[data-testid="farm-id-input"]', '1');
    
    // Test invalid email format
    await page.fill('[data-testid="contact-email-input"]', 'invalid-email');
    await page.blur('[data-testid="contact-email-input"]');
    
    let errorMessage = page.locator('[data-testid="contact-email-error"]');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText('Invalid email format');
    
    // Test invalid phone format
    await page.fill('[data-testid="contact-phone-input"]', '123');
    await page.blur('[data-testid="contact-phone-input"]');
    
    errorMessage = page.locator('[data-testid="contact-phone-error"]');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText('Invalid phone number format');
    
    // Test valid formats
    await page.fill('[data-testid="contact-email-input"]', 'farmer@example.com');
    await page.fill('[data-testid="contact-phone-input"]', '(555) 123-4567');
    
    // Errors should disappear
    await expect(page.locator('[data-testid="contact-email-error"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="contact-phone-error"]')).not.toBeVisible();
  });

  test('Should validate weather safety warnings before submission', async ({ page }) => {
    await page.fill('[data-testid="farm-id-input"]', '1');
    await page.fill('[data-testid="area-hectares-input"]', '100');
    await page.selectOption('[data-testid="crop-type-select"]', 'wheat_stubble');
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = tomorrow.toISOString().split('T')[0];
    await page.fill('[data-testid="requested-date-input"]', tomorrowDate);
    
    // Trigger weather analysis
    await page.click('[data-testid="check-weather-btn"]');
    await page.waitForTimeout(3000); // Wait for weather analysis
    
    // If weather conditions are unsafe, should show warning
    const weatherWarning = page.locator('[data-testid="weather-warning"]');
    const hasWarning = await weatherWarning.isVisible();
    
    if (hasWarning) {
      // Should require acknowledgment to proceed
      await page.click('[data-testid="submit-burn-request-btn"]');
      
      const ackError = page.locator('[data-testid="weather-acknowledgment-error"]');
      await expect(ackError).toBeVisible();
      await expect(ackError).toContainText('Must acknowledge weather risks');
      
      // Check acknowledgment and verify error disappears
      await page.check('[data-testid="weather-risk-acknowledgment"]');
      await expect(ackError).not.toBeVisible();
    }
  });

  test('Should validate PM2.5 safety thresholds', async ({ page }) => {
    await page.fill('[data-testid="farm-id-input"]', '1');
    await page.fill('[data-testid="area-hectares-input"]', '500'); // Large burn
    await page.selectOption('[data-testid="crop-type-select"]', 'wheat_stubble');
    
    // Trigger PM2.5 analysis
    await page.click('[data-testid="analyze-pm25-btn"]');
    await page.waitForTimeout(2000);
    
    // Check if PM2.5 levels exceed safety thresholds
    const pm25Warning = page.locator('[data-testid="pm25-warning"]');
    const pm25Level = await page.textContent('[data-testid="predicted-pm25-level"]');
    
    if (parseFloat(pm25Level) > 35) { // Unhealthy threshold
      await expect(pm25Warning).toBeVisible();
      await expect(pm25Warning).toContainText('PM2.5 levels may exceed safe limits');
      
      // Should require safety acknowledgment
      await page.click('[data-testid="submit-burn-request-btn"]');
      
      const safetyError = page.locator('[data-testid="pm25-safety-error"]');
      await expect(safetyError).toBeVisible();
    }
  });

  test('Should validate simultaneous form field interactions', async ({ page }) => {
    // Fill farm ID and trigger field lookup
    await page.fill('[data-testid="farm-id-input"]', '1');
    await page.blur('[data-testid="farm-id-input"]');
    
    // Should auto-populate farm details
    await page.waitForTimeout(1000);
    const farmName = await page.textContent('[data-testid="farm-name-display"]');
    expect(farmName).toBeTruthy();
    
    // Change area and verify fuel load updates
    await page.fill('[data-testid="area-hectares-input"]', '200');
    await page.selectOption('[data-testid="crop-type-select"]', 'corn_residue');
    
    await page.waitForTimeout(500); // Wait for calculations
    
    // Verify dependent field updates
    const fuelLoad = await page.textContent('[data-testid="calculated-fuel-load"]');
    const estimatedDuration = await page.textContent('[data-testid="estimated-duration"]');
    
    expect(parseFloat(fuelLoad)).toBeGreaterThan(0);
    expect(estimatedDuration).toContain('hours');
  });

  test('Should handle form auto-save and recovery', async ({ page }) => {
    // Fill partial form data
    await page.fill('[data-testid="farm-id-input"]', '1');
    await page.fill('[data-testid="area-hectares-input"]', '150');
    await page.selectOption('[data-testid="crop-type-select"]', 'wheat_stubble');
    
    // Simulate page refresh
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Open form again
    await page.click('[data-testid="new-burn-request-btn"]');
    
    // Check if form data is recovered
    const recoveredFarmId = await page.inputValue('[data-testid="farm-id-input"]');
    const recoveredArea = await page.inputValue('[data-testid="area-hectares-input"]');
    const recoveredCropType = await page.inputValue('[data-testid="crop-type-select"]');
    
    expect(recoveredFarmId).toBe('1');
    expect(recoveredArea).toBe('150');
    expect(recoveredCropType).toBe('wheat_stubble');
  });

  test('Should validate complete form submission workflow', async ({ page }) => {
    // Fill complete valid form
    await page.fill('[data-testid="farm-id-input"]', '1');
    await page.fill('[data-testid="area-hectares-input"]', '100');
    await page.selectOption('[data-testid="crop-type-select"]', 'wheat_stubble');
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const validDate = tomorrow.toISOString().split('T')[0];
    await page.fill('[data-testid="requested-date-input"]', validDate);
    
    await page.fill('[data-testid="contact-email-input"]', 'farmer@example.com');
    await page.fill('[data-testid="contact-phone-input"]', '(555) 123-4567');
    
    // Draw valid polygon
    await page.click('[data-testid="draw-polygon-btn"]');
    const mapCanvas = page.locator('.mapboxgl-canvas');
    await mapCanvas.click({ position: { x: 300, y: 200 } });
    await mapCanvas.click({ position: { x: 400, y: 200 } });
    await mapCanvas.click({ position: { x: 400, y: 300 } });
    await mapCanvas.click({ position: { x: 300, y: 300 } });
    await mapCanvas.dblclick({ position: { x: 300, y: 200 } });
    
    // Submit form
    await page.click('[data-testid="submit-burn-request-btn"]');
    
    // Should show success message
    await page.waitForSelector('[data-testid="submission-success"]', { timeout: 5000 });
    const successMessage = page.locator('[data-testid="submission-success"]');
    await expect(successMessage).toBeVisible();
    await expect(successMessage).toContainText('Burn request submitted successfully');
    
    // Form should be cleared/closed
    const form = page.locator('[data-testid="burn-request-form"]');
    await expect(form).not.toBeVisible();
  });
});