import React, { useState, useEffect } from 'react';
import { motion, useAnimation, AnimatePresence } from 'framer-motion';

const BurnwiseLogoEpicBootup = ({ 
  size = 100, 
  onComplete = () => {} 
}) => {
  const [animationPhase, setAnimationPhase] = useState('entrance');
  const [isComplete, setIsComplete] = useState(false);
  
  const containerControls = useAnimation();
  const flame1Controls = useAnimation();
  const flame2Controls = useAnimation();
  const flame3Controls = useAnimation();
  const glowControls = useAnimation();

  // Epic entrance sequence
  useEffect(() => {
    const runEpicSequence = async () => {
      // Phase 1: MASSIVE dramatic entrance with sequential bounces
      // Start from invisible and tiny
      containerControls.set({ scale: 0, opacity: 0, rotate: -180 });
      
      // First: Explosive appearance with overshoot
      await containerControls.start({
        scale: 1.6,
        opacity: 1,
        rotate: 10,
        transition: {
          duration: 0.4,
          type: "tween",
          ease: [0.68, -0.55, 0.265, 1.55] // Custom cubic-bezier for extreme bounce
        }
      });

      // Second: Massive bounce back with rotation
      await containerControls.start({
        scale: 0.7,
        rotate: -8,
        transition: {
          duration: 0.3,
          type: "tween",
          ease: "easeInOut"
        }
      });

      // Third: Settle with final overshoot
      await containerControls.start({
        scale: 1.15,
        rotate: 2,
        transition: {
          duration: 0.25,
          type: "spring",
          stiffness: 400,
          damping: 25
        }
      });

      // Fourth: Perfect settle
      await containerControls.start({
        scale: 1,
        rotate: 0,
        transition: {
          duration: 0.4,
          type: "spring",
          stiffness: 300,
          damping: 30
        }
      });

      setAnimationPhase('flames');

      // Phase 2: Sequential EXPLOSIVE flame ignitions
      // Flame 1: Main flame with dramatic entrance
      flame1Controls.set({ scale: 0.2, opacity: 0, y: 50, pathLength: 0 });
      const flame1Promise = (async () => {
        await flame1Controls.start({
          scale: 1.8,
          opacity: 0.7,
          y: -15,
          pathLength: 1,
          transition: {
            duration: 0.6,
            type: "tween",
            ease: [0.25, 0.46, 0.45, 0.94]
          }
        });
        await flame1Controls.start({
          scale: 0.8,
          y: 5,
          transition: {
            duration: 0.3,
            type: "spring",
            stiffness: 200,
            damping: 20
          }
        });
        await flame1Controls.start({
          scale: 1,
          opacity: 1,
          y: 0,
          transition: {
            duration: 0.4,
            type: "spring",
            stiffness: 300,
            damping: 25
          }
        });
      })();

      // Flame 2: Secondary flame with rotation
      flame2Controls.set({ scale: 0.1, opacity: 0, y: 60, x: 20, rotate: 15, pathLength: 0 });
      const flame2Promise = (async () => {
        await new Promise(resolve => setTimeout(resolve, 200)); // Delay
        await flame2Controls.start({
          scale: 2.0,
          opacity: 0.6,
          y: -20,
          x: -10,
          rotate: -12,
          pathLength: 1,
          transition: {
            duration: 0.7,
            type: "tween",
            ease: [0.175, 0.885, 0.32, 1.275]
          }
        });
        await flame2Controls.start({
          scale: 0.6,
          y: 10,
          x: 8,
          rotate: 5,
          transition: {
            duration: 0.35,
            type: "spring",
            stiffness: 180,
            damping: 18
          }
        });
        await flame2Controls.start({
          scale: 1,
          opacity: 1,
          y: 0,
          x: 0,
          rotate: 0,
          transition: {
            duration: 0.45,
            type: "spring",
            stiffness: 280,
            damping: 22
          }
        });
      })();

      // Flame 3: Largest flame with most dramatic entrance
      flame3Controls.set({ scale: 0.05, opacity: 0, y: 80, x: -30, rotate: -20, pathLength: 0 });
      const flame3Promise = (async () => {
        await new Promise(resolve => setTimeout(resolve, 400)); // Longer delay
        await flame3Controls.start({
          scale: 2.5,
          opacity: 0.5,
          y: -35,
          x: 15,
          rotate: 18,
          pathLength: 1,
          transition: {
            duration: 0.8,
            type: "tween",
            ease: [0.68, -0.55, 0.265, 1.55] // Extreme overshoot
          }
        });
        await flame3Controls.start({
          scale: 0.5,
          y: 15,
          x: -12,
          rotate: -8,
          transition: {
            duration: 0.4,
            type: "spring",
            stiffness: 160,
            damping: 15
          }
        });
        await flame3Controls.start({
          scale: 1,
          opacity: 1,
          y: 0,
          x: 0,
          rotate: 0,
          transition: {
            duration: 0.5,
            type: "spring",
            stiffness: 250,
            damping: 20
          }
        });
      })();

      await Promise.all([flame1Promise, flame2Promise, flame3Promise]);

      setAnimationPhase('glow');

      // Phase 3: MASSIVE energy surge with cascading effects
      await glowControls.start({
        scale: 1.3,
        filter: "brightness(1.8) saturate(2) drop-shadow(0px 0px 30px rgba(77, 218, 198, 1))",
        transition: {
          duration: 0.6,
          type: "tween",
          ease: "easeOut"
        }
      });

      await glowControls.start({
        scale: 0.9,
        filter: "brightness(1.1) saturate(1.1) drop-shadow(0px 0px 5px rgba(77, 218, 198, 0.3))",
        transition: {
          duration: 0.4,
          type: "spring",
          stiffness: 200,
          damping: 25
        }
      });

      await glowControls.start({
        scale: 1.05,
        filter: "brightness(1.3) saturate(1.4) drop-shadow(0px 0px 15px rgba(77, 218, 198, 0.7))",
        transition: {
          duration: 0.8,
          type: "spring",
          stiffness: 300,
          damping: 35
        }
      });

      setAnimationPhase('flicker');

      // Phase 4: Start continuous realistic flame flicker
      startContinuousFlicker();

      setIsComplete(true);
      onComplete();
    };

    const startContinuousFlicker = () => {
      // Flame 1: Gentle sway
      const flickerFlame1 = () => {
        flame1Controls.start({
          y: Math.random() * 4 - 2,
          x: Math.random() * 2 - 1,
          scale: 1 + (Math.random() * 0.04 - 0.02),
          transition: {
            duration: 1.5 + Math.random() * 1,
            type: "tween",
            ease: "easeInOut"
          }
        }).then(() => {
          if (animationPhase === 'flicker') {
            setTimeout(flickerFlame1, Math.random() * 500);
          }
        });
      };

      // Flame 2: Medium intensity flicker
      const flickerFlame2 = () => {
        flame2Controls.start({
          y: Math.random() * 6 - 3,
          x: Math.random() * 4 - 2,
          scale: 1 + (Math.random() * 0.06 - 0.03),
          rotate: Math.random() * 4 - 2,
          transition: {
            duration: 1.2 + Math.random() * 1.2,
            type: "tween",
            ease: "easeInOut"
          }
        }).then(() => {
          if (animationPhase === 'flicker') {
            setTimeout(flickerFlame2, Math.random() * 600);
          }
        });
      };

      // Flame 3: Most dramatic flicker
      const flickerFlame3 = () => {
        flame3Controls.start({
          y: Math.random() * 8 - 4,
          x: Math.random() * 6 - 3,
          scale: 1 + (Math.random() * 0.08 - 0.04),
          rotate: Math.random() * 6 - 3,
          transition: {
            duration: 1 + Math.random() * 1.4,
            type: "tween",
            ease: "easeInOut"
          }
        }).then(() => {
          if (animationPhase === 'flicker') {
            setTimeout(flickerFlame3, Math.random() * 700);
          }
        });
      };

      // Continuous glow pulse
      const pulseGlow = () => {
        glowControls.start({
          filter: `brightness(${1.2 + Math.random() * 0.3}) saturate(${1.3 + Math.random() * 0.4}) drop-shadow(0px 0px ${10 + Math.random() * 10}px rgba(77, 218, 198, ${0.5 + Math.random() * 0.3}))`,
          transition: {
            duration: 2 + Math.random() * 2,
            type: "tween",
            ease: "easeInOut"
          }
        }).then(() => {
          if (animationPhase === 'flicker') {
            setTimeout(pulseGlow, Math.random() * 1000);
          }
        });
      };

      // Start all flickers
      flickerFlame1();
      setTimeout(flickerFlame2, 300);
      setTimeout(flickerFlame3, 600);
      setTimeout(pulseGlow, 100);
    };

    runEpicSequence();
  }, []);

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={containerControls}
      style={{
        display: 'inline-block',
        transformOrigin: 'center center'
      }}
    >
      <motion.svg
        width={size}
        height={size}
        viewBox="0 0 504 495"
        xmlns="http://www.w3.org/2000/svg"
        animate={glowControls}
        style={{
          overflow: 'visible'
        }}
      >
        <defs>
          {/* Epic static gradient - avoiding animated gradients that cause errors */}
          <linearGradient 
            id="epicTealGradient" 
            x1="0%" 
            y1="0%" 
            x2="100%" 
            y2="0%"
          >
            <stop 
              offset="0%" 
              stopColor="#4DDAC6"
            />
            <stop 
              offset="50%" 
              stopColor="#56DFD0"
            />
            <stop 
              offset="100%" 
              stopColor="#5FE6D3"
            />
          </linearGradient>
          
          {/* Epic glow filter */}
          <filter id="epicGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>

          {/* Particle effect filter */}
          <filter id="particles" x="-100%" y="-100%" width="300%" height="300%">
            <feTurbulence baseFrequency="0.9" numOctaves="4" result="noise"/>
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="2"/>
          </filter>
        </defs>
        
        {/* EXACT POTRACE-GENERATED PATHS WITH EPIC ANIMATIONS */}
        <g transform="translate(0,495) scale(0.1,-0.1)">
          {/* Main flame segment - First to animate */}
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
            fill="url(#epicTealGradient)"
            filter="url(#epicGlow)"
            initial={{ 
              scale: 0.2, 
              opacity: 0,
              pathLength: 0
            }}
            animate={flame1Controls}
            style={{
              transformOrigin: '273px 350px'
            }}
          />
          
          {/* Second flame segment - Delayed animation */}
          <motion.path 
            d="M3146 3272 c-11 -19 -76 -205 -76 -220 0 -8 -13 -42 -29 -76 -16 -33
            -43 -90 -59 -126 -17 -36 -73 -146 -126 -244 -53 -99 -96 -183 -96 -188 0 -4
            -4 -8 -10 -8 -5 0 -9 -3 -8 -7 3 -10 -160 -306 -217 -393 -23 -36 -49 -85 -59
            -110 -10 -25 -28 -65 -42 -89 -13 -24 -23 -46 -21 -47 9 -10 684 547 814 672
            82 78 83 79 73 114 -5 19 -18 96 -30 170 -12 74 -27 169 -35 210 -7 41 -23
            134 -36 205 -22 129 -31 156 -43 137z"
            fill="url(#epicTealGradient)"
            filter="url(#epicGlow)"
            initial={{ 
              scale: 0.1, 
              opacity: 0,
              pathLength: 0
            }}
            animate={flame2Controls}
            style={{
              transformOrigin: '314px 270px'
            }}
          />
          
          {/* Third flame segment - Most delayed animation */}
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
            fill="url(#epicTealGradient)"
            filter="url(#epicGlow)"
            initial={{ 
              scale: 0.05, 
              opacity: 0,
              pathLength: 0
            }}
            animate={flame3Controls}
            style={{
              transformOrigin: '354px 200px'
            }}
          />
        </g>

        {/* EPIC PARTICLE EXPLOSION EFFECTS */}
        <AnimatePresence>
          {animationPhase === 'glow' && (
            <>
              {/* Main particle burst */}
              <motion.g
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {[...Array(20)].map((_, i) => {
                  const angle = (i / 20) * Math.PI * 2;
                  const distance = 50 + Math.random() * 100;
                  const endX = Math.cos(angle) * distance;
                  const endY = Math.sin(angle) * distance;
                  
                  return (
                    <motion.circle
                      key={`burst-${i}`}
                      cx={252}
                      cy={247}
                      r={2 + Math.random() * 3}
                      fill={Math.random() > 0.5 ? "#4DDAC6" : "#5FE6D3"}
                      initial={{ 
                        scale: 0, 
                        opacity: 0,
                        cx: 252,
                        cy: 247
                      }}
                      animate={{
                        scale: [0, 1.5, 0],
                        opacity: [0, 1, 0],
                        cx: 252 + endX,
                        cy: 247 + endY
                      }}
                      transition={{
                        duration: 1.5 + Math.random() * 1,
                        delay: i * 0.05,
                        ease: "easeOut"
                      }}
                    />
                  );
                })}
              </motion.g>

              {/* Secondary sparkle particles */}
              <motion.g
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {[...Array(15)].map((_, i) => (
                  <motion.g key={`sparkle-${i}`}>
                    <motion.circle
                      cx={200 + Math.random() * 104}
                      cy={200 + Math.random() * 95}
                      r="1"
                      fill="#FFFFFF"
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{
                        scale: [0, 2, 1, 2, 0],
                        opacity: [0, 1, 0.5, 1, 0]
                      }}
                      transition={{
                        duration: 2,
                        delay: 0.5 + i * 0.1,
                        ease: "easeInOut"
                      }}
                    />
                    {/* Cross sparkle effect */}
                    <motion.line
                      x1={200 + Math.random() * 104}
                      y1={200 + Math.random() * 95 - 5}
                      x2={200 + Math.random() * 104}
                      y2={200 + Math.random() * 95 + 5}
                      stroke="#FFFFFF"
                      strokeWidth="0.5"
                      initial={{ opacity: 0, scaleY: 0 }}
                      animate={{
                        opacity: [0, 1, 0],
                        scaleY: [0, 1, 0]
                      }}
                      transition={{
                        duration: 1,
                        delay: 0.8 + i * 0.1,
                        ease: "easeInOut"
                      }}
                    />
                    <motion.line
                      x1={200 + Math.random() * 104 - 5}
                      y1={200 + Math.random() * 95}
                      x2={200 + Math.random() * 104 + 5}
                      y2={200 + Math.random() * 95}
                      stroke="#FFFFFF"
                      strokeWidth="0.5"
                      initial={{ opacity: 0, scaleX: 0 }}
                      animate={{
                        opacity: [0, 1, 0],
                        scaleX: [0, 1, 0]
                      }}
                      transition={{
                        duration: 1,
                        delay: 0.8 + i * 0.1,
                        ease: "easeInOut"
                      }}
                    />
                  </motion.g>
                ))}
              </motion.g>

              {/* Epic energy rings */}
              <motion.g
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {[...Array(3)].map((_, i) => (
                  <motion.circle
                    key={`ring-${i}`}
                    cx={252}
                    cy={247}
                    r={20}
                    fill="none"
                    stroke="#4DDAC6"
                    strokeWidth="2"
                    strokeOpacity={0.6}
                    initial={{ 
                      scale: 0, 
                      opacity: 0,
                      strokeOpacity: 0.8
                    }}
                    animate={{
                      scale: [0, 5, 8],
                      opacity: [0, 0.8, 0],
                      strokeOpacity: [0.8, 0.3, 0]
                    }}
                    transition={{
                      duration: 2,
                      delay: i * 0.3,
                      ease: "easeOut"
                    }}
                  />
                ))}
              </motion.g>
            </>
          )}

          {/* Continuous flicker particles */}
          {animationPhase === 'flicker' && (
            <motion.g
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {[...Array(6)].map((_, i) => (
                <motion.circle
                  key={`flicker-${i}`}
                  cx={220 + Math.random() * 64}
                  cy={230 + Math.random() * 50}
                  r={1 + Math.random()}
                  fill="#4DDAC6"
                  animate={{
                    opacity: [0.2, 0.8, 0.3, 0.9, 0.1],
                    scale: [0.5, 1.2, 0.8, 1.5, 0.6],
                    y: [0, -10, 5, -15, 0]
                  }}
                  transition={{
                    duration: 3 + Math.random() * 2,
                    repeat: Infinity,
                    delay: i * 0.5,
                    ease: "easeInOut"
                  }}
                />
              ))}
            </motion.g>
          )}
        </AnimatePresence>
      </motion.svg>
    </motion.div>
  );
};

export default BurnwiseLogoEpicBootup;