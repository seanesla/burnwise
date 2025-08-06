const { test, expect } = require('@playwright/test');

test.describe('Test Fixed Animation', () => {
  test('verify animation completes and transitions to landing', async ({ page }) => {
    // Clear localStorage to ensure animation shows
    await page.goto('http://localhost:3000');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    
    // Check animation is visible
    await page.waitForSelector('.actual-fire-container', { timeout: 5000 });
    console.log('✅ Animation container found');
    
    // Check if actual logo is being used
    const hasLogo = await page.evaluate(() => {
      const logoElement = document.querySelector('.burnwise-logo');
      const svgElement = document.querySelector('.burnwise-logo svg');
      return {
        hasLogoClass: !!logoElement,
        hasSvg: !!svgElement,
        svgViewBox: svgElement?.getAttribute('viewBox'),
        hasFlames: document.querySelectorAll('.flame-path').length
      };
    });
    
    console.log('Logo check:', hasLogo);
    
    // Take screenshot of animation
    await page.screenshot({ path: 'e2e-tests/animation-with-logo.png' });
    
    // Wait for animation to complete (should take 6 seconds)
    console.log('Waiting for animation to complete...');
    await page.waitForTimeout(7000);
    
    // Check if animation has disappeared and landing page is visible
    const animationGone = await page.evaluate(() => {
      const animationContainer = document.querySelector('.actual-fire-container');
      const landingContent = document.querySelector('.landing-content');
      return {
        animationExists: !!animationContainer,
        landingVisible: !!landingContent,
        localStorage: localStorage.getItem('burnwise-bootup-seen')
      };
    });
    
    console.log('After animation:', animationGone);
    
    // Take screenshot of landing page
    await page.screenshot({ path: 'e2e-tests/after-animation.png' });
    
    // Verify animation completed properly
    expect(animationGone.animationExists).toBe(false);
    expect(animationGone.landingVisible).toBe(true);
    expect(animationGone.localStorage).toBe('true');
  });
});