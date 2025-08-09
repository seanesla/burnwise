import React, { useEffect, useState } from 'react';
import { motion, useAnimation } from 'framer-motion';
import AnimatedFlameLogo from './animations/logos/AnimatedFlameLogo';

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

      {/* Main Logo with Animated Flame */}
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
        <AnimatedFlameLogo 
          size={200} 
          animated={true} 
          startupAnimation={true}
        />
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