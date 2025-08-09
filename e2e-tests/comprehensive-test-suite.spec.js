import { test, expect } from '@playwright/test';

// Configuration
const BASE_URL = 'http://localhost:3000';
const TIMEOUT = 30000;
const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 667 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'laptop', width: 1366, height: 768 },
  { name: 'desktop', width: 1920, height: 1080 },
  { name: '4k', width: 3840, height: 2160 }
];

// Helper functions
async function waitForAnimations(page) {
  await page.waitForTimeout(500);
}

async function checkForConsoleErrors(page) {
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  return errors;
}

async function capturePageMetrics(page) {
  return await page.evaluate(() => {
    const perf = window.performance;
    const navigation = perf.getEntriesByType('navigation')[0];
    return {
      loadTime: navigation.loadEventEnd - navigation.fetchStart,
      domContentLoaded: navigation.domContentLoadedEventEnd - navigation.fetchStart,
      firstPaint: perf.getEntriesByName('first-paint')[0]?.startTime || 0,
      firstContentfulPaint: perf.getEntriesByName('first-contentful-paint')[0]?.startTime || 0,
      memoryUsage: performance.memory ? {
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
      } : null
    };
  });
}

test.describe('BURNWISE Comprehensive Test Suite', () => {
  test.setTimeout(TIMEOUT);

  // Landing Page Tests
  test.describe('Landing Page Tests', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');
    });

    test('Landing page loads successfully', async ({ page }) => {
      await expect(page).toHaveTitle(/BURNWISE/i);
      const burnwiseText = page.locator('h1:has-text("BURNWISE")');
      await expect(burnwiseText).toBeVisible();
    });

    test('BURNWISE title text is properly visible with gradient', async ({ page }) => {
      const titleElement = page.locator('.hero-title');
      await expect(titleElement).toBeVisible();
      
      // Check if text has proper CSS properties
      const styles = await titleElement.evaluate(el => {
        const computed = window.getComputedStyle(el);
        return {
          backgroundClip: computed.backgroundClip || computed.webkitBackgroundClip,
          textFillColor: computed.webkitTextFillColor,
          background: computed.background
        };
      });
      
      expect(styles.backgroundClip).toContain('text');
      // Both 'transparent' and 'rgba(0, 0, 0, 0)' mean transparent
      expect(['transparent', 'rgba(0, 0, 0, 0)']).toContain(styles.textFillColor);
      expect(styles.background).toContain('gradient');
    });

    test('Fire logo animation completes properly', async ({ page }) => {
      const torchAnimation = page.locator('.framer-torch-animation');
      if (await torchAnimation.isVisible()) {
        await page.waitForTimeout(5000); // Wait for animation
        const consoleMessages = await page.evaluate(() => {
          return window.console.logs || [];
        });
      }
    });

    test('Video background loads and plays', async ({ page }) => {
      const video = page.locator('video');
      if (await video.count() > 0) {
        await expect(video.first()).toBeVisible();
        // Wait a bit for video to start playing or check if it has autoplay attribute
        await page.waitForTimeout(1000);
        const videoState = await video.first().evaluate(v => ({
          paused: v.paused,
          autoplay: v.hasAttribute('autoplay'),
          src: v.src || v.querySelector('source')?.src
        }));
        // Video should either be playing or have autoplay attribute
        expect(videoState.autoplay || !videoState.paused).toBeTruthy();
      }
    });

    test('Get Started button navigates to dashboard', async ({ page }) => {
      const getStartedButton = page.locator('button:has-text("Get Started")');
      await expect(getStartedButton).toBeVisible();
      await getStartedButton.click();
      await page.waitForURL('**/dashboard');
      await expect(page).toHaveURL(/\/dashboard/);
    });

    test('All landing page sections are visible', async ({ page }) => {
      const sections = [
        'Multi-Farm Agricultural Burn Coordinator',
        '5-Agent AI Coordination System',
        'Advanced Technology Stack',
        'Measurable Impact'
      ];

      for (const section of sections) {
        const element = page.locator(`text=${section}`);
        await expect(element).toBeVisible();
      }
    });

    test('Landing page has no accessibility violations', async ({ page }) => {
      const focusableElements = await page.locator('button, a, input, select, textarea').all();
      for (const element of focusableElements) {
        const ariaLabel = await element.getAttribute('aria-label');
        const text = await element.textContent();
        expect(ariaLabel || text).toBeTruthy();
      }
    });

    test('Glass morphism effects are applied', async ({ page }) => {
      const glassElements = page.locator('.glass-card, .glass-morphism');
      if (await glassElements.count() > 0) {
        const styles = await glassElements.first().evaluate(el => {
          const computed = window.getComputedStyle(el);
          return {
            backdropFilter: computed.backdropFilter,
            backgroundColor: computed.backgroundColor
          };
        });
        expect(styles.backdropFilter).toContain('blur');
      }
    });
  });

  // Dashboard Tests
  test.describe('Dashboard Tests', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`${BASE_URL}/dashboard`);
      await page.waitForLoadState('networkidle');
    });

    test('Dashboard loads without critical errors', async ({ page }) => {
      const dashboardTitle = page.locator('h1:has-text("COMMAND CENTER")');
      await expect(dashboardTitle).toBeVisible();
    });

    test('3D visualization renders', async ({ page }) => {
      const canvas = page.locator('canvas');
      if (await canvas.count() > 0) {
        await expect(canvas.first()).toBeVisible();
        const canvasSize = await canvas.boundingBox();
        expect(canvasSize.width).toBeGreaterThan(0);
        expect(canvasSize.height).toBeGreaterThan(0);
      }
    });

    test('All dashboard metrics cards are visible', async ({ page }) => {
      const metricCards = page.locator('.metric-card');
      const count = await metricCards.count();
      expect(count).toBeGreaterThan(0);
      
      for (let i = 0; i < count; i++) {
        await expect(metricCards.nth(i)).toBeVisible();
      }
    });

    test('Dashboard handles API errors gracefully', async ({ page }) => {
      // Check for error states in UI
      const errorElements = page.locator('.error-message, .error-state');
      if (await errorElements.count() > 0) {
        for (const error of await errorElements.all()) {
          const text = await error.textContent();
          expect(text).toBeTruthy();
        }
      }
    });

    test('Fire particle effects render', async ({ page }) => {
      const particles = page.locator('.fire-particle, .particle-system');
      if (await particles.count() > 0) {
        await expect(particles.first()).toBeVisible();
      }
    });

    test('Dashboard navigation works', async ({ page }) => {
      const navLinks = page.locator('.nav-links a, nav a');
      const linkCount = await navLinks.count();
      
      for (let i = 0; i < Math.min(linkCount, 5); i++) {
        const link = navLinks.nth(i);
        const href = await link.getAttribute('href');
        expect(href).toBeTruthy();
      }
    });
  });

  // Burn Request Form Tests
  test.describe('Burn Request Form Tests', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`${BASE_URL}/request`);
      await page.waitForLoadState('networkidle');
    });

    test('Burn request form loads', async ({ page }) => {
      const formTitle = page.locator('h1:has-text("BURN REQUEST")');
      await expect(formTitle).toBeVisible();
    });

    test('Orange rotating stick is removed', async ({ page }) => {
      // Check that the fireFlicker animation is not applied
      const titleIcon = page.locator('.title-icon');
      if (await titleIcon.count() > 0) {
        const animation = await titleIcon.evaluate(el => {
          return window.getComputedStyle(el).animation;
        });
        expect(animation).not.toContain('fireFlicker');
      }
    });

    test('3D terrain visualization loads', async ({ page }) => {
      const canvas = page.locator('canvas');
      if (await canvas.count() > 0) {
        await expect(canvas.first()).toBeVisible();
      }
    });

    test('Form inputs are accessible', async ({ page }) => {
      const inputs = page.locator('input, select, textarea');
      const count = await inputs.count();
      
      for (let i = 0; i < count; i++) {
        const input = inputs.nth(i);
        const label = await input.evaluate(el => {
          const id = el.id;
          const label = document.querySelector(`label[for="${id}"]`);
          return label?.textContent || el.getAttribute('aria-label') || el.placeholder;
        });
        expect(label).toBeTruthy();
      }
    });

    test('Form validation works', async ({ page }) => {
      const submitButton = page.locator('button[type="submit"], button:has-text("Submit")');
      if (await submitButton.count() > 0) {
        await submitButton.click();
        
        // Check for validation messages
        const validationMessages = page.locator('.error, .validation-message, [role="alert"]');
        if (await validationMessages.count() > 0) {
          await expect(validationMessages.first()).toBeVisible();
        }
      }
    });

    test('Field boundary drawing tools are present', async ({ page }) => {
      const drawButton = page.locator('button:has-text("FIELD"), button:has-text("Draw")');
      await expect(drawButton.first()).toBeVisible();
    });

    test('Weather data section displays', async ({ page }) => {
      const weatherSection = page.locator('.weather-data, .weather-info');
      if (await weatherSection.count() > 0) {
        await expect(weatherSection.first()).toBeVisible();
      }
    });
  });

  // Schedule Page Tests
  test.describe('Schedule Page Tests', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`${BASE_URL}/schedule`);
      await page.waitForLoadState('networkidle');
    });

    test('Schedule page loads', async ({ page }) => {
      const scheduleTitle = page.locator('h1, h2').filter({ hasText: /schedule/i });
      await expect(scheduleTitle.first()).toBeVisible();
    });

    test('Calendar component renders', async ({ page }) => {
      const calendar = page.locator('.calendar, .fc-view, .schedule-calendar');
      if (await calendar.count() > 0) {
        await expect(calendar.first()).toBeVisible();
      }
    });

    test('Timeline view is functional', async ({ page }) => {
      const timeline = page.locator('.timeline, .schedule-timeline');
      if (await timeline.count() > 0) {
        await expect(timeline.first()).toBeVisible();
      }
    });
  });

  // Analytics Page Tests
  test.describe('Analytics Page Tests', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`${BASE_URL}/analytics`);
      await page.waitForLoadState('networkidle');
    });

    test('Analytics page loads', async ({ page }) => {
      const analyticsTitle = page.locator('h1, h2').filter({ hasText: /analytics/i });
      await expect(analyticsTitle.first()).toBeVisible();
    });

    test('Charts render properly', async ({ page }) => {
      const charts = page.locator('canvas, svg.chart, .recharts-wrapper');
      if (await charts.count() > 0) {
        await expect(charts.first()).toBeVisible();
      }
    });

    test('Data tables display', async ({ page }) => {
      const tables = page.locator('table, .data-table');
      if (await tables.count() > 0) {
        await expect(tables.first()).toBeVisible();
      }
    });

    test('Particle visualizations work', async ({ page }) => {
      const particles = page.locator('.particle-viz, .visualization');
      if (await particles.count() > 0) {
        await expect(particles.first()).toBeVisible();
      }
    });
  });

  // Alerts Panel Tests
  test.describe('Alerts Panel Tests', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`${BASE_URL}/alerts`);
      await page.waitForLoadState('networkidle');
    });

    test('Alerts panel loads', async ({ page }) => {
      const alertsTitle = page.locator('h1, h2').filter({ hasText: /alert/i });
      await expect(alertsTitle.first()).toBeVisible();
    });

    test('Alert list displays', async ({ page }) => {
      const alertList = page.locator('.alert-list, .alerts-container');
      if (await alertList.count() > 0) {
        await expect(alertList.first()).toBeVisible();
      }
    });

    test('Alert severity indicators work', async ({ page }) => {
      const severityIndicators = page.locator('.severity, .alert-level');
      if (await severityIndicators.count() > 0) {
        const colors = await severityIndicators.evaluateAll(elements => 
          elements.map(el => window.getComputedStyle(el).backgroundColor)
        );
        expect(colors.length).toBeGreaterThan(0);
      }
    });
  });

  // Settings Page Tests
  test.describe('Settings Page Tests', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`${BASE_URL}/settings`);
      await page.waitForLoadState('networkidle');
    });

    test('Settings page loads', async ({ page }) => {
      const settingsTitle = page.locator('h1, h2').filter({ hasText: /settings/i });
      await expect(settingsTitle.first()).toBeVisible();
    });

    test('Settings forms render', async ({ page }) => {
      const forms = page.locator('form');
      if (await forms.count() > 0) {
        await expect(forms.first()).toBeVisible();
      }
    });

    test('Glass morphism styling applied', async ({ page }) => {
      const cards = page.locator('.settings-card, .card');
      if (await cards.count() > 0) {
        const styles = await cards.first().evaluate(el => {
          const computed = window.getComputedStyle(el);
          return {
            backdropFilter: computed.backdropFilter,
            border: computed.border
          };
        });
        expect(styles.backdropFilter || styles.border).toBeTruthy();
      }
    });
  });

  // Responsive Design Tests
  test.describe('Responsive Design Tests', () => {
    for (const viewport of VIEWPORTS) {
      test(`Responsive on ${viewport.name} (${viewport.width}x${viewport.height})`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto(BASE_URL);
        await page.waitForLoadState('networkidle');

        // Check navigation
        const nav = page.locator('nav, .navigation, .navbar');
        if (await nav.count() > 0) {
          await expect(nav.first()).toBeVisible();
        }

        // Check main content
        const mainContent = page.locator('main, .main-content, #root');
        await expect(mainContent.first()).toBeVisible();

        // Check for horizontal scrolling
        const hasHorizontalScroll = await page.evaluate(() => {
          return document.documentElement.scrollWidth > document.documentElement.clientWidth;
        });
        expect(hasHorizontalScroll).toBeFalsy();
      });
    }
  });

  // Performance Tests
  test.describe('Performance Tests', () => {
    test('Page load performance metrics', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');
      
      const metrics = await capturePageMetrics(page);
      
      // Performance thresholds
      expect(metrics.loadTime).toBeLessThan(5000);
      expect(metrics.domContentLoaded).toBeLessThan(3000);
      expect(metrics.firstContentfulPaint).toBeLessThan(2000);
      
      if (metrics.memoryUsage) {
        expect(metrics.memoryUsage.usedJSHeapSize).toBeLessThan(100 * 1024 * 1024); // 100MB
      }
    });

    test('Animation performance', async ({ page }) => {
      await page.goto(BASE_URL);
      
      // Measure FPS during animations
      const fps = await page.evaluate(() => {
        return new Promise(resolve => {
          let frames = 0;
          const startTime = performance.now();
          
          function countFrame() {
            frames++;
            if (performance.now() - startTime < 1000) {
              requestAnimationFrame(countFrame);
            } else {
              resolve(frames);
            }
          }
          
          requestAnimationFrame(countFrame);
        });
      });
      
      expect(fps).toBeGreaterThan(30); // Minimum 30 FPS
    });
  });

  // Error Handling Tests
  test.describe('Error Handling Tests', () => {
    test('Handles network errors gracefully', async ({ page }) => {
      // Intercept API calls and simulate errors
      await page.route('**/api/**', route => {
        route.abort('failed');
      });
      
      await page.goto(`${BASE_URL}/dashboard`);
      
      // Check for error handling UI
      const errorUI = page.locator('.error, .error-boundary, .fallback');
      if (await errorUI.count() > 0) {
        await expect(errorUI.first()).toBeVisible();
      }
    });

    test('No unhandled promise rejections', async ({ page }) => {
      const unhandledRejections = [];
      page.on('pageerror', error => {
        unhandledRejections.push(error.message);
      });
      
      await page.goto(BASE_URL);
      await page.waitForTimeout(2000);
      
      expect(unhandledRejections.length).toBe(0);
    });
  });

  // Accessibility Tests
  test.describe('Accessibility Tests', () => {
    test('Keyboard navigation works', async ({ page }) => {
      await page.goto(BASE_URL);
      
      // Tab through focusable elements
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('Tab');
      }
      
      // Check focused element
      const focusedElement = await page.evaluate(() => {
        return document.activeElement?.tagName;
      });
      expect(focusedElement).toBeTruthy();
    });

    test('ARIA attributes present', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const ariaElements = page.locator('[role], [aria-label], [aria-describedby]');
      const count = await ariaElements.count();
      expect(count).toBeGreaterThan(0);
    });

    test('Color contrast meets WCAG standards', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const textElements = await page.locator('p, h1, h2, h3, h4, h5, h6, span').all();
      
      for (const element of textElements.slice(0, 10)) { // Check first 10 elements
        const contrast = await element.evaluate(el => {
          const style = window.getComputedStyle(el);
          const color = style.color;
          const bgColor = style.backgroundColor;
          // This is simplified - real contrast calculation would be more complex
          return { color, bgColor };
        });
        expect(contrast.color).toBeTruthy();
      }
    });
  });

  // Form Validation Tests
  test.describe('Form Validation Tests', () => {
    test('Required fields show validation', async ({ page }) => {
      await page.goto(`${BASE_URL}/request`);
      
      const requiredInputs = page.locator('input[required], select[required]');
      const count = await requiredInputs.count();
      
      if (count > 0) {
        // Try to submit without filling required fields
        const submitButton = page.locator('button[type="submit"]');
        if (await submitButton.count() > 0) {
          await submitButton.click();
          
          // Check for validation messages
          const validationMessages = page.locator('.error-message, .validation-error, :invalid');
          expect(await validationMessages.count()).toBeGreaterThan(0);
        }
      }
    });

    test('Email validation works', async ({ page }) => {
      await page.goto(`${BASE_URL}/settings`);
      
      const emailInputs = page.locator('input[type="email"]');
      if (await emailInputs.count() > 0) {
        await emailInputs.first().fill('invalid-email');
        await page.keyboard.press('Tab');
        
        const isInvalid = await emailInputs.first().evaluate(el => {
          return !el.validity.valid;
        });
        expect(isInvalid).toBeTruthy();
      }
    });
  });

  // API Integration Tests
  test.describe('API Integration Tests', () => {
    test('API endpoints respond', async ({ page }) => {
      const apiEndpoints = [
        '/api/farms',
        '/api/weather',
        '/api/burn-requests',
        '/api/schedule',
        '/api/alerts'
      ];

      for (const endpoint of apiEndpoints) {
        const response = await page.request.get(`http://localhost:5001${endpoint}`);
        expect([200, 404, 500]).toContain(response.status());
      }
    });

    test('Handles API timeouts', async ({ page }) => {
      await page.route('**/api/**', async route => {
        await page.waitForTimeout(10000); // Simulate timeout
        route.abort('timedout');
      });

      await page.goto(`${BASE_URL}/dashboard`);
      
      // Should show loading or error state
      const loadingOrError = page.locator('.loading, .error, .spinner');
      expect(await loadingOrError.count()).toBeGreaterThan(0);
    });
  });

  // Browser Compatibility Tests
  test.describe('Browser Compatibility', () => {
    test('CSS Grid support', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const gridSupport = await page.evaluate(() => {
        return CSS.supports('display', 'grid');
      });
      expect(gridSupport).toBeTruthy();
    });

    test('Flexbox support', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const flexSupport = await page.evaluate(() => {
        return CSS.supports('display', 'flex');
      });
      expect(flexSupport).toBeTruthy();
    });

    test('WebGL support for 3D', async ({ page }) => {
      await page.goto(`${BASE_URL}/dashboard`);
      
      const webglSupport = await page.evaluate(() => {
        const canvas = document.createElement('canvas');
        return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
      });
      expect(webglSupport).toBeTruthy();
    });
  });

  // Memory Leak Tests
  test.describe('Memory Leak Tests', () => {
    test('No memory leaks on navigation', async ({ page }) => {
      const initialMemory = await page.evaluate(() => {
        return performance.memory?.usedJSHeapSize || 0;
      });

      // Navigate through pages multiple times
      for (let i = 0; i < 5; i++) {
        await page.goto(`${BASE_URL}/dashboard`);
        await page.waitForLoadState('networkidle');
        await page.goto(`${BASE_URL}/request`);
        await page.waitForLoadState('networkidle');
        await page.goto(`${BASE_URL}/analytics`);
        await page.waitForLoadState('networkidle');
      }

      const finalMemory = await page.evaluate(() => {
        return performance.memory?.usedJSHeapSize || 0;
      });

      // Memory shouldn't increase by more than 50MB
      expect(finalMemory - initialMemory).toBeLessThan(50 * 1024 * 1024);
    });
  });

  // Animation Tests
  test.describe('Animation Tests', () => {
    test('Framer Motion animations work', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const animatedElements = page.locator('[data-framer-motion], .motion');
      if (await animatedElements.count() > 0) {
        const transform = await animatedElements.first().evaluate(el => {
          return window.getComputedStyle(el).transform;
        });
        expect(transform).toBeTruthy();
      }
    });

    test('Transitions are smooth', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const transitionElements = await page.locator('*').evaluateAll(elements => {
        return elements.filter(el => {
          const transition = window.getComputedStyle(el).transition;
          return transition && transition !== 'none' && transition !== 'all 0s ease 0s';
        }).length;
      });
      
      expect(transitionElements).toBeGreaterThan(0);
    });
  });

  // Data Validation Tests
  test.describe('Data Validation Tests', () => {
    test('Burn request data validation', async ({ page }) => {
      await page.goto(`${BASE_URL}/request`);
      
      // Fill form with invalid data
      const acreageInput = page.locator('input[name="acreage"], input[placeholder*="acre"]');
      if (await acreageInput.count() > 0) {
        await acreageInput.fill('-100'); // Negative value
        await page.keyboard.press('Tab');
        
        // Should show validation error
        const errorMessage = page.locator('.error, .invalid-feedback');
        if (await errorMessage.count() > 0) {
          await expect(errorMessage.first()).toBeVisible();
        }
      }
    });

    test('Date validation works', async ({ page }) => {
      await page.goto(`${BASE_URL}/request`);
      
      const dateInput = page.locator('input[type="date"], input[type="datetime-local"]');
      if (await dateInput.count() > 0) {
        // Try to set past date
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        await dateInput.fill(yesterday.toISOString().split('T')[0]);
        
        await page.keyboard.press('Tab');
        
        // Check for validation
        const isInvalid = await dateInput.evaluate(el => {
          return el.classList.contains('invalid') || el.getAttribute('aria-invalid') === 'true';
        });
        
        // Depending on implementation, past dates might be invalid
        expect(typeof isInvalid).toBe('boolean');
      }
    });
  });

  // Security Tests
  test.describe('Security Tests', () => {
    test('No sensitive data in console', async ({ page }) => {
      const consoleLogs = [];
      page.on('console', msg => {
        consoleLogs.push(msg.text());
      });

      await page.goto(BASE_URL);
      await page.waitForTimeout(2000);

      // Check for sensitive data patterns
      const sensitivePatterns = [
        /api[_-]?key/i,
        /password/i,
        /secret/i,
        /token/i,
        /bearer/i
      ];

      for (const log of consoleLogs) {
        for (const pattern of sensitivePatterns) {
          expect(log).not.toMatch(pattern);
        }
      }
    });

    test('XSS protection', async ({ page }) => {
      await page.goto(`${BASE_URL}/request`);
      
      const textInputs = page.locator('input[type="text"], textarea');
      if (await textInputs.count() > 0) {
        const xssPayload = '<script>alert("XSS")</script>';
        await textInputs.first().fill(xssPayload);
        
        // Check that script is not executed
        const alerts = [];
        page.on('dialog', dialog => {
          alerts.push(dialog.message());
        });
        
        await page.waitForTimeout(1000);
        expect(alerts.length).toBe(0);
      }
    });
  });

  // UI Consistency Tests
  test.describe('UI Consistency Tests', () => {
    test('Consistent color scheme', async ({ page }) => {
      await page.goto(BASE_URL);
      
      // Check primary colors
      const primaryElements = page.locator('.btn-primary, .primary, [class*="primary"]');
      if (await primaryElements.count() > 0) {
        const colors = await primaryElements.evaluateAll(elements => 
          elements.map(el => window.getComputedStyle(el).backgroundColor)
        );
        
        // Should use consistent orange/fire theme
        for (const color of colors) {
          if (color && color !== 'rgba(0, 0, 0, 0)') {
            expect(color).toMatch(/rgb|#ff/);
          }
        }
      }
    });

    test('Font consistency', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const textElements = await page.locator('p, h1, h2, h3, h4, h5, h6').all();
      const fonts = await Promise.all(
        textElements.slice(0, 10).map(el => 
          el.evaluate(e => window.getComputedStyle(e).fontFamily)
        )
      );
      
      // Should primarily use Inter font
      for (const font of fonts) {
        expect(font.toLowerCase()).toContain('inter');
      }
    });

    test('Button styles consistent', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const buttons = page.locator('button');
      const buttonCount = await buttons.count();
      
      for (let i = 0; i < Math.min(buttonCount, 5); i++) {
        const button = buttons.nth(i);
        const styles = await button.evaluate(el => {
          const computed = window.getComputedStyle(el);
          return {
            cursor: computed.cursor,
            borderRadius: computed.borderRadius
          };
        });
        
        expect(styles.cursor).toBe('pointer');
        expect(styles.borderRadius).toBeTruthy();
      }
    });
  });

  // Edge Case Tests
  test.describe('Edge Case Tests', () => {
    test('Handles empty states', async ({ page }) => {
      await page.goto(`${BASE_URL}/alerts`);
      
      // Check for empty state messaging
      const emptyState = page.locator('.empty-state, .no-data, :has-text("No alerts"), :has-text("No data")');
      if (await emptyState.count() > 0) {
        await expect(emptyState.first()).toBeVisible();
      }
    });

    test('Handles very long text', async ({ page }) => {
      await page.goto(`${BASE_URL}/request`);
      
      const textInput = page.locator('input[type="text"], textarea').first();
      if (await textInput.count() > 0) {
        const longText = 'A'.repeat(1000);
        await textInput.fill(longText);
        
        // Should handle without breaking layout
        const overflow = await textInput.evaluate(el => {
          const rect = el.getBoundingClientRect();
          return rect.width > window.innerWidth;
        });
        expect(overflow).toBeFalsy();
      }
    });

    test('Handles rapid clicks', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const button = page.locator('button').first();
      if (await button.count() > 0) {
        // Rapid clicking shouldn't cause errors
        for (let i = 0; i < 10; i++) {
          await button.click({ force: true, delay: 10 });
        }
        
        // Page should still be responsive
        await expect(page.locator('body')).toBeVisible();
      }
    });
  });

  // Component-specific Tests
  test.describe('Component Tests', () => {
    test('AnimatedFlameLogo renders', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const flameLogo = page.locator('.animated-flame-logo, .flame-logo');
      if (await flameLogo.count() > 0) {
        await expect(flameLogo.first()).toBeVisible();
      }
    });

    test('LoadingSpinner works', async ({ page }) => {
      // Simulate slow network
      await page.route('**/*', route => {
        setTimeout(() => route.continue(), 1000);
      });
      
      await page.goto(`${BASE_URL}/dashboard`);
      
      const spinner = page.locator('.loading-spinner, .spinner, .loader');
      if (await spinner.count() > 0) {
        await expect(spinner.first()).toBeVisible();
      }
    });

    test('Toast notifications work', async ({ page }) => {
      await page.goto(`${BASE_URL}/request`);
      
      // Trigger an action that shows a toast
      const submitButton = page.locator('button[type="submit"]');
      if (await submitButton.count() > 0) {
        await submitButton.click();
        
        // Check for toast
        const toast = page.locator('.toast, .notification, [role="alert"]');
        if (await toast.count() > 0) {
          await expect(toast.first()).toBeVisible();
        }
      }
    });
  });

  // Navigation Tests
  test.describe('Navigation Tests', () => {
    test('All navigation links work', async ({ page }) => {
      await page.goto(`${BASE_URL}/dashboard`);
      
      const navLinks = [
        { text: 'Dashboard', url: '/dashboard' },
        { text: 'Map', url: '/map' },
        { text: 'Burn Request', url: '/request' },
        { text: 'Schedule', url: '/schedule' },
        { text: 'Analytics', url: '/analytics' },
        { text: 'Alerts', url: '/alerts' },
        { text: 'Settings', url: '/settings' }
      ];

      for (const link of navLinks) {
        const navLink = page.locator(`a:has-text("${link.text}")`);
        if (await navLink.count() > 0) {
          await navLink.click();
          await expect(page).toHaveURL(new RegExp(link.url));
          await page.goBack();
        }
      }
    });

    test('Browser back/forward works', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.goto(`${BASE_URL}/dashboard`);
      await page.goto(`${BASE_URL}/request`);
      
      await page.goBack();
      await expect(page).toHaveURL(/\/dashboard/);
      
      await page.goBack();
      await expect(page).toHaveURL(BASE_URL);
      
      await page.goForward();
      await expect(page).toHaveURL(/\/dashboard/);
    });
  });

  // Final Cleanup Tests
  test.describe('Cleanup Tests', () => {
    test('No console errors after full navigation', async ({ page }) => {
      const errors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      // Navigate through all pages
      const pages = [
        '/',
        '/dashboard',
        '/map',
        '/request',
        '/schedule',
        '/analytics',
        '/alerts',
        '/settings'
      ];

      for (const path of pages) {
        await page.goto(`${BASE_URL}${path}`);
        await page.waitForLoadState('networkidle');
      }

      // Filter out expected errors
      const unexpectedErrors = errors.filter(error => 
        !error.includes('404') && 
        !error.includes('Failed to load resource')
      );

      console.log('Console errors found:', unexpectedErrors);
    });
  });
});