import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  FaCog, FaBell, FaUser, FaLock, FaPalette, 
  FaDatabase, FaSync, FaSave, FaExclamationTriangle 
} from 'react-icons/fa';
import toast from 'react-hot-toast';
import LoadingSpinner from './LoadingSpinner';

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
      <div className="flex items-center justify-center min-h-screen bg-gradient-dark">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-dark p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
            <FaCog className="text-fire-orange" />
            Settings
          </h1>
          <p className="text-gray-400">
            Configure your BURNWISE experience
          </p>
        </motion.div>

        {/* Tab Navigation */}
        <div className="flex gap-4 mb-8 overflow-x-auto">
          {tabs.map(tab => (
            <motion.button
              key={tab.id}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-fire-orange to-fire-red text-white'
                  : 'glass-card text-gray-400 hover:text-white'
              }`}
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
          className="glass-card p-6"
        >
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-white mb-4">Profile Information</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={settings.profile.name}
                    onChange={(e) => handleInputChange('profile', 'name', e.target.value)}
                    className="w-full px-4 py-2 bg-black/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-fire-orange transition-colors"
                    placeholder="John Doe"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={settings.profile.email}
                    onChange={(e) => handleInputChange('profile', 'email', e.target.value)}
                    className="w-full px-4 py-2 bg-black/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-fire-orange transition-colors"
                    placeholder="john@example.com"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={settings.profile.phone}
                    onChange={(e) => handleInputChange('profile', 'phone', e.target.value)}
                    className="w-full px-4 py-2 bg-black/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-fire-orange transition-colors"
                    placeholder="+1 555-123-4567"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Farm Name
                  </label>
                  <input
                    type="text"
                    value={settings.profile.farmName}
                    onChange={(e) => handleInputChange('profile', 'farmName', e.target.value)}
                    className="w-full px-4 py-2 bg-black/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-fire-orange transition-colors"
                    placeholder="Green Acres Farm"
                  />
                </div>
              </div>
              
              <div className="pt-4 border-t border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-3">Account Role</h3>
                <div className="flex gap-4">
                  {['Farm Owner', 'Farm Manager', 'Coordinator'].map(role => (
                    <label key={role} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="role"
                        value={role}
                        checked={settings.profile.role === role}
                        onChange={(e) => handleInputChange('profile', 'role', e.target.value)}
                        className="accent-fire-orange"
                      />
                      <span className="text-gray-300">{role}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-white mb-4">Notification Preferences</h2>
              
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white">Alert Channels</h3>
                
                <label className="flex items-center justify-between p-4 bg-black/30 rounded-lg hover:bg-black/40 cursor-pointer">
                  <div className="flex items-center gap-3">
                    <FaBell className="text-fire-orange" />
                    <div>
                      <p className="text-white font-medium">Email Alerts</p>
                      <p className="text-gray-400 text-sm">Receive alerts via email</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.notifications.emailAlerts}
                    onChange={(e) => handleInputChange('notifications', 'emailAlerts', e.target.checked)}
                    className="w-5 h-5 accent-fire-orange"
                  />
                </label>
                
                <label className="flex items-center justify-between p-4 bg-black/30 rounded-lg hover:bg-black/40 cursor-pointer">
                  <div className="flex items-center gap-3">
                    <FaBell className="text-fire-orange" />
                    <div>
                      <p className="text-white font-medium">SMS Alerts</p>
                      <p className="text-gray-400 text-sm">Receive alerts via text message</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.notifications.smsAlerts}
                    onChange={(e) => handleInputChange('notifications', 'smsAlerts', e.target.checked)}
                    className="w-5 h-5 accent-fire-orange"
                  />
                </label>
                
                <label className="flex items-center justify-between p-4 bg-black/30 rounded-lg hover:bg-black/40 cursor-pointer">
                  <div className="flex items-center gap-3">
                    <FaBell className="text-fire-orange" />
                    <div>
                      <p className="text-white font-medium">Browser Notifications</p>
                      <p className="text-gray-400 text-sm">Show desktop notifications</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.notifications.browserNotifications}
                    onChange={(e) => handleInputChange('notifications', 'browserNotifications', e.target.checked)}
                    className="w-5 h-5 accent-fire-orange"
                  />
                </label>
              </div>
              
              <div className="space-y-4 pt-4 border-t border-gray-700">
                <h3 className="text-lg font-semibold text-white">Alert Types</h3>
                
                {Object.entries({
                  burnApproved: 'Burn Request Approved',
                  burnRejected: 'Burn Request Rejected',
                  weatherChange: 'Weather Condition Changes',
                  conflictDetected: 'Conflict Detected',
                  scheduleUpdate: 'Schedule Updates'
                }).map(([key, label]) => (
                  <label key={key} className="flex items-center justify-between p-3 bg-black/20 rounded-lg hover:bg-black/30 cursor-pointer">
                    <span className="text-gray-300">{label}</span>
                    <input
                      type="checkbox"
                      checked={settings.notifications.alertTypes[key]}
                      onChange={(e) => handleNestedChange('notifications', 'alertTypes', key, e.target.checked)}
                      className="w-5 h-5 accent-fire-orange"
                    />
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Preferences Tab */}
          {activeTab === 'preferences' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-white mb-4">Display Preferences</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Theme
                  </label>
                  <select
                    value={settings.preferences.theme}
                    onChange={(e) => handleInputChange('preferences', 'theme', e.target.value)}
                    className="w-full px-4 py-2 bg-black/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-fire-orange transition-colors"
                  >
                    <option value="dark">Dark (Fire)</option>
                    <option value="light">Light</option>
                    <option value="auto">System</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Map Style
                  </label>
                  <select
                    value={settings.preferences.mapStyle}
                    onChange={(e) => handleInputChange('preferences', 'mapStyle', e.target.value)}
                    className="w-full px-4 py-2 bg-black/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-fire-orange transition-colors"
                  >
                    <option value="satellite">Satellite</option>
                    <option value="streets">Streets</option>
                    <option value="dark">Dark</option>
                    <option value="outdoors">Outdoors</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Units
                  </label>
                  <select
                    value={settings.preferences.units}
                    onChange={(e) => handleInputChange('preferences', 'units', e.target.value)}
                    className="w-full px-4 py-2 bg-black/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-fire-orange transition-colors"
                  >
                    <option value="imperial">Imperial (miles, °F)</option>
                    <option value="metric">Metric (km, °C)</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Language
                  </label>
                  <select
                    value={settings.preferences.language}
                    onChange={(e) => handleInputChange('preferences', 'language', e.target.value)}
                    className="w-full px-4 py-2 bg-black/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-fire-orange transition-colors"
                  >
                    <option value="en">English</option>
                    <option value="es">Español</option>
                    <option value="fr">Français</option>
                  </select>
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Timezone
                  </label>
                  <select
                    value={settings.preferences.timezone}
                    onChange={(e) => handleInputChange('preferences', 'timezone', e.target.value)}
                    className="w-full px-4 py-2 bg-black/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-fire-orange transition-colors"
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
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-white mb-4">System Settings</h2>
              
              <div className="space-y-4">
                <label className="flex items-center justify-between p-4 bg-black/30 rounded-lg hover:bg-black/40 cursor-pointer">
                  <div className="flex items-center gap-3">
                    <FaDatabase className="text-fire-orange" />
                    <div>
                      <p className="text-white font-medium">Enable Cache</p>
                      <p className="text-gray-400 text-sm">Store data locally for faster loading</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.system.cacheEnabled}
                    onChange={(e) => handleInputChange('system', 'cacheEnabled', e.target.checked)}
                    className="w-5 h-5 accent-fire-orange"
                  />
                </label>
                
                <label className="flex items-center justify-between p-4 bg-black/30 rounded-lg hover:bg-black/40 cursor-pointer">
                  <div className="flex items-center gap-3">
                    <FaSync className="text-fire-orange" />
                    <div>
                      <p className="text-white font-medium">Auto Refresh</p>
                      <p className="text-gray-400 text-sm">Automatically update data</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.system.autoRefresh}
                    onChange={(e) => handleInputChange('system', 'autoRefresh', e.target.checked)}
                    className="w-5 h-5 accent-fire-orange"
                  />
                </label>
                
                {settings.system.autoRefresh && (
                  <div className="ml-12">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Refresh Interval (seconds)
                    </label>
                    <input
                      type="number"
                      min="10"
                      max="300"
                      value={settings.system.refreshInterval}
                      onChange={(e) => handleInputChange('system', 'refreshInterval', parseInt(e.target.value))}
                      className="w-32 px-4 py-2 bg-black/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-fire-orange transition-colors"
                    />
                  </div>
                )}
                
                <label className="flex items-center justify-between p-4 bg-black/30 rounded-lg hover:bg-black/40 cursor-pointer">
                  <div className="flex items-center gap-3">
                    <FaExclamationTriangle className="text-yellow-500" />
                    <div>
                      <p className="text-white font-medium">Debug Mode</p>
                      <p className="text-gray-400 text-sm">Show detailed error messages</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.system.debugMode}
                    onChange={(e) => handleInputChange('system', 'debugMode', e.target.checked)}
                    className="w-5 h-5 accent-fire-orange"
                  />
                </label>
                
                <label className="flex items-center justify-between p-4 bg-black/30 rounded-lg hover:bg-black/40 cursor-pointer">
                  <div className="flex items-center gap-3">
                    <FaCog className="text-fire-orange" />
                    <div>
                      <p className="text-white font-medium">Performance Mode</p>
                      <p className="text-gray-400 text-sm">Reduce animations for better performance</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.system.performanceMode}
                    onChange={(e) => handleInputChange('system', 'performanceMode', e.target.checked)}
                    className="w-5 h-5 accent-fire-orange"
                  />
                </label>
              </div>
              
              <div className="pt-4 border-t border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-3">Data Management</h3>
                <div className="flex gap-4">
                  <button
                    onClick={() => {
                      localStorage.clear();
                      toast.success('Cache cleared successfully');
                    }}
                    className="px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
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
                    className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
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
          className="mt-6 flex justify-end"
        >
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={saveSettings}
            disabled={saving}
            className="px-8 py-3 bg-gradient-to-r from-fire-orange to-fire-red text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-fire-orange/30 transition-all duration-200 flex items-center gap-2"
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