import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaFire, FaWind, FaThermometerHalf, FaExclamationTriangle, FaMapMarkedAlt, FaChartLine } from 'react-icons/fa';
import './SimpleDashboard.css';

const SimpleDashboard = () => {
  const navigate = useNavigate();
  const [data, setData] = useState({
    activeBurns: 0,
    pendingRequests: 0,
    windSpeed: 0,
    temperature: 0,
    alerts: [],
    lastUpdate: null
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Single consolidated API call to reduce rate limiting
        const response = await fetch('http://localhost:5001/api/analytics/metrics');
        
        if (response.status === 429) {
          setError('Rate limit exceeded. Waiting to retry...');
          setTimeout(fetchData, 60000); // Wait 1 minute before retry
          return;
        }

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        
        // No mock data - use real API data only
        setData({
          activeBurns: result.data?.activeBurns || 0,
          pendingRequests: result.data?.pendingRequests || 0,
          windSpeed: result.data?.windSpeed || 0,
          temperature: result.data?.temperature || 0,
          alerts: result.data?.alerts || [],
          lastUpdate: new Date().toLocaleTimeString()
        });
        
        setError(null);
      } catch (err) {
        console.error('Dashboard fetch error:', err);
        // Show error state - no mock data
        setError(`Failed to fetch dashboard data: ${err.message}`);
        setData({
          activeBurns: 0,
          pendingRequests: 0,
          windSpeed: 0,
          temperature: 0,
          alerts: [],
          lastUpdate: 'Failed to update'
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // Poll every 30 seconds instead of 5 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="simple-dashboard loading">
        <div className="spinner" />
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="simple-dashboard">
      <header className="dashboard-header">
        <h1>Burnwise Command Center</h1>
        <div className="last-update">Last update: {data.lastUpdate}</div>
      </header>

      {error && (
        <div className="error-banner">
          {error}
        </div>
      )}

      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-icon">
            <FaFire />
          </div>
          <div className="metric-content">
            <div className="metric-value">{data.activeBurns}</div>
            <div className="metric-label">Active Burns</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon pending">
            <FaChartLine />
          </div>
          <div className="metric-content">
            <div className="metric-value">{data.pendingRequests}</div>
            <div className="metric-label">Pending Requests</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon wind">
            <FaWind />
          </div>
          <div className="metric-content">
            <div className="metric-value">{data.windSpeed} mph</div>
            <div className="metric-label">Wind Speed</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon temp">
            <FaThermometerHalf />
          </div>
          <div className="metric-content">
            <div className="metric-value">{data.temperature}°F</div>
            <div className="metric-label">Temperature</div>
          </div>
        </div>
      </div>

      <div className="alerts-section">
        <h2>System Alerts</h2>
        <div className="alerts-list">
          {data.alerts.length > 0 ? (
            data.alerts.map(alert => (
              <div key={alert.id} className={`alert-item ${alert.severity}`}>
                <FaExclamationTriangle />
                <span>{alert.message}</span>
              </div>
            ))
          ) : (
            <div className="no-alerts">No active alerts</div>
          )}
        </div>
      </div>

      <div className="action-buttons">
        <button className="btn-primary" onClick={() => navigate('/request')}>
          <FaFire /> New Burn Request
        </button>
        <button className="btn-secondary" onClick={() => navigate('/map')}>
          <FaMapMarkedAlt /> View Map
        </button>
        <button className="btn-secondary" onClick={() => navigate('/analytics')}>
          <FaChartLine /> Analytics
        </button>
      </div>
    </div>
  );
};

export default SimpleDashboard;