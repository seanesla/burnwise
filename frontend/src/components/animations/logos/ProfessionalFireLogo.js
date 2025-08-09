import React from 'react';
import { motion } from 'framer-motion';
import './ProfessionalFireLogo.css';

const ProfessionalFireLogo = ({ size = 200, onComplete }) => {
  // Professional fire animation variants
  const containerVariants = {
    hidden: { 
      opacity: 0,
      scale: 0.8
    },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.8,
        ease: "easeOut",
        staggerChildren: 0.15
      }
    }
  };

  const flameVariants = {
    hidden: { 
      pathLength: 0,
      opacity: 0,
      scale: 0.8
    },
    visible: {
      pathLength: 1,
      opacity: 1,
      scale: 1,
      transition: {
        pathLength: { duration: 1.5, ease: "easeInOut" },
        opacity: { duration: 0.8 },
        scale: { duration: 1, ease: "backOut" }
      }
    },
    animate: {
      scale: [1, 1.02, 0.98, 1],
      opacity: [1, 0.9, 1],
      transition: {
        duration: 3,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  };

  const middleFlameVariants = {
    hidden: { 
      pathLength: 0,
      opacity: 0,
      scale: 0.8
    },
    visible: {
      pathLength: 1,
      opacity: 1,
      scale: 1,
      transition: {
        pathLength: { duration: 1.8, ease: "easeInOut", delay: 0.2 },
        opacity: { duration: 0.8, delay: 0.2 },
        scale: { duration: 1.2, ease: "backOut", delay: 0.2 }
      }
    },
    animate: {
      scale: [1, 1.05, 0.95, 1],
      rotate: [0, -2, 2, 0],
      opacity: [1, 0.85, 1],
      transition: {
        duration: 2.5,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  };

  const smallFlameVariants = {
    hidden: { 
      pathLength: 0,
      opacity: 0,
      scale: 0.8
    },
    visible: {
      pathLength: 1,
      opacity: 1,
      scale: 1,
      transition: {
        pathLength: { duration: 2, ease: "easeInOut", delay: 0.4 },
        opacity: { duration: 0.8, delay: 0.4 },
        scale: { duration: 1.4, ease: "backOut", delay: 0.4 }
      }
    },
    animate: {
      scale: [1, 0.9, 1.1, 1],
      rotate: [0, -3, 3, 0],
      opacity: [1, 0.8, 1],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  };

  React.useEffect(() => {
    if (onComplete) {
      const timer = setTimeout(onComplete, 6000);
      return () => clearTimeout(timer);
    }
  }, [onComplete]);

  return (
    <div className="professional-fire-logo">
      <motion.svg
        width={size}
        height={size * 1.2}
        viewBox="0 0 1000 1200"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        className="fire-svg"
        style={{
          display: 'block',
          margin: '0 auto'
        }}
      >
        <defs>
          {/* Advanced Fire Gradients */}
          <linearGradient 
            id="mainFireGradient" 
            x1="0%" y1="100%" x2="0%" y2="0%"
          >
            <stop offset="0%" stopColor="#d32f2f">
              <animate attributeName="stop-color" 
                values="#d32f2f;#ff4500;#ff5722;#d32f2f" 
                dur="3s" 
                repeatCount="indefinite"/>
            </stop>
            <stop offset="30%" stopColor="#ff5722">
              <animate attributeName="stop-color" 
                values="#ff5722;#ff6b35;#ff8a50;#ff5722" 
                dur="2.5s" 
                repeatCount="indefinite"/>
            </stop>
            <stop offset="60%" stopColor="#ff8a50">
              <animate attributeName="stop-color" 
                values="#ff8a50;#FFB000;#ffd54f;#ff8a50" 
                dur="2s" 
                repeatCount="indefinite"/>
            </stop>
            <stop offset="85%" stopColor="#ffd54f">
              <animate attributeName="stop-color" 
                values="#ffd54f;#fff3a0;#ffffff;#ffd54f" 
                dur="1.5s" 
                repeatCount="indefinite"/>
            </stop>
            <stop offset="100%" stopColor="#ffffff" />
          </linearGradient>

          <linearGradient id="middleFireGradient" x1="0%" y1="100%" x2="30%" y2="0%">
            <stop offset="0%" stopColor="#ff4500"/>
            <stop offset="50%" stopColor="#ff8a50"/>
            <stop offset="100%" stopColor="#fff3a0"/>
          </linearGradient>

          <linearGradient id="smallFireGradient" x1="0%" y1="100%" x2="50%" y2="0%">
            <stop offset="0%" stopColor="#ff5722"/>
            <stop offset="70%" stopColor="#FFB000"/>
            <stop offset="100%" stopColor="#ffffff"/>
          </linearGradient>

          {/* Professional Glow Effect */}
          <filter id="professionalGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="8" result="coloredBlur"/>
            <feMerge> 
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>

          {/* Heat Distortion */}
          <filter id="heatDistortion" x="-50%" y="-50%" width="200%" height="200%">
            <feTurbulence 
              type="fractalNoise" 
              baseFrequency="0.02 0.1" 
              numOctaves="2" 
              seed="2"
            >
              <animate 
                attributeName="baseFrequency" 
                values="0.02 0.1;0.02 0.15;0.02 0.1" 
                dur="4s" 
                repeatCount="indefinite"
              />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" scale="3"/>
          </filter>
        </defs>

        {/* Main Flame Group - Mathematically Centered */}
        <g transform="translate(-70,1150) scale(0.248,-0.248)" filter="url(#professionalGlow)">
          
          {/* Main Flame Body */}
          <motion.path 
            d="M2737 4632 c-3 -4 -8 -63 -11 -132 -14 -249 -52 -487 -95 -585 -5 -11 -21 -53 -37 -94 -65 -170 -236 -386 -615 -776 -153 -158 -236 -248 -293 -318 -34 -42 -38 -52 -32 -85 10 -66 104 -368 152 -488 25 -64 47 -124 49 -133 5 -26 37 -104 53 -129 l15 -24 26 33 c14 18 32 45 41 60 61 110 424 667 580 889 33 47 103 153 157 235 53 83 100 152 105 153 4 2 8 10 8 17 0 7 3 15 8 17 4 2 20 29 36 62 16 32 35 63 41 70 13 13 95 149 95 158 0 3 29 58 65 122 36 64 65 123 65 131 0 8 -31 79 -69 157 -37 79 -92 193 -121 253 -29 61 -56 112 -61 113 -5 2 -9 12 -9 23 0 17 -89 197 -111 225 -5 6 -7 13 -6 15 2 2 -4 12 -14 21 -10 10 -20 14 -22 10z"
            fill="url(#mainFireGradient)" 
            stroke="none"
            variants={flameVariants}
            initial="hidden"
            animate={["visible", "animate"]}
            style={{ 
              transformOrigin: "center bottom",
              filter: "url(#heatDistortion)"
            }}
          />

          {/* Middle Flame Fragment */}
          <motion.path 
            d="M3146 3272 c-11 -19 -76 -205 -76 -220 0 -8 -13 -42 -29 -76 -16 -33 -43 -90 -59 -126 -17 -36 -73 -146 -126 -244 -53 -99 -96 -183 -96 -188 0 -4 -4 -8 -10 -8 -5 0 -9 -3 -8 -7 3 -10 -160 -306 -217 -393 -23 -36 -49 -85 -59 -110 -10 -25 -28 -65 -42 -89 -13 -24 -23 -46 -21 -47 9 -10 684 547 814 672 82 78 83 79 73 114 -5 19 -18 96 -30 170 -12 74 -27 169 -35 210 -7 41 -23 134 -36 205 -22 129 -31 156 -43 137z"
            fill="url(#middleFireGradient)" 
            stroke="none"
            variants={middleFlameVariants}
            initial="hidden"
            animate={["visible", "animate"]}
            style={{ 
              transformOrigin: "3146px 3272px",
            }}
          />

          {/* Small Flame Fragment */}
          <motion.path 
            d="M3545 2476 c-11 -7 -24 -14 -30 -15 -5 -1 -24 -15 -42 -31 -17 -17 -36 -30 -41 -30 -6 0 -12 -4 -14 -8 -1 -5 -39 -30 -83 -57 -44 -26 -108 -69 -142 -94 -35 -25 -65 -44 -68 -41 -2 3 -10 -2 -17 -11 -7 -8 -60 -49 -118 -89 -115 -81 -320 -230 -355 -258 -111 -89 -147 -116 -150 -112 -2 3 -10 -2 -17 -11 -7 -9 -35 -33 -63 -54 -102 -79 -177 -149 -186 -172 -5 -13 -18 -81 -29 -151 -30 -177 -29 -170 -35 -237 -3 -33 -10 -61 -15 -63 -5 -2 -7 -9 -4 -16 3 -7 -7 -66 -22 -132 -47 -213 -48 -224 -36 -236 9 -9 12 -9 12 1 0 15 138 181 151 181 5 0 9 5 9 11 0 11 7 20 145 169 158 170 381 430 544 633 30 37 58 67 63 67 4 0 8 6 8 14 0 8 9 21 20 29 11 8 18 16 15 18 -2 3 16 26 41 53 24 27 44 51 45 55 0 3 29 40 64 81 106 124 385 497 385 514 0 10 -15 7 -35 -8z"
            fill="url(#smallFireGradient)" 
            stroke="none"
            variants={smallFlameVariants}
            initial="hidden"
            animate={["visible", "animate"]}
            style={{ 
              transformOrigin: "3545px 2476px",
            }}
          />
        </g>

        {/* Additional Glow Layer */}
        <motion.g 
          transform="translate(-70,1150) scale(0.248,-0.248)" 
          opacity={0.3} 
          filter="url(#professionalGlow)"
          animate={{
            opacity: [0.3, 0.5, 0.3]
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          <use href="#mainFlame" transform="scale(1.1, 1.05)" />
        </motion.g>
      </motion.svg>
    </div>
  );
};

export default ProfessionalFireLogo;