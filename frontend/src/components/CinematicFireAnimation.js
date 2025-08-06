/**
 * Cinematic Fire Animation React Component
 * Integrates particle system with React lifecycle
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { FireEmitter } from './FireParticleSystem';
import FireRenderer from './FireRenderer';
import './CinematicFireAnimation.css';

const CinematicFireAnimation = ({ 
  onComplete = () => {}, 
  quality = 'auto',
  skipAnimation = false,
  duration = 5000 // 5 seconds total
}) => {
  const canvasRef = useRef(null);
  const emitterRef = useRef(null);
  const rendererRef = useRef(null);
  const animationFrameRef = useRef(null);
  const startTimeRef = useRef(null);
  const phaseRef = useRef('initial');
  const qualityRef = useRef(quality);
  
  const [isReady, setIsReady] = useState(false);
  const [currentPhase, setCurrentPhase] = useState('initial');
  
  // Quality settings
  const qualitySettings = {
    low: {
      maxParticles: 200,
      spawnRate: 40,
      enableGlow: false,
      enableDistortion: false
    },
    medium: {
      maxParticles: 500,
      spawnRate: 80,
      enableGlow: true,
      enableDistortion: false
    },
    high: {
      maxParticles: 1000,
      spawnRate: 120,
      enableGlow: true,
      enableDistortion: true
    }
  };
  
  // Determine quality level
  const getQualityLevel = useCallback(() => {
    if(quality !== 'auto') return quality;
    
    // Auto-detect based on device
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const isLowEnd = navigator.hardwareConcurrency <= 2;
    
    if(isMobile) return 'low';
    if(isLowEnd) return 'medium';
    return 'high';
  }, [quality]);
  
  // Animation phases with timing
  const phases = {
    initial: { start: 0, end: 100, action: 'prepare' },
    ignition: { start: 100, end: 1000, action: 'burst' },
    formation: { start: 1000, end: 2000, action: 'coalesce' },
    stabilization: { start: 2000, end: 4000, action: 'steady' },
    transition: { start: 4000, end: 5000, action: 'morph' }
  };
  
  // Get current phase based on elapsed time
  const getCurrentPhase = useCallback((elapsed) => {
    for(const [name, phase] of Object.entries(phases)) {
      if(elapsed >= phase.start && elapsed < phase.end) {
        return name;
      }
    }
    return 'complete';
  }, []);
  
  // Execute phase-specific actions
  const executePhaseAction = useCallback((phase, emitter, elapsed) => {
    switch(phase) {
      case 'initial':
        // Prepare for animation
        emitter.particles = [];
        emitter.spawnRate = 0;
        break;
        
      case 'ignition':
        if(phaseRef.current !== 'ignition') {
          // Single burst at beginning of phase
          emitter.burst(300);
          phaseRef.current = 'ignition';
        }
        // Gradually increase spawn rate
        const ignitionProgress = (elapsed - phases.ignition.start) / (phases.ignition.end - phases.ignition.start);
        emitter.spawnRate = ignitionProgress * qualitySettings[qualityRef.current].spawnRate * 0.5;
        break;
        
      case 'formation':
        if(phaseRef.current !== 'formation') {
          phaseRef.current = 'formation';
        }
        // Ramp up to full spawn rate
        const formationProgress = (elapsed - phases.formation.start) / (phases.formation.end - phases.formation.start);
        emitter.spawnRate = qualitySettings[qualityRef.current].spawnRate * (0.5 + formationProgress * 0.5);
        
        // Add vortex force to coalesce particles
        emitter.particles.forEach(particle => {
          const centerX = emitter.position.x;
          const centerY = emitter.position.y;
          const dx = centerX - particle.position.x;
          const dy = centerY - particle.position.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if(distance > 50) {
            const force = 50 / distance;
            particle.velocity.x += dx * force * 0.01;
            particle.velocity.y += dy * force * 0.01;
          }
        });
        break;
        
      case 'stabilization':
        if(phaseRef.current !== 'stabilization') {
          phaseRef.current = 'stabilization';
        }
        // Steady burning with oscillation
        const stabTime = (elapsed - phases.stabilization.start) * 0.001;
        emitter.spawnRate = qualitySettings[qualityRef.current].spawnRate * (1 + Math.sin(stabTime * 3) * 0.1);
        emitter.spawnRadius = 30 * (1 + Math.sin(stabTime * 2) * 0.2);
        break;
        
      case 'transition':
        if(phaseRef.current !== 'transition') {
          phaseRef.current = 'transition';
        }
        // Gradually reduce spawn rate and morph to logo
        const transitionProgress = (elapsed - phases.transition.start) / (phases.transition.end - phases.transition.start);
        emitter.spawnRate = qualitySettings[qualityRef.current].spawnRate * (1 - transitionProgress);
        
        // Move particles toward logo positions
        emitter.particles.forEach((particle, index) => {
          // Simple morph to "BURNWISE" text shape
          const targetX = (index % 8) * 50 - 150;
          const targetY = -50;
          const morphForce = transitionProgress * 2;
          
          particle.velocity.x += (targetX - particle.position.x) * morphForce * 0.01;
          particle.velocity.y += (targetY - particle.position.y) * morphForce * 0.01;
        });
        break;
        
      case 'complete':
        if(phaseRef.current !== 'complete') {
          phaseRef.current = 'complete';
          onComplete();
        }
        break;
        
      default:
        break;
    }
  }, [qualitySettings, onComplete]);
  
  // Animation loop
  const animate = useCallback(() => {
    if(!emitterRef.current || !rendererRef.current || !canvasRef.current) return;
    
    const now = performance.now();
    if(!startTimeRef.current) {
      startTimeRef.current = now;
    }
    
    const elapsed = now - startTimeRef.current;
    const deltaTime = Math.min(1/30, (now - (animationFrameRef.lastTime || now)) / 1000); // Cap at 30fps minimum
    animationFrameRef.lastTime = now;
    
    // Skip animation if requested
    if(skipAnimation || elapsed > duration) {
      onComplete();
      return;
    }
    
    // Get current phase
    const phase = getCurrentPhase(elapsed);
    if(phase !== currentPhase) {
      setCurrentPhase(phase);
    }
    
    // Execute phase action
    executePhaseAction(phase, emitterRef.current, elapsed);
    
    // Update particle system
    emitterRef.current.update(deltaTime, elapsed * 0.001);
    
    // Render particles
    const fps = rendererRef.current.render(emitterRef.current, deltaTime, elapsed * 0.001, phase);
    
    // Auto-adjust quality based on FPS
    if(quality === 'auto' && fps < 30 && qualityRef.current !== 'low') {
      qualityRef.current = 'low';
      emitterRef.current.maxParticles = qualitySettings.low.maxParticles;
    }
    
    // Continue animation
    if(phase !== 'complete') {
      animationFrameRef.current = requestAnimationFrame(animate);
    }
  }, [skipAnimation, duration, onComplete, getCurrentPhase, currentPhase, executePhaseAction, quality, qualitySettings]);
  
  // Initialize animation
  useEffect(() => {
    if(!canvasRef.current) return;
    
    // Determine quality
    qualityRef.current = getQualityLevel();
    const settings = qualitySettings[qualityRef.current];
    
    // Create emitter at center of canvas
    const rect = canvasRef.current.getBoundingClientRect();
    emitterRef.current = new FireEmitter(rect.width / 2, rect.height * 0.7);
    emitterRef.current.maxParticles = settings.maxParticles;
    emitterRef.current.spawnRate = 0; // Start with no spawning
    
    // Create renderer
    rendererRef.current = new FireRenderer(canvasRef.current);
    
    // Start animation
    setIsReady(true);
    animationFrameRef.current = requestAnimationFrame(animate);
    
    // Handle resize
    const handleResize = () => {
      if(rendererRef.current && canvasRef.current) {
        rendererRef.current.resize();
        const rect = canvasRef.current.getBoundingClientRect();
        emitterRef.current.position.x = rect.width / 2;
        emitterRef.current.position.y = rect.height * 0.7;
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
  }, [animate, getQualityLevel, qualitySettings]);
  
  return (
    <div className="cinematic-fire-container">
      <canvas 
        ref={canvasRef}
        className="fire-canvas"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%'
        }}
      />
      
      {/* Phase indicator for debugging */}
      {window.DEBUG_FIRE && (
        <div className="phase-indicator">
          Phase: {currentPhase}
        </div>
      )}
      
      {/* Optional skip button */}
      {!skipAnimation && currentPhase !== 'complete' && (
        <button 
          className="skip-animation"
          onClick={onComplete}
          style={{
            position: 'absolute',
            bottom: '20px',
            right: '20px',
            padding: '10px 20px',
            background: 'rgba(0,0,0,0.5)',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            zIndex: 1000
          }}
        >
          Skip Animation
        </button>
      )}
    </div>
  );
};

export default CinematicFireAnimation;