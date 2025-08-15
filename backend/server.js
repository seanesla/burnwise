const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
require('dotenv').config();

console.log('🔥 Starting BURNWISE backend server...');

const logger = require('./middleware/logger');
console.log('✅ Logger initialized');

const rateLimiter = require('./middleware/rateLimiter');
const { errorHandler } = require('./middleware/errorHandler');
const { initializeDatabase, query } = require('./db/connection');
const { smartCache, conditionalRequests } = require('./middleware/cacheHeaders');
const { authenticateToken, optionalAuth } = require('./middleware/auth');
console.log('✅ Database module loaded');

// Import API routes
console.log('Loading API routes...');
const authRoutes = require('./api/auth');
console.log('✅ Auth routes loaded');
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
const analyticsRoutes = require('./api/analytics');
console.log('✅ Analytics routes loaded');

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

// Security middleware with enhanced configuration
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
app.use(compression());

// Cookie parser - MUST come before auth middleware
app.use(cookieParser());

// CORS configuration with strict origin validation
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.security('CORS blocked origin', { origin });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
}));

// Logging
console.log('📍 Setting up morgan logging...');
app.use(morgan('combined', { stream: logger.stream }));
console.log('✅ Morgan configured');

// Body parsing with size limits for security
console.log('📍 Setting up body parsing...');
app.use(express.json({ limit: '1mb' })); // Reduced limit for security
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Trust proxy for accurate IP addresses
app.set('trust proxy', 1);

// Rate limiting - properly apply array of middlewares
console.log('📍 Setting up rate limiter...');
// Apply simplified rate limiter
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

// Public auth routes (no authentication required)
app.use('/api/auth', authRoutes);

// Protected API routes (temporarily using optionalAuth for testing)
app.use('/api/burn-requests', optionalAuth, burnRequestsRoutes);
app.use('/api/weather', optionalAuth, weatherRoutes); // Weather can be public
app.use('/api/schedule', optionalAuth, scheduleRoutes);
app.use('/api/alerts', optionalAuth, alertsRoutes);
app.use('/api/farms', optionalAuth, farmsRoutes);
app.use('/api/analytics', optionalAuth, analyticsRoutes); // Analytics can be public

// Socket.io setup for real-time updates
console.log('📍 Setting up Socket.io...');
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);
  
  // Send connection confirmation with system status
  socket.emit('connected', {
    message: 'Connected to BURNWISE real-time system',
    agents: {
      coordinator: 'active',
      weather: 'active',
      predictor: 'active',
      optimizer: 'active',
      alerts: 'active'
    },
    timestamp: new Date().toISOString()
  });
  
  socket.on('join-farm', (farmId) => {
    socket.join(`farm-${farmId}`);
    logger.info(`Client ${socket.id} joined farm-${farmId}`);
    
    // Notify farm room of new member
    io.to(`farm-${farmId}`).emit('farm-member-joined', {
      farmId,
      socketId: socket.id,
      timestamp: new Date().toISOString()
    });
  });
  
  socket.on('leave-farm', (farmId) => {
    socket.leave(`farm-${farmId}`);
    logger.info(`Client ${socket.id} left farm-${farmId}`);
    
    // Notify farm room of member leaving
    io.to(`farm-${farmId}`).emit('farm-member-left', {
      farmId,
      socketId: socket.id,
      timestamp: new Date().toISOString()
    });
  });
  
  // Subscribe to alert types
  socket.on('subscribe-alerts', (alertTypes) => {
    alertTypes.forEach(type => {
      socket.join(`alert-${type}`);
    });
    logger.info(`Client ${socket.id} subscribed to alerts: ${alertTypes.join(', ')}`);
  });
  
  // Request real-time weather update
  socket.on('request-weather', async (location) => {
    try {
      const weatherData = await weatherAgent.fetchCurrentWeather(location);
      socket.emit('weather-update', weatherData);
    } catch (error) {
      socket.emit('weather-error', { error: error.message });
    }
  });
  
  // Request current schedule
  socket.on('request-schedule', async (date) => {
    try {
      const schedule = await query(
        'SELECT * FROM burn_schedule WHERE scheduled_date = ? ORDER BY scheduled_start_time',
        [date]
      );
      socket.emit('schedule-update', schedule);
    } catch (error) {
      socket.emit('schedule-error', { error: error.message });
    }
  });
  
  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
    
    // Notify all rooms this socket was in
    const rooms = Object.keys(socket.rooms);
    rooms.forEach(room => {
      if (room !== socket.id) {
        io.to(room).emit('member-disconnected', {
          socketId: socket.id,
          timestamp: new Date().toISOString()
        });
      }
    });
  });
});
console.log('✅ Socket.io configured with enhanced real-time features');

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

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

console.log('🏁 Calling startServer()...');
startServer();

module.exports = { app, server, io };