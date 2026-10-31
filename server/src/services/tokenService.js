const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const RefreshSession = require('../models/RefreshSession');
const EmailVerificationToken = require('../models/EmailVerificationToken');
const PasswordResetToken = require('../models/PasswordResetToken');

/**
 * Issue a short-lived access JWT (15 min default)
 */
const signAccessToken = (userId, role) =>
  jwt.sign({ userId, role }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  });

/**
 * Issue a long-lived refresh JWT and persist a hashed version in the DB.
 */
const issueRefreshToken = async (userId, ip, userAgent) => {
  const token = jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });
  const tokenHash = await bcrypt.hash(token, 10);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await RefreshSession.create({ user: userId, tokenHash, ip, userAgent, expiresAt });
  return token;
};

/**
 * Verify a refresh token and rotate it (old session revoked, new one issued).
 */
const rotateRefreshToken = async (oldToken, ip, userAgent) => {
  let decoded;
  try {
    decoded = jwt.verify(oldToken, process.env.JWT_REFRESH_SECRET);
  } catch {
    return null;
  }

  const sessions = await RefreshSession.find({
    user: decoded.userId,
    isRevoked: false,
  }).select('+tokenHash');

  let matchedSession = null;
  for (const s of sessions) {
    const match = await bcrypt.compare(oldToken, s.tokenHash);
    if (match) { matchedSession = s; break; }
  }

  if (!matchedSession) return null;

  // Revoke old session
  matchedSession.isRevoked = true;
  await matchedSession.save();

  // Issue new tokens
  const newRefreshToken = await issueRefreshToken(decoded.userId, ip, userAgent);
  const newAccessToken = signAccessToken(decoded.userId, decoded.role);

  return { userId: decoded.userId, accessToken: newAccessToken, refreshToken: newRefreshToken };
};

/**
 * Revoke all sessions for a user (logout from all devices).
 */
const revokeAllSessions = (userId) =>
  RefreshSession.updateMany({ user: userId, isRevoked: false }, { isRevoked: true });

/**
 * Create a cryptographically random email verification token, hashed for storage.
 */
const createEmailVerificationToken = async (userId) => {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = await bcrypt.hash(rawToken, 10);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await EmailVerificationToken.deleteMany({ user: userId }); // one token at a time
  await EmailVerificationToken.create({ user: userId, tokenHash, expiresAt });
  return rawToken;
};

/**
 * Verify the email token and return the userId if valid.
 */
const verifyEmailToken = async (userId, rawToken) => {
  const record = await EmailVerificationToken.findOne({ user: userId }).select('+tokenHash');
  if (!record) return false;
  if (record.expiresAt < new Date()) return false;
  const valid = await bcrypt.compare(rawToken, record.tokenHash);
  if (valid) await EmailVerificationToken.deleteMany({ user: userId });
  return valid;
};

/**
 * Create a password reset token.
 */
const createPasswordResetToken = async (userId) => {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = await bcrypt.hash(rawToken, 10);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await PasswordResetToken.deleteMany({ user: userId });
  await PasswordResetToken.create({ user: userId, tokenHash, expiresAt });
  return rawToken;
};

/**
 * Verify password reset token.
 */
const verifyPasswordResetToken = async (userId, rawToken) => {
  const record = await PasswordResetToken.findOne({ user: userId }).select('+tokenHash');
  if (!record) return false;
  if (record.expiresAt < new Date()) return false;
  const valid = await bcrypt.compare(rawToken, record.tokenHash);
  if (valid) await PasswordResetToken.deleteMany({ user: userId });
  return valid;
};

module.exports = {
  signAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
  revokeAllSessions,
  createEmailVerificationToken,
  verifyEmailToken,
  createPasswordResetToken,
  verifyPasswordResetToken,
};
