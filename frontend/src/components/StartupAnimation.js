import React, { useEffect, useState } from 'react';
import AnimatedFlameLogo from './AnimatedFlameLogo';
import '../styles/StartupAnimation.css';

const StartupAnimation = ({ onComplete }) => {
  const [phase, setPhase] = useState('entering'); // entering -> centered -> exiting
  
  useEffect(() => {
    // Timeline for animation phases
    const enterTimer = setTimeout(() => {
      setPhase('centered');
      
      const centerTimer = setTimeout(() => {
        setPhase('exiting');
        
        const exitTimer = setTimeout(() => {
          if (onComplete) onComplete();
        }, 800); // Exit animation duration
        
        return () => clearTimeout(exitTimer);
      }, 2000); // How long to stay centered
      
      return () => clearTimeout(centerTimer);
    }, 500); // Entry animation duration
    
    return () => clearTimeout(enterTimer);
  }, [onComplete]);
  
  return (
    <div className={`startup-animation ${phase}`}>
      <div className="startup-logo">
        <AnimatedFlameLogo size={180} animated={true} />
      </div>
    </div>
  );
};

export default StartupAnimation;