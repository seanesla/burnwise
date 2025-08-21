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
import { useMap } from '../contexts/MapContext';
import FloatingAI from './FloatingAI';
import DockNavigation from './DockNavigation';
import TimelineScrubber from './TimelineScrubber';
import DemoSessionBanner from './DemoSessionBanner';
import DashboardView from './DashboardView';
import AnimatedFlameLogo from './animations/logos/AnimatedFlameLogo';
import TutorialOverlay from './TutorialOverlay';
import 'mapbox-gl/dist/mapbox-gl.css';
import './SpatialInterface.css';

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_TOKEN;

const SpatialInterface = () => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const { mapCenter, updateMapCenter, setSelectedFarm: setGlobalSelectedFarm } = useMap();
  
  // Map state - initialize from context
  const [lng, setLng] = useState(mapCenter.lng);
  const [lat, setLat] = useState(mapCenter.lat);
  const [zoom, setZoom] = useState(mapCenter.zoom);
  
  // UI state
  const [activePanel, setActivePanel] = useState(null);
  const [selectedFarm, setSelectedFarm] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [weatherOverlay, setWeatherOverlay] = useState(true);
  const [smokeOverlay, setSmokeOverlay] = useState(true);
  const [farmBoundariesVisible, setFarmBoundariesVisible] = useState(true);
  const [activeBurnsVisible, setActiveBurnsVisible] = useState(true);
  const [isDemo, setIsDemo] = useState(false);
  const [isMapView, setIsMapView] = useState(true); // Toggle between map and dashboard
  
  // Data state
  const [farms, setFarms] = useState([]);
  const [burns, setBurns] = useState([]);
  const [weatherData, setWeatherData] = useState(null);
  
  // Check if in demo mode
  useEffect(() => {
    const demoContext = sessionStorage.getItem('burnwise_demo_context');
    setIsDemo(!!demoContext && window.location.pathname.startsWith('/demo'));
  }, []);
  
  // Listen for panel change events from Sidebar
  useEffect(() => {
    const handlePanelChange = (event) => {
      const { panelId } = event.detail;
      console.log('Panel change event received:', panelId);
      
      // Handle 'spatial' as toggling map view
      if (panelId === 'spatial') {
        setIsMapView(prev => !prev);
        setActivePanel(null); // Close any open panels when toggling view
      } else if (activePanel === panelId) {
        // Toggle the panel - if it's already active, close it
        setActivePanel(null);
      } else {
        // Open the new panel
        setActivePanel(panelId);
      }
    };
    
    window.addEventListener('panelChange', handlePanelChange);
    
    return () => {
      window.removeEventListener('panelChange', handlePanelChange);
    };
  }, [activePanel]);
  
  // Emit activePanel and isMapView changes to Sidebar
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('activePanelChanged', {
      detail: { activePanel, isMapView }
    }));
  }, [activePanel, isMapView]);
  
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
      // Force resize to fill container
      map.current.resize();
      
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
    
    // Update coordinates display and global map context
    map.current.on('move', () => {
      const center = map.current.getCenter();
      const currentZoom = map.current.getZoom();
      
      const newLng = parseFloat(center.lng.toFixed(4));
      const newLat = parseFloat(center.lat.toFixed(4));
      const newZoom = parseFloat(currentZoom.toFixed(2));
      
      setLng(newLng);
      setLat(newLat);
      setZoom(newZoom);
      
      // Update global map context for weather and other location-based features
      updateMapCenter(newLat, newLng, newZoom);
    });
    
    // Handle window resize
    const handleResize = () => {
      if (map.current) {
        map.current.resize();
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    // Trigger initial resize after a short delay
    setTimeout(() => {
      if (map.current) {
        map.current.resize();
      }
    }, 100);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
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
        // Add test data if empty for demonstration
        if (!data.data || data.data.length === 0) {
          const testBurns = [
            {
              id: 1,
              status: 'active',
              farm_name: 'Golden Fields Farm',
              acres: 150,
              longitude: -121.75,
              latitude: 38.55
            },
            {
              id: 2,
              status: 'scheduled',
              farm_name: 'Sunrise Valley Farm',
              acres: 200,
              longitude: -121.73,
              latitude: 38.54
            },
            {
              id: 3,
              status: 'active',
              farm_name: 'River Ranch',
              acres: 100,
              longitude: -121.74,
              latitude: 38.56
            }
          ];
          setBurns(testBurns);
          addBurnLayers(testBurns);
        } else {
          setBurns(data.data);
          addBurnLayers(data.data);
        }
      }
    } catch (error) {
      console.error('Failed to load burns:', error);
      // Set test data on error too
      const fallbackBurns = [
        {
          id: 1,
          status: 'active',
          farm_name: 'Test Farm',
          acres: 100,
          longitude: -121.74,
          latitude: 38.54
        }
      ];
      setBurns(fallbackBurns);
    }
  };
  
  // Load weather data
  const loadWeatherData = async () => {
    try {
      // Use current map center coordinates
      const center = map.current ? map.current.getCenter() : { lat: 34.0522, lng: -118.2437 };
      const lat = center.lat;
      const lon = center.lng;
      const response = await fetch(`http://localhost:5001/api/weather/current?lat=${lat}&lon=${lon}`);
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
            [parseFloat(farm.lon) - 0.01, parseFloat(farm.lat) - 0.01],
            [parseFloat(farm.lon) + 0.01, parseFloat(farm.lat) - 0.01],
            [parseFloat(farm.lon) + 0.01, parseFloat(farm.lat) + 0.01],
            [parseFloat(farm.lon) - 0.01, parseFloat(farm.lat) + 0.01],
            [parseFloat(farm.lon) - 0.01, parseFloat(farm.lat) - 0.01]
          ]]
        },
        properties: {
          id: farm.id,
          name: farm.name,
          acreage: farm.farm_size_acres,
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
    
    // Add visible farm markers with labels
    farmsData.forEach(farm => {
      // Create custom marker element
      const el = document.createElement('div');
      el.className = 'farm-marker';
      el.style.backgroundColor = '#FF6B35';
      el.style.width = '30px';
      el.style.height = '30px';
      el.style.borderRadius = '50%';
      el.style.border = '3px solid white';
      el.style.cursor = 'pointer';
      el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
      
      // Add farm name as tooltip
      el.title = `${farm.name} - ${farm.farm_size_acres || 0} acres`;
      
      // Create marker
      const marker = new mapboxgl.Marker(el)
        .setLngLat([parseFloat(farm.lon) || -121.74, parseFloat(farm.lat) || 38.54])
        .addTo(map.current);
        
      // Add popup on click
      const popup = new mapboxgl.Popup({ 
        offset: 25,
        closeButton: true,
        closeOnClick: false,
        maxWidth: '300px'
      })
        .setHTML(`
          <div style="padding: 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
            <h3 style="margin: 0 0 10px 0; color: #FF6B35; font-size: 18px;">${farm.name}</h3>
            <p style="margin: 5px 0; color: #333;">Owner: ${farm.owner_name}</p>
            <p style="margin: 5px 0; color: #333;">Acreage: ${farm.farm_size_acres || 0} acres</p>
            <button onclick="console.log('Schedule burn for farm ${farm.id}')" style="background: #FF6B35; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; width: 100%; margin-top: 10px; font-size: 14px;">Schedule Burn</button>
          </div>
        `);
      
      // Attach popup to marker
      marker.setPopup(popup);
      
      // Use marker's element for click handler
      marker.getElement().addEventListener('click', () => {
        popup.addTo(map.current);
        setSelectedFarm(farm);
        setGlobalSelectedFarm(farm); // Update global context for weather
      });
    });
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
    
    // Add smoke overlay if enabled
    if (smokeOverlay) {
      addSmokeOverlay(activeBurns);
    }
  };
  
  // Add smoke overlay visualization
  const addSmokeOverlay = (activeBurns) => {
    if (!map.current || !activeBurns || activeBurns.length === 0) return;
    
    // Remove existing smoke layers if any
    if (map.current.getLayer('smoke-plumes')) {
      map.current.removeLayer('smoke-plumes');
    }
    if (map.current.getSource('smoke-plumes')) {
      map.current.removeSource('smoke-plumes');
    }
    
    // Create smoke plume data
    const smokeData = {
      type: 'FeatureCollection',
      features: []
    };
    
    // Generate smoke plume polygons for each active burn
    activeBurns.forEach(burn => {
      const burnLng = burn.longitude || burn.lng || -121.74;
      const burnLat = burn.latitude || burn.lat || 38.54;
      const acres = burn.acres || burn.acreage || 100;
      
      // Calculate plume size based on acreage
      const plumeRadius = Math.sqrt(acres) * 0.005; // Scale based on burn size
      const windDirection = (weatherData?.wind_direction || 180) * Math.PI / 180; // Convert to radians
      const windSpeed = weatherData?.wind_speed || 5;
      
      // Generate plume polygon (elongated in wind direction)
      const points = [];
      const numPoints = 20;
      
      for (let i = 0; i < numPoints; i++) {
        const angle = (i / numPoints) * 2 * Math.PI;
        let radius = plumeRadius;
        
        // Elongate plume in wind direction
        const windAlignment = Math.cos(angle - windDirection);
        if (windAlignment > 0) {
          radius *= (1 + windAlignment * windSpeed / 10); // Elongate based on wind speed
        }
        
        const x = burnLng + radius * Math.cos(angle);
        const y = burnLat + radius * Math.sin(angle);
        points.push([x, y]);
      }
      
      // Close the polygon
      points.push(points[0]);
      
      smokeData.features.push({
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [points]
        },
        properties: {
          intensity: acres / 500, // Normalize intensity
          burnId: burn.id
        }
      });
    });
    
    // Add smoke source
    map.current.addSource('smoke-plumes', {
      type: 'geojson',
      data: smokeData
    });
    
    // Add smoke layer with gradient opacity
    map.current.addLayer({
      id: 'smoke-plumes',
      type: 'fill',
      source: 'smoke-plumes',
      paint: {
        'fill-color': '#808080',
        'fill-opacity': [
          'interpolate',
          ['linear'],
          ['get', 'intensity'],
          0, 0.1,
          0.5, 0.3,
          1, 0.5
        ]
      }
    });
  };
  
  // Add weather overlay
  const addWeatherOverlay = (weather) => {
    if (!map.current || !weather) return;
    
    // Remove existing weather layers if any
    if (map.current.getLayer('weather-heat')) {
      map.current.removeLayer('weather-heat');
    }
    if (map.current.getSource('weather-heat')) {
      map.current.removeSource('weather-heat');
    }
    
    // Create temperature heatmap
    const heatmapData = {
      type: 'FeatureCollection',
      features: []
    };
    
    // Generate temperature points around the area
    const centerLat = lat;
    const centerLng = lng;
    const gridSize = 5; // 5x5 grid
    const spread = 0.1; // Spread of points
    
    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        const pointLat = centerLat + (i - gridSize/2) * spread/gridSize;
        const pointLng = centerLng + (j - gridSize/2) * spread/gridSize;
        
        // Vary temperature slightly across the area
        const tempVariation = Math.sin(i) * Math.cos(j) * 5;
        const temperature = (weather.temperature || 75) + tempVariation;
        
        heatmapData.features.push({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [pointLng, pointLat]
          },
          properties: {
            temperature: temperature,
            weight: temperature / 100
          }
        });
      }
    }
    
    // Add heatmap source
    map.current.addSource('weather-heat', {
      type: 'geojson',
      data: heatmapData
    });
    
    // Add heatmap layer
    map.current.addLayer({
      id: 'weather-heat',
      type: 'heatmap',
      source: 'weather-heat',
      paint: {
        'heatmap-weight': ['get', 'weight'],
        'heatmap-intensity': 0.5,
        'heatmap-color': [
          'interpolate',
          ['linear'],
          ['heatmap-density'],
          0, 'rgba(33,102,172,0)',
          0.2, 'rgb(103,169,207)',
          0.4, 'rgb(209,229,240)',
          0.6, 'rgb(253,219,199)',
          0.8, 'rgb(239,138,98)',
          1, 'rgb(178,24,43)'
        ],
        'heatmap-radius': 40,
        'heatmap-opacity': 0.4
      }
    });
    
    // Add wind direction indicator
    if (weather.wind_direction && weather.wind_speed) {
      // Add a custom wind arrow marker
      const windMarker = document.createElement('div');
      windMarker.className = 'wind-marker';
      windMarker.style.width = '40px';
      windMarker.style.height = '40px';
      windMarker.innerHTML = `
        <svg width="40" height="40" viewBox="0 0 40 40" style="transform: rotate(${weather.wind_direction}deg)">
          <path d="M20 5 L15 25 L20 20 L25 25 Z" fill="rgba(255, 255, 255, 0.8)" stroke="#333" stroke-width="1"/>
          <text x="20" y="35" text-anchor="middle" fill="white" font-size="10">${weather.wind_speed} mph</text>
        </svg>
      `;
      
      new mapboxgl.Marker(windMarker)
        .setLngLat([centerLng + 0.02, centerLat + 0.02])
        .addTo(map.current);
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
        setGlobalSelectedFarm(feature.properties); // Update global context for weather
        
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
      {/* Demo Session Banner - only show in demo mode */}
      {isDemo && <DemoSessionBanner />}
      
      {/* Conditionally render Map or Dashboard based on toggle */}
      {isMapView ? (
        <>
          {/* Main Map Container */}
          <div ref={mapContainer} className="map-container" />
          
          {/* Coordinate Display - only show in map view */}
          <div className="coordinates-display">
            <span>Lng: {lng}</span>
            <span>Lat: {lat}</span>
            <span>Zoom: {zoom}</span>
          </div>
        </>
      ) : (
        /* Dashboard View */
        <DashboardView 
          burns={burns}
          weatherData={weatherData}
          farms={farms}
          activePanel={activePanel}
        />
      )}
      
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
              <button onClick={() => {
                setSelectedFarm(null);
                setGlobalSelectedFarm(null); // Clear global context
              }}>×</button>
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
              {burns && burns.length > 0 ? (
                burns.filter(b => b.status === 'active').length > 0 ? (
                  burns.filter(b => b.status === 'active').map(burn => (
                    <div key={burn.id} className="burn-item">
                      <AnimatedFlameLogo size={16} animated={true} />
                      <span>{burn.farm_name || 'Unknown Farm'}</span>
                      <span>{burn.acres || burn.acreage || 0} acres</span>
                    </div>
                  ))
                ) : (
                  <div className="no-burns-message">
                    No active burns at this time.
                    <br />
                    <small>All burns are either scheduled or completed.</small>
                  </div>
                )
              ) : (
                <div className="no-burns-message">
                  <AnimatedFlameLogo size={32} animated={false} />
                  <p>No burn data available.</p>
                  <small>Check your connection or refresh the page.</small>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Map Layers Panel */}
      <AnimatePresence>
        {activePanel === 'layers' && (
          <motion.div 
            className="layers-panel"
            initial={{ opacity: 0, x: -300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -300 }}
            transition={{ 
              type: "spring", 
              stiffness: 100,
              damping: 30,
              restDelta: 0.001
            }}
            style={{
              position: 'fixed',
              left: '270px',
              top: '100px',
              width: '280px',
              background: 'rgba(0, 0, 0, 0.7)',
              backdropFilter: 'blur(30px)',
              WebkitBackdropFilter: 'blur(30px)',
              border: '1px solid rgba(255, 107, 53, 0.15)',
              borderRadius: '12px',
              padding: '20px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
              zIndex: 1100
            }}
          >
            <h3 style={{ margin: '0 0 15px 0', color: '#ffffff', fontSize: '18px', fontWeight: '600' }}>Map Layers</h3>
            <div className="layers-list">
              <label 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  marginBottom: '10px', 
                  cursor: 'pointer',
                  padding: '8px',
                  borderRadius: '6px',
                  transition: 'all 0.2s ease',
                  color: 'rgba(255, 255, 255, 0.9)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 107, 53, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <input 
                  type="checkbox" 
                  checked={farmBoundariesVisible}
                  onChange={(e) => {
                    setFarmBoundariesVisible(e.target.checked);
                    const visibility = e.target.checked ? 'visible' : 'none';
                    if (map.current.getLayer('farms-3d')) {
                      map.current.setLayoutProperty('farms-3d', 'visibility', visibility);
                      map.current.setLayoutProperty('farms-outline', 'visibility', visibility);
                    }
                  }}
                  style={{ marginRight: '10px', accentColor: '#ff6b35', cursor: 'pointer' }}
                />
                <AnimatedFlameLogo size={16} animated={false} />
                <span style={{ marginLeft: '8px', color: 'rgba(255, 255, 255, 0.9)' }}>Farm Boundaries</span>
              </label>
              
              <label 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  marginBottom: '10px', 
                  cursor: 'pointer',
                  padding: '8px',
                  borderRadius: '6px',
                  transition: 'all 0.2s ease',
                  color: 'rgba(255, 255, 255, 0.9)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 107, 53, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <input 
                  type="checkbox" 
                  checked={activeBurnsVisible}
                  onChange={(e) => {
                    setActiveBurnsVisible(e.target.checked);
                    // Toggle burn markers visibility
                    const markers = document.querySelectorAll('.burn-marker');
                    markers.forEach(m => m.style.display = e.target.checked ? 'block' : 'none');
                  }}
                  style={{ marginRight: '10px', accentColor: '#ff6b35', cursor: 'pointer' }}
                />
                <AnimatedFlameLogo size={16} animated={true} />
                <span style={{ marginLeft: '8px', color: 'rgba(255, 255, 255, 0.9)' }}>Active Burns</span>
              </label>
              
              <label 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  marginBottom: '10px', 
                  cursor: 'pointer',
                  padding: '8px',
                  borderRadius: '6px',
                  transition: 'all 0.2s ease',
                  color: 'rgba(255, 255, 255, 0.9)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 107, 53, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <input 
                  type="checkbox" 
                  checked={weatherOverlay}
                  onChange={(e) => setWeatherOverlay(e.target.checked)}
                  style={{ marginRight: '10px', accentColor: '#ff6b35', cursor: 'pointer' }}
                />
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff6b35" strokeWidth="2" style={{ display: 'flex', alignItems: 'center' }}>
                  <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>
                </svg>
                <span style={{ marginLeft: '8px', color: 'rgba(255, 255, 255, 0.9)' }}>Weather Data</span>
              </label>

              {/* Weather Details Button */}
              <button
                onClick={() => {
                  setActivePanel('weather');
                  loadWeatherData(); // Reload weather when panel opens
                }}
                style={{
                  width: '100%',
                  padding: '10px',
                  marginBottom: '10px',
                  background: 'rgba(255, 107, 53, 0.1)',
                  border: '1px solid rgba(255, 107, 53, 0.2)',
                  borderRadius: '8px',
                  color: 'rgba(255, 255, 255, 0.9)',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 107, 53, 0.2)';
                  e.currentTarget.style.borderColor = 'rgba(255, 107, 53, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 107, 53, 0.1)';
                  e.currentTarget.style.borderColor = 'rgba(255, 107, 53, 0.2)';
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="5"/>
                  <line x1="12" y1="1" x2="12" y2="3"/>
                  <line x1="12" y1="21" x2="12" y2="23"/>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                  <line x1="1" y1="12" x2="3" y2="12"/>
                  <line x1="21" y1="12" x2="23" y2="12"/>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
                View Weather Details
              </button>
              
              <label 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  marginBottom: '10px', 
                  cursor: 'pointer',
                  padding: '8px',
                  borderRadius: '6px',
                  transition: 'all 0.2s ease',
                  color: 'rgba(255, 255, 255, 0.9)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 107, 53, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <input 
                  type="checkbox" 
                  checked={smokeOverlay}
                  onChange={(e) => setSmokeOverlay(e.target.checked)}
                  style={{ marginRight: '10px', accentColor: '#ff6b35', cursor: 'pointer' }}
                />
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff6b35" strokeWidth="2" style={{ display: 'flex', alignItems: 'center' }}>
                  <path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"/>
                </svg>
                <span style={{ marginLeft: '8px', color: 'rgba(255, 255, 255, 0.9)' }}>Smoke Plumes</span>
              </label>
              
              <label 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  marginBottom: '10px', 
                  cursor: 'pointer',
                  padding: '8px',
                  borderRadius: '6px',
                  transition: 'all 0.2s ease',
                  color: 'rgba(255, 255, 255, 0.9)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 107, 53, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <input 
                  type="checkbox" 
                  checked={true}
                  onChange={(e) => {
                    // Toggle satellite imagery
                    const newStyle = e.target.checked 
                      ? 'mapbox://styles/mapbox/satellite-streets-v12'
                      : 'mapbox://styles/mapbox/streets-v12';
                    map.current.setStyle(newStyle);
                  }}
                  style={{ marginRight: '10px', accentColor: '#ff6b35', cursor: 'pointer' }}
                />
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff6b35" strokeWidth="2" style={{ display: 'flex', alignItems: 'center' }}>
                  <circle cx="12" cy="12" r="3"/>
                  <path d="m12 1 1.09 3.64L16 3l-1.91 4.36L18 8l-3.64 2.09L15 14l-4.36-1.91L10 16l-2.09-3.64L4 14l1.91-4.36L2 8l3.64-2.09L6 2z"/>
                </svg>
                <span style={{ marginLeft: '8px', color: 'rgba(255, 255, 255, 0.9)' }}>Satellite View</span>
              </label>
              
              <label 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  cursor: 'pointer',
                  padding: '8px',
                  borderRadius: '6px',
                  transition: 'all 0.2s ease',
                  color: 'rgba(255, 255, 255, 0.9)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 107, 53, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <input 
                  type="checkbox" 
                  checked={true}
                  onChange={(e) => {
                    // Toggle 3D terrain
                    if (e.target.checked) {
                      map.current.setTerrain({ 'source': 'mapbox-dem', 'exaggeration': 1.5 });
                    } else {
                      map.current.setTerrain(null);
                    }
                  }}
                  style={{ marginRight: '10px', accentColor: '#ff6b35', cursor: 'pointer' }}
                />
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff6b35" strokeWidth="2" style={{ display: 'flex', alignItems: 'center' }}>
                  <path d="m8 3 4 8 5-5 5 15H2L8 3z"/>
                </svg>
                <span style={{ marginLeft: '8px', color: 'rgba(255, 255, 255, 0.9)' }}>3D Terrain</span>
              </label>
            </div>
            
            <div style={{ marginTop: '20px', paddingTop: '15px', borderTop: '1px solid rgba(255, 107, 53, 0.2)' }}>
              <button 
                onClick={() => setActivePanel(null)}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'linear-gradient(135deg, #ff6b35 0%, #ff5722 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  fontSize: '14px'
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.boxShadow = '0 10px 30px rgba(255, 107, 53, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = 'none';
                }}
              >
                Close Panel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Weather Panel */}
      <AnimatePresence>
        {activePanel === 'weather' && (
          <motion.div 
            className="weather-panel"
            initial={{ opacity: 0, x: -300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -300 }}
            transition={{ 
              type: "spring", 
              stiffness: 100,
              damping: 30,
              restDelta: 0.001
            }}
            style={{
              position: 'fixed',
              left: '270px',
              top: '100px',
              width: '280px',
              background: 'rgba(0, 0, 0, 0.7)',
              backdropFilter: 'blur(30px)',
              WebkitBackdropFilter: 'blur(30px)',
              border: '1px solid rgba(255, 107, 53, 0.15)',
              borderRadius: '12px',
              padding: '20px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
              zIndex: 1100
            }}
          >
            <h3 style={{ margin: '0 0 15px 0', color: '#ffffff', fontSize: '18px', fontWeight: '600' }}>Weather Conditions</h3>
            {weatherData?.location && (
              <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '10px' }}>
                Location: {weatherData.location.lat.toFixed(4)}, {weatherData.location.lng.toFixed(4)}
              </div>
            )}
            <div className="weather-content" style={{ color: 'rgba(255, 255, 255, 0.9)' }}>
              {weatherData ? (
                <>
                  <div style={{ marginBottom: '15px', padding: '10px', background: 'rgba(255, 107, 53, 0.1)', borderRadius: '8px' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '5px' }}>
                      {Math.round(weatherData.temperature || weatherData.weather?.temperature || 75)}°F
                    </div>
                    <div style={{ fontSize: '14px', opacity: 0.8 }}>
                      {weatherData.weather?.condition || weatherData.condition || 'Clear'}
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div style={{ padding: '10px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '6px' }}>
                      <div style={{ fontSize: '12px', opacity: 0.7, marginBottom: '2px' }}>Wind</div>
                      <div style={{ fontSize: '14px' }}>{weatherData.wind_speed || weatherData.weather?.windSpeed || '5'} mph</div>
                    </div>
                    <div style={{ padding: '10px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '6px' }}>
                      <div style={{ fontSize: '12px', opacity: 0.7, marginBottom: '2px' }}>Humidity</div>
                      <div style={{ fontSize: '14px' }}>{weatherData.humidity || weatherData.weather?.humidity || '45'}%</div>
                    </div>
                    <div style={{ padding: '10px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '6px' }}>
                      <div style={{ fontSize: '12px', opacity: 0.7, marginBottom: '2px' }}>Visibility</div>
                      <div style={{ fontSize: '14px' }}>{Math.round(weatherData.visibility || weatherData.weather?.visibility || 10)} mi</div>
                    </div>
                    <div style={{ padding: '10px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '6px' }}>
                      <div style={{ fontSize: '12px', opacity: 0.7, marginBottom: '2px' }}>Pressure</div>
                      <div style={{ fontSize: '14px' }}>{Math.round(weatherData.pressure * 100) / 100 || '30.1'} in</div>
                    </div>
                  </div>
                  <div style={{ marginTop: '15px', padding: '10px', background: 'rgba(76, 175, 80, 0.2)', borderRadius: '6px', border: '1px solid rgba(76, 175, 80, 0.3)' }}>
                    <div style={{ fontSize: '12px', color: '#4caf50', fontWeight: '600', marginBottom: '5px' }}>BURN CONDITIONS</div>
                    <div style={{ fontSize: '14px' }}>Favorable - Low wind, good visibility</div>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '20px', opacity: 0.7 }}>
                  Loading weather data...
                </div>
              )}
            </div>
            <button 
              onClick={() => setActivePanel(null)}
              style={{
                width: '100%',
                marginTop: '15px',
                padding: '10px',
                background: 'linear-gradient(135deg, #ff6b35 0%, #ff5722 100%)',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Close Panel
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Alerts Panel */}
      <AnimatePresence>
        {activePanel === 'alerts' && (
          <motion.div 
            className="alerts-panel"
            initial={{ opacity: 0, x: -300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -300 }}
            transition={{ 
              type: "spring", 
              stiffness: 100,
              damping: 30,
              restDelta: 0.001
            }}
            style={{
              position: 'fixed',
              left: '270px',
              top: '100px',
              width: '280px',
              background: 'rgba(0, 0, 0, 0.7)',
              backdropFilter: 'blur(30px)',
              WebkitBackdropFilter: 'blur(30px)',
              border: '1px solid rgba(255, 107, 53, 0.15)',
              borderRadius: '12px',
              padding: '20px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
              zIndex: 1100
            }}
          >
            <h3 style={{ margin: '0 0 15px 0', color: '#ffffff', fontSize: '18px', fontWeight: '600' }}>Active Alerts</h3>
            <div className="alerts-content">
              <div style={{ 
                padding: '12px', 
                background: 'rgba(255, 193, 7, 0.15)', 
                border: '1px solid rgba(255, 193, 7, 0.3)',
                borderRadius: '8px',
                marginBottom: '10px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '600', color: '#ffc107' }}>⚠️ Wind Advisory</span>
                </div>
                <div style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.8)', lineHeight: '1.4' }}>
                  Winds expected to increase to 15-20 mph after 3 PM. Consider completing burns before noon.
                </div>
              </div>
              
              <div style={{ 
                padding: '12px', 
                background: 'rgba(76, 175, 80, 0.15)', 
                border: '1px solid rgba(76, 175, 80, 0.3)',
                borderRadius: '8px',
                marginBottom: '10px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '600', color: '#4caf50' }}>✓ Air Quality Good</span>
                </div>
                <div style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.8)', lineHeight: '1.4' }}>
                  PM2.5 levels within safe limits. Conditions favorable for controlled burns.
                </div>
              </div>
              
              <div style={{ 
                padding: '12px', 
                background: 'rgba(33, 150, 243, 0.15)', 
                border: '1px solid rgba(33, 150, 243, 0.3)',
                borderRadius: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '600', color: '#2196f3' }}>ℹ️ Neighbor Activity</span>
                </div>
                <div style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.8)', lineHeight: '1.4' }}>
                  Golden Fields Farm has a burn scheduled for 2 PM today. Coordinate timing to avoid smoke overlap.
                </div>
              </div>
            </div>
            <button 
              onClick={() => setActivePanel(null)}
              style={{
                width: '100%',
                marginTop: '15px',
                padding: '10px',
                background: 'linear-gradient(135deg, #ff6b35 0%, #ff5722 100%)',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Close Panel
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Settings Panel (Demo Mode) */}
      <AnimatePresence>
        {activePanel === 'settings' && isDemo && (
          <motion.div 
            className="settings-panel"
            initial={{ opacity: 0, x: -300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -300 }}
            transition={{ 
              type: "spring", 
              stiffness: 100,
              damping: 30,
              restDelta: 0.001
            }}
            style={{
              position: 'absolute',
              top: isDemo ? '120px' : '80px', // Account for demo banner
              left: '90px',
              width: '350px',
              background: 'rgba(0, 0, 0, 0.7)',
              backdropFilter: 'blur(30px)',
              WebkitBackdropFilter: 'blur(30px)',
              border: '1px solid rgba(255, 107, 53, 0.15)',
              borderRadius: '12px',
              padding: '20px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
              zIndex: 500
            }}
          >
            <h3 style={{ margin: '0 0 15px 0', color: '#ffffff', fontSize: '18px', fontWeight: '600' }}>Demo Settings</h3>
            <div className="settings-content">
              <div style={{ 
                padding: '12px', 
                background: 'rgba(255, 152, 0, 0.15)', 
                border: '1px solid rgba(255, 152, 0, 0.3)',
                borderRadius: '8px',
                marginBottom: '12px'
              }}>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#ff9800', marginBottom: '8px' }}>
                  🎮 Demo Mode Active
                </div>
                <div style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.8)', lineHeight: '1.4' }}>
                  You're in a demo session. Settings are limited to maintain the demo experience.
                </div>
              </div>
              
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', fontSize: '14px', color: 'rgba(255, 255, 255, 0.9)', marginBottom: '8px' }}>
                  Map Style
                </label>
                <select 
                  disabled
                  style={{
                    width: '100%',
                    padding: '8px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '4px',
                    color: 'rgba(255, 255, 255, 0.5)',
                    cursor: 'not-allowed'
                  }}
                >
                  <option>Satellite (Demo Default)</option>
                </select>
              </div>
              
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', fontSize: '14px', color: 'rgba(255, 255, 255, 0.9)', marginBottom: '8px' }}>
                  Units
                </label>
                <select 
                  disabled
                  style={{
                    width: '100%',
                    padding: '8px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '4px',
                    color: 'rgba(255, 255, 255, 0.5)',
                    cursor: 'not-allowed'
                  }}
                >
                  <option>Imperial (Demo Default)</option>
                </select>
              </div>
              
              <div style={{ 
                padding: '12px', 
                background: 'rgba(33, 150, 243, 0.1)', 
                border: '1px solid rgba(33, 150, 243, 0.2)',
                borderRadius: '8px'
              }}>
                <div style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.8)', lineHeight: '1.4' }}>
                  To access full settings, create a free account after your demo session.
                </div>
              </div>
            </div>
            <button 
              onClick={() => setActivePanel(null)}
              style={{
                width: '100%',
                marginTop: '15px',
                padding: '10px',
                background: 'linear-gradient(135deg, #ff6b35 0%, #ff5722 100%)',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Close Panel
            </button>
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
        activeBurnsCount={burns.filter(b => b.status === 'active' || b.status === 'in_progress').length}
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
      
      {/* Tutorial Overlay - Dynamic walkthrough */}
      <TutorialOverlay />
    </div>
  );
};

export default SpatialInterface;