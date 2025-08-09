-- Database Index Optimization for BURNWISE
-- Improves query performance based on common access patterns

-- =====================================================
-- BURN_REQUESTS TABLE INDEXES
-- =====================================================

-- Index for farm-based queries (very common)
CREATE INDEX IF NOT EXISTS idx_burn_requests_farm_id 
ON burn_requests(farm_id);

-- Index for date-based queries (schedule optimization)
CREATE INDEX IF NOT EXISTS idx_burn_requests_requested_date 
ON burn_requests(requested_date);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_burn_requests_status 
ON burn_requests(status);

-- Composite index for common farm + status queries
CREATE INDEX IF NOT EXISTS idx_burn_requests_farm_status 
ON burn_requests(farm_id, status);

-- Composite index for date range + status queries
CREATE INDEX IF NOT EXISTS idx_burn_requests_date_status 
ON burn_requests(requested_date, status);

-- =====================================================
-- ALERTS TABLE INDEXES
-- =====================================================

-- Index for burn request association
CREATE INDEX IF NOT EXISTS idx_alerts_burn_request_id 
ON alerts(burn_request_id);

-- Index for farm-based alert queries
CREATE INDEX IF NOT EXISTS idx_alerts_farm_id 
ON alerts(farm_id);

-- Index for status-based queries (pending alerts)
CREATE INDEX IF NOT EXISTS idx_alerts_status 
ON alerts(status);

-- Index for delivery status tracking
CREATE INDEX IF NOT EXISTS idx_alerts_delivery_status 
ON alerts(delivery_status);

-- Composite index for retry processing
CREATE INDEX IF NOT EXISTS idx_alerts_status_created 
ON alerts(status, created_at);

-- =====================================================
-- SMOKE_PREDICTIONS TABLE INDEXES
-- =====================================================

-- Index for burn request lookups
CREATE INDEX IF NOT EXISTS idx_smoke_predictions_burn_request_id 
ON smoke_predictions(burn_request_id);

-- Index for time-based queries
CREATE INDEX IF NOT EXISTS idx_smoke_predictions_created_at 
ON smoke_predictions(created_at DESC);

-- =====================================================
-- SCHEDULE_ITEMS TABLE INDEXES
-- =====================================================

-- Index for burn request associations
CREATE INDEX IF NOT EXISTS idx_schedule_items_burn_request_id 
ON schedule_items(burn_request_id);

-- Index for schedule associations
CREATE INDEX IF NOT EXISTS idx_schedule_items_schedule_id 
ON schedule_items(schedule_id);

-- Composite index for schedule + status queries
CREATE INDEX IF NOT EXISTS idx_schedule_items_schedule_status 
ON schedule_items(schedule_id, status);

-- =====================================================
-- SCHEDULES TABLE INDEXES
-- =====================================================

-- Index for date-based schedule queries
CREATE INDEX IF NOT EXISTS idx_schedules_schedule_date 
ON schedules(schedule_date);

-- Index for optimization score sorting
CREATE INDEX IF NOT EXISTS idx_schedules_optimization_score 
ON schedules(optimization_score DESC);

-- =====================================================
-- WEATHER_DATA TABLE INDEXES
-- =====================================================

-- Index for timestamp queries
CREATE INDEX IF NOT EXISTS idx_weather_data_timestamp 
ON weather_data(timestamp);

-- Index for location-based queries
CREATE INDEX IF NOT EXISTS idx_weather_data_location 
ON weather_data(latitude, longitude);

-- Composite index for time + location queries
CREATE INDEX IF NOT EXISTS idx_weather_data_time_location 
ON weather_data(timestamp, latitude, longitude);

-- =====================================================
-- FARMS TABLE INDEXES
-- =====================================================

-- Index for owner name searches
CREATE INDEX IF NOT EXISTS idx_farms_owner_name 
ON farms(owner_name);

-- Index for farm name searches
CREATE INDEX IF NOT EXISTS idx_farms_farm_name 
ON farms(farm_name);

-- =====================================================
-- AGENT_EXECUTION_LOGS TABLE INDEXES
-- =====================================================

-- Index for agent-based queries
CREATE INDEX IF NOT EXISTS idx_agent_logs_agent_name 
ON agent_execution_logs(agent_name);

-- Index for time-based log queries
CREATE INDEX IF NOT EXISTS idx_agent_logs_timestamp 
ON agent_execution_logs(timestamp DESC);

-- Composite index for agent + time queries
CREATE INDEX IF NOT EXISTS idx_agent_logs_agent_time 
ON agent_execution_logs(agent_name, timestamp DESC);

-- =====================================================
-- QUERY OPTIMIZATION ANALYSIS
-- =====================================================

-- Analyze table statistics for query optimizer
ANALYZE TABLE burn_requests;
ANALYZE TABLE alerts;
ANALYZE TABLE smoke_predictions;
ANALYZE TABLE schedule_items;
ANALYZE TABLE schedules;
ANALYZE TABLE weather_data;
ANALYZE TABLE farms;
ANALYZE TABLE agent_execution_logs;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check index usage for burn requests
SELECT 
    'burn_requests' as table_name,
    COUNT(*) as row_count,
    (SELECT COUNT(*) FROM information_schema.statistics 
     WHERE table_schema = DATABASE() 
     AND table_name = 'burn_requests') as index_count;

-- Check index usage for alerts
SELECT 
    'alerts' as table_name,
    COUNT(*) as row_count,
    (SELECT COUNT(*) FROM information_schema.statistics 
     WHERE table_schema = DATABASE() 
     AND table_name = 'alerts') as index_count;

-- Display all indexes created
SELECT 
    table_name,
    index_name,
    column_name,
    cardinality
FROM information_schema.statistics
WHERE table_schema = DATABASE()
AND table_name IN ('burn_requests', 'alerts', 'smoke_predictions', 
                   'schedule_items', 'schedules', 'weather_data', 
                   'farms', 'agent_execution_logs')
ORDER BY table_name, index_name;