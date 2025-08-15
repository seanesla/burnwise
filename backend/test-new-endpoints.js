/**
 * Test script for new API endpoints
 * Tests /api/burn-requests/detect-conflicts and /api/alerts/send
 */

const express = require('express');
const request = require('supertest');

console.log('Testing new API endpoints...\n');

// Mock the required modules
jest.mock('./db/connection', () => ({
  query: jest.fn(),
  initializeDatabase: jest.fn()
}));

jest.mock('./agents/coordinator', () => ({
  coordinateBurnRequest: jest.fn().mockResolvedValue({ success: true, burnRequestId: 1 })
}));

jest.mock('./agents/predictor', () => ({
  detectOverlap: jest.fn().mockResolvedValue({
    hasConflict: true,
    type: 'smoke_overlap',
    severity: 'high',
    overlapArea: 500,
    maxConcentration: 45,
    suggestions: ['Shift time by 2 hours']
  })
}));

jest.mock('./agents/alerts', () => ({
  processAlert: jest.fn().mockResolvedValue({
    success: true,
    alertId: 123,
    deliveryStatus: 'sent'
  })
}));

jest.mock('./middleware/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  performance: jest.fn()
}));

describe('New API Endpoints', () => {
  let app;
  
  beforeAll(() => {
    app = express();
    app.use(express.json());
    
    // Mount the routes
    const burnRequestsRouter = require('./api/burnRequests');
    const alertsRouter = require('./api/alerts');
    
    app.use('/api/burn-requests', burnRequestsRouter);
    app.use('/api/alerts', alertsRouter);
  });
  
  describe('POST /api/burn-requests/detect-conflicts', () => {
    it('should detect conflicts for given burn requests', async () => {
      const { query } = require('./db/connection');
      query.mockResolvedValue([
        {
          request_id: 1,
          farm_name: 'Farm A',
          requested_date: '2025-08-20',
          requested_window_start: '09:00',
          requested_window_end: '12:00'
        },
        {
          request_id: 2,
          farm_name: 'Farm B',
          requested_date: '2025-08-20',
          requested_window_start: '10:00',
          requested_window_end: '13:00'
        }
      ]);
      
      const response = await request(app)
        .post('/api/burn-requests/detect-conflicts')
        .send({
          date: '2025-08-20'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.conflicts).toBeDefined();
      expect(response.body.burns_analyzed).toBe(2);
    });
    
    it('should handle specific burn request IDs', async () => {
      const { query } = require('./db/connection');
      query.mockResolvedValue([
        { request_id: 1, farm_name: 'Farm A' },
        { request_id: 2, farm_name: 'Farm B' }
      ]);
      
      const response = await request(app)
        .post('/api/burn-requests/detect-conflicts')
        .send({
          burn_request_ids: [1, 2]
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
    
    it('should return error if neither date nor IDs provided', async () => {
      const response = await request(app)
        .post('/api/burn-requests/detect-conflicts')
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('POST /api/alerts/send', () => {
    it('should send manual alert with phone number', async () => {
      const response = await request(app)
        .post('/api/alerts/send')
        .send({
          recipient_phone: '+1234567890',
          message: 'Test alert message',
          type: 'test',
          severity: 'low'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.alert_id).toBeDefined();
      expect(response.body.delivery_status).toBe('sent');
    });
    
    it('should send manual alert with email', async () => {
      const response = await request(app)
        .post('/api/alerts/send')
        .send({
          recipient_email: 'test@example.com',
          message: 'Test alert message'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
    
    it('should return error if message is missing', async () => {
      const response = await request(app)
        .post('/api/alerts/send')
        .send({
          recipient_phone: '+1234567890'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
    
    it('should return error if no recipient provided', async () => {
      const response = await request(app)
        .post('/api/alerts/send')
        .send({
          message: 'Test message'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
});

// Run the tests
if (require.main === module) {
  const jest = require('jest');
  jest.run(['--testPathPattern=test-new-endpoints.js']);
}