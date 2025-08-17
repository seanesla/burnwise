/**
 * ApprovalModal.js - Human-in-the-Loop Safety Decisions
 * Handles critical burn approvals requiring human intervention
 * Integrates with OpenAI Agents SDK needsApproval functionality
 * NO MOCKS - Real safety decision interface
 */

import React, { useState, useEffect } from 'react';
import './ApprovalModal.css';

const ApprovalModal = ({ 
  isOpen, 
  onClose, 
  approvalRequest,
  onApprove,
  onReject 
}) => {
  const [decision, setDecision] = useState(null);
  const [reasoning, setReasoning] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDecision(null);
      setReasoning('');
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen || !approvalRequest) return null;

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'CRITICAL': return '#f44336';
      case 'HIGH': return '#FF9800';
      case 'MARGINAL': return '#FFC107';
      default: return '#2196F3';
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'CRITICAL': return '🚨';
      case 'HIGH': return '⚠️';
      case 'MARGINAL': return '⚡';
      default: return 'ℹ️';
    }
  };

  const formatBurnDetails = (burnData) => {
    if (!burnData) return {};
    
    return {
      farmName: burnData.farm_name || burnData.farmName || 'Unknown Farm',
      fieldName: burnData.field_name || burnData.fieldName || 'Unknown Field',
      acres: burnData.acres || burnData.acreage || 0,
      cropType: burnData.crop_type || burnData.cropType || 'Unknown',
      burnDate: burnData.burn_date || burnData.burnDate || 'Unknown',
      timeWindow: burnData.time_window_start && burnData.time_window_end
        ? `${burnData.time_window_start} - ${burnData.time_window_end}`
        : 'Not specified',
      reason: burnData.reason || 'Not specified'
    };
  };

  const formatWeatherData = (weatherData) => {
    if (!weatherData) return {};
    
    return {
      windSpeed: weatherData.wind_speed || weatherData.windSpeed || 'Unknown',
      windDirection: weatherData.wind_direction || weatherData.windDirection || 'Unknown',
      humidity: weatherData.humidity || 'Unknown',
      temperature: weatherData.temperature || 'Unknown',
      conditions: weatherData.conditions || weatherData.weather_conditions || 'Unknown'
    };
  };

  const handleSubmit = async () => {
    if (!decision) return;
    
    setIsSubmitting(true);
    
    try {
      const response = {
        decision,
        reasoning: reasoning.trim() || (decision === 'approve' 
          ? 'Approved based on safety assessment' 
          : 'Rejected due to safety concerns'),
        timestamp: new Date().toISOString(),
        approvalData: {
          requestId: approvalRequest.id,
          severity: approvalRequest.severity,
          type: approvalRequest.type
        }
      };
      
      if (decision === 'approve') {
        await onApprove(response);
      } else {
        await onReject(response);
      }
      
      onClose();
    } catch (error) {
      console.error('Failed to submit approval decision:', error);
      // Keep modal open on error
    } finally {
      setIsSubmitting(false);
    }
  };

  const burnDetails = formatBurnDetails(approvalRequest.burnData);
  const weatherData = formatWeatherData(approvalRequest.weatherData);

  return (
    <div className="approval-modal-overlay" onClick={onClose}>
      <div className="approval-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="severity-indicator" style={{ backgroundColor: getSeverityColor(approvalRequest.severity) }}>
            <span className="severity-icon">{getSeverityIcon(approvalRequest.severity)}</span>
            <span className="severity-text">{approvalRequest.severity} APPROVAL REQUIRED</span>
          </div>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        {/* Content */}
        <div className="modal-content">
          {/* Request Type */}
          <div className="section">
            <h3>Approval Type</h3>
            <div className="approval-type">
              <span className="type-badge">{approvalRequest.type}</span>
              <p>{approvalRequest.description}</p>
            </div>
          </div>

          {/* Burn Details */}
          <div className="section">
            <h3>Burn Request Details</h3>
            <div className="details-grid">
              <div className="detail-item">
                <span className="detail-label">Farm:</span>
                <span className="detail-value">{burnDetails.farmName}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Field:</span>
                <span className="detail-value">{burnDetails.fieldName}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Acreage:</span>
                <span className="detail-value">{burnDetails.acres} acres</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Crop Type:</span>
                <span className="detail-value">{burnDetails.cropType}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Date:</span>
                <span className="detail-value">{burnDetails.burnDate}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Time Window:</span>
                <span className="detail-value">{burnDetails.timeWindow}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Reason:</span>
                <span className="detail-value">{burnDetails.reason}</span>
              </div>
            </div>
          </div>

          {/* Weather Conditions */}
          {approvalRequest.weatherData && (
            <div className="section">
              <h3>Weather Conditions</h3>
              <div className="weather-grid">
                <div className="weather-item">
                  <span className="weather-label">Wind Speed:</span>
                  <span className="weather-value">{weatherData.windSpeed} mph</span>
                </div>
                <div className="weather-item">
                  <span className="weather-label">Wind Direction:</span>
                  <span className="weather-value">{weatherData.windDirection}°</span>
                </div>
                <div className="weather-item">
                  <span className="weather-label">Humidity:</span>
                  <span className="weather-value">{weatherData.humidity}%</span>
                </div>
                <div className="weather-item">
                  <span className="weather-label">Temperature:</span>
                  <span className="weather-value">{weatherData.temperature}°F</span>
                </div>
                <div className="weather-item full-width">
                  <span className="weather-label">Conditions:</span>
                  <span className="weather-value">{weatherData.conditions}</span>
                </div>
              </div>
            </div>
          )}

          {/* Risk Assessment */}
          {approvalRequest.riskFactors && approvalRequest.riskFactors.length > 0 && (
            <div className="section">
              <h3>Risk Assessment</h3>
              <div className="risk-factors">
                {approvalRequest.riskFactors.map((risk, idx) => (
                  <div key={idx} className="risk-item">
                    <span className="risk-severity" style={{ 
                      backgroundColor: getSeverityColor(risk.severity) 
                    }}>
                      {risk.severity}
                    </span>
                    <span className="risk-description">{risk.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Recommendation */}
          {approvalRequest.aiRecommendation && (
            <div className="section">
              <h3>AI Recommendation</h3>
              <div className="ai-recommendation">
                <div className="recommendation-header">
                  <span className={`recommendation-decision ${approvalRequest.aiRecommendation.decision.toLowerCase()}`}>
                    {approvalRequest.aiRecommendation.decision}
                  </span>
                  <span className="confidence-score">
                    Confidence: {approvalRequest.aiRecommendation.confidence}%
                  </span>
                </div>
                <p className="recommendation-reasoning">
                  {approvalRequest.aiRecommendation.reasoning}
                </p>
              </div>
            </div>
          )}

          {/* Human Decision */}
          <div className="section">
            <h3>Your Decision</h3>
            <div className="decision-buttons">
              <button
                className={`decision-button approve ${decision === 'approve' ? 'selected' : ''}`}
                onClick={() => setDecision('approve')}
                disabled={isSubmitting}
              >
                <span className="button-icon">✓</span>
                Approve Burn
              </button>
              <button
                className={`decision-button reject ${decision === 'reject' ? 'selected' : ''}`}
                onClick={() => setDecision('reject')}
                disabled={isSubmitting}
              >
                <span className="button-icon">✗</span>
                Reject Burn
              </button>
            </div>

            {/* Reasoning Input */}
            <div className="reasoning-section">
              <label htmlFor="reasoning">Reasoning (optional):</label>
              <textarea
                id="reasoning"
                value={reasoning}
                onChange={(e) => setReasoning(e.target.value)}
                placeholder={decision === 'approve' 
                  ? "Optional: Add any conditions or notes for approval..."
                  : "Optional: Explain why this burn should be rejected..."
                }
                disabled={isSubmitting}
                rows="3"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button 
            className="cancel-button" 
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button 
            className="submit-button"
            onClick={handleSubmit}
            disabled={!decision || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className="spinner"></span>
                Submitting...
              </>
            ) : (
              `Submit ${decision === 'approve' ? 'Approval' : 'Rejection'}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApprovalModal;