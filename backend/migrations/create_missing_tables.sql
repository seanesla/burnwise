-- CRITICAL FIX: Create missing tables referenced in schedule.js
-- These tables are referenced throughout the API but don't exist!

-- Create schedules table
CREATE TABLE IF NOT EXISTS schedules (
  id INT PRIMARY KEY AUTO_INCREMENT,
  schedule_date DATE NOT NULL,
  date DATE NOT NULL, -- alias for schedule_date
  status VARCHAR(20) DEFAULT 'active',
  total_burns INT DEFAULT 0,
  total_acres DECIMAL(10, 2) DEFAULT 0,
  conflict_score DECIMAL(5, 2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_schedule_date (schedule_date),
  INDEX idx_status (status)
);

-- Create schedule_items table
CREATE TABLE IF NOT EXISTS schedule_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  schedule_id INT NOT NULL,
  burn_request_id INT NOT NULL,
  time_slot VARCHAR(20),
  scheduled_start DATETIME,
  scheduled_end DATETIME,
  status VARCHAR(20) DEFAULT 'scheduled',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE,
  FOREIGN KEY (burn_request_id) REFERENCES burn_requests(request_id),
  INDEX idx_schedule_id (schedule_id),
  INDEX idx_burn_request_id (burn_request_id),
  INDEX idx_time_slot (time_slot)
);

-- Populate schedules with existing burn requests
INSERT INTO schedules (schedule_date, date, status, total_burns, total_acres)
SELECT 
  DATE(requested_date) as schedule_date,
  DATE(requested_date) as date,
  'active' as status,
  COUNT(*) as total_burns,
  SUM(acres_to_burn) as total_acres
FROM burn_requests
WHERE status IN ('pending', 'approved', 'scheduled')
GROUP BY DATE(requested_date);

-- Populate schedule_items from burn_requests
INSERT INTO schedule_items (schedule_id, burn_request_id, time_slot, scheduled_start, scheduled_end)
SELECT 
  s.id as schedule_id,
  br.request_id as burn_request_id,
  COALESCE(br.requested_time_slot, 'morning') as time_slot,
  br.requested_date as scheduled_start,
  DATE_ADD(br.requested_date, INTERVAL 2 HOUR) as scheduled_end
FROM burn_requests br
JOIN schedules s ON DATE(br.requested_date) = s.schedule_date
WHERE br.status IN ('pending', 'approved', 'scheduled');