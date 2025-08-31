/**
 * WeatherAnalysisCard.js - Professional NFDRS4 Weather Analysis Display
 * Ultra-rigorous visualization of National Fire Danger Rating System v4.0 data
 * NO MOCKS - Real NFDRS4 meteorological calculations only
 */

import React from 'react';
import { motion } from 'framer-motion';
import './WeatherAnalysisCard.css';

const WeatherAnalysisCard = ({ nfdrs4Data, compact = false }) => {
  // ULTRA-MICRO F1.5: NFDRS4 Burning Index color classification (0-25 green, 26-50 yellow, 51-75 orange, 76-99 red)
  const getBurningIndexColor = (value) => {
    if (value >= 0 && value <= 25) return '#4CAF50';  // Green - Low fire danger
    if (value >= 26 && value <= 50) return '#FFC107'; // Yellow - Moderate fire danger
    if (value >= 51 && value <= 75) return '#FF9800'; // Orange - High fire danger
    if (value >= 76 && value <= 99) return '#f44336'; // Red - Extreme fire danger
    return '#9E9E9E'; // Gray - Invalid/unknown
  };

  // ULTRA-MICRO F1.6: NFDRS4 Spread Component color classification
  const getSpreadComponentColor = (value) => {
    if (value >= 0 && value <= 25) return '#4CAF50';  // Green - Low wind-driven spread
    if (value >= 26 && value <= 50) return '#FFC107'; // Yellow - Moderate spread potential
    if (value >= 51 && value <= 75) return '#FF9800'; // Orange - High spread potential
    if (value >= 76 && value <= 99) return '#f44336'; // Red - Extreme spread potential
    return '#9E9E9E'; // Gray - Invalid/unknown
  };

  // ULTRA-MICRO F1.7: NFDRS4 Energy Release Component color classification
  const getEnergyReleaseColor = (value) => {
    if (value >= 0 && value <= 25) return '#4CAF50';  // Green - Low fuel energy availability
    if (value >= 26 && value <= 50) return '#FFC107'; // Yellow - Moderate energy release
    if (value >= 51 && value <= 75) return '#FF9800'; // Orange - High energy release
    if (value >= 76 && value <= 99) return '#f44336'; // Red - Extreme energy release
    return '#9E9E9E'; // Gray - Invalid/unknown
  };

  // ULTRA-MICRO F1.8: Equilibrium Moisture Content color classification (inverted - lower moisture = higher danger)
  const getEquilibriumMoistureColor = (value) => {
    if (value >= 12.1) return '#4CAF50';      // Green - High moisture (safe)
    if (value >= 8.1 && value <= 12.0) return '#FFC107'; // Yellow - Moderate moisture
    if (value >= 6.1 && value <= 8.0) return '#FF9800';  // Orange - Low moisture (dangerous)
    if (value >= 0 && value <= 6.0) return '#f44336';    // Red - Critical dryness (extreme danger)
    return '#9E9E9E'; // Gray - Invalid/unknown
  };

  // Professional fire behavior classification
  const getBurningIndexClassification = (value) => {
    if (value >= 0 && value <= 25) return 'Low Fire Danger';
    if (value >= 26 && value <= 50) return 'Moderate Fire Danger';
    if (value >= 51 && value <= 75) return 'High Fire Danger';
    if (value >= 76 && value <= 99) return 'Extreme Fire Danger';
    return 'Invalid Range';
  };

  const getSpreadComponentClassification = (value) => {
    if (value >= 0 && value <= 25) return 'Low Wind-Driven Spread';
    if (value >= 26 && value <= 50) return 'Moderate Spread Potential';
    if (value >= 51 && value <= 75) return 'High Spread Potential';
    if (value >= 76 && value <= 99) return 'Extreme Spread Potential';
    return 'Invalid Range';
  };

  const getEnergyReleaseClassification = (value) => {
    if (value >= 0 && value <= 25) return 'Low Fuel Energy Release';
    if (value >= 26 && value <= 50) return 'Moderate Energy Release';
    if (value >= 51 && value <= 75) return 'High Energy Release';
    if (value >= 76 && value <= 99) return 'Extreme Energy Release';
    return 'Invalid Range';
  };

  const getMoistureClassification = (value) => {
    if (value >= 12.1) return 'Safe Moisture Levels';
    if (value >= 8.1 && value <= 12.0) return 'Moderate Fuel Dryness';
    if (value >= 6.1 && value <= 8.0) return 'Dangerous Fuel Dryness';
    if (value >= 0 && value <= 6.0) return 'Critical Fuel Dryness';
    return 'Invalid Range';
  };

  if (!nfdrs4Data || !nfdrs4Data.isValid) {
    return (
      <motion.div 
        className="weather-analysis-card error"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="error-content">
          <span className="error-icon">⚠</span>
          <span className="error-text">Invalid or missing NFDRS4 weather analysis data</span>
        </div>
      </motion.div>
    );
  }

  const { burningIndex, spreadComponent, energyReleaseComponent, equilibriumMoisture } = nfdrs4Data;

  if (compact) {
    return (
      <motion.div 
        className="weather-analysis-card compact"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
      >
        <div className="compact-header">
          <span className="nfdrs4-badge">NFDRS4</span>
          <span className="analysis-title">Weather Analysis</span>
        </div>
        <div className="compact-metrics">
          <div className="metric-compact">
            <span className="metric-label">BI</span>
            <span 
              className="metric-value"
              style={{ color: getBurningIndexColor(burningIndex) }}
            >
              {burningIndex}
            </span>
          </div>
          <div className="metric-compact">
            <span className="metric-label">SC</span>
            <span 
              className="metric-value"
              style={{ color: getSpreadComponentColor(spreadComponent) }}
            >
              {spreadComponent}
            </span>
          </div>
          <div className="metric-compact">
            <span className="metric-label">ERC</span>
            <span 
              className="metric-value"
              style={{ color: getEnergyReleaseColor(energyReleaseComponent) }}
            >
              {energyReleaseComponent}
            </span>
          </div>
          <div className="metric-compact">
            <span className="metric-label">EMC</span>
            <span 
              className="metric-value"
              style={{ color: getEquilibriumMoistureColor(equilibriumMoisture) }}
            >
              {equilibriumMoisture}%
            </span>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      className="weather-analysis-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      {/* Header */}
      <div className="card-header">
        <div className="header-content">
          <span className="nfdrs4-badge professional">NFDRS4</span>
          <h3 className="analysis-title">Professional Weather Analysis</h3>
        </div>
        <div className="methodology-note">
          US National Fire Danger Rating System v4.0
        </div>
      </div>

      {/* ULTRA-MICRO F1.5: NFDRS4 Burning Index Display */}
      <div className="metric-section primary">
        <div className="metric-header">
          <span className="metric-name">Burning Index (BI)</span>
          <span 
            className="metric-value-large"
            style={{ color: getBurningIndexColor(burningIndex) }}
          >
            {burningIndex}
          </span>
        </div>
        <div className="metric-details">
          <div 
            className="metric-bar"
            style={{ 
              backgroundColor: getBurningIndexColor(burningIndex),
              width: `${Math.min(burningIndex, 99)}%`
            }}
          />
          <span className="metric-classification">
            {getBurningIndexClassification(burningIndex)}
          </span>
        </div>
      </div>

      {/* ULTRA-MICRO F1.6: NFDRS4 Spread Component Display */}
      <div className="metric-section">
        <div className="metric-header">
          <span className="metric-name">Spread Component (SC)</span>
          <span 
            className="metric-value"
            style={{ color: getSpreadComponentColor(spreadComponent) }}
          >
            {spreadComponent}
          </span>
        </div>
        <div className="metric-details">
          <div 
            className="metric-bar"
            style={{ 
              backgroundColor: getSpreadComponentColor(spreadComponent),
              width: `${Math.min(spreadComponent, 99)}%`
            }}
          />
          <span className="metric-classification">
            {getSpreadComponentClassification(spreadComponent)}
          </span>
          <span className="metric-explanation">
            Wind-driven fire spread potential
          </span>
        </div>
      </div>

      {/* ULTRA-MICRO F1.7: NFDRS4 Energy Release Component Display */}
      <div className="metric-section">
        <div className="metric-header">
          <span className="metric-name">Energy Release Component (ERC)</span>
          <span 
            className="metric-value"
            style={{ color: getEnergyReleaseColor(energyReleaseComponent) }}
          >
            {energyReleaseComponent}
          </span>
        </div>
        <div className="metric-details">
          <div 
            className="metric-bar"
            style={{ 
              backgroundColor: getEnergyReleaseColor(energyReleaseComponent),
              width: `${Math.min(energyReleaseComponent, 99)}%`
            }}
          />
          <span className="metric-classification">
            {getEnergyReleaseClassification(energyReleaseComponent)}
          </span>
          <span className="metric-explanation">
            Fuel energy availability for combustion
          </span>
        </div>
      </div>

      {/* ULTRA-MICRO F1.8: NFDRS4 Equilibrium Moisture Content Display */}
      <div className="metric-section">
        <div className="metric-header">
          <span className="metric-name">Equilibrium Moisture Content (EMC)</span>
          <span 
            className="metric-value"
            style={{ color: getEquilibriumMoistureColor(equilibriumMoisture) }}
          >
            {equilibriumMoisture}%
          </span>
        </div>
        <div className="metric-details">
          <div 
            className="metric-bar inverted"
            style={{ 
              backgroundColor: getEquilibriumMoistureColor(equilibriumMoisture),
              width: `${100 - Math.min((equilibriumMoisture / 20) * 100, 100)}%`
            }}
          />
          <span className="metric-classification">
            {getMoistureClassification(equilibriumMoisture)}
          </span>
          <span className="metric-explanation">
            Fuel dryness based on atmospheric conditions
          </span>
        </div>
      </div>

      {/* Professional Analysis Summary */}
      <div className="analysis-summary">
        <div className="summary-header">
          <span className="summary-title">Professional Assessment</span>
        </div>
        <div className="summary-content">
          <p className="assessment-text">
            NFDRS4 analysis indicates {getBurningIndexClassification(burningIndex).toLowerCase()} 
            conditions with {getSpreadComponentClassification(spreadComponent).toLowerCase()} 
            and {getMoistureClassification(equilibriumMoisture).toLowerCase()}.
          </p>
        </div>
      </div>
    </motion.div>
  );
};

export default WeatherAnalysisCard;