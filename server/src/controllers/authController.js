const bcrypt = require('bcryptjs');
const User = require('../models/User');
const LoginActivity = require('../models/LoginActivity');
const ApiError = require('../utils/ApiError');
const tokenService = require('../services/tokenService');
const emailService = require('../services/emailService');
const crypto = require('crypto');
const AdminInvitation = require('../models/AdminInvitation');
const AdminAuditLog = require('../models/AdminAuditLog');

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? (process.env.COOKIE_SAMESITE || 'none') : 'lax',
  path: '/',
};

const setTokenCookies = (res, accessToken, refreshToken) => {
  res.cookie('accessToken', accessToken, { ...COOKIE_OPTS, maxAge: 15 * 60 * 1000 });
  res.cookie('refreshToken', refreshToken, { ...COOKIE_OPTS, maxAge: 7 * 24 * 60 * 60 * 1000 });
};

const clearTokenCookies = (res) => {
  res.clearCookie('accessToken', COOKIE_OPTS);
  res.clearCookie('refreshToken', COOKIE_OPTS);
};

// ─── Register ─────────────────────────────────────────────────────────────────
exports.register = async (req, res, next) => {
  try {
    const { username, email, password, displayName } = req.body;

    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing) {
      throw ApiError.conflict(
        existing.email === email ? 'Email already in use' : 'Username already taken'
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    // In development mode, auto-verify so testing is seamless without mandatory SMTP
    const isDev = process.env.NODE_ENV !== 'production';
    const user = await User.create({
      username,
      email,
      passwordHash,
      displayName: displayName || username,
      isVerified: isDev,
    });

    // Email verification token
    const token = await tokenService.createEmailVerificationToken(user._id);
    await emailService.sendVerificationEmail(user.email, user.username, token, user._id);

    res.status(201).json({
      success: true,
      message: 'Registration successful. Please check your email to verify your account.',
      data: { userId: user._id },
    });
  } catch (err) {
    next(err);
  }
};

// ─── Login ────────────────────────────────────────────────────────────────────
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'] || 'unknown';

    const user = await User.findOne({ email }).select('+passwordHash');
    const passwordMatch = user ? await bcrypt.compare(password, user.passwordHash) : false;

    // Log login attempt
    if (user) {
      await LoginActivity.create({
        user: user._id,
        ip,
        userAgent,
        success: passwordMatch,
        failureReason: !passwordMatch ? 'wrong_password' : null,
      });
    }

    if (!user || !passwordMatch) {
      throw ApiError.unauthorized('Invalid email or password');
    }
    if (!user.isVerified) {
      throw ApiError.forbidden('Please verify your email before logging in');
    }
    if (!user.isActive) {
      throw ApiError.forbidden('Your account has been suspended. Please contact support.');
    }

    // Update last login
    user.lastLoginAt = new Date();
    await user.save();

    const accessToken = tokenService.signAccessToken(user._id, user.role);
    const refreshToken = await tokenService.issueRefreshToken(user._id, ip, userAgent);
    setTokenCookies(res, accessToken, refreshToken);

    // Admin login notification (email + real-time socket done in route layer via hook)
    if (user.role === 'admin') {
      emailService
        .sendAdminLoginAlert(user.email, user.username, ip, userAgent)
        .catch(console.error);
    }

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          _id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
          displayName: user.displayName,
          isVerified: user.isVerified,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── Accept administrator invitation ─────────────────────────────────────────
exports.acceptAdminInvitation = async (req, res, next) => {
  try {
    const { token, username, password, displayName } = req.body;
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const invitation = await AdminInvitation.findOne({
      tokenHash,
      expiresAt: { $gt: new Date() },
      acceptedAt: null,
      revokedAt: null,
    }).select('+tokenHash');

    if (!invitation) throw ApiError.badRequest('Invitation is invalid, expired, or already used');
    if (await User.exists({ $or: [{ email: invitation.email }, { username }] })) {
      throw ApiError.conflict('Email or username is already in use');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      username,
      email: invitation.email,
      passwordHash,
      displayName: displayName || username,
      role: 'admin',
      isVerified: true,
    });

    invitation.acceptedAt = new Date();
    await invitation.save();
    await AdminAuditLog.create({
      admin: invitation.invitedBy,
      action: 'accept_admin_invitation',
      targetType: 'User',
      targetId: user._id,
      metadata: { email: user.email, invitedBy: invitation.invitedBy },
    });

    res.status(201).json({ success: true, message: 'Administrator account created' });
  } catch (err) {
    next(err);
  }
};

// ─── Refresh ──────────────────────────────────────────────────────────────────
exports.refresh = async (req, res, next) => {
  try {
    const oldToken = req.cookies?.refreshToken;
    if (!oldToken) throw ApiError.unauthorized('No refresh token provided');

    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'] || 'unknown';

    const result = await tokenService.rotateRefreshToken(oldToken, ip, userAgent);
    if (!result) throw ApiError.unauthorized('Invalid or expired refresh token');

    const user = await User.findById(result.userId);
    if (!user || !user.isActive) throw ApiError.forbidden('Account suspended');

    setTokenCookies(res, result.accessToken, result.refreshToken);
    res.json({
      success: true,
      data: {
        user: {
          _id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
          displayName: user.displayName,
          isVerified: user.isVerified,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── Logout ───────────────────────────────────────────────────────────────────
exports.logout = async (req, res, next) => {
  try {
    await tokenService.revokeAllSessions(req.user._id);
    clearTokenCookies(res);
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
};

// ─── Verify Email ─────────────────────────────────────────────────────────────
exports.verifyEmail = async (req, res, next) => {
  try {
    let { userId, email, token } = req.body;
    if (!userId && email) {
      const u = await User.findOne({ email });
      if (u) userId = u._id;
    }
    if (!userId || !token) throw ApiError.badRequest('Invalid or missing verification parameters');

    const valid = await tokenService.verifyEmailToken(userId, token);
    if (!valid) throw ApiError.badRequest('Invalid or expired verification link');

    await User.findByIdAndUpdate(userId, { isVerified: true });
    res.json({ success: true, message: 'Email verified successfully. You can now log in.' });
  } catch (err) {
    next(err);
  }
};

// ─── Resend Verification ──────────────────────────────────────────────────────
exports.resendVerification = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    // Always respond generically to prevent enumeration
    if (user && !user.isVerified) {
      const token = await tokenService.createEmailVerificationToken(user._id);
      await emailService.sendVerificationEmail(user.email, user.username, token, user._id);
    }

    res.json({
      success: true,
      message: 'If your email is registered and unverified, a new link has been sent.',
    });
  } catch (err) {
    next(err);
  }
};

// ─── Forgot Password ──────────────────────────────────────────────────────────
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (user) {
      const token = await tokenService.createPasswordResetToken(user._id);
      await emailService.sendPasswordResetEmail(user.email, user.username, token, user._id);
    }

    res.json({
      success: true,
      message: 'If your email is registered, a password reset link has been sent.',
    });
  } catch (err) {
    next(err);
  }
};

// ─── Reset Password ───────────────────────────────────────────────────────────
exports.resetPassword = async (req, res, next) => {
  try {
    const { userId, token, password } = req.body;
    const valid = await tokenService.verifyPasswordResetToken(userId, token);
    if (!valid) throw ApiError.badRequest('Invalid or expired password reset link');

    const passwordHash = await bcrypt.hash(password, 12);
    await User.findByIdAndUpdate(userId, { passwordHash });
    await tokenService.revokeAllSessions(userId); // invalidate all sessions

    res.json({ success: true, message: 'Password reset successfully. Please log in.' });
  } catch (err) {
    next(err);
  }
};

// ─── Me ───────────────────────────────────────────────────────────────────────
exports.me = async (req, res) => {
  res.json({ success: true, data: { user: req.user } });
};
