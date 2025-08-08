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
    // Calculate initial target position based on where I will be
    const calculateInitialTarget = () => {
      // Create test element to measure where I will be
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
      
      // For 180px element that scales to 0.361 (65px)
      // We need to position the unscaled element such that when scaled,
      // it appears 60px above the I
      const scaledHeight = 65;
      const targetTop = iTop - 60; // Where we want the flame top to be
      
      // When scaling from center, the scaled element's top will be at:
      // center - (scaledHeight / 2)
      // So we need: center - 32.5 = targetTop
      // Therefore: center = targetTop + 32.5
      // And unscaled top = center - 90 = targetTop + 32.5 - 90 = targetTop - 57.5
      
      setTargetPosition({
        x: iCenterX - 90 - 6, // Center the unscaled element on I with offset
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