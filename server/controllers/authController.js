/**
 * authController.js
 * Handles register, login, token refresh, and logout.
 */
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const inMemoryAuth = require('../services/inMemoryAuth');
const logger = require('../config/logger');

const isDbReady = () => mongoose.connection.readyState === 1;

function signAccessToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m',
  });
}

function signRefreshToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d',
  });
}

// POST /api/auth/register
exports.register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { name, email, password } = req.body;
    const cleanEmail = email.toLowerCase().trim();

    let user;
    if (isDbReady()) {
      const existing = await User.findOne({ email: cleanEmail });
      if (existing) {
        return res.status(409).json({ success: false, error: 'An account with this email already exists.' });
      }

      user = await User.create({ name, email: cleanEmail, password });
      const accessToken = signAccessToken(user._id);
      const refreshToken = signRefreshToken(user._id);

      user.refreshTokens.push({ token: refreshToken });
      await user.save();

      logger.info(`New user registered in MongoDB: ${user.email} (${user._id})`);

      return res.status(201).json({
        success: true,
        data: {
          user: user.toJSON(),
          accessToken,
          refreshToken,
        },
      });
    } else {
      // In-memory fallback mode (MongoDB offline / IP not whitelisted)
      const existing = await inMemoryAuth.findByEmail(cleanEmail);
      if (existing) {
        return res.status(409).json({ success: false, error: 'An account with this email already exists.' });
      }

      user = await inMemoryAuth.createUser({ name, email: cleanEmail, password });
      const accessToken = signAccessToken(user._id);
      const refreshToken = signRefreshToken(user._id);
      user.refreshTokens.push({ token: refreshToken });

      logger.info(`[AUTH] User registered in in-memory fallback mode: ${user.email}`);

      return res.status(201).json({
        success: true,
        data: {
          user: user.toJSON(),
          accessToken,
          refreshToken,
          mode: 'in-memory',
        },
      });
    }
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/login
exports.login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, password } = req.body;
    const cleanEmail = email.toLowerCase().trim();

    if (isDbReady()) {
      const user = await User.findOne({ email: cleanEmail }).select('+password');
      if (!user) {
        return res.status(401).json({ success: false, error: 'Invalid email or password.' });
      }

      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({ success: false, error: 'Invalid email or password.' });
      }

      const accessToken = signAccessToken(user._id);
      const refreshToken = signRefreshToken(user._id);

      user.refreshTokens = user.refreshTokens.slice(-4);
      user.refreshTokens.push({ token: refreshToken });
      await user.save();

      logger.info(`User logged in (MongoDB): ${user.email}`);

      return res.json({
        success: true,
        data: {
          user: user.toJSON(),
          accessToken,
          refreshToken,
        },
      });
    } else {
      // In-memory fallback login
      const user = await inMemoryAuth.findByEmail(cleanEmail);
      if (!user) {
        return res.status(401).json({ success: false, error: 'Invalid email or password.' });
      }

      const isMatch = await inMemoryAuth.comparePassword(user, password);
      if (!isMatch) {
        return res.status(401).json({ success: false, error: 'Invalid email or password.' });
      }

      const accessToken = signAccessToken(user._id);
      const refreshToken = signRefreshToken(user._id);

      user.refreshTokens = (user.refreshTokens || []).slice(-4);
      user.refreshTokens.push({ token: refreshToken });

      logger.info(`[AUTH] User logged in (in-memory mode): ${user.email}`);

      return res.json({
        success: true,
        data: {
          user: user.toJSON(),
          accessToken,
          refreshToken,
          mode: 'in-memory',
        },
      });
    }
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/refresh
exports.refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ success: false, error: 'Refresh token required.' });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch {
      return res.status(401).json({ success: false, error: 'Invalid or expired refresh token.' });
    }

    let user;
    if (isDbReady()) {
      user = await User.findById(decoded.userId);
    } else {
      user = await inMemoryAuth.findById(decoded.userId);
    }

    if (!user) {
      return res.status(401).json({ success: false, error: 'User not found.' });
    }

    const storedToken = (user.refreshTokens || []).find((t) => t.token === refreshToken);
    if (!storedToken) {
      return res.status(401).json({ success: false, error: 'Refresh token revoked.' });
    }

    const newAccessToken = signAccessToken(user._id);
    const newRefreshToken = signRefreshToken(user._id);

    user.refreshTokens = user.refreshTokens.filter((t) => t.token !== refreshToken);
    user.refreshTokens.push({ token: newRefreshToken });
    if (typeof user.save === 'function') {
      await user.save();
    }

    res.json({
      success: true,
      data: { accessToken: newAccessToken, refreshToken: newRefreshToken },
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/logout
exports.logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken && req.user) {
      req.user.refreshTokens = req.user.refreshTokens.filter((t) => t.token !== refreshToken);
      await req.user.save();
    }

    logger.info(`User logged out: ${req.user?.email || 'unknown'}`);
    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (err) {
    next(err);
  }
};

// GET /api/auth/me
exports.getMe = async (req, res) => {
  res.json({ success: true, data: { user: req.user } });
};
