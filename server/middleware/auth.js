/**
 * auth.js middleware
 * Verifies JWT Bearer token and attaches req.user.
 * Routes that don't require auth should not use this middleware.
 * For optional auth (guest support), use optionalAuth instead.
 */
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../config/logger');

const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'No token provided. Please log in.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.userId).select('-password -refreshTokens');
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
    const user = await User.findById(decoded.userId).select('-password -refreshTokens');
    req.user = user || null;
    next();
  } catch (err) {
    // Invalid token → treat as guest, don't block
    req.user = null;
    next();
  }
};

module.exports = { auth, optionalAuth };
