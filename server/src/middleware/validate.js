const { z } = require('zod');
const ApiError = require('../utils/ApiError');

/**
 * Returns an Express middleware that validates req.body against a Zod schema.
 * On failure it surfaces a structured 400 with the Zod issue messages.
 */
const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const errors = result.error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    }));
    return next(ApiError.badRequest('Validation failed', errors));
  }
  req.body = result.data; // replace with parsed/coerced data
  next();
};

module.exports = validate;
