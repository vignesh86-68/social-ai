const mongoose = require('mongoose');
const User = require('../models/User');
const Follow = require('../models/Follow');
const Notification = require('../models/Notification');
const ApiError = require('../utils/ApiError');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ─── Multer config for Avatars and Covers ─────────────────────────────────────
const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'avatars');
const COVERS_DIR = path.join(process.cwd(), 'uploads', 'covers');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(COVERS_DIR)) fs.mkdirSync(COVERS_DIR, { recursive: true });

const MIME_TO_EXT = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'cover') cb(null, COVERS_DIR);
    else cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    // SECURITY: strictly derive extension from validated MIME type, never from client filename
    const safeExt = MIME_TO_EXT[file.mimetype] || '.jpg';
    cb(null, `${req.user._id}-${Date.now()}${safeExt}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (MIME_TO_EXT[file.mimetype]) {
    cb(null, true);
  } else {
    cb(new ApiError(400, 'Unsupported format. Only JPEG, PNG, WEBP, and GIF images are allowed.'));
  }
};

exports.upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB hard limit
});

/**
 * SECURITY: Verify magic bytes of the file on disk to prevent disguised scripts (e.g. PHP/HTML)
 */
const isValidImageHeader = (filePath) => {
  try {
    const buffer = Buffer.alloc(8);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 8, 0);
    fs.closeSync(fd);

    // JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true;
    // PNG: 89 50 4E 47
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return true;
    // GIF: 47 49 46 38
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) return true;
    // WEBP: 52 49 46 46 (RIFF)
    if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) return true;

    return false;
  } catch {
    return false;
  }
};

/**
 * SECURITY: Validate safe URL protocol (no javascript:, data:, or vbscript: injection)
 */
const isValidImageUrl = (url) => {
  if (!url || typeof url !== 'string') return true;
  if (url.startsWith('/uploads/')) return true;
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
};

// ─── Get Profile ──────────────────────────────────────────────────────────────
exports.getProfile = async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw ApiError.badRequest('Invalid user ID format');
    }

    const user = await User.findById(userId).select('-passwordHash -suspendedReason');
    if (!user) throw ApiError.notFound('User not found');

    let isFollowing = false;
    let followsYou = false;

    if (req.user && req.user._id.toString() !== userId.toString()) {
      const [f1, f2] = await Promise.all([
        Follow.findOne({ follower: req.user._id, following: userId }),
        Follow.findOne({ follower: userId, following: req.user._id }),
      ]);
      isFollowing = !!f1;
      followsYou = !!f2;
    }

    res.json({
      success: true,
      data: {
        user: {
          ...user.toObject(),
          isFollowing,
          followsYou,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── Update Profile ───────────────────────────────────────────────────────────
exports.updateProfile = async (req, res, next) => {
  try {
    const { displayName, bio, location, website, coverImage } = req.body;

    // Strict whitelist: never allow changing role, email, passwordHash, isVerified, or counters
    const updates = {};
    if (displayName !== undefined) updates.displayName = String(displayName).slice(0, 50).trim();
    if (bio !== undefined) updates.bio = String(bio).slice(0, 300);
    if (location !== undefined) updates.location = String(location).slice(0, 100).trim();
    if (website !== undefined) updates.website = String(website).slice(0, 200).trim();

    if (coverImage !== undefined) {
      if (!isValidImageUrl(coverImage)) {
        throw ApiError.badRequest('Invalid cover image URL. Only HTTP and HTTPS protocols are permitted.');
      }
      updates.coverImage = coverImage;
    }

    // Handle avatar file upload with magic byte verification
    if (req.file) {
      const filePath = req.file.path;
      if (!isValidImageHeader(filePath)) {
        fs.unlink(filePath, () => {});
        throw ApiError.badRequest('Corrupted or invalid image file content. Header verification failed.');
      }

      updates.avatar = `/uploads/avatars/${req.file.filename}`;
      // Clean up previous avatar if stored locally
      const currentUser = await User.findById(req.user._id).select('avatar');
      if (currentUser?.avatar?.startsWith('/uploads/')) {
        const oldPath = path.join(process.cwd(), currentUser.avatar);
        fs.unlink(oldPath, () => {});
      }
    }

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true }).select('-passwordHash');
    res.json({ success: true, data: { user } });
  } catch (err) {
    next(err);
  }
};

// ─── Toggle / Explicit Follow & Unfollow ──────────────────────────────────────
exports.toggleFollow = async (req, res, next) => {
  try {
    const targetUserId = req.params.userId;
    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      throw ApiError.badRequest('Invalid target user ID');
    }

    if (targetUserId.toString() === req.user._id.toString()) {
      throw ApiError.badRequest('You cannot follow yourself');
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) throw ApiError.notFound('User not found');

    if (!targetUser.isActive || targetUser.isSuspended) {
      throw ApiError.forbidden('Cannot follow a suspended or inactive user account');
    }

    const explicitAction = req.body.action; // 'follow' | 'unfollow' | undefined (toggle)

    const existingFollow = await Follow.findOne({
      follower: req.user._id,
      following: targetUserId,
    });

    let isFollowing = false;

    if (existingFollow) {
      // If client explicitly requested 'follow' and is already following: idempotent no-op
      if (explicitAction === 'follow') {
        const currentTarget = await User.findById(targetUserId).select('followersCount');
        return res.json({
          success: true,
          data: { isFollowing: true, followersCount: Math.max(0, currentTarget.followersCount) },
        });
      }

      // Execute Unfollow
      await Follow.deleteOne({ _id: existingFollow._id });
      await Promise.all([
        // Prevent underflow: only decrement if count > 0
        User.updateOne({ _id: req.user._id, followingCount: { $gt: 0 } }, { $inc: { followingCount: -1 } }),
        User.updateOne({ _id: targetUserId, followersCount: { $gt: 0 } }, { $inc: { followersCount: -1 } }),
        Notification.deleteMany({
          type: 'follow',
          sender: req.user._id,
          recipient: targetUserId,
        }),
      ]);
      isFollowing = false;
    } else {
      // If client explicitly requested 'unfollow' and is not following: idempotent no-op (never decrement!)
      if (explicitAction === 'unfollow') {
        const currentTarget = await User.findById(targetUserId).select('followersCount');
        return res.json({
          success: true,
          data: { isFollowing: false, followersCount: Math.max(0, currentTarget.followersCount) },
        });
      }

      // Execute Follow (with concurrency duplicate key protection)
      try {
        await Follow.create({
          follower: req.user._id,
          following: targetUserId,
        });

        await Promise.all([
          User.updateOne({ _id: req.user._id }, { $inc: { followingCount: 1 } }),
          User.updateOne({ _id: targetUserId }, { $inc: { followersCount: 1 } }),
        ]);

        // Create notification only after follow successfully created
        const notif = await Notification.create({
          recipient: targetUserId,
          sender: req.user._id,
          type: 'follow',
          message: `${req.user.displayName || req.user.username} started following you`,
        });

        req.app.get('io')?.to(targetUserId.toString()).emit('notification', notif);
        isFollowing = true;
      } catch (createErr) {
        // Handled race condition: duplicate follow created concurrently by another request
        if (createErr.code === 11000) {
          isFollowing = true;
        } else {
          throw createErr;
        }
      }
    }

    const updatedTarget = await User.findById(targetUserId).select('followersCount');
    res.json({
      success: true,
      data: {
        isFollowing,
        followersCount: Math.max(0, updatedTarget.followersCount),
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── Get Followers ────────────────────────────────────────────────────────────
exports.getFollowers = async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw ApiError.badRequest('Invalid user ID format');
    }

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const [follows, total] = await Promise.all([
      Follow.find({ following: userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('follower', 'username displayName avatar bio followersCount'),
      Follow.countDocuments({ following: userId }),
    ]);

    const followers = follows.map((f) => f.follower).filter(Boolean);

    res.json({
      success: true,
      data: {
        followers,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── Get Following ────────────────────────────────────────────────────────────
exports.getFollowing = async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw ApiError.badRequest('Invalid user ID format');
    }

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const [follows, total] = await Promise.all([
      Follow.find({ follower: userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('following', 'username displayName avatar bio followersCount'),
      Follow.countDocuments({ follower: userId }),
    ]);

    const following = follows.map((f) => f.following).filter(Boolean);

    res.json({
      success: true,
      data: {
        following,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── Check Follow Status ──────────────────────────────────────────────────────
exports.getFollowStatus = async (req, res, next) => {
  try {
    const targetUserId = req.params.userId;
    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      throw ApiError.badRequest('Invalid user ID format');
    }

    if (targetUserId.toString() === req.user._id.toString()) {
      return res.json({ success: true, data: { isFollowing: false, followsYou: false, isSelf: true } });
    }

    const [f1, f2] = await Promise.all([
      Follow.findOne({ follower: req.user._id, following: targetUserId }),
      Follow.findOne({ follower: targetUserId, following: req.user._id }),
    ]);

    res.json({
      success: true,
      data: {
        isFollowing: !!f1,
        followsYou: !!f2,
        isSelf: false,
      },
    });
  } catch (err) {
    next(err);
  }
};
