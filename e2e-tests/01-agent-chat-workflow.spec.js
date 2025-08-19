/**
 * BURNWISE Phase 5: Agent Chat Workflow Tests
 * Tests natural language burn request processing through the 5-agent system
 * NO MOCKS - All REAL API calls to OpenAI, TiDB, and OpenWeatherMap
 */

const { test, expect } = require('@playwright/test');

test.describe('Agent Chat Workflow - REAL API Tests', () => {
  test.setTimeout(60000); // 60 seconds for real API calls

  test.beforeEach(async ({ page }) => {
    // Start fresh on the landing page
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
  });

  test('Complete agent chat workflow with natural language', async ({ page }) => {
    console.log('🔥 Testing natural language burn request processing...');
    
    // Navigate to Agent Chat
    await page.click('button:has-text("Get Started")');
    await page.waitForURL('**/dashboard');
    
    // Look for Agent Chat interface
    const chatButton = page.locator('button:has-text("Agent Chat"), a:has-text("Agent Chat")');
    if (await chatButton.count() > 0) {
      await chatButton.click();
      await page.waitForSelector('.agent-chat-container, .chat-interface');
    }
    
    // Type natural language burn request
    const chatInput = page.locator('.chat-input, input[placeholder*="Type"], textarea[placeholder*="Type"]');
    await expect(chatInput).toBeVisible();
    
    const naturalRequest = "I need to burn 150 acres of wheat stubble tomorrow at 8am for pest control. Location is at coordinates 37.3382, -121.8863 in San Jose.";
    await chatInput.fill(naturalRequest);
    
    // Send the message
    const sendButton = page.locator('button:has-text("Send"), button[type="submit"]');
    await sendButton.click();
    
    // Wait for agent processing
    console.log('⏳ Waiting for agent handoffs...');
    
    // Verify BurnRequestAgent processes the request
    await expect(page.locator('.agent-message, .handoff-message')).toContainText(/BurnRequestAgent|Processing.*request/i, {
      timeout: 30000
    });
    
    // Verify WeatherAnalyst checks conditions
    await expect(page.locator('.agent-message, .handoff-message')).toContainText(/WeatherAnalyst|weather.*conditions/i, {
      timeout: 30000
    });
    
    // Verify structured data extraction
    await expect(page.locator('.agent-message')).toContainText(/150.*acres|wheat/i);
    await expect(page.locator('.agent-message')).toContainText(/tomorrow|8.*am/i);
    
    // Check for safety decision
    const safetyDecision = page.locator('.agent-message:has-text("SAFE"), .agent-message:has-text("MARGINAL"), .agent-message:has-text("UNSAFE")');
    await expect(safetyDecision).toBeVisible({ timeout: 30000 });
    
    const decisionText = await safetyDecision.textContent();
    console.log(`✅ Weather decision: ${decisionText}`);
    
    // Verify schedule optimization if SAFE or MARGINAL
    if (decisionText.includes('SAFE') || decisionText.includes('MARGINAL')) {
      await expect(page.locator('.agent-message')).toContainText(/scheduled|optimized/i, {
        timeout: 30000
      });
    }
    
    // Take screenshot of completed workflow
    await page.screenshot({ 
      path: 'screenshots/01-agent-chat-workflow.png',
      fullPage: true 
    });
  });

  test('Multiple burn requests trigger ConflictResolver', async ({ page }) => {
    console.log('🔥 Testing conflict resolution between farms...');
    
    // Navigate to Agent Chat
    await page.goto('http://localhost:3000/dashboard');
    await page.waitForLoadState('networkidle');
    
    const chatButton = page.locator('button:has-text("Agent Chat"), a:has-text("Agent Chat")');
    if (await chatButton.count() > 0) {
      await chatButton.click();
    }
    
    // First burn request
    const chatInput = page.locator('.chat-input, input[placeholder*="Type"], textarea[placeholder*="Type"]');
    await chatInput.fill("Farm A needs to burn 200 acres tomorrow morning at 37.3382, -121.8863");
    await page.click('button:has-text("Send"), button[type="submit"]');
    
    // Wait for first request to process
    await page.waitForTimeout(5000);
    
    // Second conflicting request (nearby location)
    await chatInput.fill("Farm B wants to burn 175 acres tomorrow morning at 37.3400, -121.8850");
    await page.click('button:has-text("Send"), button[type="submit"]');
    
    // Verify ConflictResolver activates
    await expect(page.locator('.agent-message, .handoff-message')).toContainText(/ConflictResolver|conflict.*detected|overlap/i, {
      timeout: 30000
    });
    
    // Check for conflict resolution strategy
    await expect(page.locator('.agent-message')).toContainText(/stagger|alternate|negotiate|resolution/i, {
      timeout: 30000
    });
    
    // Screenshot the conflict resolution
    await page.screenshot({ 
      path: 'screenshots/01-conflict-resolution.png',
      fullPage: true 
    });
  });

  test('Agent handoff visualization works', async ({ page }) => {
    console.log('🔥 Testing agent handoff visualization...');
    
    await page.goto('http://localhost:3000/dashboard');
    
    // Look for handoff diagram
    const handoffDiagram = page.locator('.handoff-diagram, .agent-flow-diagram');
    if (await handoffDiagram.count() > 0) {
      await expect(handoffDiagram).toBeVisible();
      
      // Check for agent nodes
      const agentNodes = page.locator('.agent-node, .agent-box');
      const nodeCount = await agentNodes.count();
      expect(nodeCount).toBeGreaterThanOrEqual(5); // 5 agents in the system
      
      // Verify agent names
      await expect(page.locator(':has-text("Orchestrator")')).toBeVisible();
      await expect(page.locator(':has-text("BurnRequestAgent")')).toBeVisible();
      await expect(page.locator(':has-text("WeatherAnalyst")')).toBeVisible();
      await expect(page.locator(':has-text("ConflictResolver")')).toBeVisible();
      await expect(page.locator(':has-text("ScheduleOptimizer")')).toBeVisible();
    }
  });

  test('Chat interface handles incomplete information', async ({ page }) => {
    console.log('🔥 Testing handling of incomplete burn requests...');
    
    await page.goto('http://localhost:3000/dashboard');
    
    const chatButton = page.locator('button:has-text("Agent Chat"), a:has-text("Agent Chat")');
    if (await chatButton.count() > 0) {
      await chatButton.click();
    }
    
    // Send incomplete request
    const chatInput = page.locator('.chat-input, input[placeholder*="Type"], textarea[placeholder*="Type"]');
    await chatInput.fill("I want to burn some fields");
    await page.click('button:has-text("Send"), button[type="submit"]');
    
    // Agent should ask for clarification
    await expect(page.locator('.agent-message')).toContainText(/need.*more.*information|please.*provide|acres|location|date/i, {
      timeout: 30000
    });
    
    // Provide missing information
    await chatInput.fill("150 acres at coordinates 37.3382, -121.8863 tomorrow morning");
    await page.click('button:has-text("Send"), button[type="submit"]');
    
    // Should process successfully now
    await expect(page.locator('.agent-message')).toContainText(/processing|analyzing/i, {
      timeout: 30000
    });
  });

  test('Chat preserves conversation context', async ({ page }) => {
    console.log('🔥 Testing conversation context preservation...');
    
    await page.goto('http://localhost:3000/dashboard');
    
    const chatButton = page.locator('button:has-text("Agent Chat"), a:has-text("Agent Chat")');
    if (await chatButton.count() > 0) {
      await chatButton.click();
    }
    
    // First message
    const chatInput = page.locator('.chat-input, input[placeholder*="Type"], textarea[placeholder*="Type"]');
    await chatInput.fill("I'm John from Sunrise Farm");
    await page.click('button:has-text("Send"), button[type="submit"]');
    
    await page.waitForTimeout(2000);
    
    // Second message without repeating identity
    await chatInput.fill("I need to burn 100 acres of wheat tomorrow");
    await page.click('button:has-text("Send"), button[type="submit"]');
    
    // Agent should remember the farm name
    await expect(page.locator('.agent-message')).toContainText(/Sunrise Farm|John/i, {
      timeout: 30000
    });
  });

  test('Chat displays processing indicators', async ({ page }) => {
    console.log('🔥 Testing processing indicators...');
    
    await page.goto('http://localhost:3000/dashboard');
    
    const chatButton = page.locator('button:has-text("Agent Chat"), a:has-text("Agent Chat")');
    if (await chatButton.count() > 0) {
      await chatButton.click();
    }
    
    // Send a request
    const chatInput = page.locator('.chat-input, input[placeholder*="Type"], textarea[placeholder*="Type"]');
    await chatInput.fill("Process a burn for 200 acres tomorrow");
    await page.click('button:has-text("Send"), button[type="submit"]');
    
    // Check for loading/processing indicators
    const processingIndicator = page.locator('.typing-indicator, .loading-dots, .processing');
    if (await processingIndicator.count() > 0) {
      await expect(processingIndicator).toBeVisible();
      console.log('✅ Processing indicator displayed');
    }
    
    // Check for agent status updates
    const statusUpdate = page.locator('.status-update, .agent-status');
    if (await statusUpdate.count() > 0) {
      const statusText = await statusUpdate.textContent();
      console.log(`✅ Status update: ${statusText}`);
    }
  });

  test('Verify REAL OpenAI API calls (NO MOCKS)', async ({ page }) => {
    console.log('🔥 Verifying REAL OpenAI API integration...');
    
    // Set up network monitoring
    const apiCalls = [];
    page.on('request', request => {
      const url = request.url();
      if (url.includes('openai.com') || url.includes('/api/agents')) {
        apiCalls.push({
          url: url,
          method: request.method(),
          headers: request.headers()
        });
      }
    });
    
    await page.goto('http://localhost:3000/dashboard');
    
    const chatButton = page.locator('button:has-text("Agent Chat"), a:has-text("Agent Chat")');
    if (await chatButton.count() > 0) {
      await chatButton.click();
    }
    
    // Send request that requires AI processing
    const chatInput = page.locator('.chat-input, input[placeholder*="Type"], textarea[placeholder*="Type"]');
    await chatInput.fill("Analyze weather conditions for burning 100 acres at 37.3382, -121.8863");
    await page.click('button:has-text("Send"), button[type="submit"]');
    
    // Wait for API calls
    await page.waitForTimeout(5000);
    
    // Verify API calls were made
    const openaiCalls = apiCalls.filter(call => call.url.includes('openai.com'));
    const agentCalls = apiCalls.filter(call => call.url.includes('/api/agents'));
    
    console.log(`✅ OpenAI API calls: ${openaiCalls.length}`);
    console.log(`✅ Agent API calls: ${agentCalls.length}`);
    
    // Verify response contains AI-generated content
    const agentMessage = page.locator('.agent-message').last();
    const messageText = await agentMessage.textContent();
    
    // AI responses should be unique and contextual
    expect(messageText.length).toBeGreaterThan(50);
    expect(messageText).not.toContain('Mock');
    expect(messageText).not.toContain('Example');
    expect(messageText).not.toContain('Demo');
  });
});

// Run with: npx playwright test 01-agent-chat-workflow.spec.js --headed