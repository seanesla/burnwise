import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BurnwiseLogoPotraceExact from './BurnwiseLogoPotraceExact';
import BurnwiseCinematicBootup from './BurnwiseCinematicBootup';
import References from './References';
import '../styles/Landing.css';

const Landing = () => {
  const navigate = useNavigate();
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isFirstVisit, setIsFirstVisit] = useState(false);
  const [showCinematicBootup, setShowCinematicBootup] = useState(false);
  const [videoOpacity, setVideoOpacity] = useState(1);
  const [videoTransform, setVideoTransform] = useState(0);

  const references = [
    {
      authors: "U.S. Environmental Protection Agency",
      title: "Agriculture and Air Quality",
      source: "EPA.gov",
      date: "2024",
      url: "https://www.epa.gov/agriculture/agriculture-and-air-quality"
    },
    {
      authors: "Vaidyanathan, A., et al.",
      title: "Review of agricultural biomass burning and its impact on air quality in the continental United States of America",
      source: "Environment International",
      date: "2024",
      url: "https://www.sciencedirect.com/science/article/pii/S2666765724000644"
    },
    {
      authors: "Natural Resources Conservation Service",
      title: "AAQTF Agricultural Burning Policy Recommendations",
      source: "USDA NRCS",
      date: "2024",
      url: "https://www.nrcs.usda.gov/conservation-basics/natural-resource-concerns/air/usda-agricultural-air-quality-task-force"
    },
    {
      authors: "Toor, N.S., et al.",
      title: "Large-scale agricultural burning and cardiorespiratory emergency department visits in the U.S. state of Kansas",
      source: "Environmental Research: Health",
      date: "2023",
      url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC10440224/"
    },
    {
      authors: "Climate & Clean Air Coalition",
      title: "Open agricultural burning",
      source: "CCAC",
      date: "2024",
      url: "https://www.ccacoalition.org/projects/open-agricultural-burning"
    },
    {
      authors: "United Nations Environment Programme",
      title: "Toxic blaze: the true cost of crop burning",
      source: "UNEP",
      date: "2024",
      url: "https://www.unep.org/news-and-stories/story/toxic-blaze-true-cost-crop-burning"
    }
  ];

  const videos = [
    '/videos/20250804_1457_Gentle Field Fire_remix_01k1vhe2g0ehtv8f07qrgtbmky.mp4',
    '/videos/vecteezy_4k-ultra-high-definition-night-footage-of-forest-fire_67967262.mp4',
    '/videos/vecteezy_rice-straw-burning_28573223.mp4',
    '/videos/vecteezy_the-rice-fields-burned-over-a-wide-area_33118645.mov'
  ];

  // Check if this is first visit for cinematic bootup
  useEffect(() => {
    const hasVisited = localStorage.getItem('burnwise-visited');
    if (!hasVisited) {
      setIsFirstVisit(true);
      setShowCinematicBootup(true);
      localStorage.setItem('burnwise-visited', 'true');
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentVideoIndex((prevIndex) => (prevIndex + 1) % videos.length);
        setIsTransitioning(false);
      }, 500); // Half of the transition duration
    }, 8000); // Change video every 8 seconds

    return () => clearInterval(interval);
  }, [videos.length]);

  // Scroll-based video fade effect
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const heroHeight = window.innerHeight;
      const fadeStartPoint = 0; // Start fading immediately
      const fadeEndPoint = heroHeight * 0.3; // Fully faded at 30% of hero height
      
      // Calculate opacity (1 at top, 0 at fadeEndPoint)
      let opacity = 1;
      if (scrollY > fadeStartPoint) {
        opacity = Math.max(0, 1 - ((scrollY - fadeStartPoint) / (fadeEndPoint - fadeStartPoint)));
      }
      
      // Calculate parallax transform with bounds
      const parallaxAmount = Math.min(scrollY * 0.5, heroHeight * 0.5); // Cap parallax movement
      
      setVideoOpacity(opacity);
      setVideoTransform(parallaxAmount);
    };

    // Debounced scroll handler for smoother performance
    let scrollTimeout;
    const scrollListener = () => {
      // Immediate update for visual feedback
      handleScroll();
      
      // Clear any pending timeout
      clearTimeout(scrollTimeout);
      
      // Debounce final update
      scrollTimeout = setTimeout(() => {
        handleScroll();
      }, 10);
    };

    window.addEventListener('scroll', scrollListener, { passive: true });
    handleScroll(); // Call once to set initial state

    return () => {
      window.removeEventListener('scroll', scrollListener);
      clearTimeout(scrollTimeout);
    };
  }, []);

  const handleCinematicBootupComplete = () => {
    // Cinematic component handles its own fade-out
    setShowCinematicBootup(false);
  };

  // Dev button to test cinematic bootup anytime
  const triggerCinematicBootup = () => {
    setShowCinematicBootup(true);
  };

  return (
    <div className="landing-container">
      <div 
        className="video-background"
        style={{
          opacity: videoOpacity,
          transform: `translateY(${videoTransform}px)`,
          // Remove transitions for smoother scroll performance
          willChange: 'opacity, transform'
        }}
      >
        <div className="video-overlay"></div>
        {videos.map((video, index) => (
          <video
            key={index}
            className={`background-video ${index === currentVideoIndex ? 'active' : ''} ${isTransitioning && index === currentVideoIndex ? 'transitioning' : ''}`}
            autoPlay
            muted
            loop
            playsInline
          >
            <source src={video} type="video/mp4" />
          </video>
        ))}
      </div>

      <div className="landing-content">
        <div className="hero-section">
          <div className="hero-logo" style={{ 
            opacity: showCinematicBootup ? 0 : 1,
            transition: 'opacity 0.3s ease-in-out'
          }}>
            <BurnwiseLogoPotraceExact 
              size={window.innerWidth < 768 ? 140 : 180} 
              animated={true} 
            />
          </div>
          <h1 className="hero-title">BURNWISE</h1>
          <p className="hero-subtitle">
            Multi-Farm Agricultural Burn Coordination System
          </p>
          <p className="hero-description">
            Powered by AI-driven agents and advanced weather modeling to coordinate controlled burns 
            safely across multiple farms, preventing smoke conflicts and ensuring agricultural efficiency.
          </p>
          
          <div className="cta-buttons">
            <button 
              className="cta-primary" 
              onClick={() => navigate('/map')}
            >
              View Live Map
            </button>
            <button 
              className="cta-secondary" 
              onClick={() => navigate('/dashboard')}
            >
              Explore Dashboard
            </button>
          </div>
        </div>

        {/* Problem Section */}
        <section className="problem-section">
          <div className="section-container">
            <h2 className="section-title">The Challenge</h2>
            <div className="problem-grid">
              <div className="problem-card">
                <div className="problem-icon">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2L2 7V17C2 19.76 4.24 22 7 22H17C19.76 22 22 19.76 22 17V7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M12 11V17M12 7V8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </div>
                <h3>20% of U.S. PM2.5 Emissions</h3>
                <p>
                  Agricultural field burning produces approximately 67,310 tons of PM2.5 annually, 
                  accounting for one-fifth of total U.S. PM2.5 emissions<sup>1</sup>. This particulate 
                  matter penetrates deep into lungs and bloodstream, causing severe health impacts.
                </p>
              </div>
              <div className="problem-card">
                <div className="problem-icon">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M21 10C21 17 12 23 12 23S3 17 3 10C3 5.58172 6.58172 2 11 2C15.4183 2 19 5.58172 19 10" stroke="currentColor" strokeWidth="2"/>
                    <circle cx="12" cy="10" r="3" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                </div>
                <h3>31 Million Acres Affected</h3>
                <p>
                  Over 8.9 million acres of cropland are burned annually in the U.S., plus 18 million 
                  acres of grazing land<sup>2</sup>. Smoke travels far beyond burn sites, affecting air 
                  quality in neighboring communities and farms.
                </p>
              </div>
              <div className="problem-card">
                <div className="problem-icon">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2L20 7V13C20 18 16 21 12 22C8 21 4 18 4 13V7L12 2Z" stroke="currentColor" strokeWidth="2"/>
                    <path d="M9 12L11 14L15 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <h3>7 Million Deaths Annually</h3>
                <p>
                  Air pollution from agricultural burning contributes to 7 million premature deaths 
                  globally each year, including 650,000 children<sup>6</sup>. Studies link burn seasons 
                  directly to increased respiratory emergency visits.
                </p>
              </div>
            </div>
            <div className="problem-highlight">
              <blockquote>
                "Smoke exposure during prescribed burning months is associated with increased asthma 
                emergency department visits on the same day. Despite localized burns, smoke can travel 
                great distances, affecting air quality in regions far from the original burn sites."
                <cite>— Environmental Research: Health, 2023<sup>4</sup></cite>
              </blockquote>
            </div>
          </div>
        </section>

        {/* Solution Section */}
        <section className="solution-section">
          <div className="section-container">
            <h2 className="section-title">The BURNWISE Solution</h2>
            <p className="section-subtitle">
              A comprehensive multi-agent system that transforms agricultural burn coordination from 
              reactive conflict management to proactive optimization
            </p>
            
            <div className="solution-workflow">
              <div className="workflow-step">
                <div className="step-number">1</div>
                <h4>Request Validation</h4>
                <p>Farmers submit burn requests with field details, acreage, and preferred time windows</p>
              </div>
              <div className="workflow-arrow">→</div>
              <div className="workflow-step">
                <div className="step-number">2</div>
                <h4>Weather Analysis</h4>
                <p>Real-time weather data and pattern recognition using TiDB vector search</p>
              </div>
              <div className="workflow-arrow">→</div>
              <div className="workflow-step">
                <div className="step-number">3</div>
                <h4>Smoke Prediction</h4>
                <p>Gaussian plume modeling calculates dispersion patterns and PM2.5 concentrations</p>
              </div>
              <div className="workflow-arrow">→</div>
              <div className="workflow-step">
                <div className="step-number">4</div>
                <h4>Schedule Optimization</h4>
                <p>Simulated annealing algorithm finds optimal burn windows minimizing conflicts</p>
              </div>
              <div className="workflow-arrow">→</div>
              <div className="workflow-step">
                <div className="step-number">5</div>
                <h4>Alert Distribution</h4>
                <p>Automated notifications to farmers and affected communities via SMS and dashboard</p>
              </div>
            </div>
          </div>
        </section>

        {/* Technical Features Section */}
        <section className="tech-features-section">
          <div className="section-container">
            <h2 className="section-title">Advanced Technical Architecture</h2>
            <div className="tech-grid">
              <div className="tech-card">
                <h3>5-Agent AI System</h3>
                <ul>
                  <li><strong>Coordinator Agent:</strong> Validates requests and assigns priority scores</li>
                  <li><strong>Weather Agent:</strong> Fetches real-time data from OpenWeatherMap</li>
                  <li><strong>Predictor Agent:</strong> Calculates smoke dispersion patterns</li>
                  <li><strong>Optimizer Agent:</strong> Generates conflict-free schedules</li>
                  <li><strong>Alert Agent:</strong> Manages notifications via Twilio</li>
                </ul>
              </div>
              <div className="tech-card">
                <h3>TiDB Vector Database</h3>
                <ul>
                  <li>128-dimensional weather pattern embeddings</li>
                  <li>64-dimensional smoke plume vectors</li>
                  <li>Lightning-fast similarity search</li>
                  <li>Historical pattern matching</li>
                  <li>Scalable cloud-native architecture</li>
                </ul>
              </div>
              <div className="tech-card">
                <h3>Scientific Modeling</h3>
                <ul>
                  <li>Gaussian plume dispersion calculations</li>
                  <li>PM2.5 concentration predictions</li>
                  <li>Wind pattern analysis</li>
                  <li>Atmospheric stability factors</li>
                  <li>Terrain influence modeling</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Benefits Section */}
        <section className="benefits-section">
          <div className="section-container">
            <h2 className="section-title">Benefits for Every Stakeholder</h2>
            <div className="benefits-grid">
              <div className="benefit-card">
                <h3>For Farmers</h3>
                <ul>
                  <li>Guaranteed burn windows without conflicts</li>
                  <li>Reduced liability from smoke damage</li>
                  <li>Optimized scheduling around weather</li>
                  <li>Real-time alerts and updates</li>
                  <li>Historical data for planning</li>
                </ul>
              </div>
              <div className="benefit-card">
                <h3>For Communities</h3>
                <ul>
                  <li>Advance warning of smoke events</li>
                  <li>Reduced air quality impacts</li>
                  <li>Better health outcomes</li>
                  <li>Transparent burn schedules</li>
                  <li>Emergency planning support</li>
                </ul>
              </div>
              <div className="benefit-card">
                <h3>For Regulators</h3>
                <ul>
                  <li>Automated compliance monitoring</li>
                  <li>Data-driven policy insights</li>
                  <li>Reduced emergency responses</li>
                  <li>Environmental impact tracking</li>
                  <li>Public health protection</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="cta-section">
          <div className="section-container">
            <h2>Ready to Transform Agricultural Burn Management?</h2>
            <p>
              Join the future of coordinated agricultural burning. Protect your community, 
              optimize your operations, and ensure compliance with smart burn scheduling.
            </p>
            <div className="cta-buttons-bottom">
              <button className="cta-primary-large" onClick={() => navigate('/map')}>
                Start Coordinating Burns
              </button>
              <button className="cta-secondary-large" onClick={() => navigate('/dashboard')}>
                View Analytics Dashboard
              </button>
            </div>
          </div>
        </section>

        <div className="features-section">
          <div className="feature">
            <div className="feature-icon">
            <svg className="feature-svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 2V14C7.79 14.71 6 16.64 6 19C6 21.76 8.24 24 11 24C13.76 24 16 21.76 16 19C16 16.64 14.21 14.71 12 14V2C12 1.45 11.55 1 11 1C10.45 1 10 1.45 10 2Z" fill="currentColor"/>
              <path d="M14 5V12.17C15.48 13.03 16.5 14.72 16.5 16.5C16.5 19.26 14.26 21.5 11.5 21.5C8.74 21.5 6.5 19.26 6.5 16.5C6.5 14.72 7.52 13.03 9 12.17V5H14Z" fill="currentColor" opacity="0.3"/>
            </svg>
          </div>
            <h3>Real-time Weather Analysis</h3>
            <p>Advanced weather pattern recognition and smoke dispersion modeling</p>
          </div>
          <div className="feature">
            <div className="feature-icon">
            <svg className="feature-svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="6" y="11" width="12" height="10" rx="2" fill="currentColor" opacity="0.3"/>
              <rect x="9" y="2" width="6" height="5" rx="1" fill="currentColor"/>
              <path d="M8 8H16M4 16H5M19 16H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="9" cy="15" r="1" fill="currentColor"/>
              <circle cx="15" cy="15" r="1" fill="currentColor"/>
            </svg>
          </div>
            <h3>5-Agent AI System</h3>
            <p>Coordinator, Weather, Predictor, Optimizer, and Alert agents working in harmony</p>
          </div>
          <div className="feature">
            <div className="feature-icon">
            <svg className="feature-svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.3"/>
              <circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="2" opacity="0.5"/>
              <circle cx="12" cy="12" r="3" fill="currentColor"/>
            </svg>
          </div>
            <h3>Conflict Prevention</h3>
            <p>Vector-based smoke prediction prevents inter-farm conflicts</p>
          </div>
          <div className="feature">
            <div className="feature-icon">
            <svg className="feature-svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="4" y="14" width="4" height="6" fill="currentColor" opacity="0.3"/>
              <rect x="10" y="9" width="4" height="11" fill="currentColor" opacity="0.5"/>
              <rect x="16" y="4" width="4" height="16" fill="currentColor"/>
            </svg>
          </div>
            <h3>TiDB Vector Search</h3>
            <p>Lightning-fast pattern matching for weather and smoke predictions</p>
          </div>
        </div>

        <div className="attribution">
          <a href="https://www.vecteezy.com/free-videos/farm-fire" target="_blank" rel="noopener noreferrer">
            Farm Fire Stock Videos by Vecteezy
          </a>
        </div>
      </div>

      {/* References */}
      <References references={references} />

      {/* Cinematic bootup overlay */}
      {showCinematicBootup && (
        <BurnwiseCinematicBootup 
          onComplete={handleCinematicBootupComplete}
        />
      )}

      {/* Dev button for testing cinematic bootup */}
      <button 
        onClick={triggerCinematicBootup}
        style={{
          position: 'fixed',
          top: '10px',
          right: '10px',
          padding: '8px 12px',
          background: 'rgba(255, 69, 0, 0.8)',
          border: 'none',
          borderRadius: '4px',
          color: 'white',
          fontSize: '12px',
          cursor: 'pointer',
          zIndex: 1000,
          opacity: 0.7
        }}
      >
        Test Cinematic Bootup
      </button>
    </div>
  );
};

export default Landing;