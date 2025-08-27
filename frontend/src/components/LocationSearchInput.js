/**
 * LocationSearchInput - Mapbox Geocoding API v6 powered location search
 * Real-time autocomplete with debounced search
 * No mocks - production-ready with real API integration
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FaSearch, FaMapMarkerAlt, FaSpinner } from 'react-icons/fa';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import './LocationSearchInput.css';

const LocationSearchInput = ({ onLocationSelect, placeholder = "Search for your farm location..." }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [error, setError] = useState(null);
  
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const debounceTimer = useRef(null);
  
  // Get Mapbox token from environment
  const mapboxToken = process.env.REACT_APP_MAPBOX_TOKEN;
  
  // Debounced search function
  const performSearch = useCallback(async (query) => {
    if (!query || query.trim().length < 3) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }
    
    if (!mapboxToken) {
      setError('Mapbox token not configured');
      console.error('REACT_APP_MAPBOX_TOKEN is not set');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Mapbox Geocoding API v6 forward search
      const response = await axios.get(
        'https://api.mapbox.com/search/geocode/v6/forward',
        {
          params: {
            q: query,
            access_token: mapboxToken,
            autocomplete: true,
            limit: 5,
            types: 'address,place,locality,neighborhood',
            country: 'US',
            language: 'en'
          }
        }
      );
      
      if (response.data && response.data.features) {
        const formattedSuggestions = response.data.features.map(feature => ({
          id: feature.id,
          name: feature.properties.name || feature.properties.place_name || '',
          full_address: feature.properties.full_address || feature.properties.place_formatted || '',
          coordinates: feature.geometry.coordinates,
          context: feature.properties.context || {},
          place_type: feature.properties.feature_type || 'place'
        }));
        
        setSuggestions(formattedSuggestions);
        setShowDropdown(formattedSuggestions.length > 0);
      } else {
        setSuggestions([]);
        setShowDropdown(false);
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      
      if (error.response?.status === 429) {
        setError('Rate limit exceeded. Please wait a moment.');
      } else if (error.response?.status === 401) {
        setError('Invalid Mapbox token');
      } else {
        setError('Failed to search locations. Please try again.');
      }
      
      setSuggestions([]);
      setShowDropdown(false);
    } finally {
      setIsLoading(false);
    }
  }, [mapboxToken]);
  
  // Handle input change with debouncing
  useEffect(() => {
    // Clear previous timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    
    // Set new timer for debounced search (300ms delay)
    debounceTimer.current = setTimeout(() => {
      performSearch(searchQuery);
    }, 300);
    
    // Cleanup
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [searchQuery, performSearch]);
  
  // Handle location selection
  const handleLocationSelect = (suggestion) => {
    // Format the location data for parent component
    const locationData = {
      name: suggestion.name,
      address: suggestion.full_address,
      coordinates: {
        lng: suggestion.coordinates[0],
        lat: suggestion.coordinates[1]
      },
      // Include full context for additional info if needed
      context: suggestion.context
    };
    
    // Update input with selected location
    setSearchQuery(suggestion.full_address || suggestion.name);
    
    // Hide dropdown
    setShowDropdown(false);
    setSuggestions([]);
    setSelectedIndex(-1);
    
    // Notify parent component
    if (onLocationSelect) {
      onLocationSelect(locationData);
    }
  };
  
  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (!showDropdown || suggestions.length === 0) return;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
        
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleLocationSelect(suggestions[selectedIndex]);
        }
        break;
        
      case 'Escape':
        setShowDropdown(false);
        setSelectedIndex(-1);
        break;
        
      default:
        break;
    }
  };
  
  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target) &&
          inputRef.current && !inputRef.current.contains(event.target)) {
        setShowDropdown(false);
        setSelectedIndex(-1);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  return (
    <div className="location-search-container">
      <div className="location-search-input-wrapper">
        <FaSearch className="search-icon" />
        
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
          placeholder={placeholder}
          className="location-search-input"
          autoComplete="off"
          aria-label="Search location"
          aria-expanded={showDropdown}
          aria-controls="location-suggestions"
          role="combobox"
        />
        
        {isLoading && (
          <FaSpinner className="loading-spinner spinning" />
        )}
      </div>
      
      {error && (
        <div className="search-error-message">
          {error}
        </div>
      )}
      
      <AnimatePresence>
        {showDropdown && suggestions.length > 0 && (
          <motion.div
            ref={dropdownRef}
            id="location-suggestions"
            className="location-suggestions-dropdown"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            role="listbox"
          >
            {suggestions.map((suggestion, index) => (
              <motion.div
                key={suggestion.id}
                className={`location-suggestion-item ${
                  index === selectedIndex ? 'selected' : ''
                }`}
                onClick={() => handleLocationSelect(suggestion)}
                onMouseEnter={() => setSelectedIndex(index)}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                role="option"
                aria-selected={index === selectedIndex}
              >
                <FaMapMarkerAlt className="location-icon" />
                <div className="location-details">
                  <div className="location-name">
                    {suggestion.name}
                  </div>
                  {suggestion.full_address && (
                    <div className="location-address">
                      {suggestion.full_address}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      
      {showDropdown && suggestions.length === 0 && !isLoading && searchQuery.length >= 3 && (
        <div className="no-suggestions-message">
          No locations found for "{searchQuery}"
        </div>
      )}
    </div>
  );
};

export default LocationSearchInput;