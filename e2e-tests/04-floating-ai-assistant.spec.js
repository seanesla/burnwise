/**
 * BURNWISE Phase 5: Floating AI Assistant Tests
 * Tests the draggable AI chat bubble with glass morphism
 * Facebook Messenger-style floating interface
 */

const { test, expect } = require('@playwright/test');

test.describe('Floating AI Assistant - Draggable Chat', () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    // Login with real test user
    await page.goto('http://localhost:3000/login');
    await page.fill('input[type="email"]', 'robert@goldenfields.com');
    await page.fill('input[type="password"]', 'TestPassword123!');
    await page.click('button:has-text("Sign In")');
    
    // Handle onboarding if it appears
    const onboardingUrl = await page.url();
    if (onboardingUrl.includes('onboarding')) {
      // Skip onboarding
      await page.click('button:has-text("Skip Setup")');
    }
    
    // Wait for spatial interface
    await page.waitForURL('**/spatial');
    await page.waitForLoadState('networkidle');
  });

  test('Floating AI bubble appears and is draggable', async ({ page }) => {
    console.log('💬 Testing floating AI assistant...');
    
    // Find floating AI component
    const floatingAI = page.locator('.floating-ai, .ai-bubble, [data-testid="floating-ai"]');
    await expect(floatingAI).toBeVisible();
    
    // Verify glass morphism styling
    const styles = await floatingAI.evaluate(el => {
      const computed = window.getComputedStyle(el);
      return {
        backdropFilter: computed.backdropFilter,
        background: computed.background,
        borderRadius: computed.borderRadius
      };
    });
    
    expect(styles.backdropFilter).toContain('blur');
    console.log('✅ Glass morphism effect applied');
    
    // Test dragging
    const box = await floatingAI.boundingBox();
    const initialX = box.x;
    const initialY = box.y;
    
    // Drag to new position
    await page.mouse.move(box.x + box.width / 2, box.y + 10);
    await page.mouse.down();
    await page.mouse.move(box.x + 200, box.y + 100);
    await page.mouse.up();
    
    // Verify position changed
    const newBox = await floatingAI.boundingBox();
    expect(newBox.x).not.toBe(initialX);
    expect(newBox.y).not.toBe(initialY);
    console.log('✅ AI bubble is draggable');
  });

  test('AI chat opens and closes with smooth animations', async ({ page }) => {
    console.log('🎭 Testing open/close animations...');
    
    const floatingAI = page.locator('.floating-ai, .ai-bubble');
    
    // Click to open if minimized
    const toggleButton = floatingAI.locator('.ai-toggle, .bubble-toggle, button').first();
    await toggleButton.click();
    
    // Wait for expansion animation
    await page.waitForTimeout(500);
    
    // Check if chat interface is visible
    const chatInterface = page.locator('.ai-chat-interface, .chat-content, .ai-messages');
    await expect(chatInterface).toBeVisible();
    
    // Verify input field is available
    const chatInput = page.locator('.ai-input, .chat-input, input[placeholder*="Type"], textarea[placeholder*="Type"]');
    await expect(chatInput).toBeVisible();
    
    // Test minimize
    const minimizeButton = page.locator('.minimize-btn, .close-chat, [aria-label*="minimize"], [aria-label*="close"]');
    if (await minimizeButton.count() > 0) {
      await minimizeButton.click();
      await page.waitForTimeout(500);
      
      // Chat should be hidden but bubble still visible
      await expect(chatInterface).toBeHidden();
      await expect(floatingAI).toBeVisible();
      console.log('✅ Smooth open/close animations working');
    }
  });

  test('AI responds to natural language burn requests', async ({ page }) => {
    console.log('🗣️ Testing natural language processing...');
    
    // Open AI chat
    const floatingAI = page.locator('.floating-ai, .ai-bubble');
    await floatingAI.click();
    
    // Find chat input
    const chatInput = page.locator('.ai-input, .chat-input, input[placeholder*="Type"], textarea[placeholder*="Type"]');
    await chatInput.waitFor({ state: 'visible' });
    
    // Type natural language request
    const request = "I need to schedule a 75-acre wheat burn for next Tuesday morning";
    await chatInput.fill(request);
    
    // Send message
    const sendButton = page.locator('.send-btn, button[type="submit"], button:has-text("Send")');
    await sendButton.click();
    
    // Wait for AI response
    const aiResponse = page.locator('.ai-message, .assistant-message, .bot-message').last();
    await expect(aiResponse).toBeVisible({ timeout: 30000 });
    
    const responseText = await aiResponse.textContent();
    
    // Verify response relates to burn request
    const hasRelevantResponse = 
      responseText.toLowerCase().includes('burn') ||
      responseText.toLowerCase().includes('schedule') ||
      responseText.toLowerCase().includes('tuesday') ||
      responseText.toLowerCase().includes('wheat') ||
      responseText.toLowerCase().includes('acres');
    
    expect(hasRelevantResponse).toBeTruthy();
    console.log('✅ AI processes natural language requests');
  });

  test('Chat maintains context across messages', async ({ page }) => {
    console.log('🧠 Testing context awareness...');
    
    // Open AI chat
    const floatingAI = page.locator('.floating-ai, .ai-bubble');
    await floatingAI.click();
    
    const chatInput = page.locator('.ai-input, .chat-input, input[placeholder*="Type"], textarea[placeholder*="Type"]');
    const sendButton = page.locator('.send-btn, button[type="submit"], button:has-text("Send")');
    
    // First message - establish context
    await chatInput.fill("My farm is Golden Fields, 500 acres total");
    await sendButton.click();
    
    // Wait for response
    await page.waitForSelector('.ai-message, .assistant-message', { timeout: 30000 });
    
    // Second message - reference context
    await chatInput.fill("What's the maximum I can burn at once?");
    await sendButton.click();
    
    // Wait for contextual response
    const responses = page.locator('.ai-message, .assistant-message');
    const lastResponse = await responses.last().textContent();
    
    // Response should reference the farm or acreage
    const hasContext = 
      lastResponse.toLowerCase().includes('golden fields') ||
      lastResponse.toLowerCase().includes('500') ||
      lastResponse.toLowerCase().includes('your farm');
    
    expect(hasContext).toBeTruthy();
    console.log('✅ AI maintains conversation context');
  });

  test('Floating position persists across page interactions', async ({ page }) => {
    console.log('📍 Testing position persistence...');
    
    const floatingAI = page.locator('.floating-ai, .ai-bubble');
    
    // Drag to specific position
    const box = await floatingAI.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + 10);
    await page.mouse.down();
    await page.mouse.move(300, 300);
    await page.mouse.up();
    
    // Get new position
    const movedBox = await floatingAI.boundingBox();
    const movedPosition = { x: movedBox.x, y: movedBox.y };
    
    // Interact with map (pan/zoom)
    const map = page.locator('.mapboxgl-canvas');
    await map.click();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowDown');
    
    // Verify AI bubble stayed in place
    const currentBox = await floatingAI.boundingBox();
    expect(Math.abs(currentBox.x - movedPosition.x)).toBeLessThan(5);
    expect(Math.abs(currentBox.y - movedPosition.y)).toBeLessThan(5);
    
    console.log('✅ Position persists during map interactions');
  });

  test('NO emojis in AI interface - uses AnimatedFlameLogo', async ({ page }) => {
    console.log('🔥 Verifying no emojis, only AnimatedFlameLogo...');
    
    // Open AI chat
    const floatingAI = page.locator('.floating-ai, .ai-bubble');
    await floatingAI.click();
    
    // Check for AnimatedFlameLogo component
    const flameLogo = page.locator('.animated-flame-logo, .flame-logo, svg.flame');
    expect(await flameLogo.count()).toBeGreaterThan(0);
    
    // Verify no emoji characters in UI text
    const allText = await floatingAI.textContent();
    
    // Common emojis that should NOT be present
    const prohibitedEmojis = ['🔥', '💬', '🤖', '✨', '🚀', '⚡', '🎯', '👍', '😊'];
    prohibitedEmojis.forEach(emoji => {
      expect(allText).not.toContain(emoji);
    });
    
    console.log('✅ No emojis found - AnimatedFlameLogo used consistently');
  });
});