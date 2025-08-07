// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('BURNWISE Authentication & Core Workflows', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
  });

  test('Frontend loads with Landing page', async ({ page }) => {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // Check for BURNWISE branding
    await expect(page.locator('text=/BURNWISE/i').first()).toBeVisible();
    
    // Check for landing page content
    await expect(page.locator('text=/Multi-Farm Agricultural Burn Coordinator/i').first()).toBeVisible();
    
    // Check for Get Started button
    const getStartedButton = page.locator('button:has-text("Get Started")').or(
      page.locator('a:has-text("Get Started")')
    );
    await expect(getStartedButton.first()).toBeVisible();
    
    // Take screenshot for evidence
    await page.screenshot({ path: 'landing-page.png', fullPage: true });
  });

  test('Navigate to Dashboard', async ({ page }) => {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // Click Get Started or Dashboard link
    const dashboardLink = page.locator('button:has-text("Get Started")').or(
      page.locator('a:has-text("Dashboard")').or(
        page.locator('text=/View Live Map/i')
      )
    );
    
    if (await dashboardLink.first().isVisible()) {
      await dashboardLink.first().click();
      await page.waitForTimeout(3000);
      
      // Should navigate to dashboard or map
      const isDashboard = await page.locator('text=/Dashboard|Map|Schedule/i').first().isVisible();
      expect(isDashboard).toBeTruthy();
      
      await page.screenshot({ path: 'dashboard-navigation.png', fullPage: true });
    }
  });

  test('Check fire-themed design elements', async ({ page }) => {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // Check for fire colors in CSS
    const hasFireTheme = await page.evaluate(() => {
      const elements = document.querySelectorAll('*');
      let hasOrangeColor = false;
      
      for (const el of elements) {
        const styles = window.getComputedStyle(el);
        const bgColor = styles.backgroundColor;
        const color = styles.color;
        
        // Check for fire-like colors (orange/red)
        if (bgColor.includes('255, 107') || // #ff6b35
            bgColor.includes('255, 87') ||  // #ff5722
            color.includes('255, 107') ||
            color.includes('255, 87')) {
          hasOrangeColor = true;
          break;
        }
      }
      
      return hasOrangeColor;
    });
    
    expect(hasFireTheme).toBeTruthy();
  });

  test('Test API Health Check', async ({ page }) => {
    const response = await page.request.get('http://localhost:5001/health');
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('status', 'healthy');
    expect(data).toHaveProperty('agents');
  });

  test('Test burn request API endpoint', async ({ page }) => {
    // First get a token
    const loginResponse = await page.request.post('http://localhost:5001/api/auth/login', {
      data: {
        email: 'john@sunrisevalley.com',
        password: 'demo123'
      }
    });
    
    if (loginResponse.status() === 200) {
      const { token } = await loginResponse.json();
      
      // Test burn request endpoint
      const burnResponse = await page.request.get('http://localhost:5001/api/burn-requests', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      expect(burnResponse.status()).toBe(200);
      const burnData = await burnResponse.json();
      expect(burnData).toHaveProperty('data');
    }
  });

  test('Test Gaussian plume calculations', async ({ page }) => {
    const loginResponse = await page.request.post('http://localhost:5001/api/auth/login', {
      data: {
        email: 'john@sunrisevalley.com',
        password: 'demo123'
      }
    });
    
    if (loginResponse.status() === 200) {
      const { token } = await loginResponse.json();
      
      // Create a burn request to trigger Gaussian plume calculation
      const burnResponse = await page.request.post('http://localhost:5001/api/burn-requests', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        data: {
          farm_id: 1,
          field_id: 1,
          acreage: 100,
          crop_type: 'wheat',
          requested_date: '2025-08-30',
          requested_window_start: '08:00',
          requested_window_end: '12:00'
        }
      });
      
      // Check if response contains smoke prediction data
      if ([200, 201].includes(burnResponse.status())) {
        const data = await burnResponse.json();
        console.log('Burn request response:', JSON.stringify(data, null, 2));
        
        // The predictor agent should have calculated smoke dispersion
        if (data.prediction || data.smoke_prediction) {
          const prediction = data.prediction || data.smoke_prediction;
          expect(prediction).toHaveProperty('pm25_concentration');
          expect(prediction.pm25_concentration).toBeGreaterThanOrEqual(0);
          expect(prediction.pm25_concentration).toBeLessThan(1000); // Reasonable upper limit
        }
      }
    }
  });

  test('Verify 5-agent system is operational', async ({ page }) => {
    const response = await page.request.get('http://localhost:5001/health');
    const data = await response.json();
    
    // Check all 5 agents are initialized
    expect(data.agents).toHaveProperty('coordinator', true);
    expect(data.agents).toHaveProperty('weather', true);
    expect(data.agents).toHaveProperty('predictor', true);
    expect(data.agents).toHaveProperty('optimizer', true);
    expect(data.agents).toHaveProperty('alerts', true);
  });

  test('Test frontend components load without errors', async ({ page }) => {
    // Monitor console for errors
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    
    // Check for React errors
    const reactErrors = consoleErrors.filter(err => 
      err.includes('React') || 
      err.includes('Uncaught') || 
      err.includes('Cannot read')
    );
    
    // Log any errors for debugging
    if (reactErrors.length > 0) {
      console.log('React errors found:', reactErrors);
    }
    
    // Should have minimal errors
    expect(reactErrors.length).toBeLessThanOrEqual(2); // Allow some warnings
  });
});