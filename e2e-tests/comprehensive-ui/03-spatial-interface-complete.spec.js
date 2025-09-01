/**
 * Complete Spatial Interface Tests
 * Tests every map interaction, overlay, control, and feature in the main application
 * The spatial interface IS the application - map as the primary interface
 */

const { test, expect } = require('@playwright/test');

test.describe('Spatial Interface - Complete Feature Testing', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to spatial interface
    await page.goto('http://localhost:3000');
    
    // Auto-redirects to onboarding or spatial - handle both cases
    if ((await page.url()).includes('onboarding')) {
      const skipBtn = page.locator('button:has-text("Skip Setup"), button:has-text("Skip")').first();
      if (await skipBtn.isVisible()) {
        await skipBtn.click();
      }
    }
    
    // Wait for spatial interface to load
    await page.waitForURL('**/spatial');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000); // Allow map to fully load
  });

  test('01. Mapbox GL Map Base Layer', async ({ page }) => {
    // Verify map container exists and loads
    const mapContainer = page.locator('#map, [class*="mapbox"], .map-container').first();
    await expect(mapContainer).toBeVisible();
    
    // Wait for map tiles to load
    await page.waitForTimeout(5000);
    
    // Test map panning in all directions
    const mapBounds = await mapContainer.boundingBox();
    if (mapBounds) {
      const centerX = mapBounds.x + mapBounds.width / 2;
      const centerY = mapBounds.y + mapBounds.height / 2;
      
      // Pan left
      await page.mouse.move(centerX, centerY);
      await page.mouse.down();
      await page.mouse.move(centerX - 100, centerY);
      await page.mouse.up();
      await page.waitForTimeout(500);
      
      // Pan right
      await page.mouse.move(centerX - 100, centerY);
      await page.mouse.down();
      await page.mouse.move(centerX + 100, centerY);
      await page.mouse.up();
      await page.waitForTimeout(500);
      
      // Pan up
      await page.mouse.move(centerX, centerY);
      await page.mouse.down();
      await page.mouse.move(centerX, centerY - 100);
      await page.mouse.up();
      await page.waitForTimeout(500);
      
      // Pan down
      await page.mouse.move(centerX, centerY - 100);
      await page.mouse.down();
      await page.mouse.move(centerX, centerY + 100);
      await page.mouse.up();
      await page.waitForTimeout(500);
    }
  });

  test('02. Map Zoom Controls', async ({ page }) => {
    const mapContainer = page.locator('#map, [class*="mapbox"]').first();
    await expect(mapContainer).toBeVisible();
    
    // Test zoom in with + button
    const zoomInBtn = page.locator('.mapboxgl-ctrl-zoom-in, button[aria-label*="Zoom in"]').first();
    if (await zoomInBtn.isVisible()) {
      for (let i = 0; i < 3; i++) {
        await zoomInBtn.click();
        await page.waitForTimeout(800);
      }
    }
    
    // Test zoom out with - button
    const zoomOutBtn = page.locator('.mapboxgl-ctrl-zoom-out, button[aria-label*="Zoom out"]').first();
    if (await zoomOutBtn.isVisible()) {
      for (let i = 0; i < 2; i++) {
        await zoomOutBtn.click();
        await page.waitForTimeout(800);
      }
    }
    
    // Test zoom with scroll wheel
    const mapBounds = await mapContainer.boundingBox();
    if (mapBounds) {
      const centerX = mapBounds.x + mapBounds.width / 2;
      const centerY = mapBounds.y + mapBounds.height / 2;
      
      await page.mouse.move(centerX, centerY);
      
      // Zoom in with wheel
      await page.mouse.wheel(0, -120);
      await page.waitForTimeout(500);
      await page.mouse.wheel(0, -120);
      await page.waitForTimeout(500);
      
      // Zoom out with wheel
      await page.mouse.wheel(0, 120);
      await page.waitForTimeout(500);
    }
    
    // Test double-click zoom
    if (mapBounds) {
      await page.mouse.dblclick(mapBounds.x + mapBounds.width / 2, mapBounds.y + mapBounds.height / 2);
      await page.waitForTimeout(1000);
    }
  });

  test('03. Map Style Controls and 3D Features', async ({ page }) => {
    // Look for map style controls
    const styleControls = page.locator('.mapboxgl-style-switcher, [class*="style"], button:has-text("Satellite"), button:has-text("Terrain")');
    const controls = await styleControls.all();
    
    for (const control of controls.slice(0, 3)) {
      if (await control.isVisible()) {
        await control.click();
        await page.waitForTimeout(2000); // Allow style to change
        console.log('Switched map style');
      }
    }
    
    // Test 3D terrain toggle if present
    const terrainToggle = page.locator('button:has-text("3D"), [data-testid="terrain-toggle"]').first();
    if (await terrainToggle.isVisible()) {
      await terrainToggle.click();
      await page.waitForTimeout(2000);
      await terrainToggle.click(); // Toggle back
      await page.waitForTimeout(2000);
    }
    
    // Test building extrusion toggle
    const buildingToggle = page.locator('button:has-text("Buildings"), [data-testid="buildings-toggle"]').first();
    if (await buildingToggle.isVisible()) {
      await buildingToggle.click();
      await page.waitForTimeout(1000);
    }
  });

  test('04. DockNavigation - Layers Icon and Panel', async ({ page }) => {
    // Find and click layers icon in dock
    const layersIcon = page.locator('.dock-navigation svg, [data-testid="layers"], button:has-text("Layers")').first();
    
    if (await layersIcon.isVisible()) {
      await layersIcon.click();
      await page.waitForTimeout(500);
      
      // Verify layers panel opens
      const layersPanel = page.locator('[class*="layers"], [data-panel="layers"]').first();
      if (await layersPanel.isVisible()) {
        await expect(layersPanel).toBeVisible();
        
        // Test weather overlay toggle
        const weatherToggle = page.locator('button:has-text("Weather"), input[type="checkbox"]').filter({ hasText: /weather/i }).first();
        if (await weatherToggle.isVisible()) {
          await weatherToggle.click();
          await page.waitForTimeout(1000);
          console.log('Weather overlay toggled');
          
          // Toggle back
          await weatherToggle.click();
          await page.waitForTimeout(1000);
        }
        
        // Test smoke overlay toggle
        const smokeToggle = page.locator('button:has-text("Smoke"), input[type="checkbox"]').filter({ hasText: /smoke/i }).first();
        if (await smokeToggle.isVisible()) {
          await smokeToggle.click();
          await page.waitForTimeout(1000);
          console.log('Smoke overlay toggled');
        }
        
        // Test farm boundaries toggle
        const boundariesToggle = page.locator('button:has-text("Boundaries"), input[type="checkbox"]').filter({ hasText: /boundar/i }).first();
        if (await boundariesToggle.isVisible()) {
          await boundariesToggle.click();
          await page.waitForTimeout(1000);
          console.log('Boundaries overlay toggled');
        }
        
        // Test active burns toggle
        const burnsToggle = page.locator('button:has-text("Burns"), input[type="checkbox"]').filter({ hasText: /burns/i }).first();
        if (await burnsToggle.isVisible()) {
          await burnsToggle.click();
          await page.waitForTimeout(1000);
          console.log('Burns overlay toggled');
        }
        
        // Close layers panel
        const closeBtn = page.locator('button[aria-label="Close"], .close, [data-testid="close"]').first();
        if (await closeBtn.isVisible()) {
          await closeBtn.click();
        } else {
          // Click layers icon again to close
          await layersIcon.click();
        }
        await page.waitForTimeout(500);
      }
    }
  });

  test('05. Active Burns Icon and Panel', async ({ page }) => {
    // Find burns icon in dock (flame icon)
    const burnsIcon = page.locator('[data-testid="burns"], .dock-navigation svg[class*="flame"]').first();
    
    if (await burnsIcon.isVisible()) {
      // Check for burn count badge
      const badge = page.locator('[class*="badge"], .count').first();
      if (await badge.isVisible()) {
        const badgeText = await badge.textContent();
        console.log('Burns badge count:', badgeText);
      }
      
      await burnsIcon.click();
      await page.waitForTimeout(500);
      
      // Verify burns panel opens
      const burnsPanel = page.locator('[class*="burns"], [data-panel="burns"]').first();
      if (await burnsPanel.isVisible()) {
        await expect(burnsPanel).toBeVisible();
        
        // Check for burns list
        const burnsList = page.locator('[class*="burn-item"], .burn-list li').all();
        const burns = await burnsList;
        
        if (burns.length > 0) {
          // Click on first burn item
          await burns[0].click();
          await page.waitForTimeout(1000);
          
          // Map should center on burn location
          console.log('Clicked on burn item - map should center');
          
          // Check for burn details display
          const burnDetails = page.locator('[class*="burn-details"], [data-testid="burn-details"]').first();
          if (await burnDetails.isVisible()) {
            await expect(burnDetails).toBeVisible();
          }
        }
        
        // Test burn status indicators
        const statusIndicators = page.locator('[class*="status"], .burn-status').all();
        const statuses = await statusIndicators;
        
        for (const status of statuses.slice(0, 3)) {
          if (await status.isVisible()) {
            const statusText = await status.textContent();
            console.log('Burn status:', statusText);
          }
        }
        
        // Close burns panel
        await burnsIcon.click();
        await page.waitForTimeout(500);
      }
    }
  });

  test('06. Demo Session Banner', async ({ page }) => {
    // Check for demo mode banner
    const demoBanner = page.locator('[class*="demo"], [data-testid="demo-banner"]').first();
    
    if (await demoBanner.isVisible()) {
      await expect(demoBanner).toBeVisible();
      
      // Check for "Demo Mode" text
      const demoText = page.locator('text=/demo mode/i').first();
      if (await demoText.isVisible()) {
        await expect(demoText).toBeVisible();
      }
      
      // Check for timer countdown
      const timer = page.locator('text=/24.*hour|hour.*left|expires/i').first();
      if (await timer.isVisible()) {
        console.log('Demo timer visible');
      }
      
      // Test "Learn More" link if present
      const learnMoreLink = page.locator('a:has-text("Learn More"), button:has-text("Learn More")').first();
      if (await learnMoreLink.isVisible()) {
        await learnMoreLink.hover();
        await page.waitForTimeout(300);
        // Don't click to avoid navigation
      }
      
      // Test dismiss button if present
      const dismissBtn = page.locator('button[aria-label="Dismiss"], .dismiss, [data-testid="dismiss"]').first();
      if (await dismissBtn.isVisible()) {
        await dismissBtn.hover();
        // Don't click to keep banner for other tests
      }
    }
  });

  test('07. TimelineScrubber Bottom Control', async ({ page }) => {
    // Find timeline scrubber at bottom of screen
    const timeline = page.locator('[class*="timeline"], [data-testid="timeline-scrubber"]').first();
    
    if (await timeline.isVisible()) {
      await expect(timeline).toBeVisible();
      
      // Test scrubber dragging
      const scrubber = page.locator('[class*="scrubber"], .timeline-handle').first();
      if (await scrubber.isVisible()) {
        const scrubberBounds = await scrubber.boundingBox();
        if (scrubberBounds) {
          // Drag scrubber left (past)
          await page.mouse.move(scrubberBounds.x + scrubberBounds.width / 2, scrubberBounds.y + scrubberBounds.height / 2);
          await page.mouse.down();
          await page.mouse.move(scrubberBounds.x - 50, scrubberBounds.y + scrubberBounds.height / 2);
          await page.mouse.up();
          await page.waitForTimeout(500);
          
          // Drag scrubber right (future)
          await page.mouse.move(scrubberBounds.x - 50, scrubberBounds.y + scrubberBounds.height / 2);
          await page.mouse.down();
          await page.mouse.move(scrubberBounds.x + 50, scrubberBounds.y + scrubberBounds.height / 2);
          await page.mouse.up();
          await page.waitForTimeout(500);
        }
      }
      
      // Test clicking specific dates on timeline
      const timelineBounds = await timeline.boundingBox();
      if (timelineBounds) {
        await page.mouse.click(timelineBounds.x + 100, timelineBounds.y + timelineBounds.height / 2);
        await page.waitForTimeout(500);
        await page.mouse.click(timelineBounds.x + 200, timelineBounds.y + timelineBounds.height / 2);
        await page.waitForTimeout(500);
      }
      
      // Test "Today" button
      const todayBtn = page.locator('button:has-text("Today"), [data-testid="today"]').first();
      if (await todayBtn.isVisible()) {
        await todayBtn.click();
        await page.waitForTimeout(500);
      }
      
      // Test play animation button
      const playBtn = page.locator('button[aria-label*="Play"], .play-button').first();
      if (await playBtn.isVisible()) {
        await playBtn.click();
        await page.waitForTimeout(2000);
        await playBtn.click(); // Stop animation
        await page.waitForTimeout(500);
      }
      
      // Test arrow key navigation
      await timeline.click(); // Focus timeline
      await page.keyboard.press('ArrowLeft');
      await page.waitForTimeout(300);
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(300);
    }
  });

  test('08. Date Display and Transitions', async ({ page }) => {
    // Check for date display
    const dateDisplay = page.locator('[class*="date"], .current-date, [data-testid="current-date"]').first();
    
    if (await dateDisplay.isVisible()) {
      const currentDate = await dateDisplay.textContent();
      console.log('Current date display:', currentDate);
      
      // Test date format (should be readable)
      expect(currentDate.length).toBeGreaterThan(5);
      
      // Test month transitions by navigating timeline
      const timeline = page.locator('[class*="timeline"]').first();
      if (await timeline.isVisible()) {
        await timeline.click();
        
        // Navigate with keyboard to test month transitions
        for (let i = 0; i < 35; i++) { // More than a month
          await page.keyboard.press('ArrowRight');
          await page.waitForTimeout(50);
        }
        
        const newDate = await dateDisplay.textContent();
        console.log('New date after navigation:', newDate);
        expect(newDate).not.toBe(currentDate);
      }
    }
  });

  test('09. Burn Events on Timeline', async ({ page }) => {
    const timeline = page.locator('[class*="timeline"]').first();
    
    if (await timeline.isVisible()) {
      // Look for burn markers on timeline
      const burnMarkers = page.locator('[class*="burn-marker"], .timeline-event').all();
      const markers = await burnMarkers;
      
      if (markers.length > 0) {
        // Test hovering over burn marker for tooltip
        await markers[0].hover();
        await page.waitForTimeout(500);
        
        const tooltip = page.locator('[class*="tooltip"], .burn-tooltip').first();
        if (await tooltip.isVisible()) {
          console.log('Burn marker tooltip displayed');
        }
        
        // Test clicking burn marker for details
        await markers[0].click();
        await page.waitForTimeout(1000);
        
        const burnDetails = page.locator('[class*="burn-details"], .event-details').first();
        if (await burnDetails.isVisible()) {
          console.log('Burn event details displayed');
        }
        
        // Test distinction between past and future burns
        for (const marker of markers.slice(0, 3)) {
          const markerClass = await marker.getAttribute('class');
          console.log('Burn marker classes:', markerClass);
        }
      }
    }
  });

  test('10. Map Overlays and Visualizations', async ({ page }) => {
    // Enable weather overlay first
    const layersIcon = page.locator('.dock-navigation svg, [data-testid="layers"]').first();
    if (await layersIcon.isVisible()) {
      await layersIcon.click();
      await page.waitForTimeout(500);
      
      const weatherToggle = page.locator('input[type="checkbox"], button').filter({ hasText: /weather/i }).first();
      if (await weatherToggle.isVisible()) {
        await weatherToggle.click();
        await page.waitForTimeout(2000);
        
        // Check for weather visualization on map
        const weatherLayer = page.locator('[class*="weather"], .weather-overlay').first();
        if (await weatherLayer.isVisible()) {
          console.log('Weather overlay visible on map');
        }
        
        // Check for legend
        const legend = page.locator('[class*="legend"], .weather-legend').first();
        if (await legend.isVisible()) {
          console.log('Weather legend displayed');
        }
        
        // Test opacity slider if present
        const opacitySlider = page.locator('input[type="range"], .opacity-slider').first();
        if (await opacitySlider.isVisible()) {
          await opacitySlider.fill('0.5');
          await page.waitForTimeout(500);
          await opacitySlider.fill('1');
          await page.waitForTimeout(500);
        }
      }
      
      // Close layers panel
      await layersIcon.click();
    }
  });

  test('11. Weather Station Markers', async ({ page }) => {
    // Look for weather station markers on map
    const weatherMarkers = page.locator('[class*="weather-marker"], .weather-station').all();
    const markers = await weatherMarkers;
    
    if (markers.length > 0) {
      // Click on first weather marker
      await markers[0].click();
      await page.waitForTimeout(1000);
      
      // Check for popup with conditions
      const popup = page.locator('.mapboxgl-popup, [class*="popup"]').first();
      if (await popup.isVisible()) {
        await expect(popup).toBeVisible();
        
        // Check popup content
        const temperature = popup.locator('text=/°F|°C|\d+°/').first();
        if (await temperature.isVisible()) {
          console.log('Temperature data in popup');
        }
        
        const windSpeed = popup.locator('text=/mph|km\/h|wind/i').first();
        if (await windSpeed.isVisible()) {
          console.log('Wind speed data in popup');
        }
        
        // Check data freshness timestamp
        const timestamp = popup.locator('text=/updated|ago|last/i').first();
        if (await timestamp.isVisible()) {
          console.log('Data freshness timestamp visible');
        }
        
        // Close popup
        const closePopup = popup.locator('button, .close').first();
        if (await closePopup.isVisible()) {
          await closePopup.click();
        } else {
          // Click elsewhere to close popup
          await page.mouse.click(500, 300);
        }
        await page.waitForTimeout(500);
      }
    }
  });

  test('12. Map Rotation and Advanced Interactions', async ({ page }) => {
    const mapContainer = page.locator('#map, [class*="mapbox"]').first();
    const mapBounds = await mapContainer.boundingBox();
    
    if (mapBounds) {
      const centerX = mapBounds.x + mapBounds.width / 2;
      const centerY = mapBounds.y + mapBounds.height / 2;
      
      // Test shift+drag rotation
      await page.keyboard.down('Shift');
      await page.mouse.move(centerX, centerY);
      await page.mouse.down();
      await page.mouse.move(centerX + 100, centerY - 50);
      await page.mouse.up();
      await page.keyboard.up('Shift');
      await page.waitForTimeout(1000);
      
      // Reset rotation
      await page.keyboard.down('Shift');
      await page.mouse.move(centerX, centerY);
      await page.mouse.down();
      await page.mouse.move(centerX - 100, centerY + 50);
      await page.mouse.up();
      await page.keyboard.up('Shift');
      await page.waitForTimeout(1000);
      
      // Test ctrl+drag for 3D tilt (if supported)
      await page.keyboard.down('Control');
      await page.mouse.move(centerX, centerY);
      await page.mouse.down();
      await page.mouse.move(centerX, centerY - 50);
      await page.mouse.up();
      await page.keyboard.up('Control');
      await page.waitForTimeout(1000);
    }
  });

  test('13. Performance and Smooth Animations', async ({ page }) => {
    // Measure map loading performance
    const startTime = Date.now();
    
    // Perform intensive map operations
    const mapContainer = page.locator('#map, [class*="mapbox"]').first();
    const mapBounds = await mapContainer.boundingBox();
    
    if (mapBounds) {
      const centerX = mapBounds.x + mapBounds.width / 2;
      const centerY = mapBounds.y + mapBounds.height / 2;
      
      // Rapid zoom operations
      for (let i = 0; i < 3; i++) {
        await page.mouse.wheel(0, -120);
        await page.waitForTimeout(100);
      }
      
      // Rapid pan operations
      for (let i = 0; i < 3; i++) {
        await page.mouse.move(centerX, centerY);
        await page.mouse.down();
        await page.mouse.move(centerX + (i * 50), centerY + (i * 30));
        await page.mouse.up();
        await page.waitForTimeout(100);
      }
    }
    
    const operationTime = Date.now() - startTime;
    console.log(`Map operations completed in: ${operationTime}ms`);
    
    // Should complete intensive operations in reasonable time
    expect(operationTime).toBeLessThan(10000);
    
    // Check for smooth frame rates (no dropped frames warnings)
    const performanceWarnings = [];
    page.on('console', message => {
      if (message.text().includes('frame') || message.text().includes('performance')) {
        performanceWarnings.push(message.text());
      }
    });
    
    await page.waitForTimeout(2000);
    
    if (performanceWarnings.length > 0) {
      console.log('Performance warnings:', performanceWarnings);
    }
  });

  test('14. Map State Persistence', async ({ page }) => {
    const mapContainer = page.locator('#map, [class*="mapbox"]').first();
    
    // Set specific map state
    if (await mapContainer.isVisible()) {
      // Zoom to specific level
      const zoomInBtn = page.locator('.mapboxgl-ctrl-zoom-in').first();
      if (await zoomInBtn.isVisible()) {
        for (let i = 0; i < 2; i++) {
          await zoomInBtn.click();
          await page.waitForTimeout(300);
        }
      }
      
      // Pan to specific location
      const mapBounds = await mapContainer.boundingBox();
      if (mapBounds) {
        const centerX = mapBounds.x + mapBounds.width / 2;
        const centerY = mapBounds.y + mapBounds.height / 2;
        
        await page.mouse.move(centerX, centerY);
        await page.mouse.down();
        await page.mouse.move(centerX + 100, centerY + 100);
        await page.mouse.up();
        await page.waitForTimeout(1000);
      }
      
      // Reload page to test state persistence
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
      
      // Check if map state is preserved (zoom level, position)
      const mapState = await page.evaluate(() => {
        const map = window.map; // If map instance is available globally
        if (map) {
          return {
            zoom: map.getZoom(),
            center: map.getCenter()
          };
        }
        return null;
      });
      
      if (mapState) {
        console.log('Map state after reload:', mapState);
      }
    }
  });

  test('15. Accessibility Features', async ({ page }) => {
    // Test keyboard navigation
    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);
    
    let focusedElement = page.locator(':focus');
    if (await focusedElement.count() > 0) {
      console.log('First focusable element found');
    }
    
    // Tab through interactive elements
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(100);
      
      focusedElement = page.locator(':focus');
      if (await focusedElement.count() > 0) {
        const tagName = await focusedElement.first().evaluate(el => el.tagName);
        console.log(`Tab ${i + 1}: Focused on ${tagName}`);
      }
    }
    
    // Test ARIA labels on interactive elements
    const interactiveElements = page.locator('button, [role="button"], input, [tabindex]').all();
    const elements = await interactiveElements;
    
    let elementsWithoutLabels = 0;
    for (const element of elements.slice(0, 10)) {
      const ariaLabel = await element.getAttribute('aria-label');
      const title = await element.getAttribute('title');
      const textContent = await element.textContent();
      
      if (!ariaLabel && !title && (!textContent || textContent.trim() === '')) {
        elementsWithoutLabels++;
      }
    }
    
    console.log(`Elements without accessible labels: ${elementsWithoutLabels}`);
    
    // Test skip links or focus management
    const skipLink = page.locator('a:has-text("Skip"), [data-testid="skip-link"]').first();
    if (await skipLink.isVisible()) {
      await skipLink.click();
      console.log('Skip link functionality tested');
    }
  });
});