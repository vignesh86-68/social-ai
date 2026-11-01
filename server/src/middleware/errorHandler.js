const ApiError = require('../utils/ApiError');

// Central error handler – must be registered LAST in Express middleware chain
const errorHandler = (err, req, res, next) => {
  // Multer file upload errors
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, message: 'File size exceeds the 5MB limit' });
    }
    return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
  }

  // Mongoose CastError (invalid ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({ success: false, message: `Invalid identifier format: ${err.value}` });
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ success: false, message: 'Validation failed', errors });
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = err.keyValue ? Object.keys(err.keyValue)[0] : 'record';
    return res.status(409).json({ success: false, message: `${field} already exists` });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, message: 'Token expired' });
  }

  // Operational errors we threw ourselves
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.errors?.length && { errors: err.errors }),
    });
  }

  // Redact potential API keys or credentials from unexpected errors
  const safeMessage = (err.message || 'Internal server error')
    .replace(/key=[^&\s"'`]+/gi, 'key=[REDACTED]')
    .replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_KEY]');

  // Unexpected errors – don't leak internal details
  console.error('Unhandled error:', safeMessage);
  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'development' ? safeMessage : 'Internal server error',
  });
};

module.exports = errorHandler;
