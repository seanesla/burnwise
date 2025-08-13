import React from 'react';

const BurnwiseLogoPrecise = ({ className = '', animated = false, size = 100 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="burnwiseTeal" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#4DDAC6" />
          <stop offset="100%" stopColor="#5FE6D3" />
        </linearGradient>
        
        <filter id="glow">
          <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      
      {/* Logo group centered in viewBox */}
      <g transform="translate(55, 30)">
        {/* Top segment */}
        <path
          className={animated ? 'flame-segment flame-1' : ''}
          d="M 10 35
             C 10 35, 8 25, 12 18
             C 16 10, 24 5, 36 3
             C 48 1, 62 3, 72 8
             C 82 13, 88 20, 90 28
             C 92 36, 90 40, 90 40
             C 90 40, 82 37, 72 33
             C 62 29, 50 26, 38 26
             C 26 26, 16 28, 10 35 Z"
          fill="url(#burnwiseTeal)"
        />
        
        {/* Middle segment */}
        <path
          className={animated ? 'flame-segment flame-2' : ''}
          d="M 10 70
             C 10 70, 8 60, 12 53
             C 16 45, 24 40, 36 38
             C 48 36, 62 38, 72 43
             C 82 48, 88 55, 90 63
             C 92 71, 90 75, 90 75
             C 90 75, 82 72, 72 68
             C 62 64, 50 61, 38 61
             C 26 61, 16 63, 10 70 Z"
          fill="url(#burnwiseTeal)"
        />
        
        {/* Bottom segment */}
        <path
          className={animated ? 'flame-segment flame-3' : ''}
          d="M 10 105
             C 10 105, 8 95, 12 88
             C 16 80, 24 75, 36 73
             C 48 71, 62 73, 72 78
             C 82 83, 88 90, 90 98
             C 92 106, 90 110, 90 110
             C 90 110, 82 107, 72 103
             C 62 99, 50 96, 38 96
             C 26 96, 16 98, 10 105 Z"
          fill="url(#burnwiseTeal)"
        />
      </g>
      
      {animated && (
        <style>
          {`
            @keyframes flame-flicker-1 {
              0%, 100% { 
                transform: translateX(0) scaleX(1);
                opacity: 1;
              }
              50% { 
                transform: translateX(1px) scaleX(1.02);
                opacity: 0.95;
              }
            }
            
            @keyframes flame-flicker-2 {
              0%, 100% { 
                transform: translateX(0) scaleY(1);
                opacity: 1;
              }
              30% { 
                transform: translateX(-0.5px) scaleY(1.01);
                opacity: 0.97;
              }
              70% { 
                transform: translateX(0.5px) scaleY(0.99);
                opacity: 1;
              }
            }
            
            @keyframes flame-flicker-3 {
              0%, 100% { 
                transform: translateX(0) scale(1);
                opacity: 1;
              }
              25% { 
                transform: translateX(0.5px) scale(1.01);
                opacity: 0.96;
              }
              75% { 
                transform: translateX(-0.5px) scale(0.99);
                opacity: 1;
              }
            }
            
            .flame-segment {
              transform-origin: left center;
            }
            
            .flame-1 {
              animation: flame-flicker-1 3s ease-in-out infinite;
            }
            
            .flame-2 {
              animation: flame-flicker-2 2.5s ease-in-out infinite;
              animation-delay: 0.5s;
            }
            
            .flame-3 {
              animation: flame-flicker-3 3.5s ease-in-out infinite;
              animation-delay: 1s;
            }
            
            /* Interactive hover */
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

export default BurnwiseLogoPrecise;