/**
 * EmberBackground.js - VISIBLE animated ember particle background
 * Creates bright glowing ember effects that are actually visible
 * Using bright colors and no black clearing
 */

import React, { useEffect, useRef } from 'react';
import './EmberBackground.css';

class Ember {
  constructor(canvas) {
    this.canvas = canvas;
    this.reset();
    // Start particles spread across middle to upper screen for immediate visibility
    this.y = canvas.height * 0.2 + Math.random() * canvas.height * 0.6;
  }

  reset() {
    this.x = Math.random() * this.canvas.width;
    this.y = this.canvas.height * 0.5 + Math.random() * this.canvas.height * 0.3; // Start from middle to lower-third of screen
    this.size = Math.random() * 6 + 3; // Even bigger particles (3-9px)
    this.speedY = Math.random() * 0.8 + 0.4; // Much slower upward movement
    this.speedX = (Math.random() - 0.5) * 0.5; // Slower horizontal drift
    this.opacity = 1; // Full opacity
    this.fadeRate = Math.random() * 0.001 + 0.0005; // Slower fade
    this.color = this.getEmberColor();
    this.glow = Math.random() * 20 + 10; // Bigger glow
    this.flickerSpeed = Math.random() * 0.05 + 0.02; // Slower flicker
    this.flickerPhase = Math.random() * Math.PI * 2;
    this.lifespan = Math.random() * 600 + 500; // Longer life
    this.age = 0;
  }

  getEmberColor() {
    const colors = [
      { r: 255, g: 120, b: 50 },  // Bright orange
      { r: 255, g: 160, b: 30 },   // Golden orange  
      { r: 255, g: 90, b: 20 },    // Red-orange
      { r: 255, g: 200, b: 50 },   // Yellow-orange
      { r: 255, g: 255, b: 150 }   // Yellow-white (hot)
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  update(deltaTime) {
    this.age += deltaTime;
    
    // Float upward with gentle wavy motion - MUCH SLOWER
    this.y -= this.speedY * deltaTime * 0.04; // Slower rise
    this.x += this.speedX * deltaTime * 0.03; // Slower drift
    this.x += Math.sin(this.age * 0.0005) * 0.4; // Gentler wave
    
    // Flicker effect
    this.flickerPhase += this.flickerSpeed;
    const flicker = Math.sin(this.flickerPhase) * 0.15 + 0.85;
    
    // Fade only at very top
    if (this.y < 80) {
      this.opacity -= this.fadeRate * deltaTime * 0.1;
    }
    
    // Reset if out of bounds
    if (this.y < -50 || this.opacity <= 0 || this.age > this.lifespan) {
      this.reset();
    }
    
    return flicker;
  }

  draw(ctx, flicker) {
    const actualOpacity = Math.min(1, this.opacity * flicker);
    
    // Save context state
    ctx.save();
    
    // Large bright glow effect
    const gradient = ctx.createRadialGradient(
      this.x, this.y, 0,
      this.x, this.y, this.glow
    );
    gradient.addColorStop(0, `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${actualOpacity})`);
    gradient.addColorStop(0.3, `rgba(${this.color.r}, ${this.color.g * 0.9}, ${this.color.b * 0.8}, ${actualOpacity * 0.6})`);
    gradient.addColorStop(0.6, `rgba(${this.color.r * 0.8}, ${this.color.g * 0.7}, ${this.color.b * 0.6}, ${actualOpacity * 0.3})`);
    gradient.addColorStop(1, `rgba(${this.color.r * 0.6}, ${this.color.g * 0.5}, ${this.color.b * 0.4}, 0)`);
    
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.glow, 0, Math.PI * 2);
    ctx.fill();
    
    // Main bright ember
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${actualOpacity})`;
    ctx.shadowColor = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, 1)`;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    
    // White hot core
    ctx.fillStyle = `rgba(255, 255, 220, ${actualOpacity})`;
    ctx.shadowBlur = 5;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * 0.4, 0, Math.PI * 2);
    ctx.fill();
    
    // Restore context
    ctx.restore();
  }
}

const EmberBackground = ({ intensity = 1, blur = false }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const particlesRef = useRef([]);
  const lastTimeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();

    // Create atmospheric particle density
    const particleCount = Math.floor(60 * intensity); // Balanced for atmosphere
    particlesRef.current = Array.from({ length: particleCount }, () => new Ember(canvas));

    const animate = (currentTime) => {
      const deltaTime = currentTime - lastTimeRef.current;
      lastTimeRef.current = currentTime;

      // Clear canvas completely
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Update and draw all particles
      particlesRef.current.forEach(particle => {
        const flicker = particle.update(deltaTime);
        particle.draw(ctx, flicker);
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate(0);

    window.addEventListener('resize', resizeCanvas);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      window.removeEventListener('resize', resizeCanvas);
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
          pointerEvents: 'none',
          opacity: 1
        }}
      />
    </div>
  );
};

export default EmberBackground;