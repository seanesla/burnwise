-- Migration: Add Demo Mode Support to TiDB
-- Purpose: Enable demo mode with real TiDB integration and data isolation
-- Author: BURNWISE Demo Implementation
-- Date: Aug 20, 2025

-- Add demo flag to all core tables for data isolation
ALTER TABLE farms ADD COLUMN is_demo BOOLEAN DEFAULT FALSE;
ALTER TABLE farms ADD INDEX idx_demo_farms (is_demo, created_at);

ALTER TABLE burn_requests ADD COLUMN is_demo BOOLEAN DEFAULT FALSE;
ALTER TABLE burn_requests ADD INDEX idx_demo_burns (is_demo, farm_id, status);

ALTER TABLE schedules ADD COLUMN is_demo BOOLEAN DEFAULT FALSE;
ALTER TABLE schedules ADD INDEX idx_demo_schedules (is_demo, burn_date);

ALTER TABLE alerts ADD COLUMN is_demo BOOLEAN DEFAULT FALSE;
ALTER TABLE alerts ADD INDEX idx_demo_alerts (is_demo, created_at);

ALTER TABLE weather_data ADD COLUMN is_demo BOOLEAN DEFAULT FALSE;
ALTER TABLE weather_data ADD INDEX idx_demo_weather (is_demo, location_lat, location_lon);

-- Vector tables also get demo flag for TiDB vector search isolation
ALTER TABLE weather_embeddings ADD COLUMN is_demo BOOLEAN DEFAULT FALSE;
ALTER TABLE weather_embeddings ADD INDEX idx_demo_weather_vectors (is_demo, farm_id);

ALTER TABLE smoke_embeddings ADD COLUMN is_demo BOOLEAN DEFAULT FALSE;
ALTER TABLE smoke_embeddings ADD INDEX idx_demo_smoke_vectors (is_demo, burn_id);

ALTER TABLE burn_embeddings ADD COLUMN is_demo BOOLEAN DEFAULT FALSE;
ALTER TABLE burn_embeddings ADD INDEX idx_demo_burn_vectors (is_demo, farm_id);

-- Demo sessions table for tracking and management
CREATE TABLE demo_sessions (
  session_id VARCHAR(36) PRIMARY KEY,
  farm_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  phone_number VARCHAR(20),
  phone_encrypted BLOB,
  demo_type ENUM('blank', 'preloaded') NOT NULL,
  tutorial_progress JSON,
  total_cost DECIMAL(10,4) DEFAULT 0.0000,
  is_active BOOLEAN DEFAULT TRUE,
  
  INDEX idx_demo_cleanup (expires_at, is_active),
  INDEX idx_demo_farm (farm_id),
  INDEX idx_demo_cost (total_cost, created_at)
);

-- Agent interactions tracking for demo cost monitoring
CREATE TABLE agent_interactions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  farm_id INT NOT NULL,
  agent_type VARCHAR(50) NOT NULL,
  request JSON,
  response JSON,
  tokens_used INT,
  cost DECIMAL(8,4),
  is_demo BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_agent_demo (is_demo, farm_id, created_at),
  INDEX idx_agent_cost (cost, created_at)
);

-- Demo cost tracking summary (for quick lookups)
CREATE TABLE demo_cost_summary (
  date DATE PRIMARY KEY,
  total_sessions INT DEFAULT 0,
  total_cost DECIMAL(10,4) DEFAULT 0.0000,
  active_sessions INT DEFAULT 0,
  gpt5_mini_calls INT DEFAULT 0,
  gpt5_nano_calls INT DEFAULT 0,
  
  INDEX idx_cost_date (date DESC)
);