/**
 * auth.js middleware
 * Verifies JWT Bearer token and attaches req.user.
 * Supports both MongoDB Atlas and in-memory fallback.
 */
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const inMemoryAuth = require('../services/inMemoryAuth');
const logger = require('../config/logger');

const isDbReady = () => mongoose.connection.readyState === 1;

const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'No token provided. Please log in.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    let user = null;
    if (isDbReady()) {
      user = await User.findById(decoded.userId).select('-password -refreshTokens');
    } else {
      user = await inMemoryAuth.findById(decoded.userId);
    }

    if (!user) {
      return res.status(401).json({ success: false, error: 'User not found. Token invalid.' });
    }

    req.user = user;
    next();
  } catch (err) {
    logger.warn(`Auth middleware failed: ${err.message}`);
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'Token expired. Please refresh.' });
    }
    return res.status(401).json({ success: false, error: 'Invalid token.' });
  }
};

/**
 * optionalAuth — attaches req.user if a valid token is present,
 * but does NOT reject the request if no token is provided.
 * Used for routes that support both guest and authenticated access.
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    let user = null;
    if (isDbReady()) {
      user = await User.findById(decoded.userId).select('-password -refreshTokens');
    } else {
      user = await inMemoryAuth.findById(decoded.userId);
    }

    req.user = user || null;
    next();
  } catch (err) {
    req.user = null;
    next();
  }
};

module.exports = { auth, optionalAuth };


