/**
 * SpatialInterface.js - Map-as-Application Main Component
 * Revolutionary spatial UI where the map IS the entire interface
 * No traditional pages - everything happens on one continuous map view
 * Inspired by Bloomberg Terminal meets Google Earth
 * NO MOCKS - Real spatial interaction system
 */

import React, { useState, useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import { motion, AnimatePresence } from 'framer-motion';
import FloatingAI from './FloatingAI';
import DockNavigation from './DockNavigation';
import TimelineScrubber from './TimelineScrubber';
import AnimatedFlameLogo from './animations/logos/AnimatedFlameLogo';
import 'mapbox-gl/dist/mapbox-gl.css';
import './SpatialInterface.css';

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_TOKEN;

const SpatialInterface = () => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  
  // Map state
  const [lng, setLng] = useState(-121.740); // California Central Valley
  const [lat, setLat] = useState(38.544);
  const [zoom, setZoom] = useState(10);
  
  // UI state
  const [activePanel, setActivePanel] = useState(null);
  const [selectedFarm, setSelectedFarm] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [weatherOverlay, setWeatherOverlay] = useState(true);
  const [smokeOverlay, setSmokeOverlay] = useState(true);
  
  // Data state
  const [farms, setFarms] = useState([]);
  const [burns, setBurns] = useState([]);
  const [weatherData, setWeatherData] = useState(null);
  
  // Initialize map
  useEffect(() => {
    if (map.current) return;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [lng, lat],
      zoom: zoom,
      pitch: 45, // 3D perspective
      bearing: -17.6, // Rotation
      antialias: true
    });
    
    map.current.on('load', () => {
      // Enable 3D terrain
      map.current.addSource('mapbox-dem', {
        'type': 'raster-dem',
        'url': 'mapbox://mapbox.mapbox-terrain-dem-v1',
        'tileSize': 512,
        'maxzoom': 14
      });
      
      map.current.setTerrain({ 'source': 'mapbox-dem', 'exaggeration': 1.5 });
      
      // Add sky atmosphere
      map.current.setFog({
        'color': 'rgb(186, 210, 235)',
        'high-color': 'rgb(36, 92, 223)',
        'horizon-blend': 0.02,
        'space-color': 'rgb(11, 11, 25)',
        'star-intensity': 0.6
      });
      
      // Load initial data
      loadFarms();
      loadBurns();
      loadWeatherData();
      
      // Set up click handlers
      setupMapInteractions();
    });
    
    // Update coordinates display
    map.current.on('move', () => {
      setLng(map.current.getCenter().lng.toFixed(4));
      setLat(map.current.getCenter().lat.toFixed(4));
      setZoom(map.current.getZoom().toFixed(2));
    });
  }, []);
  
  // Load farms data
  const loadFarms = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/farms');
      const data = await response.json();
      if (data.success) {
        setFarms(data.data);
        addFarmLayers(data.data);
      }
    } catch (error) {
      console.error('Failed to load farms:', error);
    }
  };
  
  // Load burns data
  const loadBurns = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/burn-requests');
      const data = await response.json();
      if (data.success) {
        setBurns(data.data);
        addBurnLayers(data.data);
      }
    } catch (error) {
      console.error('Failed to load burns:', error);
    }
  };
  
  // Load weather data
  const loadWeatherData = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/weather/current');
      const data = await response.json();
      if (data.success) {
        setWeatherData(data.data);
        if (weatherOverlay) {
          addWeatherOverlay(data.data);
        }
      }
    } catch (error) {
      console.error('Failed to load weather:', error);
    }
  };
  
  // Add farm polygons to map
  const addFarmLayers = (farmsData) => {
    if (!map.current || !farmsData) return;
    
    // Create GeoJSON from farms
    const geojson = {
      type: 'FeatureCollection',
      features: farmsData.map(farm => ({
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: farm.boundaries || [[
            [farm.longitude - 0.01, farm.latitude - 0.01],
            [farm.longitude + 0.01, farm.latitude - 0.01],
            [farm.longitude + 0.01, farm.latitude + 0.01],
            [farm.longitude - 0.01, farm.latitude + 0.01],
            [farm.longitude - 0.01, farm.latitude - 0.01]
          ]]
        },
        properties: {
          id: farm.id,
          name: farm.name,
          acreage: farm.total_acreage,
          owner: farm.owner_name
        }
      }))
    };
    
    // Add source
    if (!map.current.getSource('farms')) {
      map.current.addSource('farms', {
        type: 'geojson',
        data: geojson
      });
    }
    
    // Add fill layer with 3D extrusion
    if (!map.current.getLayer('farms-3d')) {
      map.current.addLayer({
        id: 'farms-3d',
        type: 'fill-extrusion',
        source: 'farms',
        paint: {
          'fill-extrusion-color': [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            '#FF6B35',
            '#FFA500'
          ],
          'fill-extrusion-height': 50,
          'fill-extrusion-opacity': 0.6
        }
      });
    }
    
    // Add outline
    if (!map.current.getLayer('farms-outline')) {
      map.current.addLayer({
        id: 'farms-outline',
        type: 'line',
        source: 'farms',
        paint: {
          'line-color': '#FF6B35',
          'line-width': 2
        }
      });
    }
  };
  
  // Add burn areas to map
  const addBurnLayers = (burnsData) => {
    if (!map.current || !burnsData) return;
    
    const activeBurns = burnsData.filter(b => b.status === 'active');
    
    // Add animated fire icons for active burns
    activeBurns.forEach(burn => {
      const el = document.createElement('div');
      el.className = 'burn-marker';
      el.innerHTML = '<div class="burn-pulse"></div>';
      
      new mapboxgl.Marker(el)
        .setLngLat([burn.longitude, burn.latitude])
        .addTo(map.current);
    });
  };
  
  // Add weather overlay
  const addWeatherOverlay = (weather) => {
    if (!map.current || !weather) return;
    
    // Wind direction indicators
    if (weather.wind_direction && weather.wind_speed) {
      // Add wind arrows layer
      // This would be more complex with actual wind field data
    }
  };
  
  // Setup map click interactions
  const setupMapInteractions = () => {
    if (!map.current) return;
    
    // Click on farm
    map.current.on('click', 'farms-3d', (e) => {
      if (e.features.length > 0) {
        const feature = e.features[0];
        setSelectedFarm(feature.properties);
        
        // Fly to farm
        map.current.flyTo({
          center: e.lngLat,
          zoom: 14,
          pitch: 60,
          bearing: 0,
          duration: 2000
        });
      }
    });
    
    // Hover effects
    let hoveredFarmId = null;
    
    map.current.on('mouseenter', 'farms-3d', (e) => {
      map.current.getCanvas().style.cursor = 'pointer';
      
      if (e.features.length > 0) {
        if (hoveredFarmId !== null) {
          map.current.setFeatureState(
            { source: 'farms', id: hoveredFarmId },
            { hover: false }
          );
        }
        hoveredFarmId = e.features[0].id;
        map.current.setFeatureState(
          { source: 'farms', id: hoveredFarmId },
          { hover: true }
        );
      }
    });
    
    map.current.on('mouseleave', 'farms-3d', () => {
      map.current.getCanvas().style.cursor = '';
      
      if (hoveredFarmId !== null) {
        map.current.setFeatureState(
          { source: 'farms', id: hoveredFarmId },
          { hover: false }
        );
      }
      hoveredFarmId = null;
    });
    
    // Right-click context menu
    map.current.on('contextmenu', 'farms-3d', (e) => {
      e.preventDefault();
      // Show context menu for quick actions
    });
  };
  
  // Handle dock navigation actions
  const handleDockAction = (action) => {
    switch(action) {
      case 'layers':
        setActivePanel(activePanel === 'layers' ? null : 'layers');
        break;
      case 'weather':
        setWeatherOverlay(!weatherOverlay);
        break;
      case 'burns':
        setActivePanel(activePanel === 'burns' ? null : 'burns');
        break;
      case 'ai':
        setActivePanel(activePanel === 'ai' ? null : 'ai');
        break;
      default:
        break;
    }
  };
  
  // Handle timeline changes
  const handleTimeChange = (newTime) => {
    setCurrentTime(newTime);
    // Reload data for new time
    // This would fetch historical or forecast data
  };
  
  return (
    <div className="spatial-interface">
      {/* Main Map Container */}
      <div ref={mapContainer} className="map-container" />
      
      {/* Coordinate Display */}
      <div className="coordinates-display">
        <span>Lng: {lng}</span>
        <span>Lat: {lat}</span>
        <span>Zoom: {zoom}</span>
      </div>
      
      {/* Selected Farm Info Card */}
      <AnimatePresence>
        {selectedFarm && (
          <motion.div 
            className="farm-info-card"
            initial={{ opacity: 0, x: -300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -300 }}
            drag
            dragConstraints={{ left: 0, right: window.innerWidth - 300, top: 0, bottom: window.innerHeight - 200 }}
          >
            <div className="card-header">
              <AnimatedFlameLogo size={20} animated={false} />
              <h3>{selectedFarm.name}</h3>
              <button onClick={() => setSelectedFarm(null)}>×</button>
            </div>
            <div className="card-content">
              <p>Owner: {selectedFarm.owner}</p>
              <p>Acreage: {selectedFarm.acreage} acres</p>
              <div className="card-actions">
                <button className="action-btn">Schedule Burn</button>
                <button className="action-btn">View History</button>
                <button className="action-btn">Weather Check</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Active Burns Panel */}
      <AnimatePresence>
        {activePanel === 'burns' && (
          <motion.div 
            className="burns-panel"
            initial={{ opacity: 0, x: 300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 300 }}
          >
            <h3>Active Burns</h3>
            <div className="burns-list">
              {burns.filter(b => b.status === 'active').map(burn => (
                <div key={burn.id} className="burn-item">
                  <AnimatedFlameLogo size={16} animated={true} />
                  <span>{burn.farm_name}</span>
                  <span>{burn.acres} acres</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Floating AI Assistant */}
      <FloatingAI 
        isOpen={activePanel === 'ai'} 
        onClose={() => setActivePanel(null)}
      />
      
      {/* Bottom Dock Navigation */}
      <DockNavigation 
        onAction={handleDockAction}
        activePanel={activePanel}
      />
      
      {/* Timeline Scrubber */}
      <TimelineScrubber 
        currentTime={currentTime}
        onChange={handleTimeChange}
      />
      
      {/* Weather Overlay Toggle */}
      <div className="overlay-controls">
        <button 
          className={`overlay-btn ${weatherOverlay ? 'active' : ''}`}
          onClick={() => setWeatherOverlay(!weatherOverlay)}
        >
          Weather
        </button>
        <button 
          className={`overlay-btn ${smokeOverlay ? 'active' : ''}`}
          onClick={() => setSmokeOverlay(!smokeOverlay)}
        >
          Smoke
        </button>
      </div>
    </div>
  );
};

export default SpatialInterface;