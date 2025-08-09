# 🗄️ Burnwise Database Schema

## Database: TiDB (MySQL Compatible + Vector Search)

## Connection Configuration
```javascript
{
  host: process.env.TIDB_HOST,
  port: 4000,
  user: process.env.TIDB_USER,
  password: process.env.TIDB_PASSWORD,
  database: process.env.TIDB_DATABASE,
  ssl: { rejectUnauthorized: true },
  connectionLimit: 10,
  enableCircuitBreaker: true,
  breakerThreshold: 5
}
```

## 📊 Tables

### 1. `farms` - Farm Registration
```sql
CREATE TABLE farms (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  owner_name VARCHAR(255) NOT NULL,
  contact_email VARCHAR(255) NOT NULL,
  contact_phone VARCHAR(20),
  location POINT,
  boundaries JSON,
  total_acres DECIMAL(10, 2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_location (location),
  INDEX idx_owner (owner_name)
);
```

**Sample Data:**
```json
{
  "id": 1,
  "name": "Johnson Farm",
  "owner_name": "Bob Johnson",
  "contact_email": "bob@johnson-farm.com",
  "contact_phone": "+1234567890",
  "location": "POINT(45.123 -122.456)",
  "boundaries": {
    "type": "Polygon",
    "coordinates": [[[...]]]
  },
  "total_acres": 500.50
}
```

### 2. `burn_requests` - Burn Request Management
```sql
CREATE TABLE burn_requests (
  id INT PRIMARY KEY AUTO_INCREMENT,
  farm_id INT NOT NULL,
  requested_date DATE NOT NULL,
  requested_time_slot VARCHAR(20),
  acres_to_burn DECIMAL(10, 2) NOT NULL,
  crop_type VARCHAR(50),
  reason VARCHAR(255),
  status ENUM('pending', 'approved', 'rejected', 'completed', 'cancelled'),
  priority_score INT DEFAULT 0,
  weather_vector VECTOR(128),
  smoke_vector VECTOR(64),
  burn_vector VECTOR(32),
  approved_date DATETIME,
  approved_by INT,
  completed_date DATETIME,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (farm_id) REFERENCES farms(id),
  INDEX idx_status (status),
  INDEX idx_requested_date (requested_date),
  INDEX idx_priority (priority_score DESC),
  VECTOR INDEX idx_weather_vector ((VEC_COSINE_DISTANCE(weather_vector))),
  VECTOR INDEX idx_smoke_vector ((VEC_COSINE_DISTANCE(smoke_vector)))
);
```

**Status Values:**
- `pending` - Awaiting approval
- `approved` - Approved for burning
- `rejected` - Request denied
- `completed` - Burn completed
- `cancelled` - Cancelled by farmer

### 3. `weather_data` - Weather Information
```sql
CREATE TABLE weather_data (
  id INT PRIMARY KEY AUTO_INCREMENT,
  location POINT NOT NULL,
  timestamp DATETIME NOT NULL,
  temperature DECIMAL(5, 2),
  humidity DECIMAL(5, 2),
  wind_speed DECIMAL(5, 2),
  wind_direction INT,
  pressure DECIMAL(7, 2),
  visibility DECIMAL(5, 2),
  precipitation DECIMAL(5, 2),
  cloud_coverage INT,
  conditions VARCHAR(100),
  weather_vector VECTOR(128),
  burn_safety_score INT,
  raw_data JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_timestamp (timestamp),
  INDEX idx_location (location),
  VECTOR INDEX idx_weather_vector ((VEC_COSINE_DISTANCE(weather_vector)))
);
```

**Weather Vector (128 dimensions):**
```
[0-15]:   Temperature variations
[16-31]:  Humidity patterns
[32-47]:  Wind components
[48-63]:  Pressure trends
[64-79]:  Precipitation data
[80-95]:  Cloud coverage
[96-111]: Visibility metrics
[112-127]: Temporal features
```

### 4. `smoke_predictions` - Smoke Dispersion Predictions
```sql
CREATE TABLE smoke_predictions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  burn_request_id INT NOT NULL,
  prediction_time DATETIME NOT NULL,
  dispersion_pattern JSON,
  concentration_map JSON,
  affected_areas JSON,
  max_concentration DECIMAL(10, 4),
  plume_height DECIMAL(7, 2),
  plume_width DECIMAL(7, 2),
  travel_distance DECIMAL(7, 2),
  smoke_vector VECTOR(64),
  conflict_zones JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (burn_request_id) REFERENCES burn_requests(id),
  INDEX idx_prediction_time (prediction_time),
  VECTOR INDEX idx_smoke_vector ((VEC_COSINE_DISTANCE(smoke_vector)))
);
```

**Smoke Vector (64 dimensions):**
```
[0-15]:  Dispersion pattern
[16-31]: Concentration levels
[32-47]: Affected area bounds
[48-63]: Temporal evolution
```

### 5. `schedules` - Optimized Burn Schedules
```sql
CREATE TABLE schedules (
  id INT PRIMARY KEY AUTO_INCREMENT,
  schedule_date DATE NOT NULL,
  time_slot VARCHAR(20),
  burn_request_ids JSON,
  total_acres DECIMAL(10, 2),
  conflict_score DECIMAL(5, 2),
  optimization_metrics JSON,
  weather_conditions JSON,
  status ENUM('draft', 'active', 'completed', 'cancelled'),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_schedule_date (schedule_date),
  INDEX idx_status (status)
);
```

### 6. `alerts` - SMS Alert Management
```sql
CREATE TABLE alerts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  burn_request_id INT,
  recipient_phone VARCHAR(20) NOT NULL,
  message TEXT NOT NULL,
  type ENUM('approval', 'rejection', 'reminder', 'weather_update', 'conflict'),
  status ENUM('pending', 'sent', 'delivered', 'failed'),
  twilio_message_id VARCHAR(100),
  sent_at DATETIME,
  delivered_at DATETIME,
  retry_count INT DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (burn_request_id) REFERENCES burn_requests(id),
  INDEX idx_status (status),
  INDEX idx_recipient (recipient_phone)
);
```

### 7. `users` - User Authentication
```sql
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('farmer', 'coordinator', 'admin'),
  farm_id INT,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone VARCHAR(20),
  is_active BOOLEAN DEFAULT TRUE,
  last_login DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (farm_id) REFERENCES farms(id),
  INDEX idx_email (email),
  INDEX idx_username (username)
);
```

### 8. `optimization_runs` - Algorithm Execution History
```sql
CREATE TABLE optimization_runs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  run_date DATE NOT NULL,
  input_requests JSON,
  constraints JSON,
  initial_energy DECIMAL(10, 4),
  final_energy DECIMAL(10, 4),
  iterations INT,
  execution_time_ms INT,
  conflicts_resolved INT,
  output_schedule JSON,
  algorithm_params JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_run_date (run_date)
);
```

### 9. `weather_alerts` - Weather-based Notifications
```sql
CREATE TABLE weather_alerts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  alert_type VARCHAR(50),
  severity ENUM('info', 'warning', 'critical'),
  affected_area JSON,
  message TEXT,
  valid_from DATETIME,
  valid_until DATETIME,
  raw_data JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_severity (severity),
  INDEX idx_valid_dates (valid_from, valid_until)
);
```

### 10. `audit_logs` - System Activity Tracking
```sql
CREATE TABLE audit_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT,
  action VARCHAR(100),
  entity_type VARCHAR(50),
  entity_id INT,
  old_values JSON,
  new_values JSON,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_user (user_id),
  INDEX idx_action (action),
  INDEX idx_created (created_at)
);
```

## 🔍 Vector Search Queries

### Find Similar Weather Patterns
```sql
SELECT *, 
       VEC_COSINE_DISTANCE(weather_vector, ?) as similarity
FROM weather_data
WHERE timestamp > DATE_SUB(NOW(), INTERVAL 30 DAY)
ORDER BY similarity
LIMIT 10;
```

### Find Overlapping Smoke Plumes
```sql
SELECT sp1.*, sp2.*,
       VEC_COSINE_DISTANCE(sp1.smoke_vector, sp2.smoke_vector) as overlap
FROM smoke_predictions sp1
JOIN smoke_predictions sp2 ON sp1.id != sp2.id
WHERE sp1.prediction_time = sp2.prediction_time
  AND VEC_COSINE_DISTANCE(sp1.smoke_vector, sp2.smoke_vector) < 0.3
ORDER BY overlap;
```

### Match Historical Burns
```sql
SELECT br.*,
       VEC_COSINE_DISTANCE(br.burn_vector, ?) as similarity
FROM burn_requests br
WHERE br.status = 'completed'
  AND br.farm_id = ?
ORDER BY similarity
LIMIT 5;
```

## 📈 Indexes

### Performance Indexes
```sql
-- Frequently queried columns
CREATE INDEX idx_burn_requests_composite 
ON burn_requests(farm_id, status, requested_date);

CREATE INDEX idx_weather_composite 
ON weather_data(location, timestamp);

-- Vector search indexes (HNSW)
CREATE VECTOR INDEX idx_weather_search 
ON weather_data(weather_vector) 
USING HNSW;
```

## 🔄 Relationships

```
farms (1) ──────────> (N) burn_requests
  │                           │
  │                           ├──> (1) smoke_predictions
  │                           │
  │                           └──> (N) alerts
  │
  └──> (N) users

schedules (1) ──────> (N) burn_requests

optimization_runs ──> schedules

weather_data (standalone, linked by location/time)

weather_alerts (standalone, area-based)
```

## 💾 Data Types

### Vector Storage
- Stored as JSON arrays in MySQL
- Converted to VECTOR type in TiDB
- Indexed using HNSW algorithm
- Distance functions: `VEC_COSINE_DISTANCE`, `VEC_L2_DISTANCE`

### Spatial Data
- POINT type for single locations
- JSON for complex geometries (GeoJSON format)
- Spatial indexes for location queries

### JSON Fields
- Used for flexible schema (boundaries, metrics)
- Queryable with JSON functions
- Indexed with virtual columns when needed

## 🔧 Maintenance Queries

### Cleanup Old Data
```sql
-- Remove old weather data
DELETE FROM weather_data 
WHERE timestamp < DATE_SUB(NOW(), INTERVAL 90 DAY);

-- Archive completed burns
INSERT INTO burn_requests_archive 
SELECT * FROM burn_requests 
WHERE status = 'completed' 
  AND completed_date < DATE_SUB(NOW(), INTERVAL 1 YEAR);
```

### Performance Monitoring
```sql
-- Check table sizes
SELECT 
  table_name,
  table_rows,
  data_length / 1024 / 1024 as data_mb,
  index_length / 1024 / 1024 as index_mb
FROM information_schema.tables
WHERE table_schema = 'burnwise'
ORDER BY data_length DESC;

-- Check slow queries
SELECT * FROM mysql.slow_log
WHERE query_time > 1
ORDER BY query_time DESC
LIMIT 10;
```

## 🔐 Security Considerations

### Data Encryption
- Passwords: Bcrypt hashed (10 rounds)
- Sensitive data: Encrypted at rest
- SSL/TLS for connections

### Access Control
- Row-level security for multi-tenancy
- Role-based permissions
- Prepared statements only (no dynamic SQL)

### Audit Trail
- All modifications logged
- User actions tracked
- IP addresses recorded

## 📝 Migration Scripts

Location: `backend/migrations/`
- `001_initial_schema.sql`
- `002_add_vector_columns.sql`
- `003_create_indexes.sql`
- `004_add_audit_tables.sql`

Run migrations:
```bash
npm run db:migrate
```