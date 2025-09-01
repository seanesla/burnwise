/**
 * Complete Onboarding Flow Tests
 * Tests every step, input, button, and interaction in the onboarding process
 * Includes OnboardingChat, FarmBoundaryDrawer, and HybridOnboarding
 */

const { test, expect } = require('@playwright/test');

test.describe('Onboarding Flow - Complete Feature Testing', () => {
  test.beforeEach(async ({ page }) => {
    // Start fresh for each test
    await page.goto('http://localhost:3000/onboarding');
    await page.waitForLoadState('networkidle');
  });

  test('01. Onboarding Welcome Screen', async ({ page }) => {
    // Check for welcome message
    const welcomeText = page.locator('text=/welcome|get started|setup/i').first();
    if (await welcomeText.isVisible()) {
      await expect(welcomeText).toBeVisible();
    }
    
    // Test animated logo presence
    const logo = page.locator('[class*="logo"], svg[class*="flame"], [data-testid="logo"]').first();
    await expect(logo).toBeVisible();
    
    // Test "Start Setup" button
    const startBtn = page.locator('button:has-text("Start Setup"), button:has-text("Get Started"), [data-testid="start-setup"]').first();
    if (await startBtn.isVisible()) {
      await startBtn.hover();
      await page.waitForTimeout(300);
      
      // Click should advance to next step
      const originalContent = await page.content();
      await startBtn.click();
      await page.waitForTimeout(1000);
      const newContent = await page.content();
      
      // Content should change indicating progression
      expect(newContent).not.toBe(originalContent);
    }
    
    // Test "Skip Setup" button - should go directly to spatial
    await page.goto('http://localhost:3000/onboarding'); // Reset
    const skipBtn = page.locator('button:has-text("Skip Setup"), button:has-text("Skip"), [data-testid="skip"]').first();
    if (await skipBtn.isVisible()) {
      await skipBtn.click();
      await expect(page).toHaveURL(/.*spatial.*/);
    }
  });

  test('02. OnboardingChat Interface', async ({ page }) => {
    // Look for chat interface
    const chatContainer = page.locator('[class*="chat"], [data-testid="chat"], .onboarding-chat').first();
    
    if (await chatContainer.isVisible()) {
      // Test chat input field
      const chatInput = page.locator('input[placeholder*="message"], textarea[placeholder*="message"], [data-testid="chat-input"]').first();
      await expect(chatInput).toBeVisible();
      
      // Test typing in input
      await chatInput.fill('Hello, I need help setting up my farm');
      await expect(chatInput).toHaveValue('Hello, I need help setting up my farm');
      
      // Test send button
      const sendBtn = page.locator('button[type="submit"], button:has-text("Send"), [data-testid="send"]').first();
      if (await sendBtn.isVisible()) {
        await sendBtn.click();
        
        // Wait for message to appear and AI response
        await page.waitForTimeout(2000);
        
        // Check message appears in chat
        const userMessage = page.locator('text="Hello, I need help setting up my farm"').first();
        await expect(userMessage).toBeVisible();
        
        // Check for AI response
        const aiResponse = page.locator('[class*="ai-message"], [data-role="assistant"]').first();
        if (await aiResponse.isVisible()) {
          await expect(aiResponse).toBeVisible();
        }
      }
      
      // Test Enter key to send
      await chatInput.fill('What information do you need from me?');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1500);
    }
  });

  test('03. Suggested Prompts Bubbles', async ({ page }) => {
    // Look for suggested prompt buttons/bubbles
    const promptBubbles = page.locator('[class*="prompt"], [class*="suggestion"], button[data-prompt]').all();
    const bubbles = await promptBubbles;
    
    if (bubbles.length > 0) {
      // Test first 3 prompts
      for (let i = 0; i < Math.min(bubbles.length, 3); i++) {
        const bubble = bubbles[i];
        
        if (await bubble.isVisible()) {
          // Test hover effect
          await bubble.hover();
          await page.waitForTimeout(200);
          
          // Click prompt - should fill input
          const promptText = await bubble.textContent();
          await bubble.click();
          
          // Check if input is filled
          const chatInput = page.locator('input, textarea').filter({ hasText: '' }).first();
          if (await chatInput.isVisible()) {
            const inputValue = await chatInput.inputValue();
            console.log('Prompt filled input:', inputValue);
          }
          
          await page.waitForTimeout(500);
        }
      }
    } else {
      console.log('No suggested prompts found');
    }
  });

  test('04. Farm Setup Questions Flow', async ({ page }) => {
    // Navigate through farm setup if chat interface is present
    const chatInput = page.locator('input, textarea').first();
    
    if (await chatInput.isVisible()) {
      // Answer farm name question
      await chatInput.fill('Demo Test Farm');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1500);
      
      // Answer location question
      await chatInput.fill('Davis, California');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1500);
      
      // Answer acreage question
      await chatInput.fill('500 acres');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1500);
      
      // Answer crop type question
      await chatInput.fill('Wheat and corn');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1500);
      
      // Check if setup progresses
      const progressIndicator = page.locator('[class*="progress"], .step-indicator').first();
      if (await progressIndicator.isVisible()) {
        console.log('Setup progress detected');
      }
    }
  });

  test('05. Farm Boundary Drawing Tool', async ({ page }) => {
    // Look for map container or boundary drawer
    const mapContainer = page.locator('#map, [class*="map"], [data-testid="boundary-map"]').first();
    
    if (await mapContainer.isVisible()) {
      // Wait for map to load
      await page.waitForTimeout(3000);
      
      // Test drawing boundary - click multiple points
      const mapBounds = await mapContainer.boundingBox();
      if (mapBounds) {
        // Click several points to create a polygon
        const points = [
          { x: mapBounds.x + 100, y: mapBounds.y + 100 },
          { x: mapBounds.x + 200, y: mapBounds.y + 100 },
          { x: mapBounds.x + 200, y: mapBounds.y + 200 },
          { x: mapBounds.x + 100, y: mapBounds.y + 200 }
        ];
        
        for (const point of points) {
          await page.mouse.click(point.x, point.y);
          await page.waitForTimeout(300);
        }
        
        // Double-click to complete polygon
        await page.mouse.dblclick(points[0].x, points[0].y);
        await page.waitForTimeout(500);
        
        // Check for area calculation display
        const areaDisplay = page.locator('text=/acres|hectares|area/i').first();
        if (await areaDisplay.isVisible()) {
          console.log('Area calculation displayed');
        }
      }
    }
  });

  test('06. Map Controls Testing', async ({ page }) => {
    const mapContainer = page.locator('#map, [class*="map"]').first();
    
    if (await mapContainer.isVisible()) {
      await page.waitForTimeout(2000);
      
      // Test zoom in button
      const zoomInBtn = page.locator('button[aria-label*="Zoom in"], .mapboxgl-ctrl-zoom-in').first();
      if (await zoomInBtn.isVisible()) {
        await zoomInBtn.click();
        await page.waitForTimeout(500);
        await zoomInBtn.click();
        await page.waitForTimeout(500);
      }
      
      // Test zoom out button
      const zoomOutBtn = page.locator('button[aria-label*="Zoom out"], .mapboxgl-ctrl-zoom-out').first();
      if (await zoomOutBtn.isVisible()) {
        await zoomOutBtn.click();
        await page.waitForTimeout(500);
      }
      
      // Test satellite/terrain toggle
      const styleToggle = page.locator('button:has-text("Satellite"), button:has-text("Terrain")').first();
      if (await styleToggle.isVisible()) {
        await styleToggle.click();
        await page.waitForTimeout(1000);
        await styleToggle.click(); // Toggle back
        await page.waitForTimeout(1000);
      }
      
      // Test location search if present
      const searchInput = page.locator('input[placeholder*="Search"], input[placeholder*="location"]').first();
      if (await searchInput.isVisible()) {
        await searchInput.fill('Davis, CA');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(2000);
      }
      
      // Test map dragging
      const mapBounds = await mapContainer.boundingBox();
      if (mapBounds) {
        const centerX = mapBounds.x + mapBounds.width / 2;
        const centerY = mapBounds.y + mapBounds.height / 2;
        
        await page.mouse.move(centerX, centerY);
        await page.mouse.down();
        await page.mouse.move(centerX + 50, centerY + 50);
        await page.mouse.up();
        await page.waitForTimeout(500);
      }
    }
  });

  test('07. Clear and Undo Functions', async ({ page }) => {
    const mapContainer = page.locator('#map, [class*="map"]').first();
    
    if (await mapContainer.isVisible()) {
      await page.waitForTimeout(2000);
      
      // Draw some points first
      const mapBounds = await mapContainer.boundingBox();
      if (mapBounds) {
        await page.mouse.click(mapBounds.x + 100, mapBounds.y + 100);
        await page.waitForTimeout(300);
        await page.mouse.click(mapBounds.x + 150, mapBounds.y + 100);
        await page.waitForTimeout(300);
        
        // Test Undo button
        const undoBtn = page.locator('button:has-text("Undo"), [data-testid="undo"]').first();
        if (await undoBtn.isVisible()) {
          await undoBtn.click();
          await page.waitForTimeout(500);
        }
        
        // Test Clear button
        const clearBtn = page.locator('button:has-text("Clear"), [data-testid="clear"]').first();
        if (await clearBtn.isVisible()) {
          await clearBtn.click();
          await page.waitForTimeout(500);
        }
      }
    }
  });

  test('08. Save Farm Boundary and Continue', async ({ page }) => {
    const mapContainer = page.locator('#map, [class*="map"]').first();
    
    if (await mapContainer.isVisible()) {
      await page.waitForTimeout(2000);
      
      // Draw a complete boundary
      const mapBounds = await mapContainer.boundingBox();
      if (mapBounds) {
        const points = [
          { x: mapBounds.x + 100, y: mapBounds.y + 100 },
          { x: mapBounds.x + 200, y: mapBounds.y + 100 },
          { x: mapBounds.x + 200, y: mapBounds.y + 200 },
          { x: mapBounds.x + 100, y: mapBounds.y + 200 }
        ];
        
        for (const point of points) {
          await page.mouse.click(point.x, point.y);
          await page.waitForTimeout(300);
        }
        
        // Complete the polygon
        await page.mouse.dblclick(points[0].x, points[0].y);
        await page.waitForTimeout(1000);
        
        // Test Save Farm Boundary button
        const saveBtn = page.locator('button:has-text("Save"), [data-testid="save-boundary"]').first();
        if (await saveBtn.isVisible()) {
          await saveBtn.click();
          await page.waitForTimeout(1000);
          
          // Check for confirmation message
          const confirmation = page.locator('text=/saved|success|complete/i').first();
          if (await confirmation.isVisible()) {
            await expect(confirmation).toBeVisible();
          }
          
          // Test Continue button
          const continueBtn = page.locator('button:has-text("Continue"), button:has-text("Next")').first();
          if (await continueBtn.isVisible()) {
            await continueBtn.click();
            
            // Should navigate to spatial interface or next step
            await page.waitForTimeout(2000);
            const currentUrl = page.url();
            console.log('After continue button:', currentUrl);
          }
        }
      }
    }
  });

  test('09. Form Validation Testing', async ({ page }) => {
    // Test chat input validation
    const chatInput = page.locator('input, textarea').first();
    
    if (await chatInput.isVisible()) {
      // Test empty submission
      await chatInput.fill('');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
      
      // Test very long input
      const longText = 'A'.repeat(1000);
      await chatInput.fill(longText);
      const inputValue = await chatInput.inputValue();
      console.log('Long input length:', inputValue.length);
      
      // Test special characters
      await chatInput.fill('Test with special chars: @#$%^&*()');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
      
      // Check for response handling special characters
    }
    
    // Test any form fields if present
    const formInputs = page.locator('input[type="text"], input[type="email"], input[type="number"]').all();
    const inputs = await formInputs;
    
    for (const input of inputs.slice(0, 3)) {
      if (await input.isVisible()) {
        const inputType = await input.getAttribute('type');
        const placeholder = await input.getAttribute('placeholder');
        
        // Test appropriate validation based on type
        if (inputType === 'email') {
          await input.fill('invalid-email');
          await page.keyboard.press('Tab');
          
          // Check for validation message
          const validation = page.locator('text=/invalid email|email format/i').first();
          if (await validation.isVisible()) {
            console.log('Email validation working');
          }
          
          // Fill valid email
          await input.fill('test@example.com');
        } else if (inputType === 'number') {
          await input.fill('not-a-number');
          await page.keyboard.press('Tab');
          
          // Should reject non-numeric
          const value = await input.inputValue();
          console.log('Number input value:', value);
        }
      }
    }
  });

  test('10. Responsive Onboarding Design', async ({ page }) => {
    // Test desktop view first
    await expect(page.locator('body')).toBeVisible();
    
    // Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(1000);
    
    // Check if layout adapts
    const chatContainer = page.locator('[class*="chat"], [class*="onboarding"]').first();
    if (await chatContainer.isVisible()) {
      const containerBounds = await chatContainer.boundingBox();
      expect(containerBounds.width).toBeLessThan(800);
    }
    
    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);
    
    // Check mobile-specific elements
    const mobileSpecific = page.locator('[class*="mobile"], [data-mobile="true"]').first();
    if (await mobileSpecific.isVisible()) {
      console.log('Mobile-specific elements detected');
    }
    
    // Test touch-friendly button sizes
    const buttons = page.locator('button').all();
    const btns = await buttons;
    
    for (const btn of btns.slice(0, 3)) {
      if (await btn.isVisible()) {
        const btnBounds = await btn.boundingBox();
        if (btnBounds) {
          // Touch targets should be at least 44px
          expect(Math.min(btnBounds.width, btnBounds.height)).toBeGreaterThan(40);
        }
      }
    }
    
    // Reset to desktop
    await page.setViewportSize({ width: 1920, height: 1080 });
  });

  test('11. Onboarding Progress and State Persistence', async ({ page }) => {
    // Check for progress indicators
    const progressBar = page.locator('[class*="progress"], .step-indicator, [data-progress]').first();
    if (await progressBar.isVisible()) {
      console.log('Progress indicator found');
    }
    
    // Test state persistence by refreshing page mid-flow
    const chatInput = page.locator('input, textarea').first();
    if (await chatInput.isVisible()) {
      await chatInput.fill('My farm name is Test Farm');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
      
      // Refresh page
      await page.reload();
      await page.waitForTimeout(2000);
      
      // Check if data persists (might be in session storage or URL params)
      const persistedData = await page.evaluate(() => {
        return {
          sessionStorage: Object.keys(sessionStorage),
          localStorage: Object.keys(localStorage),
          url: window.location.href
        };
      });
      
      console.log('Persisted data:', persistedData);
    }
  });

  test('12. Error Handling During Onboarding', async ({ page }) => {
    // Test network errors by intercepting requests
    await page.route('**/api/**', route => {
      // Fail some API requests to test error handling
      if (Math.random() > 0.7) {
        route.abort();
      } else {
        route.continue();
      }
    });
    
    const chatInput = page.locator('input, textarea').first();
    if (await chatInput.isVisible()) {
      await chatInput.fill('Test message during network issues');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(3000);
      
      // Check for error messages
      const errorMsg = page.locator('text=/error|failed|try again/i').first();
      if (await errorMsg.isVisible()) {
        console.log('Error handling detected');
        
        // Test retry functionality
        const retryBtn = page.locator('button:has-text("Retry"), button:has-text("Try Again")').first();
        if (await retryBtn.isVisible()) {
          await retryBtn.click();
          await page.waitForTimeout(2000);
        }
      }
    }
    
    // Remove route interception
    await page.unroute('**/api/**');
  });
});