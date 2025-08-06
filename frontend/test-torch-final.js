const { chromium } = require('playwright');

(async () => {
  console.log('🏆 BURNWISE Torch Animation - FINAL VALIDATION 🏆\n');
  console.log('='.repeat(80));
  
  const browser = await chromium.launch({ 
    headless: true  // Run headless for speed
  });
  
  const viewports = [
    { width: 1920, height: 1080, name: 'Desktop HD' },
    { width: 1512, height: 982, name: 'Default' },
    { width: 1440, height: 900, name: 'MacBook' },
    { width: 768, height: 1024, name: 'iPad' }
  ];
  
  let allPassed = true;
  const results = [];
  
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    
    // Suppress console output
    page.on('console', () => {});
    
    await page.goto('http://localhost:3000');
    
    // Wait for animation to reach morph end
    await page.waitForTimeout(4000);
    
    // Measure final positions
    const measurements = await page.evaluate(() => {
      const torchLogo = document.querySelector('.torch-logo');
      const torchWrapper = document.querySelector('.torch-animation-wrapper');
      const heroTitle = document.querySelector('.hero-title');
      const landingFlame = document.querySelector('.torch-flame-absolute');
      
      const result = {
        torch: null,
        landing: null,
        iPosition: null
      };
      
      if (torchLogo && torchWrapper) {
        const rect = torchLogo.getBoundingClientRect();
        const computed = getComputedStyle(torchLogo);
        const matrix = new DOMMatrix(computed.transform);
        
        result.torch = {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
          scale: matrix.m11,
          opacity: parseFloat(computed.opacity),
          visible: getComputedStyle(torchWrapper).display !== 'none'
        };
      }
      
      if (landingFlame) {
        const rect = landingFlame.getBoundingClientRect();
        result.landing = {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2
        };
      }
      
      if (heroTitle) {
        const spans = heroTitle.querySelectorAll('span');
        spans.forEach(span => {
          if (span.textContent === 'I') {
            const iRect = span.getBoundingClientRect();
            result.iPosition = {
              x: iRect.left + iRect.width / 2,
              y: iRect.top
            };
          }
        });
      }
      
      return result;
    });
    
    // Calculate alignment
    let passed = true;
    let horizontalOffset = 0;
    let verticalGap = 0;
    
    if (measurements.torch && measurements.iPosition) {
      horizontalOffset = Math.abs(measurements.torch.x - measurements.iPosition.x);
      verticalGap = measurements.iPosition.y - measurements.torch.y;
      
      // Pass criteria: horizontal offset < 10px, vertical gap 60-70px
      passed = horizontalOffset < 10 && verticalGap >= 60 && verticalGap <= 70;
    } else {
      passed = false;
    }
    
    results.push({
      viewport: viewport.name,
      size: `${viewport.width}x${viewport.height}`,
      horizontalOffset,
      verticalGap,
      passed
    });
    
    if (!passed) allPassed = false;
    
    await context.close();
  }
  
  // Display results
  console.log('\n📊 RESULTS BY VIEWPORT:');
  console.log('─'.repeat(80));
  
  results.forEach(r => {
    const status = r.passed ? '✅' : '❌';
    const hStatus = r.horizontalOffset < 10 ? '✓' : '✗';
    const vStatus = r.verticalGap >= 60 && r.verticalGap <= 70 ? '✓' : '✗';
    
    console.log(`\n${status} ${r.viewport} (${r.size})`);
    console.log(`   Horizontal: ${r.horizontalOffset.toFixed(1)}px ${hStatus}`);
    console.log(`   Vertical:   ${r.verticalGap.toFixed(1)}px ${vStatus}`);
  });
  
  // Final summary
  console.log('\n' + '='.repeat(80));
  console.log('FINAL VALIDATION SUMMARY:');
  console.log('='.repeat(80));
  
  const passCount = results.filter(r => r.passed).length;
  const totalCount = results.length;
  const passRate = (passCount / totalCount * 100).toFixed(0);
  
  console.log(`\n  Pass Rate: ${passCount}/${totalCount} (${passRate}%)`);
  console.log(`  Status: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  
  // Animation quality check
  const avgHorizontal = results.reduce((sum, r) => sum + r.horizontalOffset, 0) / results.length;
  const avgVertical = results.reduce((sum, r) => sum + r.verticalGap, 0) / results.length;
  
  console.log(`\n  Average Horizontal Offset: ${avgHorizontal.toFixed(1)}px`);
  console.log(`  Average Vertical Gap: ${avgVertical.toFixed(1)}px`);
  
  if (allPassed) {
    console.log('\n🎉 PERFECT! The torch animation lands precisely above the "I" in BURNWISE');
    console.log('   across all tested viewport sizes with smooth bezier interpolation.');
  } else {
    console.log('\n⚠️  Some viewports need adjustment. Review the results above.');
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('🏁 Validation Complete!');
  console.log('='.repeat(80) + '\n');
  
  await browser.close();
  process.exit(allPassed ? 0 : 1);
})();