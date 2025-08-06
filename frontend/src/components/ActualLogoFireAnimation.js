import React, { useEffect, useState } from 'react';
import ProfessionalFireLogo from './ProfessionalFireLogo';
import './ActualLogoFireAnimation.css';

const ActualLogoFireAnimation = ({ onComplete }) => {
  useEffect(() => {
    // Simple 5.5 second animation, then fade out
    const timer = setTimeout(() => {
      if (onComplete) onComplete();
    }, 5500);
    
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="actual-fire-container">
      <div className="logo-wrapper">
        <ProfessionalFireLogo size={180} onComplete={onComplete} />
      </div>
      <div className="burnwise-title">BURNWISE</div>
      <div className="burnwise-subtitle">Multi-Farm Agricultural Burn Coordinator</div>
    </div>
  );
};

export default ActualLogoFireAnimation;