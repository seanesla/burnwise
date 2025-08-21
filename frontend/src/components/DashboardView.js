/**
 * DashboardView.js - Non-map dashboard view for Burnwise
 * Shows cards with burns, weather, alerts, and stats when map is toggled off
 */

import React from 'react';
import { motion } from 'framer-motion';
import AnimatedFlameLogo from './animations/logos/AnimatedFlameLogo';
import './DashboardView.css';

const DashboardView = ({ burns, weatherData, farms, activePanel }) => {
  // Calculate stats
  const activeBurns = burns?.filter(b => b.status === 'active' || b.status === 'in_progress') || [];
  const scheduledBurns = burns?.filter(b => b.status === 'scheduled' || b.status === 'pending') || [];
  const totalAcreage = burns?.reduce((sum, burn) => {
    const acres = parseFloat(burn.acres || burn.acreage || 0);
    return sum + (isNaN(acres) ? 0 : acres);
  }, 0) || 0;
  
  return (
    <div className="dashboard-view">
      <div className="dashboard-grid">
        {/* Burns Summary Card */}
        <motion.div 
          className={`dashboard-card burns-card ${activePanel === 'burns' ? 'highlighted' : ''}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="card-header">
            <AnimatedFlameLogo size={20} animated={true} />
            <h3>Active Burns</h3>
          </div>
          <div className="card-content">
            <div className="stat-row">
              <span className="stat-label">Active Now:</span>
              <span className="stat-value">{activeBurns.length}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Scheduled:</span>
              <span className="stat-value">{scheduledBurns.length}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Total Acreage:</span>
              <span className="stat-value">{totalAcreage.toFixed(1)} acres</span>
            </div>
            {activeBurns.length > 0 && (
              <div className="burns-list-mini">
                {activeBurns.slice(0, 3).map(burn => (
                  <div key={burn.id} className="burn-item-mini">
                    <span>{burn.farm_name || 'Unknown Farm'}</span>
                    <span className="burn-acres">{burn.acres || burn.acreage || 0} acres</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>

        {/* Weather Overview Card */}
        <motion.div 
          className={`dashboard-card weather-card ${activePanel === 'weather' ? 'highlighted' : ''}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="card-header">
            <span className="weather-icon">🌤️</span>
            <h3>Weather Conditions</h3>
          </div>
          <div className="card-content">
            {weatherData ? (
              <>
                <div className="weather-main">
                  <div className="temperature">{Math.round(weatherData.temperature || 75)}°F</div>
                  <div className="condition">{weatherData.condition || 'Clear'}</div>
                </div>
                <div className="weather-details">
                  <div className="detail-row">
                    <span>Wind:</span>
                    <span>{weatherData.wind_speed || 0} mph {weatherData.wind_direction || ''}</span>
                  </div>
                  <div className="detail-row">
                    <span>Humidity:</span>
                    <span>{weatherData.humidity || 0}%</span>
                  </div>
                  <div className="detail-row">
                    <span>Visibility:</span>
                    <span>{weatherData.visibility || 10} mi</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="loading-state">Loading weather data...</div>
            )}
          </div>
        </motion.div>

        {/* Alerts Feed Card */}
        <motion.div 
          className={`dashboard-card alerts-card ${activePanel === 'alerts' ? 'highlighted' : ''}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="card-header">
            <span className="alert-icon">🔔</span>
            <h3>Active Alerts</h3>
          </div>
          <div className="card-content">
            <div className="alerts-list">
              <div className="alert-item warning">
                <span className="alert-badge">⚠️</span>
                <div className="alert-content">
                  <div className="alert-title">Wind Advisory</div>
                  <div className="alert-desc">Winds 15-20 mph after 3 PM</div>
                </div>
              </div>
              <div className="alert-item success">
                <span className="alert-badge">✓</span>
                <div className="alert-content">
                  <div className="alert-title">Air Quality Good</div>
                  <div className="alert-desc">PM2.5 within safe limits</div>
                </div>
              </div>
              <div className="alert-item info">
                <span className="alert-badge">ℹ️</span>
                <div className="alert-content">
                  <div className="alert-title">Neighbor Activity</div>
                  <div className="alert-desc">Golden Fields burn at 2 PM</div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Quick Stats Card */}
        <motion.div 
          className="dashboard-card stats-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="card-header">
            <span className="stats-icon">📊</span>
            <h3>Quick Stats</h3>
          </div>
          <div className="card-content">
            <div className="stats-grid">
              <div className="stat-block">
                <div className="stat-number">{farms?.length || 0}</div>
                <div className="stat-label">Total Farms</div>
              </div>
              <div className="stat-block">
                <div className="stat-number">{burns?.length || 0}</div>
                <div className="stat-label">Total Burns</div>
              </div>
              <div className="stat-block">
                <div className="stat-number">{totalAcreage.toFixed(0)}</div>
                <div className="stat-label">Acres Managed</div>
              </div>
              <div className="stat-block">
                <div className="stat-number status-good">✓</div>
                <div className="stat-label">System Status</div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default DashboardView;