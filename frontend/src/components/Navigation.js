import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FaUser, FaSignOutAlt, FaRedo } from 'react-icons/fa';
import AnimatedFlameLogo from './animations/logos/AnimatedFlameLogo';
import { useAuth } from '../contexts/AuthContext';
import '../styles/Navigation.css';

const Navigation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user, logout, resetOnboarding } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  
  // Don't show nav on auth pages or landing
  const hideNavPaths = ['/', '/login', '/signup', '/onboarding'];
  if (hideNavPaths.includes(location.pathname)) {
    return null;
  }

  const navItems = [
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/request', label: 'Burn Request' },
    { path: '/map', label: 'Map' },
    { path: '/schedule', label: 'Schedule' },
    { path: '/alerts', label: 'Alerts' },
    { path: '/analytics', label: 'Analytics' },
    { path: '/settings', label: 'Settings' }
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleResetOnboarding = () => {
    resetOnboarding();
    navigate('/onboarding');
  };

  return (
    <nav className="main-navigation">
      <div className="nav-container">
        <div className="nav-brand">
          <Link to="/" className="brand-link" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AnimatedFlameLogo size={40} animated={false} />
            <span className="brand-text" style={{ color: '#FF6B35', fontSize: '1.5rem', fontWeight: 'bold', letterSpacing: '1px' }}>BURNWISE</span>
          </Link>
        </div>
        
        <div className="nav-links">
          {navItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-link ${location.pathname === item.path ? 'active' : ''}`}
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div className="nav-info">
          <span className="nav-status">
            <span className="status-dot"></span>
            5-Agent System Active
          </span>
          
          {isAuthenticated && (
            <div className="nav-user">
              <button
                className="nav-user-button"
                onClick={() => setShowUserMenu(!showUserMenu)}
                onBlur={() => setTimeout(() => setShowUserMenu(false), 200)}
              >
                <FaUser />
                <span>{user?.name || 'User'}</span>
              </button>
              
              {showUserMenu && (
                <div className="nav-user-menu">
                  <div className="user-menu-header">
                    <div className="user-menu-name">{user?.name}</div>
                    <div className="user-menu-email">{user?.email}</div>
                    <div className="user-menu-farm">Farm #{user?.farmId}</div>
                  </div>
                  <div className="user-menu-divider" />
                  <button
                    className="user-menu-item"
                    onClick={handleResetOnboarding}
                  >
                    <FaRedo />
                    <span>Reset Onboarding</span>
                  </button>
                  <button
                    className="user-menu-item logout"
                    onClick={handleLogout}
                  >
                    <FaSignOutAlt />
                    <span>Logout</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navigation;