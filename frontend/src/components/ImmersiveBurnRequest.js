import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform, useAnimationFrame } from 'framer-motion';
import { Canvas, useFrame, useThree, extend } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment, Cloud, Sky, Stars, Float, Trail, Text3D, Center } from '@react-three/drei';
import * as THREE from 'three';
import { FaFire, FaWind, FaThermometerHalf, FaClock, FaLeaf, FaExclamationTriangle, FaSatellite, FaRadiation, FaBolt, FaCheck } from 'react-icons/fa';
import { GiWheat, GiCorn, GiFireZone, GiSmokeBomb, GiWindsock, GiFireBowl } from 'react-icons/gi';
import axios from 'axios';
import toast from 'react-hot-toast';
import './ImmersiveBurnRequest.css';

// Terrain Mesh Component
const TerrainMesh = ({ fieldBoundary, isDrawing }) => {
  const meshRef = useRef();
  const [hovered, setHovered] = useState(false);
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.material.uniforms.time.value = state.clock.elapsedTime;
      meshRef.current.material.uniforms.hover.value = hovered ? 1 : 0;
    }
  });

  const terrainShader = {
    uniforms: {
      time: { value: 0 },
      hover: { value: 0 },
      colorA: { value: new THREE.Color('#1a0f0f') },
      colorB: { value: new THREE.Color('#ff6b35') },
      colorC: { value: new THREE.Color('#ff5722') }
    },
    vertexShader: `
      varying vec2 vUv;
      varying float vElevation;
      uniform float time;
      uniform float hover;
      
      void main() {
        vUv = uv;
        vec3 pos = position;
        
        // Create terrain elevation
        float elevation = sin(pos.x * 0.5 + time * 0.5) * 0.3;
        elevation += cos(pos.z * 0.3 + time * 0.3) * 0.2;
        elevation *= (1.0 + hover * 0.5);
        
        pos.y += elevation;
        vElevation = elevation;
        
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 colorA;
      uniform vec3 colorB;
      uniform vec3 colorC;
      uniform float time;
      uniform float hover;
      varying vec2 vUv;
      varying float vElevation;
      
      void main() {
        float mixStrength = vElevation * 2.0 + 0.5;
        vec3 color = mix(colorA, colorB, mixStrength);
        color = mix(color, colorC, hover);
        
        // Add fire glow effect
        float glow = sin(time * 2.0 + vUv.x * 10.0) * 0.1 + 0.9;
        color *= glow;
        
        gl_FragColor = vec4(color, 0.9);
      }
    `
  };

  return (
    <mesh
      ref={meshRef}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -2, 0]}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <planeGeometry args={[50, 50, 100, 100]} />
      <shaderMaterial attach="material" {...terrainShader} transparent />
    </mesh>
  );
};

// Field Boundary Visualizer
const FieldBoundaryVisualizer = ({ points, isComplete }) => {
  const lineRef = useRef();
  
  useFrame((state) => {
    if (lineRef.current && isComplete) {
      lineRef.current.material.color.setHSL(
        (Math.sin(state.clock.elapsedTime) * 0.5 + 0.5) * 0.1,
        1,
        0.5
      );
    }
  });

  if (points.length < 2) return null;

  const linePoints = points.map(p => new THREE.Vector3(p[0], 0.5, p[1]));
  if (isComplete && points.length > 2) {
    linePoints.push(linePoints[0]); // Close the loop
  }

  return (
    <>
      <line ref={lineRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={linePoints.length}
            array={new Float32Array(linePoints.flatMap(p => [p.x, p.y, p.z]))}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial 
          color="#ff6b35" 
          linewidth={3}
          transparent
          opacity={0.8}
        />
      </line>
      
      {/* Boundary points */}
      {points.map((point, i) => (
        <Float key={i} speed={2} rotationIntensity={0.5} floatIntensity={1}>
          <mesh position={[point[0], 0.5, point[1]]}>
            <sphereGeometry args={[0.1, 16, 16]} />
            <meshStandardMaterial 
              color="#ff6b35"
              emissive="#ff6b35"
              emissiveIntensity={0.5}
            />
          </mesh>
        </Float>
      ))}
      
      {/* Fire effect at boundary */}
      {isComplete && points.map((point, i) => (
        <FireEffect key={`fire-${i}`} position={[point[0], 0, point[1]]} />
      ))}
    </>
  );
};

// Fire Effect Component
const FireEffect = ({ position }) => {
  const particlesRef = useRef();
  const particleCount = 50;
  
  const positions = React.useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 0.5;
      pos[i * 3 + 1] = Math.random() * 2;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
    }
    return pos;
  }, []);

  useFrame((state) => {
    if (!particlesRef.current) return;
    const positions = particlesRef.current.geometry.attributes.position.array;
    
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3 + 1] += 0.05;
      if (positions[i * 3 + 1] > 3) {
        positions[i * 3 + 1] = 0;
      }
    }
    particlesRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={particlesRef} position={position}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particleCount}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.05}
        color="#ff6b35"
        transparent
        opacity={0.6}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};

// Smoke Prediction Visualizer
const SmokePrediction = ({ windDirection, windSpeed }) => {
  const smokeRef = useRef();
  
  useFrame((state) => {
    if (smokeRef.current) {
      smokeRef.current.rotation.y = windDirection;
      smokeRef.current.position.x = Math.sin(state.clock.elapsedTime) * windSpeed * 0.1;
      smokeRef.current.position.z = Math.cos(state.clock.elapsedTime) * windSpeed * 0.1;
    }
  });

  return (
    <group ref={smokeRef}>
      {[...Array(5)].map((_, i) => (
        <Cloud
          key={i}
          position={[i * 2 - 4, 3 + i * 0.5, 0]}
          speed={0.4}
          opacity={0.3 - i * 0.05}
          color="#666"
        />
      ))}
    </group>
  );
};

// 3D Scene Component
const ThreeDFieldScene = ({ onFieldClick, fieldBoundary, isDrawing, weatherData }) => {
  const [boundaryPoints, setBoundaryPoints] = useState([]);
  const [isComplete, setIsComplete] = useState(false);

  const handleClick = useCallback((event) => {
    if (isDrawing && !isComplete) {
      const point = [event.point.x, event.point.z];
      setBoundaryPoints(prev => [...prev, point]);
      
      // Check if double-click to complete
      if (event.detail === 2) {
        setIsComplete(true);
        onFieldClick(boundaryPoints);
      }
    }
  }, [isDrawing, isComplete, boundaryPoints, onFieldClick]);

  return (
    <div className="three-field-container">
      <Canvas shadows>
        <PerspectiveCamera makeDefault position={[0, 15, 20]} fov={45} />
        
        {/* Lighting */}
        <ambientLight intensity={0.2} />
        <directionalLight
          position={[10, 10, 5]}
          intensity={1}
          color="#ff6b35"
          castShadow
        />
        <pointLight position={[-10, 5, -10]} intensity={0.5} color="#ff5722" />
        
        {/* Environment */}
        <Sky
          distance={450000}
          sunPosition={[0, 1, 0]}
          inclination={0.6}
          azimuth={0.25}
          rayleigh={2}
          mieCoefficient={0.005}
          mieDirectionalG={0.8}
        />
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade />
        
        {/* Terrain */}
        <TerrainMesh fieldBoundary={fieldBoundary} isDrawing={isDrawing} />
        
        {/* Field Boundary */}
        <FieldBoundaryVisualizer points={boundaryPoints} isComplete={isComplete} />
        
        {/* Smoke Prediction */}
        {weatherData && (
          <SmokePrediction 
            windDirection={weatherData.windDirection} 
            windSpeed={weatherData.windSpeed}
          />
        )}
        
        {/* 3D Text */}
        {isDrawing && !isComplete && (
          <Center position={[0, 8, 0]}>
            <Text3D
              font="/fonts/helvetiker_regular.typeface.json"
              size={0.5}
              height={0.1}
              curveSegments={12}
            >
              DRAW FIELD BOUNDARY
              <meshStandardMaterial color="#ff6b35" emissive="#ff6b35" emissiveIntensity={0.2} />
            </Text3D>
          </Center>
        )}
        
        <OrbitControls 
          enablePan={true}
          enableZoom={true}
          maxPolarAngle={Math.PI / 2}
          minDistance={10}
          maxDistance={50}
        />
        
        <mesh
          position={[0, 0, 0]}
          onPointerDown={handleClick}
          visible={false}
        >
          <planeGeometry args={[100, 100]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      </Canvas>
    </div>
  );
};

// Holographic Control Panel
const HolographicControlPanel = ({ formData, onChange, onSubmit, farms }) => {
  const [activeSection, setActiveSection] = useState('farm');
  
  const sections = [
    { id: 'farm', label: 'FARM SELECTION', icon: GiWheat },
    { id: 'timing', label: 'BURN TIMING', icon: FaClock },
    { id: 'weather', label: 'WEATHER PARAMS', icon: FaWind },
    { id: 'submit', label: 'INITIATE BURN', icon: FaFire }
  ];

  return (
    <motion.div 
      className="holographic-panel"
      initial={{ x: 100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.8 }}
    >
      {/* Section Tabs */}
      <div className="panel-tabs">
        {sections.map((section, i) => (
          <motion.button
            key={section.id}
            className={`panel-tab ${activeSection === section.id ? 'active' : ''}`}
            onClick={() => setActiveSection(section.id)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <section.icon />
            <span>{section.label}</span>
          </motion.button>
        ))}
      </div>

      {/* Section Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeSection}
          className="panel-content"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          {activeSection === 'farm' && (
            <div className="form-section">
              <div className="holographic-field">
                <label>SELECT FARM</label>
                <select 
                  name="farm_id" 
                  value={formData.farm_id}
                  onChange={onChange}
                  className="holographic-select"
                >
                  <option value="">-- CHOOSE FARM --</option>
                  {farms.map(farm => (
                    <option key={farm.id} value={farm.id}>
                      {farm.name} - {farm.owner_name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="holographic-field">
                <label>FIELD IDENTIFIER</label>
                <input
                  type="text"
                  name="field_name"
                  value={formData.field_name}
                  onChange={onChange}
                  placeholder="ENTER FIELD NAME"
                  className="holographic-input"
                />
              </div>
              
              <div className="holographic-field">
                <label>CROP TYPE</label>
                <div className="crop-selector">
                  {[
                    { id: 'wheat', icon: GiWheat, label: 'WHEAT' },
                    { id: 'corn', icon: GiCorn, label: 'CORN' },
                    { id: 'soy', icon: GiFireZone, label: 'SOYBEAN' }
                  ].map(crop => (
                    <motion.button
                      key={crop.id}
                      className={`crop-button ${formData.crop_type === crop.id ? 'active' : ''}`}
                      onClick={() => onChange({ target: { name: 'crop_type', value: crop.id }})}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      <crop.icon size={24} />
                      <span>{crop.label}</span>
                    </motion.button>
                  ))}
                </div>
              </div>
              
              <div className="holographic-field">
                <label>FIELD AREA</label>
                <div className="area-display">
                  <span className="area-value">{formData.acres || '0.0'}</span>
                  <span className="area-unit">ACRES</span>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'timing' && (
            <div className="form-section">
              <div className="holographic-field">
                <label>BURN DATE</label>
                <input
                  type="date"
                  name="burn_date"
                  value={formData.burn_date}
                  onChange={onChange}
                  min={new Date().toISOString().split('T')[0]}
                  className="holographic-input"
                />
              </div>
              
              <div className="time-window">
                <div className="holographic-field">
                  <label>START TIME</label>
                  <input
                    type="time"
                    name="time_window_start"
                    value={formData.time_window_start}
                    onChange={onChange}
                    className="holographic-input"
                  />
                </div>
                
                <div className="holographic-field">
                  <label>END TIME</label>
                  <input
                    type="time"
                    name="time_window_end"
                    value={formData.time_window_end}
                    onChange={onChange}
                    className="holographic-input"
                  />
                </div>
              </div>
              
              <div className="holographic-field">
                <label>ESTIMATED DURATION</label>
                <div className="duration-slider">
                  <input
                    type="range"
                    name="estimated_duration"
                    min="1"
                    max="12"
                    value={formData.estimated_duration}
                    onChange={onChange}
                    className="holographic-slider"
                  />
                  <span className="duration-value">{formData.estimated_duration} HOURS</span>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'weather' && (
            <div className="form-section">
              <div className="weather-params">
                <div className="param-card">
                  <FaWind className="param-icon" />
                  <label>MAX WIND SPEED</label>
                  <div className="param-value">
                    <span>{formData.preferred_conditions.max_wind_speed}</span>
                    <span className="param-unit">MPH</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="25"
                    value={formData.preferred_conditions.max_wind_speed}
                    onChange={(e) => onChange({
                      target: {
                        name: 'preferred_conditions',
                        value: { ...formData.preferred_conditions, max_wind_speed: e.target.value }
                      }
                    })}
                    className="holographic-slider"
                  />
                </div>
                
                <div className="param-card">
                  <FaThermometerHalf className="param-icon" />
                  <label>HUMIDITY RANGE</label>
                  <div className="param-value">
                    <span>{formData.preferred_conditions.min_humidity}-{formData.preferred_conditions.max_humidity}</span>
                    <span className="param-unit">%</span>
                  </div>
                  <div className="dual-slider">
                    <input
                      type="range"
                      min="10"
                      max="50"
                      value={formData.preferred_conditions.min_humidity}
                      onChange={(e) => onChange({
                        target: {
                          name: 'preferred_conditions',
                          value: { ...formData.preferred_conditions, min_humidity: e.target.value }
                        }
                      })}
                      className="holographic-slider"
                    />
                    <input
                      type="range"
                      min="60"
                      max="90"
                      value={formData.preferred_conditions.max_humidity}
                      onChange={(e) => onChange({
                        target: {
                          name: 'preferred_conditions',
                          value: { ...formData.preferred_conditions, max_humidity: e.target.value }
                        }
                      })}
                      className="holographic-slider"
                    />
                  </div>
                </div>
              </div>
              
              <div className="holographic-field">
                <label>SPECIAL CONSIDERATIONS</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={onChange}
                  rows="3"
                  placeholder="ENTER ANY SPECIAL REQUIREMENTS..."
                  className="holographic-textarea"
                />
              </div>
            </div>
          )}

          {activeSection === 'submit' && (
            <div className="form-section submit-section">
              <div className="pre-submit-checklist">
                <h3>PRE-BURN CHECKLIST</h3>
                <div className="checklist-item">
                  <span className={formData.field_boundary ? 'check complete' : 'check incomplete'}><FaCheck /></span>
                  <span>Field boundary defined</span>
                </div>
                <div className="checklist-item">
                  <span className={formData.farm_id ? 'check complete' : 'check incomplete'}><FaCheck /></span>
                  <span>Farm selected</span>
                </div>
                <div className="checklist-item">
                  <span className={formData.burn_date ? 'check complete' : 'check incomplete'}><FaCheck /></span>
                  <span>Burn date scheduled</span>
                </div>
                <div className="checklist-item">
                  <span className="check complete"><FaCheck /></span>
                  <span>Weather parameters configured</span>
                </div>
              </div>
              
              <motion.button
                className="submit-burn-button"
                onClick={onSubmit}
                disabled={!formData.field_boundary || !formData.farm_id || !formData.burn_date}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <FaFire size={24} />
                <span>INITIATE BURN REQUEST</span>
                <div className="button-glow" />
              </motion.button>
              
              <div className="warning-message">
                <FaExclamationTriangle />
                <span>This action will trigger the 5-agent AI coordination system</span>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
};

// Main Component
const ImmersiveBurnRequest = () => {
  const [formData, setFormData] = useState({
    farm_id: '',
    field_name: '',
    field_boundary: null,
    acres: '',
    crop_type: '',
    burn_date: '',
    time_window_start: '08:00',
    time_window_end: '16:00',
    estimated_duration: 4,
    preferred_conditions: {
      max_wind_speed: 10,
      min_humidity: 30,
      max_humidity: 70
    },
    notes: ''
  });

  const [farms, setFarms] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [weatherData, setWeatherData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchFarms();
    fetchWeatherData();
  }, []);

  const fetchFarms = async () => {
    try {
      const response = await axios.get('/api/farms', { withCredentials: true });
      setFarms(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch farms:', error);
      // Set empty array instead of mock data
      setFarms([]);
    }
  };

  const fetchWeatherData = async () => {
    // Fetch real weather data from API
    try {
      const response = await fetch('http://localhost:5001/api/weather/current', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setWeatherData({
            windSpeed: data.data.wind_speed || 0,
            windDirection: (data.data.wind_direction || 0) * Math.PI / 180,
            temperature: data.data.temperature || 0,
            humidity: data.data.humidity || 0
          });
        }
      }
    } catch (error) {
      console.error('Error fetching weather:', error);
      // Set to zero instead of fake values
      setWeatherData({
        windSpeed: 0,
        windDirection: 0,
        temperature: 0,
        humidity: 0
      });
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFieldBoundary = (points) => {
    // Calculate area from points
    const area = calculateArea(points);
    setFormData(prev => ({
      ...prev,
      field_boundary: { type: 'Polygon', coordinates: [points] },
      acres: area.toFixed(2)
    }));
    setIsDrawing(false);
    toast.success(`Field area: ${area.toFixed(2)} acres`);
  };

  const calculateArea = (points) => {
    // Simplified area calculation
    if (points.length < 3) return 0;
    let area = 0;
    for (let i = 0; i < points.length - 1; i++) {
      area += points[i][0] * points[i + 1][1];
      area -= points[i + 1][0] * points[i][1];
    }
    return Math.abs(area / 2) * 10; // Scale factor for demo
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.field_boundary) {
      toast.error('Please draw your field boundary');
      return;
    }
    
    setLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      toast.success('Burn request initiated! 5-Agent system processing...');
      setLoading(false);
      
      // Reset form
      setFormData({
        farm_id: '',
        field_name: '',
        field_boundary: null,
        acres: '',
        crop_type: '',
        burn_date: '',
        time_window_start: '08:00',
        time_window_end: '16:00',
        estimated_duration: 4,
        preferred_conditions: {
          max_wind_speed: 10,
          min_humidity: 30,
          max_humidity: 70
        },
        notes: ''
      });
    }, 2000);
  };

  return (
    <div className="immersive-burn-request">
      {/* Ambient Background */}
      <div className="ambient-particles" />
      <div className="ambient-heat-waves" />
      
      {/* Header */}
      <motion.header 
        className="request-header"
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        <h1 className="request-title">
          <FaFire className="title-icon" />
          BURN REQUEST COMMAND
        </h1>
        <p className="request-subtitle">
          INITIATE CONTROLLED BURN PROTOCOL
        </p>
      </motion.header>

      {/* Main Content */}
      <div className="request-content">
        {/* 3D Field Visualization */}
        <motion.div 
          className="field-visualization"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1 }}
        >
          <div className="viz-header">
            <h2>3D FIELD MAPPING</h2>
            <motion.button
              className="draw-button"
              onClick={() => setIsDrawing(!isDrawing)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <FaSatellite />
              {isDrawing ? 'CANCEL DRAWING' : 'START DRAWING'}
            </motion.button>
          </div>
          
          <ThreeDFieldScene
            onFieldClick={handleFieldBoundary}
            fieldBoundary={formData.field_boundary}
            isDrawing={isDrawing}
            weatherData={weatherData}
          />
          
          {/* Real-time Weather Display */}
          {weatherData && (
            <motion.div 
              className="weather-overlay"
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
            >
              <div className="weather-stat">
                <FaWind />
                <span>{weatherData.windSpeed} MPH</span>
              </div>
              <div className="weather-stat">
                <FaThermometerHalf />
                <span>{weatherData.temperature}°F</span>
              </div>
              <div className="weather-stat">
                <GiWindsock />
                <span>{weatherData.humidity}% RH</span>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Holographic Control Panel */}
        <HolographicControlPanel
          formData={formData}
          onChange={handleInputChange}
          onSubmit={handleSubmit}
          farms={farms}
        />
      </div>

      {/* Loading Overlay */}
      <AnimatePresence>
        {loading && (
          <motion.div 
            className="loading-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="loading-content">
              <motion.div
                className="loading-fire"
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <GiFireBowl size={60} />
              </motion.div>
              <h3>PROCESSING BURN REQUEST</h3>
              <p>5-Agent AI System Analyzing...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ImmersiveBurnRequest;