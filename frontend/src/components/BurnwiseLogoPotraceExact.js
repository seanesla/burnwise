import React from 'react';

const BurnwiseLogoPotraceExact = ({ size = 120, animated = false, className = "" }) => {
  return (
    <div className={`burnwise-logo ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 400 400"
        xmlns="http://www.w3.org/2000/svg"
        className={animated ? 'logo-animated' : ''}
      >
        {/* Fire Gradient Definition */}
        <defs>
          <linearGradient id="potraceFireGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FF4500" />
            <stop offset="40%" stopColor="#FF6B35" />
            <stop offset="70%" stopColor="#FF8C42" />
            <stop offset="100%" stopColor="#FFB000" />
          </linearGradient>
          
          <linearGradient id="potraceFireGradient2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FF6B35" />
            <stop offset="50%" stopColor="#FF5722" />
            <stop offset="100%" stopColor="#FF4500" />
          </linearGradient>
          
          <linearGradient id="potraceFireGradient3" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FFB000" />
            <stop offset="50%" stopColor="#FF8C42" />
            <stop offset="100%" stopColor="#FF6B35" />
          </linearGradient>

          {/* Glow Filter */}
          <filter id="fireGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge> 
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Flame 1 - Left flame using potrace-generated path */}
        <g className="flame-1">
          <path
            d="M120.5 350.2c-15.8-8.2-28.9-22.1-35.7-38.3-6.8-16.2-7.2-34.8-1.1-51.3 6.1-16.5 18.1-30.9 33.2-39.7 15.1-8.8 33.3-11.1 50.1-6.3 16.8 4.8 31.3 15.6 40.1 29.8 8.8 14.2 11.9 31.8 8.6 48.5-3.3 16.7-12.3 31.6-24.8 41.1-12.5 9.5-28.4 13.6-43.8 11.3-15.4-2.3-29.4-10.1-38.9-21.5z"
            fill="url(#potraceFireGradient)"
            className="flame-path"
          />
        </g>

        {/* Flame 2 - Center flame */}
        <g className="flame-2">
          <path
            d="M200.1 330.8c-18.2-12.4-32.1-30.2-38.9-50.1-6.8-19.9-6.7-42.1 0.3-61.9 7.0-19.8 21.2-36.3 39.1-45.7 17.9-9.4 39.5-10.9 59.5-4.1 20.0 6.8 37.3 20.8 47.8 38.7 10.5 17.9 13.2 39.7 7.4 60.1-5.8 20.4-18.4 38.4-34.8 49.7-16.4 11.3-36.6 15.9-55.7 12.7-19.1-3.2-36.2-13.7-47.8-28.9z"
            fill="url(#potraceFireGradient2)"
            className="flame-path"
          />
        </g>

        {/* Flame 3 - Right flame */}
        <g className="flame-3">
          <path
            d="M280.3 345.1c-14.1-6.9-26.2-18.4-33.2-31.8-7.0-13.4-8.9-29.7-5.2-44.9 3.7-15.2 12.8-28.3 25.1-36.2 12.3-7.9 27.9-10.5 43.0-7.1 15.1 3.4 28.6 12.0 37.2 23.7 8.6 11.7 12.4 26.5 10.5 40.8-1.9 14.3-8.7 27.1-18.7 35.3-10.0 8.2-23.2 11.9-36.4 10.2-13.2-1.7-25.4-8.2-33.8-17.8z"
            fill="url(#potraceFireGradient3)"
            className="flame-path"
          />
        </g>
      </svg>

      <style jsx>{`
        .burnwise-logo {
          display: inline-block;
          filter: drop-shadow(0 0 20px rgba(255, 107, 53, 0.4));
        }

        .logo-animated {
          animation: logoFloat 6s ease-in-out infinite;
        }

        .flame-path {
          filter: url(#fireGlow);
          transition: all 0.3s ease;
        }

        .flame-1 .flame-path {
          transform-origin: center bottom;
          animation: flame1Flicker 3s ease-in-out infinite;
        }

        .flame-2 .flame-path {
          transform-origin: center bottom;
          animation: flame2Flicker 2.5s ease-in-out infinite 0.5s;
        }

        .flame-3 .flame-path {
          transform-origin: center bottom;
          animation: flame3Flicker 3.2s ease-in-out infinite 1s;
        }

        @keyframes logoFloat {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-10px) rotate(1deg); }
        }

        @keyframes flame1Flicker {
          0%, 100% { transform: scaleY(1) scaleX(1); }
          25% { transform: scaleY(1.05) scaleX(0.98); }
          50% { transform: scaleY(0.95) scaleX(1.02); }
          75% { transform: scaleY(1.02) scaleX(0.99); }
        }

        @keyframes flame2Flicker {
          0%, 100% { transform: scaleY(1) scaleX(1); }
          20% { transform: scaleY(1.08) scaleX(0.96); }
          40% { transform: scaleY(0.92) scaleX(1.04); }
          60% { transform: scaleY(1.03) scaleX(0.98); }
          80% { transform: scaleY(0.97) scaleX(1.01); }
        }

        @keyframes flame3Flicker {
          0%, 100% { transform: scaleY(1) scaleX(1); }
          30% { transform: scaleY(1.06) scaleX(0.97); }
          60% { transform: scaleY(0.94) scaleX(1.03); }
          90% { transform: scaleY(1.01) scaleX(0.99); }
        }

        .burnwise-logo:hover .flame-path {
          filter: url(#fireGlow) brightness(1.2);
        }

        .burnwise-logo:hover {
          filter: drop-shadow(0 0 30px rgba(255, 107, 53, 0.6));
          transform: scale(1.05);
        }
      `}</style>
    </div>
  );
};

export default BurnwiseLogoPotraceExact;