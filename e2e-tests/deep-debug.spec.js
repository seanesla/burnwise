const { test, expect } = require('@playwright/test');

test.describe('Deep Debug tsParticles', () => {
  test('investigate particle container structure', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    
    // Wait for initialization
    await page.waitForTimeout(2000);
    
    // Deep dive into container structure
    const containerStructure = await page.evaluate(() => {
      const container = window.tsParticles ? window.tsParticles.domItem(0) : null;
      if (!container) return { error: 'No container' };
      
      // Check different ways to access particles
      const particlesObj = container.particles;
      
      return {
        hasParticlesObj: !!particlesObj,
        particlesKeys: particlesObj ? Object.keys(particlesObj).filter(k => !k.startsWith('_')) : [],
        particlesCount: particlesObj?.count,
        particlesArrayPresent: !!particlesObj?.array,
        particlesArrayLength: particlesObj?.array?.length,
        particles_arrayPresent: !!particlesObj?._array,
        particles_arrayLength: particlesObj?._array?.length,
        particlesPoolLength: particlesObj?.pool?.length,
        
        // Check if particles are in a different property
        containerKeys: Object.keys(container).filter(k => !k.startsWith('_')),
        
        // Canvas info
        canvasExists: !!container.canvas,
        canvasElement: !!container.canvas?.element,
        canvasContext: !!container.canvas?.context,
        canvasSize: container.canvas?.size ? {
          width: container.canvas.size.width,
          height: container.canvas.size.height
        } : null,
        
        // Get first particle if it exists anywhere
        firstParticle: (() => {
          const arr = particlesObj?.array || particlesObj?._array || particlesObj?.pool || [];
          if (arr && arr.length > 0) {
            const p = arr[0];
            return {
              hasPosition: !!p?.position,
              positionX: p?.position?.x,
              positionY: p?.position?.y,
              hasColor: !!p?.color,
              colorValue: p?.color?.value,
              hasOpacity: !!p?.opacity,
              opacityValue: p?.opacity?.value,
              particleKeys: p ? Object.keys(p).filter(k => !k.startsWith('_')).slice(0, 10) : []
            };
          }
          return null;
        })()
      };
    });
    
    console.log('Container Structure:', JSON.stringify(containerStructure, null, 2));
    
    // Try to manually draw something on the canvas to verify it works
    const canvasTest = await page.evaluate(() => {
      const canvas = document.querySelector('#tsparticles-fire canvas');
      if (!canvas) return { error: 'No canvas element' };
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return { error: 'No context' };
      
      // Draw a test rectangle
      ctx.fillStyle = '#FF0000';
      ctx.fillRect(100, 100, 50, 50);
      
      // Check if it rendered
      const imageData = ctx.getImageData(100, 100, 50, 50);
      const data = imageData.data;
      let redCount = 0;
      
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] > 200) redCount++;
      }
      
      return {
        canvasFound: true,
        contextFound: true,
        testRectangleDrawn: true,
        redPixelsFound: redCount
      };
    });
    
    console.log('Canvas Test:', JSON.stringify(canvasTest, null, 2));
    
    // Check the actual render loop
    const renderInfo = await page.evaluate(() => {
      const container = window.tsParticles ? window.tsParticles.domItem(0) : null;
      if (!container) return null;
      
      return {
        isPlaying: container.play,
        isPaused: container.paused,
        fpsLimit: container.fpsLimit,
        started: container.started,
        destroyed: container.destroyed,
        lastFrameTime: container.lastFrameTime,
        frameDelay: container.frameDelay
      };
    });
    
    console.log('Render Info:', JSON.stringify(renderInfo, null, 2));
  });
});