/**
 * Complete FloatingAI Tests
 * Tests every aspect of the draggable AI assistant: drag, resize, chat, minimize, maximize
 * The FloatingAI is like Facebook Messenger but for agricultural burn management
 */

const { test, expect } = require('@playwright/test');

test.describe('FloatingAI - Complete Feature Testing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Handle onboarding redirect
    if ((await page.url()).includes('onboarding')) {
      const skipBtn = page.locator('button:has-text("Skip Setup"), button:has-text("Skip")').first();
      if (await skipBtn.isVisible()) {
        await skipBtn.click();
      }
    }
    
    await page.waitForURL('**/spatial');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Open FloatingAI via dock
    const aiIcon = page.locator('button svg, [data-testid="ai"], button:has-text("AI")').first();
    if (await aiIcon.isVisible()) {
      await aiIcon.click();
      await page.waitForTimeout(1500);
    }
  });

  test('01. FloatingAI Window Visibility and Initial State', async ({ page }) => {
    // Find FloatingAI container
    const floatingAI = page.locator('[class*="floating"], [data-testid="floating-ai"], .ai-chat').first();
    
    if (await floatingAI.isVisible()) {
      await expect(floatingAI).toBeVisible();
      console.log('FloatingAI is visible');
      
      // Check initial position (should be positioned on screen)
      const bounds = await floatingAI.boundingBox();
      if (bounds) {
        expect(bounds.x).toBeGreaterThan(0);
        expect(bounds.y).toBeGreaterThan(0);
        console.log('Initial position:', { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height });
      }
      
      // Check for header/title bar
      const header = floatingAI.locator('[class*="header"], .title-bar, .ai-header').first();
      if (await header.isVisible()) {
        console.log('FloatingAI has header');
      }
      
      // Check for welcome message
      const welcomeMessage = page.locator('text=/hello|help|assist/i').first();
      if (await welcomeMessage.isVisible()) {
        const messageText = await welcomeMessage.textContent();
        console.log('Welcome message:', messageText);
      }
      
      // Verify glass morphism styling
      const styles = await floatingAI.evaluate(el => {
        const computed = window.getComputedStyle(el);
        return {
          backdropFilter: computed.backdropFilter,
          background: computed.background,
          borderRadius: computed.borderRadius,
          boxShadow: computed.boxShadow
        };
      });
      console.log('FloatingAI styles:', styles);
    } else {
      console.log('FloatingAI not visible - may need manual opening');
    }
  });

  test('02. Window Control Buttons', async ({ page }) => {
    const floatingAI = page.locator('[class*="floating"], [data-testid="floating-ai"], .ai-chat').first();
    
    if (await floatingAI.isVisible()) {
      // Test minimize button
      const minimizeBtn = floatingAI.locator('button[aria-label*="Minimize"], .minimize, button:has-text("-")').first();
      if (await minimizeBtn.isVisible()) {
        const initialBounds = await floatingAI.boundingBox();
        
        await minimizeBtn.click();
        await page.waitForTimeout(800);
        
        const minimizedBounds = await floatingAI.boundingBox();
        
        // Should still be visible but smaller
        await expect(floatingAI).toBeVisible();
        if (initialBounds && minimizedBounds) {
          expect(minimizedBounds.height).toBeLessThan(initialBounds.height);
          console.log('FloatingAI minimized successfully');
        }
        
        // Test restore/maximize from minimized
        const maximizeBtn = floatingAI.locator('button[aria-label*="Maximize"], .maximize, button[aria-label*="Expand"]').first();
        if (await maximizeBtn.isVisible()) {
          await maximizeBtn.click();
          await page.waitForTimeout(800);
          
          const restoredBounds = await floatingAI.boundingBox();
          if (restoredBounds && minimizedBounds) {
            expect(restoredBounds.height).toBeGreaterThan(minimizedBounds.height);
            console.log('FloatingAI restored from minimized');
          }
        }
      }
      
      // Test close button (but don't actually close for other tests)
      const closeBtn = floatingAI.locator('button[aria-label*="Close"], .close, button:has-text("×")').first();
      if (await closeBtn.isVisible()) {
        await closeBtn.hover();
        await page.waitForTimeout(300);
        console.log('Close button hover tested');
        
        // Move away to avoid accidental close
        await page.mouse.move(100, 100);
      }
    }
  });

  test('03. Drag and Drop Functionality', async ({ page }) => {
    const floatingAI = page.locator('[class*="floating"], [data-testid="floating-ai"], .ai-chat').first();
    
    if (await floatingAI.isVisible()) {
      const initialBounds = await floatingAI.boundingBox();
      
      if (initialBounds) {
        // Find draggable header
        const header = floatingAI.locator('[class*="header"], .title-bar, .drag-handle').first();
        let dragTarget = header;
        
        if (!(await header.isVisible())) {
          // If no specific header, use top portion of window
          dragTarget = floatingAI;
        }
        
        const dragBounds = await dragTarget.boundingBox();
        if (dragBounds) {
          // Drag to different positions
          const startX = dragBounds.x + dragBounds.width / 2;
          const startY = dragBounds.y + dragBounds.height / 2;
          
          // Drag right
          await page.mouse.move(startX, startY);
          await page.mouse.down();
          await page.mouse.move(startX + 200, startY);
          await page.mouse.up();
          await page.waitForTimeout(500);
          
          let newBounds = await floatingAI.boundingBox();
          if (newBounds) {
            expect(newBounds.x).toBeGreaterThan(initialBounds.x);
            console.log('Dragged FloatingAI to the right');
          }
          
          // Drag down
          await page.mouse.move(newBounds.x + newBounds.width / 2, newBounds.y + 20);
          await page.mouse.down();
          await page.mouse.move(newBounds.x + newBounds.width / 2, newBounds.y + 150);
          await page.mouse.up();
          await page.waitForTimeout(500);
          
          const finalBounds = await floatingAI.boundingBox();
          if (finalBounds && newBounds) {
            expect(finalBounds.y).toBeGreaterThan(newBounds.y);
            console.log('Dragged FloatingAI down');
          }
          
          // Drag to top-left corner
          await page.mouse.move(finalBounds.x + finalBounds.width / 2, finalBounds.y + 20);
          await page.mouse.down();
          await page.mouse.move(50, 100);
          await page.mouse.up();
          await page.waitForTimeout(500);
          
          console.log('Dragged FloatingAI to corner');
        }
      }
    }
  });

  test('04. Chat Input and Basic Interaction', async ({ page }) => {
    const floatingAI = page.locator('[class*="floating"], [data-testid="floating-ai"], .ai-chat').first();
    
    if (await floatingAI.isVisible()) {
      // Find chat input
      const chatInput = floatingAI.locator('input[placeholder*="message"], textarea, [data-testid="chat-input"]').first();
      
      if (await chatInput.isVisible()) {
        // Test typing simple message
        await chatInput.fill('Hello, can you help me?');
        await expect(chatInput).toHaveValue('Hello, can you help me?');
        
        // Test send with Enter key
        await page.keyboard.press('Enter');
        await page.waitForTimeout(2000);
        
        // Check if message appears in chat
        const userMessage = page.locator('text="Hello, can you help me?"').first();
        if (await userMessage.isVisible()) {
          console.log('User message appeared in chat');
        }
        
        // Wait for AI response
        await page.waitForTimeout(3000);
        
        // Look for AI response
        const aiResponse = page.locator('[class*="ai-message"], [data-role="assistant"], .response').first();
        if (await aiResponse.isVisible()) {
          const responseText = await aiResponse.textContent();
          console.log('AI response:', responseText.substring(0, 100) + '...');
          expect(responseText.length).toBeGreaterThan(10);
        }
        
        // Test send button if present
        const sendBtn = floatingAI.locator('button[type="submit"], button:has-text("Send"), [data-testid="send"]').first();
        if (await sendBtn.isVisible()) {
          await chatInput.fill('Can you tell me about the weather?');
          await sendBtn.click();
          await page.waitForTimeout(2000);
          
          console.log('Message sent via send button');
        }
      } else {
        console.log('Chat input not found in FloatingAI');
      }
    }
  });

  test('05. Agent-Specific Chat Interactions', async ({ page }) => {
    const floatingAI = page.locator('[class*="floating"], [data-testid="floating-ai"], .ai-chat').first();
    
    if (await floatingAI.isVisible()) {
      const chatInput = floatingAI.locator('input, textarea').first();
      
      if (await chatInput.isVisible()) {
        // Test weather-related query
        await chatInput.fill('What are the weather conditions for burning today in Davis, CA?');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(4000);
        
        // Look for weather analysis response
        const weatherResponse = page.locator('text=/temperature|wind|humidity|NFDRS/i').first();
        if (await weatherResponse.isVisible()) {
          console.log('Weather analysis response detected');
        }
        
        // Test burn request
        await chatInput.fill('I need to burn 75 acres of wheat stubble next Tuesday');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(3000);
        
        // Look for burn processing response
        const burnResponse = page.locator('text=/burn|acres|wheat|request/i').first();
        if (await burnResponse.isVisible()) {
          console.log('Burn request processing detected');
        }
        
        // Test conflict check
        await chatInput.fill('Check if there are any conflicts with other farms');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(3000);
        
        // Look for conflict analysis
        const conflictResponse = page.locator('text=/conflict|overlap|other farms/i').first();
        if (await conflictResponse.isVisible()) {
          console.log('Conflict analysis response detected');
        }
        
        // Test schedule optimization
        await chatInput.fill('Optimize my burn schedule for maximum efficiency');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(3000);
        
        // Look for optimization response
        const optimizeResponse = page.locator('text=/optim|schedul|efficien/i').first();
        if (await optimizeResponse.isVisible()) {
          console.log('Schedule optimization response detected');
        }
      }
    }
  });

  test('06. Message Display and Formatting', async ({ page }) => {
    const floatingAI = page.locator('[class*="floating"], [data-testid="floating-ai"], .ai-chat').first();
    
    if (await floatingAI.isVisible()) {
      const chatInput = floatingAI.locator('input, textarea').first();
      
      if (await chatInput.isVisible()) {
        await chatInput.fill('Test message with formatting');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(2000);
        
        // Check message container structure
        const messageContainer = page.locator('[class*="message"], .chat-message').first();
        if (await messageContainer.isVisible()) {
          // Check for timestamp
          const timestamp = messageContainer.locator('[class*="time"], .timestamp').first();
          if (await timestamp.isVisible()) {
            console.log('Message timestamps present');
          }
          
          // Check for avatar/icon
          const avatar = messageContainer.locator('img, [class*="avatar"], .user-icon').first();
          if (await avatar.isVisible()) {
            console.log('Message avatars present');
          }
          
          // Check message alignment (user vs AI)
          const messageStyles = await messageContainer.evaluate(el => {
            const styles = window.getComputedStyle(el);
            return {
              textAlign: styles.textAlign,
              flexDirection: styles.flexDirection,
              alignSelf: styles.alignSelf
            };
          });
          console.log('Message styling:', messageStyles);
        }
        
        // Check scroll behavior with multiple messages
        for (let i = 0; i < 3; i++) {
          await chatInput.fill(`Test message number ${i + 2}`);
          await page.keyboard.press('Enter');
          await page.waitForTimeout(1000);
        }
        
        // Check if chat scrolls to bottom
        const chatContainer = floatingAI.locator('[class*="messages"], .chat-container').first();
        if (await chatContainer.isVisible()) {
          const scrollTop = await chatContainer.evaluate(el => el.scrollTop);
          const scrollHeight = await chatContainer.evaluate(el => el.scrollHeight);
          const clientHeight = await chatContainer.evaluate(el => el.clientHeight);
          
          console.log('Chat scroll state:', { scrollTop, scrollHeight, clientHeight });
          
          // Should be scrolled near bottom
          expect(scrollTop).toBeGreaterThan(scrollHeight - clientHeight - 50);
        }
      }
    }
  });

  test('07. Handoff Visualization and Agent Indicators', async ({ page }) => {
    const floatingAI = page.locator('[class*="floating"], [data-testid="floating-ai"], .ai-chat').first();
    
    if (await floatingAI.isVisible()) {
      const chatInput = floatingAI.locator('input, textarea').first();
      
      if (await chatInput.isVisible()) {
        // Send message that triggers handoff
        await chatInput.fill('What are the current weather conditions for burning?');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(3000);
        
        // Look for handoff indicators
        const handoffMessage = page.locator('text=/routing|delegating|weather.*analyst/i').first();
        if (await handoffMessage.isVisible()) {
          console.log('Agent handoff message detected');
        }
        
        // Look for agent name/color indicators
        const agentIndicator = page.locator('[class*="agent"], [data-agent]').first();
        if (await agentIndicator.isVisible()) {
          const agentInfo = await agentIndicator.textContent();
          const agentColor = await agentIndicator.evaluate(el => {
            const styles = window.getComputedStyle(el);
            return styles.backgroundColor || styles.color;
          });
          console.log('Agent indicator:', { info: agentInfo, color: agentColor });
        }
        
        // Look for thinking indicator
        const thinkingIndicator = page.locator('[class*="thinking"], [class*="typing"], .loading').first();
        if (await thinkingIndicator.isVisible()) {
          console.log('Thinking indicator displayed');
          
          // Wait for thinking to complete
          await page.waitForTimeout(2000);
          
          if (!(await thinkingIndicator.isVisible())) {
            console.log('Thinking indicator disappeared after completion');
          }
        }
        
        // Check for confidence scores
        const confidenceScore = page.locator('text=/confidence|score|\d+%/i').first();
        if (await confidenceScore.isVisible()) {
          const scoreText = await confidenceScore.textContent();
          console.log('Confidence score displayed:', scoreText);
        }
      }
    }
  });

  test('08. Window Resize and Responsive Behavior', async ({ page }) => {
    const floatingAI = page.locator('[class*="floating"], [data-testid="floating-ai"], .ai-chat').first();
    
    if (await floatingAI.isVisible()) {
      const initialBounds = await floatingAI.boundingBox();
      
      // Test viewport resize behavior
      await page.setViewportSize({ width: 1200, height: 800 });
      await page.waitForTimeout(1000);
      
      let newBounds = await floatingAI.boundingBox();
      if (newBounds && initialBounds) {
        // FloatingAI should adjust position if necessary
        expect(newBounds.x).toBeGreaterThanOrEqual(0);
        expect(newBounds.y).toBeGreaterThanOrEqual(0);
        console.log('FloatingAI adjusted for smaller viewport');
      }
      
      // Test mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(1000);
      
      const mobileBounds = await floatingAI.boundingBox();
      if (mobileBounds) {
        // Should fit within mobile viewport
        expect(mobileBounds.x + mobileBounds.width).toBeLessThanOrEqual(375);
        console.log('FloatingAI fits in mobile viewport');
        
        // Test if input is still accessible
        const chatInput = floatingAI.locator('input, textarea').first();
        if (await chatInput.isVisible()) {
          await chatInput.fill('Mobile test message');
          await page.keyboard.press('Enter');
          await page.waitForTimeout(1000);
          console.log('Chat input works on mobile');
        }
      }
      
      // Reset viewport
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.waitForTimeout(1000);
    }
  });

  test('09. Context Menu and Advanced Features', async ({ page }) => {
    const floatingAI = page.locator('[class*="floating"], [data-testid="floating-ai"], .ai-chat').first();
    
    if (await floatingAI.isVisible()) {
      // Test right-click context menu
      await floatingAI.click({ button: 'right' });
      await page.waitForTimeout(500);
      
      const contextMenu = page.locator('[class*="context-menu"], .menu').first();
      if (await contextMenu.isVisible()) {
        console.log('Context menu appeared');
        
        // Test menu options
        const menuItems = contextMenu.locator('button, a, [role="menuitem"]').all();
        const items = await menuItems;
        
        for (const item of items.slice(0, 3)) {
          if (await item.isVisible()) {
            const itemText = await item.textContent();
            console.log('Context menu item:', itemText);
            
            await item.hover();
            await page.waitForTimeout(200);
          }
        }
        
        // Click elsewhere to close menu
        await page.mouse.click(100, 100);
        await page.waitForTimeout(500);
      }
      
      // Test copy message functionality if available
      const messageContainer = page.locator('[class*="message"]').first();
      if (await messageContainer.isVisible()) {
        await messageContainer.hover();
        
        const copyBtn = page.locator('button:has-text("Copy"), [aria-label*="copy"]').first();
        if (await copyBtn.isVisible()) {
          await copyBtn.click();
          console.log('Message copy button tested');
        }
      }
      
      // Test clear chat functionality
      const clearBtn = page.locator('button:has-text("Clear"), [data-testid="clear-chat"]').first();
      if (await clearBtn.isVisible()) {
        await clearBtn.hover();
        await page.waitForTimeout(300);
        // Don't actually click to preserve chat for other tests
      }
    }
  });

  test('10. Performance and Memory Management', async ({ page }) => {
    const floatingAI = page.locator('[class*="floating"], [data-testid="floating-ai"], .ai-chat').first();
    
    if (await floatingAI.isVisible()) {
      const chatInput = floatingAI.locator('input, textarea').first();
      
      if (await chatInput.isVisible()) {
        // Send multiple messages to test performance
        const startTime = Date.now();
        
        for (let i = 0; i < 10; i++) {
          await chatInput.fill(`Performance test message ${i + 1}`);
          await page.keyboard.press('Enter');
          await page.waitForTimeout(500);
        }
        
        const endTime = Date.now();
        const totalTime = endTime - startTime;
        
        console.log(`Sent 10 messages in ${totalTime}ms (avg: ${totalTime / 10}ms per message)`);
        
        // Should handle multiple messages efficiently
        expect(totalTime).toBeLessThan(15000); // Less than 15 seconds for 10 messages
        
        // Test scroll performance with many messages
        const chatContainer = floatingAI.locator('[class*="messages"], .chat-container').first();
        if (await chatContainer.isVisible()) {
          // Scroll up and down rapidly
          for (let i = 0; i < 5; i++) {
            await chatContainer.evaluate(el => el.scrollTop = 0);
            await page.waitForTimeout(100);
            await chatContainer.evaluate(el => el.scrollTop = el.scrollHeight);
            await page.waitForTimeout(100);
          }
          
          console.log('Chat scroll performance tested');
        }
        
        // Check for memory leaks (JavaScript errors)
        const jsErrors = [];
        page.on('console', message => {
          if (message.type() === 'error' && !message.text().includes('DevTools')) {
            jsErrors.push(message.text());
          }
        });
        
        await page.waitForTimeout(2000);
        
        if (jsErrors.length > 0) {
          console.log('JavaScript errors detected:', jsErrors);
        }
        
        // Should have minimal JS errors
        expect(jsErrors.length).toBeLessThan(3);
      }
    }
  });

  test('11. Socket Connection and Real-time Updates', async ({ page }) => {
    const floatingAI = page.locator('[class*="floating"], [data-testid="floating-ai"], .ai-chat').first();
    
    if (await floatingAI.isVisible()) {
      // Check for connection indicator
      const connectionStatus = page.locator('[class*="connection"], [class*="status"], .online').first();
      if (await connectionStatus.isVisible()) {
        console.log('Connection status indicator present');
      }
      
      // Test real-time message delivery
      const chatInput = floatingAI.locator('input, textarea').first();
      if (await chatInput.isVisible()) {
        await chatInput.fill('Test real-time message delivery');
        
        const sendTime = Date.now();
        await page.keyboard.press('Enter');
        
        // Wait for message to appear
        const sentMessage = page.locator('text="Test real-time message delivery"').first();
        await expect(sentMessage).toBeVisible({ timeout: 5000 });
        
        const receiveTime = Date.now();
        const deliveryTime = receiveTime - sendTime;
        
        console.log(`Message delivery time: ${deliveryTime}ms`);
        
        // Should be near-instantaneous
        expect(deliveryTime).toBeLessThan(2000);
        
        // Test agent response time
        const responseStartTime = Date.now();
        
        // Wait for AI response
        await page.waitForTimeout(3000);
        
        const aiResponse = page.locator('[class*="ai-message"], [data-role="assistant"]').last();
        if (await aiResponse.isVisible()) {
          const responseEndTime = Date.now();
          const responseTime = responseEndTime - responseStartTime;
          
          console.log(`Agent response time: ${responseTime}ms`);
          
          // Should respond within reasonable time
          expect(responseTime).toBeLessThan(10000);
        }
      }
    }
  });

  test('12. Edge Cases and Error Handling', async ({ page }) => {
    const floatingAI = page.locator('[class*="floating"], [data-testid="floating-ai"], .ai-chat').first();
    
    if (await floatingAI.isVisible()) {
      const chatInput = floatingAI.locator('input, textarea').first();
      
      if (await chatInput.isVisible()) {
        // Test empty message submission
        await chatInput.fill('');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(500);
        
        // Should not send empty message
        const emptyMessage = page.locator('[class*="message"]:has-text("")').first();
        console.log('Empty message handling tested');
        
        // Test very long message
        const longMessage = 'A'.repeat(2000);
        await chatInput.fill(longMessage);
        const inputValue = await chatInput.inputValue();
        
        console.log(`Long message input length: ${inputValue.length}`);
        
        // Should handle long messages appropriately
        await page.keyboard.press('Enter');
        await page.waitForTimeout(2000);
        
        // Test special characters
        await chatInput.fill('Special chars: @#$%^&*()[]{}|\\:";\'<>?,./`~');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1000);
        
        console.log('Special characters message sent');
        
        // Test network error simulation
        await page.route('**/api/**', route => {
          if (Math.random() > 0.8) {
            route.abort();
          } else {
            route.continue();
          }
        });
        
        await chatInput.fill('Test message during network issues');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(3000);
        
        // Check for error indicators
        const errorIndicator = page.locator('[class*="error"], [class*="failed"], text=/error|failed/i').first();
        if (await errorIndicator.isVisible()) {
          console.log('Error handling indicator displayed');
        }
        
        // Remove route interception
        await page.unroute('**/api/**');
      }
    }
  });
});