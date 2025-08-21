import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  FaCog, FaBell, FaUser, FaLock, FaPalette, 
  FaDatabase, FaSync, FaSave, FaExclamationTriangle,
  FaTrash, FaRedo, FaClock, FaShieldAlt, FaSignOutAlt, FaKey
} from 'react-icons/fa';
import toast from 'react-hot-toast';
import LoadingSpinner from './LoadingSpinner';
import settingsManager from '../utils/settingsManager';
import { useAuth } from '../contexts/AuthContext';
import './Settings.css';

const Settings = () => {
  const navigate = useNavigate();
  const { user, logout, isAuthenticated, endDemoSession, resetOnboarding } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  
  // Check if we're in demo mode
  const isDemo = sessionStorage.getItem('isDemo') === 'true' || sessionStorage.getItem('burnwise_demo_context') !== null;
  
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
      // Load settings from settingsManager which applies them immediately
      const loadedSettings = settingsManager.loadSettings();
      setSettings(loadedSettings);
      settingsManager.applySettings(); // Ensure settings are applied
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
      // Save settings through settingsManager which also applies them
      const success = settingsManager.saveSettings(settings);
      if (success) {
        toast.success('Settings saved and applied successfully');
      } else {
        throw new Error('Failed to save settings');
      }
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

  const handleLogout = async () => {
    const logoutMessage = `Are you sure you want to logout?

This will:
• Sign you out of BURNWISE
• Return you to the login page

${isDemo ? 'Your demo session will remain active and you can return anytime.' : 'Your farm data will remain safely stored.'}`;

    const confirmed = window.confirm(logoutMessage);
    
    if (!confirmed) return;

    setIsLoggingOut(true);
    
    try {
      toast.success('Logged out successfully');
      
      // Call logout from AuthContext
      await logout();
      
      // Navigate to login page
      navigate('/login');
      
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Logout failed. Please try again.');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleRedoOnboarding = () => {
    const confirmed = window.confirm(`Are you sure you want to redo the onboarding?

This will:
• Reset your onboarding completion status
• Redirect you to the onboarding assistant
• Allow you to update your farm information

Your existing data will not be deleted.`);
    
    if (!confirmed) return;
    
    // Reset onboarding status
    resetOnboarding();
    
    // Redirect to onboarding
    navigate('/onboarding');
  };

  const handleEndDemoSession = async () => {
    const confirmed = window.confirm(`Are you sure you want to end your demo session?

This will:
• Permanently end your demo session
• Clear all local demo data
• Return you to the login page

Note: Your demo data in TiDB will remain until automatic cleanup (24 hours).

To start a new demo, you'll need to click "Use Demo Account" again.`);
    
    if (!confirmed) return;

    setIsLoggingOut(true);
    
    try {
      // Clear demo context
      sessionStorage.removeItem('burnwise_demo_context');
      sessionStorage.removeItem('demo_encryption_key');
      sessionStorage.removeItem('isDemo');
      
      toast.success('Demo session ended');
      
      // Call endDemoSession from AuthContext
      await endDemoSession();
      
      // Navigate to login page
      navigate('/login');
      
    } catch (error) {
      console.error('End demo session error:', error);
      toast.error('Failed to end demo session. Please try again.');
    } finally {
      setIsLoggingOut(false);
    }
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

              {/* Account Management Section */}
              <div className="subsection account-management">
                <h3 className="subsection-title">
                  <FaLock />
                  Account Management
                </h3>
                
                <div className="account-info-card">
                  <div className="account-info-header">
                    <FaUser className="account-icon" />
                    <div>
                      <h4>Account Status</h4>
                      <p>Signed in as: <strong>{user?.email || 'Unknown'}</strong></p>
                      <p>Farm ID: <strong>#{user?.farmId || 'Unknown'}</strong></p>
                    </div>
                  </div>
                  
                  {/* Check if demo mode */}
                  {sessionStorage.getItem('burnwise_demo_context') && (
                    <div className="demo-status-badge">
                      <FaShieldAlt />
                      <span>Demo Mode Active</span>
                    </div>
                  )}
                </div>

                <div className="account-actions">
                  <div className="account-action-group">
                    <h4>Security Actions</h4>
                    
                    <button
                      className="btn-secondary account-action-btn"
                      onClick={() => toast.info('Password change feature coming soon')}
                      disabled={!!sessionStorage.getItem('burnwise_demo_context')}
                    >
                      <FaKey />
                      Change Password
                    </button>
                    
                    <button
                      className="btn-secondary account-action-btn"
                      onClick={handleRedoOnboarding}
                    >
                      <FaRedo />
                      Redo Onboarding
                    </button>
                  </div>

                  <div className="account-action-group danger-zone">
                    <h4>Session Management</h4>
                    <p className="danger-zone-description">
                      Manage your BURNWISE session
                    </p>
                    
                    <motion.button
                      className="btn-logout"
                      onClick={handleLogout}
                      disabled={isLoggingOut}
                      whileHover={!isLoggingOut ? { scale: 1.02 } : {}}
                      whileTap={!isLoggingOut ? { scale: 0.98 } : {}}
                    >
                      {isLoggingOut ? (
                        <>
                          <LoadingSpinner size="small" color="#fff" />
                          Signing Out...
                        </>
                      ) : (
                        <>
                          <FaSignOutAlt />
                          Sign Out
                        </>
                      )}
                    </motion.button>
                    
                    {isDemo && (
                      <>
                        <motion.button
                          className="btn-danger demo-end-button"
                          onClick={handleEndDemoSession}
                          disabled={isLoggingOut}
                          whileHover={!isLoggingOut ? { scale: 1.02 } : {}}
                          whileTap={!isLoggingOut ? { scale: 0.98 } : {}}
                        >
                          {isLoggingOut ? (
                            <>
                              <LoadingSpinner size="small" color="#fff" />
                              Ending Demo...
                            </>
                          ) : (
                            <>
                              <FaTrash />
                              End Demo Session
                            </>
                          )}
                        </motion.button>
                        <p className="demo-end-warning">
                          ⚠️ Ending demo session is permanent. You can sign out and return anytime without ending the demo.
                        </p>
                      </>
                    )}
                    
                    <p className="logout-disclaimer">
                      {isDemo 
                        ? 'Sign out to leave temporarily, or end session to permanently remove demo.'
                        : 'Your farm data will remain safely stored and accessible on next login.'
                      }
                    </p>
                  </div>
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

              {/* Demo Reset Section - Only visible in demo mode */}
              <DemoResetSection />
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

// Demo Reset Section Component - Only shown in demo mode
const DemoResetSection = () => {
  const [isResetting, setIsResetting] = useState(false);
  const [demoSession, setDemoSession] = useState(null);

  useEffect(() => {
    // Check if we're in demo mode
    const demoContext = sessionStorage.getItem('burnwise_demo_context');
    if (demoContext) {
      try {
        setDemoSession(JSON.parse(demoContext));
      } catch (error) {
        console.error('Failed to parse demo context:', error);
      }
    }
  }, []);

  if (!demoSession) return null; // Only show in demo mode

  const handleDemoReset = async () => {
    const confirmed = window.confirm(`
Are you sure you want to reset your demo session?

This will:
• Delete all demo data from TiDB database
• Clear your burn requests and farm data  
• Remove phone number (if added)
• Reset tutorial progress
• Return you to demo mode selection

This action cannot be undone.
    `);

    if (!confirmed) return;

    setIsResetting(true);
    
    try {
      const response = await fetch('/api/demo/reset', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Demo-Mode': 'true'
        },
        credentials: 'include',
        body: JSON.stringify({
          sessionId: demoSession.sessionId,
          isDemo: true
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Reset failed');
      }

      const data = await response.json();
      
      // Clear local demo context
      sessionStorage.removeItem('burnwise_demo_context');
      localStorage.removeItem('demo_encryption_key');
      
      toast.success('Demo session reset successfully!');
      
      // Redirect to demo selector or login page
      setTimeout(() => {
        window.location.href = '/login';
      }, 1500);

    } catch (error) {
      console.error('Demo reset error:', error);
      toast.error(error.message || 'Failed to reset demo session');
    } finally {
      setIsResetting(false);
    }
  };

  const getTimeRemaining = () => {
    if (!demoSession.startTime) return 'Unknown';
    
    const start = new Date(demoSession.startTime);
    const expiry = new Date(start.getTime() + 24 * 60 * 60 * 1000); // 24 hours
    const now = new Date();
    const remaining = expiry - now;
    
    if (remaining <= 0) return 'Expired';
    
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="subsection demo-reset-section">
      <h3 className="subsection-title">
        <FaTrash />
        Demo Session Management
      </h3>
      
      <div className="demo-info-card">
        <div className="demo-info-header">
          <FaShieldAlt className="demo-icon" />
          <div>
            <h4>Active Demo Session</h4>
            <p>Session ID: {demoSession.sessionId?.substring(0, 8)}...</p>
          </div>
        </div>
        
        <div className="demo-info-stats">
          <div className="demo-stat">
            <FaClock />
            <div>
              <strong>Time Remaining</strong>
              <span>{getTimeRemaining()}</span>
            </div>
          </div>
          <div className="demo-stat">
            <FaDatabase />
            <div>
              <strong>Demo Mode</strong>
              <span>{demoSession.mode === 'blank' ? 'Blank Slate' : 'Sample Farm'}</span>
            </div>
          </div>
        </div>
        
        <div className="demo-features">
          <p>Your demo includes:</p>
          <ul>
            <li>Real TiDB database integration</li>
            <li>Live GPT-5 agent interactions</li>
            <li>Secure encrypted phone storage</li>
            <li>Full spatial interface experience</li>
          </ul>
        </div>
      </div>

      <div className="reset-warning">
        <FaExclamationTriangle />
        <div>
          <strong>Reset Demo Session</strong>
          <p>This will completely delete all your demo data from the TiDB database and return you to demo mode selection.</p>
        </div>
      </div>

      <div className="demo-reset-actions">
        <motion.button
          className="btn-danger demo-reset-btn"
          onClick={handleDemoReset}
          disabled={isResetting}
          whileHover={!isResetting ? { scale: 1.02 } : {}}
          whileTap={!isResetting ? { scale: 0.98 } : {}}
        >
          {isResetting ? (
            <>
              <LoadingSpinner size="small" color="#fff" />
              Resetting Demo...
            </>
          ) : (
            <>
              <FaRedo />
              Reset Demo Session
            </>
          )}
        </motion.button>
        
        <p className="reset-disclaimer">
          <strong>Note:</strong> All demo data is automatically deleted after 24 hours.
          Use reset if you want to start fresh or try a different demo mode.
        </p>
      </div>
    </div>
  );
};

export default Settings;