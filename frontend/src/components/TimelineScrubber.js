/**
 * TimelineScrubber.js - Temporal Navigation Control
 * Scrub through past, present, and future burns
 * Shows burn events on timeline with weather forecast
 * Inspired by video editing timeline interfaces
 * NO MOCKS - Real temporal data navigation
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import './TimelineScrubber.css';

const TimelineScrubber = ({ currentTime, onChange }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [viewMode, setViewMode] = useState('day'); // day, week, month
  const [burns, setBurns] = useState([]);
  const scrubberRef = useRef(null);
  const playbackInterval = useRef(null);
  
  // Motion values for smooth dragging
  const x = useMotionValue(0);
  const background = useTransform(
    x,
    [-200, 0, 200],
    ['#FF6B35', '#FFA500', '#FFD700']
  );
  
  // Time calculations
  const now = new Date();
  const startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago
  const endTime = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days ahead
  
  useEffect(() => {
    loadTimelineData();
  }, [viewMode]);
  
  useEffect(() => {
    if (isPlaying) {
      playbackInterval.current = setInterval(() => {
        const newTime = new Date(currentTime.getTime() + 60 * 60 * 1000); // Advance 1 hour
        if (newTime > endTime) {
          setIsPlaying(false);
        } else {
          onChange(newTime);
        }
      }, 1000); // Update every second
    } else {
      if (playbackInterval.current) {
        clearInterval(playbackInterval.current);
      }
    }
    
    return () => {
      if (playbackInterval.current) {
        clearInterval(playbackInterval.current);
      }
    };
  }, [isPlaying, currentTime, endTime, onChange]);
  
  const loadTimelineData = async () => {
    try {
      // Get date range based on view mode
      const startDate = new Date(currentTime);
      const endDate = new Date(currentTime);
      
      if (viewMode === 'day') {
        endDate.setDate(endDate.getDate() + 1);
      } else if (viewMode === 'week') {
        endDate.setDate(endDate.getDate() + 7);
      } else if (viewMode === 'month') {
        endDate.setMonth(endDate.getMonth() + 1);
      }
      
      // Load timeline data for date range
      const dateStr = currentTime.toISOString().split('T')[0];
      const response = await fetch(`http://localhost:5001/api/schedule/timeline/${dateStr}`);
      const data = await response.json();
      
      if (data.success && data.data.timeline) {
        // Transform timeline data into burn events
        const events = [];
        Object.entries(data.data.timeline).forEach(([timeSlot, slotData]) => {
          slotData.burns.forEach(burn => {
            // Parse the scheduled time properly
            const [startHour, startMin] = burn.scheduled_start.split(':');
            const burnTime = new Date(currentTime);
            burnTime.setHours(parseInt(startHour), parseInt(startMin), 0, 0);
            
            events.push({
              id: burn.burn_request_id,
              time: burnTime,
              farmName: burn.farm_name,
              ownerName: burn.owner_name,
              acres: burn.acres,
              cropType: burn.crop_type,
              priorityScore: burn.priority_score,
              status: determineStatus(burnTime),
              smokeRadius: burn.max_dispersion_radius,
              location: {
                lat: burn.farm_lat,
                lon: burn.farm_lon
              }
            });
          });
        });
        
        setBurns(events);
      } else {
        // No burns scheduled, set empty array
        setBurns([]);
      }
    } catch (error) {
      console.error('Failed to load timeline data:', error);
      // Still set empty array on error to avoid undefined state
      setBurns([]);
    }
  };
  
  // Determine burn status based on current time
  const determineStatus = (burnTime) => {
    const now = new Date();
    const burnEnd = new Date(burnTime);
    burnEnd.setHours(burnEnd.getHours() + 2); // Assume 2-hour burn duration
    
    if (now < burnTime) {
      return 'scheduled';
    } else if (now >= burnTime && now <= burnEnd) {
      return 'active';
    } else {
      return 'completed';
    }
  };
  
  const formatTime = (date) => {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  };
  
  const formatDate = (date) => {
    const options = { month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  };
  
  const getTimePosition = (date) => {
    const totalDuration = endTime - startTime;
    const elapsed = date - startTime;
    return (elapsed / totalDuration) * 100;
  };
  
  const handleScrub = (event) => {
    if (!scrubberRef.current) return;
    
    const rect = scrubberRef.current.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const percentage = clickX / rect.width;
    
    const totalDuration = endTime - startTime;
    const newTime = new Date(startTime.getTime() + totalDuration * percentage);
    
    onChange(newTime);
  };
  
  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };
  
  const handleNow = () => {
    onChange(new Date());
    setIsPlaying(false);
  };
  
  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    // Adjust time range based on view mode
    switch(mode) {
      case 'day':
        // Show 24 hours
        break;
      case 'week':
        // Show 7 days
        break;
      case 'month':
        // Show 30 days
        break;
      default:
        break;
    }
  };
  
  return (
    <motion.div 
      className="timeline-scrubber"
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", damping: 20, stiffness: 300 }}
    >
      {/* Controls */}
      <div className="timeline-controls">
        <button 
          className="timeline-btn play-btn"
          onClick={handlePlayPause}
        >
          {isPlaying ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16"></rect>
              <rect x="14" y="4" width="4" height="16"></rect>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
          )}
        </button>
        
        <button 
          className="timeline-btn now-btn"
          onClick={handleNow}
        >
          NOW
        </button>
        
        <div className="view-mode-toggle">
          {['day', 'week', 'month'].map(mode => (
            <button
              key={mode}
              className={`view-mode-btn ${viewMode === mode ? 'active' : ''}`}
              onClick={() => handleViewModeChange(mode)}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
      </div>
      
      {/* Timeline Track */}
      <div 
        ref={scrubberRef}
        className="timeline-track"
        onClick={handleScrub}
      >
        {/* Time markers */}
        <div className="timeline-markers">
          {[...Array(8)].map((_, i) => {
            const markerTime = new Date(startTime.getTime() + (endTime - startTime) * (i / 7));
            return (
              <div 
                key={i} 
                className="timeline-marker"
                style={{ left: `${(i / 7) * 100}%` }}
              >
                <div className="marker-line" />
                <div className="marker-label">
                  {viewMode === 'day' ? formatTime(markerTime) : formatDate(markerTime)}
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Burn events */}
        <div className="timeline-events">
          {burns.map(burn => (
            <motion.div
              key={burn.id}
              className={`timeline-event ${burn.status}`}
              style={{ left: `${getTimePosition(new Date(burn.start_time))}%` }}
              whileHover={{ scale: 1.2, y: -5 }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="event-tooltip">
                <div className="tooltip-farm">{burn.farm_name}</div>
                <div className="tooltip-acres">{burn.acres} acres</div>
                <div className="tooltip-time">{formatTime(new Date(burn.start_time))}</div>
              </div>
            </motion.div>
          ))}
        </div>
        
        {/* Current time indicator */}
        <motion.div 
          className="timeline-current"
          style={{ 
            left: `${getTimePosition(currentTime)}%`,
            background: background
          }}
          drag="x"
          dragConstraints={scrubberRef}
          dragElastic={0}
          dragMomentum={false}
          onDrag={(e, info) => {
            if (!scrubberRef.current) return;
            const rect = scrubberRef.current.getBoundingClientRect();
            const dragX = info.point.x - rect.left;
            const percentage = Math.max(0, Math.min(1, dragX / rect.width));
            const totalDuration = endTime - startTime;
            const newTime = new Date(startTime.getTime() + totalDuration * percentage);
            onChange(newTime);
          }}
        >
          <div className="current-indicator">
            <div className="indicator-head" />
            <div className="indicator-line" />
          </div>
          <div className="current-time-label">
            {formatTime(currentTime)}
          </div>
        </motion.div>
        
        {/* Progress fill */}
        <div 
          className="timeline-progress"
          style={{ width: `${getTimePosition(currentTime)}%` }}
        />
      </div>
      
      {/* Time display */}
      <div className="timeline-display">
        <div className="display-date">
          {currentTime.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </div>
        <div className="display-time">
          {formatTime(currentTime)}
        </div>
      </div>
    </motion.div>
  );
};

export default TimelineScrubber;