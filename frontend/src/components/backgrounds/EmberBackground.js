/**
 * EmberBackground.js - Animated ember particle background
 * Creates floating ember effects for dark backgrounds throughout the app
 * Optimized canvas animation with subtle blur for depth
 */

import React, { useEffect, useRef } from 'react';
import './EmberBackground.css';

class Particle {
  constructor(canvas) {
    this.canvas = canvas;
    this.reset();
    // Start particles at random positions initially
    this.y = Math.random() * canvas.height;
  }

  reset() {
    this.x = Math.random() * this.canvas.width;
    this.y = this.canvas.height + 10;
    this.size = Math.random() * 3 + 1;
    this.speedY = Math.random() * 1.5 + 0.5;
    this.speedX = (Math.random() - 0.5) * 0.5;
    this.opacity = Math.random() * 0.6 + 0.4;
    this.fadeRate = Math.random() * 0.005 + 0.002;
    this.hue = Math.random() * 30 + 10; // Orange to red range
    this.brightness = Math.random() * 50 + 50;
    this.twinkle = Math.random() * 0.02 + 0.01;
    this.twinklePhase = Math.random() * Math.PI * 2;
    this.lifespan = Math.random() * 200 + 100;
    this.age = 0;
  }

  update(deltaTime) {
    this.age += deltaTime;
    
    // Float upward with slight horizontal drift
    this.y -= this.speedY * deltaTime * 0.06;
    this.x += this.speedX * deltaTime * 0.06;
    
    // Add subtle floating motion
    this.x += Math.sin(this.age * 0.001) * 0.2;
    
    // Twinkle effect
    this.twinklePhase += this.twinkle;
    const twinkleFactor = Math.sin(this.twinklePhase) * 0.3 + 0.7;
    
    // Fade as particle rises
    if (this.y < this.canvas.height * 0.3) {
      this.opacity -= this.fadeRate * deltaTime * 0.1;
    }
    
    // Reset when particle goes off screen or fades out
    if (this.y < -10 || this.opacity <= 0 || this.x < -10 || this.x > this.canvas.width + 10) {
      this.reset();
    }
    
    return twinkleFactor;
  }

  draw(ctx, twinkleFactor) {
    // Glow effect
    const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size * 3);
    gradient.addColorStop(0, `hsla(${this.hue}, 100%, ${this.brightness}%, ${this.opacity * twinkleFactor})`);
    gradient.addColorStop(0.4, `hsla(${this.hue}, 100%, ${this.brightness * 0.8}%, ${this.opacity * 0.5 * twinkleFactor})`);
    gradient.addColorStop(1, `hsla(${this.hue}, 100%, ${this.brightness * 0.6}%, 0)`);
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * 3, 0, Math.PI * 2);
    ctx.fill();
    
    // Core ember
    ctx.fillStyle = `hsla(${this.hue}, 100%, ${Math.min(100, this.brightness + 20)}%, ${this.opacity * twinkleFactor})`;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

class SmokeParticle {
  constructor(canvas) {
    this.canvas = canvas;
    this.reset();
    this.y = Math.random() * canvas.height;
  }

  reset() {
    this.x = Math.random() * this.canvas.width;
    this.y = this.canvas.height + 50;
    this.size = Math.random() * 80 + 40;
    this.speedY = Math.random() * 0.3 + 0.1;
    this.speedX = (Math.random() - 0.5) * 0.2;
    this.opacity = Math.random() * 0.02 + 0.01;
    this.rotation = Math.random() * Math.PI * 2;
    this.rotationSpeed = (Math.random() - 0.5) * 0.001;
  }

  update(deltaTime) {
    this.y -= this.speedY * deltaTime * 0.06;
    this.x += this.speedX * deltaTime * 0.06;
    this.rotation += this.rotationSpeed * deltaTime;
    this.size += deltaTime * 0.002;
    
    if (this.y < -this.size || this.x < -this.size || this.x > this.canvas.width + this.size) {
      this.reset();
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.size);
    gradient.addColorStop(0, `rgba(255, 107, 53, ${this.opacity})`);
    gradient.addColorStop(0.5, `rgba(255, 87, 34, ${this.opacity * 0.5})`);
    gradient.addColorStop(1, `rgba(255, 67, 0, 0)`);
    
    ctx.fillStyle = gradient;
    ctx.fillRect(-this.size, -this.size, this.size * 2, this.size * 2);
    ctx.restore();
  }
}

const EmberBackground = ({ intensity = 1, blur = true }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const particlesRef = useRef([]);
  const smokeParticlesRef = useRef([]);
  const lastTimeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      
      // Reinitialize particles on resize
      const particleCount = Math.floor((canvas.width * canvas.height) / 15000) * intensity;
      const smokeCount = Math.floor(particleCount / 10);
      
      particlesRef.current = Array.from({ length: Math.min(particleCount, 100) }, 
        () => new Particle(canvas)
      );
      
      smokeParticlesRef.current = Array.from({ length: Math.min(smokeCount, 10) }, 
        () => new SmokeParticle(canvas)
      );
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    const animate = (currentTime) => {
      const deltaTime = currentTime - lastTimeRef.current;
      lastTimeRef.current = currentTime;

      // Clear canvas with slight fade for trail effect
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw smoke particles (background layer)
      smokeParticlesRef.current.forEach(particle => {
        particle.update(deltaTime);
        particle.draw(ctx);
      });

      // Draw ember particles
      particlesRef.current.forEach(particle => {
        const twinkleFactor = particle.update(deltaTime);
        particle.draw(ctx, twinkleFactor);
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate(0);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [intensity]);

  return (
    <div className={`ember-background ${blur ? 'ember-blur' : ''}`}>
      <canvas 
        ref={canvasRef}
        className="ember-canvas"
        style={{ 
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none'
        }}
      />
      <div className="ember-overlay" />
    </div>
  );
};

export default EmberBackground;