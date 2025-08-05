const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
require('dotenv').config();

const logger = require('./middleware/logger');
const rateLimiter = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');
const { initializeDatabase } = require('./db/connection');

// Import API routes
const burnRequestsRoutes = require('./api/burnRequests');
const weatherRoutes = require('./api/weather');
const scheduleRoutes = require('./api/schedule');
const alertsRoutes = require('./api/alerts');
const farmsRoutes = require('./api/farms');
const analyticsRoutes = require('./api/analytics');

// Import agents for initialization
const coordinatorAgent = require('./agents/coordinator');
const weatherAgent = require('./agents/weather');
const predictorAgent = require('./agents/predictor');
const optimizerAgent = require('./agents/optimizer');
const alertsAgent = require('./agents/alerts');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 5001;

// Security middleware
app.use(helmet());
app.use(compression());

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));

// Logging
app.use(morgan('combined', { stream: logger.stream }));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
app.use(rateLimiter);

// Health check endpoint
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
app.use('/api/burn-requests', burnRequestsRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/farms', farmsRoutes);
app.use('/api/analytics', analyticsRoutes);

// Socket.io setup for real-time updates
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

// Make io available to routes
app.set('io', io);

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `${req.method} ${req.originalUrl} not found`
  });
});

// Initialize database and start server
async function startServer() {
  try {
    // Initialize database connection
    await initializeDatabase();
    logger.info('Database initialized successfully');
    
    // Initialize agents
    await coordinatorAgent.initialize();
    await weatherAgent.initialize();
    await predictorAgent.initialize();
    await optimizerAgent.initialize();
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

startServer();

module.exports = { app, server, io };