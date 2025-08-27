const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
require('dotenv').config();

console.log('Starting BURNWISE backend server...');

const logger = require('./middleware/logger');
console.log('Logger initialized');

const rateLimiter = require('./middleware/rateLimiter');
const { errorHandler } = require('./middleware/errorHandler');
const { initializeDatabase, query } = require('./db/connection');
const { smartCache, conditionalRequests } = require('./middleware/cacheHeaders');
const { authenticateToken, optionalAuth } = require('./middleware/auth');
// Check if performance optimizations exist
let performanceMiddleware = {};
try {
  performanceMiddleware = require('./middleware/performanceOptimizations');
} catch (err) {
  console.log('Performance optimizations not found, using defaults');
}
const { 
  responseCacheMiddleware = (ttl) => (req, res, next) => next(), 
  optimizeQueryParams = (req, res, next) => next(), 
  deduplicateRequests = () => (req, res, next) => next(),
  monitorMemoryUsage = () => {} 
} = performanceMiddleware;
console.log('Database module loaded');

// Import API routes
console.log('Loading API routes...');
const authRoutes = require('./api/auth');
console.log('Auth routes loaded');
const burnRequestsRoutes = require('./api/burnRequests');
console.log('Burn requests routes loaded');
const weatherRoutes = require('./api/weather');
console.log('Weather routes loaded');
const scheduleRoutes = require('./api/schedule');
console.log('Schedule routes loaded');
const alertsRoutes = require('./api/alerts');
console.log('Alerts routes loaded');
const farmsRoutes = require('./api/farms');
console.log('Farms routes loaded');
const analyticsRoutes = require('./api/analytics');
console.log('Analytics routes loaded');
const agentsRoutes = require('./api/agents');
console.log('Agents routes loaded');
const demoRoutes = require('./api/demo');
console.log('Demo routes loaded');
const onboardingRoutes = require('./api/onboarding');
console.log('Onboarding routes loaded');

// Import agents for initialization
console.log('Loading agents...');
const coordinatorAgent = require('./agents/coordinator');
console.log('Coordinator agent loaded');
const weatherAgent = require('./agents/weather');
console.log('Weather agent loaded');
const predictorAgent = require('./agents/predictor');
console.log('Predictor agent loaded');
const optimizerAgent = require('./agents/optimizer');
console.log('Optimizer agent loaded');
const alertsAgent = require('./agents/alerts');
console.log('Alerts agent loaded');
const { startCleanupJob } = require('./jobs/demoCleanup');
console.log('Demo cleanup job loaded');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  },
  // Performance optimizations
  transports: ['websocket', 'polling'], // Prefer websocket
  perMessageDeflate: {
    threshold: 1024 // Compress messages > 1kb
  },
  httpCompression: true,
  pingTimeout: 60000,
  pingInterval: 25000,
  upgradeTimeout: 10000,
  maxHttpBufferSize: 1e6, // 1MB
  allowEIO3: true // Allow older clients
});

// Make io globally accessible for logger and queryCache
global.io = io;

// Set io for modules that need it for backend visibility
logger.setIO(io);
const { queryCache } = require('./db/queryCache');
queryCache.setIO(io);
const { setIO: setDBIO } = require('./db/connection');
setDBIO(io);

const PORT = process.env.PORT || 5001;

console.log('Express app created');

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

// Session configuration - MUST come before routes that need sessions
app.use(session({
  secret: process.env.SESSION_SECRET || 'burnwise-demo-session-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  },
  name: 'burnwise-session'
}));

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
console.log('Setting up morgan logging...');
app.use(morgan('combined', { stream: logger.stream }));
console.log('Morgan configured');

// Body parsing with optimized limits
console.log('Setting up body parsing...');
app.use(express.json({ 
  limit: '2mb',
  strict: true,
  type: ['application/json', 'text/plain'] // Accept text/plain for compatibility
}));
app.use(express.urlencoded({ 
  extended: true,
  limit: '2mb',
  parameterLimit: 1000 
}));

// Add performance middleware
app.use(optimizeQueryParams);
app.use(responseCacheMiddleware(120)); // 2 minute default cache
app.use(deduplicateRequests());

// Trust proxy for accurate IP addresses
app.set('trust proxy', 1);

// Rate limiting - properly apply array of middlewares
console.log('Setting up rate limiter...');
// Apply simplified rate limiter
app.use(rateLimiter);
console.log('Rate limiter configured');

// Health check endpoint
console.log('Setting up routes...');
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
console.log('Setting up API routes...');

// Attach io to req for agent routes to use
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Public auth routes (no authentication required)
app.use('/api/auth', authRoutes);

// Protected API routes (temporarily using optionalAuth for testing)
app.use('/api/burn-requests', optionalAuth, burnRequestsRoutes);
app.use('/api/weather', optionalAuth, weatherRoutes); // Weather can be public
app.use('/api/schedule', optionalAuth, scheduleRoutes);
app.use('/api/alerts', optionalAuth, alertsRoutes);
app.use('/api/farms', optionalAuth, farmsRoutes);
app.use('/api/analytics', optionalAuth, analyticsRoutes); // Analytics can be public
app.use('/api/agents', optionalAuth, agentsRoutes); // Agent API for 5-agent system
app.use('/api/predictor', optionalAuth, require('./api/predictor')); // Gaussian plume model API
app.use('/api/demo', demoRoutes); // Demo mode with real TiDB integration
app.use('/api/onboarding', onboardingRoutes); // Conversational onboarding with OpenAI Agents SDK

// Socket.io setup for real-time updates
console.log('Setting up Socket.io...');
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
  
  // Handle approval responses from human operators
  socket.on('approval.response', async (data) => {
    try {
      logger.info('Received approval response', {
        requestId: data.requestId,
        decision: data.decision,
        conversationId: data.conversationId
      });
      
      // Store approval decision in database
      await query(`
        UPDATE weather_analyses 
        SET approved_by = 1,
            approved_at = NOW(),
            approval_notes = ?
        WHERE id = ?
      `, [
        `${data.decision}: ${data.reasoning}`,
        data.requestId
      ]);
      
      // Emit result back to all connected clients
      io.emit('approval.result', {
        requestId: data.requestId,
        decision: data.decision,
        reasoning: data.reasoning,
        timestamp: data.timestamp
      });
      
      // If approved, update burn request status
      if (data.decision === 'approved') {
        await query(`
          UPDATE burn_requests 
          SET status = 'approved',
              approved_at = NOW()
          WHERE id = ?
        `, [data.requestId]);
      } else {
        await query(`
          UPDATE burn_requests 
          SET status = 'rejected',
              rejection_reason = ?
          WHERE id = ?
        `, [data.reasoning, data.requestId]);
      }
      
    } catch (error) {
      logger.error('Failed to process approval response', { error: error.message });
      socket.emit('approval.error', { error: error.message });
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
console.log('Socket.io configured with enhanced real-time features');

// Make io available to routes
app.set('io', io);

// Error handling middleware
console.log('Setting up error handler...');
app.use(errorHandler);

// 404 handler
console.log('Setting up 404 handler...');
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `${req.method} ${req.originalUrl} not found`
  });
});
console.log('All middleware configured');

// Initialize database and start server
async function startServer() {
  try {
    // Initialize database connection
    console.log('Connecting to TiDB...');
    logger.info('Starting database initialization...');
    await initializeDatabase();
    console.log('Database initialized');
    logger.info('Database initialized successfully');
    
    // Initialize agents with granular logging
    console.log('Starting agent initialization sequence...');
    
    console.log('Step 1: Initializing Coordinator Agent...');
    logger.info('Initializing Coordinator Agent...');
    await coordinatorAgent.initialize();
    console.log('Coordinator Agent initialized');
    logger.info('Coordinator Agent initialized successfully');
    
    console.log('Step 2: Initializing Weather Agent...');
    logger.info('Initializing Weather Agent...');
    await weatherAgent.initialize();
    console.log('Weather Agent initialized');
    logger.info('Weather Agent initialized successfully');
    
    console.log('Step 3: Initializing Predictor Agent...');
    logger.info('Initializing Predictor Agent...');
    await predictorAgent.initialize();
    console.log('Predictor Agent initialized');
    logger.info('Predictor Agent initialized successfully');
    
    console.log('Step 4: Initializing Optimizer Agent...');
    logger.info('Initializing Optimizer Agent...');
    await optimizerAgent.initialize();
    console.log('Optimizer Agent initialized');
    logger.info('Optimizer Agent initialized successfully');
    
    console.log('Step 5: Initializing Alerts Agent...');
    logger.info('Initializing Alerts Agent...');
    await alertsAgent.initialize();
    console.log('Alerts Agent initialized');
    logger.info('Alerts Agent initialized successfully');
    
    console.log('All agents initialized successfully');
    logger.info('All agents initialized successfully');
    
    // Start server with detailed logging
    console.log('About to start HTTP server on port', PORT);
    
    server.listen(PORT, '0.0.0.0', () => {
      console.log('Server.listen() callback called successfully!');
      logger.info(`BURNWISE Backend Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`Socket.io enabled for real-time updates`);
      logger.info(`5-Agent System: Coordinator | Weather | Predictor | Optimizer | Alerts`);
      
      // Start demo cleanup job
      try {
        startCleanupJob();
        logger.info('Demo cleanup job started successfully');
      } catch (error) {
        logger.error('Failed to start demo cleanup job:', error.message);
      }
      
      console.log('='.repeat(60));
      console.log('SERVER FULLY READY FOR PLAYWRIGHT MCP TESTING');
      console.log('='.repeat(60));
    });
    
    server.on('error', (error) => {
      console.error('Server error:', error);
      logger.error('Server error:', error);
    });
    
    console.log('Server.listen() call initiated, waiting for callback...');
    
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

console.log('Calling startServer()...');
startServer();

module.exports = { app, server, io };