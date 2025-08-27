/**
 * Sidebar.js - Intuitive Navigation for Agricultural Users
 * Simple, always-visible sidebar that farmers can understand and use
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  FaMap, FaFire, FaCloudSun, FaCog, 
  FaUser, FaSignOutAlt, FaBars, FaTimes,
  FaExclamationTriangle, FaCheck, FaQuestionCircle
} from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';
import { useMap } from '../contexts/MapContext';
import { useTutorial } from '../contexts/TutorialContext';
import axios from 'axios';
import './Sidebar.css';

const Sidebar = ({ onPanelChange }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isDemo } = useAuth();
  const { getCurrentLocation } = useMap();
  const { resetTutorial, isCompleted } = useTutorial();
  
  // Sidebar state
  const [isExpanded, setIsExpanded] = useState(() => {
    const saved = localStorage.getItem('burnwise-sidebar-expanded');
    return saved !== null ? JSON.parse(saved) : true;
  });
  
  // Track active panel and map view state from SpatialInterface
  const [activePanel, setActivePanel] = useState(null);
  const [isMapView, setIsMapView] = useState(true);
  
  // Real farm data
  const [farmData, setFarmData] = useState(null);
  const [activeBurnsCount, setActiveBurnsCount] = useState(0);
  const [weatherStatus, setWeatherStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  // Save sidebar state to localStorage
  useEffect(() => {
    localStorage.setItem('burnwise-sidebar-expanded', JSON.stringify(isExpanded));
  }, [isExpanded]);

  // Listen for activePanel and isMapView changes from SpatialInterface
  useEffect(() => {
    const handleActivePanelChange = (event) => {
      if (event.detail) {
        if (event.detail.activePanel !== undefined) {
          setActivePanel(event.detail.activePanel);
        }
        if (event.detail.isMapView !== undefined) {
          setIsMapView(event.detail.isMapView);
        }
      }
    };
    
    window.addEventListener('activePanelChanged', handleActivePanelChange);
    
    return () => {
      window.removeEventListener('activePanelChanged', handleActivePanelChange);
    };
  }, []);

  // Load real farm data
  useEffect(() => {
    // Load data for both real users and demo mode
    if (user || location.pathname.startsWith('/demo')) {
      loadFarmData();
    }
  }, [user, location.pathname]);
  

  const loadFarmData = async () => {
    setLoading(true);
    try {
      // In demo mode, skip farm-specific data
      const isDemo = location.pathname.startsWith('/demo');
      
      if (!isDemo && user && user.farmId) {
        // Get farm details for real users
        const farmsResponse = await axios.get('/api/farms');
        const userFarm = farmsResponse.data.farms.find(farm => farm.id === user.farmId);
        setFarmData(userFarm);

        // Get active burns count
        const burnsResponse = await axios.get('/api/burn-requests');
        const activeBurns = burnsResponse.data.requests.filter(
          burn => burn.farm_id === user.farmId && 
          ['pending', 'approved', 'in_progress'].includes(burn.status)
        );
        setActiveBurnsCount(activeBurns.length);
      } else if (isDemo) {
        // Set demo farm data
        setFarmData({ name: 'Demo Farm' });
        setActiveBurnsCount(0);
      }

      // Get weather status (works for both demo and real users)
      // Use current map center or selected farm location
      const currentLocation = getCurrentLocation ? getCurrentLocation() : { lat: 38.544, lng: -121.740 };
      
      const weatherResponse = await axios.get('/api/weather/current', {
        params: {
          lat: currentLocation.lat,
          lon: currentLocation.lng
        }
      });
      
      if (weatherResponse.data?.data?.weather) {
        setWeatherStatus(weatherResponse.data.data.weather);
      } else {
        setWeatherStatus({ condition: 'Unknown', temperature: null });
      }


    } catch (error) {
      console.error('Failed to load farm data:', error);
      // Set fallback data
      setFarmData({ name: 'Your Farm' });
      setActiveBurnsCount(0);
      setWeatherStatus({ condition: 'Unknown' });
    } finally {
      setLoading(false);
    }
  };

  const toggleSidebar = () => {
    setIsExpanded(!isExpanded);
  };

  const handleLogout = async () => {
    try {
      // Normal logout for all users (demo can log back in)
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handlePanelChange = (panelId) => {
    const currentPath = location.pathname;
    const isInDemoMode = currentPath.startsWith('/demo');
    
    if (panelId === 'settings') {
      // In demo mode, show settings as a panel instead of navigating
      if (isInDemoMode) {
        // Dispatch event to show settings panel in spatial interface
        window.dispatchEvent(new CustomEvent('panelChange', { 
          detail: { panelId: 'settings', source: 'sidebar' }
        }));
      } else {
        navigate('/settings');
      }
      return;
    }
    
    // Navigate to spatial interface if not already there
    const targetPath = isInDemoMode ? '/demo/spatial' : '/spatial';
    if (currentPath !== targetPath) {
      navigate(targetPath);
    }
    
    // Dispatch event for SpatialInterface to handle
    window.dispatchEvent(new CustomEvent('panelChange', { 
      detail: { panelId, source: 'sidebar' }
    }));
    
    // Update local state based on panel clicked
    if (panelId === 'spatial') {
      // Map View button toggles the view, don't change activePanel
      // The isMapView state will be updated via the event listener
    } else if (activePanel === panelId) {
      setActivePanel(null); // Toggle off if clicking same panel
    } else {
      setActivePanel(panelId); // Switch to new panel
    }
    
    // Expand sidebar if collapsed to show what was selected
    if (!isExpanded && panelId !== 'spatial') {
      setIsExpanded(true);
    }
  };

  const navigationItems = [
    {
      id: 'spatial',
      label: 'Map View',
      icon: FaMap,
      action: () => handlePanelChange('spatial'),
      description: 'View farm and burn locations'
    },
    {
      id: 'burns',
      label: 'Active Burns',
      icon: FaFire,
      action: () => handlePanelChange('burns'),
      badge: activeBurnsCount,
      description: 'Manage burn requests'
    },
    {
      id: 'weather',
      label: 'Weather',
      icon: FaCloudSun,
      action: () => handlePanelChange('weather'),
      status: weatherStatus?.condition || 'Loading...',
      description: 'Current weather conditions'
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: FaCog,
      action: () => handlePanelChange('settings'),
      description: 'App preferences and account'
    }
  ];

  // Sidebar visibility is now controlled by App.js

  return (
    <div className={`sidebar ${isExpanded ? 'expanded' : 'collapsed'}`}>
      {/* Unified Header - always present */}
      <div className="sidebar-header">
        {/* Farm info - slides out when collapsed */}
        <div className="sidebar-farm-info">
          {farmData && (
            <>
              <div className="farm-name">{farmData.name}</div>
              <div className="farm-details">
                {farmData.total_acreage && `${farmData.total_acreage} acres`}
                {farmData.owner_name && ` • ${farmData.owner_name}`}
              </div>
              {weatherStatus && (
                <div className="weather-summary">
                  🌤️ {Math.round(weatherStatus.temperature || 75)}°F • {weatherStatus.condition || 'Clear'}
                </div>
              )}
            </>
          )}
        </div>
        
        {/* Toggle button - always in same position */}
        <button 
          className="sidebar-toggle" 
          onClick={toggleSidebar}
          title={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
        >
          {isExpanded ? <FaTimes /> : <FaBars />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          // Determine if this item is active
          let isActive = false;
          if (item.id === 'spatial') {
            // Map View is active when map view is enabled
            isActive = isMapView;
          } else if (item.id === 'settings') {
            // Settings is active when on settings page
            isActive = location.pathname === '/settings';
          } else {
            // Other items are active when their panel is open
            isActive = activePanel === item.id;
          }

          return (
            <button
              key={item.id}
              className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
              onClick={item.action}
              title={isExpanded ? item.description : item.label}
            >
              <div className="nav-icon">
                <Icon />
                {item.badge > 0 && (
                  <span className="nav-badge">{item.badge}</span>
                )}
              </div>
              {isExpanded && (
                <div className="nav-content">
                  <div className="nav-label">{item.label}</div>
                  {item.status && (
                    <div className="nav-status">{item.status}</div>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Tutorial Button */}
      <div className="sidebar-tutorial">
        <button
          className="tutorial-button"
          onClick={resetTutorial}
          title={isExpanded ? "Restart tutorial" : "Tutorial"}
        >
          <FaQuestionCircle />
          {isExpanded && <span className="tutorial-text">Repeat Tutorial</span>}
        </button>
      </div>

      {/* User Section */}
      <div className="sidebar-user">
        {/* User info - fades out when collapsed */}
        <div className="user-info">
          {user && (
            <>
              <div className="user-name">{user.name}</div>
              <div className="user-email">{user.email}</div>
              {user.isDemo && (
                <div className="demo-badge">Demo Mode</div>
              )}
            </>
          )}
        </div>
        
        {/* Logout button - always present */}
        <button 
          className="logout-button"
          onClick={handleLogout}
          title="Sign out"
        >
          <FaSignOutAlt />
          <span className="logout-text">Sign Out</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;