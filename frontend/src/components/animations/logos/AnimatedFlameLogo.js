import React from 'react';
import './AnimatedFlameLogo.css';

const AnimatedFlameLogo = ({ size = 120, animated = true, startupAnimation = false }) => {
  return (
    <div className={`animated-flame-container ${startupAnimation ? 'startup' : ''}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 1000 1200"
        className={`animated-flame-logo ${animated ? 'animated' : ''}`}
        style={{ filter: 'drop-shadow(0 0 20px rgba(255, 107, 53, 0.6))' }}
      >
        <defs>
          {/* Advanced Fire Gradient with AnimateTransform */}
          <linearGradient id="fireGradient" x1="0%" y1="100%" x2="0%" y2="0%">
            <animateTransform
              attributeName="gradientTransform"
              type="rotate"
              from="0 0.5 0.5"
              to="360 0.5 0.5"
              dur="11s"
              repeatCount="indefinite"
            />
            <stop offset="0%" stopColor="#d32f2f">
              <animate attributeName="stop-color" 
                values="#d32f2f;#ff4500;#ff5722;#ff4500;#d32f2f" 
                dur="4.1s" 
                repeatCount="indefinite"/>
              <animate attributeName="offset" 
                values="0%;5%;0%" 
                dur="4s" 
                repeatCount="indefinite"/>
            </stop>
            <stop offset="30%" stopColor="#ff5722">
              <animate attributeName="stop-color" 
                values="#ff5722;#ff6b35;#ff8a50;#ff6b35;#ff5722" 
                dur="2.5s" 
                repeatCount="indefinite"/>
              <animate attributeName="offset" 
                values="30%;35%;30%" 
                dur="3.5s" 
                repeatCount="indefinite"/>
            </stop>
            <stop offset="60%" stopColor="#ff8a50">
              <animate attributeName="stop-color" 
                values="#ff8a50;#FFB000;#ffd54f;#FFB000;#ff8a50" 
                dur="3.1s" 
                repeatCount="indefinite"/>
            </stop>
            <stop offset="85%" stopColor="#ffd54f">
              <animate attributeName="stop-color" 
                values="#ffd54f;#fff3a0;#ffffff;#fff3a0;#ffd54f" 
                dur="1.8s" 
                repeatCount="indefinite"/>
            </stop>
            <stop offset="100%" stopColor="#ffffff">
              <animate attributeName="stop-color" 
                values="#ffffff;#fff8e1;#fff3a0;#fff8e1;#ffffff" 
                dur="2.3s" 
                repeatCount="indefinite"/>
            </stop>
          </linearGradient>

          {/* Secondary Gradient with Flow Effect */}
          <linearGradient id="fireGradient2" x1="0%" y1="100%" x2="30%" y2="0%">
            <animateTransform
              attributeName="gradientTransform"
              type="translate"
              values="0 0; 0.1 -0.2; 0 0"
              dur="2.7s"
              repeatCount="indefinite"
            />
            <stop offset="0%" stopColor="#ff4500"/>
            <stop offset="50%" stopColor="#ff8a50"/>
            <stop offset="100%" stopColor="#fff3a0"/>
          </linearGradient>

          {/* Tertiary Gradient */}
          <linearGradient id="fireGradient3" x1="0%" y1="100%" x2="50%" y2="0%">
            <stop offset="0%" stopColor="#ff5722"/>
            <stop offset="70%" stopColor="#FFB000"/>
            <stop offset="100%" stopColor="#ffffff"/>
          </linearGradient>

          {/* SVG Filters for Realistic Fire */}
          <filter id="fireDistortion" x="-50%" y="-50%" width="200%" height="200%">
            {/* Turbulence for organic flame movement */}
            <feTurbulence 
              type="fractalNoise" 
              baseFrequency="0.02 0.1" 
              numOctaves="2" 
              seed="2">
              <animate attributeName="baseFrequency" 
                values="0.02 0.1;0.02 0.15;0.02 0.1" 
                dur="4.1s" 
                repeatCount="indefinite"/>
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" scale="8">
              <animate attributeName="scale" 
                values="8;12;8" 
                dur="3.1s" 
                repeatCount="indefinite"/>
            </feDisplacementMap>
            {/* Glow effect */}
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>

          {/* Heat Shimmer Filter */}
          <filter id="heatShimmer" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence 
              type="turbulence" 
              baseFrequency="0.01 0.02" 
              numOctaves="1" 
              seed="5">
              <animate attributeName="seed" 
                values="5;10;5" 
                dur="2.3s" 
                repeatCount="indefinite"/>
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" scale="3"/>
          </filter>

          {/* Ember Glow */}
          <radialGradient id="emberGradient">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="1"/>
            <stop offset="30%" stopColor="#ffd54f" stopOpacity="0.8"/>
            <stop offset="60%" stopColor="#ff6b35" stopOpacity="0.5"/>
            <stop offset="100%" stopColor="#ff4500" stopOpacity="0"/>
          </radialGradient>
        </defs>

        {/* Ember Particles */}
        <g className="ember-particles">
          {[...Array(8)].map((_, i) => (
            <circle
              key={i}
              r="2"
              fill="url(#emberGradient)"
              opacity="0"
            >
              <animateMotion
                path={`M ${300 + i * 50} 1000 Q ${320 + i * 30} ${800 - i * 20} ${280 + i * 60} 600`}
                dur={`${3 + i * 0.5}s`}
                begin={`${i * 0.4}s`}
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0;1;1;0"
                dur={`${3 + i * 0.5}s`}
                begin={`${i * 0.4}s`}
                repeatCount="indefinite"
              />
              <animate
                attributeName="r"
                values="2;4;2;1"
                dur={`${3 + i * 0.5}s`}
                begin={`${i * 0.4}s`}
                repeatCount="indefinite"
              />
            </circle>
          ))}
        </g>

        {/* Main Flame Group */}
        <g transform="translate(100,1150) scale(0.248,-0.248)" filter="url(#fireDistortion)">
          
          {/* Main Flame Body with Path Morphing */}
          <path 
            d="M2737 4632 c-3 -4 -8 -63 -11 -132 -14 -249 -52 -487 -95 -585 -5 -11 -21 -53 -37 -94 -65 -170 -236 -386 -615 -776 -153 -158 -236 -248 -293 -318 -34 -42 -38 -52 -32 -85 10 -66 104 -368 152 -488 25 -64 47 -124 49 -133 5 -26 37 -104 53 -129 l15 -24 26 33 c14 18 32 45 41 60 61 110 424 667 580 889 33 47 103 153 157 235 53 83 100 152 105 153 4 2 8 10 8 17 0 7 3 15 8 17 4 2 20 29 36 62 16 32 35 63 41 70 13 13 95 149 95 158 0 3 29 58 65 122 36 64 65 123 65 131 0 8 -31 79 -69 157 -37 79 -92 193 -121 253 -29 61 -56 112 -61 113 -5 2 -9 12 -9 23 0 17 -89 197 -111 225 -5 6 -7 13 -6 15 2 2 -4 12 -14 21 -10 10 -20 14 -22 10z"
            fill="url(#fireGradient)" 
            className="flame-main"
          >
            <animate 
              attributeName="d" 
              values="M2737 4632 c-3 -4 -8 -63 -11 -132 -14 -249 -52 -487 -95 -585 -5 -11 -21 -53 -37 -94 -65 -170 -236 -386 -615 -776 -153 -158 -236 -248 -293 -318 -34 -42 -38 -52 -32 -85 10 -66 104 -368 152 -488 25 -64 47 -124 49 -133 5 -26 37 -104 53 -129 l15 -24 26 33 c14 18 32 45 41 60 61 110 424 667 580 889 33 47 103 153 157 235 53 83 100 152 105 153 4 2 8 10 8 17 0 7 3 15 8 17 4 2 20 29 36 62 16 32 35 63 41 70 13 13 95 149 95 158 0 3 29 58 65 122 36 64 65 123 65 131 0 8 -31 79 -69 157 -37 79 -92 193 -121 253 -29 61 -56 112 -61 113 -5 2 -9 12 -9 23 0 17 -89 197 -111 225 -5 6 -7 13 -6 15 2 2 -4 12 -14 21 -10 10 -20 14 -22 10z;
                      M2737 4632 c-3 -4 -10 -68 -13 -137 -16 -254 -54 -492 -100 -590 -6 -13 -23 -58 -39 -99 -70 -175 -241 -391 -625 -786 -158 -163 -241 -253 -298 -323 -36 -44 -40 -54 -34 -87 12 -68 106 -373 156 -498 27 -66 49 -129 51 -138 6 -28 39 -109 55 -134 l17 -26 28 35 c16 20 34 47 43 62 63 115 434 677 590 899 35 49 105 158 162 240 55 85 102 157 107 158 5 2 9 11 9 18 0 8 4 16 9 18 5 2 22 31 38 64 18 34 37 65 43 72 14 14 97 154 97 163 0 4 31 60 67 124 38 66 67 128 67 136 0 9 -33 81 -71 162 -39 81 -94 198 -123 258 -31 63 -58 117 -63 118 -6 2 -10 13 -10 24 0 18 -91 202 -113 230 -6 7 -8 14 -7 16 3 2 -3 13 -13 22 -11 11 -21 15 -23 11z;
                      M2737 4632 c-3 -4 -12 -73 -15 -142 -18 -259 -56 -497 -105 -605 -7 -15 -25 -63 -41 -104 -75 -180 -246 -406 -635 -796 -163 -168 -246 -258 -303 -328 -38 -46 -42 -56 -36 -89 14 -70 108 -378 160 -508 29 -68 51 -134 53 -143 7 -30 41 -114 57 -139 l19 -28 30 37 c18 22 36 49 45 64 65 120 444 687 600 909 37 51 107 163 167 245 57 87 104 162 109 163 6 2 10 12 10 19 0 9 5 17 10 19 6 2 24 33 40 66 20 36 39 67 45 74 15 15 99 159 99 168 0 5 33 62 69 126 40 68 69 133 69 141 0 10 -35 83 -73 167 -41 83 -96 203 -125 263 -33 65 -60 122 -65 123 -7 2 -11 14 -11 25 0 19 -93 207 -115 235 -7 8 -9 15 -8 17 4 2 -2 14 -12 23 -12 12 -22 16 -24 12z;
                      M2737 4632 c-3 -4 -9 -65 -12 -134 -15 -251 -53 -489 -97 -587 -5 -12 -22 -55 -38 -96 -67 -172 -238 -388 -620 -781 -155 -160 -238 -250 -295 -320 -35 -43 -39 -53 -33 -86 11 -67 105 -370 154 -493 26 -65 48 -126 50 -135 5 -27 38 -106 54 -131 l16 -25 27 34 c15 19 33 46 42 61 62 112 428 672 585 894 34 48 104 155 159 237 54 84 101 154 106 155 4 2 8 10 8 17 0 7 3 15 8 17 4 2 21 30 37 63 17 33 36 64 42 71 13 13 96 151 96 160 0 3 30 59 66 123 37 65 66 125 66 133 0 8 -32 80 -70 159 -38 80 -93 195 -122 256 -30 62 -57 114 -62 115 -5 2 -9 12 -9 23 0 17 -90 199 -112 227 -5 6 -7 13 -6 15 2 2 -4 12 -14 21 -10 10 -20 14 -22 10z;
                      M2737 4632 c-3 -4 -8 -63 -11 -132 -14 -249 -52 -487 -95 -585 -5 -11 -21 -53 -37 -94 -65 -170 -236 -386 -615 -776 -153 -158 -236 -248 -293 -318 -34 -42 -38 -52 -32 -85 10 -66 104 -368 152 -488 25 -64 47 -124 49 -133 5 -26 37 -104 53 -129 l15 -24 26 33 c14 18 32 45 41 60 61 110 424 667 580 889 33 47 103 153 157 235 53 83 100 152 105 153 4 2 8 10 8 17 0 7 3 15 8 17 4 2 20 29 36 62 16 32 35 63 41 70 13 13 95 149 95 158 0 3 29 58 65 122 36 64 65 123 65 131 0 8 -31 79 -69 157 -37 79 -92 193 -121 253 -29 61 -56 112 -61 113 -5 2 -9 12 -9 23 0 17 -89 197 -111 225 -5 6 -7 13 -6 15 2 2 -4 12 -14 21 -10 10 -20 14 -22 10z"
              dur="7.3s"
              repeatCount="indefinite"
              calcMode="spline"
              keySplines="0.42 0 0.58 1;0.42 0 0.58 1;0.42 0 0.58 1;0.42 0 0.58 1"
              keyTimes="0;0.2;0.4;0.7;1"
            />
            <animateTransform
              attributeName="transform"
              type="scale"
              values="1,1; 1.02,1.05; 1,1"
              dur="5.3s"
              repeatCount="indefinite"
              additive="sum"
            />
          </path>

          {/* Middle Flame Fragment with Complex Animation */}
          <path 
            d="M3146 3272 c-11 -19 -76 -205 -76 -220 0 -8 -13 -42 -29 -76 -16 -33 -43 -90 -59 -126 -17 -36 -73 -146 -126 -244 -53 -99 -96 -183 -96 -188 0 -4 -4 -8 -10 -8 -5 0 -9 -3 -8 -7 3 -10 -160 -306 -217 -393 -23 -36 -49 -85 -59 -110 -10 -25 -28 -65 -42 -89 -13 -24 -23 -46 -21 -47 9 -10 684 547 814 672 82 78 83 79 73 114 -5 19 -18 96 -30 170 -12 74 -27 169 -35 210 -7 41 -23 134 -36 205 -22 129 -31 156 -43 137z"
            fill="url(#fireGradient2)" 
            filter="url(#heatShimmer)"
            className="flame-middle"
          >
            <animateTransform
              attributeName="transform"
              type="rotate"
              values="0 3146 3272; -3 3146 3272; 3 3146 3272; 0 3146 3272"
              dur="3.7s"
              repeatCount="indefinite"
              additive="sum"
            />
            <animateTransform
              attributeName="transform"
              type="scale"
              values="1,1; 1.05,1.1; 0.95,1.05; 1,1"
              dur="2.9s"
              repeatCount="indefinite"
              additive="sum"
            />
          </path>

          {/* Small Flame Fragment with Rapid Movement */}
          <path 
            d="M3545 2476 c-11 -7 -24 -14 -30 -15 -5 -1 -24 -15 -42 -31 -17 -17 -36 -30 -41 -30 -6 0 -12 -4 -14 -8 -1 -5 -39 -30 -83 -57 -44 -26 -108 -69 -142 -94 -35 -25 -65 -44 -68 -41 -2 3 -10 -2 -17 -11 -7 -8 -60 -49 -118 -89 -115 -81 -320 -230 -355 -258 -111 -89 -147 -116 -150 -112 -2 3 -10 -2 -17 -11 -7 -9 -35 -33 -63 -54 -102 -79 -177 -149 -186 -172 -5 -13 -18 -81 -29 -151 -30 -177 -29 -170 -35 -237 -3 -33 -10 -61 -15 -63 -5 -2 -7 -9 -4 -16 3 -7 -7 -66 -22 -132 -47 -213 -48 -224 -36 -236 9 -9 12 -9 12 1 0 15 138 181 151 181 5 0 9 5 9 11 0 11 7 20 145 169 158 170 381 430 544 633 30 37 58 67 63 67 4 0 8 6 8 14 0 8 9 21 20 29 11 8 18 16 15 18 -2 3 16 26 41 53 24 27 44 51 45 55 0 3 29 40 64 81 106 124 385 497 385 514 0 10 -15 7 -35 -8z"
            fill="url(#fireGradient3)" 
            className="flame-small"
          >
            <animateTransform
              attributeName="transform"
              type="rotate"
              values="0 3545 2476; -5 3545 2476; 5 3545 2476; 0 3545 2476"
              dur="2.3s"
              repeatCount="indefinite"
              additive="sum"
            />
            <animateTransform
              attributeName="transform"
              type="scale"
              values="1,1; 0.9,1.15; 1.1,0.95; 1,1"
              dur="1.9s"
              repeatCount="indefinite"
              additive="sum"
            />
            <animate
              attributeName="opacity"
              values="1; 0.8; 1"
              dur="1.3s"
              repeatCount="indefinite"
            />
          </path>
        </g>

        {/* Additional Heat Distortion Layer */}
        <g transform="translate(100,1150) scale(0.248,-0.248)" opacity="0.3" filter="url(#heatShimmer)">
          <use href="#mainFlame" transform="scale(1.1, 1.05)" />
        </g>
      </svg>
    </div>
  );
};

export default AnimatedFlameLogo;