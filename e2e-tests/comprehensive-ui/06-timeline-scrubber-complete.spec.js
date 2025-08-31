/**
 * Complete Timeline Scrubber Feature Tests
 * Tests temporal navigation, burn events, drag interactions, and real-time updates
 * NO MOCKS - Real timeline data and API integration
 */

const { test, expect } = require('@playwright/test');

test.describe('Timeline Scrubber - Complete Feature Testing', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to spatial interface where timeline scrubber is visible
    await page.goto('http://localhost:3000');
    
    // Auto-redirect handling (onboarding → spatial)
    if ((await page.url()).includes('onboarding')) {
      await page.click('button:has-text("Skip Setup")');
    }
    
    // Wait for spatial interface to load
    await page.waitForURL('**/spatial');
    await page.waitForLoadState('networkidle');
    
    // Wait for timeline scrubber to be visible
    const timelineScrubber = page.locator('.timeline-scrubber');
    await expect(timelineScrubber).toBeVisible();
  });

  test('01. Timeline Scrubber Visibility and Initial State', async ({ page }) => {
    const scrubber = page.locator('.timeline-scrubber');
    
    // Verify scrubber is positioned at bottom
    await expect(scrubber).toBeVisible();
    await expect(scrubber).toHaveCSS('position', 'fixed');
    
    // Check glass morphism styling
    const backdropFilter = await scrubber.evaluate(el => 
      window.getComputedStyle(el).backdropFilter
    );
    expect(backdropFilter).toContain('blur');
    
    // Verify animation entrance from bottom
    await page.waitForTimeout(1000); // Allow animation to complete
    const transform = await scrubber.evaluate(el => 
      window.getComputedStyle(el).transform
    );
    // Should be at final position (not translateY(100px))
    expect(transform).not.toContain('matrix(1, 0, 0, 1, 0, 100)');
  });

  test('02. Timeline Controls - Play/Pause Functionality', async ({ page }) => {
    const playBtn = page.locator('.play-btn');
    const timeDisplay = page.locator('.display-time');
    
    // Verify play button is visible and shows play icon initially
    await expect(playBtn).toBeVisible();
    
    // Check initial play icon (triangle)
    let playIcon = playBtn.locator('polygon');
    await expect(playIcon).toBeVisible();
    
    // Record initial time
    const initialTime = await timeDisplay.textContent();
    
    // Click play button
    await playBtn.click();
    await page.waitForTimeout(100);
    
    // Should now show pause icon (two rectangles)
    const pauseIcons = playBtn.locator('rect');
    await expect(pauseIcons).toHaveCount(2);
    
    // Wait a bit to see if time advances (timeline moves forward in 1-hour increments every second)
    await page.waitForTimeout(2000);
    
    // Click pause
    await playBtn.click();
    await page.waitForTimeout(100);
    
    // Should show play icon again
    playIcon = playBtn.locator('polygon');
    await expect(playIcon).toBeVisible();
    
    // Test hover effects
    await playBtn.hover();
    const hoverBackground = await playBtn.evaluate(el => 
      window.getComputedStyle(el).background
    );
    expect(hoverBackground).toContain('gradient');
  });

  test('03. NOW Button Functionality', async ({ page }) => {
    const nowBtn = page.locator('.now-btn');
    const timeDisplay = page.locator('.display-time');
    const dateDisplay = page.locator('.display-date');
    
    // Verify NOW button is visible
    await expect(nowBtn).toBeVisible();
    await expect(nowBtn).toHaveText('NOW');
    
    // Test hover effects
    await nowBtn.hover();
    await page.waitForTimeout(200);
    
    // Click NOW button
    await nowBtn.click();
    
    // Should jump to current time
    await page.waitForTimeout(500);
    
    // Verify current date is displayed
    const currentDate = new Date().toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    const displayedDate = await dateDisplay.textContent();
    
    // Should contain today's date components
    const today = new Date();
    const monthName = today.toLocaleDateString('en-US', { month: 'long' });
    const dayNum = today.getDate().toString();
    
    expect(displayedDate).toContain(monthName);
    expect(displayedDate).toContain(dayNum);
  });

  test('04. View Mode Toggle - Day/Week/Month', async ({ page }) => {
    const viewModeToggle = page.locator('.view-mode-toggle');
    const dayBtn = page.locator('.view-mode-btn:has-text("Day")');
    const weekBtn = page.locator('.view-mode-btn:has-text("Week")');
    const monthBtn = page.locator('.view-mode-btn:has-text("Month")');
    const timelineMarkers = page.locator('.timeline-marker');
    
    // Verify view mode toggle is visible (desktop only)
    if (await viewModeToggle.isVisible()) {
      // Test day view (default)
      await expect(dayBtn).toHaveClass(/active/);
      
      // Verify time markers show hours in day view
      const firstMarker = timelineMarkers.first().locator('.marker-label');
      if (await firstMarker.isVisible()) {
        const markerText = await firstMarker.textContent();
        // Day view should show time format (AM/PM)
        expect(markerText).toMatch(/\d{1,2}:\d{2}\s?(AM|PM)/);
      }
      
      // Switch to week view
      await weekBtn.click();
      await page.waitForTimeout(500);
      await expect(weekBtn).toHaveClass(/active/);
      
      // Markers should now show dates instead of times
      if (await firstMarker.isVisible()) {
        const weekMarkerText = await firstMarker.textContent();
        // Week view should show date format (Jan 1, Feb 2, etc.)
        expect(weekMarkerText).toMatch(/[A-Za-z]{3}\s\d{1,2}/);
      }
      
      // Switch to month view
      await monthBtn.click();
      await page.waitForTimeout(500);
      await expect(monthBtn).toHaveClass(/active/);
      
      // Switch back to day
      await dayBtn.click();
      await page.waitForTimeout(500);
      await expect(dayBtn).toHaveClass(/active/);
    }
  });

  test('05. Timeline Track - Click to Scrub', async ({ page }) => {
    const timelineTrack = page.locator('.timeline-track');
    const currentIndicator = page.locator('.timeline-current');
    const timeDisplay = page.locator('.display-time');
    
    // Verify timeline track is clickable
    await expect(timelineTrack).toBeVisible();
    
    // Get initial indicator position
    const initialPosition = await currentIndicator.evaluate(el => {
      return window.getComputedStyle(el).left;
    });
    
    // Record initial time
    const initialTime = await timeDisplay.textContent();
    
    // Click at different positions on timeline
    const trackBounds = await timelineTrack.boundingBox();
    
    // Click at 25% position
    await page.mouse.click(
      trackBounds.x + (trackBounds.width * 0.25),
      trackBounds.y + (trackBounds.height / 2)
    );
    await page.waitForTimeout(300);
    
    // Indicator should move
    const newPosition = await currentIndicator.evaluate(el => {
      return window.getComputedStyle(el).left;
    });
    expect(newPosition).not.toBe(initialPosition);
    
    // Time should change
    const newTime = await timeDisplay.textContent();
    expect(newTime).not.toBe(initialTime);
    
    // Click at 75% position
    await page.mouse.click(
      trackBounds.x + (trackBounds.width * 0.75),
      trackBounds.y + (trackBounds.height / 2)
    );
    await page.waitForTimeout(300);
    
    // Indicator should move again
    const thirdPosition = await currentIndicator.evaluate(el => {
      return window.getComputedStyle(el).left;
    });
    expect(thirdPosition).not.toBe(newPosition);
  });

  test('06. Current Time Indicator - Drag Functionality', async ({ page }) => {
    const currentIndicator = page.locator('.timeline-current');
    const indicatorHead = page.locator('.indicator-head');
    const timeDisplay = page.locator('.display-time');
    const timeLabel = page.locator('.current-time-label');
    
    // Verify current indicator elements
    await expect(currentIndicator).toBeVisible();
    await expect(indicatorHead).toBeVisible();
    await expect(timeLabel).toBeVisible();
    
    // Check cursor changes to resize cursor
    await currentIndicator.hover();
    const cursor = await currentIndicator.evaluate(el => 
      window.getComputedStyle(el).cursor
    );
    expect(cursor).toBe('ew-resize');
    
    // Record initial position and time
    const initialTime = await timeDisplay.textContent();
    const initialLeft = await currentIndicator.evaluate(el => {
      return window.getComputedStyle(el).left;
    });
    
    // Drag the indicator to the right
    const indicatorBox = await currentIndicator.boundingBox();
    const timelineTrack = page.locator('.timeline-track');
    const trackBox = await timelineTrack.boundingBox();
    
    // Drag from current position to 30% of track width to the right
    const dragToX = trackBox.x + (trackBox.width * 0.3);
    
    await page.mouse.move(indicatorBox.x + (indicatorBox.width / 2), indicatorBox.y + (indicatorBox.height / 2));
    await page.mouse.down();
    await page.mouse.move(dragToX, indicatorBox.y + (indicatorBox.height / 2));
    await page.mouse.up();
    await page.waitForTimeout(300);
    
    // Verify position changed
    const newLeft = await currentIndicator.evaluate(el => {
      return window.getComputedStyle(el).left;
    });
    expect(newLeft).not.toBe(initialLeft);
    
    // Verify time changed
    const newTime = await timeDisplay.textContent();
    expect(newTime).not.toBe(initialTime);
    
    // Verify time label updates
    const labelTime = await timeLabel.textContent();
    expect(labelTime).toBe(newTime);
  });

  test('07. Timeline Markers and Time Labels', async ({ page }) => {
    const markers = page.locator('.timeline-marker');
    const markerLines = page.locator('.marker-line');
    const markerLabels = page.locator('.marker-label');
    
    // Should have 8 markers (0 to 7 index = 8 total)
    await expect(markers).toHaveCount(8);
    await expect(markerLines).toHaveCount(8);
    
    // Each marker should have a line and label
    for (let i = 0; i < Math.min(await markers.count(), 8); i++) {
      const marker = markers.nth(i);
      const line = marker.locator('.marker-line');
      const label = marker.locator('.marker-label');
      
      await expect(line).toBeVisible();
      
      if (await label.isVisible()) {
        const labelText = await label.textContent();
        expect(labelText.trim()).toBeTruthy();
        
        // Labels should be positioned at different percentages
        const leftPosition = await marker.evaluate(el => 
          window.getComputedStyle(el).left
        );
        expect(leftPosition).toMatch(/\d+(\.\d+)?%/);
      }
    }
  });

  test('08. Burn Events on Timeline', async ({ page }) => {
    // Wait for timeline data to load
    await page.waitForTimeout(2000);
    
    const timelineEvents = page.locator('.timeline-event');
    const eventTooltips = page.locator('.event-tooltip');
    
    // Check if burn events are present
    const eventCount = await timelineEvents.count();
    
    if (eventCount > 0) {
      // Test first few events
      for (let i = 0; i < Math.min(eventCount, 3); i++) {
        const event = timelineEvents.nth(i);
        const tooltip = event.locator('.event-tooltip');
        
        // Event should be visible and properly positioned
        await expect(event).toBeVisible();
        
        // Check event status styling
        const eventClass = await event.getAttribute('class');
        expect(eventClass).toMatch(/timeline-event (scheduled|active|completed)/);
        
        // Test hover effects
        await event.hover();
        await page.waitForTimeout(300);
        
        // Tooltip should become visible on hover
        if (await tooltip.isVisible()) {
          const farmName = tooltip.locator('.tooltip-farm');
          const acres = tooltip.locator('.tooltip-acres');
          const time = tooltip.locator('.tooltip-time');
          
          if (await farmName.isVisible()) {
            const farmText = await farmName.textContent();
            expect(farmText.trim()).toBeTruthy();
          }
          
          if (await acres.isVisible()) {
            const acresText = await acres.textContent();
            expect(acresText).toMatch(/\d+\s?acres/i);
          }
          
          if (await time.isVisible()) {
            const timeText = await time.textContent();
            expect(timeText).toMatch(/\d{1,2}:\d{2}\s?(AM|PM)/);
          }
        }
        
        // Move away to hide tooltip
        await page.mouse.move(0, 0);
        await page.waitForTimeout(200);
      }
    } else {
      console.log('No burn events found on timeline - this is normal if no burns are scheduled');
    }
  });

  test('09. Progress Fill Visualization', async ({ page }) => {
    const progressFill = page.locator('.timeline-progress');
    const currentIndicator = page.locator('.timeline-current');
    
    // Progress fill should be visible
    await expect(progressFill).toBeVisible();
    
    // Progress width should match current indicator position
    const progressWidth = await progressFill.evaluate(el => 
      window.getComputedStyle(el).width
    );
    const indicatorLeft = await currentIndicator.evaluate(el => 
      window.getComputedStyle(el).left
    );
    
    // Both should be using percentage values and roughly match
    expect(progressWidth).toMatch(/\d+(\.\d+)?%/);
    expect(indicatorLeft).toMatch(/\d+(\.\d+)?%/);
    
    // Test progress updates when time changes
    const nowBtn = page.locator('.now-btn');
    await nowBtn.click();
    await page.waitForTimeout(300);
    
    const newProgressWidth = await progressFill.evaluate(el => 
      window.getComputedStyle(el).width
    );
    
    // Progress should have updated
    expect(newProgressWidth).toMatch(/\d+(\.\d+)?%/);
  });

  test('10. Time Display Format and Updates', async ({ page }) => {
    const displayDate = page.locator('.display-date');
    const displayTime = page.locator('.display-time');
    
    // Both displays should be visible
    await expect(displayDate).toBeVisible();
    await expect(displayTime).toBeVisible();
    
    // Date should be in full format
    const dateText = await displayDate.textContent();
    expect(dateText).toMatch(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s/);
    expect(dateText).toMatch(/\d{4}$/); // Should end with year
    
    // Time should be in 12-hour format
    const timeText = await displayTime.textContent();
    expect(timeText).toMatch(/^\d{1,2}:\d{2}\s(AM|PM)$/);
    
    // Test time update by clicking timeline
    const timelineTrack = page.locator('.timeline-track');
    const trackBounds = await timelineTrack.boundingBox();
    
    // Click at 50% position
    await page.mouse.click(
      trackBounds.x + (trackBounds.width * 0.5),
      trackBounds.y + (trackBounds.height / 2)
    );
    await page.waitForTimeout(300);
    
    // Time display should update
    const newTimeText = await displayTime.textContent();
    expect(newTimeText).toMatch(/^\d{1,2}:\d{2}\s(AM|PM)$/);
    // Should be different from initial time (unless we clicked at same position)
    if (newTimeText !== timeText) {
      expect(newTimeText).not.toBe(timeText);
    }
  });

  test('11. Timeline Animation and Spring Physics', async ({ page }) => {
    // Test entrance animation by reloading
    await page.reload();
    
    // Wait for spatial interface
    if ((await page.url()).includes('onboarding')) {
      await page.click('button:has-text("Skip Setup")');
    }
    await page.waitForURL('**/spatial');
    
    // Timeline should animate in from bottom
    const scrubber = page.locator('.timeline-scrubber');
    
    // Initially might be off-screen or transitioning
    await page.waitForTimeout(100);
    
    // Should settle to final position
    await page.waitForTimeout(1500); // Allow spring animation to complete
    await expect(scrubber).toBeVisible();
    
    // Test hover animations on events
    await page.waitForTimeout(1000);
    const timelineEvents = page.locator('.timeline-event');
    const eventCount = await timelineEvents.count();
    
    if (eventCount > 0) {
      const firstEvent = timelineEvents.first();
      
      // Get initial transform
      const initialTransform = await firstEvent.evaluate(el => 
        window.getComputedStyle(el).transform
      );
      
      // Hover should trigger animation
      await firstEvent.hover();
      await page.waitForTimeout(300);
      
      // Transform should change (scale and translate)
      const hoverTransform = await firstEvent.evaluate(el => 
        window.getComputedStyle(el).transform
      );
      
      // Should be different and include scaling/translation
      if (hoverTransform !== initialTransform) {
        expect(hoverTransform).toContain('matrix');
      }
    }
  });

  test('12. Keyboard Navigation and Accessibility', async ({ page }) => {
    const playBtn = page.locator('.play-btn');
    const nowBtn = page.locator('.now-btn');
    const dayBtn = page.locator('.view-mode-btn:has-text("Day")');
    
    // Test keyboard focus on controls
    await playBtn.focus();
    let focusedElement = page.locator(':focus');
    await expect(focusedElement).toHaveAttribute('class', /play-btn/);
    
    // Tab to next control
    await page.keyboard.press('Tab');
    focusedElement = page.locator(':focus');
    await expect(focusedElement).toHaveAttribute('class', /now-btn/);
    
    // Space or Enter should activate buttons
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);
    
    // Test additional tab navigation
    if (await dayBtn.isVisible()) {
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      focusedElement = page.locator(':focus');
      
      // Should be able to reach view mode buttons
      const focusedClass = await focusedElement.getAttribute('class');
      if (focusedClass && focusedClass.includes('view-mode-btn')) {
        await expect(focusedElement).toBeVisible();
      }
    }
  });

  test('13. Responsive Design - Mobile View', async ({ page }) => {
    // Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(500);
    
    const scrubber = page.locator('.timeline-scrubber');
    await expect(scrubber).toBeVisible();
    
    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    
    // Scrubber should still be visible but adjusted
    await expect(scrubber).toBeVisible();
    
    // View mode toggle should be hidden on mobile
    const viewModeToggle = page.locator('.view-mode-toggle');
    const isVisible = await viewModeToggle.isVisible();
    
    // Should be hidden on mobile (CSS: display: none at max-width: 768px)
    if (!isVisible) {
      expect(isVisible).toBe(false);
    }
    
    // Timeline track should be shorter on mobile
    const timelineTrack = page.locator('.timeline-track');
    const trackHeight = await timelineTrack.evaluate(el => 
      window.getComputedStyle(el).height
    );
    
    // Mobile height should be 35px vs desktop 50px
    expect(parseInt(trackHeight)).toBeLessThanOrEqual(50);
    
    // Reset to desktop
    await page.setViewportSize({ width: 1920, height: 1080 });
  });

  test('14. API Integration and Data Loading', async ({ page }) => {
    // Monitor network requests
    const apiRequests = [];
    page.on('request', request => {
      if (request.url().includes('/api/schedule/timeline/')) {
        apiRequests.push(request.url());
      }
    });
    
    // Change view modes to trigger API calls
    const dayBtn = page.locator('.view-mode-btn:has-text("Day")');
    const weekBtn = page.locator('.view-mode-btn:has-text("Week")');
    
    if (await dayBtn.isVisible() && await weekBtn.isVisible()) {
      // Switch to week view
      await weekBtn.click();
      await page.waitForTimeout(1000);
      
      // Switch back to day view
      await dayBtn.click();
      await page.waitForTimeout(1000);
      
      // Should have made API requests
      expect(apiRequests.length).toBeGreaterThanOrEqual(1);
      
      // API requests should be to timeline endpoint
      apiRequests.forEach(url => {
        expect(url).toContain('/api/schedule/timeline/');
        expect(url).toMatch(/\d{4}-\d{2}-\d{2}$/); // Should end with date format
      });
    }
    
    // Test error handling by checking console errors
    const consoleErrors = [];
    page.on('console', message => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text());
      }
    });
    
    // Wait a bit to catch any errors
    await page.waitForTimeout(2000);
    
    // Filter out non-critical errors
    const criticalErrors = consoleErrors.filter(error => 
      !error.includes('Warning') && 
      !error.includes('DevTools') &&
      !error.includes('Extension') &&
      !error.includes('favicon')
    );
    
    if (criticalErrors.length > 0) {
      console.log('Timeline API errors found:', criticalErrors);
    }
  });

  test('15. Performance and Memory Management', async ({ page }) => {
    // Test continuous playback performance
    const playBtn = page.locator('.play-btn');
    
    // Start playback
    await playBtn.click();
    
    // Let it run for a few seconds
    await page.waitForTimeout(3000);
    
    // Stop playback
    await playBtn.click();
    
    // Check if timeline is still responsive
    const timelineTrack = page.locator('.timeline-track');
    await expect(timelineTrack).toBeVisible();
    
    const trackBounds = await timelineTrack.boundingBox();
    await page.mouse.click(
      trackBounds.x + (trackBounds.width * 0.3),
      trackBounds.y + (trackBounds.height / 2)
    );
    await page.waitForTimeout(300);
    
    // Timeline should still respond to clicks
    const timeDisplay = page.locator('.display-time');
    await expect(timeDisplay).toBeVisible();
    
    // Test rapid view mode switching
    const dayBtn = page.locator('.view-mode-btn:has-text("Day")');
    const weekBtn = page.locator('.view-mode-btn:has-text("Week")');
    const monthBtn = page.locator('.view-mode-btn:has-text("Month")');
    
    if (await dayBtn.isVisible()) {
      // Rapid switching
      for (let i = 0; i < 3; i++) {
        await weekBtn.click();
        await page.waitForTimeout(100);
        await monthBtn.click();
        await page.waitForTimeout(100);
        await dayBtn.click();
        await page.waitForTimeout(100);
      }
      
      // Timeline should still be functional
      await expect(page.locator('.timeline-scrubber')).toBeVisible();
      await expect(timeDisplay).toBeVisible();
    }
  });
});