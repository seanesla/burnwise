const { test, expect } = require('@playwright/test');

test.describe('Inspect Particle Properties', () => {
  test('check individual particle properties', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    
    // Wait for initialization
    await page.waitForTimeout(3000);
    
    // Get detailed particle info
    const particleDetails = await page.evaluate(() => {
      const container = window.tsParticles ? window.tsParticles.domItem(0) : null;
      if (!container) return null;
      
      const particlesArray = container.particles?.array || container.particles?._array || [];
      const particles = particlesArray.slice(0, 5); // Get first 5 particles
      
      return {
        containerBackground: container.actualOptions.background?.color?.value,
        canvasElement: {
          width: container.canvas.element?.width,
          height: container.canvas.element?.height,
          style: container.canvas.element?.style?.cssText
        },
        firstFiveParticles: particles.map(p => ({
          position: { x: p.position.x, y: p.position.y },
          color: p.color?.value || p.color?.rgb,
          opacity: p.opacity?.value,
          size: p.size?.value,
          destroyed: p.destroyed,
          visible: p.visible !== false,
          strokeColor: p.stroke?.color?.value
        }))
      };
    });
    
    console.log('Container Background:', particleDetails?.containerBackground);
    console.log('Canvas Element:', particleDetails?.canvasElement);
    console.log('First 5 Particles:');
    particleDetails?.firstFiveParticles?.forEach((p, i) => {
      console.log(`  Particle ${i}:`, p);
    });
    
    // Check the actual canvas drawing context
    const canvasDrawing = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return null;
      
      const ctx = canvas.getContext('2d');
      
      // Sample a larger area
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = imageData.data;
      
      let redPixels = 0;
      let orangePixels = 0;
      let anyNonBlack = 0;
      
      for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const a = pixels[i + 3];
        
        if (r > 0 || g > 0 || b > 0) {
          anyNonBlack++;
        }
        
        if (r > 200 && g < 150 && b < 100) {
          orangePixels++;
        }
        
        if (r > 200 && g < 50 && b < 50) {
          redPixels++;
        }
      }
      
      return {
        totalPixels: pixels.length / 4,
        anyNonBlack,
        orangePixels,
        redPixels,
        fillStyle: ctx.fillStyle,
        globalAlpha: ctx.globalAlpha,
        globalCompositeOperation: ctx.globalCompositeOperation
      };
    });
    
    console.log('Canvas Drawing State:', canvasDrawing);
  });
});