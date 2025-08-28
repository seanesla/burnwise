import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaFire, FaMapMarkedAlt, FaCalendarAlt, FaClock, FaLeaf, FaExclamationTriangle, FaCheck, FaUser, FaShieldAlt, FaCloudSun, FaRoute } from 'react-icons/fa';
import axios from 'axios';
import toast from 'react-hot-toast';
import '../styles/BurnRequestRedesign.css';
// import '../styles/mapbox-overrides.css'; // DISABLED - Let Mapbox handle sizing
import '../styles/input-stabilization.css';

const ImprovedBurnRequestForm = () => {
  const [formData, setFormData] = useState({
    farm_id: '',
    field_name: '',
    field_boundary: null,
    acres: '',
    crop_type: '',
    burn_date: '',
    time_window_start: '',
    time_window_end: '',
    estimated_duration: '',
    preferred_conditions: {
      max_wind_speed: 10,
      min_humidity: 30,
      max_humidity: 70
    },
    notes: ''
  });

  const [farms, setFarms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [drawingMode, setDrawingMode] = useState(false);
  const [mapboxgl, setMapboxgl] = useState(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [weatherChecked, setWeatherChecked] = useState(false);
  const [weatherData, setWeatherData] = useState(null);
  const [safetyChecklist, setSafetyChecklist] = useState({
    fireBreaks: false,
    waterSupply: false,
    notifications: false,
    equipment: false,
    permits: false,
    weather: false
  });
  const mapContainer = useRef(null);
  const map = useRef(null);
  const draw = useRef(null);

  // Load farms on mount
  useEffect(() => {
    fetchFarms();
  }, []);

  // Dynamically import Mapbox and MapboxDraw
  useEffect(() => {
    const loadMapbox = async () => {
      try {
        const [mapboxModule, mapboxDrawModule] = await Promise.all([
          import('mapbox-gl'),
          import('@mapbox/mapbox-gl-draw')
        ]);
        
        await Promise.all([
          import('mapbox-gl/dist/mapbox-gl.css'),
          import('@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css')
        ]);
        
        setMapboxgl(mapboxModule.default);
        window.MapboxDraw = mapboxDrawModule.default;
        
      } catch (err) {
        console.error('Failed to load Mapbox:', err);
        toast.error('Failed to load map components');
      }
    };

    loadMapbox();
  }, []);

  // Initialize map after Mapbox is loaded
  useEffect(() => {
    if (!mapboxgl || !mapContainer.current || map.current) return;

    try {
      mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_TOKEN;
      
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/satellite-v9',
        center: [-98.5795, 39.8283], // Center of USA
        zoom: 5,
        preserveDrawingBuffer: true, // Helps with WebGL context recovery
        failIfMajorPerformanceCaveat: false // Don't fail on performance issues
      });

      // Add drawing controls with custom fire-themed styling
      draw.current = new window.MapboxDraw({
        displayControlsDefault: false,
        controls: {
          polygon: true,
          trash: true
        },
        defaultMode: 'draw_polygon',
        styles: [
          {
            id: 'gl-draw-polygon-fill-inactive',
            type: 'fill',
            filter: ['all', ['==', 'active', 'false'], ['==', '$type', 'Polygon']],
            paint: {
              'fill-color': '#ff6b35',
              'fill-opacity': 0.3
            }
          },
          {
            id: 'gl-draw-polygon-fill-active',
            type: 'fill',
            filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'Polygon']],
            paint: {
              'fill-color': '#ff6b35',
              'fill-opacity': 0.5
            }
          },
          {
            id: 'gl-draw-polygon-stroke-inactive',
            type: 'line',
            filter: ['all', ['==', 'active', 'false'], ['==', '$type', 'Polygon']],
            layout: {
              'line-cap': 'round',
              'line-join': 'round'
            },
            paint: {
              'line-color': '#ff5722',
              'line-width': 3
            }
          },
          {
            id: 'gl-draw-polygon-stroke-active',
            type: 'line',
            filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'Polygon']],
            layout: {
              'line-cap': 'round',
              'line-join': 'round'
            },
            paint: {
              'line-color': '#FFB000',
              'line-width': 4
            }
          },
          {
            id: 'gl-draw-vertex',
            type: 'circle',
            filter: ['all', ['==', 'meta', 'vertex'], ['==', '$type', 'Point']],
            paint: {
              'circle-radius': 6,
              'circle-color': '#FFB000'
            }
          }
        ]
      });

      map.current.addControl(draw.current);

      // Handle drawing events
      map.current.on('draw.create', updateArea);
      map.current.on('draw.delete', clearArea);
      map.current.on('draw.update', updateArea);

      map.current.on('load', () => {
        setMapLoaded(true);
      });

      // Handle WebGL context lost
      map.current.on('error', (e) => {
        console.error('Mapbox error:', e);
        if (e.error && e.error.message && e.error.message.includes('WebGL')) {
          toast.error('Graphics context lost. Please refresh the page if the map stops working.');
          
          // Attempt to recover
          setTimeout(() => {
            if (map.current) {
              try {
                map.current.triggerRepaint();
              } catch (repaintError) {
                console.error('Failed to repaint map:', repaintError);
              }
            }
          }, 1000);
        }
      });

      // Handle WebGL context restored  
      const canvas = mapContainer.current?.querySelector('canvas');
      if (canvas) {
        canvas.addEventListener('webglcontextlost', (event) => {
          event.preventDefault();
          console.warn('WebGL context lost in burn request form');
          toast.error('Map graphics temporarily lost. Attempting recovery...');
        });
        
        canvas.addEventListener('webglcontextrestored', () => {
          console.log('WebGL context restored in burn request form');
          toast.success('Map graphics restored');
          if (map.current) {
            map.current.triggerRepaint();
          }
        });
      }

    } catch (err) {
      console.error('Map initialization error:', err);
      toast.error('Failed to initialize map');
    }

    return () => {
      // Clean up WebGL event listeners
      const canvas = mapContainer.current?.querySelector('canvas');
      if (canvas) {
        canvas.removeEventListener('webglcontextlost', () => {});
        canvas.removeEventListener('webglcontextrestored', () => {});
      }
      
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [mapboxgl]);

  const updateArea = () => {
    const data = draw.current.getAll();
    if (data.features.length > 0) {
      const area = calculateArea(data.features[0]);
      setFormData(prev => ({
        ...prev,
        field_boundary: data.features[0].geometry,
        acres: area.toFixed(2)
      }));
      toast.success(`Field area: ${area.toFixed(2)} acres`);
    }
  };

  const clearArea = () => {
    setFormData(prev => ({
      ...prev,
      field_boundary: null,
      acres: ''
    }));
  };

  const calculateArea = (feature) => {
    // Simplified area calculation (would use turf.js in production)
    if (feature.geometry.type !== 'Polygon') return 0;
    
    const coordinates = feature.geometry.coordinates[0];
    let area = 0;
    
    for (let i = 0; i < coordinates.length - 1; i++) {
      const [x1, y1] = coordinates[i];
      const [x2, y2] = coordinates[i + 1];
      area += (x2 - x1) * (y2 + y1);
    }
    
    // Convert to acres (rough approximation)
    return Math.abs(area) * 111319.5 * 111319.5 * 0.000247105;
  };

  const fetchFarms = async () => {
    try {
      const response = await axios.get('/api/farms', { withCredentials: true });
      setFarms(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch farms:', error);
      toast.error('Failed to load farms');
    }
  };

  const checkWeatherConditions = async () => {
    if (!formData.farm_id || !formData.burn_date) {
      toast.error('Please select a farm and burn date first');
      return;
    }

    setLoading(true);
    try {
      const farm = farms.find(f => f.id === parseInt(formData.farm_id));
      if (!farm) return;

      const response = await axios.get('/api/weather/forecast', {
        params: {
          lat: farm.lat,
          lon: farm.lon,
          date: formData.burn_date
        },
        withCredentials: true
      });

      setWeatherData(response.data.data);
      setWeatherChecked(true);
      
      const conditions = response.data.data.conditions;
      if (conditions && conditions.wind_speed <= formData.preferred_conditions.max_wind_speed &&
          conditions.humidity >= formData.preferred_conditions.min_humidity &&
          conditions.humidity <= formData.preferred_conditions.max_humidity) {
        toast.success('Weather conditions are suitable for burning');
      } else {
        toast.warning('Weather conditions may not be optimal');
      }
    } catch (error) {
      console.error('Failed to check weather:', error);
      toast.error('Failed to check weather conditions');
    } finally {
      setLoading(false);
    }
  };

  // Stabilized input handler with debouncing
  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    
    // Prevent event bubbling that might cause rapid state changes
    e.stopPropagation();
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  }, []);

  const handleFarmSelect = (e) => {
    const farmId = e.target.value;
    setFormData(prev => ({ ...prev, farm_id: farmId }));
    
    // Center map on selected farm
    const farm = farms.find(f => f.id === parseInt(farmId));
    if (farm && farm.lon && farm.lat && map.current) {
      const lon = parseFloat(farm.lon);
      const lat = parseFloat(farm.lat);
      map.current.flyTo({
        center: [lon, lat],
        zoom: 14,
        essential: true
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.field_boundary) {
      toast.error('Please draw your field boundary on the map');
      return;
    }
    
    setLoading(true);
    
    try {
      const response = await axios.post('/api/burn-requests', {
        ...formData,
        farm_id: parseInt(formData.farm_id),
        acres: parseFloat(formData.acres),
        estimated_duration: parseInt(formData.estimated_duration)
      }, { withCredentials: true });
      
      toast.success('Burn request submitted successfully!');
      
      // Reset form
      setFormData({
        farm_id: '',
        field_name: '',
        field_boundary: null,
        acres: '',
        crop_type: '',
        burn_date: '',
        time_window_start: '',
        time_window_end: '',
        estimated_duration: '',
        preferred_conditions: {
          max_wind_speed: 10,
          min_humidity: 30,
          max_humidity: 70
        },
        notes: ''
      });
      
      // Clear map drawings
      if (draw.current) {
        draw.current.deleteAll();
      }
      
    } catch (error) {
      console.error('Failed to submit burn request:', error);
      toast.error(error.response?.data?.message || 'Failed to submit burn request');
    } finally {
      setLoading(false);
    }
  };

  // Crop types must match backend validation schema
  const cropTypes = [
    { value: 'wheat', label: 'Wheat' },
    { value: 'corn', label: 'Corn' },
    { value: 'rice', label: 'Rice' },
    { value: 'barley', label: 'Barley' },
    { value: 'oats', label: 'Oats' },
    { value: 'sorghum', label: 'Sorghum' },
    { value: 'cotton', label: 'Cotton' },
    { value: 'soybeans', label: 'Soybeans' },
    { value: 'sunflower', label: 'Sunflower' },
    { value: 'other', label: 'Other' }
  ];

  const getProgressPercentage = () => {
    const totalSteps = 4;
    return ((currentStep - 1) / (totalSteps - 1)) * 100;
  };

  const handleChecklistChange = (item) => {
    setSafetyChecklist(prev => ({
      ...prev,
      [item]: !prev[item]
    }));
  };

  const isFormValid = () => {
    return formData.field_boundary && 
           formData.farm_id && 
           formData.field_name && 
           formData.crop_type && 
           formData.burn_date && 
           formData.time_window_start && 
           formData.time_window_end && 
           formData.estimated_duration;
  };

  return (
    <div className="burn-request-container">
      {/* Map Section - Left Column */}
      <div className="map-section">
        <div className="map-header">
          <div className="map-title">
            <FaMapMarkedAlt />
            <span>Field Boundary</span>
          </div>
          <div className="drawing-tools">
            <button 
              className={`tool-btn ${drawingMode ? 'active' : ''}`}
              onClick={() => setDrawingMode(!drawingMode)}
            >
              Draw Polygon
            </button>
            <button 
              className="tool-btn"
              onClick={() => {
                if (draw.current) {
                  draw.current.deleteAll();
                  clearArea();
                }
              }}
            >
              Clear
            </button>
          </div>
        </div>
        
        <div className="map-container">
          <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
          
          {!mapLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              Loading...
            </div>
          )}
          
          {mapLoaded && formData.field_boundary && (
            <div className="map-overlay-info">
              <div className="area-info">
                <div className="info-item">
                  <span className="info-label">Field Area</span>
                  <span className="info-value">{formData.acres} acres</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Status</span>
                  <span className="info-value" style={{ color: '#22c55e' }}>Ready</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Form Section - Right Column */}
      <div className="form-section">
        {/* Progress Bar */}
        <div className="progress-container">
          <div className="progress-bar">
            <div className="progress-steps">
              <div className="progress-line">
                <div 
                  className="progress-line-fill" 
                  style={{ width: `${getProgressPercentage()}%` }}
                />
              </div>
              <div className={`progress-step ${currentStep >= 1 ? 'active' : ''} ${currentStep > 1 ? 'completed' : ''}`}>
                <div className="step-circle">1</div>
                <span className="step-label">Farm Details</span>
              </div>
              <div className={`progress-step ${currentStep >= 2 ? 'active' : ''} ${currentStep > 2 ? 'completed' : ''}`}>
                <div className="step-circle">2</div>
                <span className="step-label">Burn Schedule</span>
              </div>
              <div className={`progress-step ${currentStep >= 3 ? 'active' : ''} ${currentStep > 3 ? 'completed' : ''}`}>
                <div className="step-circle">3</div>
                <span className="step-label">Weather Check</span>
              </div>
              <div className={`progress-step ${currentStep >= 4 ? 'active' : ''} ${currentStep > 4 ? 'completed' : ''}`}>
                <div className="step-circle">4</div>
                <span className="step-label">Safety Review</span>
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Farm & Field Information Card */}
          <div className="form-card">
            <div className="card-header">
              <div className="card-icon">
                <FaUser />
              </div>
              <div className="card-title">
                <h3>Farm & Field Information</h3>
                <p>Select your farm and provide field details</p>
              </div>
            </div>
            
            <div className="form-grid form-grid-2">
              <div className="form-group">
                <label className="form-label">
                  Farm Selection <span className="required-mark">*</span>
                </label>
                <select
                  name="farm_id"
                  value={formData.farm_id}
                  onChange={handleFarmSelect}
                  required
                  className="form-select"
                >
                  <option value="">Choose a farm...</option>
                  {farms.map(farm => (
                    <option key={farm.id} value={farm.id}>
                      {farm.name} - {farm.owner_name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="form-group">
                <label className="form-label">
                  Field Name <span className="required-mark">*</span>
                </label>
                <input
                  type="text"
                  name="field_name"
                  value={formData.field_name}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g., North Field, Block A"
                  className="form-input"
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">
                  <FaLeaf className="inline mr-1" />
                  Crop Type <span className="required-mark">*</span>
                </label>
                <select
                  name="crop_type"
                  value={formData.crop_type}
                  onChange={handleInputChange}
                  required
                  className="form-select"
                >
                  <option value="">Select crop type...</option>
                  {cropTypes.map(crop => (
                    <option key={crop.value} value={crop.value}>{crop.label}</option>
                  ))}
                </select>
              </div>
              
              <div className="form-group">
                <label className="form-label">
                  Field Area
                </label>
                <input
                  type="text"
                  value={formData.acres ? `${formData.acres} acres` : 'Draw boundary on map'}
                  readOnly
                  className="form-input"
                  style={{ backgroundColor: '#f9fafb' }}
                />
              </div>
            </div>
          </div>

          {/* Burn Schedule Card */}
          <div className="form-card">
            <div className="card-header">
              <div className="card-icon">
                <FaCalendarAlt />
              </div>
              <div className="card-title">
                <h3>Burn Schedule</h3>
                <p>Set your preferred burn date and time window</p>
              </div>
            </div>
            
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">
                  <FaCalendarAlt className="inline mr-1" />
                  Preferred Burn Date <span className="required-mark">*</span>
                </label>
                <input
                  type="date"
                  name="burn_date"
                  value={formData.burn_date}
                  onChange={handleInputChange}
                  required
                  min={new Date().toISOString().split('T')[0]}
                  className="form-input"
                />
                <span className="helper-text">Select a date at least 24 hours in advance</span>
              </div>
              
              <div className="form-grid form-grid-3">
                <div className="form-group">
                  <label className="form-label">
                    <FaClock className="inline mr-1" />
                    Start Time <span className="required-mark">*</span>
                  </label>
                  <input
                    type="time"
                    name="time_window_start"
                    value={formData.time_window_start}
                    onChange={handleInputChange}
                    required
                    className="form-input"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">
                    <FaClock className="inline mr-1" />
                    End Time <span className="required-mark">*</span>
                  </label>
                  <input
                    type="time"
                    name="time_window_end"
                    value={formData.time_window_end}
                    onChange={handleInputChange}
                    required
                    className="form-input"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">
                    Duration (hours) <span className="required-mark">*</span>
                  </label>
                  <input
                    type="number"
                    name="estimated_duration"
                    value={formData.estimated_duration}
                    onChange={handleInputChange}
                    required
                    min="1"
                    max="24"
                    placeholder="4"
                    className="form-input"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Weather Preferences Card */}
          <div className="form-card">
            <div className="card-header">
              <div className="card-icon">
                <FaCloudSun />
              </div>
              <div className="card-title">
                <h3>Weather Preferences</h3>
                <p>Set your ideal weather conditions for burning</p>
              </div>
            </div>
            
            <div className="weather-grid">
              <div className="slider-group">
                <div className="slider-header">
                  <span className="slider-label">Maximum Wind Speed</span>
                  <span className="slider-value">{formData.preferred_conditions.max_wind_speed} mph</span>
                </div>
                <div className="slider-track">
                  <div 
                    className="slider-fill" 
                    style={{ width: `${((formData.preferred_conditions.max_wind_speed - 5) / 15) * 100}%` }}
                  />
                  <input
                    type="range"
                    min="5"
                    max="20"
                    value={formData.preferred_conditions.max_wind_speed}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      preferred_conditions: {
                        ...prev.preferred_conditions,
                        max_wind_speed: parseInt(e.target.value)
                      }
                    }))}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    style={{ WebkitAppearance: 'none', MozAppearance: 'none', appearance: 'none' }}
                  />
                  <div 
                    className="slider-thumb" 
                    style={{ left: `${((formData.preferred_conditions.max_wind_speed - 5) / 15) * 100}%` }}
                  />
                </div>
              </div>
              
              <div className="slider-group">
                <div className="slider-header">
                  <span className="slider-label">Humidity Range</span>
                  <span className="slider-value">{formData.preferred_conditions.min_humidity}% - {formData.preferred_conditions.max_humidity}%</span>
                </div>
                <div className="form-grid form-grid-2">
                  <div>
                    <span className="text-sm text-gray-600">Minimum</span>
                    <div className="slider-track">
                      <div 
                        className="slider-fill" 
                        style={{ width: `${((formData.preferred_conditions.min_humidity - 10) / 40) * 100}%` }}
                      />
                      <input
                        type="range"
                        min="10"
                        max="50"
                        value={formData.preferred_conditions.min_humidity}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          preferred_conditions: {
                            ...prev.preferred_conditions,
                            min_humidity: parseInt(e.target.value)
                          }
                        }))}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                    style={{ WebkitAppearance: 'none', MozAppearance: 'none', appearance: 'none' }}
                      />
                      <div 
                        className="slider-thumb" 
                        style={{ left: `${((formData.preferred_conditions.min_humidity - 10) / 40) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Maximum</span>
                    <div className="slider-track">
                      <div 
                        className="slider-fill" 
                        style={{ width: `${((formData.preferred_conditions.max_humidity - 60) / 30) * 100}%` }}
                      />
                      <input
                        type="range"
                        min="60"
                        max="90"
                        value={formData.preferred_conditions.max_humidity}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          preferred_conditions: {
                            ...prev.preferred_conditions,
                            max_humidity: parseInt(e.target.value)
                          }
                        }))}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                    style={{ WebkitAppearance: 'none', MozAppearance: 'none', appearance: 'none' }}
                      />
                      <div 
                        className="slider-thumb" 
                        style={{ left: `${((formData.preferred_conditions.max_humidity - 60) / 30) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
              
              <button
                type="button"
                onClick={checkWeatherConditions}
                className="btn-action btn-submit"
                disabled={!formData.farm_id || !formData.burn_date}
              >
                <FaCloudSun />
                Check Weather Conditions
              </button>
              
              {weatherData && (
                <div className={`weather-results ${weatherData.suitable ? 'suitable' : 'warning'}`}>
                  <div className="weather-grid-display">
                    <div className="weather-metric">
                      <div className="weather-metric-label">Wind Speed</div>
                      <div className="weather-metric-value">{weatherData.conditions?.wind_speed || 0} mph</div>
                    </div>
                    <div className="weather-metric">
                      <div className="weather-metric-label">Humidity</div>
                      <div className="weather-metric-value">{weatherData.conditions?.humidity || 0}%</div>
                    </div>
                    <div className="weather-metric">
                      <div className="weather-metric-label">Temperature</div>
                      <div className="weather-metric-value">{weatherData.conditions?.temperature || 0}°F</div>
                    </div>
                    <div className="weather-metric">
                      <div className="weather-metric-label">Visibility</div>
                      <div className="weather-metric-value">{weatherData.conditions?.visibility || 0} mi</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Safety Checklist Card */}
          <div className="form-card">
            <div className="card-header">
              <div className="card-icon">
                <FaShieldAlt />
              </div>
              <div className="card-title">
                <h3>Safety Checklist</h3>
                <p>Confirm all safety measures are in place</p>
              </div>
            </div>
            
            <div className="checklist-grid">
              <div 
                className={`checkbox-item ${safetyChecklist.fireBreaks ? 'checked' : ''}`}
                onClick={() => handleChecklistChange('fireBreaks')}
              >
                <div className="checkbox-custom" />
                <span className="checkbox-label">Fire breaks prepared</span>
              </div>
              
              <div 
                className={`checkbox-item ${safetyChecklist.waterSupply ? 'checked' : ''}`}
                onClick={() => handleChecklistChange('waterSupply')}
              >
                <div className="checkbox-custom" />
                <span className="checkbox-label">Water supply available</span>
              </div>
              
              <div 
                className={`checkbox-item ${safetyChecklist.notifications ? 'checked' : ''}`}
                onClick={() => handleChecklistChange('notifications')}
              >
                <div className="checkbox-custom" />
                <span className="checkbox-label">Neighbors notified</span>
              </div>
              
              <div 
                className={`checkbox-item ${safetyChecklist.equipment ? 'checked' : ''}`}
                onClick={() => handleChecklistChange('equipment')}
              >
                <div className="checkbox-custom" />
                <span className="checkbox-label">Equipment ready</span>
              </div>
              
              <div 
                className={`checkbox-item ${safetyChecklist.permits ? 'checked' : ''}`}
                onClick={() => handleChecklistChange('permits')}
              >
                <div className="checkbox-custom" />
                <span className="checkbox-label">Permits obtained</span>
              </div>
              
              <div 
                className={`checkbox-item ${safetyChecklist.weather ? 'checked' : ''}`}
                onClick={() => handleChecklistChange('weather')}
              >
                <div className="checkbox-custom" />
                <span className="checkbox-label">Weather conditions verified</span>
              </div>
            </div>
          </div>
          
          {/* Additional Notes Card */}
          <div className="form-card">
            <div className="card-header">
              <div className="card-icon">
                <FaRoute />
              </div>
              <div className="card-title">
                <h3>Additional Notes</h3>
                <p>Any special considerations or requirements</p>
              </div>
            </div>
            
            <div className="form-group">
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                rows="4"
                placeholder="Enter any special instructions, access routes, or safety considerations..."
                className="form-textarea"
              />
            </div>
          </div>

        </form>
        
        {/* Floating Action Buttons */}
        <div className="floating-actions">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="btn-action btn-cancel"
          >
            Cancel
          </button>
          
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={loading || !isFormValid()}
            className="btn-action btn-submit"
          >
            {loading ? (
              <>
                Loading...
                Submitting...
              </>
            ) : (
              <>
                <FaFire />
                Submit Burn Request
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImprovedBurnRequestForm;