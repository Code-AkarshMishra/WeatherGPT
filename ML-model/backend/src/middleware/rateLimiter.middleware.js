const rateLimit = require('express-rate-limit');
const { sendError } = require('../utils/response');
const { ERROR_CODES } = require('../utils/constants');

const createLimiter = ({ windowMs = 15 * 60 * 1000, max = 100, message = 'Too many requests, please try again later.' }) => {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      return sendError(res, 429, ERROR_CODES.RATE_LIMIT_EXCEEDED, message, req.id);
    },
    skip: (req) => process.env.NODE_ENV === 'test',
  });
};

const apiLimiter = createLimiter({ windowMs: 15 * 60 * 1000, max: 300 });
const authLimiter = createLimiter({ windowMs: 15 * 60 * 1000, max: 20, message: 'Too many login attempts. Please try again in 15 minutes.' });
const chatLimiter = createLimiter({ windowMs: 1 * 60 * 1000, max: 30, message: 'Chat rate limit reached. Please wait before asking more questions.' });
const climateLimiter = createLimiter({ windowMs: 5 * 60 * 1000, max: 60, message: 'Historical queries are rate limited. Please try again shortly.' });

module.exports = {
  apiLimiter,
  authLimiter,
  chatLimiter,
  climateLimiter,
  createLimiter,
};
