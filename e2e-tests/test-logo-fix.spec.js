// @ts-check
const { test, expect } = require('@playwright/test');

test('BURNWISE logo text is visible', async ({ page }) => {
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  
  // Take screenshot of current state
  await page.screenshot({ path: 'logo-fix-test.png', fullPage: false });
  
  // Check if BURNWISE text is present and visible
  const heroTitle = page.locator('.hero-title').first();
  await expect(heroTitle).toBeVisible();
  
  // Get the computed styles
  const textColor = await heroTitle.evaluate(el => {
    const styles = window.getComputedStyle(el);
    return {
      color: styles.color,
      backgroundColor: styles.backgroundColor,
      webkitTextFillColor: styles.webkitTextFillColor,
      opacity: styles.opacity,
      visibility: styles.visibility
    };
  });
  
  console.log('Hero title styles:', textColor);
  
  // Check if text content is actually there
  const textContent = await heroTitle.textContent();
  console.log('Hero title text:', textContent);
  
  // Text should contain BURNWISE (with or without spaces/formatting)
  expect(textContent).toMatch(/BURNW.*I.*SE/);
  
  // Check that it's not fully transparent
  expect(textColor.opacity).not.toBe('0');
  expect(textColor.visibility).toBe('visible');
  
  // Check if either the color is set or webkit-text-fill-color is working
  const hasVisibleColor = 
    (textColor.color && textColor.color !== 'rgba(0, 0, 0, 0)') ||
    (textColor.webkitTextFillColor && textColor.webkitTextFillColor !== 'transparent');
    
  console.log('Has visible color:', hasVisibleColor);
});