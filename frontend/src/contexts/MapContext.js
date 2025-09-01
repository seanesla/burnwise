/**
 * MapContext.js - Share map location state between components
 * Provides current map center coordinates for weather and other location-based features
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from './AuthContext';

const MapContext = createContext();

export const useMap = () => {
  const context = useContext(MapContext);
  if (!context) {
    throw new Error('useMap must be used within MapProvider');
  }
  return context;
};

export const MapProvider = ({ children }) => {
  const { isAuthenticated, user, loading } = useAuth();
  
  // Default to California Central Valley
  const [mapCenter, setMapCenter] = useState({
    lat: 38.544,
    lng: -121.740,
    zoom: 10
  });
  
  // Selected farm (if any)
  const [selectedFarm, setSelectedFarm] = useState(null);
  
  // Farm boundary geometry (GeoJSON)
  const [farmBoundary, setFarmBoundary] = useState(null);
  
  // Update map center
  const updateMapCenter = (lat, lng, zoom = null) => {
    setMapCenter(prev => ({
      lat,
      lng,
      zoom: zoom !== null ? zoom : prev.zoom
    }));
  };
  
  // Get current location for weather
  const getCurrentLocation = () => {
    // If a farm is selected, use its location
    if (selectedFarm && selectedFarm.latitude && selectedFarm.longitude) {
      return {
        lat: selectedFarm.latitude,
        lng: selectedFarm.longitude
      };
    }
    // Otherwise use map center
    return {
      lat: mapCenter.lat,
      lng: mapCenter.lng
    };
  };
  
  // Load farm location from database instead of browser geolocation
  useEffect(() => {
    const loadFarmLocation = async () => {
      try {
        // Only fetch if authenticated (AuthContext has validated the session)
        if (loading) {
          console.log('Auth still loading, waiting...');
          return;
        }
        
        if (!isAuthenticated || !user) {
          console.log('Not authenticated, skipping farm location fetch');
          return;
        }
        
        // Get current user's farm data
        const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5001'}/api/farms/current`, {
          credentials: 'include'
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.farm) {
            // Use farm's actual location from database
            if (data.farm.latitude && data.farm.longitude) {
              updateMapCenter(
                data.farm.latitude,
                data.farm.longitude
              );
              // Also set as selected farm
              setSelectedFarm(data.farm);
              
              // Load boundary if available
              if (data.farm.farm_boundary) {
                try {
                  const boundary = typeof data.farm.farm_boundary === 'string' 
                    ? JSON.parse(data.farm.farm_boundary)
                    : data.farm.farm_boundary;
                  setFarmBoundary(boundary);
                } catch (e) {
                  console.error('Failed to parse farm boundary:', e);
                  toast.error('Failed to load farm boundary data');
                }
              }
            } else if (data.farm.location) {
              // Parse location if stored differently
              const [lat, lng] = data.farm.location.split(',').map(Number);
              if (lat && lng) {
                updateMapCenter(lat, lng);
                setSelectedFarm(data.farm);
              }
            }
          }
        }
      } catch (error) {
        console.error('Failed to load farm location:', error);
        toast.error('Failed to load farm location - using default area');
        // Keep default Sacramento location as fallback
      }
    };
    
    loadFarmLocation();
  }, [isAuthenticated, user, loading]); // Re-run when authentication state changes
  
  const value = {
    mapCenter,
    selectedFarm,
    setSelectedFarm,
    farmBoundary,
    setFarmBoundary,
    updateMapCenter,
    getCurrentLocation
  };
  
  return <MapContext.Provider value={value}>{children}</MapContext.Provider>;
};