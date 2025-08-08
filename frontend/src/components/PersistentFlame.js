import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import AnimatedFlameLogo from "./AnimatedFlameLogo";

/**
 * A single flame that animates from center to above I and STAYS there
 * This creates one continuous experience, not two separate pages
 */
const PersistentFlame = ({ onAnimationPhaseComplete }) => {
  const [phase, setPhase] = useState("center"); // 'center', 'moving', 'static'
  const [targetPosition, setTargetPosition] = useState({ x: 0, y: 0 });
  const [iCharElement, setICharElement] = useState(null);
  
  useEffect(() => {
    // Calculate position of I character in BURNWISE text
    const calculateInitialTarget = () => {
      const burnwiseTitle = document.getElementById('burnwise-title');
      if (!burnwiseTitle) {
        // Fallback if element not found yet
        setTimeout(calculateInitialTarget, 100);
        return;
      }
      
      const titleRect = burnwiseTitle.getBoundingClientRect();
      const titleStyles = window.getComputedStyle(burnwiseTitle);
      
      // Create canvas to measure text width up to "I"
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      ctx.font = `${titleStyles.fontWeight} ${titleStyles.fontSize} ${titleStyles.fontFamily}`;
      
      // Measure width of "BURNW" to find where "I" starts
      const beforeIWidth = ctx.measureText('BURNW').width;
      const iWidth = ctx.measureText('I').width;
      
      // Calculate I position
      const iCenterX = titleRect.left + beforeIWidth + (iWidth / 2);
      const iTop = titleRect.top;
      
      // Position flame 60px above the I
      const targetTop = iTop - 60;
      
      setTargetPosition({
        x: iCenterX - 90 - 6, // Center the unscaled flame on I with offset
        y: targetTop - 57.5 // Position for correct scaled location
      });
    };
    
    // Calculate initial position immediately
    if (document.fonts.ready) {
      document.fonts.ready.then(calculateInitialTarget);
    } else {
      calculateInitialTarget();
    }
    
    // Update position on resize
    const handleResize = () => {
      calculateInitialTarget();
    };
    
    window.addEventListener('resize', handleResize);
    
    // Animation timeline
    const timeline = setTimeout(() => {
      setPhase("moving");
    }, 2500);
    
    const complete = setTimeout(() => {
      setPhase("static");
      if (onAnimationPhaseComplete) {
        onAnimationPhaseComplete();
      }
    }, 4100);
    
    return () => {
      clearTimeout(timeline);
      clearTimeout(complete);
      window.removeEventListener('resize', handleResize);
    };
  }, [iCharElement, onAnimationPhaseComplete]);
  
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
    static: {
      x: targetPosition.x,
      y: targetPosition.y,
      scale: 0.361,
      opacity: 1,
    }
  };
  
  return (
    <motion.div
      style={{
        position: "fixed",
        zIndex: phase === "static" ? 10 : 999999,
        width: 180,
        height: 180,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
        filter: "drop-shadow(0 0 25px rgba(255, 107, 53, 0.8)) drop-shadow(0 0 15px rgba(255, 87, 34, 0.6))",
      }}
      initial="center"
      animate={phase}
      variants={flameVariants}
      transition={{
        duration: phase === "moving" ? 1.6 : 0,
        ease: phase === "moving" ? [0.4, 0, 0.1, 1] : "linear",
      }}
    >
      <AnimatedFlameLogo size={180} animated={true} />
    </motion.div>
  );
};

export default PersistentFlame;