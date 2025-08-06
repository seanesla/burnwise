const { test, expect } = require('@playwright/test');

test.describe('Debug Animation', () => {
  test('check what is actually rendering', async ({ page }) => {
    // Clear localStorage
    await page.goto('http://localhost:3000');
    await page.evaluate(() => localStorage.clear());
    
    // Reload to trigger animation
    await page.reload();
    
    // Wait a bit for animation to start
    await page.waitForTimeout(2000);
    
    // Check what's in the DOM
    const hasStartup = await page.locator('.fullscreen-startup').isVisible();
    console.log('Has startup container:', hasStartup);
    
    const hasCanvas = await page.locator('.fire-canvas').isVisible();
    console.log('Has canvas:', hasCanvas);
    
    // Check console errors
    const consoleMessages = [];
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });
    
    // Check for JavaScript errors
    page.on('pageerror', error => {
      console.error('Page error:', error.message);
    });
    
    // Try to get animation info
    const animationInfo = await page.evaluate(() => {
      const startup = document.querySelector('.fullscreen-startup');
      const canvas = document.querySelector('.fire-canvas');
      const fireContainer = document.querySelector('.cinematic-fire-container');
      
      return {
        hasStartup: !!startup,
        startupVisible: startup ? window.getComputedStyle(startup).display !== 'none' : false,
        hasCanvas: !!canvas,
        canvasWidth: canvas ? canvas.width : 0,
        canvasHeight: canvas ? canvas.height : 0,
        hasFireContainer: !!fireContainer,
        localStorage: localStorage.getItem('burnwise-bootup-seen'),
        currentURL: window.location.href
      };
    });
    
    console.log('Animation info:', animationInfo);
    
    // Take screenshot
    await page.screenshot({ path: 'e2e-tests/animation-debug.png', fullPage: false });
    
    // Wait for potential errors
    await page.waitForTimeout(1000);
    
    console.log('Console messages:', consoleMessages);
  });
});