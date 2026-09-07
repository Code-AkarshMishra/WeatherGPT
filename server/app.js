/**
 * app.js
 * Express application setup — middleware, routes, error handling.
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoSanitize = require('express-mongo-sanitize');
const mongoose = require('mongoose');
const logger = require('./config/logger');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet());

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',').map((u) => u.trim().replace(/\/$/, ''))
  : ['https://weather-gpt-srmu.vercel.app', 'http://localhost:5173'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const cleanOrigin = origin.replace(/\/$/, '');
    if (
      allowedOrigins.includes('*') ||
      allowedOrigins.includes(cleanOrigin) ||
      cleanOrigin.endsWith('.vercel.app') ||
      cleanOrigin.includes('localhost')
    ) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ── MongoDB injection sanitization ───────────────────────────────────────────
app.use(mongoSanitize());

// ── Response Time & Performance Tracking ────────────────────────────────────
app.use((req, res, next) => {
  const startHrTime = process.hrtime();
  res.on('finish', () => {
    const elapsedHrTime = process.hrtime(startHrTime);
    const elapsedTimeInMs = Math.round((elapsedHrTime[0] * 1000 + elapsedHrTime[1] / 1e6) * 100) / 100;
    try {
      res.setHeader('X-Response-Time', `${elapsedTimeInMs}ms`);
    } catch {}
    if (elapsedTimeInMs > 1000) {
      logger.warn(`Slow Request: ${req.method} ${req.originalUrl} took ${elapsedTimeInMs}ms`);
    }
  });
  next();
});

// ── HTTP request logging (Morgan → Winston) ───────────────────────────────────
app.use(morgan('combined', { stream: logger.morganStream }));

// ── Health check & Telemetry ──────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;
  let dbPingMs = null;

  // Optional lightweight DB roundtrip ping if ?db=1 or ?ping_db=true
  if (isDbConnected && (req.query.db === '1' || req.query.ping_db === 'true')) {
    try {
      const t0 = Date.now();
      await mongoose.connection.db.command({ ping: 1 });
      dbPingMs = Date.now() - t0;
    } catch {
      dbPingMs = -1;
    }
  }

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'WeatherGPT API',
    uptime: Math.round(process.uptime()),
    database: isDbConnected ? 'connected' : 'disconnected',
    dbPingMs,
    mlService: process.env.ML_SERVICE_URL || 'https://weathergpt-1-ike5.onrender.com',
    model: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
  });
});

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/weather', require('./routes/weather'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/roles', require('./routes/roles'));
app.use('/api/system', require('./routes/system'));

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, error: `Route ${req.method} ${req.originalUrl} not found.` });
});

// ── Centralized error handler (must be last) ──────────────────────────────────
app.use(errorHandler);

module.exports = app;
