-- CRITICAL DATABASE FIX MIGRATION
-- This fixes the missing columns and schema issues in the live database
-- Run this against your TiDB database to fix all schema issues

-- ============================================
-- 1. ADD MISSING VECTOR COLUMNS
-- ============================================

-- Check and add weather_vector column if missing
ALTER TABLE weather_data 
ADD COLUMN IF NOT EXISTS weather_vector VECTOR(128) COMMENT '128-dimensional weather pattern vector';

-- Add vector index for weather_vector
ALTER TABLE weather_data
ADD VECTOR INDEX IF NOT EXISTS idx_weather_vector ((VEC_COSINE_DISTANCE(weather_vector)));

-- Check and add plume_vector column to smoke_predictions
ALTER TABLE smoke_predictions
ADD COLUMN IF NOT EXISTS plume_vector VECTOR(64) COMMENT '64-dimensional smoke plume vector';

-- Add vector index for plume_vector  
ALTER TABLE smoke_predictions
ADD VECTOR INDEX IF NOT EXISTS idx_plume_vector ((VEC_COSINE_DISTANCE(plume_vector)));

-- Check and add history_vector column to burn_history
ALTER TABLE burn_history
ADD COLUMN IF NOT EXISTS history_vector VECTOR(32) COMMENT '32-dimensional burn history vector';

-- Add vector index for history_vector
ALTER TABLE burn_history  
ADD VECTOR INDEX IF NOT EXISTS idx_history_vector ((VEC_COSINE_DISTANCE(history_vector)));

-- ============================================
-- 2. ADD MISSING COLUMNS FOR ANALYTICS
-- ============================================

-- Add optimization_algorithm column to burn_schedule
ALTER TABLE burn_schedule
ADD COLUMN IF NOT EXISTS optimization_algorithm VARCHAR(50) DEFAULT 'simulated_annealing' COMMENT 'Algorithm used for scheduling';

-- Add scheduled_start_time as TIMESTAMP for analytics queries
ALTER TABLE burn_schedule
ADD COLUMN IF NOT EXISTS scheduled_start_timestamp TIMESTAMP NULL COMMENT 'Full timestamp for scheduled start';

-- ============================================
-- 3. CREATE MISSING BURN_FIELDS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS burn_fields (
    id INT AUTO_INCREMENT PRIMARY KEY,
    farm_id INT NOT NULL,
    field_name VARCHAR(200) NOT NULL,
    field_boundary GEOMETRY NOT NULL SRID 4326,
    acres DECIMAL(10,2) NOT NULL,
    soil_type VARCHAR(100),
    last_burn_date DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE,
    INDEX idx_fields_farm_id (farm_id),
    SPATIAL INDEX idx_fields_boundary (field_boundary)
);

-- ============================================
-- 4. ADD BURNS TABLE FOR VECTOR OPERATIONS
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
    FOREIGN KEY (burn_request_id) REFERENCES burn_requests(id) ON DELETE CASCADE,
    FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE,
    FOREIGN KEY (field_id) REFERENCES burn_fields(id) ON DELETE SET NULL,
    INDEX idx_burns_date (burn_date),
    INDEX idx_burns_status (status),
    VECTOR INDEX idx_burn_vector ((VEC_COSINE_DISTANCE(burn_vector)))
);

-- ============================================
-- 5. FIX BURN_REQUESTS TABLE
-- ============================================

-- Add field_id column to burn_requests
ALTER TABLE burn_requests
ADD COLUMN IF NOT EXISTS field_id INT DEFAULT NULL,
ADD CONSTRAINT fk_burn_requests_field_id 
    FOREIGN KEY (field_id) REFERENCES burn_fields(id) ON DELETE SET NULL;

-- ============================================
-- 6. ADD MISSING COLUMNS FOR AGENT WORKFLOW
-- ============================================

-- Add coordinator_score for agent validation
ALTER TABLE burn_requests
ADD COLUMN IF NOT EXISTS coordinator_score DECIMAL(5,2) DEFAULT NULL COMMENT 'Score from coordinator agent';

-- Add weather_score for weather agent
ALTER TABLE burn_requests  
ADD COLUMN IF NOT EXISTS weather_score DECIMAL(5,2) DEFAULT NULL COMMENT 'Score from weather agent';

-- Add predictor_score for predictor agent
ALTER TABLE burn_requests
ADD COLUMN IF NOT EXISTS predictor_score DECIMAL(5,2) DEFAULT NULL COMMENT 'Score from predictor agent';

-- Add optimizer_score for optimizer agent
ALTER TABLE burn_requests
ADD COLUMN IF NOT EXISTS optimizer_score DECIMAL(5,2) DEFAULT NULL COMMENT 'Score from optimizer agent';

-- Add alert_sent for alerts agent
ALTER TABLE burn_requests
ADD COLUMN IF NOT EXISTS alert_sent BOOLEAN DEFAULT FALSE COMMENT 'Whether alert was sent';

-- ============================================
-- 7. POPULATE BURN_FIELDS TABLE
-- ============================================

INSERT INTO burn_fields (farm_id, field_name, field_boundary, acres, soil_type) 
SELECT 
    id as farm_id,
    CONCAT('Field ', id, '-A') as field_name,
    ST_GeomFromText(CONCAT('POLYGON((', 
        ST_X(location), ' ', ST_Y(location), ', ',
        ST_X(location) + 0.01, ' ', ST_Y(location), ', ',
        ST_X(location) + 0.01, ' ', ST_Y(location) + 0.01, ', ',
        ST_X(location), ' ', ST_Y(location) + 0.01, ', ',
        ST_X(location), ' ', ST_Y(location), '))'), 4326) as field_boundary,
    ROUND(farm_size_acres * 0.25, 2) as acres,
    'loam' as soil_type
FROM farms
WHERE NOT EXISTS (SELECT 1 FROM burn_fields WHERE farm_id = farms.id);

-- ============================================
-- 8. FIX EXISTING BURN_REQUESTS
-- ============================================

-- Update burn_requests to link to burn_fields
UPDATE burn_requests br
JOIN burn_fields bf ON br.farm_id = bf.farm_id 
    AND br.field_name = bf.field_name
SET br.field_id = bf.id
WHERE br.field_id IS NULL;

-- ============================================
-- 9. VERIFY FIXES
-- ============================================

-- Check for vector columns
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
    AND COLUMN_NAME LIKE '%vector%';

-- Check all tables exist
SELECT TABLE_NAME 
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = DATABASE()
ORDER BY TABLE_NAME;

-- Check for missing columns that might still cause errors
SELECT 
    'weather_data' as table_name, 
    COUNT(*) as has_vector_column
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'weather_data'
    AND COLUMN_NAME = 'weather_vector'
UNION ALL
SELECT 
    'smoke_predictions', 
    COUNT(*)
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'smoke_predictions'
    AND COLUMN_NAME = 'plume_vector'
UNION ALL
SELECT 
    'burns', 
    COUNT(*)
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'burns'
    AND COLUMN_NAME = 'burn_vector';

-- Final confirmation message
SELECT 'Schema migration completed successfully!' as status;