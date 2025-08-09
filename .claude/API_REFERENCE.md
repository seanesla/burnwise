# 📚 Burnwise API Reference

## Base URL
- Development: `http://localhost:5001/api`
- Production: `https://api.burnwise.com/api`

## Authentication
All protected endpoints require JWT token in Authorization header:
```
Authorization: Bearer <token>
```

---

## 🔥 Burn Requests

### Submit Burn Request
**POST** `/api/burn-requests`

**Request Body:**
```json
{
  "farm_id": 1,
  "requested_date": "2025-03-15",
  "acres_to_burn": 50,
  "crop_type": "wheat_stubble",
  "reason": "field_preparation",
  "location": {
    "lat": 45.123,
    "lng": -122.456
  }
}
```

**Response:** `201 Created`
```json
{
  "id": 123,
  "status": "pending",
  "priority_score": 85,
  "estimated_approval": "2025-03-14T10:00:00Z"
}
```

### Get All Burn Requests
**GET** `/api/burn-requests`

**Query Parameters:**
- `status`: Filter by status (pending|approved|completed|rejected)
- `farm_id`: Filter by farm
- `date_from`: Start date (YYYY-MM-DD)
- `date_to`: End date (YYYY-MM-DD)
- `limit`: Results per page (default: 20)
- `offset`: Pagination offset

**Response:** `200 OK`
```json
{
  "requests": [...],
  "total": 45,
  "limit": 20,
  "offset": 0
}
```

### Update Burn Request
**PUT** `/api/burn-requests/:id`

**Request Body:**
```json
{
  "status": "approved",
  "approved_date": "2025-03-15T08:00:00Z",
  "notes": "Approved for morning burn"
}
```

---

## 🌤️ Weather

### Get Current Weather
**GET** `/api/weather/current`

**Query Parameters:**
- `lat`: Latitude
- `lng`: Longitude

**Response:** `200 OK`
```json
{
  "temperature": 72,
  "humidity": 45,
  "wind_speed": 8,
  "wind_direction": 270,
  "conditions": "clear",
  "burn_safety_score": 92
}
```

### Generate Weather Vector
**POST** `/api/weather/vector`

**Request Body:**
```json
{
  "location": {
    "lat": 45.123,
    "lng": -122.456
  },
  "timestamp": "2025-03-15T10:00:00Z"
}
```

**Response:** `200 OK`
```json
{
  "vector": [0.23, -0.45, 0.67, ...], // 128 dimensions
  "conditions": {
    "suitable_for_burn": true,
    "risk_factors": []
  }
}
```

### Get Weather Forecast
**GET** `/api/weather/forecast`

**Query Parameters:**
- `lat`: Latitude
- `lng`: Longitude
- `days`: Number of days (1-7)

---

## 📅 Schedule

### Get Optimized Schedule
**GET** `/api/schedule`

**Query Parameters:**
- `date_from`: Start date
- `date_to`: End date
- `region`: Geographic region

**Response:** `200 OK`
```json
{
  "schedule": [
    {
      "date": "2025-03-15",
      "time_slot": "08:00-12:00",
      "burn_requests": [123, 124],
      "total_acres": 100,
      "conflict_score": 0.15
    }
  ],
  "optimization_metrics": {
    "total_conflicts_avoided": 3,
    "efficiency_score": 0.89
  }
}
```

### Trigger Schedule Optimization
**POST** `/api/schedule/optimize`

**Request Body:**
```json
{
  "date_range": {
    "from": "2025-03-15",
    "to": "2025-03-22"
  },
  "constraints": {
    "max_daily_acres": 500,
    "min_time_between_burns": 4
  }
}
```

---

## 🚨 Alerts

### Send Alert
**POST** `/api/alerts`

**Request Body:**
```json
{
  "recipient": "+1234567890",
  "message": "Burn approved for March 15",
  "type": "approval",
  "burn_request_id": 123
}
```

**Response:** `201 Created`
```json
{
  "id": "msg_xyz",
  "status": "queued",
  "delivery_estimate": "2025-03-14T09:00:00Z"
}
```

### Check Alert Status
**GET** `/api/alerts/:id/status`

**Response:** `200 OK`
```json
{
  "id": "msg_xyz",
  "status": "delivered",
  "delivered_at": "2025-03-14T09:00:15Z",
  "recipient_confirmed": true
}
```

---

## 🚜 Farms

### List All Farms
**GET** `/api/farms`

**Query Parameters:**
- `search`: Search by name or owner
- `region`: Filter by region
- `limit`: Results per page
- `offset`: Pagination offset

**Response:** `200 OK`
```json
{
  "farms": [
    {
      "id": 1,
      "name": "Johnson Farm",
      "owner_name": "Bob Johnson",
      "total_acres": 500,
      "location": {...},
      "boundaries": {...}
    }
  ],
  "total": 25
}
```

### Register New Farm
**POST** `/api/farms`

**Request Body:**
```json
{
  "name": "Smith Farm",
  "owner_name": "Alice Smith",
  "contact_email": "alice@smithfarm.com",
  "contact_phone": "+1234567890",
  "total_acres": 300,
  "location": {
    "lat": 45.123,
    "lng": -122.456
  },
  "boundaries": {
    "type": "Polygon",
    "coordinates": [...]
  }
}
```

---

## 📊 Analytics

### Get System Metrics
**GET** `/api/analytics/metrics`

**Query Parameters:**
- `period`: day|week|month|year
- `metric_type`: burns|acres|conflicts|weather

**Response:** `200 OK`
```json
{
  "period": "week",
  "metrics": {
    "total_burns": 45,
    "total_acres": 2300,
    "conflicts_avoided": 12,
    "average_approval_time": 4.5,
    "weather_accuracy": 0.92
  },
  "trends": {
    "burns_change": 0.15,
    "efficiency_change": 0.08
  }
}
```

### Get Burn History
**GET** `/api/analytics/history`

**Query Parameters:**
- `farm_id`: Filter by farm
- `date_from`: Start date
- `date_to`: End date

---

## 🔄 WebSocket Events

### Connection
```javascript
const socket = io('ws://localhost:5001');

socket.on('connect', () => {
  console.log('Connected to Burnwise');
});
```

### Event Types

#### Burn Request Events
```javascript
// New request submitted
socket.on('burn-request:created', (data) => {
  // { id, farm_id, status, ... }
});

// Request status updated
socket.on('burn-request:updated', (data) => {
  // { id, status, updated_at, ... }
});
```

#### Weather Events
```javascript
// Weather conditions changed
socket.on('weather:changed', (data) => {
  // { location, conditions, safety_score, ... }
});

// Weather alert
socket.on('weather:alert', (data) => {
  // { type, severity, message, ... }
});
```

#### Schedule Events
```javascript
// Schedule optimized
socket.on('schedule:optimized', (data) => {
  // { date_range, changes, ... }
});

// Conflict detected
socket.on('schedule:conflict', (data) => {
  // { burn_ids, overlap_area, ... }
});
```

---

## ⚠️ Error Responses

### Standard Error Format
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid burn request data",
    "details": [
      {
        "field": "acres_to_burn",
        "message": "Must be greater than 0"
      }
    ]
  }
}
```

### Common Error Codes
- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (resource already exists)
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error

### Rate Limiting Headers
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1234567890
```

---

## 🧪 Testing Endpoints

### Health Check
**GET** `/api/health`

**Response:** `200 OK`
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime": 3600,
  "database": "connected",
  "services": {
    "weather": "operational",
    "twilio": "operational"
  }
}
```

### Database Connection Test
**GET** `/api/test/db`

**Response:** `200 OK`
```json
{
  "connected": true,
  "latency": 12,
  "pool_size": 5
}
```