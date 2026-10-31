const rateLimit = require('express-rate-limit');

const createLimiter = (windowMs, max, message) =>
  rateLimit({
    windowMs,
    max,
    message: { success: false, message },
    standardHeaders: true,
    legacyHeaders: false,
  });

// General API limiter
const apiLimiter = createLimiter(
  15 * 60 * 1000, // 15 min
  200,
  'Too many requests from this IP, please try again later.'
);

// Strict limiter for auth endpoints (brute-force protection)
const authLimiter = createLimiter(
  15 * 60 * 1000,
  10,
  'Too many authentication attempts. Please wait 15 minutes before trying again.'
);

// AI endpoints – prevent excessive API spend
const aiLimiter = createLimiter(
  60 * 1000, // 1 min
  5,
  'AI request limit reached. Please wait a moment before making another request.'
);

// Password reset – very strict
const passwordResetLimiter = createLimiter(
  60 * 60 * 1000, // 1 hour
  3,
  'Too many password reset requests. Please try again in 1 hour.'
);

module.exports = { apiLimiter, authLimiter, aiLimiter, passwordResetLimiter };
