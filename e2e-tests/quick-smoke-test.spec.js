// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Quick Smoke Test', () => {
  test('should load the application', async ({ page }) => {
    // Navigate to app
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    
    // Wait for React to mount
    await page.waitForTimeout(3000);
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'smoke-test-screenshot.png', fullPage: true });
    
    // Check if root element exists
    const root = await page.locator('#root');
    await expect(root).toBeVisible();
    
    // Check what's actually rendered
    const bodyText = await page.locator('body').textContent();
    console.log('Page content:', bodyText?.substring(0, 500));
    
    // Check for any error messages
    const errorElements = await page.locator('text=/error|failed|exception/i').count();
    console.log('Error elements found:', errorElements);
    
    // Check if any components loaded
    const hasContent = await page.locator('div').count();
    expect(hasContent).toBeGreaterThan(1);
  });
  
  test('should have navigation elements', async ({ page }) => {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    
    // Check for any navigation-like elements
    const navElements = await page.locator('nav, [role="navigation"], header, .nav, .navigation').count();
    console.log('Navigation elements found:', navElements);
    
    // Check for links
    const links = await page.locator('a').count();
    console.log('Links found:', links);
    
    // Check for buttons
    const buttons = await page.locator('button').count();
    console.log('Buttons found:', buttons);
  });
});