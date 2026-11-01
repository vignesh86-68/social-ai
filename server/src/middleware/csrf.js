const crypto = require('crypto');
const ApiError = require('../utils/ApiError');
const { isOriginAllowed } = require('../config/cors');

const CSRF_COOKIE = 'csrfToken';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const createToken = () => {
  const value = crypto.randomBytes(32).toString('hex');
  const secret = process.env.COOKIE_SECRET;
  if (!secret) throw new Error('COOKIE_SECRET must be configured for CSRF protection');
  const signature = crypto.createHmac('sha256', secret).update(value).digest('hex');
  return `${value}.${signature}`;
};

const issueCsrfToken = (req, res) => {
  const token = createToken();
  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? (process.env.COOKIE_SAMESITE || 'none') : 'lax',
    path: '/',
    maxAge: 24 * 60 * 60 * 1000,
  });
  res.json({ success: true, data: { csrfToken: token } });
};

const validToken = (token) => {
  if (!token || typeof token !== 'string') return false;
  const separator = token.indexOf('.');
  if (separator <= 0) return false;
  const value = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  const secret = process.env.COOKIE_SECRET;
  if (!secret || !/^[a-f0-9]{64}$/.test(value) || !/^[a-f0-9]{64}$/.test(signature)) return false;
  const expected = crypto.createHmac('sha256', secret).update(value).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
};

const csrfProtection = (req, res, next) => {
  if (process.env.NODE_ENV === 'test' || SAFE_METHODS.has(req.method)) return next();

  const origin = req.get('origin');
  if (origin && !isOriginAllowed(origin)) {
    return next(ApiError.forbidden('Request origin is not allowed'));
  }

  const token = req.get('x-csrf-token');
  if (!validToken(token) || token !== req.cookies?.[CSRF_COOKIE]) {
    return next(ApiError.forbidden('CSRF validation failed'));
  }
  next();
};

module.exports = { csrfProtection, issueCsrfToken };
