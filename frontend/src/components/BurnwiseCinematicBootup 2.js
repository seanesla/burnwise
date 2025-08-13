import React, { useState, useEffect } from 'react';
import { motion, useAnimation, AnimatePresence } from 'framer-motion';

const BurnwiseCinematicBootup = ({ 
  onComplete = () => {} 
}) => {
  const [phase, setPhase] = useState('entrance'); // entrance, fire-transform, background-reveal, complete
  const [isVisible, setIsVisible] = useState(true);
  
  const overlayControls = useAnimation();
  const containerControls = useAnimation();
  const flame1Controls = useAnimation();
  const flame2Controls = useAnimation();
  const flame3Controls = useAnimation();
  const emberControls = useAnimation();

  useEffect(() => {
    const runCinematicSequence = async () => {
      // Phase 1: MASSIVE container entrance (0-1.33s) - sped up from 2s
      containerControls.set({ 
        scale: 0, 
        opacity: 0, 
        rotate: -180
      });

      // Set individual flames to invisible initially
      flame1Controls.set({ scale: 0, opacity: 0, y: 100, x: -50, rotate: -45 });
      flame2Controls.set({ scale: 0, opacity: 0, y: 120, x: 0, rotate: 0 });
      flame3Controls.set({ scale: 0, opacity: 0, y: 140, x: 50, rotate: 45 });

      overlayControls.set({
        background: "radial-gradient(circle, rgba(0,0,0,1) 0%, rgba(0,0,0,0.95) 100%)"
      });

      // Explosive container entrance
      await containerControls.start({
        scale: 3.0, // MASSIVE - fills most of viewport
        opacity: 1,
        rotate: 10,
        transition: {
          duration: 0.4, // was 0.6
          type: "tween",
          ease: [0.68, -0.55, 0.265, 1.55]
        }
      });

      // Container bounce back
      await containerControls.start({
        scale: 2.2,
        rotate: -8,
        transition: {
          duration: 0.27, // was 0.4
          type: "spring",
          stiffness: 300,
          damping: 20
        }
      });

      // Container settle at massive size
      await containerControls.start({
        scale: 2.8,
        rotate: 0,
        transition: {
          duration: 0.33, // was 0.5
          type: "spring",
          stiffness: 400,
          damping: 25
        }
      });

      setPhase('fire-transform');

      // Phase 2: INDEPENDENT flame ignitions (1.33-2.67s) - sped up from 2-4s
      
      // Flame 1: First to ignite - dramatic entrance from bottom-left
      const flame1Promise = (async () => {
        await flame1Controls.start({
          scale: 2.0,
          opacity: 0.8,
          y: -20,
          x: -10,
          rotate: -15,
          transition: {
            duration: 0.53, // was 0.8
            type: "tween",
            ease: [0.25, 0.46, 0.45, 0.94]
          }
        });
        await flame1Controls.start({
          scale: 0.7,
          y: 10,
          x: 5,
          rotate: -5,
          transition: {
            duration: 0.27, // was 0.4
            type: "spring",
            stiffness: 200,
            damping: 18
          }
        });
        await flame1Controls.start({
          scale: 1,
          opacity: 1,
          y: 0,
          x: 0,
          rotate: 0,
          transition: {
            duration: 0.33, // was 0.5
            type: "spring",
            stiffness: 300,
            damping: 25
          }
        });
      })();

      // Flame 2: Second to ignite - comes from straight down with rotation
      const flame2Promise = (async () => {
        await new Promise(resolve => setTimeout(resolve, 200)); // was 300
        await flame2Controls.start({
          scale: 2.5,
          opacity: 0.6,
          y: -30,
          x: -15,
          rotate: 20,
          transition: {
            duration: 0.6, // was 0.9
            type: "tween",
            ease: [0.175, 0.885, 0.32, 1.275]
          }
        });
        await flame2Controls.start({
          scale: 0.6,
          y: 15,
          x: 10,
          rotate: -10,
          transition: {
            duration: 0.23, // was 0.35
            type: "spring",
            stiffness: 180,
            damping: 16
          }
        });
        await flame2Controls.start({
          scale: 1,
          opacity: 1,
          y: 0,
          x: 0,
          rotate: 0,
          transition: {
            duration: 0.3, // was 0.45
            type: "spring",
            stiffness: 280,
            damping: 22
          }
        });
      })();

      // Flame 3: Last and most dramatic - biggest overshoot
      const flame3Promise = (async () => {
        await new Promise(resolve => setTimeout(resolve, 400)); // was 600
        await flame3Controls.start({
          scale: 3.0,
          opacity: 0.5,
          y: -40,
          x: 25,
          rotate: -25,
          transition: {
            duration: 0.67, // was 1.0
            type: "tween",
            ease: [0.68, -0.55, 0.265, 1.55] // Most extreme bounce
          }
        });
        await flame3Controls.start({
          scale: 0.5,
          y: 20,
          x: -15,
          rotate: 15,
          transition: {
            duration: 0.27, // was 0.4
            type: "spring",
            stiffness: 160,
            damping: 14
          }
        });
        await flame3Controls.start({
          scale: 1,
          opacity: 1,
          y: 0,
          x: 0,
          rotate: 0,
          transition: {
            duration: 0.33, // was 0.5
            type: "spring",
            stiffness: 250,
            damping: 20
          }
        });
      })();

      await Promise.all([flame1Promise, flame2Promise, flame3Promise]);

      // Intense fire glow surge on all flames
      await Promise.all([
        flame1Controls.start({
          filter: "brightness(2.0) saturate(2.2) drop-shadow(0px 0px 30px rgba(255, 69, 0, 1))",
          transition: { duration: 0.4, type: "tween", ease: "easeOut" } // was 0.6
        }),
        flame2Controls.start({
          filter: "brightness(2.2) saturate(2.4) drop-shadow(0px 0px 35px rgba(255, 140, 0, 1))",
          transition: { duration: 0.4, type: "tween", ease: "easeOut", delay: 0.07 } // was 0.6, 0.1
        }),
        flame3Controls.start({
          filter: "brightness(2.4) saturate(2.6) drop-shadow(0px 0px 40px rgba(255, 180, 0, 1))",
          transition: { duration: 0.4, type: "tween", ease: "easeOut", delay: 0.13 } // was 0.6, 0.2
        })
      ]);

      setPhase('background-reveal');

      // Phase 3: Background revelation and logo positioning (2.67-4s) - sped up from 4-6s
      const backgroundPromise = overlayControls.start({
        background: [
          "radial-gradient(circle, rgba(0,0,0,1) 0%, rgba(0,0,0,0.95) 100%)",
          "radial-gradient(circle, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.6) 100%)",
          "radial-gradient(circle, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.2) 100%)",
          "radial-gradient(circle, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 100%)"
        ],
        transition: {
          duration: 1.33, // was 2.0
          ease: "easeInOut"
        }
      });

      // Move container to exact hero logo position
      const containerPositionPromise = containerControls.start({
        scale: 0.6, // Size to match hero logo (120px equivalent)
        y: -80, // Move up to hero section position
        x: 0,
        transition: {
          duration: 1.2, // was 1.8
          type: "spring",
          stiffness: 200,
          damping: 25
        }
      });

      // Settle flame glows
      const flameGlowPromise = Promise.all([
        flame1Controls.start({
          filter: "brightness(1.3) saturate(1.4) drop-shadow(0px 0px 15px rgba(255, 69, 0, 0.6))",
          transition: { duration: 0.53, type: "spring", stiffness: 250, damping: 30 } // was 0.8
        }),
        flame2Controls.start({
          filter: "brightness(1.4) saturate(1.5) drop-shadow(0px 0px 18px rgba(255, 140, 0, 0.7))",
          transition: { duration: 0.53, type: "spring", stiffness: 250, damping: 30, delay: 0.07 } // was 0.8, 0.1
        }),
        flame3Controls.start({
          filter: "brightness(1.5) saturate(1.6) drop-shadow(0px 0px 20px rgba(255, 180, 0, 0.8))",
          transition: { duration: 0.53, type: "spring", stiffness: 250, damping: 30, delay: 0.13 } // was 0.8, 0.2
        })
      ]);

      await Promise.all([backgroundPromise, containerPositionPromise, flameGlowPromise]);

      setPhase('complete');

      // Phase 4: Final polish and continuous effects (4-4.67s) - sped up from 6-7s
      startEmberEffects();

      // Fade out overlay completely
      await overlayControls.start({
        opacity: 0,
        transition: {
          duration: 0.53, // was 0.8
          ease: "easeOut"
        }
      });

      // Remove overlay and complete
      setTimeout(() => {
        setIsVisible(false);
        onComplete();
      }, 133); // was 200
    };

    runCinematicSequence();
  }, []);

  const startEmberEffects = () => {
    // Realistic ember particles that float upward
    emberControls.start({
      opacity: 1,
      transition: {
        duration: 0.33 // was 0.5
      }
    });
  };

  if (!isVisible) return null;

  return (
    <motion.div
      className="cinematic-bootup-overlay"
      animate={overlayControls}
      initial={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: "radial-gradient(circle, rgba(0,0,0,1) 0%, rgba(0,0,0,0.95) 100%)"
      }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      {/* Main logo container */}
      <motion.div
        animate={containerControls}
        style={{
          transformOrigin: 'center center'
        }}
      >
        <svg
          width="200"
          height="200"
          viewBox="0 0 504 495"
          xmlns="http://www.w3.org/2000/svg"
          style={{
            overflow: 'visible'
          }}
        >
          <defs>
            {/* EPIC FIRE GRADIENT - Red to Orange to Yellow */}
            <linearGradient 
              id="fireGradient" 
              x1="0%" 
              y1="0%" 
              x2="100%" 
              y2="0%"
            >
              <stop 
                offset="0%" 
                stopColor="#FF4500" // Deep red/orange
              />
              <stop 
                offset="40%" 
                stopColor="#FF6B35" // Burning orange
              />
              <stop 
                offset="70%" 
                stopColor="#FF8C42" // Bright orange
              />
              <stop 
                offset="100%" 
                stopColor="#FFB000" // Yellow-orange
              />
            </linearGradient>
            
            {/* Fire glow filter */}
            <filter id="fireGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          
          {/* EXACT POTRACE-GENERATED PATHS WITH INDEPENDENT FLAME CONTROLS */}
          <g transform="translate(0,495) scale(0.1,-0.1)">
            {/* Flame 1: Main flame segment - individual control */}
            <motion.path 
              d="M2737 4632 c-3 -4 -8 -63 -11 -132 -14 -249 -52 -487 -95 -585 -5
              -11 -21 -53 -37 -94 -65 -170 -236 -386 -615 -776 -153 -158 -236 -248 -293
              -318 -34 -42 -38 -52 -32 -85 10 -66 104 -368 152 -488 25 -64 47 -124 49
              -133 5 -26 37 -104 53 -129 l15 -24 26 33 c14 18 32 45 41 60 61 110 424 667
              580 889 33 47 103 153 157 235 53 83 100 152 105 153 4 2 8 10 8 17 0 7 3 15
              8 17 4 2 20 29 36 62 16 32 35 63 41 70 13 13 95 149 95 158 0 3 29 58 65 122
              36 64 65 123 65 131 0 8 -31 79 -69 157 -37 79 -92 193 -121 253 -29 61 -56
              112 -61 113 -5 2 -9 12 -9 23 0 17 -89 197 -111 225 -5 6 -7 13 -6 15 2 2 -4
              12 -14 21 -10 10 -20 14 -22 10z"
              fill="url(#fireGradient)"
              filter="url(#fireGlow)"
              animate={flame1Controls}
              style={{
                transformOrigin: '273px 350px'
              }}
            />
            
            {/* Flame 2: Second flame segment - individual control */}
            <motion.path 
              d="M3146 3272 c-11 -19 -76 -205 -76 -220 0 -8 -13 -42 -29 -76 -16 -33
              -43 -90 -59 -126 -17 -36 -73 -146 -126 -244 -53 -99 -96 -183 -96 -188 0 -4
              -4 -8 -10 -8 -5 0 -9 -3 -8 -7 3 -10 -160 -306 -217 -393 -23 -36 -49 -85 -59
              -110 -10 -25 -28 -65 -42 -89 -13 -24 -23 -46 -21 -47 9 -10 684 547 814 672
              82 78 83 79 73 114 -5 19 -18 96 -30 170 -12 74 -27 169 -35 210 -7 41 -23
              134 -36 205 -22 129 -31 156 -43 137z"
              fill="url(#fireGradient)"
              filter="url(#fireGlow)"
              animate={flame2Controls}
              style={{
                transformOrigin: '314px 270px'
              }}
            />
            
            {/* Flame 3: Third flame segment - individual control */}
            <motion.path 
              d="M3545 2476 c-11 -7 -24 -14 -30 -15 -5 -1 -24 -15 -42 -31 -17 -17
              -36 -30 -41 -30 -6 0 -12 -4 -14 -8 -1 -5 -39 -30 -83 -57 -44 -26 -108 -69
              -142 -94 -35 -25 -65 -44 -68 -41 -2 3 -10 -2 -17 -11 -7 -8 -60 -49 -118 -89
              -115 -81 -320 -230 -355 -258 -111 -89 -147 -116 -150 -112 -2 3 -10 -2 -17
              -11 -7 -9 -35 -33 -63 -54 -102 -79 -177 -149 -186 -172 -5 -13 -18 -81 -29
              -151 -30 -177 -29 -170 -35 -237 -3 -33 -10 -61 -15 -63 -5 -2 -7 -9 -4 -16 3
              -7 -7 -66 -22 -132 -47 -213 -48 -224 -36 -236 9 -9 12 -9 12 1 0 15 138 181
              151 181 5 0 9 5 9 11 0 11 7 20 145 169 158 170 381 430 544 633 30 37 58 67
              63 67 4 0 8 6 8 14 0 8 9 21 20 29 11 8 18 16 15 18 -2 3 16 26 41 53 24 27
              44 51 45 55 0 3 29 40 64 81 106 124 385 497 385 514 0 10 -15 7 -35 -8z"
              fill="url(#fireGradient)"
              filter="url(#fireGlow)"
              animate={flame3Controls}
              style={{
                transformOrigin: '354px 200px'
              }}
            />
          </g>
        </svg>
      </motion.div>

      {/* Realistic ember effects */}
      <AnimatePresence>
        {phase === 'complete' && (
          <motion.div
            className="ember-effects"
            initial={{ opacity: 0 }}
            animate={emberControls}
            style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              pointerEvents: 'none'
            }}
          >
            {[...Array(12)].map((_, i) => {
              const startX = 45 + Math.random() * 10; // Start near logo center
              const startY = 55 + Math.random() * 10;
              const endX = startX + (Math.random() - 0.5) * 20;
              const endY = startY - 20 - Math.random() * 30; // Float upward
              
              return (
                <motion.div
                  key={`ember-${i}`}
                  style={{
                    position: 'absolute',
                    left: `${startX}%`,
                    top: `${startY}%`,
                    width: '3px',
                    height: '3px',
                    background: i % 3 === 0 ? '#FF4500' : i % 3 === 1 ? '#FF6B35' : '#FFB000',
                    borderRadius: '50%',
                    boxShadow: `0 0 6px ${i % 3 === 0 ? '#FF4500' : i % 3 === 1 ? '#FF6B35' : '#FFB000'}`
                  }}
                  animate={{
                    x: `${endX - startX}%`,
                    y: `${endY - startY}%`,
                    opacity: [0, 0.8, 0.6, 0],
                    scale: [0.5, 1, 0.8, 0.3]
                  }}
                  transition={{
                    duration: 2 + Math.random() * 1.33, // was 3 + Math.random() * 2
                    repeat: Infinity,
                    delay: i * 0.2, // was i * 0.3
                    ease: "easeOut"
                  }}
                />
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default BurnwiseCinematicBootup;