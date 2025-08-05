import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, animate } from 'framer-motion';
import AnimatedFlameLogo from './AnimatedFlameLogo';
import './FullScreenStartup.css';

const FullScreenStartup = ({ onComplete }) => {
  const [phase, setPhase] = useState('initial');
  const containerRef = useRef(null);
  
  // Motion values for individual fragments - unified system 
  const mainX = useMotionValue(-100);
  const mainY = useMotionValue(50);
  const mainRotate = useMotionValue(-45);
  const mainScale = useMotionValue(0);
  const mainOpacity = useMotionValue(0);
  
  const middleX = useMotionValue(150);
  const middleY = useMotionValue(-80);
  const middleRotate = useMotionValue(90);
  const middleScale = useMotionValue(0);
  const middleOpacity = useMotionValue(0);
  
  const smallX = useMotionValue(-50);
  const smallY = useMotionValue(-120);
  const smallRotate = useMotionValue(-120);
  const smallScale = useMotionValue(0);
  const smallOpacity = useMotionValue(0);
  
  // Path morphing motion values for dynamic shape changes
  const mainPathMorph = useMotionValue(0);
  const middlePathMorph = useMotionValue(0);
  const smallPathMorph = useMotionValue(0);
  
  // SVG path definitions for morphing
  const flamePathVariants = {
    // Main flame variations
    mainPaths: [
      // Original calm flame
      "M2737 4632 c-3 -4 -8 -63 -11 -132 -14 -249 -52 -487 -95 -585 -5 -11 -21 -53 -37 -94 -65 -170 -236 -386 -615 -776 -153 -158 -236 -248 -293 -318 -34 -42 -38 -52 -32 -85 10 -66 104 -368 152 -488 25 -64 47 -124 49 -133 5 -26 37 -104 53 -129 l15 -24 26 33 c14 18 32 45 41 60 61 110 424 667 580 889 33 47 103 153 157 235 53 83 100 152 105 153 4 2 8 10 8 17 0 7 3 15 8 17 4 2 20 29 36 62 16 32 35 63 41 70 13 13 95 149 95 158 0 3 29 58 65 122 36 64 65 123 65 131 0 8 -31 79 -69 157 -37 79 -92 193 -121 253 -29 61 -56 112 -61 113 -5 2 -9 12 -9 23 0 17 -89 197 -111 225 -5 6 -7 13 -6 15 2 2 -4 12 -14 21 -10 10 -20 14 -22 10z",
      // Ignition burst - expanded flame
      "M2737 4732 c-3 -4 -8 -63 -11 -232 -14 -349 -52 -587 -95 -685 -5 -11 -21 -53 -37 -124 -65 -200 -236 -416 -615 -856 -153 -188 -236 -278 -293 -348 -34 -52 -38 -62 -32 -95 10 -76 104 -398 152 -518 25 -74 47 -134 49 -143 5 -36 37 -114 53 -139 l15 -34 26 43 c14 28 32 55 41 70 61 140 424 697 580 919 33 57 103 163 157 245 53 93 100 162 105 163 4 2 8 10 8 17 0 7 3 15 8 17 4 2 20 39 36 72 16 42 35 73 41 80 13 23 95 159 95 168 0 3 29 68 65 132 36 74 65 133 65 141 0 8 -31 89 -69 167 -37 89 -92 203 -121 263 -29 71 -56 122 -61 123 -5 2 -9 12 -9 23 0 17 -89 207 -111 235 -5 6 -7 13 -6 15 2 2 -4 12 -14 21 -10 10 -20 14 -22 10z",
      // Living flame - flickering
      "M2737 4672 c-3 -4 -8 -63 -11 -172 -14 -289 -52 -527 -95 -625 -5 -11 -21 -53 -37 -104 -65 -180 -236 -396 -615 -816 -153 -168 -236 -258 -293 -328 -34 -47 -38 -57 -32 -90 10 -71 104 -378 152 -498 25 -69 47 -129 49 -138 5 -31 37 -109 53 -134 l15 -29 26 38 c14 23 32 50 41 65 61 125 424 677 580 899 33 52 103 158 157 240 53 88 100 157 105 158 4 2 8 10 8 17 0 7 3 15 8 17 4 2 20 34 36 67 16 37 35 68 41 75 13 18 95 154 95 163 0 3 29 63 65 127 36 69 65 128 65 136 0 8 -31 84 -69 162 -37 84 -92 198 -121 258 -29 66 -56 117 -61 118 -5 2 -9 12 -9 23 0 17 -89 202 -111 230 -5 6 -7 13 -6 15 2 2 -4 12 -14 21 -10 10 -20 14 -22 10z"
    ],
    // Middle flame variations
    middlePaths: [
      // Original
      "M3146 3272 c-11 -19 -76 -205 -76 -220 0 -8 -13 -42 -29 -76 -16 -33 -43 -90 -59 -126 -17 -36 -73 -146 -126 -244 -53 -99 -96 -183 -96 -188 0 -4 -4 -8 -10 -8 -5 0 -9 -3 -8 -7 3 -10 -160 -306 -217 -393 -23 -36 -49 -85 -59 -110 -10 -25 -28 -65 -42 -89 -13 -24 -23 -46 -21 -47 9 -10 684 547 814 672 82 78 83 79 73 114 -5 19 -18 96 -30 170 -12 74 -27 169 -35 210 -7 41 -23 134 -36 205 -22 129 -31 156 -43 137z",
      // Ignition burst
      "M3146 3372 c-11 -29 -76 -225 -76 -240 0 -8 -13 -52 -29 -86 -16 -43 -43 -100 -59 -136 -17 -46 -73 -156 -126 -254 -53 -109 -96 -193 -96 -198 0 -4 -4 -8 -10 -8 -5 0 -9 -3 -8 -7 3 -10 -160 -316 -217 -403 -23 -46 -49 -95 -59 -120 -10 -35 -28 -75 -42 -99 -13 -34 -23 -56 -21 -57 9 -10 684 557 814 682 82 88 83 89 73 124 -5 29 -18 106 -30 180 -12 84 -27 179 -35 220 -7 51 -23 144 -36 215 -22 139 -31 166 -43 147z",
      // Living flame
      "M3146 3312 c-11 -24 -76 -215 -76 -230 0 -8 -13 -47 -29 -81 -16 -38 -43 -95 -59 -131 -17 -41 -73 -151 -126 -249 -53 -104 -96 -188 -96 -193 0 -4 -4 -8 -10 -8 -5 0 -9 -3 -8 -7 3 -10 -160 -311 -217 -398 -23 -41 -49 -90 -59 -115 -10 -30 -28 -70 -42 -94 -13 -29 -23 -51 -21 -52 9 -10 684 552 814 677 82 83 83 84 73 119 -5 24 -18 101 -30 175 -12 79 -27 174 -35 215 -7 46 -23 139 -36 210 -22 134 -31 161 -43 142z"
    ],
    // Small flame variations  
    smallPaths: [
      // Original
      "M3545 2476 c-11 -7 -24 -14 -30 -15 -5 -1 -24 -15 -42 -31 -17 -17 -36 -30 -41 -30 -6 0 -12 -4 -14 -8 -1 -5 -39 -30 -83 -57 -44 -26 -108 -69 -142 -94 -35 -25 -65 -44 -68 -41 -2 3 -10 -2 -17 -11 -7 -8 -60 -49 -118 -89 -115 -81 -320 -230 -355 -258 -111 -89 -147 -116 -150 -112 -2 3 -10 -2 -17 -11 -7 -9 -35 -33 -63 -54 -102 -79 -177 -149 -186 -172 -5 -13 -18 -81 -29 -151 -30 -177 -29 -170 -35 -237 -3 -33 -10 -61 -15 -63 -5 -2 -7 -9 -4 -16 3 -7 -7 -66 -22 -132 -47 -213 -48 -224 -36 -236 9 -9 12 -9 12 1 0 15 138 181 151 181 5 0 9 5 9 11 0 11 7 20 145 169 158 170 381 430 544 633 30 37 58 67 63 67 4 0 8 6 8 14 0 8 9 21 20 29 11 8 18 16 15 18 -2 3 16 26 41 53 24 27 44 51 45 55 0 3 29 40 64 81 106 124 385 497 385 514 0 10 -15 7 -35 -8z",
      // Ignition burst
      "M3545 2576 c-11 -7 -24 -14 -30 -15 -5 -1 -24 -15 -42 -31 -17 -17 -36 -30 -41 -30 -6 0 -12 -4 -14 -8 -1 -5 -39 -30 -83 -57 -44 -26 -108 -79 -142 -104 -35 -35 -65 -54 -68 -51 -2 3 -10 -2 -17 -11 -7 -8 -60 -59 -118 -99 -115 -91 -320 -240 -355 -268 -111 -99 -147 -126 -150 -122 -2 3 -10 -2 -17 -11 -7 -9 -35 -43 -63 -64 -102 -89 -177 -159 -186 -182 -5 -13 -18 -91 -29 -161 -30 -187 -29 -180 -35 -247 -3 -43 -10 -71 -15 -73 -5 -2 -7 -9 -4 -16 3 -7 -7 -76 -22 -142 -47 -223 -48 -234 -36 -246 9 -9 12 -9 12 1 0 15 138 191 151 191 5 0 9 5 9 11 0 11 7 20 145 179 158 180 381 440 544 643 30 47 58 77 63 77 4 0 8 6 8 14 0 8 9 21 20 29 11 8 18 16 15 18 -2 3 16 36 41 63 24 37 44 61 45 65 0 3 29 50 64 91 106 134 385 507 385 524 0 10 -15 7 -35 -8z",
      // Living flame
      "M3545 2516 c-11 -7 -24 -14 -30 -15 -5 -1 -24 -15 -42 -31 -17 -17 -36 -30 -41 -30 -6 0 -12 -4 -14 -8 -1 -5 -39 -30 -83 -57 -44 -26 -108 -74 -142 -99 -35 -30 -65 -49 -68 -46 -2 3 -10 -2 -17 -11 -7 -8 -60 -54 -118 -94 -115 -86 -320 -235 -355 -263 -111 -94 -147 -121 -150 -117 -2 3 -10 -2 -17 -11 -7 -9 -35 -38 -63 -59 -102 -84 -177 -154 -186 -177 -5 -13 -18 -86 -29 -156 -30 -182 -29 -175 -35 -242 -3 -38 -10 -66 -15 -68 -5 -2 -7 -9 -4 -16 3 -7 -7 -71 -22 -137 -47 -218 -48 -229 -36 -241 9 -9 12 -9 12 1 0 15 138 186 151 186 5 0 9 5 9 11 0 11 7 20 145 174 158 175 381 435 544 638 30 42 58 72 63 72 4 0 8 6 8 14 0 8 9 21 20 29 11 8 18 16 15 18 -2 3 16 31 41 58 24 32 44 56 45 60 0 3 29 45 64 86 106 129 385 502 385 519 0 10 -15 7 -35 -8z"
    ]
  };
  
  useEffect(() => {
    const performAnimation = async () => {
      console.log('Starting unified spring-based animation');
      
      // Phase 1: Fragment Assembly with Spring Physics (0-2s)
      setPhase('assembly');
      
      // Spring configuration for organic movement
      const springConfig = { type: "spring", stiffness: 300, damping: 40, mass: 1 };
      
      // Staggered assembly with spring physics
      await Promise.all([
        animate(mainX, 0, { ...springConfig, delay: 0 }),
        animate(mainY, 0, { ...springConfig, delay: 0 }),
        animate(mainRotate, 0, { ...springConfig, delay: 0 }),
        animate(mainScale, 1, { ...springConfig, delay: 0 }),
        animate(mainOpacity, 1, { ...springConfig, delay: 0 }),
        
        animate(middleX, 0, { ...springConfig, delay: 0.2 }),
        animate(middleY, 0, { ...springConfig, delay: 0.2 }),
        animate(middleRotate, 0, { ...springConfig, delay: 0.2 }),
        animate(middleScale, 1, { ...springConfig, delay: 0.2 }),
        animate(middleOpacity, 1, { ...springConfig, delay: 0.2 }),
        
        animate(smallX, 0, { ...springConfig, delay: 0.4 }),
        animate(smallY, 0, { ...springConfig, delay: 0.4 }),
        animate(smallRotate, 0, { ...springConfig, delay: 0.4 }),
        animate(smallScale, 1, { ...springConfig, delay: 0.4 }),
        animate(smallOpacity, 1, { ...springConfig, delay: 0.4 }),
      ]);
      
      // Phase 2: Ignition Burst with Organic Spring + Path Morphing (2-3s)
      setPhase('ignition');
      
      // More energetic spring for ignition
      const ignitionSpring = { type: "spring", stiffness: 400, damping: 30, mass: 0.8 };
      
      // Explosive separation with spring physics + shape morphing
      await Promise.all([
        // Position animations
        animate(mainX, [-20, 0], { ...ignitionSpring }),
        animate(mainY, [-30, 0], { ...ignitionSpring }),
        animate(mainScale, [1.2, 1], { ...ignitionSpring }),
        
        animate(middleX, [40, 0], { ...ignitionSpring }),
        animate(middleY, [-20, 0], { ...ignitionSpring }),
        animate(middleScale, [1.3, 1], { ...ignitionSpring }),
        
        animate(smallX, [-30, 0], { ...ignitionSpring }),
        animate(smallY, [40, 0], { ...ignitionSpring }),
        animate(smallScale, [1.4, 1], { ...ignitionSpring }),
        
        // Path morphing to ignition shapes
        animate(mainPathMorph, 1, { ...ignitionSpring }),
        animate(middlePathMorph, 1, { ...ignitionSpring }),
        animate(smallPathMorph, 1, { ...ignitionSpring }),
      ]);
      
      // Phase 3: Living Flame with Organic Motion + Shape Flickering (3-4s)
      setPhase('living');
      
      // Gentle oscillation with spring physics
      const livingSpring = { type: "spring", stiffness: 200, damping: 50, mass: 1.2 };
      
      // Independent fragment movements with springs + shape flickering
      await Promise.all([
        // Main fragment gentle sway
        animate(mainX, [0, -5, 5, 0], { ...livingSpring, duration: 1 }),
        animate(mainY, [0, -3, 3, 0], { ...livingSpring, duration: 1 }),
        animate(mainRotate, [0, -2, 2, 0], { ...livingSpring, duration: 1 }),
        
        // Middle fragment more active
        animate(middleX, [0, 8, -8, 0], { ...livingSpring, duration: 0.8 }),
        animate(middleY, [0, -5, 5, 0], { ...livingSpring, duration: 0.8 }),
        animate(middleRotate, [0, 3, -3, 0], { ...livingSpring, duration: 0.8 }),
        
        // Small fragment most active
        animate(smallX, [0, -10, 10, 0], { ...livingSpring, duration: 0.6 }),
        animate(smallY, [0, 8, -8, 0], { ...livingSpring, duration: 0.6 }),
        animate(smallRotate, [0, -5, 5, 0], { ...livingSpring, duration: 0.6 }),
        
        // Shape morphing to living flame variations
        animate(mainPathMorph, 2, { ...livingSpring, duration: 1 }),
        animate(middlePathMorph, 2, { ...livingSpring, duration: 0.8 }),
        animate(smallPathMorph, 2, { ...livingSpring, duration: 0.6 }),
      ]);
      
      // Phase 4: Flight to navbar with Spring Physics (4-5s)
      setPhase('flight');
      
      const navbarLogo = document.querySelector('.hero-logo');
      if (navbarLogo) {
        const rect = navbarLogo.getBoundingClientRect();
        const containerRect = containerRef.current.getBoundingClientRect();
        
        // Calculate relative positions
        const targetX = rect.left + rect.width/2 - containerRect.left - containerRect.width/2;
        const targetY = rect.top + rect.height/2 - containerRect.top - containerRect.height/2;
        
        console.log('Flying to:', targetX, targetY);
        
        // Fast spring for flight
        const flightSpring = { type: "spring", stiffness: 500, damping: 35, mass: 0.6 };
        
        // Different paths for each fragment with spring physics
        await Promise.all([
          animate(mainX, targetX - 10, { ...flightSpring, delay: 0 }),
          animate(mainY, targetY - 10, { ...flightSpring, delay: 0 }),
          animate(mainScale, 0.24, { ...flightSpring, delay: 0 }),
          
          animate(middleX, targetX + 5, { ...flightSpring, delay: 0.1 }),
          animate(middleY, targetY + 5, { ...flightSpring, delay: 0.1 }),
          animate(middleScale, 0.24, { ...flightSpring, delay: 0.1 }),
          
          animate(smallX, targetX, { ...flightSpring, delay: 0.2 }),
          animate(smallY, targetY, { ...flightSpring, delay: 0.2 }),
          animate(smallScale, 0.24, { ...flightSpring, delay: 0.2 }),
        ]);
        
        // Converge fragments with gentle spring + return to original shapes
        const convergeSpring = { type: "spring", stiffness: 400, damping: 45, mass: 0.8 };
        await Promise.all([
          animate(mainX, targetX, convergeSpring),
          animate(mainY, targetY, convergeSpring),
          animate(middleX, targetX, convergeSpring),
          animate(middleY, targetY, convergeSpring),
          animate(smallX, targetX, convergeSpring),
          animate(smallY, targetY, convergeSpring),
          // Return to original shapes
          animate(mainPathMorph, 0, convergeSpring),
          animate(middlePathMorph, 0, convergeSpring),
          animate(smallPathMorph, 0, convergeSpring),
        ]);
      }
      
      // Complete
      setPhase('complete');
      setTimeout(() => {
        localStorage.setItem('burnwise-bootup-seen', 'true');
        onComplete();
      }, 300);
    };
    
    performAnimation();
  }, [onComplete]);
  
  // Helper function to get morphed path
  const getMorphedPath = (paths, morphValue) => {
    const index = Math.floor(morphValue);
    const progress = morphValue - index;
    
    if (index >= paths.length - 1) {
      return paths[paths.length - 1];
    }
    
    // Simple path interpolation - in production, use a proper SVG morphing library
    return paths[index];
  };
  
  return (
    <AnimatePresence>
      {phase !== 'complete' && (
        <motion.div
          className="fullscreen-startup"
          data-phase={phase}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div ref={containerRef} className="startup-logo-container">
            {/* Custom SVG with individual fragment control */}
            <svg
              width={500}
              height={500}
              viewBox="0 0 1000 1200"
              style={{ overflow: 'visible' }}
            >
              <defs>
                {/* Fire gradients */}
                <linearGradient id="fireGradient1" x1="0%" y1="100%" x2="0%" y2="0%">
                  <stop offset="0%" stopColor="#d32f2f" />
                  <stop offset="30%" stopColor="#ff5722" />
                  <stop offset="60%" stopColor="#ff8a50" />
                  <stop offset="85%" stopColor="#ffd54f" />
                  <stop offset="100%" stopColor="#ffffff" />
                </linearGradient>
                
                {/* Enhanced gradient for ignition */}
                <linearGradient id="fireGradientIgnition" x1="0%" y1="100%" x2="0%" y2="0%">
                  <stop offset="0%" stopColor="#8b0000" />
                  <stop offset="20%" stopColor="#d32f2f" />
                  <stop offset="40%" stopColor="#ff5722" />
                  <stop offset="65%" stopColor="#ff8a50" />
                  <stop offset="85%" stopColor="#ffd54f" />
                  <stop offset="100%" stopColor="#ffffff" />
                </linearGradient>
                
                {/* Living flame gradient */}
                <linearGradient id="fireGradientLiving" x1="0%" y1="100%" x2="0%" y2="0%">
                  <stop offset="0%" stopColor="#b71c1c" />
                  <stop offset="25%" stopColor="#d32f2f" />
                  <stop offset="50%" stopColor="#ff5722" />
                  <stop offset="70%" stopColor="#ff8a50" />
                  <stop offset="90%" stopColor="#ffd54f" />
                  <stop offset="100%" stopColor="#fffde7" />
                </linearGradient>
                
                {/* Advanced turbulence filter for assembly */}
                <filter id="flameTurbulenceAssembly" x="-50%" y="-50%" width="200%" height="200%">
                  <feTurbulence 
                    type="fractalNoise" 
                    baseFrequency="0.008 0.05" 
                    numOctaves="3" 
                    seed="1"
                    stitchTiles="stitch">
                  </feTurbulence>
                  <feDisplacementMap in="SourceGraphic" scale="3" />
                  <feGaussianBlur stdDeviation="0.5" />
                </filter>
                
                {/* Intense turbulence for ignition */}
                <filter id="flameTurbulenceIgnition" x="-50%" y="-50%" width="200%" height="200%">
                  <feTurbulence 
                    type="turbulence" 
                    baseFrequency="0.02 0.12" 
                    numOctaves="4" 
                    seed="7"
                    stitchTiles="stitch">
                    <animate attributeName="baseFrequency" 
                             values="0.02 0.12;0.04 0.18;0.02 0.12" 
                             dur="0.3s" 
                             repeatCount="indefinite" />
                  </feTurbulence>
                  <feDisplacementMap in="SourceGraphic" scale="18" />
                  <feGaussianBlur stdDeviation="1.5" />
                  <feColorMatrix type="saturate" values="1.3" />
                </filter>
                
                {/* Organic living flame turbulence */}
                <filter id="flameTurbulenceLiving" x="-30%" y="-30%" width="160%" height="160%">
                  <feTurbulence 
                    type="fractalNoise" 
                    baseFrequency="0.015 0.08" 
                    numOctaves="3" 
                    seed="3"
                    stitchTiles="stitch">
                    <animate attributeName="baseFrequency" 
                             values="0.015 0.08;0.025 0.12;0.015 0.08" 
                             dur="0.8s" 
                             repeatCount="indefinite" />
                    <animate attributeName="seed" 
                             values="3;5;7;3" 
                             dur="1.2s" 
                             repeatCount="indefinite" />
                  </feTurbulence>
                  <feDisplacementMap in="SourceGraphic" scale="10" />
                  <feGaussianBlur stdDeviation="0.8" />
                  <feColorMatrix type="hueRotate" values="0">
                    <animate attributeName="values" 
                             values="0;5;-5;0" 
                             dur="1s" 
                             repeatCount="indefinite" />
                  </feColorMatrix>
                </filter>
                
                {/* Heat distortion effect */}
                <filter id="heatDistortion" x="-20%" y="-20%" width="140%" height="140%">
                  <feTurbulence 
                    type="fractalNoise" 
                    baseFrequency="0.01 0.02" 
                    numOctaves="2" 
                    seed="2">
                    <animate attributeName="baseFrequency" 
                             values="0.01 0.02;0.02 0.04;0.01 0.02" 
                             dur="2s" 
                             repeatCount="indefinite" />
                  </feTurbulence>
                  <feDisplacementMap in="SourceGraphic" scale="5" />
                  <feGaussianBlur stdDeviation="0.3" />
                </filter>
                
                {/* Dynamic motion blur for flight */}
                <filter id="motionBlurFlight" x="-50%" y="-10%" width="200%" height="120%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="4,0" />
                  <feOffset dx="-3" dy="0" />
                  <feFlood floodColor="#ff6b35" floodOpacity="0.3" />
                  <feComposite operator="multiply" in2="SourceGraphic" />
                  <feComposite operator="screen" in2="SourceGraphic" />
                </filter>
                
                {/* Particle glow effect */}
                <filter id="particleGlow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                  <feMerge> 
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/> 
                  </feMerge>
                </filter>
              </defs>
              
              <g transform="translate(100,1150) scale(0.248,-0.248)">
                {/* Main flame fragment with morphing */}
                <motion.path
                  d={getMorphedPath(flamePathVariants.mainPaths, mainPathMorph.get())}
                  fill={phase === 'ignition' ? "url(#fireGradientIgnition)" : 
                        phase === 'living' ? "url(#fireGradientLiving)" : 
                        "url(#fireGradient1)"}
                  filter={phase === 'assembly' ? "url(#flameTurbulenceAssembly)" :
                          phase === 'ignition' ? "url(#flameTurbulenceIgnition)" :
                          phase === 'living' ? "url(#flameTurbulenceLiving)" : 
                          phase === 'flight' ? "url(#motionBlurFlight)" : "url(#heatDistortion)"}
                  style={{
                    x: mainX,
                    y: mainY,
                    rotate: mainRotate,
                    scale: mainScale,
                    opacity: mainOpacity,
                  }}
                  animate={{
                    d: flamePathVariants.mainPaths[Math.floor(mainPathMorph.get())] || flamePathVariants.mainPaths[0]
                  }}
                  transition={{ type: "spring", stiffness: 300, damping: 40 }}
                />
                
                {/* Middle flame fragment with morphing */}
                <motion.path
                  d={getMorphedPath(flamePathVariants.middlePaths, middlePathMorph.get())}
                  fill={phase === 'ignition' ? "url(#fireGradientIgnition)" : 
                        phase === 'living' ? "url(#fireGradientLiving)" : 
                        "url(#fireGradient1)"}
                  filter={phase === 'assembly' ? "url(#flameTurbulenceAssembly)" :
                          phase === 'ignition' ? "url(#flameTurbulenceIgnition)" :
                          phase === 'living' ? "url(#flameTurbulenceLiving)" : 
                          phase === 'flight' ? "url(#motionBlurFlight)" : "url(#heatDistortion)"}
                  style={{
                    x: middleX,
                    y: middleY,
                    rotate: middleRotate,
                    scale: middleScale,
                    opacity: middleOpacity,
                  }}
                  animate={{
                    d: flamePathVariants.middlePaths[Math.floor(middlePathMorph.get())] || flamePathVariants.middlePaths[0]
                  }}
                  transition={{ type: "spring", stiffness: 300, damping: 40 }}
                />
                
                {/* Small flame fragment with morphing */}
                <motion.path
                  d={getMorphedPath(flamePathVariants.smallPaths, smallPathMorph.get())}
                  fill={phase === 'ignition' ? "url(#fireGradientIgnition)" : 
                        phase === 'living' ? "url(#fireGradientLiving)" : 
                        "url(#fireGradient1)"}
                  filter={phase === 'assembly' ? "url(#flameTurbulenceAssembly)" :
                          phase === 'ignition' ? "url(#flameTurbulenceIgnition)" :
                          phase === 'living' ? "url(#flameTurbulenceLiving)" : 
                          phase === 'flight' ? "url(#motionBlurFlight)" : "url(#heatDistortion)"}
                  style={{
                    x: smallX,
                    y: smallY,
                    rotate: smallRotate,
                    scale: smallScale,
                    opacity: smallOpacity,
                  }}
                  animate={{
                    d: flamePathVariants.smallPaths[Math.floor(smallPathMorph.get())] || flamePathVariants.smallPaths[0]
                  }}
                  transition={{ type: "spring", stiffness: 300, damping: 40 }}
                />
              </g>
            </svg>
            
            {/* Particle effects */}
            {phase === 'ignition' && (
              <div className="particle-container">
                {[...Array(12)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="particle"
                    initial={{ 
                      x: 0, 
                      y: 0, 
                      scale: 0,
                      opacity: 0 
                    }}
                    animate={{ 
                      x: Math.cos(i * 30 * Math.PI / 180) * 200,
                      y: Math.sin(i * 30 * Math.PI / 180) * 200,
                      scale: [0, 1, 0],
                      opacity: [0, 1, 0]
                    }}
                    transition={{ 
                      duration: 1,
                      ease: "easeOut",
                      delay: i * 0.05
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default FullScreenStartup;