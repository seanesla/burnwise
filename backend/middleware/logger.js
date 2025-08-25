const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom format for logs
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
  })
);

// Create the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'burnwise-agricultural-coordinator' },
  transports: [
    // Error log file
    new DailyRotateFile({
      filename: path.join(logsDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '14d',
      zippedArchive: true
    }),
    
    // Combined log file
    new DailyRotateFile({
      filename: path.join(logsDir, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      zippedArchive: true
    }),
    
    // Agent-specific log file
    new DailyRotateFile({
      filename: path.join(logsDir, 'agents-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'debug',
      maxSize: '20m',
      maxFiles: '7d',
      zippedArchive: true,
      format: winston.format.combine(
        winston.format.label({ label: 'AGENT' }),
        logFormat
      )
    })
  ],
  
  // Handle uncaught exceptions and unhandled rejections
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log')
    })
  ],
  
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log')
    })
  ]
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
    level: 'debug'
  }));
}

// Create a stream object for Morgan HTTP logger
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  }
};

// Store io reference for Socket.io emissions
let io = null;

logger.setIO = (socketIO) => {
  io = socketIO;
  logger.debug('Socket.io instance set for logger');
};

// Helper methods for different log contexts
logger.agent = (agentName, level, message, meta = {}) => {
  logger.log(level, `[${agentName.toUpperCase()}] ${message}`, {
    agent: agentName,
    ...meta
  });
};

logger.performance = (operation, duration, meta = {}) => {
  logger.info(`Performance: ${operation} completed in ${duration}ms`, {
    operation,
    duration,
    performance: true,
    ...meta
  });
  
  // Emit to frontend if io available
  if (io) {
    io.emit('backend.performance', {
      operation,
      duration,
      timestamp: new Date().toISOString(),
      ...meta
    });
  }
};

logger.security = (event, details = {}) => {
  logger.warn(`Security Event: ${event}`, {
    security: true,
    timestamp: new Date().toISOString(),
    ...details
  });
};

logger.vector = (operation, vectorType, dimensions, meta = {}) => {
  logger.debug(`Vector Operation: ${operation}`, {
    operation,
    vectorType,
    dimensions,
    vector: true,
    ...meta
  });
};

logger.weather = (message, weatherData = {}) => {
  logger.info(`Weather: ${message}`, {
    weather: true,
    ...weatherData
  });
};

logger.algorithm = (algorithm, phase, message, data = {}) => {
  logger.debug(`Algorithm [${algorithm}] ${phase}: ${message}`, {
    algorithm,
    phase,
    algorithmic: true,
    ...data
  });
};

module.exports = logger;