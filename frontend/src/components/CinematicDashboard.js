import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence, useScroll, useTransform, useSpring, useMotionValue, useVelocity, useAnimationFrame } from 'framer-motion';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, Sphere, MeshDistortMaterial, Float, Trail } from '@react-three/drei';
import * as THREE from 'three';
import { FaFire, FaWind, FaThermometerHalf, FaMapMarkedAlt, FaExclamationTriangle, FaChartLine, FaBolt, FaRadiation } from 'react-icons/fa';
import { GiSmokeBomb, GiFireZone, GiFireBowl, GiWindsock } from 'react-icons/gi';
import { useNavigate } from 'react-router-dom';
import './CinematicDashboard.css';

// Fire Particle System Component
const FireParticles = () => {
  const particlesRef = useRef();
  const particleCount = 500;
  
  const positions = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 10;
      pos[i * 3 + 1] = Math.random() * 10 - 5;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 10;
    }
    return pos;
  }, []);

  useFrame((state) => {
    if (!particlesRef.current) return;
    const positions = particlesRef.current.geometry.attributes.position.array;
    
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3 + 1] += 0.02;
      if (positions[i * 3 + 1] > 5) {
        positions[i * 3 + 1] = -5;
      }
      positions[i * 3] += Math.sin(state.clock.elapsedTime + i) * 0.001;
    }
    particlesRef.current.geometry.attributes.position.needsUpdate = true;
    particlesRef.current.rotation.y = state.clock.elapsedTime * 0.05;
  });

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particleCount}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.1}
        color="#ff6b35"
        transparent
        opacity={0.8}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
};

// 3D Smoke Orb Component
const SmokeOrb = ({ position, scale = 1 }) => {
  const meshRef = useRef();
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = state.clock.elapsedTime * 0.2;
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.3;
    }
  });

  return (
    <Float speed={2} rotationIntensity={1} floatIntensity={2}>
      <Sphere ref={meshRef} args={[1, 64, 64]} position={position} scale={scale}>
        <MeshDistortMaterial
          color="#ff5722"
          attach="material"
          distort={0.5}
          speed={2}
          roughness={0.2}
          metalness={0.8}
          transparent
          opacity={0.3}
        />
      </Sphere>
    </Float>
  );
};

// Neural Network Connection Lines
const NetworkConnections = ({ nodes }) => {
  const linesRef = useRef([]);
  
  useFrame((state) => {
    linesRef.current.forEach((line, i) => {
      if (line) {
        const pulse = Math.sin(state.clock.elapsedTime * 2 + i) * 0.5 + 0.5;
        line.material.opacity = pulse * 0.3;
      }
    });
  });

  return (
    <>
      {nodes.map((node, i) => 
        nodes.slice(i + 1).map((targetNode, j) => (
          <line key={`${i}-${j}`} ref={el => linesRef.current[i * nodes.length + j] = el}>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                count={2}
                array={new Float32Array([...node, ...targetNode])}
                itemSize={3}
              />
            </bufferGeometry>
            <lineBasicMaterial color="#ff6b35" transparent opacity={0.2} />
          </line>
        ))
      )}
    </>
  );
};

// 3D Scene Component
const ThreeDScene = () => {
  const nodes = [
    [-3, 0, 0], [3, 0, 0], [0, 3, 0], 
    [0, -3, 0], [-2, 2, -1], [2, 2, -1]
  ];

  return (
    <div className="three-scene-container">
      <Canvas camera={{ position: [0, 0, 15], fov: 45 }}>
        <ambientLight intensity={0.1} />
        <pointLight position={[10, 10, 10]} intensity={0.5} color="#ff6b35" />
        <pointLight position={[-10, -10, -10]} intensity={0.3} color="#ff5722" />
        
        <FireParticles />
        <NetworkConnections nodes={nodes} />
        
        {nodes.map((pos, i) => (
          <SmokeOrb key={i} position={pos} scale={0.3 + Math.random() * 0.3} />
        ))}
        
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.5} />
      </Canvas>
    </div>
  );
};

// Breathing Metric Card
const BreathingMetric = ({ title, value, unit, icon: Icon, color, delay = 0 }) => {
  const [isHovered, setIsHovered] = useState(false);
  const glowIntensity = useMotionValue(0);
  const scale = useSpring(1, { stiffness: 300, damping: 20 });
  
  useAnimationFrame((t) => {
    const breathing = Math.sin(t / 1000) * 0.5 + 0.5;
    glowIntensity.set(breathing);
  });

  return (
    <motion.div
      className="breathing-metric"
      initial={{ opacity: 0, scale: 0.8, rotateY: -90 }}
      animate={{ opacity: 1, scale: 1, rotateY: 0 }}
      transition={{ delay, duration: 0.8, type: "spring" }}
      whileHover={{ scale: 1.05, rotateY: 5 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      style={{
        background: `radial-gradient(circle at 30% 30%, ${color}22, transparent)`,
        boxShadow: isHovered 
          ? `0 20px 60px ${color}66, inset 0 0 40px ${color}22`
          : `0 10px 40px ${color}33, inset 0 0 20px ${color}11`
      }}
    >
      <motion.div 
        className="metric-glow"
        style={{
          opacity: glowIntensity,
          background: `radial-gradient(circle, ${color}44, transparent)`
        }}
      />
      
      <div className="metric-header">
        <motion.div 
          className="metric-icon"
          animate={{ rotate: isHovered ? 360 : 0 }}
          transition={{ duration: 1 }}
        >
          <Icon size={24} color={color} />
        </motion.div>
        <span className="metric-title">{title}</span>
      </div>
      
      <motion.div 
        className="metric-value"
        animate={{ scale: isHovered ? 1.1 : 1 }}
      >
        <span className="value-number">{value}</span>
        <span className="value-unit">{unit}</span>
      </motion.div>
      
      <svg className="metric-graph" viewBox="0 0 100 40">
        <motion.path
          d="M 0,20 Q 25,10 50,20 T 100,20"
          stroke={color}
          strokeWidth="2"
          fill="none"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 2, delay: delay + 0.5 }}
        />
      </svg>
    </motion.div>
  );
};

// Live Data Stream Visualization
const DataStream = ({ data, color }) => {
  const pathRef = useRef();
  const [pathData, setPathData] = useState('');
  
  useEffect(() => {
    const points = data.map((d, i) => {
      const x = (i / (data.length - 1)) * 100;
      const y = 40 - (d * 30);
      return `${i === 0 ? 'M' : 'L'} ${x},${y}`;
    }).join(' ');
    setPathData(points);
  }, [data]);

  return (
    <svg className="data-stream" viewBox="0 0 100 40">
      <defs>
        <linearGradient id={`gradient-${color}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={color} stopOpacity="0" />
          <stop offset="50%" stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      
      <motion.path
        ref={pathRef}
        d={pathData}
        stroke={`url(#gradient-${color})`}
        strokeWidth="2"
        fill="none"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 1 }}
      />
      
      {data.map((d, i) => (
        <motion.circle
          key={i}
          cx={(i / (data.length - 1)) * 100}
          cy={40 - (d * 30)}
          r="2"
          fill={color}
          initial={{ scale: 0 }}
          animate={{ scale: [0, 1.5, 1] }}
          transition={{ delay: i * 0.1, duration: 0.5 }}
        />
      ))}
    </svg>
  );
};

// Holographic Alert Panel
const HolographicAlert = ({ alert, index }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  return (
    <motion.div
      className="holographic-alert"
      initial={{ x: -100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 100, opacity: 0 }}
      transition={{ delay: index * 0.1 }}
      whileHover={{ scale: 1.02, x: 10 }}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div className="alert-scanline" />
      
      <div className="alert-content">
        <motion.div 
          className="alert-icon"
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        >
          <FaExclamationTriangle color={alert.severity === 'high' ? '#ff5722' : '#FFB000'} />
        </motion.div>
        
        <div className="alert-info">
          <h4>{alert.title}</h4>
          <p>{alert.message}</p>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="alert-details"
            >
              <p>Location: {alert.location}</p>
              <p>Time: {alert.time}</p>
            </motion.div>
          )}
        </div>
        
        <div className="alert-severity">
          <span className={`severity-badge severity-${alert.severity}`}>
            {alert.severity.toUpperCase()}
          </span>
        </div>
      </div>
    </motion.div>
  );
};

// Main Cinematic Dashboard Component
const CinematicDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [metrics, setMetrics] = useState({
    activeBurns: 0,
    windSpeed: 0,
    temperature: 0,
    smokeDensity: 0,
    conflicts: 0,
    efficiency: 0
  });
  
  const [dataStreams, setDataStreams] = useState({
    burns: Array(20).fill(0).map(() => Math.random()),
    smoke: Array(20).fill(0).map(() => Math.random()),
    weather: Array(20).fill(0).map(() => Math.random())
  });
  
  const [alerts] = useState([
    { id: 1, title: 'High Wind Alert', message: 'Winds exceeding safe burn limits', severity: 'high', location: 'Farm A', time: '14:30' },
    { id: 2, title: 'Smoke Conflict', message: 'Potential overlap detected', severity: 'medium', location: 'Sector 7', time: '15:45' },
    { id: 3, title: 'Burn Complete', message: 'Field B3 burn successful', severity: 'low', location: 'Farm C', time: '16:00' }
  ]);

  // Simulate real-time data updates
  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(prev => ({
        activeBurns: Math.floor(Math.random() * 10),
        windSpeed: Math.floor(Math.random() * 30),
        temperature: 60 + Math.floor(Math.random() * 40),
        smokeDensity: Math.floor(Math.random() * 100),
        conflicts: Math.floor(Math.random() * 5),
        efficiency: 70 + Math.floor(Math.random() * 30)
      }));
      
      setDataStreams(prev => ({
        burns: [...prev.burns.slice(1), Math.random()],
        smoke: [...prev.smoke.slice(1), Math.random()],
        weather: [...prev.weather.slice(1), Math.random()]
      }));
    }, 2000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="cinematic-dashboard">
      {/* Ambient Background Effects */}
      <div className="ambient-smoke" />
      <div className="ambient-embers" />
      
      {/* 3D Background Scene */}
      <div className="dashboard-3d-background">
        <ThreeDScene />
      </div>
      
      {/* Main Content */}
      <div className="dashboard-content">
        {/* Header */}
        <motion.header 
          className="dashboard-header"
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8 }}
        >
          <div className="header-left">
            <motion.h1 
              className="dashboard-title"
              animate={{ 
                textShadow: [
                  "0 0 20px #ff6b35",
                  "0 0 40px #ff5722",
                  "0 0 20px #ff6b35"
                ]
              }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              BURN COMMAND CENTER
            </motion.h1>
            <div className="system-status">
              <span className="status-indicator active" />
              <span>5-AGENT SYSTEM ACTIVE</span>
            </div>
          </div>
          
          <div className="header-right">
            <motion.button 
              className="emergency-stop"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              <FaBolt /> EMERGENCY STOP
            </motion.button>
          </div>
        </motion.header>

        {/* Tab Navigation */}
        <motion.nav 
          className="dashboard-tabs"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          {['overview', 'weather', 'agents', 'predictions'].map((tab, i) => (
            <motion.button
              key={tab}
              className={`tab-button ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + i * 0.1 }}
            >
              {tab.toUpperCase()}
            </motion.button>
          ))}
        </motion.nav>

        {/* Metrics Grid */}
        <div className="metrics-grid">
          <BreathingMetric
            title="Active Burns"
            value={metrics.activeBurns}
            unit="fields"
            icon={GiFireBowl}
            color="#ff6b35"
            delay={0.1}
          />
          <BreathingMetric
            title="Wind Speed"
            value={metrics.windSpeed}
            unit="mph"
            icon={FaWind}
            color="#4fc3f7"
            delay={0.2}
          />
          <BreathingMetric
            title="Temperature"
            value={metrics.temperature}
            unit="°F"
            icon={FaThermometerHalf}
            color="#ffd54f"
            delay={0.3}
          />
          <BreathingMetric
            title="Smoke Density"
            value={metrics.smokeDensity}
            unit="%"
            icon={GiSmokeBomb}
            color="#9e9e9e"
            delay={0.4}
          />
          <BreathingMetric
            title="Conflicts"
            value={metrics.conflicts}
            unit="detected"
            icon={FaExclamationTriangle}
            color="#ff5722"
            delay={0.5}
          />
          <BreathingMetric
            title="Efficiency"
            value={metrics.efficiency}
            unit="%"
            icon={FaChartLine}
            color="#4caf50"
            delay={0.6}
          />
        </div>

        {/* Live Data Streams */}
        <motion.section 
          className="data-streams-section"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <h2 className="section-title">LIVE DATA STREAMS</h2>
          <div className="streams-grid">
            <div className="stream-container">
              <h3>Burn Activity</h3>
              <DataStream data={dataStreams.burns} color="#ff6b35" />
            </div>
            <div className="stream-container">
              <h3>Smoke Dispersion</h3>
              <DataStream data={dataStreams.smoke} color="#9e9e9e" />
            </div>
            <div className="stream-container">
              <h3>Weather Patterns</h3>
              <DataStream data={dataStreams.weather} color="#4fc3f7" />
            </div>
          </div>
        </motion.section>

        {/* Holographic Alerts */}
        <motion.section 
          className="alerts-section"
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 1 }}
        >
          <h2 className="section-title">SYSTEM ALERTS</h2>
          <AnimatePresence>
            {alerts.map((alert, index) => (
              <HolographicAlert key={alert.id} alert={alert} index={index} />
            ))}
          </AnimatePresence>
        </motion.section>

        {/* Action Center */}
        <motion.div 
          className="action-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.2 }}
        >
          <motion.button
            className="action-button primary"
            onClick={() => navigate('/request')}
            whileHover={{ scale: 1.05, boxShadow: '0 0 30px #ff6b35' }}
            whileTap={{ scale: 0.95 }}
          >
            <FaFire /> INITIATE BURN REQUEST
          </motion.button>
          
          <motion.button
            className="action-button secondary"
            onClick={() => navigate('/map')}
            whileHover={{ scale: 1.05, boxShadow: '0 0 30px #4fc3f7' }}
            whileTap={{ scale: 0.95 }}
          >
            <FaMapMarkedAlt /> VIEW LIVE MAP
          </motion.button>
          
          <motion.button
            className="action-button tertiary"
            onClick={() => navigate('/analytics')}
            whileHover={{ scale: 1.05, boxShadow: '0 0 30px #4caf50' }}
            whileTap={{ scale: 0.95 }}
          >
            <FaChartLine /> ANALYTICS
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
};

export default CinematicDashboard;