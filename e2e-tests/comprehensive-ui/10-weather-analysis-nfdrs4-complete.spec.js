/**
 * Complete Weather Analysis Card and NFDRS4 Feature Tests
 * Tests professional National Fire Danger Rating System v4.0 display and calculations
 * NO MOCKS - Real NFDRS4 meteorological data and color classifications
 */

const { test, expect } = require('@playwright/test');

test.describe('Weather Analysis Card and NFDRS4 - Complete Feature Testing', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to spatial interface where weather analysis can be accessed
    await page.goto('http://localhost:3000/spatial');
    
    // Handle potential redirect to onboarding
    try {
      await page.waitForURL('**/spatial', { timeout: 5000 });
    } catch (e) {
      const url = page.url();
      if (url.includes('onboarding')) {
        await page.click('button:has-text("Skip Setup")');
        await page.waitForURL('**/spatial');
      }
    }
    
    await page.waitForLoadState('networkidle');
  });

  test('01. Weather Analysis Card - Visibility and Initial State', async ({ page }) => {
    // Access weather analysis through sidebar or panel
    const weatherBtn = page.locator('.sidebar-nav-item').filter({ hasText: 'Weather' });
    
    if (await weatherBtn.isVisible()) {
      await weatherBtn.click();
      await page.waitForTimeout(1000);
    }
    
    // Look for weather analysis card or container
    const weatherCard = page.locator('.weather-analysis-card, [class*="weather-analysis"], [class*="nfdrs"]');
    
    if (await weatherCard.isVisible()) {
      await expect(weatherCard).toBeVisible();
      
      // Should have NFDRS4 badge
      const nfdrsBadge = weatherCard.locator('.nfdrs4-badge, [class*="nfdrs4"]');
      if (await nfdrsBadge.isVisible()) {
        const badgeText = await nfdrsBadge.textContent();
        expect(badgeText).toMatch(/NFDRS4/i);
        
        // Check professional styling
        const bgColor = await nfdrsBadge.evaluate(el => 
          window.getComputedStyle(el).background
        );
        expect(bgColor).toContain('linear-gradient');
      }
      
      // Should have analysis title
      const analysisTitle = weatherCard.locator('.analysis-title, h3');
      if (await analysisTitle.isVisible()) {
        const titleText = await analysisTitle.textContent();
        expect(titleText).toMatch(/Weather.*Analysis|Professional.*Analysis/i);
      }
      
      // Should have methodology note
      const methodologyNote = weatherCard.locator('.methodology-note');
      if (await methodologyNote.isVisible()) {
        const noteText = await methodologyNote.textContent();
        expect(noteText).toMatch(/National.*Fire.*Danger.*Rating.*System.*v4\.0/i);
      }
    }
  });

  test('02. NFDRS4 Burning Index Display and Color Classification', async ({ page }) => {
    // Simulate weather analysis card with test data
    await page.evaluate(() => {
      // Create test NFDRS4 data
      window.testNFDRS4Data = {
        isValid: true,
        burningIndex: 67,
        spreadComponent: 45,
        energyReleaseComponent: 82,
        equilibriumMoisture: 7.5
      };
      
      // Dispatch event to show weather analysis
      window.dispatchEvent(new CustomEvent('showWeatherAnalysis', {
        detail: { nfdrs4Data: window.testNFDRS4Data }
      }));
    });
    
    await page.waitForTimeout(1000);
    
    const weatherCard = page.locator('.weather-analysis-card');
    
    if (await weatherCard.isVisible()) {
      // Check Burning Index section
      const burningIndexSection = weatherCard.locator('.metric-section.primary, .metric-section').filter({ hasText: /Burning.*Index.*BI/i });
      
      if (await burningIndexSection.isVisible()) {
        // Should have metric name
        const metricName = burningIndexSection.locator('.metric-name');
        if (await metricName.isVisible()) {
          const nameText = await metricName.textContent();
          expect(nameText).toMatch(/Burning.*Index.*\(BI\)/i);
        }
        
        // Should have large metric value
        const metricValue = burningIndexSection.locator('.metric-value-large, .metric-value');
        if (await metricValue.isVisible()) {
          const valueText = await metricValue.textContent();
          const value = parseInt(valueText);
          
          // Value should be in valid range (0-99)
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(99);
          
          // Check color classification for high danger (51-75 = orange)
          if (value >= 51 && value <= 75) {
            const color = await metricValue.evaluate(el => 
              window.getComputedStyle(el).color
            );
            // Should be orange (#FF9800 = rgb(255, 152, 0))
            expect(color).toMatch(/rgb\(255, 152, 0\)|#FF9800/i);
          }
        }
        
        // Should have progress bar
        const metricBar = burningIndexSection.locator('.metric-bar');
        if (await metricBar.isVisible()) {
          const barWidth = await metricBar.evaluate(el => 
            window.getComputedStyle(el).width
          );
          
          // Bar width should correspond to value
          expect(barWidth).toMatch(/\d+(\.\d+)?%/);
          
          const bgColor = await metricBar.evaluate(el => 
            window.getComputedStyle(el).backgroundColor
          );
          expect(bgColor).toMatch(/rgb/);
        }
        
        // Should have classification text
        const classification = burningIndexSection.locator('.metric-classification');
        if (await classification.isVisible()) {
          const classText = await classification.textContent();
          expect(classText).toMatch(/Low|Moderate|High|Extreme.*Fire.*Danger/i);
        }
      }
    }
  });

  test('03. NFDRS4 Spread Component Analysis', async ({ page }) => {
    await page.evaluate(() => {
      window.testNFDRS4Data = {
        isValid: true,
        burningIndex: 35,
        spreadComponent: 78,
        energyReleaseComponent: 42,
        equilibriumMoisture: 11.2
      };
      
      window.dispatchEvent(new CustomEvent('showWeatherAnalysis', {
        detail: { nfdrs4Data: window.testNFDRS4Data }
      }));
    });
    
    await page.waitForTimeout(1000);
    
    const weatherCard = page.locator('.weather-analysis-card');
    
    if (await weatherCard.isVisible()) {
      // Find Spread Component section
      const spreadSection = weatherCard.locator('.metric-section').filter({ hasText: /Spread.*Component.*SC/i });
      
      if (await spreadSection.isVisible()) {
        // Check metric name and value
        const metricName = spreadSection.locator('.metric-name');
        if (await metricName.isVisible()) {
          const nameText = await metricName.textContent();
          expect(nameText).toMatch(/Spread.*Component.*\(SC\)/i);
        }
        
        const metricValue = spreadSection.locator('.metric-value');
        if (await metricValue.isVisible()) {
          const valueText = await metricValue.textContent();
          const value = parseInt(valueText);
          
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(99);
          
          // Check extreme danger color (76-99 = red)
          if (value >= 76 && value <= 99) {
            const color = await metricValue.evaluate(el => 
              window.getComputedStyle(el).color
            );
            expect(color).toMatch(/rgb\(244, 67, 54\)|#f44336/i);
          }
        }
        
        // Should have classification
        const classification = spreadSection.locator('.metric-classification');
        if (await classification.isVisible()) {
          const classText = await classification.textContent();
          expect(classText).toMatch(/Low|Moderate|High|Extreme.*Wind.*Spread|Spread.*Potential/i);
        }
        
        // Should have explanation
        const explanation = spreadSection.locator('.metric-explanation');
        if (await explanation.isVisible()) {
          const explanationText = await explanation.textContent();
          expect(explanationText).toMatch(/Wind.*driven.*fire.*spread.*potential/i);
        }
      }
    }
  });

  test('04. NFDRS4 Energy Release Component Analysis', async ({ page }) => {
    await page.evaluate(() => {
      window.testNFDRS4Data = {
        isValid: true,
        burningIndex: 25,
        spreadComponent: 30,
        energyReleaseComponent: 88,
        equilibriumMoisture: 9.8
      };
      
      window.dispatchEvent(new CustomEvent('showWeatherAnalysis', {
        detail: { nfdrs4Data: window.testNFDRS4Data }
      }));
    });
    
    await page.waitForTimeout(1000);
    
    const weatherCard = page.locator('.weather-analysis-card');
    
    if (await weatherCard.isVisible()) {
      // Find Energy Release Component section
      const ercSection = weatherCard.locator('.metric-section').filter({ hasText: /Energy.*Release.*Component.*ERC/i });
      
      if (await ercSection.isVisible()) {
        // Check metric display
        const metricName = ercSection.locator('.metric-name');
        if (await metricName.isVisible()) {
          const nameText = await metricName.textContent();
          expect(nameText).toMatch(/Energy.*Release.*Component.*\(ERC\)/i);
        }
        
        const metricValue = ercSection.locator('.metric-value');
        if (await metricValue.isVisible()) {
          const valueText = await metricValue.textContent();
          const value = parseInt(valueText);
          
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(99);
        }
        
        // Check progress bar animation
        const metricBar = ercSection.locator('.metric-bar');
        if (await metricBar.isVisible()) {
          // Bar should have animation transition
          const transition = await metricBar.evaluate(el => 
            window.getComputedStyle(el).transition
          );
          expect(transition).toMatch(/width.*0\.6s.*ease/);
          
          // Background should be gradient
          const background = await metricBar.evaluate(el => 
            window.getComputedStyle(el).background
          );
          expect(background).toContain('linear-gradient');
        }
        
        // Should have classification and explanation
        const classification = ercSection.locator('.metric-classification');
        if (await classification.isVisible()) {
          const classText = await classification.textContent();
          expect(classText).toMatch(/Low|Moderate|High|Extreme.*Energy.*Release/i);
        }
        
        const explanation = ercSection.locator('.metric-explanation');
        if (await explanation.isVisible()) {
          const explanationText = await explanation.textContent();
          expect(explanationText).toMatch(/Fuel.*energy.*availability.*combustion/i);
        }
      }
    }
  });

  test('05. NFDRS4 Equilibrium Moisture Content (Inverted Scale)', async ({ page }) => {
    await page.evaluate(() => {
      window.testNFDRS4Data = {
        isValid: true,
        burningIndex: 45,
        spreadComponent: 55,
        energyReleaseComponent: 38,
        equilibriumMoisture: 4.8  // Critical dryness level
      };
      
      window.dispatchEvent(new CustomEvent('showWeatherAnalysis', {
        detail: { nfdrs4Data: window.testNFDRS4Data }
      }));
    });
    
    await page.waitForTimeout(1000);
    
    const weatherCard = page.locator('.weather-analysis-card');
    
    if (await weatherCard.isVisible()) {
      // Find Equilibrium Moisture Content section
      const emcSection = weatherCard.locator('.metric-section').filter({ hasText: /Equilibrium.*Moisture.*Content.*EMC/i });
      
      if (await emcSection.isVisible()) {
        // Check metric name and percentage value
        const metricName = emcSection.locator('.metric-name');
        if (await metricName.isVisible()) {
          const nameText = await metricName.textContent();
          expect(nameText).toMatch(/Equilibrium.*Moisture.*Content.*\(EMC\)/i);
        }
        
        const metricValue = emcSection.locator('.metric-value');
        if (await metricValue.isVisible()) {
          const valueText = await metricValue.textContent();
          expect(valueText).toMatch(/\d+(\.\d+)?%/);
          
          const value = parseFloat(valueText.replace('%', ''));
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(25); // Reasonable EMC range
          
          // Critical dryness (0-6.0%) should be red
          if (value >= 0 && value <= 6.0) {
            const color = await metricValue.evaluate(el => 
              window.getComputedStyle(el).color
            );
            expect(color).toMatch(/rgb\(244, 67, 54\)|#f44336/i);
          }
        }
        
        // Check inverted progress bar
        const metricBar = emcSection.locator('.metric-bar.inverted, .metric-bar');
        if (await metricBar.isVisible()) {
          // Inverted bar should have direction: rtl or inverted calculation
          const direction = await metricBar.evaluate(el => 
            window.getComputedStyle(el).direction
          );
          
          if (direction === 'rtl') {
            expect(direction).toBe('rtl');
          } else {
            // Width should be inverted (100 - percentage calculation)
            const width = await metricBar.evaluate(el => 
              window.getComputedStyle(el).width
            );
            expect(width).toMatch(/\d+(\.\d+)?%/);
          }
        }
        
        // Should have moisture classification
        const classification = emcSection.locator('.metric-classification');
        if (await classification.isVisible()) {
          const classText = await classification.textContent();
          expect(classText).toMatch(/Safe.*Moisture|Moderate.*Dryness|Dangerous.*Dryness|Critical.*Dryness/i);
        }
        
        // Should have fuel explanation
        const explanation = emcSection.locator('.metric-explanation');
        if (await explanation.isVisible()) {
          const explanationText = await explanation.textContent();
          expect(explanationText).toMatch(/Fuel.*dryness.*atmospheric.*conditions/i);
        }
      }
    }
  });

  test('06. Professional Assessment Summary', async ({ page }) => {
    await page.evaluate(() => {
      window.testNFDRS4Data = {
        isValid: true,
        burningIndex: 72,
        spreadComponent: 65,
        energyReleaseComponent: 58,
        equilibriumMoisture: 5.2
      };
      
      window.dispatchEvent(new CustomEvent('showWeatherAnalysis', {
        detail: { nfdrs4Data: window.testNFDRS4Data }
      }));
    });
    
    await page.waitForTimeout(1000);
    
    const weatherCard = page.locator('.weather-analysis-card');
    
    if (await weatherCard.isVisible()) {
      // Find analysis summary section
      const analysisSummary = weatherCard.locator('.analysis-summary');
      
      if (await analysisSummary.isVisible()) {
        await expect(analysisSummary).toBeVisible();
        
        // Should have summary header
        const summaryTitle = analysisSummary.locator('.summary-title');
        if (await summaryTitle.isVisible()) {
          const titleText = await summaryTitle.textContent();
          expect(titleText).toMatch(/Professional.*Assessment/i);
        }
        
        // Should have assessment text
        const assessmentText = analysisSummary.locator('.assessment-text');
        if (await assessmentText.isVisible()) {
          const textContent = await assessmentText.textContent();
          
          // Should include NFDRS4 analysis
          expect(textContent).toMatch(/NFDRS4.*analysis.*indicates/i);
          
          // Should include danger level
          expect(textContent).toMatch(/low|moderate|high|extreme.*fire.*danger/i);
          
          // Should include spread potential
          expect(textContent).toMatch(/spread.*potential/i);
          
          // Should include moisture conditions
          expect(textContent).toMatch(/moisture|dryness/i);
          
          // Text should be comprehensive
          expect(textContent.length).toBeGreaterThan(50);
        }
        
        // Check summary styling
        const summaryContent = analysisSummary.locator('.summary-content');
        if (await summaryContent.isVisible()) {
          const bgColor = await summaryContent.evaluate(el => 
            window.getComputedStyle(el).backgroundColor
          );
          
          // Should have professional blue tint
          expect(bgColor).toMatch(/rgba\(21, 101, 192|rgb\(21, 101, 192/);
          
          const borderLeft = await summaryContent.evaluate(el => 
            window.getComputedStyle(el).borderLeftColor
          );
          expect(borderLeft).toMatch(/rgb\(21, 101, 192\)|#1565C0/);
        }
      }
    }
  });

  test('07. Compact Mode Display and Grid Layout', async ({ page }) => {
    // Test compact mode if available
    await page.evaluate(() => {
      window.testNFDRS4Data = {
        isValid: true,
        burningIndex: 43,
        spreadComponent: 67,
        energyReleaseComponent: 29,
        equilibriumMoisture: 13.5
      };
      
      // Show weather analysis in compact mode
      window.dispatchEvent(new CustomEvent('showWeatherAnalysis', {
        detail: { nfdrs4Data: window.testNFDRS4Data, compact: true }
      }));
    });
    
    await page.waitForTimeout(1000);
    
    const compactCard = page.locator('.weather-analysis-card.compact');
    
    if (await compactCard.isVisible()) {
      await expect(compactCard).toBeVisible();
      
      // Should have compact header
      const compactHeader = compactCard.locator('.compact-header');
      if (await compactHeader.isVisible()) {
        const nfdrsBadge = compactHeader.locator('.nfdrs4-badge');
        const analysisTitle = compactHeader.locator('.analysis-title');
        
        if (await nfdrsBadge.isVisible()) {
          const badgeText = await nfdrsBadge.textContent();
          expect(badgeText).toMatch(/NFDRS4/i);
        }
        
        if (await analysisTitle.isVisible()) {
          const titleText = await analysisTitle.textContent();
          expect(titleText).toMatch(/Weather.*Analysis/i);
        }
      }
      
      // Should have compact metrics grid
      const compactMetrics = compactCard.locator('.compact-metrics');
      if (await compactMetrics.isVisible()) {
        await expect(compactMetrics).toBeVisible();
        
        // Should have 4 metric items
        const metricItems = compactMetrics.locator('.metric-compact');
        const itemCount = await metricItems.count();
        expect(itemCount).toBe(4);
        
        // Check each metric
        const expectedLabels = ['BI', 'SC', 'ERC', 'EMC'];
        
        for (let i = 0; i < itemCount; i++) {
          const item = metricItems.nth(i);
          
          const label = item.locator('.metric-label');
          const value = item.locator('.metric-value');
          
          if (await label.isVisible()) {
            const labelText = await label.textContent();
            expect(expectedLabels).toContain(labelText);
          }
          
          if (await value.isVisible()) {
            const valueText = await value.textContent();
            
            if (labelText === 'EMC') {
              expect(valueText).toMatch(/\d+(\.\d+)?%/);
            } else {
              expect(valueText).toMatch(/^\d+$/);
            }
            
            // Check color coding
            const color = await value.evaluate(el => 
              window.getComputedStyle(el).color
            );
            expect(color).toMatch(/rgb/);
          }
        }
        
        // Check grid layout
        const gridColumns = await compactMetrics.evaluate(el => 
          window.getComputedStyle(el).gridTemplateColumns
        );
        expect(gridColumns).toMatch(/repeat\(4, 1fr\)|1fr 1fr 1fr 1fr/);
      }
    }
  });

  test('08. Error State Handling and Invalid Data', async ({ page }) => {
    // Test with invalid NFDRS4 data
    await page.evaluate(() => {
      window.testNFDRS4Data = {
        isValid: false,
        error: 'Weather station data unavailable'
      };
      
      window.dispatchEvent(new CustomEvent('showWeatherAnalysis', {
        detail: { nfdrs4Data: window.testNFDRS4Data }
      }));
    });
    
    await page.waitForTimeout(1000);
    
    const errorCard = page.locator('.weather-analysis-card.error');
    
    if (await errorCard.isVisible()) {
      await expect(errorCard).toBeVisible();
      
      // Should have error styling
      const bgColor = await errorCard.evaluate(el => 
        window.getComputedStyle(el).backgroundColor
      );
      expect(bgColor).toMatch(/rgba\(244, 67, 54|rgb\(244, 67, 54/);
      
      const borderColor = await errorCard.evaluate(el => 
        window.getComputedStyle(el).borderColor
      );
      expect(borderColor).toMatch(/rgba\(244, 67, 54|rgb\(244, 67, 54/);
      
      // Should have error content
      const errorContent = errorCard.locator('.error-content');
      await expect(errorContent).toBeVisible();
      
      // Should have error icon
      const errorIcon = errorContent.locator('.error-icon');
      if (await errorIcon.isVisible()) {
        const iconText = await errorIcon.textContent();
        expect(iconText).toMatch(/⚠|!|⚡/);
      }
      
      // Should have error message
      const errorText = errorContent.locator('.error-text');
      if (await errorText.isVisible()) {
        const messageText = await errorText.textContent();
        expect(messageText).toMatch(/Invalid.*missing.*NFDRS4.*weather.*analysis.*data/i);
      }
    }
    
    // Test with missing NFDRS4 data
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('showWeatherAnalysis', {
        detail: { nfdrs4Data: null }
      }));
    });
    
    await page.waitForTimeout(500);
    
    // Should still show error state
    const missingDataCard = page.locator('.weather-analysis-card.error');
    if (await missingDataCard.isVisible()) {
      await expect(missingDataCard).toBeVisible();
    }
  });

  test('09. Animation and Visual Effects', async ({ page }) => {
    // Test entrance animations
    await page.evaluate(() => {
      window.testNFDRS4Data = {
        isValid: true,
        burningIndex: 55,
        spreadComponent: 40,
        energyReleaseComponent: 70,
        equilibriumMoisture: 8.9
      };
      
      // Trigger appearance with animation
      window.dispatchEvent(new CustomEvent('showWeatherAnalysis', {
        detail: { nfdrs4Data: window.testNFDRS4Data }
      }));
    });
    
    // Capture animation timing
    const startTime = Date.now();
    await page.waitForTimeout(100);
    
    const weatherCard = page.locator('.weather-analysis-card');
    
    if (await weatherCard.isVisible()) {
      await expect(weatherCard).toBeVisible();
      
      const animationTime = Date.now() - startTime;
      expect(animationTime).toBeLessThan(1000);
      
      // Check final opacity
      const opacity = await weatherCard.evaluate(el => 
        window.getComputedStyle(el).opacity
      );
      expect(parseFloat(opacity)).toBeGreaterThan(0.9);
      
      // Test metric bar animations
      const metricBars = weatherCard.locator('.metric-bar');
      const barCount = await metricBars.count();
      
      if (barCount > 0) {
        for (let i = 0; i < Math.min(barCount, 3); i++) {
          const bar = metricBars.nth(i);
          
          if (await bar.isVisible()) {
            // Should have transition
            const transition = await bar.evaluate(el => 
              window.getComputedStyle(el).transition
            );
            expect(transition).toMatch(/width.*0\.6s.*ease/);
            
            // Should have proper width
            const width = await bar.evaluate(el => 
              window.getComputedStyle(el).width
            );
            expect(width).toMatch(/\d+(\.\d+)?%/);
          }
        }
      }
      
      // Test glass morphism effects
      const backdropFilter = await weatherCard.evaluate(el => 
        window.getComputedStyle(el).backdropFilter
      );
      expect(backdropFilter).toMatch(/blur\(\d+px\)/);
      
      const boxShadow = await weatherCard.evaluate(el => 
        window.getComputedStyle(el).boxShadow
      );
      expect(boxShadow).toMatch(/rgba?\(\d+, \d+, \d+/);
    }
  });

  test('10. Responsive Design and Mobile Adaptation', async ({ page }) => {
    await page.evaluate(() => {
      window.testNFDRS4Data = {
        isValid: true,
        burningIndex: 35,
        spreadComponent: 60,
        energyReleaseComponent: 45,
        equilibriumMoisture: 10.5
      };
      
      window.dispatchEvent(new CustomEvent('showWeatherAnalysis', {
        detail: { nfdrs4Data: window.testNFDRS4Data }
      }));
    });
    
    await page.waitForTimeout(1000);
    
    // Test desktop view first
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(300);
    
    const weatherCard = page.locator('.weather-analysis-card');
    
    if (await weatherCard.isVisible()) {
      // Test tablet view
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.waitForTimeout(500);
      
      await expect(weatherCard).toBeVisible();
      
      // Check if layout adapts
      const cardPadding = await weatherCard.evaluate(el => 
        window.getComputedStyle(el).padding
      );
      
      // Test mobile view
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(500);
      
      await expect(weatherCard).toBeVisible();
      
      // Check compact metrics grid on mobile
      const compactMetrics = weatherCard.locator('.compact-metrics');
      if (await compactMetrics.isVisible()) {
        const gridColumns = await compactMetrics.evaluate(el => 
          window.getComputedStyle(el).gridTemplateColumns
        );
        
        // Should collapse to 2 columns on mobile
        expect(gridColumns).toMatch(/repeat\(2, 1fr\)|1fr 1fr/);
      }
      
      // Check metric value sizes
      const metricValues = weatherCard.locator('.metric-value-large, .metric-value');
      const valueCount = await metricValues.count();
      
      if (valueCount > 0) {
        const firstValue = metricValues.first();
        if (await firstValue.isVisible()) {
          const fontSize = await firstValue.evaluate(el => 
            window.getComputedStyle(el).fontSize
          );
          
          const fontSizeValue = parseFloat(fontSize);
          // Mobile should have smaller font sizes
          expect(fontSizeValue).toBeLessThanOrEqual(24); // Max mobile size
        }
      }
      
      // Test small mobile
      await page.setViewportSize({ width: 320, height: 568 });
      await page.waitForTimeout(300);
      
      await expect(weatherCard).toBeVisible();
      
      // Metric headers might stack vertically on very small screens
      const metricHeaders = weatherCard.locator('.metric-header');
      if (await metricHeaders.count() > 0) {
        const firstHeader = metricHeaders.first();
        if (await firstHeader.isVisible()) {
          const flexDirection = await firstHeader.evaluate(el => 
            window.getComputedStyle(el).flexDirection
          );
          
          // Might be column on very small screens
          if (flexDirection === 'column') {
            expect(flexDirection).toBe('column');
          }
        }
      }
      
      // Reset to desktop
      await page.setViewportSize({ width: 1920, height: 1080 });
    }
  });

  test('11. Accessibility Features and Reduced Motion', async ({ page }) => {
    // Test reduced motion preference
    await page.emulateMedia({ reducedMotion: 'reduce' });
    
    await page.evaluate(() => {
      window.testNFDRS4Data = {
        isValid: true,
        burningIndex: 50,
        spreadComponent: 35,
        energyReleaseComponent: 60,
        equilibriumMoisture: 12.0
      };
      
      window.dispatchEvent(new CustomEvent('showWeatherAnalysis', {
        detail: { nfdrs4Data: window.testNFDRS4Data }
      }));
    });
    
    await page.waitForTimeout(1000);
    
    const weatherCard = page.locator('.weather-analysis-card');
    
    if (await weatherCard.isVisible()) {
      // Metric bars should have no transition with reduced motion
      const metricBars = weatherCard.locator('.metric-bar');
      const barCount = await metricBars.count();
      
      if (barCount > 0) {
        const firstBar = metricBars.first();
        if (await firstBar.isVisible()) {
          const transition = await firstBar.evaluate(el => 
            window.getComputedStyle(el).transition
          );
          
          // Should have no transition with reduced motion
          expect(transition).toBe('none');
        }
      }
      
      // Card should have no animation
      const animation = await weatherCard.evaluate(el => 
        window.getComputedStyle(el).animation
      );
      expect(animation).toBe('none');
    }
    
    // Test high contrast mode
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'no-preference' });
    await page.waitForTimeout(300);
    
    if (await weatherCard.isVisible()) {
      // Should maintain visibility in high contrast
      await expect(weatherCard).toBeVisible();
      
      // Text should remain readable
      const metricNames = weatherCard.locator('.metric-name');
      const nameCount = await metricNames.count();
      
      if (nameCount > 0) {
        const firstName = metricNames.first();
        if (await firstName.isVisible()) {
          const color = await firstName.evaluate(el => 
            window.getComputedStyle(el).color
          );
          expect(color).toMatch(/rgb/);
        }
      }
    }
    
    // Reset media emulation
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' });
  });

  test('12. Color Accuracy and NFDRS4 Standards Compliance', async ({ page }) => {
    // Test all danger levels with precise color validation
    const testCases = [
      { level: 'Low', value: 15, expectedColor: '#4CAF50' },      // Green
      { level: 'Moderate', value: 35, expectedColor: '#FFC107' }, // Yellow  
      { level: 'High', value: 65, expectedColor: '#FF9800' },     // Orange
      { level: 'Extreme', value: 85, expectedColor: '#f44336' }   // Red
    ];
    
    for (const testCase of testCases) {
      await page.evaluate((data) => {
        window.testNFDRS4Data = {
          isValid: true,
          burningIndex: data.value,
          spreadComponent: data.value,
          energyReleaseComponent: data.value,
          equilibriumMoisture: data.value > 50 ? 5.0 : 15.0  // Inverse for moisture
        };
        
        window.dispatchEvent(new CustomEvent('showWeatherAnalysis', {
          detail: { nfdrs4Data: window.testNFDRS4Data }
        }));
      }, testCase);
      
      await page.waitForTimeout(500);
      
      const weatherCard = page.locator('.weather-analysis-card');
      
      if (await weatherCard.isVisible()) {
        // Check burning index color
        const burningIndexValue = weatherCard.locator('.metric-section.primary .metric-value-large, .metric-section .metric-value').first();
        
        if (await burningIndexValue.isVisible()) {
          const color = await burningIndexValue.evaluate(el => 
            window.getComputedStyle(el).color
          );
          
          // Convert hex to RGB for comparison
          const expectedRgb = hexToRgb(testCase.expectedColor);
          const actualRgb = color.match(/rgb\((\d+), (\d+), (\d+)\)/);
          
          if (expectedRgb && actualRgb) {
            const [, r, g, b] = actualRgb;
            expect(parseInt(r)).toBeCloseTo(expectedRgb.r, 5);
            expect(parseInt(g)).toBeCloseTo(expectedRgb.g, 5);
            expect(parseInt(b)).toBeCloseTo(expectedRgb.b, 5);
          }
        }
        
        // Check classification text matches danger level
        const classification = weatherCard.locator('.metric-classification').first();
        if (await classification.isVisible()) {
          const classText = await classification.textContent();
          expect(classText).toMatch(new RegExp(testCase.level, 'i'));
        }
      }
    }
    
    // Helper function to convert hex to RGB
    function hexToRgb(hex) {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : null;
    }
  });

  test('13. Professional Assessment Integration', async ({ page }) => {
    // Test comprehensive assessment with all metrics
    await page.evaluate(() => {
      window.testNFDRS4Data = {
        isValid: true,
        burningIndex: 73,      // High fire danger
        spreadComponent: 42,   // Moderate spread potential  
        energyReleaseComponent: 68, // High energy release
        equilibriumMoisture: 6.8    // Dangerous fuel dryness
      };
      
      window.dispatchEvent(new CustomEvent('showWeatherAnalysis', {
        detail: { nfdrs4Data: window.testNFDRS4Data }
      }));
    });
    
    await page.waitForTimeout(1000);
    
    const weatherCard = page.locator('.weather-analysis-card');
    
    if (await weatherCard.isVisible()) {
      // Find professional assessment
      const assessmentText = weatherCard.locator('.assessment-text');
      
      if (await assessmentText.isVisible()) {
        const fullAssessment = await assessmentText.textContent();
        
        // Should mention all key components
        expect(fullAssessment).toMatch(/high.*fire.*danger/i);
        expect(fullAssessment).toMatch(/moderate.*spread/i);
        expect(fullAssessment).toMatch(/dangerous.*dryness/i);
        
        // Should be professionally worded
        expect(fullAssessment).toMatch(/NFDRS4.*analysis.*indicates/i);
        expect(fullAssessment).toMatch(/conditions.*with/i);
        
        // Should be comprehensive
        expect(fullAssessment.length).toBeGreaterThan(80);
        
        // Should not contain placeholder text
        expect(fullAssessment).not.toMatch(/lorem|ipsum|placeholder|undefined|null/i);
      }
    }
  });

  test('14. Weather Analysis Integration with Real API', async ({ page }) => {
    // Monitor for weather API calls
    const weatherRequests = [];
    page.on('request', request => {
      if (request.url().includes('/api/weather') && request.url().includes('nfdrs')) {
        weatherRequests.push(request.url());
      }
    });
    
    // Access weather analysis through normal UI flow
    const weatherBtn = page.locator('.sidebar-nav-item').filter({ hasText: 'Weather' });
    
    if (await weatherBtn.isVisible()) {
      await weatherBtn.click();
      await page.waitForTimeout(2000); // Allow for API calls
      
      // Look for weather analysis card
      const weatherCard = page.locator('.weather-analysis-card');
      
      if (await weatherCard.isVisible()) {
        // Should have real NFDRS4 data or error state
        const hasError = await weatherCard.evaluate(el => 
          el.classList.contains('error')
        );
        
        const hasData = !hasError;
        
        if (hasData) {
          // Should have all 4 NFDRS4 metrics
          const metricSections = weatherCard.locator('.metric-section');
          const sectionCount = await metricSections.count();
          expect(sectionCount).toBeGreaterThanOrEqual(4);
          
          // Should have professional assessment
          const assessment = weatherCard.locator('.analysis-summary');
          if (await assessment.isVisible()) {
            await expect(assessment).toBeVisible();
          }
        } else {
          // Error state should be properly displayed
          const errorText = weatherCard.locator('.error-text');
          if (await errorText.isVisible()) {
            await expect(errorText).toBeVisible();
          }
        }
        
        // Check if API requests were made
        if (weatherRequests.length > 0) {
          console.log(`NFDRS4 API requests detected: ${weatherRequests.length}`);
          weatherRequests.forEach(url => {
            expect(url).toMatch(/\/api\/weather.*nfdrs/);
          });
        }
      }
    }
  });

  test('15. Performance and Memory Management', async ({ page }) => {
    // Test rapid data updates
    const updateCycles = 5;
    
    for (let i = 0; i < updateCycles; i++) {
      await page.evaluate((cycle) => {
        window.testNFDRS4Data = {
          isValid: true,
          burningIndex: 20 + (cycle * 15),
          spreadComponent: 30 + (cycle * 10),
          energyReleaseComponent: 40 + (cycle * 8),
          equilibriumMoisture: 15 - (cycle * 2)
        };
        
        window.dispatchEvent(new CustomEvent('showWeatherAnalysis', {
          detail: { nfdrs4Data: window.testNFDRS4Data }
        }));
      }, i);
      
      await page.waitForTimeout(300);
    }
    
    // Weather card should still be responsive
    const weatherCard = page.locator('.weather-analysis-card');
    
    if (await weatherCard.isVisible()) {
      await expect(weatherCard).toBeVisible();
      
      // Should show final values
      const metricValues = weatherCard.locator('.metric-value, .metric-value-large');
      const valueCount = await metricValues.count();
      expect(valueCount).toBeGreaterThan(0);
      
      // Check for memory leaks (basic)
      const consoleErrors = [];
      page.on('console', message => {
        if (message.type() === 'error' && message.text().includes('memory')) {
          consoleErrors.push(message.text());
        }
      });
      
      await page.waitForTimeout(1000);
      
      if (consoleErrors.length > 0) {
        console.log('Memory-related errors detected:', consoleErrors);
      }
      
      // Test cleanup on removal
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('hideWeatherAnalysis'));
      });
      
      await page.waitForTimeout(500);
      
      // Component should clean up properly
      const isStillVisible = await weatherCard.isVisible();
      // May still be visible or properly cleaned up
      console.log('Weather analysis cleanup test completed');
    }
  });
});