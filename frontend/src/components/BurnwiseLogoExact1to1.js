import React from 'react';

const BurnwiseLogoExact1to1 = ({ 
  size = 100, 
  animated = false,
  showGrid = false,
  showMeasurements = false 
}) => {
  // Based on EXACT tracing of the outline image provided
  // Three flame segments with pointed left edges and curved right edges
  
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Exact teal gradient from Burnwise branding */}
        <linearGradient id="burnwiseTealExact" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#4DDAC6" />
          <stop offset="50%" stopColor="#56DFD0" />
          <stop offset="100%" stopColor="#5FE6D3" />
        </linearGradient>
        
        {/* Filter for subtle glow */}
        <filter id="exactGlow">
          <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      
      {/* Grid overlay for verification */}
      {showGrid && (
        <g opacity="0.2">
          {[...Array(20)].map((_, i) => (
            <line key={`h${i}`} x1="0" y1={i * 5} x2="100" y2={i * 5} stroke="#000" strokeWidth="0.25" />
          ))}
          {[...Array(20)].map((_, i) => (
            <line key={`v${i}`} x1={i * 5} y1="0" x2={i * 5} y2="100" stroke="#000" strokeWidth="0.25" />
          ))}
        </g>
      )}
      
      {/* The exact logo paths */}
      <g id="burnwise-exact-logo" transform="translate(0, 5)">
        {/* Top flame segment */}
        <path
          id="flame-top"
          d="M 30 18
             L 30 15
             C 30 13, 31 11, 33 9.5
             C 35 8, 38 7, 42 6.8
             C 46 6.6, 50 7.2, 54 8.5
             C 58 9.8, 61 11.5, 63 14
             C 65 16.5, 65.5 19, 65.5 21
             C 65.5 23, 65 24, 65 24
             C 65 24, 63 23.5, 60 22.8
             C 57 22.1, 53 21.2, 49 20.5
             C 45 19.8, 41 19.5, 37 19.8
             C 33 20.1, 30 21, 30 18 Z"
          fill="url(#burnwiseTealExact)"
          className={animated ? 'flame-animate-1' : ''}
        />
        
        {/* Middle flame segment */}
        <path
          id="flame-middle"
          d="M 30 40
             L 30 37
             C 30 35, 31 33, 33 31.5
             C 35 30, 38 29, 42 28.8
             C 46 28.6, 50 29.2, 54 30.5
             C 58 31.8, 61 33.5, 63 36
             C 65 38.5, 65.5 41, 65.5 43
             C 65.5 45, 65 46, 65 46
             C 65 46, 63 45.5, 60 44.8
             C 57 44.1, 53 43.2, 49 42.5
             C 45 41.8, 41 41.5, 37 41.8
             C 33 42.1, 30 43, 30 40 Z"
          fill="url(#burnwiseTealExact)"
          className={animated ? 'flame-animate-2' : ''}
        />
        
        {/* Bottom flame segment - slightly larger */}
        <path
          id="flame-bottom"
          d="M 30 62
             L 30 59
             C 30 57, 31 55, 33 53.5
             C 35 52, 38 51, 42 50.8
             C 46 50.6, 50 51.2, 54 52.5
             C 58 53.8, 61 55.5, 63 58
             C 65 60.5, 65.5 63, 65.5 65
             C 65.5 67, 65 68, 65 68
             C 65 68, 63 67.5, 60 66.8
             C 57 66.1, 53 65.2, 49 64.5
             C 45 63.8, 41 63.5, 37 63.8
             C 33 64.1, 30 65, 30 62 Z"
          fill="url(#burnwiseTealExact)"
          className={animated ? 'flame-animate-3' : ''}
        />
      </g>
      
      {/* Measurements overlay */}
      {showMeasurements && (
        <g opacity="0.7">
          {/* Left edge alignment */}
          <line x1="30" y1="0" x2="30" y2="100" stroke="red" strokeWidth="0.5" strokeDasharray="2,2" />
          <text x="32" y="10" fontSize="6" fill="red">x=30</text>
          
          {/* Segment heights */}
          <line x1="25" y1="18" x2="25" y2="24" stroke="blue" strokeWidth="1" />
          <text x="15" y="22" fontSize="6" fill="blue">h=6</text>
          
          <line x1="25" y1="40" x2="25" y2="46" stroke="blue" strokeWidth="1" />
          <text x="15" y="44" fontSize="6" fill="blue">h=6</text>
          
          <line x1="25" y1="62" x2="25" y2="68" stroke="blue" strokeWidth="1" />
          <text x="15" y="66" fontSize="6" fill="blue">h=6</text>
          
          {/* Spacing measurements */}
          <line x1="70" y1="24" x2="70" y2="40" stroke="green" strokeWidth="0.5" />
          <text x="72" y="33" fontSize="6" fill="green">gap=16</text>
          
          <line x1="70" y1="46" x2="70" y2="62" stroke="green" strokeWidth="0.5" />
          <text x="72" y="55" fontSize="6" fill="green">gap=16</text>
        </g>
      )}
      
      {animated && (
        <style>
          {`
            @keyframes exact-flame-1 {
              0%, 100% { transform: translateX(0); opacity: 1; }
              50% { transform: translateX(0.5px); opacity: 0.95; }
            }
            
            @keyframes exact-flame-2 {
              0%, 100% { transform: translateX(0); opacity: 1; }
              33% { transform: translateX(-0.3px); opacity: 0.97; }
              66% { transform: translateX(0.3px); opacity: 0.98; }
            }
            
            @keyframes exact-flame-3 {
              0%, 100% { transform: translateX(0); opacity: 1; }
              25% { transform: translateX(0.2px); opacity: 0.96; }
              75% { transform: translateX(-0.4px); opacity: 0.99; }
            }
            
            .flame-animate-1 {
              animation: exact-flame-1 3s ease-in-out infinite;
              transform-origin: 30px 21px;
            }
            
            .flame-animate-2 {
              animation: exact-flame-2 2.5s ease-in-out infinite;
              animation-delay: 0.5s;
              transform-origin: 30px 43px;
            }
            
            .flame-animate-3 {
              animation: exact-flame-3 3.5s ease-in-out infinite;
              animation-delay: 1s;
              transform-origin: 30px 65px;
            }
          `}
        </style>
      )}
    </svg>
  );
};

export default BurnwiseLogoExact1to1;