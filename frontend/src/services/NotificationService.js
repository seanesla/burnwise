/**
 * NotificationService.js - Browser Desktop Notifications
 * Handles permission requests and notification display
 * Uses real browser Notification API - no mocks
 */

class NotificationService {
  constructor() {
    this.permission = this.getPermission();
    this.supported = this.checkSupport();
  }

  /**
   * Check if browser supports notifications
   */
  checkSupport() {
    if (!("Notification" in window)) {
      console.warn('This browser does not support desktop notifications');
      return false;
    }
    return true;
  }

  /**
   * Get current permission state
   */
  getPermission() {
    if (!this.supported) return 'unsupported';
    return Notification.permission;
  }

  /**
   * Request notification permission
   * Must be called from user interaction (button click)
   */
  async requestPermission() {
    if (!this.supported) {
      return 'unsupported';
    }

    try {
      const permission = await Notification.requestPermission();
      this.permission = permission;
      
      // Store permission state
      localStorage.setItem('burnwise-notification-permission', permission);
      
      return permission;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return 'denied';
    }
  }

  /**
   * Show a notification
   * @param {string} title - Notification title
   * @param {Object} options - Notification options
   */
  showNotification(title, options = {}) {
    if (!this.supported) {
      console.warn('Notifications not supported');
      return null;
    }

    if (this.permission !== 'granted') {
      console.warn('Notification permission not granted');
      return null;
    }

    try {
      const defaultOptions = {
        icon: '/favicon.png',
        badge: '/favicon.png',
        requireInteraction: false,
        silent: false,
        timestamp: Date.now()
      };

      const notification = new Notification(title, { ...defaultOptions, ...options });
      
      // Auto close after 10 seconds
      setTimeout(() => {
        notification.close();
      }, options.duration || 10000);

      // Handle click - focus window
      notification.onclick = (event) => {
        event.preventDefault();
        window.focus();
        notification.close();
        
        // Call custom click handler if provided
        if (options.onClick) {
          options.onClick(event);
        }
      };

      // Handle close
      notification.onclose = () => {
        if (options.onClose) {
          options.onClose();
        }
      };

      // Handle error
      notification.onerror = (error) => {
        console.error('Notification error:', error);
        if (options.onError) {
          options.onError(error);
        }
      };

      return notification;
    } catch (error) {
      console.error('Error showing notification:', error);
      return null;
    }
  }

  /**
   * Show alert notification for burn-related events
   */
  showBurnAlert(data) {
    const { type, message, severity, farmName, fieldName } = data;
    
    let title = 'Burn Alert';
    let body = message;
    let tag = `burn-alert-${type}`;
    
    // Customize based on alert type
    switch (type) {
      case 'burn_schedule_changed':
        title = 'Schedule Updated';
        body = `${fieldName || 'Field'} burn schedule has been updated`;
        break;
      case 'weather_alert':
        title = 'Weather Alert';
        body = `Weather conditions have changed for ${farmName || 'your farm'}`;
        break;
      case 'conflict_detected':
        title = 'Conflict Detected';
        body = `Potential smoke conflict detected with nearby farms`;
        tag = `conflict-${Date.now()}`; // Don't replace conflict notifications
        break;
      case 'approval_needed':
        title = 'Approval Required';
        body = `Burn request needs your approval`;
        break;
      default:
        title = 'Farm Alert';
    }

    return this.showNotification(title, {
      body,
      tag,
      icon: severity === 'high' ? '/favicon.png' : '/favicon.png',
      requireInteraction: severity === 'high',
      onClick: () => {
        // Navigate to relevant section
        if (type === 'approval_needed') {
          window.location.hash = '#approvals';
        }
      }
    });
  }

  /**
   * Test notification
   */
  showTestNotification() {
    return this.showNotification('Test Notification', {
      body: 'Burnwise notifications are working correctly!',
      tag: 'test-notification',
      duration: 5000
    });
  }

  /**
   * Check if notifications are enabled
   */
  isEnabled() {
    return this.supported && this.permission === 'granted';
  }

  /**
   * Get permission status
   */
  getStatus() {
    return {
      supported: this.supported,
      permission: this.permission,
      enabled: this.isEnabled()
    };
  }
}

// Export singleton instance
export default new NotificationService();