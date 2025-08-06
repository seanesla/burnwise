import React, { useEffect, useState } from 'react';
import AnimatedFlameLogo from './AnimatedFlameLogo';
import '../styles/StartupAnimation.css';

const StartupAnimation = ({ onComplete }) => {
  const [phase, setPhase] = useState('intro'); // intro -> expanding -> morphing
  
  useEffect(() => {
    // Phase 1: Intro - flames ignite (1.2s)
    const introTimer = setTimeout(() => {
      setPhase('expanding');
      
      // Phase 2: Expanding - flames dance and merge (1.5s)
      const expandTimer = setTimeout(() => {
        setPhase('morphing');
        
        // Phase 3: Morphing to final position (0.8s)
        const morphTimer = setTimeout(() => {
          if (onComplete) onComplete();
        }, 800);
        
        return () => clearTimeout(morphTimer);
      }, 1500);
      
      return () => clearTimeout(expandTimer);
    }, 1200);
    
    return () => clearTimeout(introTimer);
  }, [onComplete]);
  
  return (
    <div className={`startup-animation ${phase}`}>
      <div className="startup-background-effects">
        <div className="fire-ring"></div>
        <div className="smoke-layer"></div>
      </div>
      <div className={`startup-logo-wrapper ${phase}`}>
        <AnimatedFlameLogo size={200} animated={true} />
      </div>
    </div>
  );
};

export default StartupAnimation;