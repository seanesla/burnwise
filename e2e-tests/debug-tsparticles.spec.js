const { test, expect } = require('@playwright/test');

test.describe('Debug tsParticles v3', () => {
  test('check tsParticles v3 initialization and particles', async ({ page }) => {
    // Navigate and clear storage
    await page.goto('http://localhost:3000');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    
    // Wait for tsParticles to initialize
    await page.waitForTimeout(1000);
    
    // Check if tsParticles is initialized
    const tsParticlesInfo = await page.evaluate(() => {
      const container = window.tsParticles ? window.tsParticles.domItem(0) : null;
      if (!container) return { error: 'No container found' };
      
      // Get detailed info
      return {
        containerExists: true,
        started: container.started,
        destroyed: container.destroyed,
        paused: container.paused,
        actualOptions: {
          background: container.actualOptions?.background?.color?.value,
          fpsLimit: container.actualOptions?.fpsLimit,
          particlesNumber: container.actualOptions?.particles?.number?.value,
          particlesColor: container.actualOptions?.particles?.color?.value,
          emittersCount: container.actualOptions?.emitters?.length || 0
        },
        canvas: {
          width: container.canvas?.element?.width,
          height: container.canvas?.element?.height,
          contextType: container.canvas?.context ? 'exists' : 'missing'
        },
        particles: {
          count: container.particles?.count || 0,
          array: container.particles?.array?.length || 0
        },
        emitters: {
          array: container.emitters?.array?.length || 0
        }
      };
    });
    
    console.log('Initial State:', JSON.stringify(tsParticlesInfo, null, 2));
    
    // Wait for particles to spawn
    await page.waitForTimeout(3000);
    
    // Check particles after wait
    const particlesAfter = await page.evaluate(() => {
      const container = window.tsParticles ? window.tsParticles.domItem(0) : null;
      if (!container) return null;
      
      const particles = container.particles?.array || [];
      const firstFive = particles.slice(0, 5);
      
      return {
        totalCount: particles.length,
        emittersStarted: container.emitters?.array?.map(e => ({
          started: e.started,
          position: { x: e.position?.x, y: e.position?.y },
          rate: e.emitRate
        })),
        firstFiveParticles: firstFive.map(p => ({
          position: { x: p.position?.x, y: p.position?.y },
          velocity: { x: p.velocity?.x, y: p.velocity?.y },
          color: {
            value: p.color?.value,
            rgb: p.color?.rgb,
            hsl: p.color?.hsl
          },
          opacity: p.opacity?.value,
          size: p.size?.value,
          destroyed: p.destroyed
        }))
      };
    });
    
    console.log('After 3s:', JSON.stringify(particlesAfter, null, 2));
    
    // Take screenshot
    await page.screenshot({ path: 'e2e-tests/debug-tsparticles.png' });
    
    // Check actual canvas pixels
    const canvasData = await page.evaluate(() => {
      const canvas = document.querySelector('#tsparticles-fire canvas');
      if (!canvas) return { error: 'No canvas found' };
      
      const ctx = canvas.getContext('2d');
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      let nonBlackCount = 0;
      let colorSamples = [];
      
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        
        if (r > 0 || g > 0 || b > 0) {
          nonBlackCount++;
          
          // Sample first 5 non-black pixels
          if (colorSamples.length < 5) {
            colorSamples.push({ r, g, b, a });
          }
        }
      }
      
      return {
        totalPixels: data.length / 4,
        nonBlackPixels: nonBlackCount,
        percentage: ((nonBlackCount / (data.length / 4)) * 100).toFixed(2) + '%',
        colorSamples
      };
    });
    
    console.log('Canvas Analysis:', JSON.stringify(canvasData, null, 2));
    
    // Expect at least some particles
    expect(particlesAfter.totalCount).toBeGreaterThan(0);
  });
});