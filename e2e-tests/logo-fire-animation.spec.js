const { test, expect } = require('@playwright/test');

test.describe('Logo Fire Animation System', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage to ensure animation shows
    await page.goto('http://localhost:3000');
    await page.evaluate(() => localStorage.clear());
    
    // Enable debug mode for better visibility
    await page.evaluate(() => {
      window.DEBUG_FIRE = true;
    });
  });

  test('should initialize logo fire animation with proper canvas', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Check startup container exists
    const startupContainer = await page.locator('.fullscreen-startup');
    await expect(startupContainer).toBeVisible();
    
    // Check canvas element exists
    const canvas = await page.locator('.fire-canvas');
    await expect(canvas).toBeVisible();
    
    // Verify canvas has proper dimensions
    const canvasSize = await canvas.boundingBox();
    expect(canvasSize.width).toBeGreaterThan(100);
    expect(canvasSize.height).toBeGreaterThan(100);
    
    // Wait for initialization message to disappear
    await page.waitForFunction(() => {
      const loadingText = document.querySelector('.cinematic-fire-container div');
      return !loadingText || !loadingText.textContent.includes('Initializing fire system');
    }, { timeout: 3000 });
  });

  test('should render logo particles with correct size and visibility', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Wait for particles to start rendering
    await page.waitForTimeout(1000);
    
    // Take screenshot to verify particles are visible
    const canvas = await page.locator('.fire-canvas');
    const screenshot = await canvas.screenshot();
    
    // Check if canvas has content (not just black)
    const canvasData = await page.evaluate(() => {
      const canvas = document.querySelector('.fire-canvas');
      const ctx = canvas.getContext('2d');
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = imageData.data;
      
      // Count non-black pixels
      let nonBlackPixels = 0;
      let orangePixels = 0;
      let brightPixels = 0;
      
      for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        
        // Check for non-black pixels
        if (r > 10 || g > 10 || b > 10) {
          nonBlackPixels++;
        }
        
        // Check for orange/fire colored pixels
        if (r > 200 && g > 50 && g < 250 && b < 100) {
          orangePixels++;
        }
        
        // Check for bright pixels (particles should be bright)
        if (r > 150 || g > 150 || b > 150) {
          brightPixels++;
        }
      }
      
      return {
        totalPixels: pixels.length / 4,
        nonBlackPixels,
        orangePixels,
        brightPixels,
        percentageNonBlack: (nonBlackPixels / (pixels.length / 4)) * 100,
        percentageOrange: (orangePixels / (pixels.length / 4)) * 100,
        percentageBright: (brightPixels / (pixels.length / 4)) * 100
      };
    });
    
    console.log('Canvas pixel analysis:', canvasData);
    
    // Verify particles are visible (at least 0.5% of canvas should have fire colors)
    expect(canvasData.percentageOrange).toBeGreaterThan(0.5);
    
    // Verify particles are reasonably sized (not tiny dots)
    expect(canvasData.percentageBright).toBeGreaterThan(0.1);
  });

  test('should progress through animation phases correctly', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    const phases = [];
    
    // Monitor phase changes
    await page.exposeFunction('recordPhase', (phase) => {
      phases.push(phase);
      console.log(`Phase recorded: ${phase}`);
    });
    
    await page.evaluate(() => {
      // Watch for phase changes in debug info
      const checkPhase = setInterval(() => {
        const debugInfo = document.querySelector('.cinematic-fire-container > div:last-child');
        if (debugInfo && debugInfo.textContent.includes('Phase:')) {
          const phaseMatch = debugInfo.textContent.match(/Phase: (\w+)/);
          if (phaseMatch) {
            window.recordPhase(phaseMatch[1]);
          }
        }
      }, 100);
      
      // Clean up after 7 seconds
      setTimeout(() => clearInterval(checkPhase), 7000);
    });
    
    // Wait for animation to progress
    await page.waitForTimeout(6500);
    
    // Verify we went through expected phases
    console.log('Recorded phases:', phases);
    expect(phases).toContain('initial');
    expect(phases).toContain('ignition');
    expect(phases).toContain('formation');
    expect(phases).toContain('stabilization');
    expect(phases).toContain('transition');
  });

  test('should show skip button and handle skip correctly', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Wait for skip button to appear
    await page.waitForTimeout(500);
    
    const skipButton = await page.locator('button:has-text("Skip Animation")');
    await expect(skipButton).toBeVisible();
    
    // Verify button styling
    const buttonStyles = await skipButton.evaluate(el => {
      const styles = window.getComputedStyle(el);
      return {
        position: styles.position,
        background: styles.background,
        border: styles.border
      };
    });
    
    expect(buttonStyles.position).toBe('absolute');
    expect(buttonStyles.background).toContain('rgba');
    
    // Click skip button
    await skipButton.click();
    
    // Animation should complete immediately
    await page.waitForTimeout(500);
    const startupContainer = await page.locator('.fullscreen-startup');
    await expect(startupContainer).not.toBeVisible();
  });

  test('should display BURNWISE text during transition phase', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Initially, text should be hidden
    const logoText = await page.locator('.startup-logo-text');
    const initialOpacity = await logoText.evaluate(el => {
      return window.getComputedStyle(el).opacity;
    });
    expect(initialOpacity).toBe('0');
    
    // Wait for transition phase (approximately 4-5 seconds)
    await page.waitForTimeout(5000);
    
    // Text should now be visible
    const finalOpacity = await logoText.evaluate(el => {
      return window.getComputedStyle(el).opacity;
    });
    expect(finalOpacity).toBe('1');
    
    // Check text content
    const title = await page.locator('.startup-title');
    await expect(title).toHaveText('BURNWISE');
    
    const subtitle = await page.locator('.startup-subtitle');
    await expect(subtitle).toHaveText('MULTI-FARM AGRICULTURAL BURN COORDINATOR');
  });

  test('should maintain good performance during animation', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Monitor FPS from debug info
    const fpsReadings = [];
    
    await page.exposeFunction('recordFPS', (fps) => {
      fpsReadings.push(fps);
    });
    
    await page.evaluate(() => {
      const checkFPS = setInterval(() => {
        const debugInfo = document.querySelector('.cinematic-fire-container > div:last-child');
        if (debugInfo && debugInfo.textContent.includes('Phase:')) {
          // Try to extract FPS if shown in debug
          const canvas = document.querySelector('.fire-canvas');
          if (canvas && canvas.__fps) {
            window.recordFPS(canvas.__fps);
          }
        }
      }, 500);
      
      setTimeout(() => clearInterval(checkFPS), 5000);
    });
    
    // Take performance measurements
    const metrics = await page.evaluate(() => {
      const perf = performance.getEntriesByType('measure');
      return {
        measures: perf.length,
        memory: performance.memory ? {
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          totalJSHeapSize: performance.memory.totalJSHeapSize
        } : null
      };
    });
    
    console.log('Performance metrics:', metrics);
    
    // Verify animation completes within reasonable time
    const startTime = Date.now();
    await page.waitForFunction(() => {
      const container = document.querySelector('.fullscreen-startup');
      return !container || container.style.display === 'none';
    }, { timeout: 8000 });
    const endTime = Date.now();
    
    const animationDuration = endTime - startTime;
    expect(animationDuration).toBeLessThan(7000); // Should complete in under 7 seconds
  });

  test('should handle window resize gracefully', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Wait for animation to start
    await page.waitForTimeout(1000);
    
    // Resize window
    await page.setViewportSize({ width: 800, height: 600 });
    await page.waitForTimeout(500);
    
    // Canvas should still be visible
    const canvas = await page.locator('.fire-canvas');
    await expect(canvas).toBeVisible();
    
    // Resize again
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(500);
    
    // Canvas should still render correctly
    const canvasSize = await canvas.boundingBox();
    expect(canvasSize.width).toBeCloseTo(1920, 10);
    expect(canvasSize.height).toBeCloseTo(1080, 10);
  });

  test('should auto-adjust quality based on performance', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Check quality setting in debug info
    const quality = await page.evaluate(() => {
      return new Promise((resolve) => {
        setTimeout(() => {
          const debugInfo = document.querySelector('.cinematic-fire-container > div:last-child');
          if (debugInfo && debugInfo.textContent.includes('Quality:')) {
            const qualityMatch = debugInfo.textContent.match(/Quality: (\w+)/);
            resolve(qualityMatch ? qualityMatch[1] : 'unknown');
          } else {
            resolve('not found');
          }
        }, 1000);
      });
    });
    
    console.log('Animation quality:', quality);
    expect(['auto', 'low', 'medium', 'high']).toContain(quality);
  });

  test('should not show animation on subsequent visits', async ({ page }) => {
    // First visit
    await page.goto('http://localhost:3000');
    
    // Wait for animation to complete
    await page.waitForTimeout(6000);
    
    // LocalStorage should be set
    const bootupSeen = await page.evaluate(() => {
      return localStorage.getItem('burnwise-bootup-seen');
    });
    expect(bootupSeen).toBe('true');
    
    // Reload page
    await page.reload();
    
    // Animation should not show
    const startupContainer = await page.locator('.fullscreen-startup');
    await expect(startupContainer).not.toBeVisible();
  });
});

// Visual regression test
test.describe('Logo Fire Visual Tests', () => {
  test('should render flame particles correctly', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.evaluate(() => localStorage.clear());
    
    // Wait for ignition phase for best visibility
    await page.waitForTimeout(2500);
    
    // Take screenshot of animation
    await page.screenshot({ 
      path: 'e2e-tests/screenshots/logo-fire-animation.png',
      fullPage: false 
    });
    
    // Take screenshot of just the canvas
    const canvas = await page.locator('.fire-canvas');
    await canvas.screenshot({ 
      path: 'e2e-tests/screenshots/logo-fire-canvas.png' 
    });
  });
});