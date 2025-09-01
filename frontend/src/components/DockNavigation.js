/**
 * DockNavigation.js - Minimalist Bottom Dock (4 Icons)
 * Replaces traditional navigation with essential controls
 * Inspired by macOS dock with magnetic snap animation
 * Glass morphism design with hover effects
 * NO MOCKS - Real navigation actions
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { FaFire } from 'react-icons/fa';
import NotificationButton from './NotificationButton';
import './DockNavigation.css';
import { springPresets, animationVariants } from '../styles/animations';

const DockNavigation = ({ onAction, activePanel, activeBurnsCount = 0 }) => {
  const [hoveredIcon, setHoveredIcon] = useState(null);
  const navigate = useNavigate();
  
  const dockItems = [
    {
      id: 'layers',
      label: 'Map Layers',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
          <polyline points="2 17 12 22 22 17"></polyline>
          <polyline points="2 12 12 17 22 12"></polyline>
        </svg>
      ),
      action: () => onAction('layers')
    },
    {
      id: 'burns',
      label: 'Active Burns',
      icon: <FaFire size={24} />,
      action: () => onAction('burns'),
      badge: activeBurnsCount > 0 ? activeBurnsCount : null // Real active burns count
    },
    {
      id: 'ai',
      label: 'AI Assistant',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2a10 10 0 1 0 10 10H12V2z"></path>
          <circle cx="12" cy="12" r="2"></circle>
          <path d="M12 14v7"></path>
        </svg>
      ),
      action: () => onAction('ai')
    },
    {
      id: 'metrics',
      label: 'Backend Metrics',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"></circle>
          <circle cx="12" cy="12" r="6"></circle>
          <circle cx="12" cy="12" r="2"></circle>
          <path d="M12 2v4"></path>
          <path d="M12 18v4"></path>
          <path d="M4.93 4.93l2.83 2.83"></path>
          <path d="M16.24 16.24l2.83 2.83"></path>
          <path d="M2 12h4"></path>
          <path d="M18 12h4"></path>
          <path d="M4.93 19.07l2.83-2.83"></path>
          <path d="M16.24 7.76l2.83-2.83"></path>
        </svg>
      ),
      action: () => onAction('metrics')
    },
    {
      id: 'user',
      label: 'Settings',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      ),
      action: () => navigate('/settings')
    }
  ];
  
  // Using global animation standards for consistency
  const iconVariants = animationVariants.dockIcon;
  
  const tooltipVariants = {
    hidden: { opacity: 0, y: 10, scale: 0.8 },
    visible: { 
      opacity: 1, 
      y: -5, 
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 35,
        restDelta: 0.001
      }
    }
  };
  
  return (
    <motion.div 
      className="dock-navigation"
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={springPresets.discreteEntrance}
    >
      <div className="dock-container">
        {dockItems.map((item, index) => (
          <motion.div
            key={item.id}
            className={`dock-item ${activePanel === item.id ? 'active' : ''}`}
            data-dock-item={item.id}
            variants={iconVariants}
            initial="initial"
            whileHover="hover"
            whileTap="tap"
            onHoverStart={() => setHoveredIcon(item.id)}
            onHoverEnd={() => setHoveredIcon(null)}
            onClick={item.action}
            style={{
              zIndex: hoveredIcon === item.id ? 10 : 1
            }}
          >
            {/* Icon */}
            <div className="dock-icon">
              {item.icon}
              {item.badge && (
                <motion.div 
                  className="dock-badge"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 500 }}
                >
                  {item.badge}
                </motion.div>
              )}
            </div>
            
            {/* Tooltip */}
            {hoveredIcon === item.id && (
              <motion.div
                className="dock-tooltip"
                variants={tooltipVariants}
                initial="hidden"
                animate="visible"
                exit="hidden"
              >
                {item.label}
              </motion.div>
            )}
            
            {/* Active indicator */}
            {activePanel === item.id && (
              <motion.div 
                className="dock-active-indicator"
                layoutId="activeIndicator"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
          </motion.div>
        ))}
        
        {/* Notification Button - separate from dock items */}
        <div className="dock-notification-wrapper">
          <NotificationButton />
        </div>
      </div>
      
      {/* Dock reflection effect */}
      <div className="dock-reflection" />
    </motion.div>
  );
};

export default DockNavigation;