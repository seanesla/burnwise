import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FaUser, FaSignOutAlt, FaRedo } from 'react-icons/fa';
import AnimatedFlameLogo from './animations/logos/AnimatedFlameLogo';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import '../styles/Navigation.css';

const Navigation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user, logout, resetOnboarding } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [farmData, setFarmData] = useState(null);
  
  // Load real farm data when user changes
  useEffect(() => {
    if (user && user.farmId) {
      loadFarmData();
    }
  }, [user]);

  const loadFarmData = async () => {
    try {
      const response = await axios.get('/api/farms');
      const userFarm = response.data.farms.find(farm => farm.id === user.farmId);
      setFarmData(userFarm);
    } catch (error) {
      console.error('Failed to load farm data:', error);
      // Fallback to basic info
      setFarmData({ name: 'Your Farm' });
    }
  };

  // Navigation visibility is now controlled by App.js
  // No internal visibility logic needed

  // Get current page context for breadcrumb with real farm data
  const getPageContext = () => {
    const path = location.pathname;
    const farmName = farmData?.name || 'Your Farm';
    
    if (path.startsWith('/demo')) {
      return { title: 'Demo Mode', subtitle: `${farmName} Experience` };
    }
    if (path === '/spatial' || path === '/demo/spatial') {
      return { title: 'Spatial Interface', subtitle: `${farmName} Coordination` };
    }
    if (path === '/settings') {
      return { title: 'Settings', subtitle: 'Configuration' };
    }
    return { title: 'BURNWISE', subtitle: farmName };
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleResetOnboarding = () => {
    resetOnboarding();
    navigate('/onboarding');
  };

  const pageContext = getPageContext();

  return (
    <>
      <nav className="minimal-navigation">
        <div className="nav-container">
          {/* Left: Minimal Brand */}
          <div className="nav-brand-minimal">
            <Link to="/" className="brand-link-minimal">
              <AnimatedFlameLogo size={32} animated={false} />
            </Link>
          </div>
          
          {/* Center: Current Context */}
          <div className="nav-context">
            <span className="context-title">{pageContext.title}</span>
            <span className="context-subtitle">{pageContext.subtitle}</span>
          </div>

          {/* Right: User Menu */}
          <div className="nav-controls">
            
            {isAuthenticated && (
              <div className="nav-user-minimal">
                <button
                  className="user-avatar"
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  onBlur={() => setTimeout(() => setShowUserMenu(false), 200)}
                >
                  <div className="avatar-circle">
                    {sessionStorage.getItem('isDemo') === 'true' ? 'D' : (user?.name?.charAt(0) || 'U')}
                  </div>
                </button>
                
                {showUserMenu && (
                  <div className="user-menu-minimal">
                    <div className="user-menu-header-minimal">
                      <div className="user-name">{sessionStorage.getItem('isDemo') === 'true' ? 'Demo User' : user?.name}</div>
                      <div className="user-email">{sessionStorage.getItem('isDemo') === 'true' ? 'demo@burnwise.com' : user?.email}</div>
                      <div className="user-farm">Farm #{sessionStorage.getItem('isDemo') === 'true' ? 'Demo' : user?.farmId}</div>
                      {user?.isDemo && <div className="demo-badge">Demo Mode</div>}
                    </div>
                    <div className="menu-divider" />
                    <button
                      className="menu-item"
                      onClick={handleResetOnboarding}
                    >
                      <FaRedo />
                      <span>Reset Setup</span>
                    </button>
                    <button
                      className="menu-item logout"
                      onClick={handleLogout}
                    >
                      <FaSignOutAlt />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </nav>
    </>
  );
};

export default Navigation;