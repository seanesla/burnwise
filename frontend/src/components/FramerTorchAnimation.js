import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AnimatedFlameLogo from './AnimatedFlameLogo';

const FramerTorchAnimation = ({ onComplete }) => {
  const [phase, setPhase] = useState('center'); // 'center', 'morphing', 'complete'
  const [positions, setPositions] = useState({
    start: { x: 0, y: 0 },
    end: { x: 0, y: 0 }
  });
  const containerRef = useRef(null);
  
  useEffect(() => {
    // Measure the exact position of "I" in BURNWISE
    const measureTarget = () => {
      // Create a hidden element matching Landing.js structure
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
      `;
      
      // Match Landing.js structure: BURNW[I]SE
      testEl.innerHTML = `
        <span style="position: relative; display: inline-block;">
          BURNW<span style="position: relative; display: inline-block;">I</span>SE
        </span>
      `;
      document.body.appendChild(testEl);
      
      // Get the I span
      const iSpan = testEl.querySelector('span span');
      const iRect = iSpan.getBoundingClientRect();
      
      // Calculate offset from viewport center
      const viewportCenterX = window.innerWidth / 2;
      const viewportCenterY = window.innerHeight / 2;
      
      // The flame center should align with I center
      const iCenterX = iRect.left + iRect.width / 2;
      const iTop = iRect.top;
      
      document.body.removeChild(testEl);
      
      // Return absolute positions
      // When scaled to 0.36, the 180px element becomes 64.8px
      // So we need to position it so its center aligns with I
      const scaledSize = 180 * 0.36;
      const halfScaledSize = scaledSize / 2;
      
      return {
        start: {
          x: viewportCenterX - 90, // Center minus half of 180px width
          y: viewportCenterY - 90  // Center minus half of 180px height
        },
        end: {
          // Position so scaled element's center aligns with I center
          // Since Framer Motion scales from center, we need to account for that
          x: iCenterX - 90, // Keep original offset, scaling will handle the rest
          y: iTop - 65 - 90 // 65px above text, accounting for original size
        }
      };
    };
    
    // Wait for fonts to load
    document.fonts.ready.then(() => {
      const positions = measureTarget();
      setPositions(positions);
      
      // Start animation sequence
      setTimeout(() => {
        setPhase('morphing');
      }, 2500); // Hold at center for 2.5s
      
      setTimeout(() => {
        setPhase('complete');
        if (onComplete) onComplete();
      }, 4000); // Complete morph at 4s
    });
  }, [onComplete]);
  
  const variants = {
    center: {
      left: positions.start.x,
      top: positions.start.y,
      scale: 1,
      opacity: 1,
    },
    morph: {
      left: positions.end.x,
      top: positions.end.y,
      scale: 0.36,
      opacity: 1,
    },
    fade: {
      left: positions.end.x,
      top: positions.end.y,
      scale: 0.36,
      opacity: 0,
    }
  };
  
  return (
    <AnimatePresence>
      {phase !== 'complete' && (
        <motion.div
          ref={containerRef}
          style={{
            position: 'fixed',
            zIndex: 999999,
            width: 180,
            height: 180,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          initial="center"
          animate={phase === 'morphing' ? 'morph' : 'center'}
          exit="fade"
          variants={variants}
          transition={{
            duration: 1.5,
            ease: [0.4, 0, 0.2, 1] // Cubic bezier for smooth morph
          }}
        >
          <AnimatedFlameLogo size={180} animated={true} />
        </motion.div>
      )}
      
      {/* Black background that fades */}
      {phase !== 'complete' && (
        <motion.div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: '#000',
            zIndex: 999998
          }}
          initial={{ opacity: 1 }}
          animate={{ 
            opacity: phase === 'morphing' ? 0 : 1 
          }}
          exit={{ opacity: 0 }}
          transition={{
            duration: 1.8,
            ease: 'easeOut'
          }}
        />
      )}
    </AnimatePresence>
  );
};

export default FramerTorchAnimation;