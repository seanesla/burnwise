// Utility to measure exact flame position after animation
export const measureFlameEndPosition = () => {
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
    visibility: hidden;
    pointer-events: none;
    white-space: nowrap;
    line-height: 0.9;
  `;

  // Match exact Landing.js structure
  testEl.innerHTML = `BURNW<span style="position: relative; display: inline;">I</span>SE`;
  document.body.appendChild(testEl);

  const iSpan = testEl.querySelector('span');
  const iRect = iSpan.getBoundingClientRect();
  
  // Get positions
  const iTop = iRect.top;
  const iHeight = iRect.height;
  
  // Animation ends with 180px element at y: iTop - 140
  // When scaled to 0.36, element becomes 65px
  // Top of scaled element = iTop - 140
  // But scale happens from center, so:
  // Center of unscaled = iTop - 140 + 90 = iTop - 50
  // After scale(0.36): height becomes 65px, so half is 32.5px
  // Top of scaled = center - 32.5 = iTop - 50 - 32.5 = iTop - 82.5
  
  // For Landing.js flame (65px, positioned relative to I top):
  // We need flame top to be at same position as animation end
  // Animation flame top after scale = iTop - 82.5
  // Static flame top = iTop + cssTopValue
  // Therefore: cssTopValue = -82.5
  
  document.body.removeChild(testEl);
  
  console.log('Measurements:', {
    iTop,
    iHeight,
    animationEndTop: iTop - 140,
    scaledFlameTop: iTop - 82.5,
    requiredCSSTop: -82.5
  });
  
  return -82.5;
};