const { test, expect } = require('@playwright/test');

test.describe('Demo Flow', () => {
  test('Demo button navigates to demo initializer', async ({ page }) => {
    // Go to login page
    await page.goto('http://localhost:3000/login');
    
    // Click "Try Demo" button
    await page.click('button:has-text("Try Demo")');
    
    // Should navigate to demo initializer
    await page.waitForURL('**/demo/initialize');
    expect(page.url()).toContain('/demo/initialize');
    
    // Should see demo mode selection
    await expect(page.locator('h1')).toContainText('Choose Your Demo Experience');
    await expect(page.locator('text=Blank Slate Demo')).toBeVisible();
    await expect(page.locator('text=Sample Farm Demo')).toBeVisible();
  });

  test('Blank slate demo goes to simplified onboarding', async ({ page }) => {
    // Go directly to demo initializer
    await page.goto('http://localhost:3000/demo/initialize');
    
    // Select blank slate mode
    await page.click('text=Blank Slate Demo');
    
    // Click start button
    await page.click('button:has-text("Start Blank Slate Demo")');
    
    // Wait for initialization
    await page.waitForURL('**/onboarding?demo=blank', { timeout: 10000 });
    
    // Should be on onboarding with demo mode
    expect(page.url()).toContain('/onboarding?demo=blank');
    
    // Should see demo farm setup header
    await expect(page.locator('h1')).toContainText('Demo Farm Setup');
    
    // Should NOT see owner information fields
    await expect(page.locator('text=Owner Information')).not.toBeVisible();
    
    // Should see farm information fields
    await expect(page.locator('text=Farm Information')).toBeVisible();
  });

  test('Sample farm demo skips onboarding', async ({ page }) => {
    // Go directly to demo initializer
    await page.goto('http://localhost:3000/demo/initialize');
    
    // Select sample farm mode
    await page.click('text=Sample Farm Demo');
    
    // Click start button
    await page.click('button:has-text("Start Sample Farm Demo")');
    
    // Wait for initialization and redirect
    await page.waitForURL('**/demo/spatial', { timeout: 10000 });
    
    // Should be on demo spatial interface
    expect(page.url()).toContain('/demo/spatial');
    
    // Should see spatial interface elements
    await expect(page.locator('.spatial-interface')).toBeVisible({ timeout: 10000 });
  });
});