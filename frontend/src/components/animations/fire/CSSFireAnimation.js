import React, { useEffect } from 'react';
import './CSSFireAnimation.css';

const CSSFireAnimation = ({ onComplete }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      if (onComplete) onComplete();
    }, 6000);
    
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fire-container">
      <div className="fire-wrapper">
        {/* Three flames matching BURNWISE logo */}
        <div className="flame flame-1">
          <div className="flame-inner"></div>
        </div>
        <div className="flame flame-2">
          <div className="flame-inner"></div>
        </div>
        <div className="flame flame-3">
          <div className="flame-inner"></div>
        </div>
      </div>
      <div className="burnwise-text">BURNWISE</div>
    </div>
  );
};

export default CSSFireAnimation;