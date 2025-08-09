const { test, expect } = require('@playwright/test');

test.describe('Map Visualization Tests - Mapbox Integration', () => {
  test.beforeEach(async ({ page }) => {
    // Start the frontend application
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
  });

  test('Should load Mapbox map with correct initial center and zoom', async ({ page }) => {
    // Wait for map container to be visible
    await page.waitForSelector('.mapboxgl-map', { timeout: 10000 });
    
    // Verify map is loaded and interactive
    const mapCanvas = page.locator('.mapboxgl-canvas');
    await expect(mapCanvas).toBeVisible();
    
    // Check initial map properties
    const mapCenter = await page.evaluate(() => {
      return window.map ? window.map.getCenter() : null;
    });
    
    expect(mapCenter).toBeTruthy();
    expect(mapCenter.lng).toBeCloseTo(-120.0, 1); // Central California
    expect(mapCenter.lat).toBeCloseTo(40.0, 1);
  });

  test('Should display farm boundaries on map initialization', async ({ page }) => {
    await page.waitForSelector('.mapboxgl-map', { timeout: 10000 });
    
    // Wait for farm data to load
    await page.waitForTimeout(2000);
    
    // Check for farm boundary layers
    const farmLayers = await page.evaluate(() => {
      if (!window.map) return null;
      const style = window.map.getStyle();
      return style.layers.filter(layer => 
        layer.id.includes('farm') || layer.id.includes('boundary')
      ).length;
    });
    
    expect(farmLayers).toBeGreaterThan(0);
  });

  test('Should render burn request polygons with correct styling', async ({ page }) => {
    await page.waitForSelector('.mapboxgl-map', { timeout: 10000 });
    
    // Submit a test burn request first
    await page.click('[data-testid="new-burn-request-btn"]');
    await page.fill('[data-testid="farm-id-input"]', '1');
    await page.fill('[data-testid="area-hectares-input"]', '100');
    await page.selectOption('[data-testid="crop-type-select"]', 'wheat_stubble');
    
    // Draw polygon on map
    await page.click('[data-testid="draw-polygon-btn"]');
    
    // Click multiple points to create polygon
    const mapCanvas = page.locator('.mapboxgl-canvas');
    await mapCanvas.click({ position: { x: 300, y: 200 } });
    await mapCanvas.click({ position: { x: 400, y: 200 } });
    await mapCanvas.click({ position: { x: 400, y: 300 } });
    await mapCanvas.click({ position: { x: 300, y: 300 } });
    await mapCanvas.dblclick({ position: { x: 300, y: 200 } }); // Close polygon
    
    await page.click('[data-testid="submit-burn-request-btn"]');
    
    // Wait for polygon to render
    await page.waitForTimeout(1000);
    
    // Verify burn request polygon is visible
    const burnPolygons = await page.evaluate(() => {
      if (!window.map) return null;
      const style = window.map.getStyle();
      return style.layers.filter(layer => 
        layer.id.includes('burn') && layer.type === 'fill'
      ).length;
    });
    
    expect(burnPolygons).toBeGreaterThan(0);
  });

  test('Should display real-time smoke plume visualizations', async ({ page }) => {
    await page.waitForSelector('.mapboxgl-map', { timeout: 10000 });
    
    // Trigger smoke plume calculation
    await page.click('[data-testid="analyze-smoke-btn"]');
    await page.waitForTimeout(3000); // Wait for analysis
    
    // Check for smoke plume layers
    const smokeLayers = await page.evaluate(() => {
      if (!window.map) return null;
      const style = window.map.getStyle();
      return style.layers.filter(layer => 
        layer.id.includes('smoke') || layer.id.includes('plume')
      );
    });
    
    expect(smokeLayers.length).toBeGreaterThan(0);
    
    // Verify smoke plumes have correct opacity gradients
    const hasGradient = await page.evaluate(() => {
      if (!window.map) return false;
      const smokeLayer = window.map.getLayer('smoke-plume-fill');
      return smokeLayer && smokeLayer.paint && 
             smokeLayer.paint['fill-opacity'] && 
             Array.isArray(smokeLayer.paint['fill-opacity']);
    });
    
    expect(hasGradient).toBeTruthy();
  });

  test('Should highlight conflict zones with red coloring', async ({ page }) => {
    await page.waitForSelector('.mapboxgl-map', { timeout: 10000 });
    
    // Create multiple overlapping burn requests to generate conflicts
    for (let i = 0; i < 2; i++) {
      await page.click('[data-testid="new-burn-request-btn"]');
      await page.fill('[data-testid="farm-id-input"]', `${i + 1}`);
      await page.fill('[data-testid="area-hectares-input"]', '150');
      await page.selectOption('[data-testid="crop-type-select"]', 'wheat_stubble');
      
      await page.click('[data-testid="draw-polygon-btn"]');
      
      // Draw overlapping polygons
      const mapCanvas = page.locator('.mapboxgl-canvas');
      const offsetX = i * 20; // Slight offset to create overlap
      await mapCanvas.click({ position: { x: 300 + offsetX, y: 200 } });
      await mapCanvas.click({ position: { x: 450 + offsetX, y: 200 } });
      await mapCanvas.click({ position: { x: 450 + offsetX, y: 350 } });
      await mapCanvas.click({ position: { x: 300 + offsetX, y: 350 } });
      await mapCanvas.dblclick({ position: { x: 300 + offsetX, y: 200 } });
      
      await page.click('[data-testid="submit-burn-request-btn"]');
      await page.waitForTimeout(500);
    }
    
    // Trigger conflict detection
    await page.click('[data-testid="detect-conflicts-btn"]');
    await page.waitForTimeout(2000);
    
    // Check for conflict zone styling
    const conflictZones = await page.evaluate(() => {
      if (!window.map) return null;
      const conflictLayer = window.map.getLayer('conflict-zones');
      return conflictLayer && conflictLayer.paint && 
             conflictLayer.paint['fill-color'] === '#ff0000';
    });
    
    expect(conflictZones).toBeTruthy();
  });

  test('Should show PM2.5 concentration heat map overlay', async ({ page }) => {
    await page.waitForSelector('.mapboxgl-map', { timeout: 10000 });
    
    // Enable PM2.5 overlay
    await page.click('[data-testid="pm25-overlay-toggle"]');
    await page.waitForTimeout(2000);
    
    // Verify heat map layer exists
    const heatMapLayer = await page.evaluate(() => {
      if (!window.map) return null;
      return window.map.getLayer('pm25-heatmap');
    });
    
    expect(heatMapLayer).toBeTruthy();
    expect(heatMapLayer.type).toBe('heatmap');
    
    // Check heat map has correct color ramp
    const hasColorRamp = await page.evaluate(() => {
      const layer = window.map.getLayer('pm25-heatmap');
      return layer && layer.paint && 
             layer.paint['heatmap-color'] && 
             Array.isArray(layer.paint['heatmap-color']);
    });
    
    expect(hasColorRamp).toBeTruthy();
  });

  test('Should display weather vector arrows showing wind patterns', async ({ page }) => {
    await page.waitForSelector('.mapboxgl-map', { timeout: 10000 });
    
    // Enable wind pattern display
    await page.click('[data-testid="wind-arrows-toggle"]');
    await page.waitForTimeout(1500);
    
    // Check for wind arrow symbols
    const windArrows = await page.evaluate(() => {
      if (!window.map) return null;
      const windLayer = window.map.getLayer('wind-arrows');
      return windLayer && windLayer.type === 'symbol';
    });
    
    expect(windArrows).toBeTruthy();
    
    // Verify arrows rotate based on wind direction
    const hasRotation = await page.evaluate(() => {
      const layer = window.map.getLayer('wind-arrows');
      return layer && layer.layout && 
             layer.layout['icon-rotate'] !== undefined;
    });
    
    expect(hasRotation).toBeTruthy();
  });

  test('Should handle map click events for field selection', async ({ page }) => {
    await page.waitForSelector('.mapboxgl-map', { timeout: 10000 });
    
    // Click on map to select a field
    const mapCanvas = page.locator('.mapboxgl-canvas');
    await mapCanvas.click({ position: { x: 400, y: 250 } });
    
    // Check if field selection popup appears
    await page.waitForSelector('[data-testid="field-info-popup"]', { timeout: 3000 });
    
    const popup = page.locator('[data-testid="field-info-popup"]');
    await expect(popup).toBeVisible();
    
    // Verify popup contains field information
    const fieldId = await popup.locator('[data-testid="field-id"]').textContent();
    expect(fieldId).toBeTruthy();
  });

  test('Should zoom to selected burn request on list item click', async ({ page }) => {
    await page.waitForSelector('.mapboxgl-map', { timeout: 10000 });
    
    // Wait for burn requests list to load
    await page.waitForSelector('[data-testid="burn-requests-list"]');
    
    // Click on first burn request in list
    const firstRequest = page.locator('[data-testid="burn-request-item"]').first();
    await firstRequest.click();
    
    // Verify map zoomed to request location
    await page.waitForTimeout(1000); // Wait for zoom animation
    
    const mapZoom = await page.evaluate(() => {
      return window.map ? window.map.getZoom() : null;
    });
    
    expect(mapZoom).toBeGreaterThan(10); // Should be zoomed in
  });

  test('Should display spatial index grid for performance visualization', async ({ page }) => {
    await page.waitForSelector('.mapboxgl-map', { timeout: 10000 });
    
    // Enable spatial index visualization
    await page.click('[data-testid="spatial-index-toggle"]');
    await page.waitForTimeout(1000);
    
    // Check for grid layer
    const gridLayer = await page.evaluate(() => {
      if (!window.map) return null;
      return window.map.getLayer('spatial-grid');
    });
    
    expect(gridLayer).toBeTruthy();
    expect(gridLayer.type).toBe('line');
    
    // Verify grid has appropriate styling
    const gridColor = await page.evaluate(() => {
      const layer = window.map.getLayer('spatial-grid');
      return layer && layer.paint && layer.paint['line-color'];
    });
    
    expect(gridColor).toBeTruthy();
  });

  test('Should handle 3D terrain visualization for elevation data', async ({ page }) => {
    await page.waitForSelector('.mapboxgl-map', { timeout: 10000 });
    
    // Enable 3D terrain
    await page.click('[data-testid="3d-terrain-toggle"]');
    await page.waitForTimeout(2000);
    
    // Check if terrain source is loaded
    const hasTerrain = await page.evaluate(() => {
      if (!window.map) return false;
      const terrain = window.map.getTerrain();
      return terrain !== null;
    });
    
    expect(hasTerrain).toBeTruthy();
    
    // Verify map pitch is adjusted for 3D view
    const mapPitch = await page.evaluate(() => {
      return window.map ? window.map.getPitch() : 0;
    });
    
    expect(mapPitch).toBeGreaterThan(0);
  });

  test('Should update map layers when schedule changes', async ({ page }) => {
    await page.waitForSelector('.mapboxgl-map', { timeout: 10000 });
    
    // Trigger schedule optimization
    await page.click('[data-testid="optimize-schedule-btn"]');
    await page.waitForTimeout(3000);
    
    // Check that scheduled burns have different styling
    const scheduledBurns = await page.evaluate(() => {
      if (!window.map) return null;
      const scheduledLayer = window.map.getLayer('scheduled-burns');
      return scheduledLayer && scheduledLayer.paint;
    });
    
    expect(scheduledBurns).toBeTruthy();
    
    // Verify scheduled burns have time-based color coding
    const hasTimeColors = await page.evaluate(() => {
      const layer = window.map.getLayer('scheduled-burns');
      return layer && layer.paint && 
             layer.paint['fill-color'] && 
             Array.isArray(layer.paint['fill-color']);
    });
    
    expect(hasTimeColors).toBeTruthy();
  });

  test('Should render vector field visualization for wind patterns', async ({ page }) => {
    await page.waitForSelector('.mapboxgl-map', { timeout: 10000 });
    
    // Enable advanced wind visualization
    await page.click('[data-testid="vector-field-toggle"]');
    await page.waitForTimeout(2000);
    
    // Check for vector field layer
    const vectorField = await page.evaluate(() => {
      if (!window.map) return null;
      return window.map.getLayer('wind-vector-field');
    });
    
    expect(vectorField).toBeTruthy();
    
    // Verify vector field updates with weather data
    const hasDataExpression = await page.evaluate(() => {
      const layer = window.map.getLayer('wind-vector-field');
      return layer && layer.paint && 
             typeof layer.paint['line-width'] === 'object';
    });
    
    expect(hasDataExpression).toBeTruthy();
  });

  test('Should handle map performance with large numbers of burn requests', async ({ page }) => {
    await page.waitForSelector('.mapboxgl-map', { timeout: 10000 });
    
    // Load performance test data
    await page.click('[data-testid="load-test-data-btn"]');
    await page.waitForTimeout(5000); // Wait for large dataset to load
    
    // Verify map is still responsive
    const mapCanvas = page.locator('.mapboxgl-canvas');
    await mapCanvas.click({ position: { x: 300, y: 200 } });
    
    // Check that clustering is active for performance
    const hasClustering = await page.evaluate(() => {
      if (!window.map) return false;
      const source = window.map.getSource('burn-requests');
      return source && source.cluster === true;
    });
    
    expect(hasClustering).toBeTruthy();
    
    // Verify frame rate is acceptable
    const frameRate = await page.evaluate(() => {
      return new Promise((resolve) => {
        let frames = 0;
        const start = performance.now();
        
        function countFrames() {
          frames++;
          if (performance.now() - start < 1000) {
            requestAnimationFrame(countFrames);
          } else {
            resolve(frames);
          }
        }
        
        requestAnimationFrame(countFrames);
      });
    });
    
    expect(frameRate).toBeGreaterThan(30); // Should maintain 30+ FPS
  });

  test('Should synchronize map view with dashboard analytics', async ({ page }) => {
    await page.waitForSelector('.mapboxgl-map', { timeout: 10000 });
    
    // Open analytics dashboard
    await page.click('[data-testid="analytics-panel-toggle"]');
    
    // Select a specific metric in dashboard
    await page.click('[data-testid="pm25-hotspots-metric"]');
    
    // Verify map updates to highlight corresponding areas
    await page.waitForTimeout(1000);
    
    const highlightLayer = await page.evaluate(() => {
      if (!window.map) return null;
      return window.map.getLayer('pm25-highlights');
    });
    
    expect(highlightLayer).toBeTruthy();
    
    // Check that dashboard and map show consistent data
    const mapData = await page.evaluate(() => {
      const source = window.map.getSource('pm25-highlights');
      return source ? source._data : null;
    });
    
    expect(mapData).toBeTruthy();
    expect(mapData.features.length).toBeGreaterThan(0);
  });
});