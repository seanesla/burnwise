import React from 'react';

const BurnwiseLogoTraced = ({ 
  className = '', 
  animated = false, 
  size = 100
}) => {
  // Carefully traced from the outline image
  // Each flame segment has a pointed left edge that curves up and right
  
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="burnwiseTracedGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#4DDAC6" />
          <stop offset="50%" stopColor="#56E0CC" />
          <stop offset="100%" stopColor="#5FE6D3" />
        </linearGradient>
      </defs>
      
      <g transform="translate(50, 30)">
        {/* Top segment - smallest, most curved */}
        <path
          d="M 10 30
             L 10 25
             C 10 20, 12 15, 18 10
             C 24 5, 32 2, 42 2
             C 52 2, 62 5, 70 10
             C 78 15, 82 22, 85 30
             C 88 38, 88 42, 88 42
             C 88 42, 84 40, 78 37
             C 72 34, 64 31, 55 29
             C 46 27, 36 26, 26 28
             C 16 30, 10 30, 10 30 Z"
          fill="url(#burnwiseTracedGradient)"
        />
        
        {/* Middle segment */}
        <path
          d="M 10 70
             L 10 65
             C 10 60, 12 55, 18 50
             C 24 45, 32 42, 42 42
             C 52 42, 62 45, 70 50
             C 78 55, 82 62, 85 70
             C 88 78, 88 82, 88 82
             C 88 82, 84 80, 78 77
             C 72 74, 64 71, 55 69
             C 46 67, 36 66, 26 68
             C 16 70, 10 70, 10 70 Z"
          fill="url(#burnwiseTracedGradient)"
        />
        
        {/* Bottom segment - largest */}
        <path
          d="M 10 110
             L 10 105
             C 10 100, 12 95, 18 90
             C 24 85, 32 82, 42 82
             C 52 82, 62 85, 70 90
             C 78 95, 82 102, 85 110
             C 88 118, 88 122, 88 122
             C 88 122, 84 120, 78 117
             C 72 114, 64 111, 55 109
             C 46 107, 36 106, 26 108
             C 16 110, 10 110, 10 110 Z"
          fill="url(#burnwiseTracedGradient)"
        />
      </g>
      
      {animated && (
        <style>
          {`
            path {
              animation: subtle-flicker 3s ease-in-out infinite;
              transform-origin: 20% 50%;
            }
            
            path:nth-child(1) {
              animation-delay: 0s;
            }
            
            path:nth-child(2) {
              animation-delay: 0.5s;
            }
            
            path:nth-child(3) {
              animation-delay: 1s;
            }
            
            @keyframes subtle-flicker {
              0%, 100% {
                opacity: 1;
                transform: translateX(0);
              }
              50% {
                opacity: 0.95;
                transform: translateX(0.5px);
              }
            }
          `}
        </style>
      )}
    </svg>
  );
};

export default BurnwiseLogoTraced;