const User = require('../models/User');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const LoginActivity = require('../models/LoginActivity');
const AdminAuditLog = require('../models/AdminAuditLog');
const Notification = require('../models/Notification');
const ApiError = require('../utils/ApiError');
const crypto = require('crypto');
const AdminInvitation = require('../models/AdminInvitation');
const emailService = require('../services/emailService');

// ─── Dashboard Stats ──────────────────────────────────────────────────────────
exports.getStats = async (req, res, next) => {
  try {
    const [
      totalUsers,
      verifiedUsers,
      unverifiedUsers,
      totalPosts,
      totalComments,
      activeUsers,
      suspendedUsers,
      newUsers,
      engagement,
      recentUsers,
      recentLogins,
      recentAdminActivity,
    ] = await Promise.all([
      User.countDocuments({ role: 'user' }),
      User.countDocuments({ role: 'user', isVerified: true }),
      User.countDocuments({ role: 'user', isVerified: false }),
      Post.countDocuments(),
      Comment.countDocuments(),
      User.countDocuments({ role: 'user', isActive: true }),
      User.countDocuments({ role: 'user', isActive: false }),
      User.countDocuments({ role: 'user', createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }),
      Post.aggregate([
        { $group: { _id: null, likes: { $sum: '$likesCount' }, comments: { $sum: '$commentsCount' } } },
      ]),
      User.find({ role: 'user' })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('username email avatar createdAt isVerified'),
      LoginActivity.find({ success: true })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('user', 'username email role'),
      AdminAuditLog.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('admin', 'username email'),
    ]);

    res.json({
      success: true,
      data: {
        stats: {
          totalUsers,
          verifiedUsers,
          unverifiedUsers,
          activeUsers,
          suspendedUsers,
          newUsers,
          totalPosts,
          totalComments,
          engagement: engagement[0] || { likes: 0, comments: 0 },
        },
        recentUsers,
        recentLogins,
        recentAdminActivity,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── List Users ───────────────────────────────────────────────────────────────
exports.getUsers = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;
    const search = req.query.search || '';

    const filter = {};
    if (search) {
      filter.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: { users, pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
    });
  } catch (err) {
    next(err);
  }
};

// ─── Suspend User ─────────────────────────────────────────────────────────────
exports.suspendUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) throw ApiError.notFound('User not found');
    if (user.role === 'admin') throw ApiError.forbidden('Cannot suspend an admin');

    user.isActive = false;
    user.suspendedAt = new Date();
    user.suspendedReason = req.body.reason || 'Policy violation';
    await user.save();

    await AdminAuditLog.create({
      admin: req.user._id,
      action: 'suspend_user',
      targetType: 'User',
      targetId: user._id,
      metadata: { reason: user.suspendedReason },
    });

    res.json({ success: true, message: 'User suspended' });
  } catch (err) {
    next(err);
  }
};

// ─── Reactivate User ──────────────────────────────────────────────────────────
exports.reactivateUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { isActive: true, suspendedAt: null, suspendedReason: null },
      { new: true }
    );
    if (!user) throw ApiError.notFound('User not found');

    await AdminAuditLog.create({
      admin: req.user._id,
      action: 'reactivate_user',
      targetType: 'User',
      targetId: user._id,
      metadata: {},
    });

    res.json({ success: true, message: 'User reactivated' });
  } catch (err) {
    next(err);
  }
};

// ─── Admin Delete Post ────────────────────────────────────────────────────────
exports.deletePost = async (req, res, next) => {
  try {
    const post = await Post.findByIdAndDelete(req.params.postId);
    if (!post) throw ApiError.notFound('Post not found');

    await Comment.deleteMany({ post: post._id });
    await AdminAuditLog.create({
      admin: req.user._id,
      action: 'delete_post',
      targetType: 'Post',
      targetId: post._id,
      metadata: { authorId: post.author },
    });

    res.json({ success: true, message: 'Post deleted by admin' });
  } catch (err) {
    next(err);
  }
};

// ─── Admin Delete Comment ─────────────────────────────────────────────────────
exports.deleteComment = async (req, res, next) => {
  try {
    const comment = await Comment.findByIdAndDelete(req.params.commentId);
    if (!comment) throw ApiError.notFound('Comment not found');

    await Post.findByIdAndUpdate(comment.post, { $inc: { commentsCount: -1 } });
    await AdminAuditLog.create({
      admin: req.user._id,
      action: 'delete_comment',
      targetType: 'Comment',
      targetId: comment._id,
      metadata: { postId: comment.post },
    });

    res.json({ success: true, message: 'Comment deleted by admin' });
  } catch (err) {
    next(err);
  }
};

// ─── Audit Logs ───────────────────────────────────────────────────────────────
exports.getAuditLogs = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      AdminAuditLog.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('admin', 'username email'),
      AdminAuditLog.countDocuments(),
    ]);

    res.json({
      success: true,
      data: { logs, pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
    });
  } catch (err) {
    next(err);
  }
};

// ─── All Posts (Admin view) ───────────────────────────────────────────────────
exports.getAllPosts = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const [posts, total] = await Promise.all([
      Post.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('author', 'username email avatar'),
      Post.countDocuments(),
    ]);

    res.json({
      success: true,
      data: { posts, pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
    });
  } catch (err) {
    next(err);
  }
};

exports.createInvitation = async (req, res, next) => {
  try {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const invitation = await AdminInvitation.create({
      email: req.body.email,
      tokenHash: crypto.createHash('sha256').update(rawToken).digest('hex'),
      invitedBy: req.user._id,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    await emailService.sendAdminInvitationEmail(invitation.email, rawToken);
    await AdminAuditLog.create({
      admin: req.user._id,
      action: 'invite_admin',
      targetType: 'System',
      metadata: { email: invitation.email, invitationId: invitation._id },
    });
    res.status(201).json({
      success: true,
      data: { invitation: { _id: invitation._id, email: invitation.email, expiresAt: invitation.expiresAt } },
    });
  } catch (err) {
    next(err);
  }
};

exports.getInvitations = async (req, res, next) => {
  try {
    const invitations = await AdminInvitation.find()
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('invitedBy', 'username email');
    res.json({ success: true, data: { invitations } });
  } catch (err) {
    next(err);
  }
};

exports.revokeInvitation = async (req, res, next) => {
  try {
    const invitation = await AdminInvitation.findByIdAndUpdate(
      req.params.invitationId,
      { revokedAt: new Date() },
      { new: true }
    );
    if (!invitation) throw ApiError.notFound('Invitation not found');
    await AdminAuditLog.create({
      admin: req.user._id,
      action: 'revoke_admin_invitation',
      targetType: 'System',
      metadata: { invitationId: invitation._id, email: invitation.email },
    });
    res.json({ success: true, message: 'Invitation revoked' });
  } catch (err) {
    next(err);
  }
};
