/**
 * MapContext.js - Share map location state between components
 * Provides current map center coordinates for weather and other location-based features
 */

import React, { createContext, useContext, useState, useEffect } from 'react';

const MapContext = createContext();

export const useMap = () => {
  const context = useContext(MapContext);
  if (!context) {
    throw new Error('useMap must be used within MapProvider');
  }
  return context;
};

export const MapProvider = ({ children }) => {
  // Default to California Central Valley
  const [mapCenter, setMapCenter] = useState({
    lat: 38.544,
    lng: -121.740,
    zoom: 10
  });
  
  // Selected farm (if any)
  const [selectedFarm, setSelectedFarm] = useState(null);
  
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
  
  // Try to get user's browser location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          // Update to user's location if available
          updateMapCenter(
            position.coords.latitude,
            position.coords.longitude
          );
        },
        (error) => {
          // Keep default location if geolocation fails
          console.log('Geolocation not available, using default location');
        }
      );
    }
  }, []);
  
  const value = {
    mapCenter,
    selectedFarm,
    setSelectedFarm,
    updateMapCenter,
    getCurrentLocation
  };
  
  return <MapContext.Provider value={value}>{children}</MapContext.Provider>;
};