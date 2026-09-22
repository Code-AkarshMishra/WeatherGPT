const { ERROR_CODES } = require('./constants');

class ApiError extends Error {
  constructor(statusCode, message, code = ERROR_CODES.INTERNAL_SERVER_ERROR, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Bad Request', details = null, code = ERROR_CODES.VALIDATION_ERROR) {
    return new ApiError(400, message, code, details);
  }

  static unauthorized(message = 'Unauthorized', code = ERROR_CODES.UNAUTHORIZED) {
    return new ApiError(401, message, code);
  }

  static forbidden(message = 'Forbidden', code = ERROR_CODES.FORBIDDEN) {
    return new ApiError(403, message, code);
  }

  static notFound(message = 'Resource not found', code = ERROR_CODES.NOT_FOUND) {
    return new ApiError(404, message, code);
  }

  static conflict(message = 'Resource conflict', code = ERROR_CODES.CONFLICT) {
    return new ApiError(409, message, code);
  }

  static tooManyRequests(message = 'Too many requests. Please retry shortly.', code = ERROR_CODES.RATE_LIMIT_EXCEEDED) {
    return new ApiError(429, message, code);
  }

  static internal(message = 'Internal server error', code = ERROR_CODES.INTERNAL_SERVER_ERROR) {
    return new ApiError(500, message, code);
  }

  static providerTimeout(message = 'Weather provider timed out', code = ERROR_CODES.WEATHER_PROVIDER_TIMEOUT) {
    return new ApiError(504, message, code);
  }

  static aiServiceError(message = 'AI service temporarily unavailable', code = ERROR_CODES.AI_SERVICE_ERROR) {
    return new ApiError(502, message, code);
  }
}

module.exports = ApiError;
