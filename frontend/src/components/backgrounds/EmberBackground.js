/**
 * EmberBackground.js - Animated ember particle background
 * Creates visible glowing ember effects rising from bottom to top
 * High visibility version
 */

import React, { useEffect, useRef } from 'react';
import './EmberBackground.css';

class Ember {
  constructor(canvas) {
    this.canvas = canvas;
    this.reset();
    // Start particles spread across screen
    this.y = Math.random() * canvas.height;
  }

  reset() {
    this.x = Math.random() * this.canvas.width;
    this.y = this.canvas.height + Math.random() * 100; // Start below screen
    this.size = Math.random() * 5 + 3; // Bigger particles (3-8px)
    this.speedY = Math.random() * 0.5 + 0.3; // Moderate speed
    this.speedX = (Math.random() - 0.5) * 0.3;
    this.opacity = 1; // Full opacity
    this.fadeRate = Math.random() * 0.0008 + 0.0004;
    this.color = this.getEmberColor();
    this.glow = Math.random() * 25 + 15; // Big visible glow
    this.flickerSpeed = Math.random() * 0.02 + 0.01;
    this.flickerPhase = Math.random() * Math.PI * 2;
    this.age = 0;
  }

  getEmberColor() {
    const colors = [
      { r: 255, g: 150, b: 50 },  // Bright orange
      { r: 255, g: 180, b: 60 },   // Light orange  
      { r: 255, g: 120, b: 30 },   // Deep orange
      { r: 255, g: 220, b: 100 },  // Yellow-orange
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  update(deltaTime) {
    this.age += deltaTime;
    
    // Steady upward movement
    this.y -= this.speedY * deltaTime * 0.1;
    this.x += this.speedX * deltaTime * 0.08;
    this.x += Math.sin(this.age * 0.001) * 0.3;
    
    // Gentle flicker
    this.flickerPhase += this.flickerSpeed;
    const flicker = Math.sin(this.flickerPhase) * 0.1 + 0.9;
    
    // Fade only near top
    if (this.y < 100) {
      this.opacity -= this.fadeRate * deltaTime * 0.1;
    }
    
    // Reset when off screen
    if (this.y < -50 || this.opacity <= 0) {
      this.reset();
    }
    
    return flicker;
  }

  draw(ctx, flicker) {
    const actualOpacity = Math.min(1, this.opacity * flicker);
    
    ctx.save();
    
    // Big bright glow
    const gradient = ctx.createRadialGradient(
      this.x, this.y, 0,
      this.x, this.y, this.glow
    );
    gradient.addColorStop(0, `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${actualOpacity})`);
    gradient.addColorStop(0.3, `rgba(${this.color.r}, ${this.color.g * 0.9}, ${this.color.b * 0.8}, ${actualOpacity * 0.7})`);
    gradient.addColorStop(0.6, `rgba(${this.color.r * 0.9}, ${this.color.g * 0.8}, ${this.color.b * 0.7}, ${actualOpacity * 0.3})`);
    gradient.addColorStop(1, `rgba(${this.color.r * 0.7}, ${this.color.g * 0.6}, ${this.color.b * 0.5}, 0)`);
    
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.glow, 0, Math.PI * 2);
    ctx.fill();
    
    // Bright core
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${actualOpacity})`;
    ctx.shadowColor = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, 1)`;
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    
    // Hot white center
    ctx.fillStyle = `rgba(255, 255, 200, ${actualOpacity * 0.8})`;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * 0.5, 0, Math.PI * 2);
    ctx.fill();
    
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

    // More particles for visibility
    const particleCount = Math.floor(30 * intensity);
    particlesRef.current = Array.from({ length: particleCount }, () => new Ember(canvas));

    const animate = (currentTime) => {
      const deltaTime = currentTime - lastTimeRef.current;
      lastTimeRef.current = currentTime;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

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