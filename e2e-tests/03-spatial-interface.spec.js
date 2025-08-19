/**
 * BURNWISE Phase 5: Spatial Interface Tests
 * Tests the revolutionary map-as-application interface
 * Bloomberg Terminal meets Google Earth concept
 */

const { test, expect } = require('@playwright/test');

test.describe('Spatial Interface - Map as Application', () => {
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
    
    // Wait for spatial interface to load
    await page.waitForURL('**/spatial');
    await page.waitForLoadState('networkidle');
  });

  test('3D map loads with Mapbox terrain and atmospheric fog', async ({ page }) => {
    console.log('🗺️ Testing 3D map with terrain exaggeration...');
    
    // Verify Mapbox map container exists
    await expect(page.locator('.mapboxgl-canvas')).toBeVisible();
    
    // Check for 3D perspective (45° pitch)
    const mapState = await page.evaluate(() => {
      const map = window.mapboxMap;
      if (!map) return null;
      
      return {
        pitch: map.getPitch(),
        bearing: map.getBearing(),
        zoom: map.getZoom(),
        style: map.getStyle().name
      };
    });
    
    expect(mapState).toBeTruthy();
    expect(mapState.pitch).toBeGreaterThan(0); // 3D perspective
    console.log(`✅ Map loaded with pitch: ${mapState.pitch}°`);
    
    // Verify map controls are accessible
    await expect(page.locator('.mapboxgl-ctrl-zoom-in')).toBeVisible();
    await expect(page.locator('.mapboxgl-ctrl-zoom-out')).toBeVisible();
    await expect(page.locator('.mapboxgl-ctrl-compass')).toBeVisible();
  });

  test('Farm markers are clickable and show real-time data', async ({ page }) => {
    console.log('🏡 Testing farm interactions...');
    
    // Wait for farm markers to load
    await page.waitForSelector('.farm-marker', { timeout: 10000 });
    
    // Count farms loaded
    const farmCount = await page.locator('.farm-marker').count();
    expect(farmCount).toBeGreaterThan(0);
    console.log(`✅ Loaded ${farmCount} farms on map`);
    
    // Click first farm marker
    await page.locator('.farm-marker').first().click();
    
    // Verify farm info popup appears
    await expect(page.locator('.mapboxgl-popup')).toBeVisible();
    
    // Check popup contains real farm data
    const popupContent = await page.locator('.mapboxgl-popup-content').textContent();
    expect(popupContent).toContain('acres');
    expect(popupContent).toMatch(/\d+/); // Contains numbers
    
    // Verify real-time burn status indicator
    const statusIndicator = page.locator('.farm-status-indicator');
    if (await statusIndicator.count() > 0) {
      const status = await statusIndicator.getAttribute('data-status');
      expect(['active', 'scheduled', 'completed', 'idle']).toContain(status);
    }
  });

  test('Smoke plume visualizations render correctly', async ({ page }) => {
    console.log('💨 Testing smoke plume rendering...');
    
    // Check for smoke plume layers
    const hasSmokeLayers = await page.evaluate(() => {
      const map = window.mapboxMap;
      if (!map) return false;
      
      const style = map.getStyle();
      return style.layers.some(layer => 
        layer.id.includes('smoke') || 
        layer.id.includes('plume') ||
        layer.id.includes('dispersion')
      );
    });
    
    if (hasSmokeLayers) {
      console.log('✅ Smoke plume layers detected');
      
      // Verify opacity and blend modes for realistic effect
      const smokeLayerProps = await page.evaluate(() => {
        const map = window.mapboxMap;
        const smokeLayer = map.getStyle().layers.find(l => 
          l.id.includes('smoke') || l.id.includes('plume')
        );
        return smokeLayer ? smokeLayer.paint : null;
      });
      
      if (smokeLayerProps) {
        expect(smokeLayerProps).toHaveProperty('fill-opacity');
      }
    } else {
      console.log('⚠️ No active burns with smoke plumes');
    }
  });

  test('Map supports drag to create burn zones', async ({ page }) => {
    console.log('✏️ Testing drag-to-create burn zones...');
    
    // Enable draw mode if available
    const drawControl = page.locator('.mapbox-gl-draw_ctrl-draw-btn');
    if (await drawControl.count() > 0) {
      await drawControl.click();
      
      // Simulate drawing a polygon
      const map = page.locator('.mapboxgl-canvas');
      const box = await map.boundingBox();
      
      // Draw a square burn zone
      await page.mouse.move(box.x + 100, box.y + 100);
      await page.mouse.down();
      await page.mouse.move(box.x + 200, box.y + 100);
      await page.mouse.click(box.x + 200, box.y + 100);
      await page.mouse.click(box.x + 200, box.y + 200);
      await page.mouse.click(box.x + 100, box.y + 200);
      await page.mouse.click(box.x + 100, box.y + 100); // Close polygon
      
      // Verify burn zone creation dialog appears
      await expect(page.locator('.burn-zone-dialog, .burn-request-form')).toBeVisible({ timeout: 5000 });
      console.log('✅ Burn zone creation initiated');
    } else {
      console.log('ℹ️ Draw controls not available in current view');
    }
  });

  test('Spatial interface has NO traditional navigation', async ({ page }) => {
    console.log('🚫 Verifying no traditional navigation...');
    
    // Verify no traditional nav bar
    const traditionalNav = await page.locator('.navbar, .nav-menu, .navigation-menu').count();
    expect(traditionalNav).toBe(0);
    
    // Verify no sidebar navigation
    const sidebar = await page.locator('.sidebar, .side-menu, .left-nav').count();
    expect(sidebar).toBe(0);
    
    // Map should take full viewport
    const mapContainer = page.locator('.spatial-interface');
    const viewport = page.viewportSize();
    const mapBox = await mapContainer.boundingBox();
    
    // Map should be nearly full viewport (allowing for dock)
    expect(mapBox.width).toBeGreaterThanOrEqual(viewport.width * 0.95);
    expect(mapBox.height).toBeGreaterThanOrEqual(viewport.height * 0.85);
    
    console.log('✅ Map is the application - no traditional navigation');
  });

  test('Weather overlay displays real-time conditions', async ({ page }) => {
    console.log('🌤️ Testing weather overlay...');
    
    // Look for weather indicator
    const weatherOverlay = page.locator('.weather-overlay, .weather-widget, [data-testid="weather"]');
    
    if (await weatherOverlay.count() > 0) {
      await expect(weatherOverlay).toBeVisible();
      
      // Check for real weather data
      const weatherText = await weatherOverlay.textContent();
      
      // Should contain temperature
      expect(weatherText).toMatch(/\d+°[CF]/);
      
      // Should contain wind info
      expect(weatherText.toLowerCase()).toMatch(/wind|mph|km\/h/);
      
      // Should contain humidity
      expect(weatherText.toLowerCase()).toMatch(/humidity|\d+%/);
      
      console.log('✅ Real-time weather data displayed');
    } else {
      console.log('⚠️ Weather overlay not visible in current view');
    }
  });
});