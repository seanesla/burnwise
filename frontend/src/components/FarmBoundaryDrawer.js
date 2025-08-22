/**
 * FarmBoundaryDrawer - Map-based farm boundary drawing component
 * Allows farmers to draw precise property boundaries instead of typing location
 * Automatically calculates acreage and supports multiple parcels
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import * as turf from '@turf/turf';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaDrawPolygon, FaUndo, FaRedo, FaTrash, 
  FaFileImport, FaFileExport, FaSatellite,
  FaRuler, FaCheck, FaTimes, FaInfoCircle
} from 'react-icons/fa';
import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import './FarmBoundaryDrawer.css';

// Set Mapbox token - must check if mapboxgl is loaded
if (typeof mapboxgl !== 'undefined' && mapboxgl) {
  mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_TOKEN;
  console.log('Mapbox token set successfully');
} else {
  console.error('Mapbox GL JS not loaded yet');
}

const FarmBoundaryDrawer = ({ 
  onBoundaryComplete, 
  initialBoundary = null,
  initialLocation = null 
}) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const draw = useRef(null);
  const fileInputRef = useRef(null);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentArea, setCurrentArea] = useState(0);
  const [parcels, setParcels] = useState([]);
  const [mapStyle, setMapStyle] = useState('satellite');
  const [showInstructions, setShowInstructions] = useState(true);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [currentPoints, setCurrentPoints] = useState(0);
  const [showIncompleteWarning, setShowIncompleteWarning] = useState(false);

  // Initialize map - ONLY ONCE to prevent flickering
  useEffect(() => {
    // Check if container exists and we haven't initialized yet
    if (!mapContainer.current) return;
    
    // Check if map already exists
    if (map.current) {
      console.log('Map already exists, skipping initialization');
      return;
    }
    
    console.log('Map container element:', mapContainer.current);
    console.log('Container dimensions:', {
      width: mapContainer.current.offsetWidth,
      height: mapContainer.current.offsetHeight
    });
    
    // Ensure Mapbox GL JS is loaded and token is set
    if (!mapboxgl || typeof mapboxgl === 'undefined') {
      console.error('Mapbox GL JS is not loaded');
      return;
    }
    
    // Set the access token here as well to ensure it's set
    if (!mapboxgl.accessToken) {
      mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_TOKEN;
      console.log('Setting Mapbox token in useEffect');
    }
    
    if (!mapboxgl.accessToken) {
      console.error('Mapbox access token is not set');
      return;
    }
    
    console.log('Mapbox token verified:', mapboxgl.accessToken ? 'Yes' : 'No');
    
    // Determine initial center
    let center = [-121.74, 38.544]; // Default Sacramento
    let zoom = 10;
    
    if (initialLocation) {
      // Parse location string to get rough coordinates
      center = initialLocation.coordinates || center;
      zoom = 14;
    }
    
    if (initialBoundary) {
      // Center on existing boundary
      const bbox = turf.bbox(initialBoundary);
      center = turf.center(initialBoundary).geometry.coordinates;
      zoom = 15;
    }
    
    try {
      console.log('Creating map with container:', mapContainer.current);
      console.log('Token before map creation:', mapboxgl.accessToken);
      
      // Create the map - ensure container ID is unique
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/satellite-v9', // Using satellite-v9 which is more stable
        center: center,
        zoom: zoom,
        pitch: 0,
        attributionControl: false,
        preserveDrawingBuffer: true, // Helps with rendering issues
        fadeDuration: 0, // Disable fade animation
        trackResize: true // Track container resize
      });
      
      console.log('Map instance created');
      
      // Force immediate render
      map.current.once('style.load', () => {
        console.log('Style loaded successfully');
        map.current.resize();
      });
      
      // Check canvas and force render after a delay
      setTimeout(() => {
        if (!map.current || !mapContainer.current) return;
        
        const canvas = mapContainer.current.querySelector('.mapboxgl-canvas');
        if (canvas) {
          console.log('Canvas found with dimensions:', canvas.width, 'x', canvas.height);
          // Force resize and repaint
          map.current.resize();
          map.current.triggerRepaint();
          
          // Check if canvas context is valid
          const ctx = canvas.getContext('webgl') || canvas.getContext('webgl2');
          if (!ctx) {
            console.error('WebGL context not available');
          } else {
            console.log('WebGL context is valid');
          }
        } else {
          console.error('Canvas not found after timeout');
        }
      }, 1000);
      
    } catch (error) {
      console.error('Error creating map:', error);
      console.error('Full error:', error);
      return;
    }

    // Initialize draw controls
    draw.current = new MapboxDraw({
      displayControlsDefault: false,
      controls: {
        polygon: true,
        trash: true
      },
      defaultMode: 'simple_select',
      styles: [
        // Style for polygon fill
        {
          'id': 'gl-draw-polygon-fill',
          'type': 'fill',
          'filter': ['all', ['==', '$type', 'Polygon']],
          'paint': {
            'fill-color': '#ff6b35',
            'fill-opacity': 0.3
          }
        },
        // Style for polygon outline
        {
          'id': 'gl-draw-polygon-stroke',
          'type': 'line',
          'filter': ['all', ['==', '$type', 'Polygon']],
          'layout': {
            'line-cap': 'round',
            'line-join': 'round'
          },
          'paint': {
            'line-color': '#ff6b35',
            'line-width': 3
          }
        },
        // Style for vertices
        {
          'id': 'gl-draw-point',
          'type': 'circle',
          'filter': ['all', ['==', '$type', 'Point']],
          'paint': {
            'circle-radius': 6,
            'circle-color': '#ffffff',
            'circle-stroke-color': '#ff6b35',
            'circle-stroke-width': 2
          }
        }
      ]
    });

    // Add debugging for map events
    map.current.on('error', (e) => {
      console.error('Map error event:', e);
      if (e.error) {
        console.error('Error details:', e.error.message);
      }
    });
    
    map.current.on('styledata', () => {
      console.log('Map styledata event - style is loading');
    });
    
    map.current.on('idle', () => {
      console.log('Map idle - fully rendered');
      const container = mapContainer.current;
      if (container) {
        const canvas = container.querySelector('.mapboxgl-canvas');
        console.log('Canvas check on idle:', !!canvas);
        if (canvas) {
          console.log('Canvas size:', canvas.width, 'x', canvas.height);
        }
      }
    });

    // Wait for map to load before adding controls
    map.current.on('load', () => {
      console.log('Map load event fired - map fully loaded');
      map.current.addControl(draw.current);
      setMapLoaded(true);

      // Load initial boundary if exists
      if (initialBoundary) {
        draw.current.add(initialBoundary);
        calculateArea();
      }

      // Event handlers
      map.current.on('draw.create', handleDrawCreate);
      map.current.on('draw.update', handleDrawUpdate);
      map.current.on('draw.delete', handleDrawDelete);
      map.current.on('draw.modechange', handleModeChange);
      
      // Track points being added during drawing
      map.current.on('click', (e) => {
        if (draw.current && draw.current.getMode() === 'draw_polygon') {
          setCurrentPoints(prev => prev + 1);
        }
      });
    });

    // Only cleanup when component truly unmounts
    // Not during re-renders
    return () => {
      console.log('Effect cleanup called - checking if we should remove map');
      // We'll clean up the map only when the component is truly unmounting
      // For now, disable cleanup to prevent map removal
    };
  }, []); // Empty dependency array - initialize only once

  // Calculate area from drawn features - MUST BE DEFINED BEFORE USE
  const calculateArea = useCallback(() => {
    if (!draw.current) return;
    
    const data = draw.current.getAll();
    let totalArea = 0;
    const parcelList = [];

    data.features.forEach((feature, index) => {
      if (feature.geometry.type === 'Polygon') {
        // Calculate area in square meters
        const areaM2 = turf.area(feature);
        // Convert to acres (1 acre = 4046.86 m²)
        const areaAcres = areaM2 / 4046.86;
        
        totalArea += areaAcres;
        parcelList.push({
          id: feature.id,
          area: areaAcres,
          geometry: feature.geometry
        });
      }
    });

    setCurrentArea(totalArea);
    setParcels(parcelList);
    
    // Notify parent component
    if (onBoundaryComplete && totalArea > 0) {
      onBoundaryComplete({
        type: 'FeatureCollection',
        features: data.features,
        properties: {
          totalAcres: totalArea,
          parcelCount: parcelList.length
        }
      });
    }
  }, [onBoundaryComplete]);

  // Handle boundary updates after initial load
  useEffect(() => {
    if (!mapLoaded || !draw.current || !initialBoundary) return;
    
    // Only update if the boundary actually changed
    const currentFeatures = draw.current.getAll();
    if (currentFeatures.features.length === 0) {
      draw.current.add(initialBoundary);
      calculateArea();
    }
  }, [initialBoundary, mapLoaded, calculateArea]);

  // Handle draw create
  const handleDrawCreate = useCallback((e) => {
    const feature = e.features[0];
    if (feature && feature.geometry.type === 'Polygon') {
      // Validate the polygon has at least 3 points
      if (feature.geometry.coordinates[0] && feature.geometry.coordinates[0].length >= 4) {
        calculateArea();
        // Don't automatically exit drawing mode - let user decide
        // setIsDrawing(false);
      }
    }
  }, [calculateArea]);

  // Handle draw update
  const handleDrawUpdate = useCallback((e) => {
    // Debounce area calculation to prevent rapid updates
    if (e.features.length > 0) {
      calculateArea();
    }
  }, [calculateArea]);

  // Handle draw delete
  const handleDrawDelete = useCallback((e) => {
    calculateArea();
  }, [calculateArea]);

  // Handle mode change
  const handleModeChange = useCallback((e) => {
    // Only update state if it actually changed to prevent flicker
    const newIsDrawing = e.mode === 'draw_polygon';
    setIsDrawing(prev => prev !== newIsDrawing ? newIsDrawing : prev);
  }, []);

  // Start drawing
  const startDrawing = () => {
    if (draw.current && mapLoaded && !isDrawing) {
      // Prevent multiple rapid calls
      const currentMode = draw.current.getMode();
      if (currentMode === 'draw_polygon') {
        return; // Already in draw mode, don't switch again
      }
      
      // Small delay to prevent flicker
      setIsDrawing(true);
      setShowInstructions(false);
      
      setTimeout(() => {
        if (draw.current) {
          draw.current.changeMode('draw_polygon');
        }
      }, 50);
    }
  };

  // Complete drawing
  const completeDrawing = () => {
    if (draw.current) {
      // Get the current drawing to validate it
      const data = draw.current.getAll();
      let hasValidPolygon = false;
      
      // Check if there's a polygon with at least 3 points (4 including closing point)
      data.features.forEach(feature => {
        if (feature.geometry.type === 'Polygon' && 
            feature.geometry.coordinates[0] && 
            feature.geometry.coordinates[0].length >= 4) {
          hasValidPolygon = true;
        }
      });
      
      if (!hasValidPolygon) {
        // Show warning instead of alert
        setShowIncompleteWarning(true);
        setTimeout(() => setShowIncompleteWarning(false), 3000);
        return;
      }
      
      draw.current.changeMode('simple_select');
      setIsDrawing(false);
      setCurrentPoints(0);
      calculateArea();
    }
  };

  // Cancel drawing
  const cancelDrawing = () => {
    if (draw.current) {
      // Get all features and remove the incomplete one
      const data = draw.current.getAll();
      if (data.features.length > 0) {
        const lastFeature = data.features[data.features.length - 1];
        // Check if it's an incomplete polygon
        if (lastFeature.geometry.coordinates[0].length < 4) {
          draw.current.delete(lastFeature.id);
        }
      }
      draw.current.changeMode('simple_select');
      setIsDrawing(false);
      setCurrentPoints(0);
      setShowIncompleteWarning(false);
    }
  };

  // Clear all drawings
  const clearAll = () => {
    if (draw.current) {
      draw.current.deleteAll();
      setCurrentArea(0);
      setParcels([]);
      if (onBoundaryComplete) {
        onBoundaryComplete(null);
      }
    }
  };

  // Toggle map style
  const toggleMapStyle = () => {
    if (!map.current) return;
    
    const newStyle = mapStyle === 'satellite' 
      ? 'mapbox://styles/mapbox/streets-v12'
      : 'mapbox://styles/mapbox/satellite-streets-v12';
    
    map.current.setStyle(newStyle);
    setMapStyle(mapStyle === 'satellite' ? 'streets' : 'satellite');
  };

  // Import GeoJSON/KML
  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        let geojson;
        
        if (file.name.endsWith('.geojson') || file.name.endsWith('.json')) {
          geojson = JSON.parse(event.target.result);
        } else if (file.name.endsWith('.kml')) {
          // Would need to add KML parsing library
          console.warn('KML import not yet implemented');
          return;
        }

        if (geojson && draw.current) {
          // Clear existing
          draw.current.deleteAll();
          
          // Add imported features
          if (geojson.type === 'Feature') {
            draw.current.add(geojson);
          } else if (geojson.type === 'FeatureCollection') {
            geojson.features.forEach(feature => {
              draw.current.add(feature);
            });
          }
          
          // Calculate area and fit bounds
          calculateArea();
          
          const bbox = turf.bbox(geojson);
          map.current.fitBounds(bbox, { padding: 50 });
        }
      } catch (error) {
        console.error('Import failed:', error);
        alert('Failed to import file. Please ensure it\'s valid GeoJSON.');
      }
    };
    
    reader.readAsText(file);
  };

  // Export as GeoJSON
  const handleExport = () => {
    if (!draw.current) return;
    
    const data = draw.current.getAll();
    if (data.features.length === 0) {
      alert('No boundaries to export');
      return;
    }

    // Add metadata
    data.properties = {
      exportDate: new Date().toISOString(),
      totalAcres: currentArea,
      parcelCount: parcels.length
    };

    const dataStr = JSON.stringify(data, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `farm-boundary-${Date.now()}.geojson`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="farm-boundary-drawer">
      {/* Map Container */}
      <div ref={mapContainer} className="boundary-map" />

      {/* Drawing Tools */}
      <div className="drawing-tools">
        {!isDrawing ? (
          <>
            <button
              className="tool-btn"
              onClick={startDrawing}
              title={mapLoaded ? "Draw Farm Boundary" : "Map loading..."}
              disabled={!mapLoaded}
            >
              <FaDrawPolygon />
            </button>
            
            <button
              className="tool-btn"
              onClick={clearAll}
              title="Clear Boundary"
              disabled={currentArea === 0}
            >
              <FaTrash />
            </button>
          </>
        ) : (
          <>
            <button
              className="tool-btn complete-btn"
              onClick={completeDrawing}
              title="Complete Boundary"
            >
              <FaCheck />
            </button>
            
            <button
              className="tool-btn cancel-btn"
              onClick={cancelDrawing}
              title="Cancel Drawing"
            >
              <FaTimes />
            </button>
          </>
        )}

        <button
          className="tool-btn"
          onClick={toggleMapStyle}
          title="Toggle Satellite/Street View"
        >
          <FaSatellite />
        </button>

        <button
          className="tool-btn"
          onClick={() => fileInputRef.current?.click()}
          title="Import GeoJSON/KML"
        >
          <FaFileImport />
        </button>
        
        <button
          className="tool-btn"
          onClick={handleExport}
          title="Export as GeoJSON"
          disabled={parcels.length === 0}
        >
          <FaFileExport />
        </button>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".geojson,.json,.kml"
        onChange={handleImport}
        style={{ display: 'none' }}
      />

      {/* Area Display */}
      <div className="area-display">
        <FaRuler />
        <span className="area-value">
          {currentArea.toFixed(2)} acres
        </span>
        {parcels.length > 1 && (
          <span className="parcel-count">
            ({parcels.length} parcels)
          </span>
        )}
      </div>

      {/* Drawing Mode Indicator */}
      {isDrawing && (
        <div className="drawing-mode-indicator">
          <div className="drawing-mode-content">
            <div className="drawing-mode-info">
              <span className="drawing-mode-text">
                Click on the map to draw your farm boundary
              </span>
              <span className="points-count">
                {currentPoints < 3 ? (
                  <span style={{ color: '#ffa500' }}>
                    {currentPoints}/3 points minimum
                  </span>
                ) : (
                  <span style={{ color: '#4ade80' }}>
                    {currentPoints} points placed
                  </span>
                )}
              </span>
            </div>
            <button 
              className="btn-complete-drawing"
              onClick={completeDrawing}
            >
              <FaCheck /> Complete Boundary
            </button>
          </div>
          {showIncompleteWarning && (
            <div className="incomplete-warning">
              <FaInfoCircle /> Need at least 3 points to form a closed shape
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      <AnimatePresence>
        {showInstructions && (
          <motion.div
            className="drawing-instructions"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <button
              className="close-instructions"
              onClick={() => setShowInstructions(false)}
            >
              <FaTimes />
            </button>
            <h4>
              <FaInfoCircle />
              How to Draw Your Farm Boundary
            </h4>
            <ol>
              <li>Click the polygon tool to start drawing</li>
              <li>Click on the map to add boundary points</li>
              <li>Click the first point again to close the shape</li>
              <li>Drag points to adjust the boundary</li>
              <li>Draw multiple parcels if your farm is non-contiguous</li>
            </ol>
            <p className="tip">
              Tip: Toggle to satellite view for better visibility of property lines
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Parcel List (if multiple) */}
      {parcels.length > 1 && (
        <div className="parcel-list">
          <h4>Farm Parcels</h4>
          {parcels.map((parcel, index) => (
            <div key={parcel.id} className="parcel-item">
              <span>Parcel {index + 1}</span>
              <span>{parcel.area.toFixed(2)} acres</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FarmBoundaryDrawer;