/**
 * Professional Fire Particle System with Real Physics
 * Uses proper force calculations, temperature-based colors, and turbulence
 */

// Vector2 class for physics calculations
class Vector2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }
  
  add(v) {
    return new Vector2(this.x + v.x, this.y + v.y);
  }
  
  subtract(v) {
    return new Vector2(this.x - v.x, this.y - v.y);
  }
  
  multiply(scalar) {
    return new Vector2(this.x * scalar, this.y * scalar);
  }
  
  divide(scalar) {
    return new Vector2(this.x / scalar, this.y / scalar);
  }
  
  magnitude() {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }
  
  normalize() {
    const mag = this.magnitude();
    return mag > 0 ? this.divide(mag) : new Vector2();
  }
  
  dot(v) {
    return this.x * v.x + this.y * v.y;
  }
}

// Simplex Noise for organic turbulence
class SimplexNoise {
  constructor(seed = Math.random()) {
    this.grad3 = [
      [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
      [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
      [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]
    ];
    this.p = [];
    for(let i = 0; i < 256; i++) {
      this.p[i] = Math.floor(seed * 256);
      seed = (seed * 16807) % 2147483647 / 2147483647;
    }
    this.perm = [];
    for(let i = 0; i < 512; i++) {
      this.perm[i] = this.p[i & 255];
    }
  }
  
  noise2D(xin, yin) {
    const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
    const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;
    
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;
    
    const X0 = i - t;
    const Y0 = j - t;
    const x0 = xin - X0;
    const y0 = yin - Y0;
    
    let i1, j1;
    if(x0 > y0) {
      i1 = 1; j1 = 0;
    } else {
      i1 = 0; j1 = 1;
    }
    
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1.0 + 2.0 * G2;
    const y2 = y0 - 1.0 + 2.0 * G2;
    
    const ii = i & 255;
    const jj = j & 255;
    const gi0 = this.perm[ii + this.perm[jj]] % 12;
    const gi1 = this.perm[ii + i1 + this.perm[jj + j1]] % 12;
    const gi2 = this.perm[ii + 1 + this.perm[jj + 1]] % 12;
    
    let t0 = 0.5 - x0*x0 - y0*y0;
    let n0 = 0;
    if(t0 >= 0) {
      t0 *= t0;
      n0 = t0 * t0 * this.dot2(this.grad3[gi0], x0, y0);
    }
    
    let t1 = 0.5 - x1*x1 - y1*y1;
    let n1 = 0;
    if(t1 >= 0) {
      t1 *= t1;
      n1 = t1 * t1 * this.dot2(this.grad3[gi1], x1, y1);
    }
    
    let t2 = 0.5 - x2*x2 - y2*y2;
    let n2 = 0;
    if(t2 >= 0) {
      t2 *= t2;
      n2 = t2 * t2 * this.dot2(this.grad3[gi2], x2, y2);
    }
    
    return 70.0 * (n0 + n1 + n2);
  }
  
  dot2(g, x, y) {
    return g[0]*x + g[1]*y;
  }
}

// Fire Particle with realistic physics
class FireParticle {
  constructor(x, y) {
    // Position and motion
    this.position = new Vector2(x, y);
    this.velocity = new Vector2(
      (Math.random() - 0.5) * 60,  // -30 to 30 px/s horizontal
      -100 - Math.random() * 50     // -100 to -150 px/s vertical (upward)
    );
    this.acceleration = new Vector2(0, 0);
    
    // Physical properties
    this.temperature = 2800 + Math.random() * 500; // 2800K to 3300K
    this.mass = 0.001 + Math.random() * 0.002;     // 0.001 to 0.003 kg
    this.radius = 4 + Math.random() * 4;           // 4 to 8 pixels initial
    this.age = 0;
    this.lifespan = 0.8 + Math.random() * 1.7;     // 0.8 to 2.5 seconds
    
    // Visual properties
    this.opacity = 1.0;
    this.color = { r: 255, g: 200, b: 100 };
    this.turbulencePhase = Math.random() * Math.PI * 2;
  }
  
  update(deltaTime, noise, time) {
    // Age the particle
    this.age += deltaTime;
    
    if(this.isDead()) return;
    
    // Reset acceleration
    this.acceleration = new Vector2(0, 0);
    
    // 1. BUOYANCY FORCE (hot air rises)
    // F = (ρ_air - ρ_particle) * V * g
    const airDensity = 1.225; // kg/m³ at sea level
    const particleDensity = 101325 / (287 * this.temperature); // ideal gas law
    const volume = (4/3) * Math.PI * Math.pow(this.radius * 0.001, 3); // m³
    const gravity = 9.81 * 100; // m/s² converted to px/s²
    
    const buoyancyForce = (airDensity - particleDensity) * volume * gravity;
    const buoyancyAccel = new Vector2(0, -buoyancyForce / this.mass);
    this.acceleration = this.acceleration.add(buoyancyAccel);
    
    // 2. DRAG FORCE (air resistance)
    // F = -0.5 * ρ * v² * Cd * A
    const dragCoefficient = 0.47; // sphere
    const area = Math.PI * Math.pow(this.radius * 0.001, 2); // m²
    const velocityMagnitude = this.velocity.magnitude() * 0.01; // convert to m/s
    
    if(velocityMagnitude > 0) {
      const dragForce = 0.5 * airDensity * velocityMagnitude * velocityMagnitude * dragCoefficient * area;
      const dragAccel = this.velocity.normalize().multiply(-dragForce / this.mass * 100);
      this.acceleration = this.acceleration.add(dragAccel);
    }
    
    // 3. TURBULENCE FORCE (using Simplex noise)
    const noiseScale = 0.01;
    const noiseStrength = 200;
    const turbulenceX = noise.noise2D(
      this.position.x * noiseScale,
      time + this.turbulencePhase
    ) * noiseStrength;
    const turbulenceY = noise.noise2D(
      this.position.y * noiseScale,
      time + this.turbulencePhase + 1000
    ) * noiseStrength * 0.5; // Less vertical turbulence
    
    this.acceleration = this.acceleration.add(new Vector2(turbulenceX, turbulenceY));
    
    // 4. VORTEX FORCE (swirling motion)
    const vortexStrength = 30;
    const centerX = 0; // Relative to emitter
    const distanceFromCenter = Math.abs(this.position.x - centerX);
    const vortexForce = vortexStrength / (1 + distanceFromCenter * 0.01);
    const vortexDirection = this.position.x > centerX ? -1 : 1;
    this.acceleration.x += vortexDirection * vortexForce;
    
    // Update velocity and position
    this.velocity = this.velocity.add(this.acceleration.multiply(deltaTime));
    this.position = this.position.add(this.velocity.multiply(deltaTime));
    
    // Cool down over time (temperature decay)
    const coolingRate = 400; // K/s
    this.temperature = Math.max(1500, this.temperature - coolingRate * deltaTime);
    
    // Update visual properties
    this.updateVisuals();
  }
  
  updateVisuals() {
    // Age-based opacity (fade out)
    const ageRatio = this.age / this.lifespan;
    this.opacity = Math.pow(1 - ageRatio, 0.5);
    
    // Size reduction over time
    const initialRadius = 4 + (this.mass - 0.001) * 2000;
    this.radius = initialRadius * Math.pow(1 - ageRatio, 0.3);
    
    // Temperature to color (blackbody radiation)
    this.color = this.temperatureToColor(this.temperature);
  }
  
  temperatureToColor(temp) {
    // Simplified blackbody radiation color mapping
    // Based on Planck's law and Wien's displacement law
    let r, g, b;
    
    // Red channel
    if(temp < 2000) {
      r = 255;
    } else if(temp < 3000) {
      r = 255;
    } else {
      r = 255 * Math.min(1, Math.pow(3000 / temp, 0.5));
    }
    
    // Green channel
    if(temp < 1500) {
      g = 0;
    } else if(temp < 2500) {
      g = 255 * ((temp - 1500) / 1000);
    } else {
      g = 255 * Math.min(1, Math.pow((temp - 1000) / 2000, 0.8));
    }
    
    // Blue channel
    if(temp < 2000) {
      b = 0;
    } else if(temp < 2500) {
      b = 20 * ((temp - 2000) / 500);
    } else {
      b = 255 * Math.min(1, Math.pow((temp - 2000) / 1500, 2));
    }
    
    return {
      r: Math.floor(r),
      g: Math.floor(g),
      b: Math.floor(b)
    };
  }
  
  isDead() {
    return this.age >= this.lifespan;
  }
}

// Particle Emitter
class FireEmitter {
  constructor(x, y) {
    this.position = new Vector2(x, y);
    this.particles = [];
    this.particlePool = [];
    this.maxParticles = 1000;
    
    // Spawn configuration
    this.spawnRate = 120; // particles per second
    this.spawnAccumulator = 0;
    this.spawnRadius = 30;
    
    // Pre-allocate particle pool
    for(let i = 0; i < this.maxParticles; i++) {
      this.particlePool.push(new FireParticle(0, 0));
    }
    
    // Noise generator for turbulence
    this.noise = new SimplexNoise();
  }
  
  update(deltaTime, time) {
    // Spawn new particles
    this.spawnAccumulator += this.spawnRate * deltaTime;
    while(this.spawnAccumulator >= 1 && this.particles.length < this.maxParticles) {
      this.spawnAccumulator -= 1;
      this.spawnParticle();
    }
    
    // Update existing particles
    for(let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];
      particle.update(deltaTime, this.noise, time);
      
      // Remove dead particles
      if(particle.isDead()) {
        this.particlePool.push(particle);
        this.particles.splice(i, 1);
      }
    }
  }
  
  spawnParticle() {
    if(this.particlePool.length === 0) return;
    
    const particle = this.particlePool.pop();
    
    // Reset particle with new values
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * this.spawnRadius;
    particle.position.x = this.position.x + Math.cos(angle) * radius;
    particle.position.y = this.position.y + Math.sin(angle) * radius;
    
    particle.velocity = new Vector2(
      (Math.random() - 0.5) * 60,
      -100 - Math.random() * 50
    );
    
    particle.temperature = 2800 + Math.random() * 500;
    particle.mass = 0.001 + Math.random() * 0.002;
    particle.radius = 4 + Math.random() * 4;
    particle.age = 0;
    particle.lifespan = 0.8 + Math.random() * 1.7;
    particle.opacity = 1.0;
    particle.turbulencePhase = Math.random() * Math.PI * 2;
    
    this.particles.push(particle);
  }
  
  burst(count = 500) {
    // Explosive burst for ignition effect
    for(let i = 0; i < count && this.particlePool.length > 0; i++) {
      const particle = this.particlePool.pop();
      
      // Radial burst pattern
      const angle = (i / count) * Math.PI * 2;
      const speed = 200 + Math.random() * 100;
      
      particle.position.x = this.position.x;
      particle.position.y = this.position.y;
      particle.velocity = new Vector2(
        Math.cos(angle) * speed,
        Math.sin(angle) * speed - 50
      );
      
      particle.temperature = 3300 + Math.random() * 200; // Hotter for burst
      particle.mass = 0.0005 + Math.random() * 0.001; // Lighter
      particle.radius = 6 + Math.random() * 4;
      particle.age = 0;
      particle.lifespan = 0.5 + Math.random() * 1.0; // Shorter
      particle.opacity = 1.0;
      
      this.particles.push(particle);
    }
  }
}

export { FireEmitter, FireParticle, Vector2, SimplexNoise };