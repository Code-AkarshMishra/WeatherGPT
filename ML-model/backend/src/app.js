const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');

const env = require('./config/env');
const { cacheClient } = require('./config/redis');
const requestIdMiddleware = require('./middleware/requestId.middleware');
const { apiLimiter } = require('./middleware/rateLimiter.middleware');
const { notFoundHandler, errorHandler } = require('./middleware/error.middleware');
const { sendSuccess, sendError } = require('./utils/response');
const apiRoutes = require('./routes/index');

const app = express();

// Security headers
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl)
      if (!origin) return callback(null, true);
      if (env.CORS_ORIGINS.includes('*') || env.CORS_ORIGINS.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive in dev mode
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  })
);

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request ID propagation
app.use(requestIdMiddleware);

// Request logger
if (env.NODE_ENV !== 'test') {
  morgan.token('req-id', (req) => req.id);
  app.use(
    morgan(':date[iso] [:req-id] :method :url :status :response-time ms - :res[content-length]')
  );
}

// Global API rate limiting
app.use('/api', apiLimiter);

// Liveness probe (does not reveal secrets)
app.get('/health', (req, res) => {
  return sendSuccess(res, {
    status: 'UP',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    environment: env.NODE_ENV,
    version: '1.0.0',
  });
});

// Readiness probe (verifies database & cache status)
app.get('/ready', async (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'CONNECTED' : 'DISCONNECTED';
  const redisStatus = cacheClient.isRedisConnected() ? 'CONNECTED' : 'MEMORY_FALLBACK';

  const isReady = dbStatus === 'CONNECTED' || env.MOCK_EXTERNAL_APIS;

  return sendSuccess(
    res,
    {
      ready: isReady,
      services: {
        database: dbStatus,
        cache: redisStatus,
        aiGateway: env.AI_SERVICE_URL ? 'CONFIGURED' : 'MOCK_MODE',
        meteorologyProvider: env.IMD_BASE_URL ? 'CONFIGURED' : 'OPEN_METEO_FALLBACK',
      },
      timestamp: new Date().toISOString(),
    },
    {},
    isReady ? 200 : 503
  );
});

// API Routes
app.use('/api', apiRoutes);

// Root greeting
app.get('/', (req, res) => {
  return sendSuccess(res, {
    name: 'WeatherGPT Backend API Gateway',
    version: '1.0.0',
    documentation: '/docs/API_CONTRACT.md',
    health: '/health',
    readiness: '/ready',
    apiPrefix: '/api',
  });
});

// 404 handler
app.use(notFoundHandler);

// Centralized error handler
app.use(errorHandler);

module.exports = app;
