import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import MapboxWebGLHandler from './MapboxWebGLHandler';

const MapOptimized = () => {
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapboxgl, setMapboxgl] = useState(null);
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [burnRequests, setBurnRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Dynamically import Mapbox only when needed
  useEffect(() => {
    const loadMapbox = async () => {
      try {
        const mapboxModule = await import('mapbox-gl');
        await import('mapbox-gl/dist/mapbox-gl.css');
        setMapboxgl(mapboxModule.default);
      } catch (err) {
        console.error('Failed to load Mapbox:', err);
        setError('Failed to load map library');
      }
    };

    loadMapbox();
  }, []);

  // Cleanup function for map
  const cleanupMap = useCallback(() => {
    if (map.current) {
      try {
        // Remove all sources and layers
        if (map.current.getStyle()) {
          const style = map.current.getStyle();
          if (style.layers) {
            style.layers.forEach(layer => {
              if (layer.id.includes('burn-')) {
                map.current.removeLayer(layer.id);
              }
            });
          }
          if (style.sources) {
            Object.keys(style.sources).forEach(source => {
              if (source.includes('burn-')) {
                map.current.removeSource(source);
              }
            });
          }
        }
        
        // Remove the map
        map.current.remove();
        map.current = null;
      } catch (err) {
        console.error('Error cleaning up map:', err);
      }
    }
  }, []);

  // Initialize map after Mapbox is loaded
  useEffect(() => {
    if (!mapboxgl || !mapContainer.current || map.current) return;

    try {
      mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_TOKEN;
      
      // Enable WebGL context preservation
      mapboxgl.prewarm();
      
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: [-98.5795, 39.8283], // Center of USA
        zoom: 4,
        pitch: 0,
        bearing: 0,
        attributionControl: false,
        preserveDrawingBuffer: true, // Helps with context recovery
        failIfMajorPerformanceCaveat: false // Don't fail on performance issues
      });

      // Add navigation controls
      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

      // Add fullscreen control
      map.current.addControl(new mapboxgl.FullscreenControl(), 'top-right');

      // Map loaded event
      map.current.on('load', () => {
        setMapLoaded(true);
        setLoading(false);
        
        // Add 3D terrain
        map.current.addSource('mapbox-dem', {
          type: 'raster-dem',
          url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
          tileSize: 512,
          maxzoom: 14
        });

        map.current.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });

        // Add fire-themed styling
        map.current.setPaintProperty('background', 'background-color', '#0a0a0a');
        
        fetchBurnRequests();
      });

      // Handle errors
      map.current.on('error', (e) => {
        console.error('Mapbox error:', e);
        if (e.error && e.error.message && e.error.message.includes('WebGL')) {
          setError('WebGL error detected. The map may need to be reloaded.');
        }
      });
      
      // Cleanup on unmount
      return () => {
        cleanupMap();
      };
    } catch (err) {
      console.error('Map initialization error:', err);
      setError('Failed to initialize map');
      setLoading(false);
    }
  }, [mapboxgl, cleanupMap]);

  const fetchBurnRequests = async () => {
    try {
      const response = await fetch('/api/burn-requests', {
        headers: {
          'Cache-Control': 'max-age=60' // Client-side cache
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch burn requests');
      
      const data = await response.json();
      setBurnRequests(data.data || []);
      
      if (map.current && data.data) {
        addBurnRequestsToMap(data.data);
      }
    } catch (err) {
      console.error('Error fetching burn requests:', err);
    }
  };

  const addBurnRequestsToMap = (requests) => {
    if (!map.current || !mapboxgl) return;

    // Add source for burn requests
    if (!map.current.getSource('burn-requests')) {
      map.current.addSource('burn-requests', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: requests.map(req => ({
            type: 'Feature',
            geometry: req.field_boundary || {
              type: 'Point',
              coordinates: [-98.5795, 39.8283] // Default location
            },
            properties: {
              id: req.id,
              farm_name: req.farm_name,
              field_name: req.field_name,
              acres: req.acres,
              status: req.status,
              burn_date: req.burn_date,
              priority_score: req.priority_score
            }
          }))
        }
      });

      // Add layer for burn areas
      map.current.addLayer({
        id: 'burn-areas',
        type: 'fill',
        source: 'burn-requests',
        paint: {
          'fill-color': [
            'match',
            ['get', 'status'],
            'approved', '#4CAF50',
            'pending', '#FFB000',
            'completed', '#2196F3',
            'rejected', '#f44336',
            '#808080'
          ],
          'fill-opacity': 0.6
        }
      });

      // Add border layer
      map.current.addLayer({
        id: 'burn-areas-border',
        type: 'line',
        source: 'burn-requests',
        paint: {
          'line-color': '#ff6b35',
          'line-width': 2
        }
      });

      // Add click event for popups
      map.current.on('click', 'burn-areas', (e) => {
        const properties = e.features[0].properties;
        
        new mapboxgl.Popup()
          .setLngLat(e.lngLat)
          .setHTML(`
            <div class="mapbox-popup">
              <h3>${properties.farm_name}</h3>
              <p><strong>Field:</strong> ${properties.field_name}</p>
              <p><strong>Acres:</strong> ${properties.acres}</p>
              <p><strong>Status:</strong> ${properties.status}</p>
              <p><strong>Date:</strong> ${new Date(properties.burn_date).toLocaleDateString()}</p>
              <p><strong>Priority:</strong> ${properties.priority_score}/100</p>
            </div>
          `)
          .addTo(map.current);
      });

      // Change cursor on hover
      map.current.on('mouseenter', 'burn-areas', () => {
        map.current.getCanvas().style.cursor = 'pointer';
      });

      map.current.on('mouseleave', 'burn-areas', () => {
        map.current.getCanvas().style.cursor = '';
      });
    }
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-dark">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Map Error</h2>
          <p className="text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  // Handle WebGL context issues
  const handleContextLost = useCallback(() => {
    console.log('WebGL context lost in MapOptimized');
    cleanupMap();
    setMapLoaded(false);
    setLoading(true);
  }, [cleanupMap]);

  const handleContextRestored = useCallback(() => {
    console.log('WebGL context restored in MapOptimized');
    // Map will be re-initialized by the effect hook
    setMapboxgl(null);
    setTimeout(() => {
      window.location.reload(); // Simplest way to restore
    }, 500);
  }, []);

  return (
    <MapboxWebGLHandler 
      onContextLost={handleContextLost}
      onContextRestored={handleContextRestored}
    >
      <div className="relative h-screen w-full bg-gradient-dark">
        {loading && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 flex items-center justify-center z-10 bg-black/50"
        >
          <div className="text-center">
            Loading...
            <p className="text-white mt-4">Loading map...</p>
          </div>
        </motion.div>
      )}

      <div ref={mapContainer} className="absolute inset-0" />

      {mapLoaded && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
          className="absolute top-4 left-4 glass-card p-4 max-w-xs"
        >
          <h2 className="text-xl font-bold text-white mb-2">
            Burn Coordination Map
          </h2>
          <p className="text-gray-400 text-sm mb-3">
            Active burn requests across all farms
          </p>
          
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-300">Approved</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <span className="text-sm text-gray-300">Pending</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span className="text-sm text-gray-300">Completed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span className="text-sm text-gray-300">Rejected</span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-700">
            <p className="text-sm text-gray-400">
              Total Requests: <span className="text-white font-semibold">{burnRequests.length}</span>
            </p>
          </div>
        </motion.div>
      )}
      </div>
    </MapboxWebGLHandler>
  );
};

export default MapOptimized;