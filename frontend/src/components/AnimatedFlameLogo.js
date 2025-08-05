import React from 'react';
import './AnimatedFlameLogo.css';

const AnimatedFlameLogo = ({ size = 120, animated = true, startupAnimation = false }) => {
  return (
    <div className={`animated-flame-container ${startupAnimation ? 'startup' : ''}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 120"
        className={`animated-flame-logo ${animated ? 'animated' : ''}`}
        style={{ filter: 'drop-shadow(0 0 20px rgba(255, 107, 53, 0.6))' }}
      >
        {/* Fire Gradient Definitions */}
        <defs>
          {/* Main Fire Gradient */}
          <linearGradient id="fireGradient" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#ff4500">
              <animate attributeName="stop-color" 
                values="#ff4500;#ff5722;#ff6b35;#ff5722;#ff4500" 
                dur="2s" 
                repeatCount="indefinite"/>
            </stop>
            <stop offset="30%" stopColor="#ff6b35">
              <animate attributeName="stop-color" 
                values="#ff6b35;#ff8a50;#FFB000;#ff8a50;#ff6b35" 
                dur="2.3s" 
                repeatCount="indefinite"/>
            </stop>
            <stop offset="70%" stopColor="#FFB000">
              <animate attributeName="stop-color" 
                values="#FFB000;#ffd54f;#fff3a0;#ffd54f;#FFB000" 
                dur="1.8s" 
                repeatCount="indefinite"/>
            </stop>
            <stop offset="100%" stopColor="#fff8e1">
              <animate attributeName="stop-color" 
                values="#fff8e1;#ffffff;#fff3a0;#ffffff;#fff8e1" 
                dur="1.5s" 
                repeatCount="indefinite"/>
            </stop>
          </linearGradient>

          {/* Secondary Fire Gradient */}
          <linearGradient id="fireGradient2" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#ff5722">
              <animate attributeName="stop-color" 
                values="#ff5722;#ff6b35;#ff8a50;#ff6b35;#ff5722" 
                dur="1.7s" 
                repeatCount="indefinite"/>
            </stop>
            <stop offset="50%" stopColor="#ff8a50">
              <animate attributeName="stop-color" 
                values="#ff8a50;#FFB000;#ffd54f;#FFB000;#ff8a50" 
                dur="2.1s" 
                repeatCount="indefinite"/>
            </stop>
            <stop offset="100%" stopColor="#ffd54f">
              <animate attributeName="stop-color" 
                values="#ffd54f;#fff3a0;#ffffff;#fff3a0;#ffd54f" 
                dur="1.3s" 
                repeatCount="indefinite"/>
            </stop>
          </linearGradient>

          {/* Tertiary Fire Gradient */}
          <linearGradient id="fireGradient3" x1="30%" y1="100%" x2="80%" y2="0%">
            <stop offset="0%" stopColor="#ff6b35">
              <animate attributeName="stop-color" 
                values="#ff6b35;#ff8a50;#FFB000;#ff8a50;#ff6b35" 
                dur="1.9s" 
                repeatCount="indefinite"/>
            </stop>
            <stop offset="60%" stopColor="#FFB000">
              <animate attributeName="stop-color" 
                values="#FFB000;#ffd54f;#fff8e1;#ffd54f;#FFB000" 
                dur="2.4s" 
                repeatCount="indefinite"/>
            </stop>
            <stop offset="100%" stopColor="#fff3a0">
              <animate attributeName="stop-color" 
                values="#fff3a0;#ffffff;#fff8e1;#ffffff;#fff3a0" 
                dur="1.6s" 
                repeatCount="indefinite"/>
            </stop>
          </linearGradient>

          {/* Glow Filters */}
          <filter id="fireGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge> 
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>

          <filter id="innerGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1" result="coloredBlur"/>
            <feMerge> 
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Main Flame Body */}
        <path 
          d="M50 115 
             Q35 110 25 95 
             Q20 80 25 65 
             Q30 50 40 40 
             Q45 25 50 15 
             Q55 25 60 40 
             Q70 50 75 65 
             Q80 80 75 95 
             Q65 110 50 115 Z"
          fill="url(#fireGradient)" 
          filter="url(#fireGlow)"
          className="flame-main"
        />

        {/* Left Flame Tongue */}
        <path 
          d="M35 85 
             Q25 80 20 70 
             Q15 55 20 45 
             Q25 35 30 25 
             Q35 15 40 8 
             Q42 12 45 20 
             Q48 30 45 40 
             Q42 55 38 70 
             Q36 78 35 85 Z"
          fill="url(#fireGradient2)" 
          filter="url(#innerGlow)"
          className="flame-left"
        />

        {/* Right Flame Tongue */}
        <path 
          d="M65 85 
             Q75 80 80 70 
             Q85 55 80 45 
             Q75 35 70 25 
             Q65 15 60 8 
             Q58 12 55 20 
             Q52 30 55 40 
             Q58 55 62 70 
             Q64 78 65 85 Z"
          fill="url(#fireGradient3)" 
          filter="url(#innerGlow)"
          className="flame-right"
        />

        {/* Center Inner Flame */}
        <path 
          d="M50 95 
             Q42 90 38 80 
             Q35 65 40 55 
             Q45 45 50 35 
             Q55 45 60 55 
             Q65 65 62 80 
             Q58 90 50 95 Z"
          fill="url(#fireGradient2)" 
          filter="url(#innerGlow)"
          className="flame-inner"
          opacity="0.8"
        />

        {/* Hot Core */}
        <ellipse 
          cx="50" 
          cy="75" 
          rx="8" 
          ry="12"
          fill="url(#fireGradient3)"
          filter="url(#innerGlow)"
          className="flame-core"
          opacity="0.9"
        />

        {/* Animated Particles */}
        <g className="flame-particles">
          <circle cx="45" cy="30" r="1" fill="#fff3a0" opacity="0.7" className="particle particle-1"/>
          <circle cx="55" cy="25" r="0.8" fill="#ffd54f" opacity="0.6" className="particle particle-2"/>
          <circle cx="48" cy="18" r="0.6" fill="#ffffff" opacity="0.8" className="particle particle-3"/>
          <circle cx="52" cy="12" r="0.5" fill="#fff8e1" opacity="0.7" className="particle particle-4"/>
        </g>
      </svg>
    </div>
  );
};

export default AnimatedFlameLogo;