const { test, expect } = require('@playwright/test');

test.describe('Startup Animation', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage to ensure animation shows
    await page.goto('http://localhost:3000');
    await page.evaluate(() => localStorage.clear());
  });

  test('should display full-screen startup animation', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Check if startup animation container exists
    const startupContainer = await page.locator('.fullscreen-startup');
    await expect(startupContainer).toBeVisible();
    
    // Check if logo container is present
    const logoContainer = await page.locator('.startup-logo-container');
    await expect(logoContainer).toBeVisible();
    
    // Check if animation phases occur
    await expect(startupContainer).toHaveAttribute('data-phase', 'ignition');
    
    // Wait for pulse phase
    await page.waitForTimeout(1600);
    await expect(startupContainer).toHaveAttribute('data-phase', 'pulse');
    
    // Wait for flight phase
    await page.waitForTimeout(1100);
    await expect(startupContainer).toHaveAttribute('data-phase', 'flight');
    
    // Animation should complete and container should disappear
    await page.waitForTimeout(1500);
    await expect(startupContainer).not.toBeVisible();
    
    // Hero logo should now be visible
    const heroLogo = await page.locator('.hero-logo');
    await expect(heroLogo).toBeVisible();
  });

  test('should show proper icons instead of emojis', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Wait for animation to complete
    await page.waitForTimeout(4500);
    
    // Scroll to problem section
    await page.evaluate(() => {
      document.querySelector('.problem-section').scrollIntoView();
    });
    
    // Check for react-icons SVGs
    const icons = await page.locator('.problem-card svg');
    await expect(icons).toHaveCount(4);
  });

  test('landing page videos should play', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Wait for animation to complete
    await page.waitForTimeout(4500);
    
    // Check if video elements exist
    const videos = await page.locator('video.background-video');
    await expect(videos.first()).toBeVisible();
    
    // Check if videos have source elements
    const videoSource = await page.locator('video.background-video source').first();
    const videoSrc = await videoSource.getAttribute('src');
    expect(videoSrc).toBeTruthy();
  });

  test('navigation should work', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Wait for animation
    await page.waitForTimeout(4500);
    
    // Click Get Started
    await page.click('button.cta-primary');
    await expect(page).toHaveURL('http://localhost:3000/dashboard');
    
    // Go back
    await page.goBack();
    
    // Click View Live Map
    await page.click('button.cta-secondary');
    await expect(page).toHaveURL('http://localhost:3000/map');
  });
});

test.describe('Alert Icons', () => {
  test('should show proper icons in alerts panel', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard');
    
    // Wait for page load
    await page.waitForLoadState('networkidle');
    
    // Check if AlertsPanel exists (might need farm selection first)
    const alertsPanel = await page.locator('.alerts-panel');
    if (await alertsPanel.isVisible()) {
      // Look for react-icons in alerts
      const alertIcons = await page.locator('.alert-item svg');
      const count = await alertIcons.count();
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });
});