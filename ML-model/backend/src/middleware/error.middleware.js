const logger = require('../utils/logger');
const ApiError = require('../utils/apiError');
const { sendError } = require('../utils/response');
const { ERROR_CODES } = require('../utils/constants');

const notFoundHandler = (req, res, next) => {
  next(ApiError.notFound(`Endpoint not found: ${req.method} ${req.originalUrl}`));
};

const errorHandler = (err, req, res, next) => {
  const requestId = req.id;
  let statusCode = err.statusCode || 500;
  let code = err.code || ERROR_CODES.INTERNAL_SERVER_ERROR;
  let message = err.message || 'An unexpected error occurred';
  let details = err.details || null;

  // Handle Mongoose CastError / DuplicateKey / ValidationError
  if (err.name === 'CastError') {
    statusCode = 400;
    code = ERROR_CODES.VALIDATION_ERROR;
    message = `Invalid format for resource parameter: ${err.path}`;
  } else if (err.code === 11000) {
    statusCode = 409;
    code = ERROR_CODES.CONFLICT;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `A resource with this ${field} already exists`;
  } else if (err.name === 'ValidationError') {
    statusCode = 400;
    code = ERROR_CODES.VALIDATION_ERROR;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join(', ');
  }

  // Structured log
  logger.error(message, {
    requestId,
    statusCode,
    code,
    path: req.originalUrl,
    method: req.method,
    stack: err.stack,
  });

  return sendError(res, statusCode, code, message, requestId, details);
};

module.exports = {
  notFoundHandler,
  errorHandler,
};
