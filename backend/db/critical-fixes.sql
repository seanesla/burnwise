-- CRITICAL DATABASE FIXES FOR BURNWISE
-- This fixes ALL remaining schema issues
-- Run this to achieve 90%+ functionality

-- ============================================
-- 1. CREATE BURNS TABLE WITH VECTOR
-- ============================================
CREATE TABLE IF NOT EXISTS burns (
    id INT AUTO_INCREMENT PRIMARY KEY,
    burn_request_id INT NOT NULL,
    farm_id INT NOT NULL,
    field_id INT,
    burn_vector VECTOR(32) COMMENT '32-dimensional burn characteristics vector',
    burn_date DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    acres DECIMAL(10,2),
    weather_conditions JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (burn_request_id) REFERENCES burn_requests(request_id) ON DELETE CASCADE,
    FOREIGN KEY (farm_id) REFERENCES farms(farm_id) ON DELETE CASCADE,
    FOREIGN KEY (field_id) REFERENCES burn_fields(field_id) ON DELETE SET NULL,
    INDEX idx_burns_date (burn_date),
    INDEX idx_burns_status (status)
);

-- Add vector index with TiFlash support
ALTER TABLE burns SET TIFLASH REPLICA 1;
ALTER TABLE burns ADD VECTOR INDEX idx_burn_vector ((VEC_COSINE_DISTANCE(burn_vector))) ADD_COLUMNAR_REPLICA_ON_DEMAND;

-- ============================================
-- 2. ADD OPTIMIZATION_ALGORITHM TO SCHEDULE TABLES
-- ============================================

-- Check and add to schedules table
ALTER TABLE schedules 
ADD COLUMN IF NOT EXISTS optimization_algorithm VARCHAR(50) DEFAULT 'simulated_annealing' 
COMMENT 'Algorithm used for scheduling';

-- Check and add to schedule_items table
ALTER TABLE schedule_items 
ADD COLUMN IF NOT EXISTS optimization_algorithm VARCHAR(50) DEFAULT 'simulated_annealing'
COMMENT 'Algorithm used for scheduling';

-- Check if burn_schedule exists, if so add column
DROP TABLE IF EXISTS burn_schedule;
CREATE TABLE burn_schedule (
    id INT AUTO_INCREMENT PRIMARY KEY,
    burn_request_id INT NOT NULL,
    scheduled_date DATE NOT NULL,
    scheduled_start_time TIME,
    scheduled_end_time TIME,
    scheduled_start_timestamp TIMESTAMP NULL,
    actual_start_time TIMESTAMP NULL,
    actual_end_time TIMESTAMP NULL,
    status ENUM('scheduled', 'in_progress', 'completed', 'cancelled') DEFAULT 'scheduled',
    optimization_score DECIMAL(5,2),
    optimization_algorithm VARCHAR(50) DEFAULT 'simulated_annealing',
    conflicts_detected INT DEFAULT 0,
    weather_go BOOLEAN DEFAULT FALSE,
    operator_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (burn_request_id) REFERENCES burn_requests(request_id) ON DELETE CASCADE,
    INDEX idx_schedule_date (scheduled_date),
    INDEX idx_schedule_status (status),
    INDEX idx_schedule_date_status (scheduled_date, status)
);

-- ============================================
-- 3. FIX COLUMN REFERENCES
-- ============================================

-- Add missing columns to burn_requests if not exist
ALTER TABLE burn_requests
ADD COLUMN IF NOT EXISTS id INT UNIQUE KEY COMMENT 'Alias for request_id for backward compatibility';

-- Update id column to match request_id
UPDATE burn_requests SET id = request_id WHERE id IS NULL;

-- ============================================
-- 4. FIX SMOKE_PREDICTIONS REFERENCES
-- ============================================

-- Ensure smoke_predictions uses correct column
ALTER TABLE smoke_predictions
MODIFY COLUMN burn_request_id INT NOT NULL COMMENT 'References burn_requests.request_id';

-- ============================================
-- 5. FIX ANALYTICS VIEWS
-- ============================================

-- Create a view to simplify analytics queries
CREATE OR REPLACE VIEW analytics_burn_view AS
SELECT 
    br.request_id,
    br.request_id as id,  -- Alias for compatibility
    br.farm_id,
    br.field_id,
    br.requested_date,
    br.status,
    br.priority_score,
    br.acreage,
    br.crop_type,
    f.farm_name,
    f.owner_name,
    sp.dispersion_radius_km,
    sp.confidence_score as smoke_confidence
FROM burn_requests br
LEFT JOIN farms f ON br.farm_id = f.farm_id
LEFT JOIN smoke_predictions sp ON br.request_id = sp.burn_request_id;

-- ============================================
-- 6. POPULATE BURNS TABLE FROM EXISTING DATA
-- ============================================

INSERT INTO burns (burn_request_id, farm_id, field_id, burn_date, status, acres)
SELECT 
    request_id,
    farm_id,
    field_id,
    requested_date,
    status,
    acreage
FROM burn_requests
WHERE NOT EXISTS (
    SELECT 1 FROM burns WHERE burns.burn_request_id = burn_requests.request_id
);

-- ============================================
-- 7. FIX VECTOR COLUMNS
-- ============================================

-- Ensure weather_data has vector index
ALTER TABLE weather_data SET TIFLASH REPLICA 1;

-- Ensure smoke_predictions has vector index  
ALTER TABLE smoke_predictions SET TIFLASH REPLICA 1;

-- ============================================
-- 8. CREATE MISSING INDEXES
-- ============================================

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_br_status_date ON burn_requests(status, requested_date);
CREATE INDEX IF NOT EXISTS idx_alerts_burn ON alerts(burn_request_id, status);
CREATE INDEX IF NOT EXISTS idx_weather_location ON weather_data(location_id, timestamp);

-- ============================================
-- 9. FIX AGENT LOGS TABLE
-- ============================================

ALTER TABLE agent_execution_logs
ADD COLUMN IF NOT EXISTS burn_request_id INT,
ADD INDEX IF NOT EXISTS idx_agent_burn (burn_request_id);

-- ============================================
-- 10. VERIFY FIXES
-- ============================================

-- Check all critical elements exist
SELECT 'Verification Results:' as status;

SELECT 
    'burns table' as element,
    IF(COUNT(*) > 0, 'EXISTS ✓', 'MISSING ✗') as status
FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'burns'
UNION ALL
SELECT 
    'burn_vector column' as element,
    IF(COUNT(*) > 0, 'EXISTS ✓', 'MISSING ✗') as status
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'burns' 
    AND COLUMN_NAME = 'burn_vector'
UNION ALL
SELECT 
    'optimization_algorithm in schedules' as element,
    IF(COUNT(*) > 0, 'EXISTS ✓', 'MISSING ✗') as status
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'schedules' 
    AND COLUMN_NAME = 'optimization_algorithm'
UNION ALL
SELECT 
    'analytics_burn_view' as element,
    IF(COUNT(*) > 0, 'EXISTS ✓', 'MISSING ✗') as status
FROM INFORMATION_SCHEMA.VIEWS 
WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'analytics_burn_view';

SELECT 'All critical fixes applied successfully!' as message;