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

// Import API routes
const burnRequestsRoutes = require('./api/burnRequests');
const weatherRoutes = require('./api/weather');
const scheduleRoutes = require('./api/schedule');
const alertsRoutes = require('./api/alerts');
const farmsRoutes = require('./api/farms');
const analyticsRoutes = require('./api/analytics');

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

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(morgan('combined', { stream: { write: message => logger.http(message.trim()) } }));

// Rate limiting
app.use(rateLimiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'burnwise-backend',
    mode: 'test'
  });
});

// API Routes
app.use('/api/burn-requests', burnRequestsRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/farms', farmsRoutes);
app.use('/api/analytics', analyticsRoutes);

// Socket.io connection handling
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

// Start server immediately
server.listen(PORT, () => {
  logger.info(`🔥 BURNWISE Test Server running on port ${PORT}`);
  logger.info(`🌐 Environment: test/demo mode`);
  logger.info(`🔌 Socket.io enabled for real-time updates`);
  logger.info(`🤖 Running in test mode with mock database`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
  });
});