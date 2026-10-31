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

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'cover') cb(null, COVERS_DIR);
    else cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${req.user._id}-${Date.now()}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new ApiError(400, 'Only JPEG, PNG, WEBP, and GIF images are allowed'));
};

exports.upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

// ─── Get Profile ──────────────────────────────────────────────────────────────
exports.getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.userId).select(
      '-passwordHash -suspendedReason'
    );
    if (!user) throw ApiError.notFound('User not found');

    let isFollowing = false;
    let followsYou = false;

    if (req.user && req.user._id.toString() !== req.params.userId.toString()) {
      const [f1, f2] = await Promise.all([
        Follow.findOne({ follower: req.user._id, following: req.params.userId }),
        Follow.findOne({ follower: req.params.userId, following: req.user._id }),
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

    const updates = {};
    if (displayName !== undefined) updates.displayName = displayName;
    if (bio !== undefined) updates.bio = bio;
    if (location !== undefined) updates.location = location;
    if (website !== undefined) updates.website = website;
    if (coverImage !== undefined) updates.coverImage = coverImage;

    // Handle avatar file upload
    if (req.file) {
      updates.avatar = `/uploads/avatars/${req.file.filename}`;
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

// ─── Toggle Follow / Unfollow ─────────────────────────────────────────────────
exports.toggleFollow = async (req, res, next) => {
  try {
    const targetUserId = req.params.userId;
    if (targetUserId.toString() === req.user._id.toString()) {
      throw ApiError.badRequest('You cannot follow yourself');
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) throw ApiError.notFound('User not found');

    const existingFollow = await Follow.findOne({
      follower: req.user._id,
      following: targetUserId,
    });

    let isFollowing = false;

    if (existingFollow) {
      // Unfollow
      await Follow.deleteOne({ _id: existingFollow._id });
      await Promise.all([
        User.findByIdAndUpdate(req.user._id, { $inc: { followingCount: -1 } }),
        User.findByIdAndUpdate(targetUserId, { $inc: { followersCount: -1 } }),
        Notification.deleteOne({
          type: 'follow',
          sender: req.user._id,
          recipient: targetUserId,
        }),
      ]);
      isFollowing = false;
    } else {
      // Follow
      await Follow.create({
        follower: req.user._id,
        following: targetUserId,
      });
      await Promise.all([
        User.findByIdAndUpdate(req.user._id, { $inc: { followingCount: 1 } }),
        User.findByIdAndUpdate(targetUserId, { $inc: { followersCount: 1 } }),
      ]);

      // Emit follow notification
      const notif = await Notification.create({
        recipient: targetUserId,
        sender: req.user._id,
        type: 'follow',
        message: `${req.user.displayName || req.user.username} started following you`,
      });

      req.app.get('io')?.to(targetUserId.toString()).emit('notification', notif);
      isFollowing = true;
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
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const [follows, total] = await Promise.all([
      Follow.find({ following: req.params.userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('follower', 'username displayName avatar bio followersCount'),
      Follow.countDocuments({ following: req.params.userId }),
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
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const [follows, total] = await Promise.all([
      Follow.find({ follower: req.params.userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('following', 'username displayName avatar bio followersCount'),
      Follow.countDocuments({ follower: req.params.userId }),
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
