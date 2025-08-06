const { chromium } = require('playwright');

(async () => {
  console.log('🎯 BURNWISE Torch Position Validation Test 🎯\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    devtools: false 
  });
  
  const context = await browser.newContext({
    viewport: { width: 1512, height: 982 }
  });
  
  const page = await context.newPage();
  
  // Add console listener
  page.on('console', msg => {
    if (msg.text().includes('BURNWISE') || msg.text().includes('Torch')) {
      console.log('  Console:', msg.text());
    }
  });
  
  await page.goto('http://localhost:3000');
  
  // Monitor animation progress
  const animationData = await page.evaluate(() => {
    return new Promise((resolve) => {
      const observations = [];
      const checkpoints = [0, 500, 1000, 1500, 2000, 2500, 3000, 3250, 3500, 3750, 4000, 4100, 4300, 4600];
      let checkIndex = 0;
      const startTime = Date.now();
      
      const captureState = () => {
        const elapsed = Date.now() - startTime;
        const torchLogo = document.querySelector('.torch-logo');
        const wrapper = document.querySelector('.torch-animation-wrapper');
        const heroTitle = document.querySelector('.hero-title');
        const torchInLanding = document.querySelector('.torch-flame-absolute');
        
        const state = {
          time: elapsed,
          torch: null,
          landing: null,
          title: null
        };
        
        // Capture torch animation element
        if (torchLogo) {
          const rect = torchLogo.getBoundingClientRect();
          const computed = getComputedStyle(torchLogo);
          const matrix = new DOMMatrix(computed.transform);
          
          state.torch = {
            exists: true,
            centerX: rect.left + rect.width / 2,
            centerY: rect.top + rect.height / 2,
            opacity: parseFloat(computed.opacity),
            scale: matrix.m11,
            visible: wrapper && getComputedStyle(wrapper).display !== 'none'
          };
        }
        
        // Capture landing page flame
        if (torchInLanding && torchInLanding.querySelector('svg')) {
          const rect = torchInLanding.getBoundingClientRect();
          state.landing = {
            exists: true,
            centerX: rect.left + rect.width / 2,
            centerY: rect.top + rect.height / 2,
            opacity: parseFloat(getComputedStyle(torchInLanding).opacity)
          };
        }
        
        // Capture title and find "I"
        if (heroTitle) {
          const titleRect = heroTitle.getBoundingClientRect();
          state.title = {
            exists: true,
            centerX: titleRect.left + titleRect.width / 2,
            top: titleRect.top
          };
          
          // Find the I span
          const spans = heroTitle.querySelectorAll('span');
          spans.forEach(span => {
            if (span.textContent === 'I') {
              const iRect = span.getBoundingClientRect();
              state.title.iPosition = {
                centerX: iRect.left + iRect.width / 2,
                top: iRect.top,
                width: iRect.width
              };
            }
          });
        }
        
        return state;
      };
      
      // Capture at specific checkpoints
      const interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        
        if (checkIndex < checkpoints.length && elapsed >= checkpoints[checkIndex]) {
          observations.push(captureState());
          checkIndex++;
        }
        
        if (elapsed > 5000) {
          clearInterval(interval);
          resolve(observations);
        }
      }, 10);
    });
  });
  
  console.log('📊 Animation Timeline Analysis:');
  console.log('─'.repeat(80));
  
  animationData.forEach(state => {
    console.log(`\n⏱️  Time: ${state.time}ms`);
    
    if (state.torch) {
      console.log(`  🔥 Torch Animation:`);
      console.log(`     Position: (${state.torch.centerX.toFixed(1)}, ${state.torch.centerY.toFixed(1)})`);
      console.log(`     Scale: ${state.torch.scale.toFixed(3)}`);
      console.log(`     Opacity: ${state.torch.opacity}`);
      console.log(`     Visible: ${state.torch.visible}`);
    }
    
    if (state.landing) {
      console.log(`  🎯 Landing Flame:`);
      console.log(`     Position: (${state.landing.centerX.toFixed(1)}, ${state.landing.centerY.toFixed(1)})`);
      console.log(`     Opacity: ${state.landing.opacity}`);
    }
    
    if (state.title?.iPosition) {
      console.log(`  📍 "I" Character:`);
      console.log(`     Position: (${state.title.iPosition.centerX.toFixed(1)}, ${state.title.iPosition.top.toFixed(1)})`);
    }
  });
  
  // Analyze final positioning
  console.log('\n' + '='.repeat(80));
  console.log('🎯 FINAL POSITION ANALYSIS:');
  console.log('='.repeat(80));
  
  const finalState = animationData[animationData.length - 1];
  const morphEndState = animationData.find(s => s.time >= 3900 && s.time <= 4100);
  
  if (morphEndState) {
    console.log('\n📍 At Morph End (~4000ms):');
    
    if (morphEndState.torch && morphEndState.title?.iPosition) {
      const xDiff = Math.abs(morphEndState.torch.centerX - morphEndState.title.iPosition.centerX);
      const yDiff = morphEndState.title.iPosition.top - morphEndState.torch.centerY;
      
      console.log(`  Torch Center: (${morphEndState.torch.centerX.toFixed(1)}, ${morphEndState.torch.centerY.toFixed(1)})`);
      console.log(`  "I" Position: (${morphEndState.title.iPosition.centerX.toFixed(1)}, ${morphEndState.title.iPosition.top.toFixed(1)})`);
      console.log(`  Horizontal Offset: ${xDiff.toFixed(1)}px ${xDiff < 10 ? '✅' : '⚠️'}`);
      console.log(`  Vertical Gap: ${yDiff.toFixed(1)}px (should be ~65px)`);
      console.log(`  Result: ${xDiff < 10 && yDiff > 50 && yDiff < 80 ? '✅ PERFECT ALIGNMENT' : '⚠️ MISALIGNED'}`);
    }
    
    if (morphEndState.landing) {
      console.log(`\n  Landing Flame Active: ${morphEndState.landing.exists ? 'YES' : 'NO'}`);
      if (morphEndState.landing.exists && morphEndState.title?.iPosition) {
        const xDiff = Math.abs(morphEndState.landing.centerX - morphEndState.title.iPosition.centerX);
        console.log(`  Landing Flame Alignment: ${xDiff.toFixed(1)}px offset ${xDiff < 10 ? '✅' : '⚠️'}`);
      }
    }
  }
  
  // Check for smooth interpolation
  console.log('\n📈 Interpolation Analysis:');
  
  let smoothness = true;
  let maxVelocity = 0;
  
  for (let i = 1; i < animationData.length; i++) {
    if (animationData[i].torch && animationData[i-1].torch) {
      const dx = animationData[i].torch.centerX - animationData[i-1].torch.centerX;
      const dy = animationData[i].torch.centerY - animationData[i-1].torch.centerY;
      const dt = animationData[i].time - animationData[i-1].time;
      const distance = Math.sqrt(dx*dx + dy*dy);
      const velocity = distance / dt;
      
      maxVelocity = Math.max(maxVelocity, velocity);
      
      // Check for jumps during morph phase (2500-4000ms)
      if (animationData[i].time >= 2500 && animationData[i].time <= 4000) {
        if (velocity > 2) { // More than 2px/ms during morph is suspicious
          smoothness = false;
          console.log(`  ⚠️ High velocity at ${animationData[i].time}ms: ${velocity.toFixed(2)}px/ms`);
        }
      }
    }
  }
  
  console.log(`  Max Velocity: ${maxVelocity.toFixed(2)}px/ms`);
  console.log(`  Smoothness: ${smoothness ? '✅ SMOOTH BEZIER CURVE' : '⚠️ DETECTED JUMPS'}`);
  
  // Visual validation
  console.log('\n📸 Taking validation screenshots...');
  
  await page.goto('http://localhost:3000');
  await page.waitForTimeout(4000);
  
  // Mark the I position
  await page.evaluate(() => {
    const heroTitle = document.querySelector('.hero-title');
    if (heroTitle) {
      const spans = heroTitle.querySelectorAll('span');
      spans.forEach(span => {
        if (span.textContent === 'I') {
          span.style.background = 'rgba(255, 0, 0, 0.3)';
          span.style.outline = '2px solid red';
        }
      });
    }
  });
  
  await page.screenshot({ 
    path: 'torch-validation-final-position.png',
    fullPage: false
  });
  
  console.log('  ✅ Screenshot saved: torch-validation-final-position.png');
  
  console.log('\n' + '='.repeat(80));
  console.log('✨ Torch Position Validation Complete!');
  console.log('='.repeat(80));
  
  await browser.close();
})();