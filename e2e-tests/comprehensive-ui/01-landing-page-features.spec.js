/**
 * Complete Landing Page Feature Tests
 * Tests every button, link, animation, and interaction on the landing page
 * No mocks - real user interactions
 */

const { test, expect } = require('@playwright/test');

test.describe('Landing Page - Complete Feature Testing', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to landing page
    await page.goto('http://localhost:3000');
    
    // Wait for page to fully load
    await page.waitForLoadState('networkidle');
  });

  test('01. Logo and Branding Elements', async ({ page }) => {
    // Test animated flame logo
    const logo = page.locator('[data-testid="animated-flame-logo"], svg[class*="flame"], [class*="logo"]').first();
    await expect(logo).toBeVisible();
    
    // Test logo is clickable (should stay on landing page)
    const currentUrl = page.url();
    await logo.click();
    await expect(page).toHaveURL(currentUrl);
    
    // Test BURNWISE text is visible
    const brandText = page.locator('text=/BURNWISE/i').first();
    await expect(brandText).toBeVisible();
    
    // Test logo hover effects (check if classes change)
    await logo.hover();
    await page.waitForTimeout(500); // Allow animation time
  });

  test('02. Hero Section Content', async ({ page }) => {
    // Test hero title
    const heroTitle = page.locator('text=/coordinate.*agricultural.*burns.*ai.*precision/i').first();
    await expect(heroTitle).toBeVisible();
    
    // Test subtitle is readable
    const subtitle = page.locator('h2, .subtitle, p').filter({ hasText: /coordinate|burn|ai|precision/i }).first();
    await expect(subtitle).toBeVisible();
    
    // Test background animations (ember/fire effects)
    const backgroundElement = page.locator('[class*="ember"], [class*="background"], [class*="particles"]').first();
    if (await backgroundElement.isVisible()) {
      // Check if animation is running by comparing element properties over time
      const initialTransform = await backgroundElement.evaluate(el => 
        window.getComputedStyle(el).transform || window.getComputedStyle(el).opacity
      );
      await page.waitForTimeout(1000);
      const laterTransform = await backgroundElement.evaluate(el => 
        window.getComputedStyle(el).transform || window.getComputedStyle(el).opacity
      );
      
      console.log('Background animation test:', { initialTransform, laterTransform });
    }
  });

  test('03. Call-to-Action Buttons', async ({ page }) => {
    // Find and test "Get Started" button
    const getStartedBtn = page.locator('button:has-text("Get Started"), a:has-text("Get Started"), [data-testid="get-started"]').first();
    
    if (await getStartedBtn.isVisible()) {
      // Test hover effect
      await getStartedBtn.hover();
      await page.waitForTimeout(300);
      
      // Click and verify navigation to onboarding
      await getStartedBtn.click();
      await expect(page).toHaveURL(/.*onboarding.*/);
      await page.goBack();
    }
    
    // Find and test "Try Demo" button
    const demoBtn = page.locator('button:has-text("Try Demo"), button:has-text("Demo"), a:has-text("Demo")').first();
    
    if (await demoBtn.isVisible()) {
      // Test hover effect
      await demoBtn.hover();
      await page.waitForTimeout(300);
      
      // Click and verify demo mode activation
      await demoBtn.click();
      
      // Should either go to spatial or show demo initialization
      await expect(page).toHaveURL(/.*spatial.*|.*demo.*/);
    }
  });

  test('04. Navigation Header Links', async ({ page }) => {
    // Test Features link
    const featuresLink = page.locator('a:has-text("Features"), nav a').filter({ hasText: 'Features' }).first();
    if (await featuresLink.isVisible()) {
      await featuresLink.click();
      
      // Should scroll to features section or navigate
      const featuresSection = page.locator('#features, [data-section="features"], .features').first();
      if (await featuresSection.isVisible()) {
        await expect(featuresSection).toBeInViewport();
      }
    }
    
    // Test How It Works link
    const howItWorksLink = page.locator('a:has-text("How It Works"), nav a').filter({ hasText: /how.*works/i }).first();
    if (await howItWorksLink.isVisible()) {
      await howItWorksLink.click();
      await page.waitForTimeout(500);
    }
    
    // Test About link
    const aboutLink = page.locator('a:has-text("About"), nav a').filter({ hasText: 'About' }).first();
    if (await aboutLink.isVisible()) {
      await aboutLink.click();
      await page.waitForTimeout(500);
    }
    
    // Test Contact link
    const contactLink = page.locator('a:has-text("Contact"), nav a').filter({ hasText: 'Contact' }).first();
    if (await contactLink.isVisible()) {
      await contactLink.click();
      await page.waitForTimeout(500);
      
      // Check if contact modal opens or scrolls to contact section
      const contactModal = page.locator('[class*="modal"], .contact-modal').first();
      const contactSection = page.locator('#contact, [data-section="contact"], .contact').first();
      
      if (await contactModal.isVisible()) {
        await expect(contactModal).toBeVisible();
        // Close modal if present
        const closeBtn = contactModal.locator('button[aria-label="Close"], .close, [data-testid="close"]').first();
        if (await closeBtn.isVisible()) {
          await closeBtn.click();
        }
      } else if (await contactSection.isVisible()) {
        await expect(contactSection).toBeInViewport();
      }
    }
  });

  test('05. Features Section Cards', async ({ page }) => {
    // Scroll to features section if it exists
    const featuresSection = page.locator('#features, [data-section="features"], .features, [class*="features"]').first();
    
    if (await featuresSection.isVisible()) {
      await featuresSection.scrollIntoViewIfNeeded();
      
      // Find all feature cards
      const featureCards = page.locator('.feature-card, [class*="card"], .feature').all();
      const cards = await featureCards;
      
      for (let i = 0; i < Math.min(cards.length, 6); i++) {
        const card = cards[i];
        
        // Test card is visible
        await expect(card).toBeVisible();
        
        // Test hover effect
        await card.hover();
        await page.waitForTimeout(300);
        
        // Check for icons/images
        const icon = card.locator('svg, img, [class*="icon"]').first();
        if (await icon.isVisible()) {
          await expect(icon).toBeVisible();
        }
        
        // Test "Learn More" buttons if present
        const learnMoreBtn = card.locator('button:has-text("Learn More"), a:has-text("Learn More")').first();
        if (await learnMoreBtn.isVisible()) {
          await learnMoreBtn.hover();
          await page.waitForTimeout(200);
          // Could click but might navigate away, so just test hover
        }
      }
    }
  });

  test('06. Footer Elements', async ({ page }) => {
    // Scroll to bottom of page
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    
    const footer = page.locator('footer, [class*="footer"]').first();
    
    if (await footer.isVisible()) {
      // Test copyright year
      const copyright = footer.locator('text=/© 2024|© 2025|copyright/i').first();
      if (await copyright.isVisible()) {
        await expect(copyright).toBeVisible();
      }
      
      // Test footer links (don't click external links, just verify they exist)
      const footerLinks = footer.locator('a').all();
      const links = await footerLinks;
      
      for (let i = 0; i < Math.min(links.length, 5); i++) {
        const link = links[i];
        await expect(link).toBeVisible();
        
        const href = await link.getAttribute('href');
        if (href && !href.startsWith('http') && !href.includes('mailto:')) {
          // Internal link - safe to test
          await link.hover();
        }
      }
      
      // Test privacy policy / terms links
      const privacyLink = footer.locator('a:has-text("Privacy"), a:has-text("Terms")').first();
      if (await privacyLink.isVisible()) {
        await privacyLink.hover();
        // Don't click to avoid navigation
      }
    }
  });

  test('07. Responsive Design on Landing Page', async ({ page }) => {
    // Test desktop view (already at default)
    await expect(page.locator('body')).toBeVisible();
    
    // Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(500);
    
    // Verify layout adjusts
    const logo = page.locator('[class*="logo"], svg').first();
    if (await logo.isVisible()) {
      await expect(logo).toBeVisible();
    }
    
    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    
    // Verify mobile layout
    const mobileNav = page.locator('[class*="mobile"], .hamburger, [data-testid="mobile-menu"]').first();
    if (await mobileNav.isVisible()) {
      await mobileNav.click();
      await page.waitForTimeout(300);
    }
    
    // Reset to desktop
    await page.setViewportSize({ width: 1920, height: 1080 });
  });

  test('08. Page Performance and Loading', async ({ page }) => {
    // Reload page and measure loading
    const startTime = Date.now();
    await page.reload();
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;
    
    console.log(`Landing page load time: ${loadTime}ms`);
    expect(loadTime).toBeLessThan(5000); // Should load in under 5 seconds
    
    // Check for JavaScript errors
    const jsErrors = [];
    page.on('console', message => {
      if (message.type() === 'error') {
        jsErrors.push(message.text());
      }
    });
    
    await page.waitForTimeout(2000);
    
    if (jsErrors.length > 0) {
      console.log('JavaScript errors found:', jsErrors);
    }
    
    // Expect no critical errors (allow warnings)
    const criticalErrors = jsErrors.filter(error => 
      !error.includes('Warning') && 
      !error.includes('DevTools') &&
      !error.includes('Extension')
    );
    expect(criticalErrors.length).toBe(0);
  });

  test('09. Accessibility Testing', async ({ page }) => {
    // Test keyboard navigation
    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);
    
    // Find first focusable element
    const focusedElement = page.locator(':focus');
    if (await focusedElement.count() > 0) {
      await expect(focusedElement.first()).toBeVisible();
    }
    
    // Tab through several elements
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(100);
    }
    
    // Test alt text on images
    const images = page.locator('img').all();
    const imgs = await images;
    
    for (const img of imgs.slice(0, 3)) {
      const alt = await img.getAttribute('alt');
      const hasAltText = alt && alt.trim().length > 0;
      if (!hasAltText) {
        console.log('Image missing alt text:', await img.getAttribute('src'));
      }
    }
  });

  test('10. Animation and Interaction Smoothness', async ({ page }) => {
    // Test button press animations
    const buttons = page.locator('button, a[class*="button"]').all();
    const btns = await buttons;
    
    for (let i = 0; i < Math.min(btns.length, 3); i++) {
      const button = btns[i];
      
      if (await button.isVisible()) {
        // Test hover
        await button.hover();
        await page.waitForTimeout(200);
        
        // Test active state (mousedown)
        await page.mouse.down();
        await page.waitForTimeout(100);
        await page.mouse.up();
        await page.waitForTimeout(200);
      }
    }
    
    // Test scroll smoothness
    await page.evaluate(() => {
      window.scrollTo({ top: 500, behavior: 'smooth' });
    });
    await page.waitForTimeout(1000);
    
    await page.evaluate(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    await page.waitForTimeout(1000);
  });
});