import React, { useEffect, useState } from 'react';

const DebugFlamePosition = () => {
  const [measurements, setMeasurements] = useState(null);

  useEffect(() => {
    // Wait for fonts to load
    document.fonts.ready.then(() => {
      // Create test element matching Landing.js title structure
      const testEl = document.createElement('div');
      testEl.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: clamp(3rem, 8vw, 6rem);
        font-weight: 900;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        letter-spacing: -0.02em;
        white-space: nowrap;
        line-height: 0.9;
        color: transparent;
        pointer-events: none;
      `;

      testEl.innerHTML = `BURNW<span style="position: relative; display: inline;">I</span>SE`;
      document.body.appendChild(testEl);

      const iSpan = testEl.querySelector('span');
      const iRect = iSpan.getBoundingClientRect();
      const iTop = iRect.top;

      // PRECISE CALCULATION:
      // From FramerTorchAnimation.js:
      // - Unscaled element (180px) positioned at: y = iTop - 140
      // - Scale factor: 0.36
      // - Scaled size: 180 * 0.36 = 64.8px ≈ 65px
      
      // Step by step:
      const unscaledTop = iTop - 140;
      const unscaledHeight = 180;
      const unscaledCenter = unscaledTop + (unscaledHeight / 2); // iTop - 140 + 90 = iTop - 50
      
      const scaleFactor = 0.36;
      const scaledHeight = unscaledHeight * scaleFactor; // 65px
      const scaledCenter = unscaledCenter; // Center stays same during scale transform
      const scaledTop = scaledCenter - (scaledHeight / 2); // iTop - 50 - 32.5 = iTop - 82.5
      
      // The animation ends with flame TOP at: iTop - 82.5
      // For CSS relative to I top, we need: top: -82.5px
      const requiredCSSTop = scaledTop - iTop; // -82.5

      document.body.removeChild(testEl);

      setMeasurements({
        iTop: iTop.toFixed(2),
        unscaledTop: unscaledTop.toFixed(2),
        unscaledCenter: unscaledCenter.toFixed(2),
        scaledCenter: scaledCenter.toFixed(2),
        scaledTop: scaledTop.toFixed(2),
        flameTopRelativeToI: (scaledTop - iTop).toFixed(2),
        requiredCSSValue: requiredCSSTop.toFixed(1)
      });
    });
  }, []);

  if (!measurements) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 10,
      right: 10,
      background: 'rgba(0,0,0,0.9)',
      color: '#0f0',
      padding: '10px',
      fontFamily: 'monospace',
      fontSize: '12px',
      zIndex: 999999,
      border: '1px solid #0f0'
    }}>
      <div>DEBUG: Flame Position Calculation</div>
      <div>=====================================</div>
      <div>I character top: {measurements.iTop}px</div>
      <div>Unscaled (180px) top: {measurements.unscaledTop}px</div>
      <div>Unscaled center: {measurements.unscaledCenter}px</div>
      <div>Scaled (0.36) center: {measurements.scaledCenter}px</div>
      <div>Scaled flame top: {measurements.scaledTop}px</div>
      <div>-------------------------------------</div>
      <div style={{color: '#ff0'}}>
        Animation ends at: I top + {measurements.flameTopRelativeToI}px
      </div>
      <div style={{color: '#ff0'}}>
        Required CSS: top: {measurements.requiredCSSValue}px
      </div>
    </div>
  );
};

export default DebugFlamePosition;