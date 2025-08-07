-- BURNWISE Database Schema for TiDB
-- Created: 2025-08-07
-- Version: 1.0.0

-- ============================================
-- 1. FARMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS farms (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    owner_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(100),
    address VARCHAR(500),
    location POINT NOT NULL SRID 4326,
    farm_size_acres DECIMAL(10,2),
    primary_crops JSON,
    certification_number VARCHAR(100),
    emergency_contact JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_farms_location (location),
    INDEX idx_farms_owner (owner_name)
);

-- ============================================
-- 2. BURN REQUESTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS burn_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    farm_id INT NOT NULL,
    field_name VARCHAR(200) NOT NULL,
    field_boundary GEOMETRY NOT NULL SRID 4326,
    acres DECIMAL(10,2) NOT NULL,
    crop_type VARCHAR(100),
    burn_date DATE NOT NULL,
    time_window_start TIME,
    time_window_end TIME,
    estimated_duration INT, -- in hours
    priority_score INT DEFAULT 50,
    status ENUM('pending', 'approved', 'rejected', 'completed', 'cancelled') DEFAULT 'pending',
    rejection_reason TEXT,
    weather_conditions JSON,
    preferred_conditions JSON,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE,
    INDEX idx_burn_requests_farm_id (farm_id),
    INDEX idx_burn_requests_status (status),
    INDEX idx_burn_requests_burn_date (burn_date),
    INDEX idx_burn_requests_priority (priority_score DESC),
    SPATIAL INDEX idx_burn_requests_boundary (field_boundary)
);

-- ============================================
-- 3. WEATHER DATA TABLE WITH VECTOR
-- ============================================
CREATE TABLE IF NOT EXISTS weather_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    location_id INT,
    location POINT NOT NULL SRID 4326,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    temperature DECIMAL(5,2),
    humidity DECIMAL(5,2),
    wind_speed DECIMAL(5,2),
    wind_direction INT,
    pressure DECIMAL(6,2),
    visibility INT,
    cloud_cover INT,
    precipitation DECIMAL(5,2),
    air_quality_index INT,
    weather_vector VECTOR(128), -- 128-dimensional weather pattern vector
    raw_data JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_weather_timestamp (timestamp),
    INDEX idx_weather_location (location_id, timestamp DESC),
    VECTOR INDEX idx_weather_vector ((VEC_COSINE_DISTANCE(weather_vector)))
);

-- ============================================
-- 4. SMOKE PREDICTIONS TABLE WITH VECTOR
-- ============================================
CREATE TABLE IF NOT EXISTS smoke_predictions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    burn_request_id INT NOT NULL,
    prediction_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    max_dispersion_radius DECIMAL(10,2), -- in km
    affected_area GEOMETRY SRID 4326,
    pm25_concentrations JSON,
    plume_vector VECTOR(64), -- 64-dimensional smoke plume vector
    confidence_score DECIMAL(3,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (burn_request_id) REFERENCES burn_requests(id) ON DELETE CASCADE,
    INDEX idx_smoke_burn_request (burn_request_id),
    INDEX idx_smoke_timestamp (prediction_timestamp),
    VECTOR INDEX idx_plume_vector ((VEC_COSINE_DISTANCE(plume_vector))),
    SPATIAL INDEX idx_affected_area (affected_area)
);

-- ============================================
-- 5. BURN SCHEDULE TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS burn_schedule (
    id INT AUTO_INCREMENT PRIMARY KEY,
    burn_request_id INT NOT NULL,
    scheduled_date DATE NOT NULL,
    scheduled_start_time TIME,
    scheduled_end_time TIME,
    actual_start_time TIMESTAMP NULL,
    actual_end_time TIMESTAMP NULL,
    status ENUM('scheduled', 'in_progress', 'completed', 'cancelled') DEFAULT 'scheduled',
    optimization_score DECIMAL(5,2),
    conflicts_detected INT DEFAULT 0,
    weather_go BOOLEAN DEFAULT FALSE,
    operator_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (burn_request_id) REFERENCES burn_requests(id) ON DELETE CASCADE,
    INDEX idx_schedule_date (scheduled_date),
    INDEX idx_schedule_status (status),
    INDEX idx_schedule_date_status (scheduled_date, status)
);

-- ============================================
-- 6. ALERTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS alerts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    farm_id INT,
    burn_request_id INT,
    alert_type VARCHAR(50) NOT NULL,
    severity ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
    title VARCHAR(200) NOT NULL,
    message TEXT,
    status ENUM('pending', 'sent', 'acknowledged', 'resolved') DEFAULT 'pending',
    channels JSON, -- ['sms', 'email', 'socket']
    recipients JSON,
    delivery_status JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP NULL,
    acknowledged_at TIMESTAMP NULL,
    resolved_at TIMESTAMP NULL,
    FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE,
    FOREIGN KEY (burn_request_id) REFERENCES burn_requests(id) ON DELETE CASCADE,
    INDEX idx_alerts_farm_id (farm_id),
    INDEX idx_alerts_status (status),
    INDEX idx_alerts_farm_status (farm_id, status),
    INDEX idx_alerts_created (created_at DESC)
);

-- ============================================
-- 7. BURN HISTORY TABLE WITH VECTOR
-- ============================================
CREATE TABLE IF NOT EXISTS burn_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    burn_request_id INT NOT NULL,
    farm_id INT NOT NULL,
    burn_date DATE NOT NULL,
    actual_duration DECIMAL(5,2), -- in hours
    actual_acres_burned DECIMAL(10,2),
    weather_score INT,
    smoke_impact_score INT,
    had_conflicts BOOLEAN DEFAULT FALSE,
    started_on_time BOOLEAN DEFAULT TRUE,
    no_violations BOOLEAN DEFAULT TRUE,
    history_vector VECTOR(32), -- 32-dimensional burn history vector
    metrics JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (burn_request_id) REFERENCES burn_requests(id) ON DELETE CASCADE,
    FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE,
    INDEX idx_history_farm (farm_id),
    INDEX idx_history_date (burn_date),
    VECTOR INDEX idx_history_vector ((VEC_COSINE_DISTANCE(history_vector)))
);

-- ============================================
-- 8. ANALYTICS EVENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS analytics_events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    farm_id INT,
    burn_request_id INT,
    event_data JSON,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_analytics_timestamp (timestamp DESC),
    INDEX idx_analytics_event_type (event_type),
    INDEX idx_analytics_type_time (event_type, timestamp DESC)
);

-- ============================================
-- 9. OPTIMIZATION RESULTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS optimization_results (
    id INT AUTO_INCREMENT PRIMARY KEY,
    optimization_date DATE NOT NULL,
    algorithm VARCHAR(50) DEFAULT 'simulated_annealing',
    total_requests INT,
    scheduled_requests INT,
    unscheduled_requests INT,
    overall_score DECIMAL(5,2),
    conflict_score DECIMAL(5,2),
    weather_score DECIMAL(5,2),
    timing_score DECIMAL(5,2),
    computation_time_ms INT,
    schedule_data JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_optimization_date (optimization_date)
);

-- ============================================
-- 10. CONFLICT ANALYSIS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS conflict_analysis (
    id INT AUTO_INCREMENT PRIMARY KEY,
    burn_request_1_id INT NOT NULL,
    burn_request_2_id INT NOT NULL,
    conflict_type ENUM('proximity', 'smoke_overlap', 'time_overlap', 'wind_direction', 'weather_change') NOT NULL,
    severity ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
    distance_km DECIMAL(10,2),
    overlap_area GEOMETRY SRID 4326,
    resolution_status ENUM('unresolved', 'auto_resolved', 'manual_resolved', 'ignored') DEFAULT 'unresolved',
    resolution_method TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP NULL,
    FOREIGN KEY (burn_request_1_id) REFERENCES burn_requests(id) ON DELETE CASCADE,
    FOREIGN KEY (burn_request_2_id) REFERENCES burn_requests(id) ON DELETE CASCADE,
    INDEX idx_conflict_requests (burn_request_1_id, burn_request_2_id),
    INDEX idx_conflict_type (conflict_type),
    INDEX idx_conflict_status (resolution_status)
);

-- ============================================
-- 11. AGENT EXECUTION LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS agent_execution_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    agent_name VARCHAR(50) NOT NULL,
    burn_request_id INT,
    execution_time_ms INT,
    success BOOLEAN DEFAULT TRUE,
    input_data JSON,
    output_data JSON,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_agent_logs_agent (agent_name),
    INDEX idx_agent_logs_request (burn_request_id),
    INDEX idx_agent_logs_timestamp (created_at DESC)
);

-- ============================================
-- SEED DATA FOR DEMO
-- ============================================

-- Insert demo farms
INSERT INTO farms (name, owner_name, phone, email, address, location, farm_size_acres, primary_crops) VALUES
('Johnson Farm', 'Robert Johnson', '+1-555-0101', 'rjohnson@farm.com', '123 Farm Road, Kansas', ST_GeomFromText('POINT(-98.5 39.8)', 4326), 450.5, '["wheat", "corn"]'),
('Smith Ranch', 'Sarah Smith', '+1-555-0102', 'ssmith@ranch.com', '456 Ranch Way, Kansas', ST_GeomFromText('POINT(-98.6 39.7)', 4326), 780.2, '["wheat", "soybean"]'),
('Green Acres', 'Michael Green', '+1-555-0103', 'mgreen@acres.com', '789 Green Lane, Kansas', ST_GeomFromText('POINT(-98.4 39.9)', 4326), 320.8, '["corn", "soybean"]'),
('Valley Farm', 'Emily Valley', '+1-555-0104', 'evalley@farm.com', '321 Valley Road, Kansas', ST_GeomFromText('POINT(-98.7 39.6)', 4326), 560.3, '["wheat", "grass"]'),
('Hill Country', 'David Hill', '+1-555-0105', 'dhill@country.com', '654 Hill Drive, Kansas', ST_GeomFromText('POINT(-98.3 40.0)', 4326), 920.7, '["rice", "wheat"]')
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;

-- ============================================
-- GRANTS (if needed for application user)
-- ============================================
-- GRANT SELECT, INSERT, UPDATE, DELETE ON burnwise.* TO 'app_user'@'%';
-- GRANT EXECUTE ON burnwise.* TO 'app_user'@'%';

-- ============================================
-- VERIFY SCHEMA CREATION
-- ============================================
SHOW TABLES;
SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = DATABASE();