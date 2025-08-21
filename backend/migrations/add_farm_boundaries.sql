-- Migration: Add spatial support for farm boundaries
-- Date: 2025-08-21
-- Description: Store precise farm boundaries as GeoJSON for smoke modeling

-- Add boundary column to farms table
ALTER TABLE farms 
ADD COLUMN boundary JSON DEFAULT NULL COMMENT 'GeoJSON farm boundary',
ADD COLUMN calculated_acreage DECIMAL(10,2) DEFAULT NULL COMMENT 'Acreage calculated from boundary',
ADD COLUMN boundary_created_at TIMESTAMP DEFAULT NULL COMMENT 'When boundary was drawn',
ADD COLUMN boundary_updated_at TIMESTAMP DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP;

-- Add indexes for spatial queries (TiDB doesn't have native spatial indexes yet)
ALTER TABLE farms 
ADD INDEX idx_farms_has_boundary ((boundary IS NOT NULL));

-- Create burn_zones table for designated burn areas within farms
CREATE TABLE IF NOT EXISTS burn_zones (
  zone_id INT AUTO_INCREMENT PRIMARY KEY,
  farm_id INT NOT NULL,
  zone_name VARCHAR(100),
  zone_boundary JSON NOT NULL COMMENT 'GeoJSON polygon for burn zone',
  zone_type ENUM('primary', 'secondary', 'buffer', 'no_burn') DEFAULT 'primary',
  acreage DECIMAL(10,2),
  crops VARCHAR(500),
  last_burn_date DATE,
  next_planned_burn DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (farm_id) REFERENCES farms(farm_id) ON DELETE CASCADE,
  INDEX idx_burn_zones_farm (farm_id),
  INDEX idx_burn_zones_type (zone_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create farm_parcels table for non-contiguous land
CREATE TABLE IF NOT EXISTS farm_parcels (
  parcel_id INT AUTO_INCREMENT PRIMARY KEY,
  farm_id INT NOT NULL,
  parcel_name VARCHAR(100),
  parcel_boundary JSON NOT NULL COMMENT 'GeoJSON polygon for parcel',
  acreage DECIMAL(10,2),
  address VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (farm_id) REFERENCES farms(farm_id) ON DELETE CASCADE,
  INDEX idx_parcels_farm (farm_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Update farms with sample boundary for testing (optional)
-- UPDATE farms 
-- SET boundary = '{"type":"Polygon","coordinates":[[[-121.74,38.54],[-121.73,38.54],[-121.73,38.55],[-121.74,38.55],[-121.74,38.54]]]}'
-- WHERE farm_id = 1 
-- LIMIT 1;