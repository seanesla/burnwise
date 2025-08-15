/**
 * Mock Backend Server for Testing
 * Provides basic API endpoints without database
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = 5001;

// Middleware with proper CORS
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']
}));
app.use(bodyParser.json());

// Mock data
const mockUser = {
  id: 1,
  email: 'test@burnwise.com',
  farmName: 'Test Farm',
  token: 'mock-jwt-token'
};

const mockBurnRequests = [
  {
    id: 1,
    farmId: 1,
    farmName: 'Green Acres',
    requestedDate: '2025-08-20',
    acres: 100,
    status: 'approved',
    cropType: 'wheat'
  },
  {
    id: 2,
    farmId: 2,
    farmName: 'Prairie Wind',
    requestedDate: '2025-08-20',
    acres: 150,
    status: 'pending',
    cropType: 'corn'
  }
];

// Auth endpoints
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (email && password) {
    res.json({
      success: true,
      user: mockUser,
      token: mockUser.token
    });
  } else {
    res.status(400).json({ success: false, error: 'Invalid credentials' });
  }
});

app.get('/api/auth/verify-session', (req, res) => {
  res.json({ success: true, user: mockUser });
});

app.get('/api/auth/verify', (req, res) => {
  res.json({ success: true, user: mockUser });
});

app.get('/api/auth/csrf-token', (req, res) => {
  res.json({ csrfToken: 'mock-csrf-token' });
});

app.get('/api/auth/demo-status', (req, res) => {
  res.json({ isDemo: true });
});

// Burn requests endpoints
app.get('/api/burn-requests', (req, res) => {
  res.json({
    success: true,
    data: mockBurnRequests
  });
});

app.post('/api/burn-requests', (req, res) => {
  const newRequest = {
    id: mockBurnRequests.length + 1,
    ...req.body,
    status: 'pending',
    createdAt: new Date()
  };
  mockBurnRequests.push(newRequest);
  
  res.json({
    success: true,
    message: '5-agent workflow completed',
    burnRequestId: newRequest.id,
    workflowResults: {
      coordinator: { success: true, priority: 85 },
      weather: { success: true, score: 92 },
      predictor: { success: true, conflicts: [] },
      optimizer: { success: true, scheduled: true },
      alerts: { success: true, sent: 3 }
    }
  });
});

app.post('/api/burn-requests/detect-conflicts', (req, res) => {
  res.json({
    success: true,
    conflicts: [
      {
        burn1_id: 1,
        burn2_id: 2,
        severity: 'medium',
        overlap_area: 250,
        max_pm25: 28
      }
    ]
  });
});

// Weather endpoints
app.get('/api/weather/current/:lat/:lon', (req, res) => {
  res.json({
    success: true,
    data: {
      temperature: 72,
      humidity: 45,
      windSpeed: 8,
      windDirection: 'NW',
      conditions: 'Clear'
    }
  });
});

// Schedule endpoints
app.get('/api/schedule', (req, res) => {
  res.json({
    success: true,
    schedule: {
      date: '2025-08-20',
      items: mockBurnRequests
    }
  });
});

app.post('/api/schedule/optimize', (req, res) => {
  res.json({
    success: true,
    optimized: true,
    conflictsResolved: 2,
    score: 94.5
  });
});

// Alerts endpoints
app.get('/api/alerts', (req, res) => {
  res.json({
    success: true,
    alerts: [
      {
        id: 1,
        type: 'schedule_change',
        message: 'Your burn has been rescheduled',
        createdAt: new Date()
      }
    ]
  });
});

app.post('/api/alerts/send', (req, res) => {
  res.json({
    success: true,
    alertId: Math.floor(Math.random() * 1000),
    deliveryStatus: 'sent'
  });
});

// Farms endpoints
app.get('/api/farms', (req, res) => {
  res.json({
    success: true,
    farms: [
      { id: 1, name: 'Green Acres', lat: 38.5, lon: -121.7 },
      { id: 2, name: 'Prairie Wind', lat: 38.6, lon: -121.2 }
    ]
  });
});

// Analytics endpoints
app.get('/api/analytics', (req, res) => {
  res.json({
    success: true,
    data: {
      totalBurns: 42,
      totalAcres: 5280,
      conflictsResolved: 18,
      avgScore: 87.3
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Mock backend server running on http://localhost:${PORT}`);
  console.log('📊 Available endpoints:');
  console.log('   POST /api/auth/login');
  console.log('   GET  /api/burn-requests');
  console.log('   POST /api/burn-requests');
  console.log('   POST /api/burn-requests/detect-conflicts');
  console.log('   POST /api/alerts/send');
  console.log('   ... and more');
});