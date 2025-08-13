import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import * as turf from '@turf/turf';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import '../styles/FieldDrawMap.css';

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_TOKEN;

const FieldDrawMap = ({ onFieldDrawn, existingFields = [], savedFields = [] }) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const draw = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [selectedField, setSelectedField] = useState(null);
  const [areaHectares, setAreaHectares] = useState(0);
  const [drawMode, setDrawMode] = useState(false);

  useEffect(() => {
    if (map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12', // Satellite view for farmers
      center: [-95.7, 39.05], // Kansas agricultural area
      zoom: 13
    });

    draw.current = new MapboxDraw({
      displayControlsDefault: false,
      controls: {
        polygon: true,
        trash: true
      },
      defaultMode: 'simple_select'
    });

    map.current.addControl(draw.current);
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    
    // Add geolocation control
    map.current.addControl(
      new mapboxgl.GeolocateControl({
        positionOptions: {
          enableHighAccuracy: true
        },
        trackUserLocation: true,
        showUserHeading: true
      }),
      'top-right'
    );

    map.current.on('load', () => {
      setMapReady(true);
      
      // Add saved fields layer
      if (savedFields.length > 0) {
        map.current.addSource('saved-fields', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: savedFields.map(field => ({
              type: 'Feature',
              properties: {
                name: field.name,
                id: field.id,
                area: field.area
              },
              geometry: field.geometry
            }))
          }
        });

        map.current.addLayer({
          id: 'saved-fields-fill',
          type: 'fill',
          source: 'saved-fields',
          paint: {
            'fill-color': '#3bb2d0',
            'fill-opacity': 0.3
          }
        });

        map.current.addLayer({
          id: 'saved-fields-outline',
          type: 'line',
          source: 'saved-fields',
          paint: {
            'line-color': '#3bb2d0',
            'line-width': 2
          }
        });

        map.current.addLayer({
          id: 'saved-fields-labels',
          type: 'symbol',
          source: 'saved-fields',
          layout: {
            'text-field': ['get', 'name'],
            'text-size': 14,
            'text-anchor': 'center'
          },
          paint: {
            'text-color': '#ffffff',
            'text-halo-color': '#000000',
            'text-halo-width': 2
          }
        });

        // Make saved fields clickable
        map.current.on('click', 'saved-fields-fill', (e) => {
          const field = e.features[0];
          setSelectedField(field);
          setAreaHectares(field.properties.area);
          
          // Clear any existing drawings
          draw.current.deleteAll();
          
          // Add selected field to draw
          draw.current.add(field);
          
          if (onFieldDrawn) {
            onFieldDrawn({
              geometry: field.geometry,
              area: field.properties.area,
              fieldId: field.properties.id,
              fieldName: field.properties.name
            });
          }
        });

        map.current.on('mouseenter', 'saved-fields-fill', () => {
          map.current.getCanvas().style.cursor = 'pointer';
        });

        map.current.on('mouseleave', 'saved-fields-fill', () => {
          map.current.getCanvas().style.cursor = '';
        });
      }
    });

    // Handle drawing events
    map.current.on('draw.create', updateArea);
    map.current.on('draw.delete', updateArea);
    map.current.on('draw.update', updateArea);

    function updateArea(e) {
      const data = draw.current.getAll();
      if (data.features.length > 0) {
        const area = turf.area(data);
        const hectares = (area / 10000).toFixed(2);
        setAreaHectares(hectares);
        
        if (onFieldDrawn) {
          onFieldDrawn({
            geometry: data.features[0].geometry,
            area: hectares,
            fieldId: null,
            fieldName: null
          });
        }
      } else {
        setAreaHectares(0);
        if (onFieldDrawn) {
          onFieldDrawn(null);
        }
      }
    }
  }, [onFieldDrawn, savedFields]);

  const startDrawing = () => {
    setDrawMode(true);
    setSelectedField(null);
    draw.current.deleteAll();
    draw.current.changeMode('draw_polygon');
  };

  const clearDrawing = () => {
    draw.current.deleteAll();
    setAreaHectares(0);
    setSelectedField(null);
    setDrawMode(false);
    if (onFieldDrawn) {
      onFieldDrawn(null);
    }
  };

  return (
    <div className="field-draw-map">
      <div className="map-header">
        <h3>📍 Select Your Field</h3>
        <div className="map-instructions">
          {!drawMode && !selectedField && (
            <p>Click "Draw Field" to outline your burn area, or select a saved field below</p>
          )}
          {drawMode && (
            <p>Click on the map to draw your field boundary. Click the first point to complete.</p>
          )}
          {selectedField && (
            <p>Selected: {selectedField.properties.name}</p>
          )}
        </div>
      </div>

      <div className="map-container" ref={mapContainer} />
      
      <div className="map-controls">
        <div className="area-display">
          {areaHectares > 0 && (
            <div className="area-info">
              <span className="area-label">Field Size:</span>
              <span className="area-value">{areaHectares} hectares</span>
              <span className="area-acres">({(areaHectares * 2.47105).toFixed(2)} acres)</span>
            </div>
          )}
        </div>
        
        <div className="map-actions">
          {!drawMode && !selectedField && (
            <button 
              className="btn-draw-field"
              onClick={startDrawing}
            >
              ✏️ Draw New Field
            </button>
          )}
          
          {(drawMode || selectedField) && (
            <button 
              className="btn-clear"
              onClick={clearDrawing}
            >
              🗑️ Clear Selection
            </button>
          )}
        </div>
      </div>

      {savedFields.length > 0 && (
        <div className="saved-fields">
          <h4>Your Saved Fields:</h4>
          <div className="saved-fields-list">
            {savedFields.map(field => (
              <button
                key={field.id}
                className={`saved-field-btn ${selectedField?.properties?.id === field.id ? 'selected' : ''}`}
                onClick={() => {
                  // Zoom to field
                  const bounds = turf.bbox(field.geometry);
                  map.current.fitBounds(bounds, { padding: 50 });
                }}
              >
                <span className="field-name">{field.name}</span>
                <span className="field-size">{field.area} ha</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FieldDrawMap;