-- Add retry_count column to alerts table if it doesn't exist
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS retry_count INT DEFAULT 0;

-- Add index for finding retryable alerts efficiently
CREATE INDEX IF NOT EXISTS idx_alerts_retry ON alerts(status, delivery_status, retry_count);