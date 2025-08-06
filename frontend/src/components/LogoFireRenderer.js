/**
 * Optimized Logo Fire Renderer
 * High-performance rendering using cached logo images
 */

class LogoFireRenderer {
  constructor(canvas, logoCache) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', {
      alpha: false, // Opaque background for performance
      desynchronized: true, // Better performance
      willReadFrequently: false // We're not reading pixels
    });
    
    this.logoCache = logoCache;
    
    // Device pixel ratio for sharp rendering
    this.pixelRatio = window.devicePixelRatio || 1;
    
    // Performance monitoring
    this.fps = 60;
    this.frameCount = 0;
    this.lastTime = performance.now();
    this.lastFpsUpdate = performance.now();
    
    // Background gradient (fire atmosphere)
    this.backgroundGradient = null;
    
    // Glow accumulation canvas
    this.glowCanvas = document.createElement('canvas');
    this.glowCtx = this.glowCanvas.getContext('2d');
    
    // Initialize canvas
    this.resize();
    this.createBackgroundGradient();
  }
  
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    
    // Set actual canvas size accounting for pixel ratio
    this.canvas.width = width * this.pixelRatio;
    this.canvas.height = height * this.pixelRatio;
    
    // Scale canvas back down using CSS
    this.canvas.style.width = width + 'px';
    this.canvas.style.height = height + 'px';
    
    // Set up glow canvas (lower resolution for performance)
    this.glowCanvas.width = width;
    this.glowCanvas.height = height;
    
    // Recreate gradient after resize
    this.createBackgroundGradient();
  }
  
  createBackgroundGradient() {
    const width = this.canvas.width / this.pixelRatio;
    const height = this.canvas.height / this.pixelRatio;
    
    // Dark to lighter gradient from top to bottom (fire glow at bottom)
    this.backgroundGradient = this.ctx.createRadialGradient(
      width / 2, height * 0.8, 0,
      width / 2, height * 0.8, height
    );
    
    this.backgroundGradient.addColorStop(0, 'rgba(40, 15, 5, 1)');
    this.backgroundGradient.addColorStop(0.3, 'rgba(25, 10, 5, 1)');
    this.backgroundGradient.addColorStop(0.6, 'rgba(15, 5, 5, 1)');
    this.backgroundGradient.addColorStop(1, 'rgba(0, 0, 0, 1)');
  }
  
  render(emitter, deltaTime, time, phase = 'main') {
    // Update FPS
    this.updateFPS();
    
    // Clear and draw background
    this.drawBackground();
    
    // Sort particles for proper layering (back to front)
    const sortedParticles = [...emitter.particles].sort((a, b) => {
      // Smaller particles render behind larger ones
      return a.size - b.size;
    });
    
    // Clear glow canvas
    this.glowCtx.clearRect(0, 0, this.glowCanvas.width, this.glowCanvas.height);
    
    // Batch render particles by temperature (reduces texture switches)
    this.renderParticleBatches(sortedParticles);
    
    // Apply glow effect
    if(this.fps > 30 && phase !== 'initial') {
      this.applyGlow();
    }
    
    // Debug info
    if(window.DEBUG_FIRE) {
      this.renderDebugInfo(emitter, phase);
    }
    
    return this.fps;
  }
  
  drawBackground() {
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;
    
    // Save state
    ctx.save();
    
    // Account for pixel ratio
    ctx.scale(this.pixelRatio, this.pixelRatio);
    
    // Fill with gradient
    ctx.fillStyle = this.backgroundGradient;
    ctx.fillRect(0, 0, width / this.pixelRatio, height / this.pixelRatio);
    
    // Restore state
    ctx.restore();
  }
  
  renderParticleBatches(particles) {
    const ctx = this.ctx;
    const glowCtx = this.glowCtx;
    
    // Group particles by approximate temperature for batching
    const batches = new Map();
    
    particles.forEach(particle => {
      if(particle.opacity < 0.01) return; // Skip invisible
      
      const tempKey = Math.floor(particle.temperature / 200) * 200; // Group by 200K increments
      if(!batches.has(tempKey)) {
        batches.set(tempKey, []);
      }
      batches.get(tempKey).push(particle);
    });
    
    // Save context state
    ctx.save();
    glowCtx.save();
    
    // Scale for pixel ratio
    ctx.scale(this.pixelRatio, this.pixelRatio);
    
    // Set composite mode for fire effect
    ctx.globalCompositeOperation = 'lighter'; // Additive blending
    glowCtx.globalCompositeOperation = 'lighter';
    
    // Render each batch
    batches.forEach((batch, temperature) => {
      batch.forEach(particle => {
        this.renderParticle(particle, ctx, glowCtx);
      });
    });
    
    // Restore context
    ctx.restore();
    glowCtx.restore();
  }
  
  renderParticle(particle, ctx, glowCtx) {
    // Get cached flame image
    const flameImage = this.logoCache.getFlame(particle.size, particle.temperature);
    if(!flameImage) return;
    
    // Calculate render position and size
    const x = particle.x;
    const y = particle.y;
    const width = flameImage.width;
    const height = flameImage.height;
    
    // Main particle rendering
    ctx.save();
    
    // Position and rotate
    ctx.translate(x, y);
    ctx.rotate(particle.rotation);
    
    // Apply opacity
    ctx.globalAlpha = particle.opacity;
    
    // Add subtle flicker
    const flicker = 1 + Math.sin(particle.age * 20 + particle.turbulencePhase) * 0.05;
    ctx.globalAlpha *= flicker;
    
    // Draw the cached flame image
    ctx.drawImage(
      flameImage,
      -width / 2,
      -height / 2,
      width,
      height
    );
    
    ctx.restore();
    
    // Draw to glow layer (lower resolution, will be blurred)
    if(particle.temperature > 2600) {
      glowCtx.save();
      glowCtx.translate(x, y);
      glowCtx.globalAlpha = particle.opacity * 0.5;
      glowCtx.drawImage(
        flameImage,
        -width / 2,
        -height / 2,
        width,
        height
      );
      glowCtx.restore();
    }
  }
  
  applyGlow() {
    const ctx = this.ctx;
    
    ctx.save();
    ctx.scale(this.pixelRatio, this.pixelRatio);
    
    // Apply blur to glow canvas using CSS filter (hardware accelerated)
    ctx.filter = 'blur(10px)';
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.7;
    
    // Draw blurred glow
    ctx.drawImage(this.glowCanvas, 0, 0);
    
    // Add color overlay for warmth
    ctx.filter = 'none';
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = 'rgba(255, 150, 50, 0.3)';
    ctx.fillRect(0, 0, this.canvas.width / this.pixelRatio, this.canvas.height / this.pixelRatio);
    
    ctx.restore();
  }
  
  updateFPS() {
    const now = performance.now();
    const delta = now - this.lastTime;
    this.lastTime = now;
    
    this.frameCount++;
    
    // Update FPS every 500ms
    if(now - this.lastFpsUpdate > 500) {
      this.fps = Math.round(this.frameCount * 2); // Convert to per second
      this.frameCount = 0;
      this.lastFpsUpdate = now;
    }
  }
  
  renderDebugInfo(emitter, phase) {
    const ctx = this.ctx;
    
    ctx.save();
    ctx.scale(this.pixelRatio, this.pixelRatio);
    
    // Debug background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(10, 10, 200, 100);
    
    // Debug text
    ctx.fillStyle = 'white';
    ctx.font = '14px monospace';
    ctx.fillText(`FPS: ${this.fps}`, 20, 30);
    ctx.fillText(`Particles: ${emitter.particles.length}`, 20, 50);
    ctx.fillText(`Phase: ${phase}`, 20, 70);
    ctx.fillText(`Pool: ${emitter.particlePool.length}`, 20, 90);
    
    ctx.restore();
  }
  
  destroy() {
    this.glowCanvas.remove();
  }
}

export default LogoFireRenderer;