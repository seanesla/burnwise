/**
 * Logo Particle System - Animates the actual BURNWISE 3-flame logo
 * Particles form and animate the three flame shapes
 */

class LogoParticleSystem {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', {
      alpha: false,
      desynchronized: true
    });
    
    this.width = canvas.width;
    this.height = canvas.height;
    this.centerX = this.width / 2;
    this.centerY = this.height / 2;
    
    // The 3 flame paths from BurnwiseLogoPotraceExact
    this.flamePaths = [
      // Left flame (scaled and centered)
      {
        id: 'left',
        color: '#FF6B35',
        baseX: -80,
        baseY: 0,
        particles: []
      },
      // Center flame (larger)
      {
        id: 'center', 
        color: '#FF5722',
        baseX: 0,
        baseY: -20,
        particles: []
      },
      // Right flame
      {
        id: 'right',
        color: '#FFB000',
        baseX: 80,
        baseY: 0,
        particles: []
      }
    ];
    
    this.particles = [];
    this.phase = 'initial';
    this.time = 0;
  }
  
  init() {
    // Create particles for each flame shape
    this.flamePaths.forEach(flame => {
      this.createFlameParticles(flame);
    });
  }
  
  createFlameParticles(flame) {
    const particleCount = flame.id === 'center' ? 150 : 100;
    
    for(let i = 0; i < particleCount; i++) {
      // Create particles that will form the flame shape
      const angle = (i / particleCount) * Math.PI * 2;
      const radiusVariation = Math.random() * 30 + 20;
      
      const particle = {
        // Current position (starts scattered)
        x: this.centerX + flame.baseX + Math.cos(angle) * (100 + Math.random() * 200),
        y: this.centerY + flame.baseY + Math.sin(angle) * (100 + Math.random() * 200),
        
        // Target position (forms the flame shape)
        targetX: this.centerX + flame.baseX + Math.cos(angle) * radiusVariation,
        targetY: this.centerY + flame.baseY - Math.abs(Math.sin(angle)) * radiusVariation * 1.5,
        
        // Velocity
        vx: 0,
        vy: 0,
        
        // Properties
        size: 3 + Math.random() * 4,
        baseSize: 3 + Math.random() * 4,
        color: flame.color,
        opacity: 0,
        targetOpacity: 1,
        
        // Animation properties
        oscillationPhase: Math.random() * Math.PI * 2,
        oscillationSpeed: 2 + Math.random() * 2,
        
        // Temperature for color variation
        temperature: 2800 + Math.random() * 700,
        
        // Flame reference
        flameId: flame.id
      };
      
      flame.particles.push(particle);
      this.particles.push(particle);
    }
  }
  
  update(deltaTime, phase) {
    this.time += deltaTime;
    this.phase = phase;
    
    this.particles.forEach(particle => {
      switch(phase) {
        case 'assembly':
          // Particles move toward their target positions
          this.assembleParticle(particle, deltaTime);
          break;
          
        case 'ignition':
          // Burst effect
          this.igniteParticle(particle, deltaTime);
          break;
          
        case 'living':
          // Organic flame movement
          this.animateParticle(particle, deltaTime);
          break;
          
        case 'transition':
          // Final positioning
          this.finalizeParticle(particle, deltaTime);
          break;
      }
      
      // Update physics
      particle.x += particle.vx * deltaTime;
      particle.y += particle.vy * deltaTime;
      
      // Apply damping
      particle.vx *= 0.98;
      particle.vy *= 0.98;
    });
  }
  
  assembleParticle(particle, deltaTime) {
    // Move toward target position
    const dx = particle.targetX - particle.x;
    const dy = particle.targetY - particle.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if(distance > 1) {
      particle.vx += (dx / distance) * 50 * deltaTime;
      particle.vy += (dy / distance) * 50 * deltaTime;
    }
    
    // Fade in
    particle.opacity = Math.min(1, particle.opacity + deltaTime * 2);
  }
  
  igniteParticle(particle, deltaTime) {
    // Burst outward briefly
    const angle = Math.atan2(particle.y - this.centerY, particle.x - this.centerX);
    particle.vx += Math.cos(angle) * 100 * deltaTime;
    particle.vy += Math.sin(angle) * 100 * deltaTime;
    
    // Increase size and brightness
    particle.size = particle.baseSize * (1 + Math.sin(this.time * 10) * 0.3);
    particle.temperature = Math.min(3500, particle.temperature + 500 * deltaTime);
  }
  
  animateParticle(particle, deltaTime) {
    // Organic flame movement
    const oscillation = Math.sin(this.time * particle.oscillationSpeed + particle.oscillationPhase);
    
    // Vertical float
    particle.vy -= 20 * deltaTime; // Rise
    
    // Horizontal sway
    particle.vx += oscillation * 10 * deltaTime;
    
    // Size pulsing
    particle.size = particle.baseSize * (1 + oscillation * 0.2);
    
    // Attract back to flame shape
    const dx = particle.targetX - particle.x;
    const dy = particle.targetY - particle.y;
    particle.vx += dx * 0.5 * deltaTime;
    particle.vy += dy * 0.5 * deltaTime;
    
    // Temperature variation
    particle.temperature = 2800 + oscillation * 200;
  }
  
  finalizeParticle(particle, deltaTime) {
    // Strong attraction to final position
    const dx = particle.targetX - particle.x;
    const dy = particle.targetY - particle.y;
    
    particle.vx += dx * 2 * deltaTime;
    particle.vy += dy * 2 * deltaTime;
    
    // Stabilize size
    particle.size = particle.baseSize;
    
    // Cool down
    particle.temperature = Math.max(2400, particle.temperature - 200 * deltaTime);
  }
  
  render() {
    // Clear canvas with gradient background
    const gradient = this.ctx.createRadialGradient(
      this.centerX, this.centerY * 1.2, 0,
      this.centerX, this.centerY * 1.2, this.height
    );
    gradient.addColorStop(0, 'rgba(40, 15, 5, 1)');
    gradient.addColorStop(0.5, 'rgba(20, 5, 5, 1)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 1)');
    
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.width, this.height);
    
    // Set composite mode for fire effect
    this.ctx.globalCompositeOperation = 'lighter';
    
    // Render particles grouped by flame
    this.flamePaths.forEach(flame => {
      this.renderFlameParticles(flame.particles);
    });
    
    this.ctx.globalCompositeOperation = 'source-over';
  }
  
  renderFlameParticles(particles) {
    particles.forEach(particle => {
      if(particle.opacity < 0.01) return;
      
      this.ctx.save();
      
      // Set particle color based on temperature
      const color = this.temperatureToColor(particle.temperature);
      
      // Draw particle as gradient circle
      const gradient = this.ctx.createRadialGradient(
        particle.x, particle.y, 0,
        particle.x, particle.y, particle.size
      );
      gradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, ${particle.opacity})`);
      gradient.addColorStop(0.5, `rgba(${color.r}, ${color.g * 0.8}, ${color.b * 0.6}, ${particle.opacity * 0.6})`);
      gradient.addColorStop(1, `rgba(${color.r * 0.5}, ${color.g * 0.3}, ${color.b * 0.2}, 0)`);
      
      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.arc(particle.x, particle.y, particle.size * 2, 0, Math.PI * 2);
      this.ctx.fill();
      
      // Add glow
      if(particle.temperature > 3000) {
        this.ctx.globalAlpha = particle.opacity * 0.3;
        this.ctx.beginPath();
        this.ctx.arc(particle.x, particle.y, particle.size * 4, 0, Math.PI * 2);
        this.ctx.fill();
      }
      
      this.ctx.restore();
    });
  }
  
  temperatureToColor(temp) {
    // Convert temperature to RGB color
    if(temp >= 3300) return { r: 255, g: 255, b: 255 };
    if(temp >= 3000) return { r: 255, g: 249, b: 157 };
    if(temp >= 2800) return { r: 255, g: 217, b: 61 };
    if(temp >= 2600) return { r: 255, g: 176, b: 0 };
    if(temp >= 2400) return { r: 255, g: 140, b: 0 };
    return { r: 255, g: 87, b: 34 };
  }
  
  resize(width, height) {
    this.width = width;
    this.height = height;
    this.centerX = width / 2;
    this.centerY = height / 2;
    
    // Recalculate particle positions
    this.particles.forEach(particle => {
      const flame = this.flamePaths.find(f => f.id === particle.flameId);
      if(flame) {
        particle.targetX = this.centerX + flame.baseX;
        particle.targetY = this.centerY + flame.baseY;
      }
    });
  }
}

export default LogoParticleSystem;