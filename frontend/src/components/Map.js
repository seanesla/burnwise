import React, { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import toast from 'react-hot-toast';
import { FaFire } from 'react-icons/fa';
import BurnRequestModal from './BurnRequestModal';

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_TOKEN;

const Map = ({ farms = [], burnRequests = [], selectedDate = new Date().toISOString().split('T')[0] }) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [lng, setLng] = useState(-121.740); // Davis, California
  const [lat, setLat] = useState(38.544);    // Davis, California  
  const [zoom, setZoom] = useState(9);       // Closer zoom for California Central Valley
  const [smokeOverlays, setSmokeOverlays] = useState([]);
  const [farmsData, setFarmsData] = useState(farms);
  const [burnData, setBurnData] = useState(burnRequests);
  const [showBurnModal, setShowBurnModal] = useState(false);

  useEffect(() => {
    if (farms.length === 0) {
      fetchFarms();
    }
    if (burnRequests.length === 0) {
      fetchBurnRequests();
    }
  }, [selectedDate]);

  const fetchFarms = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5001'}/api/farms`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setFarmsData(data.data || []);
        }
      }
    } catch (error) {
      console.error('Error fetching farms:', error);
      setFarmsData([]);
    }
  };

  const fetchBurnRequests = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5001'}/api/burn-requests?date=${selectedDate}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setBurnData(data.data || []);
        }
      }
    } catch (error) {
      console.error('Error fetching burn requests:', error);
      setBurnData([]);
    }
  };

  useEffect(() => {
    if (map.current) return;
    
    if (!mapboxgl.accessToken) {
      toast.error('Mapbox token not configured. Please set REACT_APP_MAPBOX_TOKEN in frontend/.env');
      return;
    }

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/satellite-v9', // Use stable satellite style
        center: [lng, lat],
        zoom: zoom,
        attributionControl: true
      });

      map.current.on('load', () => {
        console.log('Map loaded successfully');
        addFarmLayers();
        addBurnRequestLayers();
        addSmokeDispersionLayers();
      });

      map.current.on('error', (e) => {
        console.error('Map error:', e);
        if (e.error && e.error.status === 401) {
          toast.error('Invalid Mapbox token. Please check your API key.');
        }
      });

      map.current.on('move', () => {
        setLng(map.current.getCenter().lng.toFixed(4));
        setLat(map.current.getCenter().lat.toFixed(4));
        setZoom(map.current.getZoom().toFixed(2));
      });
    } catch (error) {
      console.error('Failed to initialize map:', error);
      toast.error('Failed to load map. Please check console for details.');
    }

    return () => {
      if (map.current) {
        map.current.remove();
      }
    };
  }, []);

  useEffect(() => {
    if (map.current && map.current.isStyleLoaded()) {
      updateBurnRequestLayers();
      fetchSmokeDispersion();
    }
  }, [burnData, farmsData, selectedDate]);

  const addFarmLayers = () => {
    if (!map.current || !farmsData.length) return;

    const farmFeatures = farmsData.map(farm => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [farm.longitude, farm.latitude]
      },
      properties: {
        id: farm.farm_id,
        name: farm.farm_name,
        owner: farm.owner_name,
        area: farm.total_area_hectares
      }
    }));

    if (!map.current.getSource('farms')) {
      map.current.addSource('farms', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: farmFeatures
        }
      });

      map.current.addLayer({
        id: 'farms-circle',
        type: 'circle',
        source: 'farms',
        paint: {
          'circle-radius': 10,
          'circle-color': '#22c55e',
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 2
        }
      });

      map.current.addLayer({
        id: 'farms-label',
        type: 'symbol',
        source: 'farms',
        layout: {
          'text-field': ['get', 'name'],
          'text-offset': [0, 1.5],
          'text-size': 12
        },
        paint: {
          'text-color': '#fff',
          'text-halo-color': '#000',
          'text-halo-width': 1
        }
      });

      map.current.on('click', 'farms-circle', (e) => {
        const properties = e.features[0].properties;
        new mapboxgl.Popup()
          .setLngLat(e.features[0].geometry.coordinates)
          .setHTML(`
            <div class="popup">
              <h3>${properties.name}</h3>
              <p>Owner: ${properties.owner}</p>
              <p>Area: ${properties.area} hectares</p>
            </div>
          `)
          .addTo(map.current);
      });

      map.current.on('mouseenter', 'farms-circle', () => {
        map.current.getCanvas().style.cursor = 'pointer';
      });

      map.current.on('mouseleave', 'farms-circle', () => {
        map.current.getCanvas().style.cursor = '';
      });
    }
  };

  const addBurnRequestLayers = () => {
    if (!map.current || !burnData.length) return;

    const burnFeatures = burnData.map(burn => {
      if (!burn.geometry) return null;
      
      return {
        type: 'Feature',
        geometry: burn.geometry,
        properties: {
          id: burn.request_id,
          status: burn.status,
          area: burn.area_hectares,
          cropType: burn.crop_type,
          farmName: burn.farm_name,
          requestedDate: burn.requested_date,
          startTime: burn.requested_start_time
        }
      };
    }).filter(Boolean);

    if (!map.current.getSource('burn-requests')) {
      map.current.addSource('burn-requests', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: burnFeatures
        }
      });

      map.current.addLayer({
        id: 'burn-areas',
        type: 'fill',
        source: 'burn-requests',
        paint: {
          'fill-color': [
            'match',
            ['get', 'status'],
            'pending', '#FFB000',
            'approved', '#ff9800',
            'scheduled', '#ff6b35',
            'active', '#ff5722',
            'completed', 'rgba(255, 255, 255, 0.3)',
            'rgba(255, 255, 255, 0.2)'
          ],
          'fill-opacity': 0.6
        }
      });

      map.current.addLayer({
        id: 'burn-areas-outline',
        type: 'line',
        source: 'burn-requests',
        paint: {
          'line-color': '#fff',
          'line-width': 2
        }
      });

      map.current.on('click', 'burn-areas', async (e) => {
        const properties = e.features[0].properties;
        const coordinates = e.lngLat;

        const conflictsRes = await fetch(
          `${process.env.REACT_APP_API_URL || 'http://localhost:5001'}/api/burn-requests/${properties.id}/conflicts`,
          { method: 'POST' }
        );
        const conflicts = await conflictsRes.json();

        new mapboxgl.Popup()
          .setLngLat(coordinates)
          .setHTML(`
            <div class="popup">
              <h3>${properties.farmName}</h3>
              <p><strong>Status:</strong> <span class="status-${properties.status}">${properties.status}</span></p>
              <p><strong>Area:</strong> ${properties.area} hectares</p>
              <p><strong>Crop:</strong> ${properties.cropType}</p>
              <p><strong>Date:</strong> ${properties.requestedDate}</p>
              <p><strong>Time:</strong> ${properties.startTime}</p>
              ${conflicts.data?.conflictsFound > 0 ? 
                `<p class="conflict-warning">${conflicts.data.conflictsFound} conflicts detected</p>` : 
                '<p class="no-conflicts">No conflicts</p>'
              }
            </div>
          `)
          .addTo(map.current);
      });
    } else {
      map.current.getSource('burn-requests').setData({
        type: 'FeatureCollection',
        features: burnFeatures
      });
    }
  };

  const updateBurnRequestLayers = () => {
    addBurnRequestLayers();
  };

  const fetchSmokeDispersion = async () => {
    try {
      const activeBurns = burnData.filter(b => 
        b.status === 'active' || b.status === 'scheduled'
      );

      const dispersions = [];

      for (const burn of activeBurns) {
        if (!burn.geometry) continue;

        const center = calculateCenter(burn.geometry);
        const response = await fetch(
          `${process.env.REACT_APP_API_URL || 'http://localhost:5001'}/api/weather/smoke-dispersion?lat=${center[1]}&lon=${center[0]}&areaHectares=${burn.area_hectares}`
        );
        
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            dispersions.push({
              burnId: burn.request_id,
              center,
              dispersion: data.data.dispersion,
              windDirection: data.data.weather.windDirection
            });
          }
        }
      }

      setSmokeOverlays(dispersions);
      addSmokeDispersionLayers(dispersions);
    } catch (error) {
      console.error('Error fetching smoke dispersion:', error);
    }
  };

  const calculateCenter = (geometry) => {
    if (geometry.type === 'Point') {
      return geometry.coordinates;
    } else if (geometry.type === 'Polygon') {
      const coords = geometry.coordinates[0];
      const lng = coords.reduce((sum, c) => sum + c[0], 0) / coords.length;
      const lat = coords.reduce((sum, c) => sum + c[1], 0) / coords.length;
      return [lng, lat];
    }
    return [0, 0];
  };

  const addSmokeDispersionLayers = (dispersions) => {
    if (!map.current || !dispersions.length) return;

    const smokeFeatures = dispersions.map(d => {
      const plume = createPlumePolygon(
        d.center,
        d.dispersion.maxDispersionKm,
        d.windDirection
      );

      return {
        type: 'Feature',
        geometry: plume,
        properties: {
          burnId: d.burnId,
          maxPM25: d.dispersion.predictions[2]?.pm25 || 0,
          dispersionRadius: d.dispersion.maxDispersionKm
        }
      };
    });

    if (map.current.getSource('smoke-plumes')) {
      map.current.getSource('smoke-plumes').setData({
        type: 'FeatureCollection',
        features: smokeFeatures
      });
    } else {
      map.current.addSource('smoke-plumes', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: smokeFeatures
        }
      });

      map.current.addLayer({
        id: 'smoke-plumes',
        type: 'fill',
        source: 'smoke-plumes',
        paint: {
          'fill-color': [
            'interpolate',
            ['linear'],
            ['get', 'maxPM25'],
            0, 'rgba(255, 255, 255, 0.2)',
            35, 'rgba(255, 255, 0, 0.3)',
            55, 'rgba(255, 165, 0, 0.4)',
            150, 'rgba(255, 0, 0, 0.5)',
            250, 'rgba(128, 0, 128, 0.6)'
          ],
          'fill-opacity': 0.5
        }
      }, 'burn-areas');

      map.current.addLayer({
        id: 'smoke-plumes-outline',
        type: 'line',
        source: 'smoke-plumes',
        paint: {
          'line-color': '#ff6b35',
          'line-width': 1,
          'line-dasharray': [2, 2]
        }
      }, 'burn-areas');
    }
  };

  const createPlumePolygon = (center, radius, windDirection) => {
    const points = [];
    const numPoints = 32;
    const spreadAngle = 30;

    points.push(center);

    for (let i = 0; i <= numPoints; i++) {
      const angle = windDirection - spreadAngle + (i * 2 * spreadAngle / numPoints);
      const rad = (angle * Math.PI) / 180;
      const distance = radius / 111;
      
      const lng = center[0] + distance * Math.sin(rad);
      const lat = center[1] + distance * Math.cos(rad);
      
      points.push([lng, lat]);
    }

    points.push(center);

    return {
      type: 'Polygon',
      coordinates: [points]
    };
  };

  const detectConflicts = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5001'}/api/burn-requests/detect-conflicts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate })
      });

      const result = await response.json();
      
      if (result.success) {
        if (result.count > 0) {
          toast.error(`${result.count} conflicts detected!`);
          highlightConflicts(result.data);
        } else {
          toast.success('No conflicts detected for selected date');
        }
      }
    } catch (error) {
      toast.error('Error detecting conflicts');
      console.error('Error:', error);
    }
  };

  const highlightConflicts = (conflicts) => {
    conflicts.forEach(conflict => {
      if (map.current.getLayer(`conflict-${conflict.conflictId}`)) {
        map.current.removeLayer(`conflict-${conflict.conflictId}`);
        map.current.removeSource(`conflict-${conflict.conflictId}`);
      }

      if (conflict.details.intersection) {
        map.current.addSource(`conflict-${conflict.conflictId}`, {
          type: 'geojson',
          data: conflict.details.intersection
        });

        map.current.addLayer({
          id: `conflict-${conflict.conflictId}`,
          type: 'fill',
          source: `conflict-${conflict.conflictId}`,
          paint: {
            'fill-color': conflict.severity === 'critical' ? '#ff5722' : '#ff6b35',
            'fill-opacity': 0.7,
            'fill-pattern': 'diagonal-stripes'
          }
        });
      }
    });
  };

  return (
    <div className="map-container">
      <div className="map-sidebar">
        <div className="sidebar-section">
          <h3>Map Controls</h3>
          <div className="coordinates">
            Longitude: {lng} | Latitude: {lat} | Zoom: {zoom}
          </div>
        </div>

        <div className="sidebar-section">
          <h3>Legend</h3>
          <div className="legend-item">
            <span className="legend-color farm"></span> Farms
          </div>
          <div className="legend-item">
            <span className="legend-color pending"></span> Pending Burns
          </div>
          <div className="legend-item">
            <span className="legend-color approved"></span> Approved Burns
          </div>
          <div className="legend-item">
            <span className="legend-color scheduled"></span> Scheduled Burns
          </div>
          <div className="legend-item">
            <span className="legend-color active"></span> Active Burns
          </div>
          <div className="legend-item">
            <span className="legend-color smoke"></span> Smoke Dispersion
          </div>
        </div>

        <div className="sidebar-section">
          <h3>Actions</h3>
          <button className="btn btn-primary" onClick={() => setShowBurnModal(true)}>
            <FaFire style={{ display: 'inline', marginRight: '8px' }} /> Request Burn
          </button>
          <button className="btn btn-primary" onClick={detectConflicts}>
            Detect Conflicts
          </button>
          <button className="btn btn-secondary" onClick={fetchSmokeDispersion}>
            Update Smoke Model
          </button>
        </div>

        <div className="sidebar-section">
          <h3>Statistics</h3>
          <div className="stat-item">
            <span>Active Farms:</span> {farmsData.length}
          </div>
          <div className="stat-item">
            <span>Burn Requests:</span> {burnData.length}
          </div>
          <div className="stat-item">
            <span>Active Burns:</span> {burnData.filter(b => b.status === 'active').length}
          </div>
        </div>
      </div>

      <div ref={mapContainer} className="map" />
      
      {showBurnModal && (
        <BurnRequestModal
          farms={farmsData}
          onClose={() => setShowBurnModal(false)}
          onSuccess={() => {
            setShowBurnModal(false);
            fetchBurnRequests();
            toast.success('Burn request submitted successfully!');
          }}
        />
      )}
    </div>
  );
};

export default Map;