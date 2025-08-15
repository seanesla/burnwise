import React from 'react';

const BurnwiseLogoAccurate = ({ 
  className = '', 
  animated = false, 
  size = 100,
  showGuides = false
}) => {
  // Based on careful analysis of the outline image
  // The logo has 3 flame-like segments with organic curves
  
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="burnwiseAccurateTeal" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#4DDAC6" />
          <stop offset="100%" stopColor="#5FE6D3" />
        </linearGradient>
      </defs>
      
      {/* Show guides for alignment */}
      {showGuides && (
        <g opacity="0.2">
          {/* Grid lines every 10 units */}
          {[...Array(10)].map((_, i) => (
            <line key={`h${i}`} x1="0" y1={i * 10} x2="100" y2={i * 10} stroke="#fff" strokeWidth="0.5" />
          ))}
          {[...Array(10)].map((_, i) => (
            <line key={`v${i}`} x1={i * 10} y1="0" x2={i * 10} y2="100" stroke="#fff" strokeWidth="0.5" />
          ))}
        </g>
      )}
      
      <g id="burnwise-accurate">
        {/* Top segment - smallest flame */}
        <path
          d="M 30 25
             C 30 25, 30 20, 32 17
             C 34 14, 37 12, 42 11
             C 47 10, 53 11, 58 13
             C 63 15, 66 18, 68 22
             C 70 26, 70 28, 70 28
             C 70 28, 68 27, 65 26
             C 62 25, 58 24, 54 23.5
             C 50 23, 46 22.5, 42 22.5
             C 38 22.5, 34 23, 30 25 Z"
          fill="url(#burnwiseAccurateTeal)"
        />
        
        {/* Middle segment */}
        <path
          d="M 30 45
             C 30 45, 30 40, 32 37
             C 34 34, 37 32, 42 31
             C 47 30, 53 31, 58 33
             C 63 35, 66 38, 68 42
             C 70 46, 70 48, 70 48
             C 70 48, 68 47, 65 46
             C 62 45, 58 44, 54 43.5
             C 50 43, 46 42.5, 42 42.5
             C 38 42.5, 34 43, 30 45 Z"
          fill="url(#burnwiseAccurateTeal)"
        />
        
        {/* Bottom segment - largest flame */}
        <path
          d="M 30 65
             C 30 65, 30 60, 32 57
             C 34 54, 37 52, 42 51
             C 47 50, 53 51, 58 53
             C 63 55, 66 58, 68 62
             C 70 66, 70 68, 70 68
             C 70 68, 68 67, 65 66
             C 62 65, 58 64, 54 63.5
             C 50 63, 46 62.5, 42 62.5
             C 38 62.5, 34 63, 30 65 Z"
          fill="url(#burnwiseAccurateTeal)"
        />
      </g>
    </svg>
  );
};

export default BurnwiseLogoAccurate;