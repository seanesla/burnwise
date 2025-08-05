const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Clear localStorage
  await page.goto('http://localhost:3000');
  await page.evaluate(() => localStorage.clear());
  
  // Reload to trigger animation
  await page.reload();
  
  // Capture ignition phase
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'startup-ignition.png', fullPage: false });
  
  // Capture pulse phase
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'startup-pulse.png', fullPage: false });
  
  // Capture flight phase
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'startup-flight.png', fullPage: false });
  
  // Capture final state
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'startup-complete.png', fullPage: false });
  
  await browser.close();
  console.log('Screenshots captured!');
})();