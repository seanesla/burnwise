-- BURNWISE Performance Optimizations
-- Created: 2025-08-07
-- Purpose: Optimize database performance with indexes and query improvements

-- ============================================
-- 1. INDEXES FOR COMMON QUERY PATTERNS
-- ============================================

-- Burn Requests Table Indexes
-- Index for farm_id lookups (very common)
CREATE INDEX IF NOT EXISTS idx_burn_requests_farm_id 
ON burn_requests(farm_id);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_burn_requests_status 
ON burn_requests(status);

-- Index for date range queries
CREATE INDEX IF NOT EXISTS idx_burn_requests_burn_date 
ON burn_requests(burn_date);

-- Composite index for common filter combinations
CREATE INDEX IF NOT EXISTS idx_burn_requests_farm_status_date 
ON burn_requests(farm_id, status, burn_date);

-- Index for priority score sorting
CREATE INDEX IF NOT EXISTS idx_burn_requests_priority 
ON burn_requests(priority_score DESC);

-- ============================================
-- 2. WEATHER DATA INDEXES
-- ============================================

-- Index for timestamp-based queries
CREATE INDEX IF NOT EXISTS idx_weather_data_timestamp 
ON weather_data(timestamp);

-- Composite index for location and time queries
CREATE INDEX IF NOT EXISTS idx_weather_data_location_time 
ON weather_data(location_id, timestamp DESC);

-- Index for weather vector searches (if not already existing)
-- Note: TiDB automatically creates vector indexes for VECTOR columns

-- ============================================
-- 3. SMOKE PREDICTIONS INDEXES
-- ============================================

-- Index for burn request lookups
CREATE INDEX IF NOT EXISTS idx_smoke_predictions_burn_request 
ON smoke_predictions(burn_request_id);

-- Index for prediction time queries
CREATE INDEX IF NOT EXISTS idx_smoke_predictions_time 
ON smoke_predictions(prediction_time);

-- ============================================
-- 4. ALERTS INDEXES
-- ============================================

-- Index for farm-specific alerts
CREATE INDEX IF NOT EXISTS idx_alerts_farm_id 
ON alerts(farm_id);

-- Index for alert status
CREATE INDEX IF NOT EXISTS idx_alerts_status 
ON alerts(status);

-- Composite index for farm and status
CREATE INDEX IF NOT EXISTS idx_alerts_farm_status 
ON alerts(farm_id, status);

-- Index for created_at sorting
CREATE INDEX IF NOT EXISTS idx_alerts_created 
ON alerts(created_at DESC);

-- ============================================
-- 5. SCHEDULE INDEXES
-- ============================================

-- Index for date-based schedule queries
CREATE INDEX IF NOT EXISTS idx_schedule_date 
ON burn_schedule(scheduled_date);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_schedule_status 
ON burn_schedule(status);

-- Composite index for date range and status
CREATE INDEX IF NOT EXISTS idx_schedule_date_status 
ON burn_schedule(scheduled_date, status);

-- ============================================
-- 6. ANALYTICS INDEXES
-- ============================================

-- Index for analytics time series queries
CREATE INDEX IF NOT EXISTS idx_analytics_timestamp 
ON analytics_events(timestamp DESC);

-- Index for event type filtering
CREATE INDEX IF NOT EXISTS idx_analytics_event_type 
ON analytics_events(event_type);

-- Composite index for common analytics queries
CREATE INDEX IF NOT EXISTS idx_analytics_type_time 
ON analytics_events(event_type, timestamp DESC);

-- ============================================
-- 7. SPATIAL INDEXES (if supported)
-- ============================================

-- Spatial index for field boundaries
-- Note: TiDB may handle this differently than MySQL
-- CREATE SPATIAL INDEX IF NOT EXISTS idx_burn_requests_boundary 
-- ON burn_requests(field_boundary);

-- ============================================
-- 8. QUERY STATISTICS UPDATE
-- ============================================

-- Update table statistics for query optimizer
ANALYZE TABLE burn_requests;
ANALYZE TABLE weather_data;
ANALYZE TABLE smoke_predictions;
ANALYZE TABLE alerts;
ANALYZE TABLE burn_schedule;
ANALYZE TABLE farms;
ANALYZE TABLE analytics_events;

-- ============================================
-- 9. OPTIMIZED VIEW CREATION
-- ============================================

-- Create materialized view for common burn request queries
CREATE OR REPLACE VIEW v_burn_requests_summary AS
SELECT 
    br.id,
    br.farm_id,
    f.name as farm_name,
    f.owner_name,
    br.field_name,
    br.acres,
    br.crop_type,
    br.burn_date,
    br.time_window_start,
    br.time_window_end,
    br.priority_score,
    br.status,
    br.created_at,
    br.updated_at,
    sp.max_dispersion_radius,
    sp.confidence_score as prediction_confidence
FROM burn_requests br
JOIN farms f ON br.farm_id = f.id
LEFT JOIN smoke_predictions sp ON br.id = sp.burn_request_id;

-- View for dashboard metrics
CREATE OR REPLACE VIEW v_dashboard_metrics AS
SELECT 
    COUNT(DISTINCT br.id) as total_requests,
    COUNT(DISTINCT CASE WHEN br.status = 'approved' THEN br.id END) as approved_requests,
    COUNT(DISTINCT CASE WHEN br.status = 'pending' THEN br.id END) as pending_requests,
    COUNT(DISTINCT CASE WHEN br.status = 'rejected' THEN br.id END) as rejected_requests,
    AVG(br.acres) as avg_burn_acres,
    COUNT(DISTINCT br.farm_id) as active_farms
FROM burn_requests br
WHERE br.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY);

-- ============================================
-- 10. CONNECTION POOL OPTIMIZATION SETTINGS
-- ============================================

-- These should be set at the connection level in the application
-- But documenting recommended settings here:
-- - max_connections: 100
-- - wait_timeout: 28800
-- - interactive_timeout: 28800
-- - query_cache_size: 64M (if available)
-- - query_cache_type: 1 (if available)

-- ============================================
-- VALIDATION QUERIES
-- ============================================

-- Check index usage
SHOW INDEXES FROM burn_requests;
SHOW INDEXES FROM weather_data;
SHOW INDEXES FROM smoke_predictions;
SHOW INDEXES FROM alerts;
SHOW INDEXES FROM burn_schedule;

-- Check table sizes
SELECT 
    table_name,
    table_rows,
    data_length/1024/1024 as data_size_mb,
    index_length/1024/1024 as index_size_mb
FROM information_schema.tables
WHERE table_schema = DATABASE()
ORDER BY data_length DESC;