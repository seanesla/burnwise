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
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import './FarmBoundaryDrawer.css';

// Mapbox token from env
mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_TOKEN;

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

  // Initialize map
  useEffect(() => {
    if (map.current) return; // Only initialize once
    
    // Determine initial center
    let center = [-121.74, 38.544]; // Default Sacramento
    let zoom = 10;
    
    if (initialLocation) {
      // Parse location string to get rough coordinates
      // This would ideally use a geocoding service
      center = initialLocation.coordinates || center;
      zoom = 14;
    }
    
    if (initialBoundary) {
      // Center on existing boundary
      const bbox = turf.bbox(initialBoundary);
      center = turf.center(initialBoundary).geometry.coordinates;
      zoom = 15;
    }

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: center,
      zoom: zoom,
      pitch: 0
    });

    // Initialize draw controls
    draw.current = new MapboxDraw({
      displayControlsDefault: false,
      controls: {
        polygon: true,
        trash: true
      },
      defaultMode: 'draw_polygon',
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

    map.current.addControl(draw.current);

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

    return () => {
      map.current.remove();
    };
  }, []);

  // Handle draw create
  const handleDrawCreate = useCallback((e) => {
    const feature = e.features[0];
    if (feature && feature.geometry.type === 'Polygon') {
      calculateArea();
      setIsDrawing(false);
    }
  }, []);

  // Handle draw update
  const handleDrawUpdate = useCallback((e) => {
    calculateArea();
  }, []);

  // Handle draw delete
  const handleDrawDelete = useCallback((e) => {
    calculateArea();
  }, []);

  // Handle mode change
  const handleModeChange = useCallback((e) => {
    setIsDrawing(e.mode === 'draw_polygon');
  }, []);

  // Calculate area from drawn features
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

  // Start drawing
  const startDrawing = () => {
    if (draw.current) {
      draw.current.changeMode('draw_polygon');
      setIsDrawing(true);
      setShowInstructions(false);
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
        <button
          className={`tool-btn ${isDrawing ? 'active' : ''}`}
          onClick={startDrawing}
          title="Draw Farm Boundary"
        >
          <FaDrawPolygon />
        </button>
        
        <button
          className="tool-btn"
          onClick={clearAll}
          title="Clear All"
          disabled={parcels.length === 0}
        >
          <FaTrash />
        </button>

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