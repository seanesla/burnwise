import React, { useState } from 'react';
import '../styles/LogoTester.css';

const LogoTester = () => {
  const [opacity, setOpacity] = useState(0.5);
  const [showGrid, setShowGrid] = useState(false);
  const [showDifference, setShowDifference] = useState(false);
  const [scale, setScale] = useState(2);

  // Since we don't have the original image file, we'll create a reference shape
  // This is based on the logo description: 3 curved teal segments

  return (
    <div className="logo-tester">
      <h2>Burnwise Logo SVG Tester</h2>
      
      <div className="controls">
        <label>
          Opacity: {opacity}
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={opacity}
            onChange={(e) => setOpacity(parseFloat(e.target.value))}
          />
        </label>
        
        <label>
          Scale: {scale}x
          <input
            type="range"
            min="1"
            max="5"
            step="0.5"
            value={scale}
            onChange={(e) => setScale(parseFloat(e.target.value))}
          />
        </label>
        
        <label>
          <input
            type="checkbox"
            checked={showGrid}
            onChange={(e) => setShowGrid(e.target.checked)}
          />
          Show Grid
        </label>
        
        <label>
          <input
            type="checkbox"
            checked={showDifference}
            onChange={(e) => setShowDifference(e.target.checked)}
          />
          Difference Mode
        </label>
      </div>

      <div className="comparison-container">
        <div className="logo-view" style={{ transform: `scale(${scale})` }}>
          {/* Reference box for the original logo */}
          <div className="original-logo-placeholder">
            <p>Place original logo here</p>
          </div>
          
          <div 
            className="svg-overlay" 
            style={{ 
              opacity: opacity,
              mixBlendMode: showDifference ? 'difference' : 'normal'
            }}
          >
            <svg
              viewBox="0 0 200 200"
              xmlns="http://www.w3.org/2000/svg"
              className="test-svg"
            >
              <defs>
                <linearGradient id="tealGradient" x1="0%" y1="50%" x2="100%" y2="50%">
                  <stop offset="0%" stopColor="#3ED9C4" />
                  <stop offset="100%" stopColor="#5DE6D3" />
                </linearGradient>
              </defs>
              
              {/* First attempt at matching the curves */}
              <g id="burnwise-flames">
                {/* Bottom flame - largest */}
                <path
                  d="M 50 160
                     C 50 160, 50 145, 55 135
                     C 60 125, 70 115, 85 110
                     C 100 105, 120 105, 140 110
                     C 160 115, 175 125, 180 135
                     C 185 145, 185 160, 185 160
                     C 185 160, 170 155, 155 150
                     C 140 145, 125 140, 110 135
                     C 95 130, 80 125, 65 130
                     C 55 135, 50 145, 50 160 Z"
                  fill="url(#tealGradient)"
                />
                
                {/* Middle flame */}
                <path
                  d="M 50 105
                     C 50 105, 50 90, 55 80
                     C 60 70, 70 60, 85 55
                     C 100 50, 120 50, 140 55
                     C 160 60, 175 70, 180 80
                     C 185 90, 185 105, 185 105
                     C 185 105, 170 100, 155 95
                     C 140 90, 125 85, 110 80
                     C 95 75, 80 70, 65 75
                     C 55 80, 50 90, 50 105 Z"
                  fill="url(#tealGradient)"
                />
                
                {/* Top flame - smallest */}
                <path
                  d="M 50 50
                     C 50 50, 50 35, 55 25
                     C 60 15, 70 5, 85 0
                     C 100 -5, 120 -5, 140 0
                     C 160 5, 175 15, 180 25
                     C 185 35, 185 50, 185 50
                     C 185 50, 170 45, 155 40
                     C 140 35, 125 30, 110 25
                     C 95 20, 80 15, 65 20
                     C 55 25, 50 35, 50 50 Z"
                  fill="url(#tealGradient)"
                />
              </g>
              
              {showGrid && (
                <g className="grid-overlay">
                  {/* 10px grid */}
                  {[...Array(20)].map((_, i) => (
                    <line
                      key={`h${i}`}
                      x1="0"
                      y1={i * 10}
                      x2="200"
                      y2={i * 10}
                      stroke="rgba(255,255,255,0.2)"
                      strokeWidth="0.5"
                    />
                  ))}
                  {[...Array(20)].map((_, i) => (
                    <line
                      key={`v${i}`}
                      x1={i * 10}
                      y1="0"
                      x2={i * 10}
                      y2="200"
                      stroke="rgba(255,255,255,0.2)"
                      strokeWidth="0.5"
                    />
                  ))}
                </g>
              )}
            </svg>
          </div>
        </div>
        
        <div className="info-panel">
          <h3>Instructions:</h3>
          <ul>
            <li>Adjust opacity to see alignment</li>
            <li>Use difference mode to highlight mismatches</li>
            <li>Enable grid for precise measurements</li>
            <li>Scale up to see details</li>
          </ul>
          <p>In difference mode, black = perfect match</p>
        </div>
      </div>
    </div>
  );
};

export default LogoTester;