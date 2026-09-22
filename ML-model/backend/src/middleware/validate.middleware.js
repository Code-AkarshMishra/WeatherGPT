const { ZodError } = require('zod');
const ApiError = require('../utils/apiError');
const { ERROR_CODES } = require('../utils/constants');

const validate = (schema) => (req, res, next) => {
  try {
    if (schema.body) {
      req.body = schema.body.parse(req.body);
    }
    if (schema.query) {
      req.query = schema.query.parse(req.query);
    }
    if (schema.params) {
      req.params = schema.params.parse(req.params);
    }
    next();
  } catch (error) {
    if (error instanceof ZodError) {
      const formattedErrors = error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }));
      return next(
        new ApiError(
          400,
          `Validation failed: ${formattedErrors.map((e) => `${e.field} - ${e.message}`).join(', ')}`,
          ERROR_CODES.VALIDATION_ERROR,
          formattedErrors
        )
      );
    }
    next(error);
  }
};

module.exports = validate;
