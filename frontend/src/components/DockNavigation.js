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
import AnimatedFlameLogo from './animations/logos/AnimatedFlameLogo';
import './DockNavigation.css';

const DockNavigation = ({ onAction, activePanel }) => {
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
      icon: <AnimatedFlameLogo size={24} animated={hoveredIcon === 'burns'} />,
      action: () => onAction('burns'),
      badge: 3 // Number of active burns
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
  
  const iconVariants = {
    initial: { scale: 1, y: 0 },
    hover: { 
      scale: 1.3, 
      y: -10,
      transition: {
        type: "spring",
        stiffness: 400,
        damping: 10
      }
    },
    tap: { scale: 0.9 }
  };
  
  const tooltipVariants = {
    hidden: { opacity: 0, y: 10, scale: 0.8 },
    visible: { 
      opacity: 1, 
      y: -5, 
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 400,
        damping: 15
      }
    }
  };
  
  return (
    <motion.div 
      className="dock-navigation"
      initial={{ y: 100, x: "-50%" }}
      animate={{ y: 0, x: "-50%" }}
      transition={{ type: "spring", damping: 20, stiffness: 300 }}
      style={{ left: "50%" }}
    >
      <div className="dock-container">
        {dockItems.map((item, index) => (
          <motion.div
            key={item.id}
            className={`dock-item ${activePanel === item.id ? 'active' : ''}`}
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
      </div>
      
      {/* Dock reflection effect */}
      <div className="dock-reflection" />
    </motion.div>
  );
};

export default DockNavigation;