/**
 * QUICK NAV TEST - Check if navigation was added
 */

const { test, expect } = require('@playwright/test');

test('Quick navigation check', async ({ page }) => {
  console.log('Testing navigation...\n');
  
  // Go directly to dashboard
  await page.goto('http://localhost:3000/dashboard');
  await page.waitForTimeout(3000);
  
  // Take screenshot
  await page.screenshot({ path: 'dashboard-with-nav.png', fullPage: true });
  console.log('📸 Dashboard screenshot: dashboard-with-nav.png');
  
  // Check for navigation
  const navExists = await page.locator('.main-navigation').count() > 0;
  console.log(`Navigation exists: ${navExists ? '✅ YES' : '❌ NO'}`);
  
  if (navExists) {
    // Count nav links
    const linkCount = await page.locator('.nav-link').count();
    console.log(`Nav links found: ${linkCount}`);
    
    // Check for BURNWISE brand
    const brandExists = await page.locator('.brand-text:has-text("BURNWISE")').count() > 0;
    console.log(`BURNWISE brand: ${brandExists ? '✅' : '❌'}`);
  }
  
  // Go to map
  await page.goto('http://localhost:3000/map');
  await page.waitForTimeout(3000);
  
  await page.screenshot({ path: 'map-with-nav.png', fullPage: true });
  console.log('\n📸 Map screenshot: map-with-nav.png');
  
  const navOnMap = await page.locator('.main-navigation').count() > 0;
  console.log(`Navigation on Map page: ${navOnMap ? '✅ YES' : '❌ NO'}`);
  
  console.log('\nDone!');
});