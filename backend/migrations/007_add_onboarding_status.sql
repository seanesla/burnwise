-- Migration: Add onboarding completion tracking
-- Date: 2025-08-21
-- Description: Track whether farms have completed onboarding setup

-- Add onboarding_completed flag to farms table
ALTER TABLE farms 
ADD COLUMN onboarding_completed BOOLEAN DEFAULT FALSE COMMENT 'Whether farm has completed initial setup';

-- Set existing farms with boundary data as onboarding completed
UPDATE farms 
SET onboarding_completed = TRUE 
WHERE boundary IS NOT NULL 
   OR (location IS NOT NULL AND farm_size_acres IS NOT NULL);

-- Add index for quick filtering
ALTER TABLE farms 
ADD INDEX idx_farms_onboarding (onboarding_completed);

-- For demo farms, auto-mark as completed
UPDATE farms 
SET onboarding_completed = TRUE 
WHERE is_demo = TRUE;