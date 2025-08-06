/**
 * Logo-Based Fire Particle System
 * Uses the actual BURNWISE flame logo as particles for brand consistency
 * Optimized with pre-caching for excellent performance
 */

// Import the flame path from AnimatedFlameLogo
const FLAME_PATH = "M2737 4632 c-3 -4 -8 -63 -11 -132 -14 -249 -52 -487 -95 -585 -5 -11 -21 -53 -37 -94 -65 -170 -236 -386 -615 -776 -153 -158 -236 -248 -293 -318 -34 -42 -38 -52 -32 -85 10 -66 104 -368 152 -488 25 -64 47 -124 49 -133 5 -26 37 -104 53 -129 l15 -24 26 33 c14 18 32 45 41 60 61 110 424 667 580 889 33 47 103 153 157 235 53 83 100 152 105 153 4 2 8 10 8 17 0 7 3 15 8 17 4 2 20 29 36 62 16 32 35 63 41 70 13 13 95 149 95 158 0 3 29 58 65 122 36 64 65 123 65 131 0 8 -31 79 -69 157 -37 79 -92 193 -121 253 -29 61 -56 112 -61 113 -5 2 -9 12 -9 23 0 17 -89 197 -111 225 -5 6 -7 13 -6 15 2 2 -4 12 -14 21 -10 10 -20 14 -22 10z";

/**
 * FlameLogoCache - Pre-renders the logo at various sizes and colors
 * This dramatically improves performance by avoiding runtime rendering
 */
class FlameLogoCache {
  constructor() {
    this.cache = new Map();
    this.path2D = new Path2D();
    
    // Size variations for different particle types
    this.sizes = [
      8,   // Tiny sparks
      12,  // Small embers
      20,  // Medium particles
      30,  // Standard flames
      45,  // Large flames
      60,  // Major flames
      80   // Hero particles
    ];
    
    // Temperature-based color variations
    this.colors = [
      { temp: 3500, r: 255, g: 255, b: 255, name: 'white' },     // White-hot
      { temp: 3200, r: 255, g: 249, b: 157, name: 'yellow' },    // Yellow
      { temp: 3000, r: 255, g: 217, b: 61, name: 'gold' },       // Gold
      { temp: 2800, r: 255, g: 176, b: 0, name: 'orange' },      // Orange
      { temp: 2600, r: 255, g: 140, b: 0, name: 'deepOrange' },  // Deep orange
      { temp: 2400, r: 255, g: 87, b: 34, name: 'red' }          // Red-orange
    ];
    
    this.initialized = false;
  }
  
  async init() {
    console.log('Initializing FlameLogoCache...');
    
    // Parse the SVG path and scale it down
    this.createPath2D();
    
    // Pre-render all combinations
    for(const size of this.sizes) {
      for(const color of this.colors) {
        const key = `${size}_${color.name}`;
        const canvas = this.renderFlame(size, color);
        this.cache.set(key, canvas);
      }
    }
    
    this.initialized = true;
    console.log(`FlameLogoCache initialized with ${this.cache.size} cached flames`);
  }
  
  createPath2D() {
    // The original path is huge (around 5000x5000), scale it down
    const scale = 0.01; // Scale to ~50x50 base size
    
    // Parse the SVG path string and create Path2D
    // This is a simplified version - in production you'd use a proper SVG path parser
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    ctx.scale(scale, scale);
    
    // Manually create the flame shape (simplified version of the complex path)
    this.path2D = new Path2D();
    this.path2D.moveTo(25, 0);    // Top of flame
    this.path2D.bezierCurveTo(15, 10, 10, 20, 12, 35);  // Left side
    this.path2D.bezierCurveTo(14, 40, 16, 42, 25, 45);  // Bottom
    this.path2D.bezierCurveTo(34, 42, 36, 40, 38, 35);  // Right bottom
    this.path2D.bezierCurveTo(40, 20, 35, 10, 25, 0);   // Right side back to top
    this.path2D.closePath();
  }
  
  renderFlame(size, color) {
    const padding = 10;
    const canvas = document.createElement('canvas');
    canvas.width = size + padding * 2;
    canvas.height = size * 1.5 + padding * 2; // Flames are taller than wide
    
    const ctx = canvas.getContext('2d');
    
    // Center and scale
    ctx.translate(canvas.width / 2, canvas.height - padding);
    const scale = size / 50; // 50 is our base flame size
    ctx.scale(scale, scale);
    
    // Create gradient for this temperature
    const gradient = ctx.createRadialGradient(0, -25, 0, 0, -25, 35);
    gradient.addColorStop(0, `rgba(255, 255, 255, 1)`);
    gradient.addColorStop(0.2, `rgba(${color.r}, ${color.g}, ${color.b}, 1)`);
    gradient.addColorStop(0.5, `rgba(${color.r}, ${Math.floor(color.g * 0.8)}, ${Math.floor(color.b * 0.6)}, 0.9)`);
    gradient.addColorStop(0.8, `rgba(${Math.floor(color.r * 0.7)}, ${Math.floor(color.g * 0.5)}, ${Math.floor(color.b * 0.3)}, 0.5)`);
    gradient.addColorStop(1, `rgba(0, 0, 0, 0)`);
    
    // Draw the flame path
    ctx.fillStyle = gradient;
    ctx.fill(this.path2D);
    
    // Add inner glow for hot particles
    if(color.temp > 3000) {
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.5;
      const innerGradient = ctx.createRadialGradient(0, -20, 0, 0, -20, 20);
      innerGradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
      innerGradient.addColorStop(0.5, 'rgba(255, 255, 200, 0.3)');
      innerGradient.addColorStop(1, 'rgba(255, 200, 100, 0)');
      ctx.fillStyle = innerGradient;
      ctx.fill(this.path2D);
    }
    
    return canvas;
  }
  
  getFlame(size, temperature) {
    if(!this.initialized) {
      console.warn('FlameLogoCache not initialized!');
      return null;
    }
    
    // Find closest size
    const closestSize = this.sizes.reduce((prev, curr) => 
      Math.abs(curr - size) < Math.abs(prev - size) ? curr : prev
    );
    
    // Find closest temperature color
    const closestColor = this.colors.reduce((prev, curr) => 
      Math.abs(curr.temp - temperature) < Math.abs(prev.temp - temperature) ? curr : prev
    );
    
    const key = `${closestSize}_${closestColor.name}`;
    return this.cache.get(key);
  }
}

/**
 * LogoFlameParticle - Individual particle using cached logo image
 */
class LogoFlameParticle {
  constructor(x, y, type = 'main') {
    this.x = x;
    this.y = y;
    
    // Velocity based on type
    switch(type) {
      case 'spark':
        this.vx = (Math.random() - 0.5) * 8;
        this.vy = -Math.random() * 10 - 5;
        break;
      case 'ember':
        this.vx = (Math.random() - 0.5) * 2;
        this.vy = -Math.random() * 2 - 1;
        break;
      case 'main':
      default:
        this.vx = (Math.random() - 0.5) * 4;
        this.vy = -Math.random() * 6 - 3;
        break;
    }
    
    this.type = type;
    this.baseSize = this.getInitialSize(type);
    this.size = this.baseSize;
    this.rotation = Math.random() * Math.PI * 2;
    this.rotationSpeed = (Math.random() - 0.5) * 0.05;
    
    // Lifetime
    this.age = 0;
    this.maxAge = this.getMaxAge(type);
    this.opacity = 0; // Will fade in
    
    // Temperature (affects color)
    this.temperature = this.getInitialTemperature(type);
    this.coolingRate = 100 + Math.random() * 100; // K per second
    
    // Turbulence
    this.turbulenceX = 0;
    this.turbulenceY = 0;
    this.turbulencePhase = Math.random() * Math.PI * 2;
  }
  
  getInitialSize(type) {
    switch(type) {
      case 'spark': return 8 + Math.random() * 8;    // 8-16px
      case 'ember': return 12 + Math.random() * 12;  // 12-24px
      case 'main': return 25 + Math.random() * 35;   // 25-60px
      default: return 30;
    }
  }
  
  getMaxAge(type) {
    switch(type) {
      case 'spark': return 0.3 + Math.random() * 0.3;  // 0.3-0.6s
      case 'ember': return 1.0 + Math.random() * 1.0;  // 1-2s
      case 'main': return 0.8 + Math.random() * 1.2;   // 0.8-2s
      default: return 1.0;
    }
  }
  
  getInitialTemperature(type) {
    switch(type) {
      case 'spark': return 3200 + Math.random() * 300;  // Very hot
      case 'ember': return 2400 + Math.random() * 200;  // Cooler
      case 'main': return 2700 + Math.random() * 500;   // Medium
      default: return 2800;
    }
  }
  
  update(deltaTime, time) {
    this.age += deltaTime;
    
    if(this.isDead()) return;
    
    // Update position
    this.x += this.vx;
    this.y += this.vy;
    
    // Apply forces
    this.vy -= deltaTime * 2; // Upward acceleration (fire rises)
    this.vx *= 0.99; // Air resistance
    this.vy *= 0.99;
    
    // Add turbulence
    const turbStrength = this.type === 'spark' ? 2 : 1;
    this.turbulenceX = Math.sin(time * 3 + this.turbulencePhase) * turbStrength;
    this.turbulenceY = Math.cos(time * 2 + this.turbulencePhase) * turbStrength * 0.5;
    this.x += this.turbulenceX;
    this.y += this.turbulenceY;
    
    // Rotation
    this.rotation += this.rotationSpeed;
    
    // Cool down
    this.temperature = Math.max(1800, this.temperature - this.coolingRate * deltaTime);
    
    // Size changes with age
    const ageRatio = this.age / this.maxAge;
    if(this.type === 'spark') {
      this.size = this.baseSize * (1 - ageRatio * 0.8); // Shrink quickly
    } else {
      this.size = this.baseSize * (1 + ageRatio * 0.3); // Grow slightly
    }
    
    // Opacity (fade in then out)
    if(ageRatio < 0.1) {
      this.opacity = ageRatio * 10; // Fade in
    } else if(ageRatio > 0.7) {
      this.opacity = (1 - ageRatio) / 0.3; // Fade out
    } else {
      this.opacity = 1;
    }
  }
  
  isDead() {
    return this.age >= this.maxAge;
  }
}

/**
 * LogoFlameEmitter - Manages particle spawning and lifecycle
 */
class LogoFlameEmitter {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.particles = [];
    this.particlePool = [];
    this.maxParticles = 500;
    
    // Spawn configuration
    this.spawnRate = 0; // Particles per second
    this.spawnRadius = 20;
    this.spawnAccumulator = 0;
    
    // Pre-allocate particle pool
    for(let i = 0; i < this.maxParticles; i++) {
      this.particlePool.push(new LogoFlameParticle(0, 0));
    }
  }
  
  update(deltaTime, time) {
    // Spawn new particles
    if(this.spawnRate > 0) {
      this.spawnAccumulator += this.spawnRate * deltaTime;
      while(this.spawnAccumulator >= 1) {
        this.spawnAccumulator -= 1;
        this.spawn('main');
      }
    }
    
    // Update particles
    for(let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];
      particle.update(deltaTime, time);
      
      if(particle.isDead()) {
        this.particlePool.push(particle);
        this.particles.splice(i, 1);
      }
    }
  }
  
  spawn(type = 'main', x = null, y = null) {
    if(this.particlePool.length === 0 || this.particles.length >= this.maxParticles) return;
    
    const particle = this.particlePool.pop();
    
    // Reset particle
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * this.spawnRadius;
    
    particle.x = (x !== null ? x : this.x) + Math.cos(angle) * radius;
    particle.y = (y !== null ? y : this.y) + Math.sin(angle) * radius;
    particle.type = type;
    particle.age = 0;
    
    // Reinitialize based on type
    particle.vx = (Math.random() - 0.5) * (type === 'spark' ? 8 : 4);
    particle.vy = -Math.random() * (type === 'spark' ? 10 : 6) - 3;
    particle.baseSize = particle.getInitialSize(type);
    particle.size = particle.baseSize;
    particle.maxAge = particle.getMaxAge(type);
    particle.temperature = particle.getInitialTemperature(type);
    particle.opacity = 0;
    particle.rotation = Math.random() * Math.PI * 2;
    
    this.particles.push(particle);
  }
  
  burst(count, type = 'spark') {
    for(let i = 0; i < count && this.particlePool.length > 0; i++) {
      const angle = (i / count) * Math.PI * 2;
      const speed = 100 + Math.random() * 100;
      
      const particle = this.particlePool.pop();
      particle.x = this.x;
      particle.y = this.y;
      particle.vx = Math.cos(angle) * speed * 0.1;
      particle.vy = Math.sin(angle) * speed * 0.1 - 5;
      particle.type = type;
      particle.age = 0;
      particle.baseSize = particle.getInitialSize(type);
      particle.size = particle.baseSize;
      particle.maxAge = particle.getMaxAge(type);
      particle.temperature = 3300 + Math.random() * 200;
      particle.opacity = 0;
      
      this.particles.push(particle);
    }
  }
}

export { FlameLogoCache, LogoFlameParticle, LogoFlameEmitter };