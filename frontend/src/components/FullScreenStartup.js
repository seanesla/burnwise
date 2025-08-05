import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useAnimation, useMotionValue, useTransform } from 'framer-motion';
import AnimatedFlameLogo from './AnimatedFlameLogo';
import './FullScreenStartup.css';

const FullScreenStartup = ({ onComplete }) => {
  const [phase, setPhase] = useState('initial');
  const controls = useAnimation();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const scale = useMotionValue(0);
  const logoRef = useRef(null);
  
  const progress = useTransform(scale, [0, 1], [0, 100]);
  
  useEffect(() => {
    const performAnimation = async () => {
      const centerX = window.innerWidth / 2 - 250;
      const centerY = window.innerHeight / 2 - 250;
      
      x.set(centerX);
      y.set(centerY);
      
      // Phase 1: Dramatic ignition (0-1.5s)
      setPhase('ignition');
      await controls.start({
        scale: [0, 1.3, 0.95, 1.1, 1],
        opacity: [0, 0.8, 1, 1, 1],
        filter: [
          "blur(30px) brightness(3) saturate(0)",
          "blur(10px) brightness(2) saturate(1.5)",
          "blur(5px) brightness(1.5) saturate(2)",
          "blur(2px) brightness(1.2) saturate(1.5)",
          "blur(0px) brightness(1) saturate(1)"
        ],
        transition: {
          duration: 1.5,
          times: [0, 0.3, 0.5, 0.8, 1],
          ease: [0.43, 0.13, 0.23, 0.96]
        }
      });
      
      // Phase 2: Dramatic hold with pulse (1.5-2.5s)
      setPhase('pulse');
      await controls.start({
        scale: [1, 1.08, 1, 1.05, 1],
        filter: [
          "blur(0px) brightness(1) drop-shadow(0 0 80px rgba(255, 107, 53, 0.8))",
          "blur(0px) brightness(1.1) drop-shadow(0 0 120px rgba(255, 107, 53, 1))",
          "blur(0px) brightness(1) drop-shadow(0 0 80px rgba(255, 107, 53, 0.8))",
          "blur(0px) brightness(1.05) drop-shadow(0 0 100px rgba(255, 107, 53, 0.9))",
          "blur(0px) brightness(1) drop-shadow(0 0 80px rgba(255, 107, 53, 0.8))"
        ],
        transition: { 
          duration: 1,
          times: [0, 0.25, 0.5, 0.75, 1],
          ease: "easeInOut"
        }
      });
      
      // Phase 3: Calculate target and fly to navbar (2.5-3.5s)
      setPhase('flight');
      
      // Wait for navbar to be rendered
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const navbarLogo = document.querySelector('.hero-logo');
      if (navbarLogo) {
        const rect = navbarLogo.getBoundingClientRect();
        const targetX = rect.left + rect.width / 2 - 60; // Center of 120px logo
        const targetY = rect.top + rect.height / 2 - 60;
        
        await controls.start({
          x: targetX,
          y: targetY,
          scale: 0.24, // 120px / 500px
          filter: [
            "blur(0px) brightness(1) drop-shadow(0 0 80px rgba(255, 107, 53, 0.8))",
            "blur(3px) brightness(1.2) drop-shadow(0 0 60px rgba(255, 107, 53, 0.6))",
            "blur(0px) brightness(1) drop-shadow(0 0 20px rgba(255, 107, 53, 0.6))"
          ],
          transition: {
            duration: 1,
            times: [0, 0.5, 1],
            x: { type: "spring", damping: 25, stiffness: 120 },
            y: { type: "spring", damping: 25, stiffness: 120 },
            scale: { ease: [0.43, 0.13, 0.23, 0.96] },
            filter: { ease: "easeOut" }
          }
        });
      }
      
      // Phase 4: Complete
      setPhase('complete');
      setTimeout(() => {
        localStorage.setItem('burnwise-bootup-seen', 'true');
        onComplete();
      }, 300);
    };
    
    performAnimation();
  }, [controls, x, y, onComplete]);
  
  return (
    <AnimatePresence>
      {phase !== 'complete' && (
        <motion.div
          className="fullscreen-startup"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          <motion.div
            ref={logoRef}
            className="startup-logo-container"
            animate={controls}
            style={{ x, y }}
            initial={{
              scale: 0,
              opacity: 0,
              position: 'absolute',
              width: 500,
              height: 500,
              filter: "blur(30px) brightness(3)"
            }}
          >
            <AnimatedFlameLogo size={500} animated={true} startupAnimation={phase === 'ignition'} />
            
            {/* Additional effects layer */}
            <motion.div 
              className="startup-effects"
              initial={{ opacity: 0 }}
              animate={{ 
                opacity: phase === 'pulse' ? [0.5, 0.8, 0.5] : 0,
                scale: phase === 'pulse' ? [1, 1.2, 1] : 1
              }}
              transition={{ 
                duration: 1,
                repeat: phase === 'pulse' ? 1 : 0,
                ease: "easeInOut" 
              }}
            />
          </motion.div>
          
          {/* Background fade effect */}
          <motion.div
            className="startup-background"
            initial={{ opacity: 0 }}
            animate={{ 
              opacity: phase === 'ignition' ? 1 : phase === 'flight' ? 0 : 0.8
            }}
            transition={{ duration: 0.8 }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default FullScreenStartup;