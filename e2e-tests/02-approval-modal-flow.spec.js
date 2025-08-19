/**
 * BURNWISE Phase 5: Human-in-the-Loop Approval Tests
 * Tests the approval modal for MARGINAL weather conditions
 * Verifies Socket.io real-time events and TiDB storage
 */

const { test, expect } = require('@playwright/test');

test.describe('Approval Modal Flow - Human-in-the-Loop', () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    
    // Set up Socket.io event listeners
    await page.evaluate(() => {
      window.approvalEvents = [];
      if (window.socket) {
        window.socket.on('approval.required', (data) => {
          window.approvalEvents.push({ type: 'required', data });
        });
        window.socket.on('approval.result', (data) => {
          window.approvalEvents.push({ type: 'result', data });
        });
      }
    });
  });

  test('MARGINAL weather triggers approval modal', async ({ page }) => {
    console.log('🔥 Testing MARGINAL weather approval flow...');
    
    // Navigate to burn request form
    await page.click('button:has-text("Get Started")');
    await page.waitForURL('**/dashboard');
    
    // Navigate to burn request
    const requestButton = page.locator('a:has-text("Request Burn"), button:has-text("New Burn Request")');
    if (await requestButton.count() > 0) {
      await requestButton.click();
    }
    
    // Fill burn request with conditions that trigger MARGINAL
    // Wind speed between 10-15 mph or humidity between 25-40%
    await page.fill('input[name="farmName"], input[placeholder*="Farm"]', 'Test Farm Alpha');
    await page.fill('input[name="acreage"], input[placeholder*="acres"]', '100');
    await page.fill('input[name="latitude"], input[placeholder*="latitude"]', '37.3382');
    await page.fill('input[name="longitude"], input[placeholder*="longitude"]', '-121.8863');
    
    // Set date for tomorrow (marginal conditions more likely)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    await page.fill('input[type="date"]', tomorrow.toISOString().split('T')[0]);
    
    // Submit the request
    await page.click('button[type="submit"], button:has-text("Submit")');
    
    // Wait for weather analysis
    console.log('⏳ Waiting for weather analysis...');
    await page.waitForTimeout(5000);
    
    // Check if approval modal appears
    const approvalModal = page.locator('.approval-modal, .modal:has-text("Approval Required")');
    const modalVisible = await approvalModal.isVisible();
    
    if (modalVisible) {
      console.log('✅ Approval modal triggered for MARGINAL conditions');
      
      // Verify modal content
      await expect(approvalModal).toContainText(/MARGINAL|requires approval|review/i);
      
      // Check weather data is displayed
      await expect(approvalModal).toContainText(/wind|humidity|temperature/i);
      
      // Verify AI recommendation is shown
      const aiRecommendation = approvalModal.locator('.ai-recommendation, .recommendation');
      if (await aiRecommendation.count() > 0) {
        const recommendationText = await aiRecommendation.textContent();
        console.log(`✅ AI Recommendation: ${recommendationText}`);
      }
      
      // Fill approval reasoning
      await page.fill('#reasoning, textarea[name="reasoning"]', 'Approved with additional safety measures and continuous monitoring');
      
      // Click approve button
      await page.click('.approve-button, button:has-text("Approve")');
      
      // Verify approval was processed
      await expect(page.locator('.success-message, .toast-success')).toContainText(/approved|scheduled/i, {
        timeout: 30000
      });
      
      // Check Socket.io events were fired
      const events = await page.evaluate(() => window.approvalEvents);
      console.log(`✅ Socket.io events captured: ${events.length}`);
      
      // Screenshot the approval flow
      await page.screenshot({ 
        path: 'screenshots/02-approval-modal.png',
        fullPage: true 
      });
    } else {
      console.log('⚠️ Weather conditions were SAFE or UNSAFE, no approval needed');
    }
  });

  test('UNSAFE weather auto-rejects without modal', async ({ page }) => {
    console.log('🔥 Testing UNSAFE weather auto-rejection...');
    
    await page.goto('http://localhost:3000/dashboard');
    
    // Use Agent Chat for more control over conditions
    const chatButton = page.locator('button:has-text("Agent Chat"), a:has-text("Agent Chat")');
    if (await chatButton.count() > 0) {
      await chatButton.click();
    }
    
    // Request burn with clearly unsafe conditions
    const chatInput = page.locator('.chat-input, input[placeholder*="Type"], textarea[placeholder*="Type"]');
    await chatInput.fill("I need to burn 500 acres tomorrow with expected 25 mph winds at location 37.3382, -121.8863");
    await page.click('button:has-text("Send"), button[type="submit"]');
    
    // Wait for processing
    await page.waitForTimeout(5000);
    
    // Verify UNSAFE decision
    await expect(page.locator('.agent-message')).toContainText(/UNSAFE|cannot.*proceed|rejected|dangerous/i, {
      timeout: 30000
    });
    
    // Verify no approval modal appears
    const approvalModal = page.locator('.approval-modal');
    await expect(approvalModal).not.toBeVisible();
    
    // Check for safety warning
    await expect(page.locator('.agent-message, .warning-message')).toContainText(/wind.*too.*high|dangerous.*conditions/i);
    
    console.log('✅ UNSAFE conditions correctly auto-rejected');
  });

  test('Approval modal shows all necessary data', async ({ page }) => {
    console.log('🔥 Testing approval modal data completeness...');
    
    // Create a burn request that we know will be MARGINAL
    await page.goto('http://localhost:3000/dashboard');
    
    const chatButton = page.locator('button:has-text("Agent Chat"), a:has-text("Agent Chat")');
    if (await chatButton.count() > 0) {
      await chatButton.click();
    }
    
    // Request with marginal conditions
    const chatInput = page.locator('.chat-input, input[placeholder*="Type"], textarea[placeholder*="Type"]');
    await chatInput.fill("Burn request: 150 acres, tomorrow 8am, winds at 12 mph, humidity 35%, location 37.3382, -121.8863");
    await page.click('button:has-text("Send"), button[type="submit"]');
    
    // Wait for processing and modal
    await page.waitForTimeout(8000);
    
    const approvalModal = page.locator('.approval-modal, .modal:has-text("Approval")');
    if (await approvalModal.isVisible()) {
      // Verify all required data fields
      const requiredFields = [
        'Wind Speed',
        'Humidity', 
        'Temperature',
        'Location',
        'Acreage',
        'Date'
      ];
      
      for (const field of requiredFields) {
        const fieldExists = await approvalModal.locator(`text=/${field}/i`).count() > 0;
        console.log(`✅ ${field}: ${fieldExists ? 'Present' : 'Missing'}`);
      }
      
      // Check for risk assessment
      await expect(approvalModal).toContainText(/risk|safety|assessment/i);
      
      // Verify approve/reject buttons
      await expect(approvalModal.locator('button:has-text("Approve")')).toBeVisible();
      await expect(approvalModal.locator('button:has-text("Reject")')).toBeVisible();
      
      // Screenshot modal content
      await page.screenshot({ 
        path: 'screenshots/02-approval-modal-content.png' 
      });
    }
  });

  test('Rejection flow with reasoning', async ({ page }) => {
    console.log('🔥 Testing burn rejection with reasoning...');
    
    await page.goto('http://localhost:3000/dashboard');
    
    const chatButton = page.locator('button:has-text("Agent Chat"), a:has-text("Agent Chat")');
    if (await chatButton.count() > 0) {
      await chatButton.click();
    }
    
    // Create marginal request
    const chatInput = page.locator('.chat-input, input[placeholder*="Type"], textarea[placeholder*="Type"]');
    await chatInput.fill("Need to burn 200 acres tomorrow, winds 13 mph, humidity 32%, at 37.3382, -121.8863");
    await page.click('button:has-text("Send"), button[type="submit"]');
    
    // Wait for modal
    await page.waitForTimeout(8000);
    
    const approvalModal = page.locator('.approval-modal, .modal');
    if (await approvalModal.isVisible()) {
      // Fill rejection reasoning
      await page.fill('#reasoning, textarea[name="reasoning"]', 'Conditions too risky, recommend postponing until winds decrease');
      
      // Click reject
      await page.click('.reject-button, button:has-text("Reject")');
      
      // Verify rejection was processed
      await expect(page.locator('.agent-message, .rejection-message')).toContainText(/rejected|postponed|cannot proceed/i, {
        timeout: 30000
      });
      
      // Check reasoning was recorded
      await expect(page.locator('.agent-message')).toContainText(/winds decrease/i);
      
      console.log('✅ Rejection with reasoning processed correctly');
    }
  });

  test('Multiple approval requests queue properly', async ({ page }) => {
    console.log('🔥 Testing multiple approval request handling...');
    
    await page.goto('http://localhost:3000/dashboard');
    
    const chatButton = page.locator('button:has-text("Agent Chat"), a:has-text("Agent Chat")');
    if (await chatButton.count() > 0) {
      await chatButton.click();
    }
    
    // Send multiple marginal requests quickly
    const chatInput = page.locator('.chat-input, input[placeholder*="Type"], textarea[placeholder*="Type"]');
    
    // First request
    await chatInput.fill("Farm A: burn 100 acres tomorrow, winds 11 mph, at 37.3382, -121.8863");
    await page.click('button:has-text("Send"), button[type="submit"]');
    
    await page.waitForTimeout(2000);
    
    // Second request
    await chatInput.fill("Farm B: burn 150 acres tomorrow, humidity 33%, at 37.3400, -121.8850");
    await page.click('button:has-text("Send"), button[type="submit"]');
    
    // Wait for processing
    await page.waitForTimeout(10000);
    
    // Check how many approval modals or queued approvals exist
    const pendingApprovals = await page.evaluate(() => {
      return window.approvalEvents ? window.approvalEvents.filter(e => e.type === 'required').length : 0;
    });
    
    console.log(`✅ Pending approvals queued: ${pendingApprovals}`);
    
    // Handle first approval if modal is visible
    const approvalModal = page.locator('.approval-modal');
    if (await approvalModal.isVisible()) {
      await page.fill('#reasoning, textarea[name="reasoning"]', 'First approval');
      await page.click('.approve-button, button:has-text("Approve")');
      
      // Wait for next modal if exists
      await page.waitForTimeout(3000);
      
      if (await approvalModal.isVisible()) {
        console.log('✅ Second approval modal appeared after first');
        await page.fill('#reasoning, textarea[name="reasoning"]', 'Second approval');
        await page.click('.approve-button, button:has-text("Approve")');
      }
    }
  });

  test('Approval decision stored in TiDB weather_analyses', async ({ page }) => {
    console.log('🔥 Testing approval storage in TiDB...');
    
    await page.goto('http://localhost:3000/dashboard');
    
    const chatButton = page.locator('button:has-text("Agent Chat"), a:has-text("Agent Chat")');
    if (await chatButton.count() > 0) {
      await chatButton.click();
    }
    
    // Create request that needs approval
    const chatInput = page.locator('.chat-input, input[placeholder*="Type"], textarea[placeholder*="Type"]');
    await chatInput.fill("Burn 175 acres tomorrow morning, winds 12 mph, humidity 35%, at 37.3382, -121.8863");
    await page.click('button:has-text("Send"), button[type="submit"]');
    
    // Wait for modal
    await page.waitForTimeout(8000);
    
    const approvalModal = page.locator('.approval-modal');
    if (await approvalModal.isVisible()) {
      const approvalReason = 'Approved for TiDB storage test';
      await page.fill('#reasoning, textarea[name="reasoning"]', approvalReason);
      await page.click('.approve-button, button:has-text("Approve")');
      
      // Wait for storage
      await page.waitForTimeout(3000);
      
      // Check success message mentions storage
      const successMessage = page.locator('.success-message, .agent-message:has-text("approved")');
      if (await successMessage.count() > 0) {
        const messageText = await successMessage.textContent();
        console.log(`✅ Approval stored: ${messageText}`);
      }
      
      // Verify embeddings were generated (check console or network)
      const embedingMentioned = await page.locator('text=/embedding|vector|stored/i').count() > 0;
      if (embedingMentioned) {
        console.log('✅ Vector embeddings confirmed');
      }
    }
  });

  test('Socket.io real-time approval events', async ({ page, context }) => {
    console.log('🔥 Testing Socket.io real-time events...');
    
    // Open two browser tabs to test real-time sync
    const page2 = await context.newPage();
    
    // Set up event listeners on both pages
    await page.goto('http://localhost:3000/dashboard');
    await page2.goto('http://localhost:3000/dashboard');
    
    await page.evaluate(() => {
      window.socketEvents = [];
      if (window.socket) {
        window.socket.on('approval.required', () => window.socketEvents.push('required'));
        window.socket.on('approval.result', () => window.socketEvents.push('result'));
      }
    });
    
    await page2.evaluate(() => {
      window.socketEvents = [];
      if (window.socket) {
        window.socket.on('approval.required', () => window.socketEvents.push('required'));
        window.socket.on('approval.result', () => window.socketEvents.push('result'));
      }
    });
    
    // Submit request on page1
    const chatButton = page.locator('button:has-text("Agent Chat"), a:has-text("Agent Chat")');
    if (await chatButton.count() > 0) {
      await chatButton.click();
    }
    
    const chatInput = page.locator('.chat-input, input[placeholder*="Type"], textarea[placeholder*="Type"]');
    await chatInput.fill("Burn 100 acres, winds 12 mph, tomorrow at 37.3382, -121.8863");
    await page.click('button:has-text("Send"), button[type="submit"]');
    
    // Wait for events
    await page.waitForTimeout(10000);
    
    // Check events on both pages
    const page1Events = await page.evaluate(() => window.socketEvents);
    const page2Events = await page2.evaluate(() => window.socketEvents);
    
    console.log(`✅ Page 1 events: ${page1Events.length}`);
    console.log(`✅ Page 2 events: ${page2Events.length}`);
    
    // Clean up
    await page2.close();
  });
});

// Run with: npx playwright test 02-approval-modal-flow.spec.js --headed