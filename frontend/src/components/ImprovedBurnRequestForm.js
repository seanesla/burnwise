import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaFire, FaMapMarkedAlt, FaCalendarAlt, FaClock, FaLeaf, FaExclamationTriangle } from 'react-icons/fa';
import axios from 'axios';
import toast from 'react-hot-toast';
import LoadingSpinner from './LoadingSpinner';

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
        zoom: 5
      });

      // Add drawing controls
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

    } catch (err) {
      console.error('Map initialization error:', err);
      toast.error('Failed to initialize map');
    }

    return () => {
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
      const response = await axios.get('/api/farms');
      setFarms(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch farms:', error);
      toast.error('Failed to load farms');
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFarmSelect = (e) => {
    const farmId = e.target.value;
    setFormData(prev => ({ ...prev, farm_id: farmId }));
    
    // Center map on selected farm
    const farm = farms.find(f => f.id === parseInt(farmId));
    if (farm && map.current) {
      const [lon, lat] = farm.location.coordinates;
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
      });
      
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

  const cropTypes = [
    'Wheat Stubble',
    'Corn Residue',
    'Soybean Stubble',
    'Rice Straw',
    'Sugarcane',
    'Grass Pasture',
    'Other'
  ];

  return (
    <div className="min-h-screen bg-gradient-dark p-6">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
            <FaFire className="text-fire-orange" />
            Submit Burn Request
          </h1>
          <p className="text-gray-400">
            Draw your field boundary on the map and provide burn details
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Map Section */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass-card p-6"
          >
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <FaMapMarkedAlt className="text-fire-orange" />
              Draw Field Boundary
            </h2>
            
            <div className="relative">
              <div 
                ref={mapContainer} 
                className="w-full h-96 rounded-lg overflow-hidden"
              />
              
              {!mapLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
                  <LoadingSpinner size="large" />
                </div>
              )}
              
              {mapLoaded && formData.field_boundary && (
                <div className="absolute top-4 right-4 bg-black/80 text-white px-3 py-2 rounded">
                  Area: {formData.acres} acres
                </div>
              )}
            </div>
            
            <p className="text-gray-400 text-sm mt-3">
              Click to draw points around your field. Double-click to complete the polygon.
            </p>
          </motion.div>

          {/* Form Section */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass-card p-6"
          >
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Farm Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Select Farm
                </label>
                <select
                  name="farm_id"
                  value={formData.farm_id}
                  onChange={handleFarmSelect}
                  required
                  className="w-full px-4 py-2 bg-black/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-fire-orange transition-colors"
                >
                  <option value="">Choose a farm...</option>
                  {farms.map(farm => (
                    <option key={farm.id} value={farm.id}>
                      {farm.name} - {farm.owner_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Field Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Field Name/Identifier
                </label>
                <input
                  type="text"
                  name="field_name"
                  value={formData.field_name}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g., North Field, Block A"
                  className="w-full px-4 py-2 bg-black/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-fire-orange transition-colors"
                />
              </div>

              {/* Crop Type */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  <FaLeaf className="inline mr-1" />
                  Crop Type
                </label>
                <select
                  name="crop_type"
                  value={formData.crop_type}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 bg-black/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-fire-orange transition-colors"
                >
                  <option value="">Select crop type...</option>
                  {cropTypes.map(crop => (
                    <option key={crop} value={crop}>{crop}</option>
                  ))}
                </select>
              </div>

              {/* Burn Date */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  <FaCalendarAlt className="inline mr-1" />
                  Preferred Burn Date
                </label>
                <input
                  type="date"
                  name="burn_date"
                  value={formData.burn_date}
                  onChange={handleInputChange}
                  required
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-2 bg-black/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-fire-orange transition-colors"
                />
              </div>

              {/* Time Window */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    <FaClock className="inline mr-1" />
                    Start Time
                  </label>
                  <input
                    type="time"
                    name="time_window_start"
                    value={formData.time_window_start}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2 bg-black/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-fire-orange transition-colors"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    <FaClock className="inline mr-1" />
                    End Time
                  </label>
                  <input
                    type="time"
                    name="time_window_end"
                    value={formData.time_window_end}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2 bg-black/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-fire-orange transition-colors"
                  />
                </div>
              </div>

              {/* Estimated Duration */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Estimated Burn Duration (hours)
                </label>
                <input
                  type="number"
                  name="estimated_duration"
                  value={formData.estimated_duration}
                  onChange={handleInputChange}
                  required
                  min="1"
                  max="24"
                  placeholder="e.g., 4"
                  className="w-full px-4 py-2 bg-black/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-fire-orange transition-colors"
                />
              </div>

              {/* Weather Preferences */}
              <div className="bg-black/30 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-gray-300 mb-3">
                  Preferred Weather Conditions
                </h3>
                
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-400">
                      Max Wind Speed: {formData.preferred_conditions.max_wind_speed} mph
                    </label>
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
                      className="w-full accent-fire-orange"
                    />
                  </div>
                  
                  <div>
                    <label className="text-xs text-gray-400">
                      Humidity Range: {formData.preferred_conditions.min_humidity}% - {formData.preferred_conditions.max_humidity}%
                    </label>
                    <div className="flex gap-2">
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
                        className="w-full accent-fire-orange"
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
                        className="w-full accent-fire-orange"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Additional Notes
                </label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows="3"
                  placeholder="Any special considerations..."
                  className="w-full px-4 py-2 bg-black/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-fire-orange transition-colors resize-none"
                />
              </div>

              {/* Warning */}
              {!formData.field_boundary && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                  <p className="text-yellow-400 text-sm flex items-center gap-2">
                    <FaExclamationTriangle />
                    Please draw your field boundary on the map
                  </p>
                </div>
              )}

              {/* Submit Button */}
              <motion.button
                type="submit"
                disabled={loading || !formData.field_boundary}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`w-full py-3 px-6 rounded-lg font-semibold text-white transition-all duration-200 ${
                  loading || !formData.field_boundary
                    ? 'bg-gray-700 cursor-not-allowed'
                    : 'bg-gradient-to-r from-fire-orange to-fire-red hover:shadow-lg hover:shadow-fire-orange/30'
                }`}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <LoadingSpinner size="small" color="#fff" />
                    Submitting...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <FaFire />
                    Submit Burn Request
                  </span>
                )}
              </motion.button>
            </form>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default ImprovedBurnRequestForm;