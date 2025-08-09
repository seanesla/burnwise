/**
 * Logo Fire Animation Component
 * Complete cinematic fire animation using the BURNWISE logo as particles
 */

import React, { useRef, useEffect, useState } from 'react';
import { FlameLogoCache, LogoFlameEmitter } from './LogoFireSystem';
import LogoFireRenderer from './LogoFireRenderer';
import FireAnimationController from './FireAnimationController';
import './CinematicFireAnimation.css';

const LogoFireAnimation = ({ 
  onComplete = () => {}, 
  quality = 'auto',
  duration = 6000,
  skipAnimation = false 
}) => {
  const canvasRef = useRef(null);
  const cacheRef = useRef(null);
  const emitterRef = useRef(null);
  const rendererRef = useRef(null);
  const controllerRef = useRef(null);
  const animationFrameRef = useRef(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [currentPhase, setCurrentPhase] = useState('initial');
  
  // Quality settings based on device
  const getQualitySettings = () => {
    const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
    const cores = navigator.hardwareConcurrency || 4;
    
    if(quality !== 'auto') {
      switch(quality) {
        case 'low': return { maxParticles: 100, spawnRate: 30 };
        case 'medium': return { maxParticles: 300, spawnRate: 60 };
        case 'high': return { maxParticles: 500, spawnRate: 100 };
        default: return { maxParticles: 300, spawnRate: 60 };
      }
    }
    
    // Auto-detect
    if(isMobile) return { maxParticles: 100, spawnRate: 30 };
    if(cores <= 4) return { maxParticles: 300, spawnRate: 60 };
    return { maxParticles: 500, spawnRate: 100 };
  };
  
  // Animation loop
  const animate = () => {
    if(!emitterRef.current || !rendererRef.current || !controllerRef.current) return;
    
    const now = performance.now();
    const deltaTime = Math.min(1/30, (now - (animationFrameRef.lastTime || now)) / 1000);
    animationFrameRef.lastTime = now;
    
    // Update animation controller
    const animationState = controllerRef.current.update(now);
    
    // Check for phase change
    if(animationState.phase !== currentPhase) {
      setCurrentPhase(animationState.phase);
      handlePhaseChange(animationState.phase);
    }
    
    // Apply phase to emitter
    controllerRef.current.applyPhaseToEmitter(emitterRef.current, animationState);
    
    // Update particle system
    emitterRef.current.update(deltaTime, now * 0.001);
    
    // Render
    const fps = rendererRef.current.render(emitterRef.current, deltaTime, now * 0.001, animationState.phase);
    
    // Auto-adjust quality if FPS drops
    if(fps < 25 && emitterRef.current.maxParticles > 100) {
      emitterRef.current.maxParticles = Math.max(100, emitterRef.current.maxParticles - 50);
      console.log(`Reducing particle limit to ${emitterRef.current.maxParticles} due to low FPS: ${fps}`);
    }
    
    // Check for completion
    if(animationState.phase === 'complete' || (skipAnimation && now > 1000)) {
      onComplete();
      return;
    }
    
    // Continue animation
    animationFrameRef.current = requestAnimationFrame(animate);
  };
  
  // Handle phase transitions
  const handlePhaseChange = (phase) => {
    console.log(`Phase change: ${phase}`);
    
    switch(phase) {
      case 'ignition':
        // Single spark then burst
        setTimeout(() => {
          if(emitterRef.current) {
            emitterRef.current.spawn('spark', emitterRef.current.x, emitterRef.current.y);
            setTimeout(() => {
              emitterRef.current.burst(150, 'spark');
            }, 200);
          }
        }, 100);
        break;
        
      case 'formation':
        emitterRef.current.spawnRate = 30;
        break;
        
      case 'stabilization':
        emitterRef.current.spawnRate = getQualitySettings().spawnRate;
        break;
        
      case 'transition':
        // Transition phase - particles morph to final position
        break;
        
      case 'complete':
        onComplete();
        break;
        
      default:
        break;
    }
  };
  
  // Initialize everything
  useEffect(() => {
    const init = async () => {
      if(!canvasRef.current) return;
      
      console.log('Initializing Logo Fire Animation...');
      
      // Initialize cache
      cacheRef.current = new FlameLogoCache();
      await cacheRef.current.init();
      
      // Get canvas dimensions
      const rect = canvasRef.current.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height * 0.6; // Slightly below center
      
      // Create emitter
      const settings = getQualitySettings();
      emitterRef.current = new LogoFlameEmitter(centerX, centerY);
      emitterRef.current.maxParticles = settings.maxParticles;
      
      // Create renderer
      rendererRef.current = new LogoFireRenderer(canvasRef.current, cacheRef.current);
      
      // Create animation controller
      controllerRef.current = new FireAnimationController(duration);
      controllerRef.current.start();
      
      // Register phase callbacks
      controllerRef.current.registerPhaseCallback('ignition', () => {
        console.log('IGNITION PHASE TRIGGERED');
      });
      
      // Start animation
      setIsLoading(false);
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    
    init();
    
    // Handle resize
    const handleResize = () => {
      if(rendererRef.current && canvasRef.current) {
        rendererRef.current.resize();
        const rect = canvasRef.current.getBoundingClientRect();
        if(emitterRef.current) {
          emitterRef.current.x = rect.width / 2;
          emitterRef.current.y = rect.height * 0.6;
        }
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    // Cleanup
    return () => {
      if(animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if(rendererRef.current) {
        rendererRef.current.destroy();
      }
      window.removeEventListener('resize', handleResize);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  
  return (
    <div className="cinematic-fire-container">
      {isLoading && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: 'white',
          fontSize: '18px',
          fontFamily: 'Inter, sans-serif'
        }}>
          Initializing fire system...
        </div>
      )}
      
      <canvas 
        ref={canvasRef}
        className="fire-canvas"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          opacity: isLoading ? 0 : 1,
          transition: 'opacity 0.5s ease-in'
        }}
      />
      
      {/* Debug info */}
      {window.DEBUG_FIRE && (
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          padding: '10px',
          background: 'rgba(0,0,0,0.8)',
          color: 'white',
          fontFamily: 'monospace',
          fontSize: '12px',
          borderRadius: '4px'
        }}>
          <div>Phase: {currentPhase}</div>
          <div>Quality: {quality}</div>
        </div>
      )}
      
      {/* Skip button */}
      {!skipAnimation && currentPhase !== 'complete' && !isLoading && (
        <button 
          onClick={onComplete}
          style={{
            position: 'absolute',
            bottom: '30px',
            right: '30px',
            padding: '12px 24px',
            background: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            border: '1px solid rgba(255, 107, 53, 0.5)',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'all 0.3s ease',
            zIndex: 1000
          }}
          onMouseEnter={(e) => {
            e.target.style.background = 'rgba(255, 107, 53, 0.2)';
            e.target.style.borderColor = 'rgba(255, 107, 53, 0.8)';
          }}
          onMouseLeave={(e) => {
            e.target.style.background = 'rgba(0, 0, 0, 0.7)';
            e.target.style.borderColor = 'rgba(255, 107, 53, 0.5)';
          }}
        >
          Skip Animation
        </button>
      )}
    </div>
  );
};

export default LogoFireAnimation;