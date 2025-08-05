import React, { useEffect, useState } from 'react';
import { motion, useAnimation } from 'framer-motion';
import BurnwiseLogoPotraceExact from './BurnwiseLogoPotraceExact';

const BurnwiseCinematicBootup = ({ onComplete }) => {
  const [currentPhase, setCurrentPhase] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  
  // Individual animation controls for each flame
  const flame1Controls = useAnimation();
  const flame2Controls = useAnimation();
  const flame3Controls = useAnimation();
  const logoControls = useAnimation();
  const backgroundControls = useAnimation();
  const emberControls = useAnimation();

  useEffect(() => {
    // Check if this is the first visit
    const hasSeenBootup = localStorage.getItem('burnwise-bootup-seen');
    
    if (hasSeenBootup) {
      // Skip bootup for returning users
      setIsVisible(false);
      onComplete && onComplete();
      return;
    }

    // Mark as seen
    localStorage.setItem('burnwise-bootup-seen', 'true');
    
    // Start the cinematic sequence
    startCinematicSequence();
  }, []);

  const startCinematicSequence = async () => {
    try {
      // Phase 0: Initial darkness (0-1s)
      setCurrentPhase(0);
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Phase 1: Logo appears huge with dark background (1-2s)
      setCurrentPhase(1);
      await logoControls.start({
        scale: 3,
        opacity: 1,
        transition: {
          duration: 1,
          type: "tween",
          ease: [0.25, 0.46, 0.45, 0.94]
        }
      });

      // Phase 2: INDEPENDENT flame ignitions (2-4s) - Each flame has personality!
      setCurrentPhase(2);
      
      const flame1Promise = (async () => {
        await flame1Controls.start({
          scale: 2.0,
          opacity: 0.8,
          y: -20,
          x: -10,
          rotate: -15,
          transition: {
            duration: 0.8,
            type: "tween",
            ease: [0.25, 0.46, 0.45, 0.94]
          }
        });
        
        // Flame 1 second movement - more aggressive
        await flame1Controls.start({
          scale: 1.8,
          y: -35,
          x: -25,
          rotate: -25,
          transition: {
            duration: 0.6,
            type: "spring",
            damping: 15,
            stiffness: 100
          }
        });
      })();

      const flame2Promise = (async () => {
        await new Promise(resolve => setTimeout(resolve, 300)); // Offset start
        await flame2Controls.start({
          scale: 2.5,
          opacity: 0.9,
          y: -40,
          x: 5,
          rotate: 10,
          transition: {
            duration: 1.0,
            type: "tween",
            ease: [0.19, 1, 0.22, 1]
          }
        });
        
        // Flame 2 second movement - central dominance
        await flame2Controls.start({
          scale: 2.2,
          y: -55,
          x: 0,
          rotate: 0,
          transition: {
            duration: 0.7,
            type: "spring",
            damping: 12,
            stiffness: 120
          }
        });
      })();

      const flame3Promise = (async () => {
        await new Promise(resolve => setTimeout(resolve, 600)); // Later offset
        await flame3Controls.start({
          scale: 1.9,
          opacity: 0.85,
          y: -25,
          x: 15,
          rotate: 20,
          transition: {
            duration: 0.9,
            type: "tween",
            ease: [0.68, -0.55, 0.265, 1.55]
          }
        });
        
        // Flame 3 second movement - playful
        await flame3Controls.start({
          scale: 1.7,
          y: -30,
          x: 30,
          rotate: 30,
          transition: {
            duration: 0.5,
            type: "spring",
            damping: 18,
            stiffness: 90
          }
        });
      })();

      // Wait for all flame animations
      await Promise.all([flame1Promise, flame2Promise, flame3Promise]);

      // Phase 3: Ember effects (4-5s)
      setCurrentPhase(3);
      await emberControls.start({
        opacity: 1,
        scale: 1,
        transition: {
          duration: 0.5,
          type: "tween"
        }
      });

      // Phase 4: Background lightening (5-6s)
      setCurrentPhase(4);
      await backgroundControls.start({
        opacity: 0.3,
        transition: {
          duration: 1,
          type: "tween"
        }
      });

      // Phase 5: Logo moves to final position (6-7s)
      setCurrentPhase(5);
      await Promise.all([
        logoControls.start({
          scale: 1,
          x: 0,
          y: 0,
          transition: {
            duration: 1,
            type: "spring",
            damping: 20,
            stiffness: 100
          }
        }),
        flame1Controls.start({
          scale: 1,
          x: 0,
          y: 0,
          rotate: 0,
          opacity: 1,
          transition: {
            duration: 1,
            type: "spring",
            damping: 20,
            stiffness: 100
          }
        }),
        flame2Controls.start({
          scale: 1,
          x: 0,
          y: 0,
          rotate: 0,
          opacity: 1,
          transition: {
            duration: 1,
            type: "spring",
            damping: 20,
            stiffness: 100
          }
        }),
        flame3Controls.start({
          scale: 1,
          x: 0,
          y: 0,
          rotate: 0,
          opacity: 1,
          transition: {
            duration: 1,
            type: "spring",
            damping: 20,
            stiffness: 100
          }
        })
      ]);

      // Phase 6: Fade out overlay (7-8s)
      setCurrentPhase(6);
      await backgroundControls.start({
        opacity: 0,
        transition: {
          duration: 1,
          type: "tween"
        }
      });

      // Complete
      setIsVisible(false);
      onComplete && onComplete();

    } catch (error) {
      console.error('Cinematic bootup error:', error);
      setIsVisible(false);
      onComplete && onComplete();
    }
  };

  if (!isVisible) {
    return null;
  }

  return (
    <motion.div
      className="cinematic-bootup-overlay"
      initial={{ opacity: 1 }}
      animate={backgroundControls}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: '#000',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden'
      }}
    >
      {/* Ember Effects */}
      <motion.div
        className="ember-container"
        animate={emberControls}
        initial={{ opacity: 0, scale: 0 }}
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          pointerEvents: 'none'
        }}
      >
        {[...Array(50)].map((_, i) => (
          <motion.div
            key={i}
            className="ember"
            initial={{
              x: Math.random() * window.innerWidth,
              y: window.innerHeight + 50,
              opacity: 0
            }}
            animate={{
              y: -50,
              opacity: [0, 1, 0],
              x: Math.random() * window.innerWidth + (Math.random() - 0.5) * 200
            }}
            transition={{
              duration: Math.random() * 3 + 2,
              delay: Math.random() * 2,
              repeat: Infinity,
              ease: "linear"
            }}
            style={{
              position: 'absolute',
              width: '3px',
              height: '3px',
              background: 'linear-gradient(45deg, #FF6B35, #FFB000)',
              borderRadius: '50%',
              boxShadow: '0 0 6px #FF6B35'
            }}
          />
        ))}
      </motion.div>

      {/* Main Logo with Individual Flame Controls */}
      <motion.div
        className="bootup-logo-container"
        animate={logoControls}
        initial={{ 
          scale: 0, 
          opacity: 0,
          x: 0,
          y: 0
        }}
        style={{
          position: 'relative',
          filter: 'drop-shadow(0 0 50px rgba(255, 107, 53, 0.8))'
        }}
      >
        <svg
          width="200"
          height="200"
          viewBox="0 0 400 400"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="bootupFireGradient1" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#FF4500" />
              <stop offset="40%" stopColor="#FF6B35" />
              <stop offset="70%" stopColor="#FF8C42" />
              <stop offset="100%" stopColor="#FFB000" />
            </linearGradient>
            
            <linearGradient id="bootupFireGradient2" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FF6B35" />
              <stop offset="50%" stopColor="#FF5722" />
              <stop offset="100%" stopColor="#FF4500" />
            </linearGradient>
            
            <linearGradient id="bootupFireGradient3" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#FFB000" />
              <stop offset="50%" stopColor="#FF8C42" />
              <stop offset="100%" stopColor="#FF6B35" />
            </linearGradient>

            <filter id="bootupGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="8" result="coloredBlur"/>
              <feMerge> 
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          {/* Individual Flame Controls */}
          <motion.g animate={flame1Controls} initial={{ scale: 0, opacity: 0 }}>
            <path
              d="M120.5 350.2c-15.8-8.2-28.9-22.1-35.7-38.3-6.8-16.2-7.2-34.8-1.1-51.3 6.1-16.5 18.1-30.9 33.2-39.7 15.1-8.8 33.3-11.1 50.1-6.3 16.8 4.8 31.3 15.6 40.1 29.8 8.8 14.2 11.9 31.8 8.6 48.5-3.3 16.7-12.3 31.6-24.8 41.1-12.5 9.5-28.4 13.6-43.8 11.3-15.4-2.3-29.4-10.1-38.9-21.5z"
              fill="url(#bootupFireGradient1)"
              filter="url(#bootupGlow)"
            />
          </motion.g>

          <motion.g animate={flame2Controls} initial={{ scale: 0, opacity: 0 }}>
            <path
              d="M200.1 330.8c-18.2-12.4-32.1-30.2-38.9-50.1-6.8-19.9-6.7-42.1 0.3-61.9 7.0-19.8 21.2-36.3 39.1-45.7 17.9-9.4 39.5-10.9 59.5-4.1 20.0 6.8 37.3 20.8 47.8 38.7 10.5 17.9 13.2 39.7 7.4 60.1-5.8 20.4-18.4 38.4-34.8 49.7-16.4 11.3-36.6 15.9-55.7 12.7-19.1-3.2-36.2-13.7-47.8-28.9z"
              fill="url(#bootupFireGradient2)"
              filter="url(#bootupGlow)"
            />
          </motion.g>

          <motion.g animate={flame3Controls} initial={{ scale: 0, opacity: 0 }}>
            <path
              d="M280.3 345.1c-14.1-6.9-26.2-18.4-33.2-31.8-7.0-13.4-8.9-29.7-5.2-44.9 3.7-15.2 12.8-28.3 25.1-36.2 12.3-7.9 27.9-10.5 43.0-7.1 15.1 3.4 28.6 12.0 37.2 23.7 8.6 11.7 12.4 26.5 10.5 40.8-1.9 14.3-8.7 27.1-18.7 35.3-10.0 8.2-23.2 11.9-36.4 10.2-13.2-1.7-25.4-8.2-33.8-17.8z"
              fill="url(#bootupFireGradient3)"
              filter="url(#bootupGlow)"
            />
          </motion.g>
        </svg>
      </motion.div>

      {/* Phase indicator for debugging */}
      {process.env.NODE_ENV === 'development' && (
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          color: 'white',
          fontFamily: 'monospace',
          fontSize: '12px',
          opacity: 0.5
        }}>
          Phase: {currentPhase}
        </div>
      )}
    </motion.div>
  );
};

export default BurnwiseCinematicBootup;