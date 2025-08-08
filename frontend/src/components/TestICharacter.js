import React, { useEffect } from 'react';

const TestICharacter = () => {
  useEffect(() => {
    const timer = setTimeout(() => {
      const iChar = document.querySelector('.i-char');
      const heroTitle = document.querySelector('.hero-title');
      
      if (iChar && heroTitle) {
        const iStyles = window.getComputedStyle(iChar);
        const titleStyles = window.getComputedStyle(heroTitle);
        
        console.log('===== I CHARACTER DEBUG =====');
        console.log('I Text Content:', iChar.textContent);
        console.log('I innerHTML:', iChar.innerHTML);
        
        console.log('\n--- I Character Styles ---');
        console.log('Color:', iStyles.color);
        console.log('WebkitTextFillColor:', iStyles.webkitTextFillColor);
        console.log('TextShadow:', iStyles.textShadow);
        console.log('Display:', iStyles.display);
        console.log('Position:', iStyles.position);
        console.log('FontSize:', iStyles.fontSize);
        console.log('FontWeight:', iStyles.fontWeight);
        
        console.log('\n--- Parent Title Styles ---');
        console.log('Color:', titleStyles.color);
        console.log('WebkitTextFillColor:', titleStyles.webkitTextFillColor);
        console.log('TextShadow:', titleStyles.textShadow);
        
        // Check if text is actually there
        const textNode = iChar.childNodes[0];
        if (textNode && textNode.nodeType === Node.TEXT_NODE) {
          console.log('\nText node found:', textNode.nodeValue);
        } else {
          console.log('\nNO TEXT NODE FOUND!');
        }
      }
    }, 5000);
    
    return () => clearTimeout(timer);
  }, []);
  
  return null;
};

export default TestICharacter;