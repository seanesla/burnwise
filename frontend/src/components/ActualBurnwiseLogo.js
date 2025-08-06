import React from 'react';

const ActualBurnwiseLogo = ({ size = 40, className = '' }) => {
  const width = size;
  const height = size * 1.2; // Flame is taller than wide
  
  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox="0 0 100 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Realistic flame gradient from yellow to orange to red */}
        <radialGradient id="flameGradient" cx="50%" cy="60%" r="60%">
          <stop offset="0%" stopColor="#FFF59D" />
          <stop offset="20%" stopColor="#FFEB3B" />
          <stop offset="40%" stopColor="#FFC107" />
          <stop offset="60%" stopColor="#FF9800" />
          <stop offset="80%" stopColor="#FF6B35" />
          <stop offset="100%" stopColor="#FF5722" />
        </radialGradient>
        
        {/* Inner bright core */}
        <radialGradient id="flameCore" cx="50%" cy="70%" r="40%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="30%" stopColor="#FFF9C4" />
          <stop offset="60%" stopColor="#FFEB3B" />
          <stop offset="100%" stopColor="#FFC107" />
        </radialGradient>
        
        {/* Outer glow */}
        <filter id="flameGlow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      
      {/* Main flame shape */}
      <path
        d="M50 10 C35 25 20 40 20 60 C20 85 35 105 50 105 C65 105 80 85 80 60 C80 40 65 25 50 10 Z"
        fill="url(#flameGradient)"
        filter="url(#flameGlow)"
      />
      
      {/* Inner flame detail */}
      <path
        d="M50 30 C42 40 35 50 35 65 C35 80 42 90 50 90 C58 90 65 80 65 65 C65 50 58 40 50 30 Z"
        fill="url(#flameCore)"
        opacity="0.8"
      />
      
      {/* Small flame tip */}
      <path
        d="M50 10 C48 15 46 20 46 25 C46 30 48 32 50 32 C52 32 54 30 54 25 C54 20 52 15 50 10 Z"
        fill="#FFFFFF"
        opacity="0.9"
      />
    </svg>
  );
};

export default ActualBurnwiseLogo;