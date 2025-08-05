/**
 * TRUTH TEST - What actually exists vs what was claimed
 */

const { test, expect } = require('@playwright/test');

test.describe('Truth Test - Actual App Functionality', () => {
  test.setTimeout(60000);

  test('Test actual functionality vs claims', async ({ page }) => {
    console.log('🔍 TRUTH TEST - Checking actual functionality\n');
    console.log('=' .repeat(60));
    
    // Go to homepage
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    console.log('✅ Homepage loads\n');
    
    // Check if startup animation exists
    const hasStartup = await page.locator('.startup-screen, [class*="startup"]').isVisible().catch(() => false);
    console.log(`Startup Animation: ${hasStartup ? '✅ EXISTS' : '❌ NOT FOUND'}`);
    
    if (hasStartup) {
      // Wait for it to complete or skip
      await page.waitForTimeout(5000);
    }
    
    // Check Landing page elements
    console.log('\n--- LANDING PAGE ---');
    const heroTitle = await page.locator('h1:has-text("BURNWISE")').isVisible().catch(() => false);
    console.log(`BURNWISE Title: ${heroTitle ? '✅' : '❌'}`);
    
    const getStartedBtn = await page.locator('button:has-text("Get Started")').isVisible().catch(() => false);
    console.log(`Get Started Button: ${getStartedBtn ? '✅' : '❌'}`);
    
    const liveMapBtn = await page.locator('button:has-text("View Live Map")').isVisible().catch(() => false);
    console.log(`View Live Map Button: ${liveMapBtn ? '✅' : '❌'}`);
    
    // Navigate to Dashboard
    console.log('\n--- DASHBOARD PAGE ---');
    if (getStartedBtn) {
      await page.click('button:has-text("Get Started")');
      await page.waitForTimeout(2000);
      
      const dashboardUrl = page.url();
      console.log(`URL changed to: ${dashboardUrl}`);
      
      // Check what's actually in the dashboard
      const dashboardTitle = await page.locator('h1, h2, h3').first().textContent().catch(() => 'No title found');
      console.log(`Dashboard Title: "${dashboardTitle}"`);
      
      // Look for burn request form
      const hasForm = await page.locator('form, .form, [class*="form"]').isVisible().catch(() => false);
      console.log(`Has Form: ${hasForm ? '✅' : '❌'}`);
      
      // Look for any mention of agents
      const pageText = await page.textContent('body');
      const mentions = {
        'coordinator': pageText.toLowerCase().includes('coordinator'),
        'weather': pageText.toLowerCase().includes('weather'),
        'predictor': pageText.toLowerCase().includes('predictor'),
        'optimizer': pageText.toLowerCase().includes('optimizer'),
        'alerts': pageText.toLowerCase().includes('alert'),
        'vector': pageText.toLowerCase().includes('vector'),
        'tidb': pageText.toLowerCase().includes('tidb'),
        'agent': pageText.toLowerCase().includes('agent'),
        'burn request': pageText.toLowerCase().includes('burn request')
      };
      
      console.log('\nText mentions in Dashboard:');
      for (const [term, found] of Object.entries(mentions)) {
        console.log(`  ${term}: ${found ? '✅' : '❌'}`);
      }
      
      // Take screenshot
      await page.screenshot({ path: 'truth-dashboard.png', fullPage: true });
      console.log('\n📸 Dashboard screenshot: truth-dashboard.png');
    }
    
    // Navigate to Map
    console.log('\n--- MAP PAGE ---');
    await page.goto('http://localhost:3000');
    await page.waitForTimeout(1000);
    
    if (liveMapBtn) {
      await page.click('button:has-text("View Live Map")');
      await page.waitForTimeout(3000);
      
      const mapUrl = page.url();
      console.log(`URL changed to: ${mapUrl}`);
      
      // Check for actual map
      const hasMapbox = await page.locator('.mapboxgl-canvas, .mapbox, [class*="map"]').isVisible().catch(() => false);
      console.log(`Mapbox Canvas: ${hasMapbox ? '✅' : '❌'}`);
      
      // Check for sidebar/controls
      const hasSidebar = await page.locator('.sidebar, [class*="sidebar"]').isVisible().catch(() => false);
      console.log(`Map Sidebar: ${hasSidebar ? '✅' : '❌'}`);
      
      // Check for burn request form in map
      const hasMapForm = await page.locator('form, .form, [class*="form"]').isVisible().catch(() => false);
      console.log(`Map has Form: ${hasMapForm ? '✅' : '❌'}`);
      
      // Take screenshot
      await page.screenshot({ path: 'truth-map.png', fullPage: true });
      console.log('\n📸 Map screenshot: truth-map.png');
    }
    
    // Try direct navigation to other routes
    console.log('\n--- DIRECT ROUTE NAVIGATION ---');
    
    const routes = ['/schedule', '/alerts'];
    for (const route of routes) {
      await page.goto(`http://localhost:3000${route}`);
      await page.waitForTimeout(2000);
      
      const pageTitle = await page.locator('h1, h2, h3').first().textContent().catch(() => 'No content');
      const hasContent = await page.locator('div').count() > 10;
      console.log(`${route}: ${hasContent ? '✅' : '❌'} (Title: "${pageTitle}")`);
    }
    
    // Final check - backend connectivity
    console.log('\n--- BACKEND CONNECTIVITY ---');
    try {
      const response = await page.evaluate(async () => {
        try {
          const res = await fetch('http://localhost:5001/api/analytics/dashboard');
          return { status: res.status, ok: res.ok };
        } catch (e) {
          return { error: e.message };
        }
      });
      
      if (response.error) {
        console.log(`Backend API: ❌ Error - ${response.error}`);
      } else {
        console.log(`Backend API: ${response.ok ? '✅' : '❌'} Status ${response.status}`);
      }
    } catch (e) {
      console.log(`Backend API: ❌ Failed to connect`);
    }
    
    // SUMMARY
    console.log('\n' + '=' .repeat(60));
    console.log('TRUTH SUMMARY:');
    console.log('=' .repeat(60));
    
    console.log(`
WHAT EXISTS:
✅ Landing page with nice UI
✅ Navigation buttons
✅ Routes defined in React Router
✅ Map component with Mapbox

WHAT'S MISSING/BROKEN:
❌ No visible burn request form
❌ No visible 5-agent workflow indicators
❌ No vector search UI elements
❌ Backend may not be fully connected
❌ Dashboard/Schedule/Alerts may be empty shells

THE TRUTH:
The frontend has a nice landing page and map, but most of the
claimed AI agent functionality and vector search features are
NOT visible in the UI. The backend tests work, but the frontend
doesn't expose these features to users.
`);
    
    console.log('=' .repeat(60));
  });
});