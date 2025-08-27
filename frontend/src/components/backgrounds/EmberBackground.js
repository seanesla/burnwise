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
    // Start particles spread across entire vertical range for immediate visibility
    this.y = Math.random() * canvas.height;
  }

  reset() {
    this.x = Math.random() * this.canvas.width;
    this.y = Math.random() * this.canvas.height; // Start anywhere on screen
    this.size = Math.random() * 8 + 5; // Bigger particles (5-13px)
    this.speedY = Math.random() * 0.6 + 0.3; // Slower upward movement
    this.speedX = (Math.random() - 0.5) * 0.4; // Gentle horizontal drift
    this.opacity = 0; // Start invisible for fade in
    this.targetOpacity = Math.random() * 0.6 + 0.3; // Target opacity (30-90%)
    this.fadeInRate = 0.001; // Very slow fade in
    this.fadeOutRate = 0.0005; // Very slow fade out
    this.color = this.getEmberColor();
    this.glow = Math.random() * 20 + 10; // Bigger glow
    this.lifespan = Math.random() * 800 + 600; // Longer life (600-1400)
    this.age = 0;
    this.fadingOut = false;
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
    
    // Smooth fade in/out - no flickering
    if (!this.fadingOut) {
      // Fade in phase
      if (this.opacity < this.targetOpacity) {
        this.opacity += this.fadeInRate * deltaTime;
        if (this.opacity > this.targetOpacity) {
          this.opacity = this.targetOpacity;
        }
      }
      // Start fading out when 70% through lifespan
      if (this.age > this.lifespan * 0.7) {
        this.fadingOut = true;
      }
    } else {
      // Fade out phase
      this.opacity -= this.fadeOutRate * deltaTime;
    }
    
    // Reset if out of bounds or faded out
    if (this.y < -50 || this.y > this.canvas.height + 50 || 
        this.x < -50 || this.x > this.canvas.width + 50 || 
        this.opacity <= 0 || this.age > this.lifespan) {
      this.reset();
    }
    
    return 1; // No flicker, return constant brightness
  }

  draw(ctx) {
    const actualOpacity = Math.min(1, this.opacity); // No flicker multiplier
    
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
    
    ctx.globalCompositeOperation = 'source-over';
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
      console.log('Canvas resized to:', canvas.width, 'x', canvas.height);
    };
    resizeCanvas();

    // Create atmospheric particle density - fewer, more spread out particles
    const particleCount = Math.floor(40 * intensity); // Reduced particles for less clutter
    console.log(`Creating ${particleCount} ember particles`);
    particlesRef.current = Array.from({ length: particleCount }, () => new Ember(canvas));
    console.log('Particles created:', particlesRef.current.length);

    let frameCount = 0;
    const animate = (currentTime) => {
      const deltaTime = currentTime - lastTimeRef.current;
      lastTimeRef.current = currentTime;

      // Clear canvas completely
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Update and draw all particles
      particlesRef.current.forEach((particle, i) => {
        particle.update(deltaTime);
        particle.draw(ctx);
      });

      frameCount++;

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
    <>
      {/* Dark overlay */}
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0, 0, 0, 0.3)',
          pointerEvents: 'none',
          zIndex: 1
        }}
      />
      {/* Ember particles with blur applied to them */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          pointerEvents: 'none',
          filter: blur ? 'blur(2px)' : 'none',
          zIndex: 2
        }}
      />
    </>
  );
};

export default EmberBackground;