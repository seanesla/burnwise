const { chromium } = require('playwright');

(async () => {
  console.log('🔥 BURNWISE Torch Animation Rigorous Test Suite 🔥\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    devtools: true 
  });
  
  const viewportSizes = [
    { width: 1920, height: 1080, name: 'Full HD' },
    { width: 1440, height: 900, name: 'MacBook Pro' },
    { width: 1280, height: 720, name: 'HD' },
    { width: 768, height: 1024, name: 'iPad' },
    { width: 1512, height: 982, name: 'Default' }
  ];
  
  for (const viewport of viewportSizes) {
    console.log(`\n📐 Testing viewport: ${viewport.name} (${viewport.width}x${viewport.height})`);
    console.log('─'.repeat(60));
    
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height }
    });
    const page = await context.newPage();
    
    // Navigate and start monitoring
    await page.goto('http://localhost:3000');
    
    // Inject monitoring script
    await page.evaluate(() => {
      window.torchObservations = [];
      window.startTime = Date.now();
      
      // Create observer for torch element
      const observer = new MutationObserver(() => {
        const torchLogo = document.querySelector('.torch-logo');
        const torchWrapper = document.querySelector('.torch-animation-wrapper');
        
        if (torchLogo) {
          const computed = getComputedStyle(torchLogo);
          const rect = torchLogo.getBoundingClientRect();
          const matrix = new DOMMatrix(computed.transform);
          
          window.torchObservations.push({
            time: Date.now() - window.startTime,
            exists: true,
            transform: computed.transform,
            opacity: computed.opacity,
            position: {
              left: rect.left,
              top: rect.top,
              centerX: rect.left + rect.width / 2,
              centerY: rect.top + rect.height / 2
            },
            matrix: {
              translateX: matrix.m41,
              translateY: matrix.m42,
              scaleX: matrix.m11,
              scaleY: matrix.m22
            },
            wrapperVisible: torchWrapper ? getComputedStyle(torchWrapper).display !== 'none' : false
          });
        }
      });
      
      observer.observe(document.body, { 
        childList: true, 
        subtree: true, 
        attributes: true,
        attributeFilter: ['style', 'class']
      });
      
      // Also capture at specific intervals
      const intervals = [0, 100, 500, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4300, 4600, 5000];
      intervals.forEach(time => {
        setTimeout(() => {
          const torchLogo = document.querySelector('.torch-logo');
          const burnwiseTitle = document.querySelector('.hero-title');
          
          if (torchLogo) {
            const computed = getComputedStyle(torchLogo);
            const rect = torchLogo.getBoundingClientRect();
            
            console.log(`[${time}ms] Torch position:`, {
              centerX: rect.left + rect.width / 2,
              centerY: rect.top + rect.height / 2,
              opacity: computed.opacity,
              transform: computed.transform
            });
          }
          
          // Find the "I" in BURNWISE
          if (burnwiseTitle && time === 4000) {
            // At 4000ms, measure where the I should be
            const titleRect = burnwiseTitle.getBoundingClientRect();
            const spans = burnwiseTitle.querySelectorAll('span');
            
            console.log(`[${time}ms] BURNWISE title:`, {
              titleCenter: titleRect.left + titleRect.width / 2,
              titleTop: titleRect.top,
              spanCount: spans.length
            });
            
            // Find the I span
            spans.forEach((span, index) => {
              if (span.textContent && span.textContent.includes('I')) {
                const iRect = span.getBoundingClientRect();
                console.log(`[${time}ms] "I" character position:`, {
                  centerX: iRect.left + iRect.width / 2,
                  centerY: iRect.top + iRect.height / 2,
                  top: iRect.top
                });
              }
            });
          }
        }, time);
      });
    });
    
    // Wait for animation to complete
    await page.waitForTimeout(5500);
    
    // Get all observations
    const observations = await page.evaluate(() => window.torchObservations);
    
    // Analyze the animation
    console.log(`\n📊 Animation Analysis:`);
    console.log(`  Total observations: ${observations.length}`);
    
    if (observations.length > 0) {
      // Check start position (should be centered)
      const start = observations[0];
      const expectedStartX = viewport.width / 2;
      const expectedStartY = viewport.height / 2;
      
      console.log(`\n  ✓ Start (0ms):`);
      console.log(`    Position: (${start.position.centerX.toFixed(1)}, ${start.position.centerY.toFixed(1)})`);
      console.log(`    Expected: (${expectedStartX}, ${expectedStartY})`);
      console.log(`    Offset: (${Math.abs(start.position.centerX - expectedStartX).toFixed(1)}px, ${Math.abs(start.position.centerY - expectedStartY).toFixed(1)}px)`);
      
      // Check mid-animation (around 3250ms - middle of morph)
      const midPoint = observations.find(o => o.time >= 3000 && o.time <= 3500);
      if (midPoint) {
        console.log(`\n  ✓ Mid-morph (~${midPoint.time}ms):`);
        console.log(`    Position: (${midPoint.position.centerX.toFixed(1)}, ${midPoint.position.centerY.toFixed(1)})`);
        console.log(`    Scale: ${midPoint.matrix.scaleX.toFixed(3)}`);
        console.log(`    Opacity: ${midPoint.opacity}`);
      }
      
      // Check end position (around 4000ms)
      const end = observations.find(o => o.time >= 3900 && o.time <= 4100) || observations[observations.length - 1];
      if (end) {
        console.log(`\n  ✓ End (~${end.time}ms):`);
        console.log(`    Position: (${end.position.centerX.toFixed(1)}, ${end.position.centerY.toFixed(1)})`);
        console.log(`    Scale: ${end.matrix.scaleX.toFixed(3)}`);
        console.log(`    Opacity: ${end.opacity}`);
      }
      
      // Check for jumps
      let jumps = 0;
      let maxJump = 0;
      for (let i = 1; i < observations.length; i++) {
        const prev = observations[i - 1];
        const curr = observations[i];
        const distance = Math.sqrt(
          Math.pow(curr.position.centerX - prev.position.centerX, 2) +
          Math.pow(curr.position.centerY - prev.position.centerY, 2)
        );
        const timeDiff = curr.time - prev.time;
        const velocity = distance / timeDiff;
        
        // Detect jumps (sudden position changes)
        if (velocity > 5 && distance > 50) { // More than 5px/ms and 50px total
          jumps++;
          maxJump = Math.max(maxJump, distance);
        }
      }
      
      console.log(`\n  📈 Smoothness Analysis:`);
      console.log(`    Jump detections: ${jumps}`);
      console.log(`    Max jump distance: ${maxJump.toFixed(1)}px`);
      console.log(`    Result: ${jumps === 0 ? '✅ SMOOTH' : '⚠️ JUMPY'}`);
    }
    
    // Take screenshots at key moments
    await page.goto('http://localhost:3000'); // Reload for screenshots
    
    const screenshotTimes = [
      { time: 0, name: 'start' },
      { time: 2500, name: 'hold' },
      { time: 3250, name: 'mid-morph' },
      { time: 4000, name: 'end-morph' },
      { time: 4600, name: 'faded' }
    ];
    
    for (const shot of screenshotTimes) {
      await page.waitForTimeout(shot.time - (shot === screenshotTimes[0] ? 0 : screenshotTimes[screenshotTimes.indexOf(shot) - 1].time));
      await page.screenshot({ 
        path: `torch-test-${viewport.name.replace(/ /g, '-')}-${shot.name}.png`,
        fullPage: false
      });
    }
    
    await context.close();
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Torch Animation Test Suite Complete!');
  console.log('='.repeat(60));
  
  await browser.close();
})();