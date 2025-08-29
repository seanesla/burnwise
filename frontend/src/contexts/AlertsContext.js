/**
 * AlertsContext.js - Real-time Alerts Management
 * Manages Socket.io connection for real-time alerts
 * Coordinates notifications and sounds
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import io from 'socket.io-client';
import NotificationService from '../services/NotificationService';
import SoundService from '../services/SoundService';
import { useAuth } from './AuthContext';

const AlertsContext = createContext();

export const useAlerts = () => {
  const context = useContext(AlertsContext);
  if (!context) {
    throw new Error('useAlerts must be used within AlertsProvider');
  }
  return context;
};

export const AlertsProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [recentAlerts, setRecentAlerts] = useState([]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Initialize Socket.io connection
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    console.log('Initializing alerts connection...');
    
    const newSocket = io(process.env.REACT_APP_API_URL || 'http://localhost:5001', {
      withCredentials: true,
      transports: ['websocket', 'polling']
    });

    // Connection events
    newSocket.on('connect', () => {
      console.log('Connected to alerts system');
      setConnected(true);
      
      // Join farm-specific room if user has farmId
      if (user.farmId || user.farm_id) {
        const farmId = user.farmId || user.farm_id;
        newSocket.emit('join-farm', farmId);
        console.log(`Joined farm room: ${farmId}`);
      }
      
      // Subscribe to alert types
      newSocket.emit('subscribe-alerts', [
        'burn_schedule_changed',
        'weather_alert',
        'conflict_detected',
        'approval_needed'
      ]);
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from alerts system');
      setConnected(false);
    });

    // Handle incoming alerts
    newSocket.on('alert', handleIncomingAlert);
    newSocket.on('burn-alert', handleIncomingAlert);
    newSocket.on('farm-alert', handleIncomingAlert);
    
    setSocket(newSocket);

    // Cleanup
    return () => {
      if (newSocket) {
        newSocket.disconnect();
      }
    };
  }, [isAuthenticated, user]);

  // Handle incoming alert
  const handleIncomingAlert = useCallback(async (alertData) => {
    console.log('Received alert:', alertData);
    
    // Add to recent alerts
    const alert = {
      ...alertData,
      id: Date.now(),
      timestamp: new Date().toISOString(),
      read: false
    };
    
    setRecentAlerts(prev => [alert, ...prev].slice(0, 20)); // Keep last 20
    
    // Show notification if enabled
    if (notificationsEnabled) {
      NotificationService.showBurnAlert(alertData);
    }
    
    // Play sound if enabled
    if (soundEnabled) {
      await SoundService.initialize(); // Ensure initialized
      
      // Different sounds for different severities
      if (alertData.severity === 'high' || alertData.type === 'conflict_detected') {
        await SoundService.playWarningSound();
      } else if (alertData.type === 'approval_needed') {
        await SoundService.playAlertSound();
      } else {
        await SoundService.playSuccessSound();
      }
    }
  }, [notificationsEnabled, soundEnabled]);

  // Request notification permission
  const requestNotificationPermission = async () => {
    const permission = await NotificationService.requestPermission();
    setNotificationsEnabled(permission === 'granted');
    
    // Initialize sound on user interaction
    await SoundService.initialize();
    
    return permission;
  };

  // Toggle notifications
  const toggleNotifications = async () => {
    if (!notificationsEnabled) {
      const permission = await requestNotificationPermission();
      return permission === 'granted';
    } else {
      setNotificationsEnabled(false);
      return false;
    }
  };

  // Toggle sound
  const toggleSound = () => {
    const newState = SoundService.toggleMute();
    setSoundEnabled(!newState); // muted is opposite of enabled
    return !newState;
  };

  // Send test alert
  const sendTestAlert = () => {
    const testAlert = {
      type: 'test',
      message: 'This is a test alert',
      severity: 'low',
      farmName: user?.farmName || 'Demo Farm',
      fieldName: 'Test Field'
    };
    
    handleIncomingAlert(testAlert);
  };

  // Mark alert as read
  const markAlertAsRead = (alertId) => {
    setRecentAlerts(prev => 
      prev.map(alert => 
        alert.id === alertId ? { ...alert, read: true } : alert
      )
    );
  };

  // Clear all alerts
  const clearAlerts = () => {
    setRecentAlerts([]);
  };

  // Get unread count
  const getUnreadCount = () => {
    return recentAlerts.filter(alert => !alert.read).length;
  };

  // Check notification status
  useEffect(() => {
    const status = NotificationService.getStatus();
    setNotificationsEnabled(status.enabled);
    
    const soundStatus = SoundService.getStatus();
    setSoundEnabled(!soundStatus.muted);
  }, []);

  const value = {
    // Connection state
    connected,
    socket,
    
    // Alerts
    recentAlerts,
    unreadCount: getUnreadCount(),
    markAlertAsRead,
    clearAlerts,
    
    // Settings
    notificationsEnabled,
    soundEnabled,
    toggleNotifications,
    toggleSound,
    requestNotificationPermission,
    
    // Testing
    sendTestAlert,
    
    // Services
    NotificationService,
    SoundService
  };

  return (
    <AlertsContext.Provider value={value}>
      {children}
    </AlertsContext.Provider>
  );
};