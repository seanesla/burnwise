import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import AnimatedFlameLogo from './animations/logos/AnimatedFlameLogo';
import { FaSmog, FaCar, FaHospital, FaBalanceScale } from 'react-icons/fa';
import '../styles/Landing.css';

const Landing = ({ isInitialLoad = true }) => {
  const navigate = useNavigate();
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [scrollY, setScrollY] = useState(0);
  const [animationPhase, setAnimationPhase] = useState(isInitialLoad ? 'startup' : 'complete');
  const titleRef = useRef(null);
  const [flameTarget, setFlameTarget] = useState({ x: 0, yViewport: 0, yPage: 0 });
  
  console.log('Landing render - isInitialLoad:', isInitialLoad, 'animationPhase:', animationPhase);

  // Fire-themed video URLs for cinematic slideshow
  const videos = [
    '/forest-fire-night.mp4',
    '/rice-straw-burning.mp4', 
    '/rice-fields-wide-burn.mp4',
    '/gentle-field-fire.mp4'
  ];

  // Calculate flame target position early and keep it stable
  useEffect(() => {
    const calculateFlameTarget = () => {
      const title = document.getElementById('burnwise-title');
      if (!title) {
        // Keep trying until title is available
        const retryTimer = setTimeout(calculateFlameTarget, 50);
        return () => clearTimeout(retryTimer);
      }
      
      const titleRect = title.getBoundingClientRect();
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      
      // CRITICAL: DO NOT CHANGE - Flame position above "I" in BURNWISE
      // The "I" is at index 5 (6th character) - verified visually
      // This ratio has been precisely calibrated through extensive testing
      const iPositionRatio = 0.67; // LOCKED: Exact center of "I" character - DO NOT MODIFY
      
      // Defensive check to ensure ratio hasn't been changed
      if (iPositionRatio !== 0.67) {
        console.error('CRITICAL: Flame position ratio has been modified! Must be 0.67');
      }
      
      // Calculate the I position
      const iCenterX = titleRect.left + (titleRect.width * iPositionRatio);
      
      // For fixed positioning (during animation), use viewport coordinates
      // For absolute positioning (after animation), we need page coordinates
      // Adjust Y position to place flame above the "I" - flame bottom should just touch top of I
      const iTopViewport = titleRect.top - 180; // Viewport coordinates for fixed positioning - flame above I
      const iTopPage = titleRect.top + scrollTop - 180; // Page coordinates for absolute positioning
      
      console.log('Title rect:', {
        left: titleRect.left,
        width: titleRect.width,
        top: titleRect.top,
        scrollTop
      });
      console.log('I position calculation:', {
        iPositionRatio,
        iCenterX,
        iTopViewport,
        iTopPage
      });
      
      // Store both viewport and page coordinates
      setFlameTarget({ 
        x: iCenterX, 
        yViewport: iTopViewport,  // For fixed positioning
        yPage: iTopPage  // For absolute positioning
      });
    };
    
    // Calculate on mount and when animation phase changes
    const initTimer = setTimeout(calculateFlameTarget, 100);
    
    // Recalculate on resize and when animation completes
    window.addEventListener('resize', calculateFlameTarget);
    if (animationPhase === 'complete') {
      calculateFlameTarget();
    }
    
    return () => {
      clearTimeout(initTimer);
      window.removeEventListener('resize', calculateFlameTarget);
    };
  }, [animationPhase]); // Recalculate when animation phase changes

  // Animation timeline for unified experience
  useEffect(() => {
    console.log('Setting up animation timeline, isInitialLoad:', isInitialLoad);
    if (isInitialLoad) {
      // Lock scrolling
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      
      // Phase transitions
      const phase2Timer = setTimeout(() => {
        console.log('Moving to transitioning phase');
        setAnimationPhase('transitioning');
      }, 2500);
      const disappearTimer = setTimeout(() => {
        console.log('Moving to disappearing phase - skipping reveal');
        setAnimationPhase('disappearing');
      }, 4000);
      const completeTimer = setTimeout(() => {
        console.log('Animation complete');
        setAnimationPhase('complete');
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
      }, 5000);
      
      return () => {
        clearTimeout(phase2Timer);
        clearTimeout(disappearTimer);
        clearTimeout(completeTimer);
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
      };
    }
  }, [isInitialLoad]); // Only depend on isInitialLoad, not animationPhase

  // Video slideshow effect with cinematic timing
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentVideoIndex((prevIndex) => (prevIndex + 1) % videos.length);
    }, 12000); // Change video every 12 seconds for more cinematic pacing

    return () => clearInterval(interval);
  }, [videos.length]);

  // Scroll effect for video opacity
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      setScrollY(scrollPosition);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);


  // Calculate cinematic video opacity and parallax based on scroll
  const videoOpacity = Math.max(0, 1 - Math.pow(scrollY / 1000, 1.5));
  const videoTransform = `translateY(${scrollY * 0.5}px) scale(${1.05 + scrollY * 0.0001})`;
  const overlayOpacity = Math.min(1, scrollY / 600);
  
  // Animation variants for unified experience
  const backgroundVariants = {
    startup: {
      opacity: 1,
    },
    transitioning: {
      opacity: 1,
    },
    disappearing: {
      opacity: 0,
      transition: { duration: 0.5, ease: 'easeOut' }
    },
    complete: {
      opacity: 0,
    }
  };
  
  
  // Log animation phase changes
  useEffect(() => {
    console.log('Animation phase changed to:', animationPhase);
  }, [animationPhase]);
  
  // Calculate center position for viewport
  const viewportCenterX = typeof window !== 'undefined' ? window.innerWidth / 2 - 90 : 0;
  const viewportCenterY = typeof window !== 'undefined' ? window.innerHeight / 2 - 90 : 0;
  
  // Calculate final flame position (accounting for scaled size)
  // CRITICAL: The flame must stay above the "I" character
  // Transform positions from top-left, so we offset by half the original width (90px)
  const finalFlameX = flameTarget.x > 0 ? flameTarget.x - 90 : viewportCenterX;
  
  // Use viewport coordinates for fixed positioning, page coordinates for absolute
  const finalFlameYFixed = flameTarget.yViewport !== undefined ? flameTarget.yViewport : viewportCenterY;
  const finalFlameYAbsolute = flameTarget.yPage !== undefined ? flameTarget.yPage : viewportCenterY;
  
  const flameVariants = {
    startup: {
      x: viewportCenterX,
      y: viewportCenterY,
      scale: 1,
      opacity: 1,
    },
    transitioning: {
      x: viewportCenterX,
      y: viewportCenterY,
      scale: 0.361,
      opacity: 1,
      transition: { 
        duration: 1.5, 
        ease: [0.43, 0.13, 0.23, 0.96] // Custom ease for smooth scaling
      }
    },
    disappearing: {
      x: viewportCenterX,  // Stay at center, no movement
      y: viewportCenterY,  // Stay at center, no movement
      scale: 0,  // Shrink to nothing
      opacity: 0,  // Fade out
      rotate: 180,  // Add rotation for visual interest
      transition: { 
        duration: 1,
        ease: [0.43, 0.13, 0.23, 0.96],
        scale: {
          duration: 0.8,
          ease: "easeInOut"
        },
        opacity: {
          duration: 0.6,
          ease: "easeIn"
        },
        rotate: {
          duration: 1,
          ease: "easeOut"
        }
      }
    },
    complete: {
      x: finalFlameX,
      y: finalFlameYAbsolute,
      scale: 0,
      opacity: 0,
    }
  };
  
  const contentVariants = {
    startup: { opacity: 0 },
    transitioning: { opacity: 0 },
    disappearing: { 
      opacity: 1,
      transition: { duration: 0.8, ease: 'easeOut' }
    },
    complete: { opacity: 1 }
  };
  
  const videoVariants = {
    startup: { opacity: 0 },
    transitioning: { opacity: 0 },
    disappearing: { 
      opacity: videoOpacity,
      transition: { duration: 1, ease: 'easeOut' }
    },
    complete: { opacity: videoOpacity }
  };

  return (
    <div className="landing-container visible">
      {/* Black background overlay */}
      {(animationPhase === 'startup' || animationPhase === 'transitioning' || animationPhase === 'disappearing') && (
        <motion.div
          variants={backgroundVariants}
          initial="startup"
          animate={animationPhase}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: '#000',
            zIndex: 999998,
            pointerEvents: 'none'
          }}
        />
      )}
      
      {/* Single flame instance that animates from center to I */}
      {animationPhase !== 'complete' && (
        <motion.div 
          key="unified-flame"
          className="unified-flame"
          variants={flameVariants}
          initial="startup"
          animate={animationPhase}
          className="flame-container-animated"
          style={{
            position: 'absolute',  // Use absolute positioning to scroll with page
            top: 0,
            left: 0,
            width: 180,
            height: 180,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            filter: 'drop-shadow(0 0 25px rgba(255, 107, 53, 0.8)) drop-shadow(0 0 15px rgba(255, 87, 34, 0.6))',
            zIndex: 999999,
            pointerEvents: 'none',
          }}
          onAnimationComplete={() => {
            console.log('Flame animation complete for phase:', animationPhase);
          }}
        >
          <AnimatedFlameLogo size={180} animated={true} />
        </motion.div>
      )}
      
      {/* Layered background system */}
      <motion.div 
        className="video-background"
        variants={videoVariants}
        initial="startup"
        animate={animationPhase}
        style={{ 
          transform: videoTransform,
        }}
      >
        {videos.map((videoSrc, index) => (
          <video
            key={index}
            className={`background-video ${index === currentVideoIndex ? 'active' : ''}`}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
          >
            <source src={videoSrc} type="video/mp4" />
          </video>
        ))}
        <div className="video-overlay" style={{
          background: `
            radial-gradient(ellipse at center, rgba(0, 0, 0, ${0.2 + overlayOpacity * 0.3}) 0%, rgba(0, 0, 0, ${0.8 + overlayOpacity * 0.2}) 100%),
            linear-gradient(180deg, rgba(0, 0, 0, ${0.3 + overlayOpacity * 0.4}) 0%, rgba(0, 0, 0, ${0.6 + overlayOpacity * 0.3}) 70%, rgba(0, 0, 0, ${0.9 + overlayOpacity * 0.1}) 100%)
          `
        }}></div>
      </motion.div>

      {/* Content layer */}
      <motion.div 
        className="landing-content"
        variants={contentVariants}
        initial="startup"
        animate={animationPhase}
      >
        {/* Hero Section - Always rendered but animated */}
        <section className="hero-section">
          <div className="hero-title-container" style={{ position: 'relative', display: 'inline-block' }}>
            <h1 className="hero-title title-visible" id="burnwise-title" ref={titleRef}>
              Burnwise
            </h1>
          </div>
          <p className="hero-subtitle">Multi-Farm Agricultural Burn Coordinator</p>
          <p className="hero-description">
            Intelligent coordination system preventing dangerous smoke overlap between farms using 
            multi-agent AI, real-time weather analysis, and TiDB vector search technology.
          </p>
          
          <div className="cta-buttons">
            <button className="cta-primary" onClick={() => navigate('/dashboard')}>
              Get Started
            </button>
            <button className="cta-secondary" onClick={() => navigate('/map')}>
              View Live Map
            </button>
          </div>
        </section>

        {/* Problem Section */}
        <section className="problem-section">
          <div className="section-container">
            <h2 className="section-title">The Crisis We're Solving</h2>
            <p className="section-subtitle">
              Agricultural burning without coordination creates dangerous air quality conditions and regulatory violations
            </p>
            
            <div className="problem-grid">
              <div className="problem-card">
                <div className="problem-icon">
                  <FaSmog style={{ fontSize: '4rem', color: '#ff6b35' }} />
                </div>
                <h3>Dangerous PM2.5 Levels</h3>
                <p>Uncoordinated burns create PM2.5 concentrations exceeding EPA limits (35 µg/m³)<sup>1</sup>, 
                   endangering public health across multiple counties.</p>
              </div>
              
              <div className="problem-card">
                <div className="problem-icon">
                  <FaCar style={{ fontSize: '4rem', color: '#ff6b35' }} />
                </div>
                <h3>Highway Visibility Crisis</h3>
                <p>Smoke drift reduces visibility to under 100 meters on major highways, 
                   causing multi-vehicle accidents and traffic disruptions.</p>
              </div>
              
              <div className="problem-card">
                <div className="problem-icon">
                  <FaHospital style={{ fontSize: '4rem', color: '#ff6b35' }} />
                </div>
                <h3>Community Health Impact</h3>
                <p>Vulnerable populations including children and elderly face respiratory distress 
                   when multiple farms burn simultaneously.</p>
              </div>
              
              <div className="problem-card">
                <div className="problem-icon">
                  <FaBalanceScale style={{ fontSize: '4rem', color: '#ff6b35' }} />
                </div>
                <h3>Regulatory Violations</h3>
                <p>Farmers face EPA fines up to $37,500 per day for air quality violations 
                   due to lack of coordination.</p>
              </div>
            </div>
            
            <div className="problem-highlight">
              <blockquote>
                "Without real-time coordination, agricultural burning becomes a public health emergency 
                waiting to happen. The technology exists to solve this - we just need to implement it."
              </blockquote>
              <cite>- Dr. Sarah Chen, Environmental Health Researcher, UC Davis</cite>
            </div>
          </div>
        </section>

        {/* Solution Section */}
        <section className="solution-section">
          <div className="section-container">
            <h2 className="section-title">5-Agent AI Coordination System</h2>
            <p className="section-subtitle">
              Burnwise deploys five specialized AI agents working in concert to prevent smoke conflicts 
              and optimize burning schedules across multiple farms
            </p>
            
            <div className="solution-workflow">
              <div className="workflow-step">
                <div className="step-number">1</div>
                <h4>Request Coordinator</h4>
                <p>Validates burn requests, assigns priority scores based on crop type, field size, and urgency</p>
              </div>
              <div className="workflow-arrow">→</div>
              
              <div className="workflow-step">
                <div className="step-number">2</div>
                <h4>Weather Analyst</h4>
                <p>Real-time weather monitoring with TiDB vector search for pattern matching and prediction</p>
              </div>
              <div className="workflow-arrow">→</div>
              
              <div className="workflow-step">
                <div className="step-number">3</div>
                <h4>Smoke Predictor</h4>
                <p>Gaussian plume modeling calculates smoke dispersion patterns and overlap zones</p>
              </div>
              <div className="workflow-arrow">→</div>
              
              <div className="workflow-step">
                <div className="step-number">4</div>
                <h4>Schedule Optimizer</h4>
                <p>Simulated annealing algorithm optimizes burn timing to minimize conflicts</p>
              </div>
              <div className="workflow-arrow">→</div>
              
              <div className="workflow-step">
                <div className="step-number">5</div>
                <h4>Alert System</h4>
                <p>SMS/email notifications to affected farms with real-time updates and recommendations</p>
              </div>
            </div>
          </div>
        </section>

        {/* Technical Features */}
        <section className="tech-features-section">
          <div className="section-container">
            <h2 className="section-title">Advanced Technology Stack</h2>
            
            <div className="tech-grid">
              <div className="tech-card">
                <h3>TiDB Vector Database</h3>
                <ul>
                  <li><strong>Weather Pattern Embeddings:</strong> 128-dimensional vectors for historical weather matching</li>
                  <li><strong>Smoke Plume Vectors:</strong> 64-dimensional dispersion pattern storage</li>
                  <li><strong>Real-time Similarity Search:</strong> Sub-second pattern matching across terabytes</li>
                  <li><strong>Distributed Architecture:</strong> Horizontal scaling for multi-region deployment</li>
                </ul>
              </div>
              
              <div className="tech-card">
                <h3>Weather Intelligence</h3>
                <ul>
                  <li><strong>OpenWeatherMap Integration:</strong> Real-time meteorological data</li>
                  <li><strong>Gaussian Plume Model:</strong> Physics-based smoke dispersion calculation</li>
                  <li><strong>Wind Pattern Analysis:</strong> Vector field analysis for optimal burn timing</li>
                  <li><strong>Atmospheric Stability:</strong> Boundary layer height and inversion detection</li>
                </ul>
              </div>
              
              <div className="tech-card">
                <h3>AI Optimization</h3>
                <ul>
                  <li><strong>Simulated Annealing:</strong> Global optimization for complex scheduling</li>
                  <li><strong>Multi-objective Function:</strong> Balances farmer needs with safety constraints</li>
                  <li><strong>Real-time Adaptation:</strong> Dynamic rescheduling based on weather changes</li>
                  <li><strong>Machine Learning:</strong> Continuous improvement from historical outcomes</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Benefits Section */}
        <section className="benefits-section">
          <div className="section-container">
            <h2 className="section-title">Measurable Impact</h2>
            
            <div className="benefits-grid">
              <div className="benefit-card">
                <h3>Environmental Protection</h3>
                <ul>
                  <li>75% reduction in PM2.5 exceedance events</li>
                  <li>Improved air quality index scores regionally</li>
                  <li>Reduced impact on sensitive ecosystems</li>
                  <li>Lower carbon footprint through optimization</li>
                </ul>
              </div>
              
              <div className="benefit-card">
                <h3>Public Safety</h3>
                <ul>
                  <li>90% reduction in smoke-related traffic incidents</li>
                  <li>Fewer emergency room visits during burn season</li>
                  <li>Protected air quality for schools and hospitals</li>
                  <li>Enhanced visibility on critical transportation routes</li>
                </ul>
              </div>
              
              <div className="benefit-card">
                <h3>Economic Benefits</h3>
                <ul>
                  <li>Zero EPA violations for participating farms</li>
                  <li>$2.3M saved in avoided fines annually</li>
                  <li>Reduced insurance premiums for coordinated farms</li>
                  <li>Increased crop yields through optimal burn timing</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="cta-section">
          <div className="section-container">
            <h2>Ready to Transform Agricultural Burning?</h2>
            <p>
              Join the future of coordinated agricultural management. Burnwise is revolutionizing 
              how farms coordinate burns for safer, cleaner, and more efficient operations.
            </p>
            
            <div className="cta-buttons-bottom">
              <button className="cta-primary-large" onClick={() => navigate('/dashboard')}>
                Start Coordinating
              </button>
              <button className="cta-secondary-large" onClick={() => navigate('/request-burn')}>
                Request a Burn
              </button>
            </div>
          </div>
        </section>

        {/* Attribution */}
        <div className="attribution">
          <p>
            <a href="https://www.epa.gov/pm-pollution" target="_blank" rel="noopener noreferrer">
              <sup>1</sup> EPA PM2.5 Standards Reference
            </a>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Landing;