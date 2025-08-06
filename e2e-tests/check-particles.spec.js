const { test, expect } = require('@playwright/test');

test.describe('Check tsParticles Particles', () => {
  test('verify particles are rendering', async ({ page }) => {
    // Clear localStorage and navigate
    await page.goto('http://localhost:3000');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    
    // Wait for tsParticles to initialize
    await page.waitForTimeout(3000);
    
    // Check particle state
    const particleInfo = await page.evaluate(() => {
      const container = window.tsParticles ? window.tsParticles.domItem(0) : null;
      
      if (!container) {
        return { error: 'No container found' };
      }
      
      // Try to manually start if not started
      if (!container.started) {
        container.start();
      }
      
      return {
        started: container.started,
        destroyed: container.destroyed,
        paused: container.paused,
        particleCount: container.particles.count,
        canvasSize: {
          width: container.canvas.size.width,
          height: container.canvas.size.height
        },
        actualOptions: {
          autoPlay: container.actualOptions.autoPlay,
          backgroundMode: container.actualOptions.backgroundMode,
          particlesNumber: container.actualOptions.particles?.number?.value,
          particlesMove: container.actualOptions.particles?.move?.enable
        },
        fpsLimit: container.fpsLimit,
        retina: container.retina
      };
    });
    
    console.log('Particle Info:', particleInfo);
    
    // Wait a bit more and check again
    await page.waitForTimeout(2000);
    
    const particleInfoAfter = await page.evaluate(() => {
      const container = window.tsParticles ? window.tsParticles.domItem(0) : null;
      return container ? {
        particleCount: container.particles.count,
        started: container.started
      } : null;
    });
    
    console.log('Particle Info After Wait:', particleInfoAfter);
    
    // Take screenshot
    await page.screenshot({ path: 'e2e-tests/particles-check.png', fullPage: false });
    
    // Check canvas pixel data
    const canvasPixels = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return null;
      
      const ctx = canvas.getContext('2d');
      const imageData = ctx.getImageData(0, 0, 100, 100); // Sample 100x100 area
      const pixels = imageData.data;
      
      let nonBlackCount = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i] > 0 || pixels[i+1] > 0 || pixels[i+2] > 0) {
          nonBlackCount++;
        }
      }
      
      return {
        totalPixels: pixels.length / 4,
        nonBlackPixels: nonBlackCount,
        percentNonBlack: (nonBlackCount / (pixels.length / 4)) * 100
      };
    });
    
    console.log('Canvas Pixels:', canvasPixels);
  });
});