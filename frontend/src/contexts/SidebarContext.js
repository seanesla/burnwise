/**
 * SidebarContext - Manages sidebar expanded/collapsed state across components
 * Ensures dashboard layout adjusts properly when sidebar state changes
 */

import React, { createContext, useContext, useState, useEffect } from 'react';

const SidebarContext = createContext();

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
};

export const SidebarProvider = ({ children }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  
  // Persist sidebar state to localStorage using unified key
  useEffect(() => {
    const saved = localStorage.getItem('burnwise-sidebar-expanded');
    if (saved !== null) {
      setIsExpanded(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('burnwise-sidebar-expanded', JSON.stringify(isExpanded));
    // Dispatch custom event for components that need real-time updates
    window.dispatchEvent(new CustomEvent('sidebar-state-changed', { 
      detail: { isExpanded } 
    }));
  }, [isExpanded]);

  const toggleSidebar = () => {
    setIsExpanded(prev => !prev);
  };

  const value = {
    isExpanded,
    setIsExpanded,
    toggleSidebar
  };

  return (
    <SidebarContext.Provider value={value}>
      {children}
    </SidebarContext.Provider>
  );
};