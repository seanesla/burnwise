import React from 'react';

const BurnwiseLogoFinal = ({ 
  className = '', 
  animated = false, 
  size = 100,
  color = 'gradient'
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="burnwiseTealGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#4DDAC6" />
          <stop offset="100%" stopColor="#5FE6D3" />
        </linearGradient>
        
        <filter id="burnwiseGlow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        
        {/* Heat distortion filter */}
        <filter id="heatDistortion">
          <feTurbulence type="fractalNoise" baseFrequency="0.01" numOctaves="2" result="turbulence" seed="2">
            <animate attributeName="baseFrequency" values="0.01;0.02;0.01" dur="4s" repeatCount="indefinite"/>
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="turbulence" scale="1" xChannelSelector="R" yChannelSelector="G"/>
        </filter>
      </defs>
      
      {/* Main logo group */}
      <g transform="translate(28, 15)">
        {/* Top segment - pointed left, curved sweep right */}
        <path
          className={animated ? 'burnwise-flame flame-top' : ''}
          d="M 0 20
             L 0 14
             C 0 12, 1 8, 4 5
             C 7 2, 12 0, 20 0
             C 28 0, 35 2, 40 6
             C 45 10, 47 16, 47 20
             C 47 20, 44 19, 40 17
             C 35 15, 28 13, 20 12
             C 12 11, 5 13, 0 20 Z"
          fill={color === 'gradient' ? "url(#burnwiseTealGradient)" : color}
        />
        
        {/* Middle segment */}
        <path
          className={animated ? 'burnwise-flame flame-middle' : ''}
          d="M 0 40
             L 0 34
             C 0 32, 1 28, 4 25
             C 7 22, 12 20, 20 20
             C 28 20, 35 22, 40 26
             C 45 30, 47 36, 47 40
             C 47 40, 44 39, 40 37
             C 35 35, 28 33, 20 32
             C 12 31, 5 33, 0 40 Z"
          fill={color === 'gradient' ? "url(#burnwiseTealGradient)" : color}
        />
        
        {/* Bottom segment - largest */}
        <path
          className={animated ? 'burnwise-flame flame-bottom' : ''}
          d="M 0 60
             L 0 54
             C 0 52, 1 48, 4 45
             C 7 42, 12 40, 20 40
             C 28 40, 35 42, 40 46
             C 45 50, 47 56, 47 60
             C 47 60, 44 59, 40 57
             C 35 55, 28 53, 20 52
             C 12 51, 5 53, 0 60 Z"
          fill={color === 'gradient' ? "url(#burnwiseTealGradient)" : color}
        />
      </g>
      
      {/* Animated particles */}
      {animated && (
        <>
          {/* Floating embers */}
          <circle className="ember ember-1" cx="35" cy="70" r="1" fill="#FFB366" opacity="0">
            <animate attributeName="cy" values="70;10;70" dur="6s" repeatCount="indefinite"/>
            <animate attributeName="opacity" values="0;0.8;0" dur="6s" repeatCount="indefinite"/>
            <animate attributeName="cx" values="35;38;35" dur="6s" repeatCount="indefinite"/>
          </circle>
          <circle className="ember ember-2" cx="55" cy="65" r="0.8" fill="#FFA555" opacity="0">
            <animate attributeName="cy" values="65;5;65" dur="8s" repeatCount="indefinite"/>
            <animate attributeName="opacity" values="0;0.6;0" dur="8s" repeatCount="indefinite"/>
            <animate attributeName="cx" values="55;53;55" dur="8s" repeatCount="indefinite"/>
          </circle>
          <circle className="ember ember-3" cx="45" cy="75" r="1.2" fill="#FF9944" opacity="0">
            <animate attributeName="cy" values="75;15;75" dur="7s" repeatCount="indefinite"/>
            <animate attributeName="opacity" values="0;0.7;0" dur="7s" repeatCount="indefinite"/>
          </circle>
        </>
      )}
      
      {animated && (
        <style>
          {`
            @keyframes burnwise-flicker-top {
              0%, 100% { 
                transform: translateX(0) scaleX(1);
                filter: brightness(1);
              }
              25% {
                transform: translateX(0.5px) scaleX(1.01);
                filter: brightness(1.05);
              }
              50% { 
                transform: translateX(-0.3px) scaleX(1.005);
                filter: brightness(0.98);
              }
              75% {
                transform: translateX(0.2px) scaleX(0.995);
                filter: brightness(1.02);
              }
            }
            
            @keyframes burnwise-flicker-middle {
              0%, 100% { 
                transform: translateX(0) scaleY(1);
                filter: brightness(1);
              }
              33% { 
                transform: translateX(-0.4px) scaleY(1.008);
                filter: brightness(1.03);
              }
              66% { 
                transform: translateX(0.4px) scaleY(0.997);
                filter: brightness(0.97);
              }
            }
            
            @keyframes burnwise-flicker-bottom {
              0%, 100% { 
                transform: translateX(0) scale(1);
                filter: brightness(1);
              }
              20% { 
                transform: translateX(0.3px) scale(1.003);
                filter: brightness(0.96);
              }
              40% {
                transform: translateX(-0.2px) scale(1.006);
                filter: brightness(1.04);
              }
              60% { 
                transform: translateX(-0.4px) scale(0.998);
                filter: brightness(0.98);
              }
              80% {
                transform: translateX(0.3px) scale(1.002);
                filter: brightness(1.02);
              }
            }
            
            .burnwise-flame {
              transform-origin: 20% 80%;
            }
            
            .flame-top {
              animation: burnwise-flicker-top 3s ease-in-out infinite;
            }
            
            .flame-middle {
              animation: burnwise-flicker-middle 2.5s ease-in-out infinite;
              animation-delay: 0.5s;
            }
            
            .flame-bottom {
              animation: burnwise-flicker-bottom 3.5s ease-in-out infinite;
              animation-delay: 1s;
            }
            
            /* Hover effects */
            svg:hover .burnwise-flame {
              filter: url(#burnwiseGlow);
              transition: filter 0.3s ease;
            }
            
            /* Entry animation */
            @keyframes burnwise-entry {
              0% {
                opacity: 0;
                transform: translateY(10px) scale(0.9);
              }
              100% {
                opacity: 1;
                transform: translateY(0) scale(1);
              }
            }
            
            .burnwise-flame {
              animation: burnwise-entry 0.6s ease-out backwards;
            }
            
            .flame-top {
              animation-delay: 0s;
            }
            
            .flame-middle {
              animation-delay: 0.1s;
            }
            
            .flame-bottom {
              animation-delay: 0.2s;
            }
          `}
        </style>
      )}
    </svg>
  );
};

export default BurnwiseLogoFinal;