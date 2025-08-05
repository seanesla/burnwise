const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
require('dotenv').config();

console.log('🔥 Starting BURNWISE backend server...');

const logger = require('./middleware/logger');
console.log('✅ Logger initialized');

const rateLimiter = require('./middleware/rateLimiter');
const { errorHandler } = require('./middleware/errorHandler');
const { initializeDatabase } = require('./db/connection');
console.log('✅ Database module loaded');

// Import API routes
console.log('Loading API routes...');
const burnRequestsRoutes = require('./api/burnRequests');
console.log('✅ Burn requests routes loaded');
const weatherRoutes = require('./api/weather');
console.log('✅ Weather routes loaded');
const scheduleRoutes = require('./api/schedule');
console.log('✅ Schedule routes loaded');
const alertsRoutes = require('./api/alerts');
console.log('✅ Alerts routes loaded');
const farmsRoutes = require('./api/farms');
console.log('✅ Farms routes loaded');
// Use test analytics for now due to database issues
const analyticsRoutes = require('./api/test-analytics');
console.log('✅ Analytics routes loaded (test mode)');

// Import agents for initialization
console.log('Loading agents...');
const coordinatorAgent = require('./agents/coordinator');
console.log('✅ Coordinator agent loaded');
const weatherAgent = require('./agents/weather');
console.log('✅ Weather agent loaded');
const predictorAgent = require('./agents/predictor');
console.log('✅ Predictor agent loaded');
const optimizerAgent = require('./agents/optimizer');
console.log('✅ Optimizer agent loaded');
const alertsAgent = require('./agents/alerts');
console.log('✅ Alerts agent loaded');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 5001;

console.log('🚀 Express app created');

// Security middleware
app.use(helmet());
app.use(compression());

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));

// Logging
console.log('📍 Setting up morgan logging...');
app.use(morgan('combined', { stream: logger.stream }));
console.log('✅ Morgan configured');

// Body parsing
console.log('📍 Setting up body parsing...');
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
console.log('📍 Setting up rate limiter...');
app.use(rateLimiter);
console.log('✅ Rate limiter configured');

// Health check endpoint
console.log('📍 Setting up routes...');
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    agents: {
      coordinator: 'active',
      weather: 'active',
      predictor: 'active',
      optimizer: 'active',
      alerts: 'active'
    }
  });
});

// API routes
console.log('📍 Setting up API routes...');
app.use('/api/burn-requests', burnRequestsRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/farms', farmsRoutes);
app.use('/api/analytics', analyticsRoutes);

// Socket.io setup for real-time updates
console.log('📍 Setting up Socket.io...');
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);
  
  socket.on('join-farm', (farmId) => {
    socket.join(`farm-${farmId}`);
    logger.info(`Client ${socket.id} joined farm-${farmId}`);
  });
  
  socket.on('leave-farm', (farmId) => {
    socket.leave(`farm-${farmId}`);
    logger.info(`Client ${socket.id} left farm-${farmId}`);
  });
  
  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});
console.log('✅ Socket.io configured');

// Make io available to routes
app.set('io', io);

// Error handling middleware
console.log('📍 Setting up error handler...');
app.use(errorHandler);

// 404 handler
console.log('📍 Setting up 404 handler...');
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `${req.method} ${req.originalUrl} not found`
  });
});
console.log('✅ All middleware configured');

// Initialize database and start server
async function startServer() {
  try {
    // Initialize database connection
    console.log('🔗 Connecting to TiDB...');
    logger.info('Starting database initialization...');
    await initializeDatabase();
    console.log('✅ Database initialized');
    logger.info('Database initialized successfully');
    
    // Initialize agents
    logger.info('Initializing Coordinator Agent...');
    await coordinatorAgent.initialize();
    logger.info('Initializing Weather Agent...');
    await weatherAgent.initialize();
    logger.info('Initializing Predictor Agent...');
    await predictorAgent.initialize();
    logger.info('Initializing Optimizer Agent...');
    await optimizerAgent.initialize();
    logger.info('Initializing Alerts Agent...');
    await alertsAgent.initialize();
    logger.info('All agents initialized successfully');
    
    // Start server
    server.listen(PORT, () => {
      logger.info(`🔥 BURNWISE Backend Server running on port ${PORT}`);
      logger.info(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`🔌 Socket.io enabled for real-time updates`);
      logger.info(`🤖 5-Agent System: Coordinator | Weather | Predictor | Optimizer | Alerts`);
    });
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

console.log('🏁 Calling startServer()...');
startServer();

module.exports = { app, server, io };