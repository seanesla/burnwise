// Settings Manager - Makes settings ACTUALLY WORK

class SettingsManager {
  constructor() {
    this.settings = this.loadSettings();
    this.applySettings();
  }

  // Load settings from localStorage
  loadSettings() {
    try {
      const saved = localStorage.getItem('burnwise_settings');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }

    // Return defaults if no saved settings
    return {
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
    };
  }

  // Save settings to localStorage
  saveSettings(settings) {
    try {
      localStorage.setItem('burnwise_settings', JSON.stringify(settings));
      this.settings = settings;
      this.applySettings();
      return true;
    } catch (error) {
      console.error('Failed to save settings:', error);
      return false;
    }
  }

  // ACTUALLY APPLY THE SETTINGS TO THE UI
  applySettings() {
    // Apply theme
    this.applyTheme(this.settings.preferences.theme);
    
    // Apply units preference
    this.applyUnits(this.settings.preferences.units);
    
    // Apply notification preferences
    this.applyNotifications(this.settings.notifications);
    
    // Apply system settings
    this.applySystemSettings(this.settings.system);
  }

  // Apply theme to document
  applyTheme(theme) {
    const root = document.documentElement;
    
    // Remove existing theme classes
    root.classList.remove('theme-dark', 'theme-light');
    
    // Add new theme class
    root.classList.add(`theme-${theme}`);
    
    // Also set data attribute for CSS
    root.setAttribute('data-theme', theme);
    
    // Update CSS variables for theme
    if (theme === 'light') {
      root.style.setProperty('--bg-primary', '#ffffff');
      root.style.setProperty('--bg-secondary', '#f5f5f5');
      root.style.setProperty('--text-primary', '#000000');
      root.style.setProperty('--text-secondary', '#333333');
      root.style.setProperty('--border-color', 'rgba(0, 0, 0, 0.1)');
    } else {
      root.style.setProperty('--bg-primary', '#000000');
      root.style.setProperty('--bg-secondary', '#1a1a1a');
      root.style.setProperty('--text-primary', '#ffffff');
      root.style.setProperty('--text-secondary', '#cccccc');
      root.style.setProperty('--border-color', 'rgba(255, 107, 53, 0.2)');
    }
  }

  // Apply units preference
  applyUnits(units) {
    // Store globally for conversions
    window.BURNWISE_UNITS = units;
  }

  // Apply notification settings
  applyNotifications(notifications) {
    // Request browser notification permission if enabled
    if (notifications.browserNotifications && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
    
    // Store notification preferences globally
    window.BURNWISE_NOTIFICATIONS = notifications;
  }

  // Apply system settings
  applySystemSettings(system) {
    // Enable/disable debug mode
    if (system.debugMode) {
      window.DEBUG = true;
      console.log('[BURNWISE] Debug mode enabled');
    } else {
      window.DEBUG = false;
    }
    
    // Store system settings globally
    window.BURNWISE_SYSTEM = system;
  }

  // Get a specific setting
  getSetting(path) {
    const keys = path.split('.');
    let value = this.settings;
    
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  // Update a specific setting
  updateSetting(path, value) {
    const keys = path.split('.');
    const settings = { ...this.settings };
    let current = settings;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current)) {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[keys[keys.length - 1]] = value;
    
    return this.saveSettings(settings);
  }
}

// Create singleton instance
const settingsManager = new SettingsManager();

export default settingsManager;