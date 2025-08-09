/**
 * Fire Animation Controller - Manages cinematic timeline and phases
 * Controls the dramatic progression of the fire animation
 */

class FireAnimationController {
  constructor(duration = 5000) {
    this.duration = duration;
    this.startTime = null;
    this.currentPhase = 'initial';
    this.phaseCallbacks = new Map();
    
    // Define animation phases with precise timing
    this.phases = {
      initial: { 
        start: 0, 
        end: 100,
        description: 'Darkness before ignition',
        particleConfig: {
          spawnRate: 0,
          temperature: { min: 0, max: 0 }
        }
      },
      ignition: { 
        start: 100, 
        end: 1000,
        description: 'Explosive burst - the spark of creation',
        particleConfig: {
          burstCount: 300,
          initialTemp: { min: 3200, max: 3500 },
          spawnRate: { start: 0, end: 60 }
        }
      },
      formation: { 
        start: 1000, 
        end: 2000,
        description: 'Particles coalesce into flame',
        particleConfig: {
          spawnRate: { start: 60, end: 120 },
          temperature: { min: 2900, max: 3200 },
          vortexStrength: 50
        }
      },
      stabilization: { 
        start: 2000, 
        end: 4000,
        description: 'Living flame - organic movement',
        particleConfig: {
          spawnRate: 120,
          temperature: { min: 2800, max: 3100 },
          oscillation: {
            frequency: 3,
            amplitude: 0.1
          }
        }
      },
      transition: { 
        start: 4000, 
        end: 5000,
        description: 'Morph into BURNWISE logo',
        particleConfig: {
          spawnRate: { start: 120, end: 0 },
          morphStrength: { start: 0, end: 2 },
          temperature: { min: 2500, max: 2800 }
        }
      },
      complete: {
        start: 5000,
        end: Infinity,
        description: 'Animation complete',
        particleConfig: {
          spawnRate: 0
        }
      }
    };
    
    // Logo morph target positions for "BURNWISE" text
    this.logoTargets = this.generateLogoTargets();
  }
  
  start() {
    this.startTime = performance.now();
    this.currentPhase = 'initial';
  }
  
  update(currentTime) {
    if(!this.startTime) {
      this.start();
    }
    
    const elapsed = currentTime - this.startTime;
    const newPhase = this.getPhaseAtTime(elapsed);
    
    // Trigger phase change callbacks
    if(newPhase !== this.currentPhase) {
      this.onPhaseChange(this.currentPhase, newPhase);
      this.currentPhase = newPhase;
    }
    
    return {
      phase: this.currentPhase,
      elapsed,
      progress: Math.min(elapsed / this.duration, 1),
      phaseProgress: this.getPhaseProgress(elapsed)
    };
  }
  
  getPhaseAtTime(elapsed) {
    for(const [name, phase] of Object.entries(this.phases)) {
      if(elapsed >= phase.start && elapsed < phase.end) {
        return name;
      }
    }
    return 'complete';
  }
  
  getPhaseProgress(elapsed) {
    const phase = this.phases[this.currentPhase];
    if(!phase) return 0;
    
    const duration = phase.end - phase.start;
    const phaseElapsed = elapsed - phase.start;
    return Math.max(0, Math.min(1, phaseElapsed / duration));
  }
  
  onPhaseChange(oldPhase, newPhase) {
    console.log(`Phase transition: ${oldPhase} → ${newPhase}`);
    
    // Execute registered callbacks
    if(this.phaseCallbacks.has(newPhase)) {
      this.phaseCallbacks.get(newPhase)();
    }
  }
  
  registerPhaseCallback(phase, callback) {
    this.phaseCallbacks.set(phase, callback);
  }
  
  applyPhaseToEmitter(emitter, animationState) {
    const { phase, phaseProgress } = animationState;
    const config = this.phases[phase].particleConfig;
    
    switch(phase) {
      case 'initial':
        emitter.spawnRate = 0;
        break;
        
      case 'ignition':
        // Burst at start
        if(phaseProgress === 0 && config.burstCount) {
          emitter.burst(config.burstCount, 'spark');
        }
        // Gradually increase spawn rate
        emitter.spawnRate = this.lerp(
          config.spawnRate.start,
          config.spawnRate.end,
          phaseProgress
        );
        break;
        
      case 'formation':
        // Increase spawn rate
        emitter.spawnRate = this.lerp(
          config.spawnRate.start,
          config.spawnRate.end,
          phaseProgress
        );
        
        // Apply vortex force to coalesce
        this.applyVortexForce(emitter, config.vortexStrength * (1 - phaseProgress));
        break;
        
      case 'stabilization':
        // Oscillating spawn rate for organic feel
        const time = animationState.elapsed * 0.001;
        const oscillation = Math.sin(time * config.oscillation.frequency) * config.oscillation.amplitude;
        emitter.spawnRate = config.spawnRate * (1 + oscillation);
        
        // Vary spawn radius for breathing effect
        emitter.spawnRadius = 30 * (1 + Math.sin(time * 2) * 0.2);
        break;
        
      case 'transition':
        // Reduce spawn rate
        emitter.spawnRate = this.lerp(
          config.spawnRate.start,
          config.spawnRate.end,
          phaseProgress
        );
        
        // Morph particles to logo
        const morphStrength = this.lerp(
          config.morphStrength.start,
          config.morphStrength.end,
          this.easeInOutCubic(phaseProgress)
        );
        this.morphToLogo(emitter, morphStrength);
        break;
        
      case 'complete':
        emitter.spawnRate = 0;
        break;
    }
  }
  
  applyVortexForce(emitter, strength) {
    const centerX = emitter.x;
    const centerY = emitter.y;
    
    emitter.particles.forEach(particle => {
      const dx = centerX - particle.x;
      const dy = centerY - particle.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if(distance > 30) {
        const force = strength / (distance + 1);
        particle.vx += dx * force * 0.01;
        particle.vy += dy * force * 0.01;
      }
    });
  }
  
  morphToLogo(emitter, strength) {
    emitter.particles.forEach((particle, index) => {
      const target = this.logoTargets[index % this.logoTargets.length];
      
      const dx = target.x - particle.x;
      const dy = target.y - particle.y;
      
      particle.vx += dx * strength * 0.01;
      particle.vy += dy * strength * 0.01;
      
      // Cool down particles as they morph
      particle.temperature *= 0.99;
    });
  }
  
  generateLogoTargets() {
    // Generate target positions for "BURNWISE" text shape
    const targets = [];
    const letters = [
      // B
      [{x: -180, y: -40}, {x: -180, y: 0}, {x: -180, y: 40}, {x: -160, y: -40}, {x: -160, y: 0}, {x: -160, y: 40}, {x: -140, y: -20}, {x: -140, y: 20}],
      // U
      [{x: -120, y: -40}, {x: -120, y: 0}, {x: -120, y: 20}, {x: -100, y: 40}, {x: -80, y: 20}, {x: -80, y: 0}, {x: -80, y: -40}],
      // R
      [{x: -60, y: -40}, {x: -60, y: 0}, {x: -60, y: 40}, {x: -40, y: -40}, {x: -40, y: -20}, {x: -20, y: 0}, {x: -20, y: 40}],
      // N
      [{x: 0, y: -40}, {x: 0, y: 0}, {x: 0, y: 40}, {x: 20, y: -20}, {x: 20, y: 0}, {x: 40, y: -40}, {x: 40, y: 0}, {x: 40, y: 40}],
      // W
      [{x: 60, y: -40}, {x: 60, y: 0}, {x: 70, y: 40}, {x: 80, y: 20}, {x: 90, y: 40}, {x: 100, y: 0}, {x: 100, y: -40}],
      // I
      [{x: 120, y: -40}, {x: 120, y: -20}, {x: 120, y: 0}, {x: 120, y: 20}, {x: 120, y: 40}],
      // S
      [{x: 140, y: -40}, {x: 160, y: -40}, {x: 140, y: -20}, {x: 160, y: 0}, {x: 140, y: 20}, {x: 160, y: 40}, {x: 140, y: 40}],
      // E
      [{x: 180, y: -40}, {x: 180, y: 0}, {x: 180, y: 40}, {x: 200, y: -40}, {x: 200, y: 0}, {x: 200, y: 40}]
    ];
    
    letters.forEach(letter => {
      letter.forEach(point => {
        targets.push({
          x: point.x + (Math.random() - 0.5) * 10,
          y: point.y + (Math.random() - 0.5) * 10
        });
      });
    });
    
    return targets;
  }
  
  // Utility functions
  lerp(start, end, t) {
    return start + (end - start) * t;
  }
  
  easeInOutCubic(t) {
    return t < 0.5 
      ? 4 * t * t * t 
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
  
  getDebugInfo() {
    const elapsed = this.startTime ? performance.now() - this.startTime : 0;
    const phase = this.phases[this.currentPhase];
    
    return {
      currentPhase: this.currentPhase,
      elapsed: Math.round(elapsed),
      totalProgress: Math.round((elapsed / this.duration) * 100) + '%',
      phaseProgress: Math.round(this.getPhaseProgress(elapsed) * 100) + '%',
      phaseDescription: phase ? phase.description : 'Not started'
    };
  }
}

export default FireAnimationController;