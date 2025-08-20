import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AnimatedFlameLogo from "./animations/logos/AnimatedFlameLogo";

/**
 * Unified flame animation that transitions from center to above I and stays there
 * This consolidates the startup animation and landing flame into one seamless experience
 */
const UnifiedFlameAnimation = ({ onAnimationComplete }) => {
  const [animationPhase, setAnimationPhase] = useState("center"); // 'center', 'moving', 'inPosition'
  const [targetPosition, setTargetPosition] = useState({ x: 0, y: 0 });
  const [showBlackBg, setShowBlackBg] = useState(true);
  
  useEffect(() => {
    // Calculate target position for flame above I
    const calculateTargetPosition = () => {
      // Wait for fonts to load
      document.fonts.ready.then(() => {
        // Create test element to measure I position
        const testEl = document.createElement("div");
        testEl.style.cssText = `
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: clamp(3rem, 8vw, 6rem);
          font-weight: 900;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          letter-spacing: -0.02em;
          line-height: 0.9;
          visibility: hidden;
          white-space: nowrap;
        `;
        
        testEl.innerHTML = `BURNW<span style="position: relative; display: inline-block;">I</span>SE`;
        document.body.appendChild(testEl);
        
        const iSpan = testEl.querySelector("span");
        const iRect = iSpan.getBoundingClientRect();
        const iCenterX = iRect.left + iRect.width / 2;
        const iTop = iRect.top;
        
        document.body.removeChild(testEl);
        
        // Target position for 65px flame, 60px above I
        setTargetPosition({
          x: iCenterX - 32.5 - 6, // Center minus half width minus offset
          y: iTop - 60 - 32.5 // Top of I minus gap minus half flame height
        });
      });
    };
    
    calculateTargetPosition();
    window.addEventListener('resize', calculateTargetPosition);
    
    // Animation timeline
    const timeline = [
      { delay: 2500, action: () => setAnimationPhase("moving") },
      { delay: 4100, action: () => {
        setAnimationPhase("inPosition");
        setShowBlackBg(false);
        if (onAnimationComplete) onAnimationComplete();
      }}
    ];
    
    const timers = timeline.map(({ delay, action }) => 
      setTimeout(action, delay)
    );
    
    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener('resize', calculateTargetPosition);
    };
  }, [onAnimationComplete]);
  
  const flameVariants = {
    center: {
      x: window.innerWidth / 2 - 90,
      y: window.innerHeight / 2 - 90,
      scale: 1,
      opacity: 1,
    },
    moving: {
      x: targetPosition.x,
      y: targetPosition.y,
      scale: 0.361, // Scales 180px to 65px
      opacity: 1,
    },
    inPosition: {
      x: targetPosition.x,
      y: targetPosition.y,
      scale: 0.361,
      opacity: 1,
    }
  };
  
  return (
    <>
      {/* Single flame that animates and stays */}
      <motion.div
        style={{
          position: "fixed",
          zIndex: animationPhase === "inPosition" ? 10 : 9999,
          width: 180,
          height: 180,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
          filter: "drop-shadow(0 0 25px rgba(255, 107, 53, 0.8)) drop-shadow(0 0 15px rgba(255, 87, 34, 0.6))",
        }}
        initial="center"
        animate={animationPhase}
        variants={flameVariants}
        transition={{
          duration: animationPhase === "moving" ? 1.6 : 0,
          ease: animationPhase === "moving" ? [0.4, 0, 0.1, 1] : "linear",
        }}
      >
        <AnimatedFlameLogo size={180} animated={true} />
      </motion.div>
      
      {/* Black background that fades */}
      <AnimatePresence>
        {showBlackBg && (
          <motion.div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              backgroundColor: "#000",
              zIndex: 999998,
              pointerEvents: "none",
            }}
            initial={{ opacity: 1 }}
            animate={{ opacity: animationPhase === "moving" ? 0 : 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.8, ease: "easeOut" }}
          />
        )}
      </AnimatePresence>
    </>
  );
};

export default UnifiedFlameAnimation;