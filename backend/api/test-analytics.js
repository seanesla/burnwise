const express = require('express');
const router = express.Router();

// Mock data generator for testing
function generateMockAnalytics() {
  return {
    totalBurns: Math.floor(Math.random() * 100) + 50,
    completedBurns: Math.floor(Math.random() * 50) + 20,
    scheduledBurns: Math.floor(Math.random() * 30) + 10,
    totalAcreage: Math.floor(Math.random() * 5000) + 1000,
    burnedAcreage: Math.floor(Math.random() * 2500) + 500,
    averageSmokePM25: (Math.random() * 50 + 10).toFixed(1),
    conflictsDetected: Math.floor(Math.random() * 10),
    conflictsResolved: Math.floor(Math.random() * 8),
    weatherSuitability: Math.floor(Math.random() * 40) + 60,
    farmParticipation: Math.floor(Math.random() * 30) + 70,
    timestamp: new Date().toISOString()
  };
}

// Simple test endpoint that always works
router.get('/', (req, res) => {
  console.log('Analytics endpoint hit');
  res.json(generateMockAnalytics());
});

router.get('/dashboard', (req, res) => {
  const analytics = generateMockAnalytics();
  res.json({
    ...analytics,
    period: req.query.period || '30d',
    chartData: {
      daily: Array(7).fill(null).map((_, i) => ({
        day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i],
        burns: Math.floor(Math.random() * 10) + 1,
        acreage: Math.floor(Math.random() * 500) + 100
      }))
    }
  });
});

router.get('/summary', (req, res) => {
  res.json({
    summary: generateMockAnalytics(),
    status: 'operational'
  });
});

module.exports = router;