import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import AnimatedFlameLogo from './animations/logos/AnimatedFlameLogo';
import '../styles/Navigation.css';

const Navigation = () => {
  const location = useLocation();
  
  // Don't show nav on landing page
  if (location.pathname === '/') {
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
        </div>
      </div>
    </nav>
  );
};

export default Navigation;