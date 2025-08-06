import React, { useEffect, useState } from 'react';
import './StartupFlameLogo.css';

const StartupFlameLogo = ({ phase }) => {
  const [flameIntensity, setFlameIntensity] = useState(0);
  
  useEffect(() => {
    if (phase === 'intro') {
      // Gradually increase flame intensity
      const interval = setInterval(() => {
        setFlameIntensity(prev => Math.min(prev + 0.1, 1));
      }, 50);
      return () => clearInterval(interval);
    } else if (phase === 'expanding') {
      setFlameIntensity(1.5);
    } else if (phase === 'morphing') {
      setFlameIntensity(0.8);
    }
  }, [phase]);

  return (
    <div className={`startup-flame-logo phase-${phase}`}>
      <svg
        width="200"
        height="200"
        viewBox="0 0 1000 1200"
        className="flame-svg"
        style={{ 
          filter: `brightness(${1 + flameIntensity * 0.5}) contrast(${1 + flameIntensity * 0.3})` 
        }}
      >
        <defs>
          {/* Animated Fire Gradient */}
          <radialGradient id="startupFireGradient" cx="50%" cy="100%">
            <stop offset="0%" stopColor="#fff">
              <animate 
                attributeName="stop-color" 
                values="#fff;#FFD700;#FFA500;#FF6B35;#FFA500;#FFD700;#fff" 
                dur="0.5s" 
                repeatCount="indefinite"
              />
            </stop>
            <stop offset="30%" stopColor="#FFB000">
              <animate 
                attributeName="stop-color" 
                values="#FFB000;#FF8C00;#FF6B35;#FF5722;#FF6B35;#FF8C00;#FFB000" 
                dur="0.4s" 
                repeatCount="indefinite"
              />
            </stop>
            <stop offset="60%" stopColor="#FF6B35">
              <animate 
                attributeName="stop-color" 
                values="#FF6B35;#FF5722;#FF4500;#d32f2f;#FF4500;#FF5722;#FF6B35" 
                dur="0.3s" 
                repeatCount="indefinite"
              />
            </stop>
            <stop offset="100%" stopColor="#8B0000">
              <animate 
                attributeName="stop-color" 
                values="#8B0000;#d32f2f;#8B0000" 
                dur="0.6s" 
                repeatCount="indefinite"
              />
            </stop>
          </radialGradient>

          {/* Turbulence filter for realistic flame movement */}
          <filter id="flameTurbulence">
            <feTurbulence 
              type="fractalNoise" 
              baseFrequency="0.01 0.1" 
              numOctaves="2" 
              result="turbulence"
            >
              <animate 
                attributeName="baseFrequency" 
                values="0.01 0.1;0.02 0.2;0.01 0.1" 
                dur="3s" 
                repeatCount="indefinite"
              />
            </feTurbulence>
            <feDisplacementMap 
              in="SourceGraphic" 
              in2="turbulence" 
              scale="15" 
              xChannelSelector="R" 
              yChannelSelector="G"
            />
          </filter>

          {/* Glow filter */}
          <filter id="flameGlow">
            <feGaussianBlur stdDeviation="20" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Three flame fragments that come together */}
        <g className="flame-fragments">
          {/* Left flame fragment */}
          <path
            className="flame-fragment flame-left"
            d="M 300 900 Q 250 700 300 500 Q 350 400 300 300 Q 250 400 200 500 Q 150 650 200 800 Q 250 850 300 900"
            fill="url(#startupFireGradient)"
            filter="url(#flameTurbulence)"
            opacity={0.9}
          >
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0,0; 5,-10; -5,-20; 0,0"
              dur="1.5s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.9; 1; 0.8; 0.9"
              dur="0.8s"
              repeatCount="indefinite"
            />
          </path>

          {/* Center flame fragment */}
          <path
            className="flame-fragment flame-center"
            d="M 500 950 Q 450 750 500 550 Q 550 400 500 250 Q 450 400 400 550 Q 350 700 400 850 Q 450 900 500 950"
            fill="url(#startupFireGradient)"
            filter="url(#flameTurbulence)"
            opacity={1}
          >
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0,0; -3,-15; 3,-25; 0,0"
              dur="1.3s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="1; 0.9; 1; 0.95; 1"
              dur="0.6s"
              repeatCount="indefinite"
            />
          </path>

          {/* Right flame fragment */}
          <path
            className="flame-fragment flame-right"
            d="M 700 900 Q 650 700 700 500 Q 750 400 700 300 Q 650 400 600 500 Q 550 650 600 800 Q 650 850 700 900"
            fill="url(#startupFireGradient)"
            filter="url(#flameTurbulence)"
            opacity={0.9}
          >
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0,0; -5,-10; 5,-20; 0,0"
              dur="1.7s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.9; 0.8; 1; 0.9"
              dur="0.9s"
              repeatCount="indefinite"
            />
          </path>
        </g>

        {/* Ember particles */}
        <g className="embers">
          {[...Array(10)].map((_, i) => (
            <circle
              key={i}
              cx={350 + i * 30}
              cy={900 - i * 50}
              r="2"
              fill="#FFA500"
              opacity="0"
            >
              <animate
                attributeName="cy"
                values={`${900 - i * 50}; ${200 - i * 30}`}
                dur={`${2 + i * 0.3}s`}
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0; 0.8; 0"
                dur={`${2 + i * 0.3}s`}
                repeatCount="indefinite"
              />
              <animate
                attributeName="r"
                values="2; 1; 0.5"
                dur={`${2 + i * 0.3}s`}
                repeatCount="indefinite"
              />
            </circle>
          ))}
        </g>
      </svg>
    </div>
  );
};

export default StartupFlameLogo;