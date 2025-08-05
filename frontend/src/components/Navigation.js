import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import '../styles/Navigation.css';

const Navigation = () => {
  const location = useLocation();
  
  // Don't show nav on landing page
  if (location.pathname === '/') {
    return null;
  }

  const navItems = [
    { path: '/dashboard', label: '📊 Dashboard', icon: '📊' },
    { path: '/map', label: '🗺️ Map', icon: '🗺️' },
    { path: '/schedule', label: '📅 Schedule', icon: '📅' },
    { path: '/alerts', label: '🔔 Alerts', icon: '🔔' }
  ];

  return (
    <nav className="main-navigation">
      <div className="nav-container">
        <div className="nav-brand">
          <Link to="/" className="brand-link">
            <span className="brand-icon">🔥</span>
            <span className="brand-text">BURNWISE</span>
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
        </div>
      </div>
    </nav>
  );
};

export default Navigation;