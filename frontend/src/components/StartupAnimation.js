import React, { useEffect, useState } from 'react';
import AnimatedFlameLogo from './AnimatedFlameLogo';
import '../styles/StartupAnimation.css';

const StartupAnimation = ({ onComplete }) => {
  const [phase, setPhase] = useState('entering');
  
  useEffect(() => {
    // Store all timer IDs for proper cleanup
    let enterTimer, centerTimer, exitTimer;
    
    // Phase 1: Entering (0.5s)
    enterTimer = setTimeout(() => {
      setPhase('centered');
      
      // Phase 2: Centered (2s)
      centerTimer = setTimeout(() => {
        setPhase('exiting');
        
        // Phase 3: Exiting (0.8s)
        exitTimer = setTimeout(() => {
          if (onComplete) onComplete();
        }, 800);
      }, 2000);
    }, 500);
    
    // Cleanup function
    return () => {
      clearTimeout(enterTimer);
      clearTimeout(centerTimer);
      clearTimeout(exitTimer);
    };
  }, []); // Empty dependency array - run once on mount
  
  return (
    <div className={`startup-animation ${phase}`}>
      <div className="startup-logo">
        <AnimatedFlameLogo size={180} animated={true} />
      </div>
    </div>
  );
};

export default StartupAnimation;