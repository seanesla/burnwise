-- Migration: Create weather_analyses table for audit trail and embeddings
-- Date: 2025-08-17
-- Purpose: Store all weather safety decisions with vector embeddings for pattern matching

CREATE TABLE IF NOT EXISTS weather_analyses (
  id INT PRIMARY KEY AUTO_INCREMENT,
  burn_request_id INT,
  burn_date DATE NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  
  -- Weather conditions at time of analysis
  wind_speed DECIMAL(5, 2),
  wind_direction INT,
  humidity DECIMAL(5, 2),
  temperature DECIMAL(5, 2),
  visibility DECIMAL(5, 2),
  pressure DECIMAL(7, 2),
  cloud_coverage INT,
  conditions VARCHAR(100),
  
  -- Safety decision
  decision ENUM('SAFE', 'MARGINAL', 'UNSAFE') NOT NULL,
  requires_approval BOOLEAN DEFAULT FALSE,
  confidence DECIMAL(3, 2), -- 0.00 to 1.00
  
  -- Analysis details
  reasons JSON, -- Array of reason strings
  risk_factors JSON, -- Detailed risk assessment
  forecast_data JSON, -- 48-hour forecast snapshot
  
  -- Vector embeddings for pattern matching
  weather_embedding VECTOR(128), -- Full weather pattern embedding
  decision_embedding VECTOR(32), -- Compact decision context embedding
  
  -- Approval tracking
  approved_by INT,
  approved_at DATETIME,
  approval_notes TEXT,
  
  -- Metadata
  analyzed_by VARCHAR(50) DEFAULT 'WeatherAnalyst',
  analysis_duration_ms INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Foreign keys
  FOREIGN KEY (burn_request_id) REFERENCES burn_requests(id) ON DELETE SET NULL,
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
  
  -- Indexes for performance
  INDEX idx_burn_date (burn_date),
  INDEX idx_decision (decision),
  INDEX idx_requires_approval (requires_approval),
  INDEX idx_location (latitude, longitude),
  INDEX idx_created (created_at),
  
  -- Vector indexes for similarity search
  VECTOR INDEX idx_weather_embedding ((VEC_COSINE_DISTANCE(weather_embedding))),
  VECTOR INDEX idx_decision_embedding ((VEC_COSINE_DISTANCE(decision_embedding)))
);

-- Add trigger to automatically set requires_approval based on decision
DELIMITER $$
CREATE TRIGGER set_requires_approval
BEFORE INSERT ON weather_analyses
FOR EACH ROW
BEGIN
  IF NEW.decision = 'MARGINAL' THEN
    SET NEW.requires_approval = TRUE;
  ELSEIF NEW.decision = 'UNSAFE' THEN
    SET NEW.requires_approval = FALSE;
  ELSE
    SET NEW.requires_approval = FALSE;
  END IF;
END$$
DELIMITER ;

-- Add comments for documentation
ALTER TABLE weather_analyses COMMENT = 'Stores weather safety analysis decisions with embeddings for pattern matching and audit trail';

-- Sample query for finding similar weather patterns
-- SELECT wa1.*, 
--        VEC_COSINE_DISTANCE(wa1.weather_embedding, wa2.weather_embedding) as similarity
-- FROM weather_analyses wa1
-- JOIN weather_analyses wa2 ON wa1.id != wa2.id
-- WHERE wa2.decision = 'SAFE'
--   AND VEC_COSINE_DISTANCE(wa1.weather_embedding, wa2.weather_embedding) < 0.2
-- ORDER BY similarity ASC
-- LIMIT 10;