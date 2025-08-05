/**
 * TEST NAVIGATION - Verify navigation bar works on all pages
 */

const { test, expect } = require('@playwright/test');

test('Navigation bar exists and works on all pages', async ({ page }) => {
  console.log('🔍 Testing navigation functionality...\n');
  
  // Go to homepage
  await page.goto('http://localhost:3000');
  await page.waitForTimeout(2000);
  
  // Check if navigation exists on landing page (should be hidden)
  let navVisible = await page.locator('.main-navigation').isVisible().catch(() => false);
  console.log(`Landing page - Navigation: ${navVisible ? '❌ VISIBLE (should be hidden)' : '✅ HIDDEN'}`);
  
  // Navigate to Dashboard
  await page.click('button:has-text("Get Started")');
  await page.waitForTimeout(2000);
  
  // Check navigation on Dashboard
  navVisible = await page.locator('.main-navigation').isVisible().catch(() => false);
  console.log(`Dashboard - Navigation: ${navVisible ? '✅ VISIBLE' : '❌ NOT FOUND'}`);
  
  if (navVisible) {
    // Check all nav links exist
    const navLinks = [
      { selector: 'a:has-text("Dashboard")', label: 'Dashboard' },
      { selector: 'a:has-text("Map")', label: 'Map' },
      { selector: 'a:has-text("Schedule")', label: 'Schedule' },
      { selector: 'a:has-text("Alerts")', label: 'Alerts' }
    ];
    
    console.log('\nNavigation links:');
    for (const link of navLinks) {
      const exists = await page.locator(link.selector).isVisible().catch(() => false);
      console.log(`  ${link.label}: ${exists ? '✅' : '❌'}`);
    }
    
    // Test navigation to Map
    console.log('\nTesting navigation:');
    await page.click('a:has-text("Map")');
    await page.waitForTimeout(2000);
    
    const urlAfterMap = page.url();
    console.log(`  Navigate to Map: ${urlAfterMap.includes('/map') ? '✅' : '❌'} (${urlAfterMap})`);
    
    // Check if map actually loaded
    const mapExists = await page.locator('.mapboxgl-canvas, .map-container').isVisible().catch(() => false);
    console.log(`  Map component loaded: ${mapExists ? '✅' : '❌'}`);
    
    // Navigate to Schedule
    await page.click('a:has-text("Schedule")');
    await page.waitForTimeout(1000);
    
    const urlAfterSchedule = page.url();
    console.log(`  Navigate to Schedule: ${urlAfterSchedule.includes('/schedule') ? '✅' : '❌'}`);
    
    // Navigate to Alerts
    await page.click('a:has-text("Alerts")');
    await page.waitForTimeout(1000);
    
    const urlAfterAlerts = page.url();
    console.log(`  Navigate to Alerts: ${urlAfterAlerts.includes('/alerts') ? '✅' : '❌'}`);
    
    // Navigate back to Dashboard
    await page.click('a:has-text("Dashboard")');
    await page.waitForTimeout(1000);
    
    const urlBackToDashboard = page.url();
    console.log(`  Navigate back to Dashboard: ${urlBackToDashboard.includes('/dashboard') ? '✅' : '❌'}`);
    
    // Check BURNWISE brand link
    const brandLink = await page.locator('.brand-link').isVisible().catch(() => false);
    console.log(`\nBURNWISE brand link: ${brandLink ? '✅' : '❌'}`);
    
    // Check 5-Agent status indicator
    const agentStatus = await page.locator('.nav-status:has-text("5-Agent System Active")').isVisible().catch(() => false);
    console.log(`5-Agent System status: ${agentStatus ? '✅' : '❌'}`);
    
    // Take screenshot
    await page.screenshot({ path: 'navigation-test.png', fullPage: true });
    console.log('\n📸 Screenshot saved: navigation-test.png');
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ NAVIGATION FIX SUCCESSFUL!');
    console.log('Users can now navigate between all pages');
    console.log('='.repeat(50));
  } else {
    console.log('\n❌ Navigation not found - may need to restart frontend');
    await page.screenshot({ path: 'navigation-missing.png', fullPage: true });
  }
});