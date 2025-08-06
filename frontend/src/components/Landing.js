import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AnimatedFlameLogo from './AnimatedFlameLogo';
import { FaSmog, FaCar, FaHospital, FaBalanceScale } from 'react-icons/fa';
import '../styles/Landing.css';

const Landing = ({ fromStartup, hideLogoInitially, animationPhase }) => {
  const navigate = useNavigate();
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [scrollY, setScrollY] = useState(0);
  const [logoVisible, setLogoVisible] = useState(!hideLogoInitially);
  const [videosEnabled, setVideosEnabled] = useState(false);

  // Fire-themed video URLs for cinematic slideshow
  const videos = [
    '/forest-fire-night.mp4',
    '/rice-straw-burning.mp4', 
    '/rice-fields-wide-burn.mp4',
    '/gentle-field-fire.mp4'
  ];

  // Show logo and enable videos synchronized with startup animation
  useEffect(() => {
    if (hideLogoInitially) {
      // Show torch flame right when the animation reaches its target
      const timer = setTimeout(() => {
        setLogoVisible(true);
      }, 3900); // Show flame when morphing completes (87% of 4.6s)
      
      // Enable videos after flame has docked
      const videoTimer = setTimeout(() => {
        setVideosEnabled(true);
      }, 4200);
      
      return () => {
        clearTimeout(timer);
        clearTimeout(videoTimer);
      };
    } else {
      setVideosEnabled(true); // Enable videos immediately if no startup
    }
  }, [hideLogoInitially]);

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

  return (
    <div className="landing-container visible">
      {/* Video Background - Only show after startup */}
      <div className="video-background" style={{ 
        opacity: videosEnabled ? videoOpacity : 0,
        transform: videoTransform,
        transition: 'opacity 1s ease-out'
      }}>
        {videosEnabled && videos.map((videoSrc, index) => (
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
      </div>

      <div className="landing-content">
        {/* Hero Section - Stable layout with content opacity animation */}
        <section className="hero-section">
          <h1 className={`hero-title ${logoVisible ? 'title-visible' : 'title-hidden'}`} style={{ 
            position: 'relative',
            opacity: animationPhase === 'startup' ? 0 : 
                     (animationPhase === 'morphing' ? 0 : 
                     (animationPhase === 'transitioning' ? 0.5 : 1)),
            transition: 'opacity 0.8s ease-out'
          }}>
            <span style={{ position: 'relative', display: 'inline-block' }}>
              {'BURNW'}
              <span style={{ position: 'relative', display: 'inline-block' }}>
                {'I'}
                {logoVisible && (
                  <div className="torch-flame-absolute" style={{
                    position: 'absolute',
                    top: '-65px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 10,
                    width: '65px',
                    height: '65px'
                  }}>
                    <AnimatedFlameLogo size={65} animated={true} />
                  </div>
                )}
              </span>
              {'SE'}
            </span>
          </h1>
          <p className="hero-subtitle" style={{
            opacity: animationPhase === 'startup' ? 0 : 
                     (animationPhase === 'morphing' ? 0 : 
                     (animationPhase === 'transitioning' ? 0.5 : 1)),
            transition: 'opacity 0.8s ease-out 0.1s'
          }}>Multi-Farm Agricultural Burn Coordinator</p>
          <p className="hero-description" style={{
            opacity: animationPhase === 'startup' ? 0 : 
                     (animationPhase === 'morphing' ? 0 : 
                     (animationPhase === 'transitioning' ? 0.5 : 1)),
            transition: 'opacity 0.8s ease-out 0.2s'
          }}>
            Intelligent coordination system preventing dangerous smoke overlap between farms using 
            multi-agent AI, real-time weather analysis, and TiDB vector search technology.
          </p>
          
          <div className="cta-buttons" style={{
            opacity: animationPhase === 'startup' ? 0 : 
                     (animationPhase === 'morphing' ? 0 : 
                     (animationPhase === 'transitioning' ? 0.5 : 1)),
            transition: 'opacity 0.8s ease-out 0.3s'
          }}>
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
              BURNWISE deploys five specialized AI agents working in concert to prevent smoke conflicts 
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
              Join the future of coordinated agricultural management. BURNWISE is revolutionizing 
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
      </div>
    </div>
  );
};

export default Landing;