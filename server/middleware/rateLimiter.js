/**
 * rateLimiter.js
 * Rate limiting configuration using express-rate-limit.
 * Separate limiters for general routes and the /api/chat endpoint.
 */
const rateLimit = require('express-rate-limit');
const logger = require('../config/logger');

const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 min
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Rate limit hit: ${req.ip} on ${req.originalUrl}`);
    res.status(429).json({
      success: false,
      error: 'Too many requests. Please wait a few minutes and try again.',
    });
  },
});

// Stricter limit for the AI chat endpoint
const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: parseInt(process.env.CHAT_RATE_LIMIT_MAX) || 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Chat rate limit hit: ${req.ip}`);
    res.status(429).json({
      success: false,
      error: 'Chat rate limit reached. Please slow down.',
    });
  },
});

// Stricter limit for auth routes (prevent brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Auth rate limit hit: ${req.ip}`);
    res.status(429).json({
      success: false,
      error: 'Too many authentication attempts. Please try again in 15 minutes.',
    });
  },
});

module.exports = { generalLimiter, chatLimiter, authLimiter };
