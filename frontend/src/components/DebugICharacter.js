import React, { useEffect } from 'react';

const DebugICharacter = () => {
  useEffect(() => {
    // Debug the I character visibility
    const iChar = document.querySelector('.i-char');
    if (iChar) {
      const computedStyles = window.getComputedStyle(iChar);
      console.log('🔍 I Character Debug:', {
        element: iChar,
        textContent: iChar.textContent,
        color: computedStyles.color,
        fontSize: computedStyles.fontSize,
        fontWeight: computedStyles.fontWeight,
        display: computedStyles.display,
        visibility: computedStyles.visibility,
        opacity: computedStyles.opacity,
        textShadow: computedStyles.textShadow,
        webkitTextFillColor: computedStyles.webkitTextFillColor,
        background: computedStyles.background,
        position: computedStyles.position,
        zIndex: computedStyles.zIndex,
        boundingRect: iChar.getBoundingClientRect()
      });
      
      // Check parent title styles
      const heroTitle = document.querySelector('.hero-title');
      if (heroTitle) {
        const titleStyles = window.getComputedStyle(heroTitle);
        console.log('🔍 Hero Title Styles:', {
          color: titleStyles.color,
          webkitTextFillColor: titleStyles.webkitTextFillColor,
        });
      }
    }
  }, []);
  
  return null;
};

export default DebugICharacter;