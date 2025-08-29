/**
 * NotificationButton.js - Notification Controls UI
 * Button for enabling notifications and sounds
 * Shows permission status and provides test functionality
 */

import React, { useState } from 'react';
import { FaBell, FaBellSlash, FaVolumeUp, FaVolumeMute } from 'react-icons/fa';
import { useAlerts } from '../contexts/AlertsContext';
import './NotificationButton.css';

const NotificationButton = () => {
  const {
    notificationsEnabled,
    soundEnabled,
    toggleNotifications,
    toggleSound,
    sendTestAlert,
    unreadCount,
    connected
  } = useAlerts();
  
  const [showMenu, setShowMenu] = useState(false);
  const [requesting, setRequesting] = useState(false);

  const handleNotificationToggle = async () => {
    setRequesting(true);
    try {
      await toggleNotifications();
    } catch (error) {
      console.error('Error toggling notifications:', error);
    } finally {
      setRequesting(false);
    }
  };

  const handleTestAlert = () => {
    sendTestAlert();
    setShowMenu(false);
  };

  return (
    <div className="notification-button-container">
      <button
        className={`notification-button ${notificationsEnabled ? 'enabled' : ''}`}
        onClick={() => setShowMenu(!showMenu)}
        title="Notification settings"
      >
        {notificationsEnabled ? <FaBell /> : <FaBellSlash />}
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount}</span>
        )}
      </button>

      {showMenu && (
        <div className="notification-menu">
          <div className="notification-menu-header">
            Alert Settings
            <button 
              className="close-menu"
              onClick={() => setShowMenu(false)}
            >
              ×
            </button>
          </div>

          <div className="notification-menu-content">
            {/* Connection Status */}
            <div className="notification-status">
              <span className={`status-indicator ${connected ? 'connected' : 'disconnected'}`} />
              {connected ? 'Connected' : 'Disconnected'}
            </div>

            {/* Notification Toggle */}
            <div className="notification-setting">
              <label>
                <span>Desktop Notifications</span>
                <button
                  className={`toggle-button ${notificationsEnabled ? 'enabled' : ''}`}
                  onClick={handleNotificationToggle}
                  disabled={requesting}
                >
                  {requesting ? '...' : notificationsEnabled ? 'ON' : 'OFF'}
                </button>
              </label>
              {!notificationsEnabled && (
                <p className="setting-hint">Click to enable browser notifications</p>
              )}
            </div>

            {/* Sound Toggle */}
            <div className="notification-setting">
              <label>
                <span>Sound Alerts</span>
                <button
                  className={`toggle-button ${soundEnabled ? 'enabled' : ''}`}
                  onClick={toggleSound}
                >
                  {soundEnabled ? <FaVolumeUp /> : <FaVolumeMute />}
                </button>
              </label>
            </div>

            {/* Test Button */}
            <div className="notification-actions">
              <button
                className="test-button"
                onClick={handleTestAlert}
                disabled={!connected}
              >
                Send Test Alert
              </button>
            </div>

            {/* Info */}
            <div className="notification-info">
              {notificationsEnabled ? (
                <p>You'll receive alerts for burn schedules, weather changes, and conflicts.</p>
              ) : (
                <p>Enable notifications to stay updated on important farm events.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationButton;