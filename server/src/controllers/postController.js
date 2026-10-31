const Post = require('../models/Post');
const Comment = require('../models/Comment');
const Like = require('../models/Like');
const Notification = require('../models/Notification');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');

// ─── Get Feed ─────────────────────────────────────────────────────────────────
exports.getFeed = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(20, parseInt(req.query.limit) || 10);
    const skip = (page - 1) * limit;

    const [posts, total] = await Promise.all([
      Post.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('author', 'username displayName avatar'),
      Post.countDocuments(),
    ]);

    // If authenticated, check which posts the user liked
    let likedPostIds = new Set();
    if (req.user) {
      const likes = await Like.find({
        post: { $in: posts.map((p) => p._id) },
        user: req.user._id,
      }).select('post');
      likedPostIds = new Set(likes.map((l) => l.post.toString()));
    }

    const data = posts.map((p) => ({
      ...p.toObject(),
      isLikedByMe: likedPostIds.has(p._id.toString()),
    }));

    res.json({
      success: true,
      data: { posts: data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
    });
  } catch (err) {
    next(err);
  }
};

// ─── Get Single Post ──────────────────────────────────────────────────────────
exports.getPost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id).populate(
      'author',
      'username displayName avatar'
    );
    if (!post) throw ApiError.notFound('Post not found');
    res.json({ success: true, data: { post } });
  } catch (err) {
    next(err);
  }
};

// ─── Create Post ──────────────────────────────────────────────────────────────
exports.createPost = async (req, res, next) => {
  try {
    const { content } = req.body;
    const post = await Post.create({ author: req.user._id, content });
    await User.findByIdAndUpdate(req.user._id, { $inc: { postsCount: 1 } });
    const populated = await post.populate('author', 'username displayName avatar');
    res.status(201).json({ success: true, data: { post: populated } });
  } catch (err) {
    next(err);
  }
};

// ─── Update Post ──────────────────────────────────────────────────────────────
exports.updatePost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) throw ApiError.notFound('Post not found');
    if (post.author.toString() !== req.user._id.toString()) throw ApiError.forbidden();

    post.content = req.body.content;
    post.isEdited = true;
    post.editedAt = new Date();
    await post.save();

    const populated = await post.populate('author', 'username displayName avatar');
    res.json({ success: true, data: { post: populated } });
  } catch (err) {
    next(err);
  }
};

// ─── Delete Post ──────────────────────────────────────────────────────────────
exports.deletePost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) throw ApiError.notFound('Post not found');
    // Allow admin or owner
    if (post.author.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      throw ApiError.forbidden();
    }
    await Promise.all([
      Post.deleteOne({ _id: post._id }),
      Comment.deleteMany({ post: post._id }),
      Like.deleteMany({ post: post._id }),
      Notification.deleteMany({ post: post._id }),
      User.findByIdAndUpdate(post.author, { $inc: { postsCount: -1 } }),
    ]);
    res.json({ success: true, message: 'Post deleted' });
  } catch (err) {
    next(err);
  }
};

// ─── Like / Unlike ────────────────────────────────────────────────────────────
exports.toggleLike = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) throw ApiError.notFound('Post not found');

    const existing = await Like.findOne({ post: post._id, user: req.user._id });
    let liked;

    if (existing) {
      await Like.deleteOne({ _id: existing._id });
      await Post.findByIdAndUpdate(post._id, { $inc: { likesCount: -1 } });
      await Notification.deleteOne({
        type: 'like',
        sender: req.user._id,
        post: post._id,
      });
      liked = false;
    } else {
      await Like.create({ post: post._id, user: req.user._id });
      await Post.findByIdAndUpdate(post._id, { $inc: { likesCount: 1 } });

      // Create notification if not liking own post
      if (post.author.toString() !== req.user._id.toString()) {
        const notif = await Notification.create({
          recipient: post.author,
          sender: req.user._id,
          type: 'like',
          post: post._id,
          message: `${req.user.displayName || req.user.username} liked your post`,
        });
        // Emit via socket (attached in app.js)
        req.app.get('io')?.to(post.author.toString()).emit('notification', notif);
      }
      liked = true;
    }

    const updatedPost = await Post.findById(post._id).select('likesCount');
    res.json({ success: true, data: { liked, likesCount: updatedPost.likesCount } });
  } catch (err) {
    next(err);
  }
};

// ─── Get Comments ─────────────────────────────────────────────────────────────
exports.getComments = async (req, res, next) => {
  try {
    const comments = await Comment.find({ post: req.params.id })
      .sort({ createdAt: 1 })
      .populate('author', 'username displayName avatar');
    res.json({ success: true, data: { comments } });
  } catch (err) {
    next(err);
  }
};

// ─── Add Comment ──────────────────────────────────────────────────────────────
exports.addComment = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) throw ApiError.notFound('Post not found');

    const comment = await Comment.create({
      post: post._id,
      author: req.user._id,
      content: req.body.content,
    });
    await Post.findByIdAndUpdate(post._id, { $inc: { commentsCount: 1 } });

    const populated = await comment.populate('author', 'username displayName avatar');

    // Notify post owner (if not commenting on own post)
    if (post.author.toString() !== req.user._id.toString()) {
      const notif = await Notification.create({
        recipient: post.author,
        sender: req.user._id,
        type: 'comment',
        post: post._id,
        comment: comment._id,
        message: `${req.user.displayName || req.user.username} commented on your post`,
      });
      req.app.get('io')?.to(post.author.toString()).emit('notification', notif);
    }

    res.status(201).json({ success: true, data: { comment: populated } });
  } catch (err) {
    next(err);
  }
};

// ─── Delete Comment ───────────────────────────────────────────────────────────
exports.deleteComment = async (req, res, next) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) throw ApiError.notFound('Comment not found');
    if (comment.author.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      throw ApiError.forbidden();
    }
    await Comment.deleteOne({ _id: comment._id });
    await Post.findByIdAndUpdate(comment.post, { $inc: { commentsCount: -1 } });
    res.json({ success: true, message: 'Comment deleted' });
  } catch (err) {
    next(err);
  }
};

// ─── Get User Posts ───────────────────────────────────────────────────────────
exports.getUserPosts = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(20, parseInt(req.query.limit) || 10);
    const skip = (page - 1) * limit;

    const [posts, total] = await Promise.all([
      Post.find({ author: req.params.userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('author', 'username displayName avatar'),
      Post.countDocuments({ author: req.params.userId }),
    ]);

    res.json({
      success: true,
      data: { posts, pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
    });
  } catch (err) {
    next(err);
  }
};
