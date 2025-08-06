/**
 * Fire Particle Renderer - Canvas 2D with Advanced Effects
 * Handles all visual rendering of the particle system
 */

class FireRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { 
      alpha: true,
      desynchronized: true // Better performance
    });
    
    // High DPI support
    this.pixelRatio = window.devicePixelRatio || 1;
    
    // Performance monitoring
    this.fps = 60;
    this.frameTime = 0;
    this.lastFrameTime = performance.now();
    this.frameCount = 0;
    this.fpsUpdateInterval = 500; // Update FPS every 500ms
    this.lastFpsUpdate = performance.now();
    
    // Gradient cache for performance
    this.gradientCache = new Map();
    this.maxGradientCache = 50;
    
    // Offscreen canvas for effects
    this.offscreenCanvas = document.createElement('canvas');
    this.offscreenCtx = this.offscreenCanvas.getContext('2d');
    
    // Glow effect canvas
    this.glowCanvas = document.createElement('canvas');
    this.glowCtx = this.glowCanvas.getContext('2d');
    
    // Heat distortion parameters
    this.distortionPhase = 0;
    this.distortionStrength = 0;
    
    // Initialize canvas size
    this.resize();
    
    // Bind methods
    this.render = this.render.bind(this);
  }
  
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    
    // Set canvas size with pixel ratio
    this.canvas.width = width * this.pixelRatio;
    this.canvas.height = height * this.pixelRatio;
    this.canvas.style.width = width + 'px';
    this.canvas.style.height = height + 'px';
    
    // Scale context for high DPI
    this.ctx.scale(this.pixelRatio, this.pixelRatio);
    
    // Resize offscreen canvases
    this.offscreenCanvas.width = this.canvas.width;
    this.offscreenCanvas.height = this.canvas.height;
    this.offscreenCtx.scale(this.pixelRatio, this.pixelRatio);
    
    this.glowCanvas.width = this.canvas.width / 2; // Half resolution for blur
    this.glowCanvas.height = this.canvas.height / 2;
    this.glowCtx.scale(this.pixelRatio / 2, this.pixelRatio / 2);
  }
  
  render(emitter, deltaTime, time, phase = 'steady') {
    // Performance monitoring
    this.updateFPS();
    
    // Clear canvases
    this.clear();
    
    // Update distortion based on particle heat
    this.updateDistortion(emitter.particles);
    
    // Apply heat distortion to background
    if(phase !== 'ignition') {
      this.applyHeatDistortion(time);
    }
    
    // Sort particles by y position (render bottom ones first)
    const sortedParticles = [...emitter.particles].sort((a, b) => b.position.y - a.position.y);
    
    // Render particles in layers
    this.renderParticleLayer(sortedParticles, 'ember', time);
    this.renderParticleLayer(sortedParticles, 'main', time);
    this.renderParticleLayer(sortedParticles, 'core', time);
    
    // Apply post-processing effects
    if(this.fps > 30) { // Only if performance allows
      this.applyGlowEffect();
    }
    
    // Render debug info if needed
    if(window.DEBUG_FIRE) {
      this.renderDebugInfo(emitter);
    }
    
    return this.fps;
  }
  
  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width / this.pixelRatio, this.canvas.height / this.pixelRatio);
    this.offscreenCtx.clearRect(0, 0, this.offscreenCanvas.width / this.pixelRatio, this.offscreenCanvas.height / this.pixelRatio);
    this.glowCtx.clearRect(0, 0, this.glowCanvas.width / (this.pixelRatio / 2), this.glowCanvas.height / (this.pixelRatio / 2));
  }
  
  renderParticleLayer(particles, layer, time) {
    const ctx = this.ctx;
    
    // Set composite operation for this layer
    if(layer === 'main' || layer === 'core') {
      ctx.globalCompositeOperation = 'lighter'; // Additive blending
    } else if(layer === 'ember') {
      ctx.globalCompositeOperation = 'screen';
    }
    
    particles.forEach(particle => {
      // Determine which layer this particle belongs to
      const particleLayer = this.getParticleLayer(particle);
      if(particleLayer !== layer) return;
      
      // Skip nearly invisible particles
      if(particle.opacity < 0.01) return;
      
      const x = particle.position.x;
      const y = particle.position.y;
      const radius = particle.radius;
      
      // Get or create gradient for this particle
      const gradient = this.getParticleGradient(particle, x, y, radius);
      
      // Apply motion blur for fast particles
      const speed = particle.velocity.magnitude();
      if(speed > 100) {
        ctx.save();
        const blurLength = Math.min(speed * 0.1, radius);
        const angle = Math.atan2(particle.velocity.y, particle.velocity.x);
        
        // Draw motion trail
        ctx.globalAlpha = particle.opacity * 0.3;
        for(let i = 0; i < 3; i++) {
          const trailX = x - Math.cos(angle) * blurLength * (i / 3);
          const trailY = y - Math.sin(angle) * blurLength * (i / 3);
          const trailRadius = radius * (1 - i * 0.2);
          
          ctx.beginPath();
          ctx.arc(trailX, trailY, trailRadius, 0, Math.PI * 2);
          ctx.fillStyle = gradient;
          ctx.fill();
        }
        ctx.restore();
      }
      
      // Draw main particle
      ctx.save();
      ctx.globalAlpha = particle.opacity;
      
      // Add subtle flicker
      const flicker = 1 + Math.sin(time * 30 + particle.turbulencePhase) * 0.05;
      ctx.globalAlpha *= flicker;
      
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
      
      // Add bright core for hot particles
      if(particle.temperature > 3000 && layer === 'core') {
        ctx.globalAlpha = particle.opacity * 0.8;
        ctx.globalCompositeOperation = 'screen';
        ctx.beginPath();
        ctx.arc(x, y, radius * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fill();
      }
      
      ctx.restore();
    });
    
    // Reset composite operation
    ctx.globalCompositeOperation = 'source-over';
  }
  
  getParticleLayer(particle) {
    // Categorize particles into layers based on properties
    if(particle.temperature > 3000) return 'core';
    if(particle.temperature < 2000) return 'ember';
    return 'main';
  }
  
  getParticleGradient(particle, x, y, radius) {
    // Create cache key based on particle properties
    const key = `${Math.round(particle.temperature / 100)}_${Math.round(radius)}`;
    
    if(this.gradientCache.has(key)) {
      return this.gradientCache.get(key);
    }
    
    // Create new gradient
    const gradient = this.ctx.createRadialGradient(x, y, 0, x, y, radius);
    
    const color = particle.color;
    const r = color.r;
    const g = color.g;
    const b = color.b;
    
    // Center is brightest and hottest
    gradient.addColorStop(0, `rgba(255, 255, 255, 1)`);
    gradient.addColorStop(0.1, `rgba(255, ${Math.min(255, g + 50)}, ${Math.min(255, b + 100)}, 1)`);
    gradient.addColorStop(0.3, `rgba(${r}, ${g}, ${b}, 0.9)`);
    gradient.addColorStop(0.6, `rgba(${Math.floor(r * 0.8)}, ${Math.floor(g * 0.6)}, ${Math.floor(b * 0.4)}, 0.5)`);
    gradient.addColorStop(0.9, `rgba(${Math.floor(r * 0.5)}, ${Math.floor(g * 0.3)}, 0, 0.2)`);
    gradient.addColorStop(1, `rgba(0, 0, 0, 0)`);
    
    // Cache management
    if(this.gradientCache.size > this.maxGradientCache) {
      const firstKey = this.gradientCache.keys().next().value;
      this.gradientCache.delete(firstKey);
    }
    
    this.gradientCache.set(key, gradient);
    return gradient;
  }
  
  applyGlowEffect() {
    const ctx = this.ctx;
    const glowCtx = this.glowCtx;
    
    // Copy main canvas to glow canvas at half resolution
    glowCtx.globalCompositeOperation = 'source-over';
    glowCtx.filter = 'blur(8px)'; // CSS blur for performance
    glowCtx.drawImage(
      this.canvas, 
      0, 0, this.canvas.width, this.canvas.height,
      0, 0, this.glowCanvas.width, this.glowCanvas.height
    );
    
    // Apply color tinting to glow
    glowCtx.globalCompositeOperation = 'multiply';
    glowCtx.fillStyle = 'rgba(255, 150, 50, 0.8)';
    glowCtx.fillRect(0, 0, this.glowCanvas.width, this.glowCanvas.height);
    
    // Draw glow back to main canvas
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.6;
    ctx.drawImage(
      this.glowCanvas,
      0, 0, this.glowCanvas.width, this.glowCanvas.height,
      0, 0, this.canvas.width / this.pixelRatio, this.canvas.height / this.pixelRatio
    );
    ctx.restore();
  }
  
  updateDistortion(particles) {
    // Calculate total heat from particles
    let totalHeat = 0;
    particles.forEach(particle => {
      const heat = (particle.temperature - 1500) / 2000; // Normalize
      totalHeat += heat * particle.opacity;
    });
    
    // Smooth transition
    this.distortionStrength = this.distortionStrength * 0.9 + Math.min(totalHeat * 0.01, 1) * 0.1;
  }
  
  applyHeatDistortion(time) {
    if(this.distortionStrength < 0.01) return;
    
    const ctx = this.ctx;
    const width = this.canvas.width / this.pixelRatio;
    const height = this.canvas.height / this.pixelRatio;
    
    // Create heat shimmer effect
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = this.distortionStrength * 0.1;
    
    // Draw vertical heat waves
    for(let x = 0; x < width; x += 20) {
      const offset = Math.sin(time * 3 + x * 0.1) * 5 * this.distortionStrength;
      const gradient = ctx.createLinearGradient(x, height * 0.3, x, height);
      gradient.addColorStop(0, 'rgba(255, 150, 50, 0)');
      gradient.addColorStop(0.5, 'rgba(255, 200, 100, 0.2)');
      gradient.addColorStop(1, 'rgba(255, 100, 0, 0)');
      
      ctx.fillStyle = gradient;
      ctx.fillRect(x + offset, height * 0.3, 20, height * 0.7);
    }
    
    ctx.restore();
  }
  
  updateFPS() {
    const now = performance.now();
    const delta = now - this.lastFrameTime;
    this.lastFrameTime = now;
    
    this.frameTime = this.frameTime * 0.9 + delta * 0.1; // Smooth
    this.frameCount++;
    
    if(now - this.lastFpsUpdate > this.fpsUpdateInterval) {
      this.fps = Math.round(1000 / this.frameTime);
      this.frameCount = 0;
      this.lastFpsUpdate = now;
    }
  }
  
  renderDebugInfo(emitter) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = 'white';
    ctx.font = '12px monospace';
    ctx.fillText(`FPS: ${this.fps}`, 10, 20);
    ctx.fillText(`Particles: ${emitter.particles.length}`, 10, 35);
    ctx.fillText(`Distortion: ${(this.distortionStrength * 100).toFixed(1)}%`, 10, 50);
    ctx.restore();
  }
  
  destroy() {
    // Clean up resources
    this.gradientCache.clear();
    this.offscreenCanvas.remove();
    this.glowCanvas.remove();
  }
}

export default FireRenderer;