import React from 'react';
import ActualLogoFireAnimation from './ActualLogoFireAnimation';
import '../styles/FullScreenStartup.css';

const FullScreenStartup = ({ onComplete, isTransitioning }) => {
  const handleAnimationComplete = () => {
    // Call the parent's onComplete handler
    if(onComplete) {
      onComplete();
    }
  };
  
  return (
    <div 
      className="fullscreen-startup"
      style={{
        opacity: isTransitioning ? 0 : 1,
        transition: 'opacity 0.8s ease-out'
      }}
    >
      <ActualLogoFireAnimation onComplete={handleAnimationComplete} />
      
      {/* Skip button */}
      <button 
        onClick={handleAnimationComplete}
        className="skip-animation-btn"
      >
        Skip Animation
      </button>
    </div>
  );
};

export default FullScreenStartup;