import React from 'react';

const BurnwiseLogoExact = ({ className = '', animated = false, variant = 'default' }) => {
  return (
    <svg
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ width: '100%', height: '100%' }}
    >
      <defs>
        <linearGradient id="burnwiseGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#4DDAC6" />
          <stop offset="100%" stopColor="#5FE6D3" />
        </linearGradient>
        
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      
      <g id="burnwise-logo" transform="translate(25, 15)">
        {/* Top segment - smallest */}
        <path
          className={animated ? 'flame-segment flame-1' : ''}
          d="M 0 15
             C 0 15, 0 10, 2 6
             C 4 2, 8 0, 14 0
             C 22 0, 30 2, 36 6
             C 42 10, 44 15, 44 15
             C 44 15, 40 14, 35 12
             C 28 9, 20 7, 12 7
             C 6 7, 2 10, 0 15 Z"
          fill="url(#burnwiseGradient)"
        />
        
        {/* Middle segment */}
        <path
          className={animated ? 'flame-segment flame-2' : ''}
          d="M 0 37
             C 0 37, 0 32, 2 28
             C 4 24, 8 22, 14 22
             C 22 22, 30 24, 36 28
             C 42 32, 44 37, 44 37
             C 44 37, 40 36, 35 34
             C 28 31, 20 29, 12 29
             C 6 29, 2 32, 0 37 Z"
          fill="url(#burnwiseGradient)"
        />
        
        {/* Bottom segment - largest */}
        <path
          className={animated ? 'flame-segment flame-3' : ''}
          d="M 0 59
             C 0 59, 0 54, 2 50
             C 4 46, 8 44, 14 44
             C 22 44, 30 46, 36 50
             C 42 54, 44 59, 44 59
             C 44 59, 40 58, 35 56
             C 28 53, 20 51, 12 51
             C 6 51, 2 54, 0 59 Z"
          fill="url(#burnwiseGradient)"
        />
      </g>
      
      {animated && (
        <style>
          {`
            @keyframes flicker1 {
              0%, 100% { 
                transform: translateX(0) translateY(0);
                opacity: 1;
              }
              25% {
                transform: translateX(0.5px) translateY(-0.3px);
                opacity: 0.95;
              }
              50% { 
                transform: translateX(-0.3px) translateY(0.2px);
                opacity: 1;
              }
              75% {
                transform: translateX(0.2px) translateY(-0.2px);
                opacity: 0.98;
              }
            }
            
            @keyframes flicker2 {
              0%, 100% { 
                transform: translateX(0) translateY(0);
                opacity: 1;
              }
              33% { 
                transform: translateX(-0.4px) translateY(0.3px);
                opacity: 0.97;
              }
              66% { 
                transform: translateX(0.3px) translateY(-0.3px);
                opacity: 1;
              }
            }
            
            @keyframes flicker3 {
              0%, 100% { 
                transform: translateX(0) translateY(0);
                opacity: 1;
              }
              20% { 
                transform: translateX(0.3px) translateY(0.2px);
                opacity: 0.96;
              }
              60% { 
                transform: translateX(-0.5px) translateY(-0.2px);
                opacity: 1;
              }
              80% {
                transform: translateX(0.2px) translateY(0.3px);
                opacity: 0.98;
              }
            }
            
            .flame-segment {
              transform-origin: bottom center;
            }
            
            .flame-1 {
              animation: flicker1 2.5s ease-in-out infinite;
            }
            
            .flame-2 {
              animation: flicker2 2s ease-in-out infinite;
              animation-delay: 0.3s;
            }
            
            .flame-3 {
              animation: flicker3 3s ease-in-out infinite;
              animation-delay: 0.6s;
            }
            
            /* Hover effect */
            svg:hover .flame-segment {
              filter: url(#glow);
              transition: filter 0.3s ease;
            }
          `}
        </style>
      )}
    </svg>
  );
};

export default BurnwiseLogoExact;