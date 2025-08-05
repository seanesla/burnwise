import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { FaCalendarAlt, FaFire, FaSmog, FaSync, FaExclamationTriangle, FaCloudSun, FaInfoCircle } from 'react-icons/fa';

const AlertsPanel = ({ farms = [] }) => {
  const [alerts, setAlerts] = useState([]);
  const [selectedFarm, setSelectedFarm] = useState('');
  const [loading, setLoading] = useState(false);
  const [farmsData, setFarmsData] = useState(farms);

  useEffect(() => {
    if (farms.length === 0) {
      fetchFarms();
    }
  }, []);

  const fetchFarms = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/farms');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setFarmsData(data.data || []);
        }
      }
    } catch (error) {
      console.error('Error fetching farms:', error);
      setFarmsData([]);
    }
  };

  useEffect(() => {
    if (selectedFarm) {
      fetchAlerts();
    }
  }, [selectedFarm]);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `http://localhost:5001/api/alerts/history/${selectedFarm}?limit=50`
      );
      const data = await response.json();
      if (data.success) {
        setAlerts(data.data);
      }
    } catch (error) {
      toast.error('Failed to fetch alerts');
      console.error('Error fetching alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const processPendingAlerts = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/alerts/process-pending', {
        method: 'POST'
      });
      const data = await response.json();
      if (data.success) {
        toast.success(`Processed ${data.data.processed} pending alerts`);
        if (selectedFarm) {
          fetchAlerts();
        }
      }
    } catch (error) {
      toast.error('Failed to process pending alerts');
      console.error('Error processing alerts:', error);
    }
  };

  const getAlertIcon = (type) => {
    switch(type) {
      case 'burn_scheduled': return <FaCalendarAlt />;
      case 'burn_starting': return <FaFire />;
      case 'smoke_warning': return <FaSmog />;
      case 'schedule_change': return <FaSync />;
      case 'conflict_detected': return <FaExclamationTriangle />;
      case 'weather_alert': return <FaCloudSun />;
      default: return <FaInfoCircle />;
    }
  };

  const getSeverityColor = (severity) => {
    switch(severity) {
      case 'critical': return '#ff5722';
      case 'warning': return '#ff6b35';
      case 'info': return '#FFB000';
      default: return 'rgba(255, 255, 255, 0.3)';
    }
  };

  const getDeliveryStatusBadge = (status) => {
    const colors = {
      pending: '#FFB000',
      sent: '#22c55e',
      delivered: '#22c55e',
      failed: '#ff5722'
    };
    
    return (
      <span 
        className="delivery-badge" 
        style={{ backgroundColor: colors[status] || '#9E9E9E' }}
      >
        {status}
      </span>
    );
  };

  return (
    <div className="alerts-container">
      <div className="alerts-header">
        <h2>Alert Management</h2>
        <div className="header-actions">
          <select
            value={selectedFarm}
            onChange={(e) => setSelectedFarm(e.target.value)}
            className="farm-selector"
          >
            <option value="">-- Select Farm --</option>
            {farmsData.map(farm => (
              <option key={farm.farm_id} value={farm.farm_id}>
                {farm.farm_name}
              </option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={processPendingAlerts}>
            Process Pending Alerts
          </button>
        </div>
      </div>

      {!selectedFarm ? (
        <div className="no-farm-selected">
          <p>Please select a farm to view its alert history</p>
        </div>
      ) : loading ? (
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading alerts...</p>
        </div>
      ) : alerts.length === 0 ? (
        <div className="no-alerts">
          <p>No alerts found for this farm</p>
        </div>
      ) : (
        <div className="alerts-list">
          {alerts.map(alert => (
            <div 
              key={alert.alert_id} 
              className="alert-item"
              style={{ borderLeftColor: getSeverityColor(alert.severity) }}
            >
              <div className="alert-icon">
                {getAlertIcon(alert.alert_type)}
              </div>
              
              <div className="alert-content">
                <div className="alert-header">
                  <span className="alert-type">{alert.alert_type.replace(/_/g, ' ').toUpperCase()}</span>
                  {getDeliveryStatusBadge(alert.delivery_status)}
                </div>
                
                <div className="alert-message">
                  {alert.message}
                </div>
                
                <div className="alert-meta">
                  <span className="alert-time">
                    {new Date(alert.created_at).toLocaleString()}
                  </span>
                  {alert.delivered_at && (
                    <span className="alert-delivered">
                      Delivered: {new Date(alert.delivered_at).toLocaleString()}
                    </span>
                  )}
                  {alert.burn_status && (
                    <span className="burn-status">
                      Burn: {alert.burn_status}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        .alerts-container {
          padding: 2rem;
          max-width: 1200px;
          margin: 0 auto;
          min-height: 100vh;
          background: linear-gradient(180deg, #000 0%, rgba(10, 10, 10, 0.95) 100%);
          font-family: 'Inter', sans-serif;
          color: white;
        }

        .alerts-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 3rem;
        }

        .alerts-header h2 {
          font-size: clamp(2.5rem, 5vw, 3.5rem);
          font-weight: 900;
          background: linear-gradient(135deg, #ffffff 0%, rgba(255, 255, 255, 0.8) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          text-shadow: 0 0 30px rgba(255, 107, 53, 0.3);
        }

        .header-actions {
          display: flex;
          gap: 1rem;
          align-items: center;
        }

        .farm-selector {
          padding: 0.75rem 1rem;
          border: 2px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          font-size: 1rem;
          background: rgba(255, 255, 255, 0.05);
          color: white;
          backdrop-filter: blur(10px);
          transition: all 0.3s;
        }

        .farm-selector:focus {
          outline: none;
          border-color: #ff6b35;
          box-shadow: 0 0 0 3px rgba(255, 107, 53, 0.2);
        }

        .farm-selector option {
          background: #333;
          color: white;
        }

        .btn {
          padding: 0.75rem 1.5rem;
          border: none;
          border-radius: 12px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }

        .btn-primary {
          background: linear-gradient(135deg, #ff6b35 0%, #ff5722 100%);
          color: white;
          box-shadow: 0 4px 20px rgba(255, 107, 53, 0.3);
        }

        .btn-primary:hover {
          transform: translateY(-3px);
          box-shadow: 0 10px 40px rgba(255, 107, 53, 0.4);
        }

        .no-farm-selected,
        .loading,
        .no-alerts {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          padding: 4rem 2rem;
          border-radius: 20px;
          text-align: center;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }

        .no-farm-selected p,
        .no-alerts p {
          color: rgba(255, 255, 255, 0.8);
          font-size: 1.1rem;
        }

        .loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          color: white;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid rgba(255, 255, 255, 0.1);
          border-top: 4px solid #ff6b35;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 1rem;
        }

        .loading p {
          color: white;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .alerts-list {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .alert-item {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
          display: flex;
          padding: 2rem;
          border-left: 5px solid;
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }

        .alert-item::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: radial-gradient(
            circle at 50% 0%,
            rgba(255, 107, 53, 0.05) 0%,
            transparent 70%
          );
          opacity: 0;
          transition: opacity 0.3s;
        }

        .alert-item:hover {
          transform: translateY(-5px);
          border-color: rgba(255, 107, 53, 0.2);
          box-shadow: 0 15px 30px rgba(0, 0, 0, 0.4);
        }

        .alert-item:hover::before {
          opacity: 1;
        }

        .alert-icon {
          font-size: 2.5rem;
          margin-right: 2rem;
          display: flex;
          align-items: center;
          position: relative;
          z-index: 1;
        }

        .alert-content {
          flex: 1;
          position: relative;
          z-index: 1;
        }

        .alert-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }

        .alert-type {
          font-weight: 700;
          color: white;
          font-size: 1rem;
          letter-spacing: 0.05em;
        }

        .delivery-badge {
          padding: 0.5rem 1rem;
          border-radius: 15px;
          color: white;
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }

        .alert-message {
          color: rgba(255, 255, 255, 0.9);
          line-height: 1.6;
          margin-bottom: 1.5rem;
          font-size: 1rem;
        }

        .alert-meta {
          display: flex;
          gap: 2rem;
          font-size: 0.9rem;
          color: rgba(255, 255, 255, 0.6);
        }

        .alert-time,
        .alert-delivered,
        .burn-status {
          display: flex;
          align-items: center;
          font-weight: 500;
        }

        @media (max-width: 768px) {
          .alerts-container {
            padding: 1.5rem;
          }
          
          .alerts-header {
            flex-direction: column;
            gap: 1rem;
            text-align: center;
          }
          
          .header-actions {
            flex-direction: column;
            gap: 1rem;
            width: 100%;
            max-width: 300px;
          }
          
          .farm-selector,
          .btn {
            width: 100%;
          }
          
          .alert-item {
            flex-direction: column;
            text-align: center;
          }
          
          .alert-icon {
            margin-right: 0;
            margin-bottom: 1rem;
            justify-content: center;
          }
          
          .alert-meta {
            flex-direction: column;
            gap: 0.5rem;
          }
        }
      `}</style>
    </div>
  );
};

export default AlertsPanel;