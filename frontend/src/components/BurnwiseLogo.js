import React from 'react';

const BurnwiseLogo = ({ size = 40, showText = true, className = '' }) => {
  const height = size;
  const width = size * 0.8; // Flame is slightly narrower than tall
  
  return (
    <div className={`burnwise-logo ${className}`} style={{ display: 'flex', alignItems: 'center', gap: showText ? '10px' : '0' }}>
      <svg
        width={width}
        height={height}
        viewBox="0 0 32 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="flame-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFD93D" />
            <stop offset="30%" stopColor="#FFB000" />
            <stop offset="60%" stopColor="#FF8C00" />
            <stop offset="100%" stopColor="#FF5722" />
          </linearGradient>
          <linearGradient id="flame-inner" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFF59D" />
            <stop offset="50%" stopColor="#FFEB3B" />
            <stop offset="100%" stopColor="#FFC107" />
          </linearGradient>
        </defs>
        
        {/* Outer flame */}
        <path
          d="M16 40c8.837 0 16-7.163 16-16 0-5.5-2.5-10.5-5-14-2-2.8-3-5-3-7 0-1.5-0.5-2.5-1.5-3.5C21 1 19 2 17 4c-1.5 1.5-2 3-2 5 0 1.5-0.5 2.5-1.5 3.5-1 1-2 1.5-3 1.5-1.5 0-2.5 1-2.5 2.5 0 2 1 4 2.5 6C12 24.5 13 27 13 29c0 1.657 1.343 3 3 3s3-1.343 3-3c0-1-0.5-2-1-3-0.5-1-1-2-1-3 0-1 0.5-2 1.5-3 1-1 2.5-2 4-2 2 0 3.5 1.5 3.5 3.5 0 3-2 6.5-5 8.5-2 1.333-3 2-3 3 0 1.105 0.895 2 2 2z"
          fill="url(#flame-gradient)"
        />
        
        {/* Inner flame highlight */}
        <path
          d="M16 35c4.418 0 8-3.582 8-8 0-2.5-1-4.5-2-6-0.8-1.2-1.2-2-1.2-2.8 0-0.6-0.2-1-0.6-1.4-0.6 0.6-1.2 1.2-1.8 2-0.6 0.6-0.8 1.2-0.8 2 0 0.6-0.2 1-0.6 1.4-0.4 0.4-0.8 0.6-1.2 0.6-0.6 0-1 0.4-1 1 0 0.8 0.4 1.6 1 2.4 0.6 0.8 1 1.6 1 2.4 0 0.828 0.672 1.5 1.5 1.5s1.5-0.672 1.5-1.5c0-0.4-0.2-0.8-0.4-1.2-0.2-0.4-0.4-0.8-0.4-1.2 0-0.4 0.2-0.8 0.6-1.2 0.4-0.4 1-0.8 1.6-0.8 0.8 0 1.4 0.6 1.4 1.4 0 1.2-0.8 2.6-2 3.4-0.8 0.533-1.2 0.8-1.2 1.2 0 0.442 0.358 0.8 0.8 0.8z"
          fill="url(#flame-inner)"
          opacity="0.7"
        />
      </svg>
      
      {showText && (
        <span style={{ 
          fontSize: '1.5rem', 
          fontWeight: 'bold', 
          color: '#FF6B35',
          letterSpacing: '0.5px',
          fontFamily: 'Inter, sans-serif'
        }}>
          BURNWISE
        </span>
      )}
    </div>
  );
};

export default BurnwiseLogo;