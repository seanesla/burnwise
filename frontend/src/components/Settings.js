import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  FaCog, FaBell, FaUser, FaLock, FaPalette, 
  FaDatabase, FaSync, FaSave, FaExclamationTriangle 
} from 'react-icons/fa';
import toast from 'react-hot-toast';
import LoadingSpinner from './LoadingSpinner';
import './Settings.css';

const Settings = () => {
  const [settings, setSettings] = useState({
    profile: {
      name: '',
      email: '',
      phone: '',
      farmName: '',
      role: 'Farm Owner'
    },
    notifications: {
      emailAlerts: true,
      smsAlerts: true,
      browserNotifications: false,
      alertTypes: {
        burnApproved: true,
        burnRejected: true,
        weatherChange: true,
        conflictDetected: true,
        scheduleUpdate: true
      }
    },
    preferences: {
      theme: 'dark',
      mapStyle: 'satellite',
      units: 'imperial',
      language: 'en',
      timezone: 'America/Chicago'
    },
    system: {
      cacheEnabled: true,
      autoRefresh: true,
      refreshInterval: 30,
      debugMode: false,
      performanceMode: false
    }
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      // In production, this would fetch from API
      const savedSettings = localStorage.getItem('burnwise_settings');
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      // In production, this would save to API
      localStorage.setItem('burnwise_settings', JSON.stringify(settings));
      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (section, field, value) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  const handleNestedChange = (section, subsection, field, value) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [subsection]: {
          ...prev[section][subsection],
          [field]: value
        }
      }
    }));
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: FaUser },
    { id: 'notifications', label: 'Notifications', icon: FaBell },
    { id: 'preferences', label: 'Preferences', icon: FaPalette },
    { id: 'system', label: 'System', icon: FaCog }
  ];

  if (loading) {
    return (
      <div className="settings-loading">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  return (
    <div className="settings-container">
      <div className="settings-wrapper">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="settings-header"
        >
          <h1 className="settings-title">
            <FaCog />
            Settings
          </h1>
          <p className="settings-subtitle">
            Configure your BURNWISE experience
          </p>
        </motion.div>

        {/* Tab Navigation */}
        <div className="settings-tabs">
          {tabs.map(tab => (
            <motion.button
              key={tab.id}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveTab(tab.id)}
              className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            >
              <tab.icon />
              {tab.label}
            </motion.button>
          ))}
        </div>

        {/* Settings Content */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="settings-content"
        >
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div>
              <h2 className="section-title">Profile Information</h2>
              
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={settings.profile.name}
                    onChange={(e) => handleInputChange('profile', 'name', e.target.value)}
                    className="form-input"
                    placeholder="John Doe"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={settings.profile.email}
                    onChange={(e) => handleInputChange('profile', 'email', e.target.value)}
                    className="form-input"
                    placeholder="john@example.com"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={settings.profile.phone}
                    onChange={(e) => handleInputChange('profile', 'phone', e.target.value)}
                    className="form-input"
                    placeholder="+1 555-123-4567"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">
                    Farm Name
                  </label>
                  <input
                    type="text"
                    value={settings.profile.farmName}
                    onChange={(e) => handleInputChange('profile', 'farmName', e.target.value)}
                    className="form-input"
                    placeholder="Green Acres Farm"
                  />
                </div>
              </div>
              
              <div className="subsection">
                <h3 className="subsection-title">Account Role</h3>
                <div className="radio-group">
                  {['Farm Owner', 'Farm Manager', 'Coordinator'].map(role => (
                    <label key={role} className="radio-label">
                      <input
                        type="radio"
                        name="role"
                        value={role}
                        checked={settings.profile.role === role}
                        onChange={(e) => handleInputChange('profile', 'role', e.target.value)}
                        className="radio-input"
                      />
                      <span>{role}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div>
              <h2 className="section-title">Notification Preferences</h2>
              
              <div>
                <h3 className="subsection-title">Alert Channels</h3>
                
                <label className="toggle-card">
                  <div className="toggle-info">
                    <FaBell className="toggle-icon" />
                    <div className="toggle-text">
                      <p className="toggle-title">Email Alerts</p>
                      <p className="toggle-description">Receive alerts via email</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.notifications.emailAlerts}
                    onChange={(e) => handleInputChange('notifications', 'emailAlerts', e.target.checked)}
                    className="checkbox-input"
                  />
                </label>
                
                <label className="toggle-card">
                  <div className="toggle-info">
                    <FaBell className="toggle-icon" />
                    <div className="toggle-text">
                      <p className="toggle-title">SMS Alerts</p>
                      <p className="toggle-description">Receive alerts via text message</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.notifications.smsAlerts}
                    onChange={(e) => handleInputChange('notifications', 'smsAlerts', e.target.checked)}
                    className="checkbox-input"
                  />
                </label>
                
                <label className="toggle-card">
                  <div className="toggle-info">
                    <FaBell className="toggle-icon" />
                    <div className="toggle-text">
                      <p className="toggle-title">Browser Notifications</p>
                      <p className="toggle-description">Show desktop notifications</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.notifications.browserNotifications}
                    onChange={(e) => handleInputChange('notifications', 'browserNotifications', e.target.checked)}
                    className="checkbox-input"
                  />
                </label>
              </div>
              
              <div className="subsection">
                <h3 className="subsection-title">Alert Types</h3>
                <div className="alert-types-grid">
                  {Object.entries({
                    burnApproved: 'Burn Request Approved',
                    burnRejected: 'Burn Request Rejected',
                    weatherChange: 'Weather Condition Changes',
                    conflictDetected: 'Conflict Detected',
                    scheduleUpdate: 'Schedule Updates'
                  }).map(([key, label]) => (
                    <label key={key} className="alert-type-item">
                      <span className="alert-type-label">{label}</span>
                      <input
                        type="checkbox"
                        checked={settings.notifications.alertTypes[key]}
                        onChange={(e) => handleNestedChange('notifications', 'alertTypes', key, e.target.checked)}
                        className="checkbox-input"
                      />
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Preferences Tab */}
          {activeTab === 'preferences' && (
            <div>
              <h2 className="section-title">Display Preferences</h2>
              
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">
                    Theme
                  </label>
                  <select
                    value={settings.preferences.theme}
                    onChange={(e) => handleInputChange('preferences', 'theme', e.target.value)}
                    className="form-select"
                  >
                    <option value="dark">Dark (Fire)</option>
                    <option value="light">Light</option>
                    <option value="auto">System</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label className="form-label">
                    Map Style
                  </label>
                  <select
                    value={settings.preferences.mapStyle}
                    onChange={(e) => handleInputChange('preferences', 'mapStyle', e.target.value)}
                    className="form-select"
                  >
                    <option value="satellite">Satellite</option>
                    <option value="streets">Streets</option>
                    <option value="dark">Dark</option>
                    <option value="outdoors">Outdoors</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label className="form-label">
                    Units
                  </label>
                  <select
                    value={settings.preferences.units}
                    onChange={(e) => handleInputChange('preferences', 'units', e.target.value)}
                    className="form-select"
                  >
                    <option value="imperial">Imperial (miles, °F)</option>
                    <option value="metric">Metric (km, °C)</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label className="form-label">
                    Language
                  </label>
                  <select
                    value={settings.preferences.language}
                    onChange={(e) => handleInputChange('preferences', 'language', e.target.value)}
                    className="form-select"
                  >
                    <option value="en">English</option>
                    <option value="es">Español</option>
                    <option value="fr">Français</option>
                  </select>
                </div>
                
                <div className="form-group full-width">
                  <label className="form-label">
                    Timezone
                  </label>
                  <select
                    value={settings.preferences.timezone}
                    onChange={(e) => handleInputChange('preferences', 'timezone', e.target.value)}
                    className="form-select"
                  >
                    <option value="America/Chicago">Central Time (Chicago)</option>
                    <option value="America/New_York">Eastern Time (New York)</option>
                    <option value="America/Denver">Mountain Time (Denver)</option>
                    <option value="America/Los_Angeles">Pacific Time (Los Angeles)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* System Tab */}
          {activeTab === 'system' && (
            <div>
              <h2 className="section-title">System Settings</h2>
              
              <div>
                <label className="toggle-card">
                  <div className="toggle-info">
                    <FaDatabase className="toggle-icon" />
                    <div className="toggle-text">
                      <p className="toggle-title">Enable Cache</p>
                      <p className="toggle-description">Store data locally for faster loading</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.system.cacheEnabled}
                    onChange={(e) => handleInputChange('system', 'cacheEnabled', e.target.checked)}
                    className="checkbox-input"
                  />
                </label>
                
                <label className="toggle-card">
                  <div className="toggle-info">
                    <FaSync className="toggle-icon" />
                    <div className="toggle-text">
                      <p className="toggle-title">Auto Refresh</p>
                      <p className="toggle-description">Automatically update data</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.system.autoRefresh}
                    onChange={(e) => handleInputChange('system', 'autoRefresh', e.target.checked)}
                    className="checkbox-input"
                  />
                </label>
                
                {settings.system.autoRefresh && (
                  <div className="number-input-group">
                    <label className="form-label">
                      Refresh Interval (seconds)
                    </label>
                    <input
                      type="number"
                      min="10"
                      max="300"
                      value={settings.system.refreshInterval}
                      onChange={(e) => handleInputChange('system', 'refreshInterval', parseInt(e.target.value))}
                      className="number-input"
                    />
                  </div>
                )}
                
                <label className="toggle-card">
                  <div className="toggle-info">
                    <FaExclamationTriangle className="toggle-icon" style={{color: '#FFB000'}} />
                    <div className="toggle-text">
                      <p className="toggle-title">Debug Mode</p>
                      <p className="toggle-description">Show detailed error messages</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.system.debugMode}
                    onChange={(e) => handleInputChange('system', 'debugMode', e.target.checked)}
                    className="checkbox-input"
                  />
                </label>
                
                <label className="toggle-card">
                  <div className="toggle-info">
                    <FaCog className="toggle-icon" />
                    <div className="toggle-text">
                      <p className="toggle-title">Performance Mode</p>
                      <p className="toggle-description">Reduce animations for better performance</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.system.performanceMode}
                    onChange={(e) => handleInputChange('system', 'performanceMode', e.target.checked)}
                    className="checkbox-input"
                  />
                </label>
              </div>
              
              <div className="subsection">
                <h3 className="subsection-title">Data Management</h3>
                <div className="action-buttons">
                  <button
                    onClick={() => {
                      localStorage.clear();
                      toast.success('Cache cleared successfully');
                    }}
                    className="btn-secondary"
                  >
                    Clear Cache
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm('Are you sure you want to reset all settings to default?')) {
                        localStorage.removeItem('burnwise_settings');
                        loadSettings();
                        toast.success('Settings reset to default');
                      }
                    }}
                    className="btn-danger"
                  >
                    Reset to Default
                  </button>
                </div>
              </div>
            </div>
          )}
        </motion.div>

        {/* Save Button */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="settings-footer"
        >
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={saveSettings}
            disabled={saving}
            className="btn-save"
          >
            {saving ? (
              <>
                <LoadingSpinner size="small" color="#fff" />
                Saving...
              </>
            ) : (
              <>
                <FaSave />
                Save Settings
              </>
            )}
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
};

export default Settings;