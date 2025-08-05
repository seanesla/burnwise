/**
 * REALITY CHECK - What's actually in the app vs what was claimed
 */

const { test, expect } = require('@playwright/test');

test.describe('Reality Check - What Actually Exists', () => {
  test.setTimeout(60000);

  test('Check what actually exists in the app', async ({ page }) => {
    console.log('🔍 REALITY CHECK - Testing what actually exists...\n');
    
    // Try to navigate to the app
    try {
      await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30000 });
      console.log('✅ App loads at localhost:3000');
    } catch (error) {
      console.log('❌ App does not load:', error.message);
      return;
    }
    
    // Take a screenshot of what's actually there
    await page.screenshot({ path: 'reality-check-homepage.png', fullPage: true });
    console.log('📸 Screenshot saved: reality-check-homepage.png\n');
    
    // Check for claimed features
    console.log('CHECKING CLAIMED FEATURES:\n');
    
    // 1. Check for burn request form
    console.log('1. Burn Request Form:');
    const requestBurnButton = page.locator('text=/Request Burn/i').first();
    if (await requestBurnButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('   ✅ "Request Burn" button exists');
      await requestBurnButton.click();
      await page.waitForTimeout(2000);
      
      const formExists = await page.locator('.burn-request-form, form').isVisible().catch(() => false);
      console.log(`   ${formExists ? '✅' : '❌'} Burn request form exists`);
      
      if (formExists) {
        // Check for form fields
        const fields = ['farmName', 'fieldName', 'acreage', 'cropType'];
        for (const field of fields) {
          const fieldExists = await page.locator(`[name="${field}"], #${field}, [placeholder*="${field}"]`).isVisible().catch(() => false);
          console.log(`   ${fieldExists ? '✅' : '❌'} Field "${field}" exists`);
        }
      }
    } else {
      console.log('   ❌ No "Request Burn" button found');
    }
    
    // 2. Check for Dashboard
    console.log('\n2. Dashboard:');
    const dashboardLink = page.locator('text=/Dashboard/i').first();
    if (await dashboardLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('   ✅ Dashboard link exists');
      await dashboardLink.click();
      await page.waitForTimeout(2000);
      
      const dashboardExists = await page.locator('.dashboard-container, .dashboard, [class*="dashboard"]').isVisible().catch(() => false);
      console.log(`   ${dashboardExists ? '✅' : '❌'} Dashboard container exists`);
      
      // Check for claimed vector features
      const vectorIndicator = await page.locator('text=/vector|VEC_COSINE/i').isVisible().catch(() => false);
      console.log(`   ${vectorIndicator ? '✅' : '❌'} Vector indicators visible`);
    } else {
      console.log('   ❌ No Dashboard link found');
    }
    
    // 3. Check for Map
    console.log('\n3. Map Integration:');
    const mapLink = page.locator('text=/Map/i').first();
    if (await mapLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('   ✅ Map link exists');
      await mapLink.click();
      await page.waitForTimeout(2000);
      
      const mapExists = await page.locator('.mapboxgl-canvas, .map-container, [class*="map"]').isVisible().catch(() => false);
      console.log(`   ${mapExists ? '✅' : '❌'} Map component exists`);
    } else {
      console.log('   ❌ No Map link found');
    }
    
    // 4. Check for Schedule
    console.log('\n4. Schedule:');
    const scheduleLink = page.locator('text=/Schedule/i').first();
    if (await scheduleLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('   ✅ Schedule link exists');
      await scheduleLink.click();
      await page.waitForTimeout(2000);
      
      const scheduleExists = await page.locator('.schedule-container, .schedule, [class*="schedule"]').isVisible().catch(() => false);
      console.log(`   ${scheduleExists ? '✅' : '❌'} Schedule container exists`);
    } else {
      console.log('   ❌ No Schedule link found');
    }
    
    // 5. Check for Alerts
    console.log('\n5. Alerts:');
    const alertsLink = page.locator('text=/Alerts/i').first();
    if (await alertsLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('   ✅ Alerts link exists');
      await alertsLink.click();
      await page.waitForTimeout(2000);
      
      const alertsExists = await page.locator('.alerts-panel, .alerts, [class*="alert"]').isVisible().catch(() => false);
      console.log(`   ${alertsExists ? '✅' : '❌'} Alerts panel exists`);
    } else {
      console.log('   ❌ No Alerts link found');
    }
    
    // 6. Check for 5-agent indicators
    console.log('\n6. 5-Agent System:');
    const agentIndicators = [
      'coordinator', 'weather', 'predictor', 'optimizer', 'alerts',
      'agent', 'Agent', 'AGENT'
    ];
    
    let foundAgents = false;
    for (const indicator of agentIndicators) {
      if (await page.locator(`text=/${indicator}/i`).isVisible().catch(() => false)) {
        console.log(`   ✅ Found "${indicator}" indicator`);
        foundAgents = true;
        break;
      }
    }
    if (!foundAgents) {
      console.log('   ❌ No agent indicators found in UI');
    }
    
    // 7. Check for startup animation
    console.log('\n7. Startup Animation:');
    await page.goto('http://localhost:3000');
    const startupScreen = await page.locator('[data-testid="startup-screen"], .startup-animation, [class*="startup"]').isVisible().catch(() => false);
    console.log(`   ${startupScreen ? '✅' : '❌'} Startup animation exists`);
    
    // 8. Check page source for key terms
    console.log('\n8. Page Content Analysis:');
    const pageContent = await page.content();
    
    const keyTerms = {
      'TiDB': pageContent.includes('TiDB'),
      'vector': pageContent.includes('vector') || pageContent.includes('Vector'),
      'burn': pageContent.includes('burn') || pageContent.includes('Burn'),
      'farm': pageContent.includes('farm') || pageContent.includes('Farm'),
      'smoke': pageContent.includes('smoke') || pageContent.includes('Smoke'),
      'agricultural': pageContent.includes('agricultural') || pageContent.includes('Agricultural')
    };
    
    for (const [term, found] of Object.entries(keyTerms)) {
      console.log(`   ${found ? '✅' : '❌'} Term "${term}" found in page`);
    }
    
    // Final summary
    console.log('\n' + '='.repeat(60));
    console.log('REALITY CHECK SUMMARY:');
    console.log('='.repeat(60));
    
    const allElements = await page.locator('*').count();
    console.log(`Total elements on page: ${allElements}`);
    
    // Get all visible text
    const visibleText = await page.evaluate(() => {
      return document.body.innerText.substring(0, 500);
    });
    
    console.log('\nFirst 500 chars of visible text:');
    console.log(visibleText);
    
    console.log('\n' + '='.repeat(60));
    console.log('END REALITY CHECK');
    console.log('='.repeat(60));
  });
});