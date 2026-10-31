const mongoose = require('mongoose');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const Like = require('../models/Like');
const Follow = require('../models/Follow');
const Bookmark = require('../models/Bookmark');
const Notification = require('../models/Notification');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { extractHashtags, extractMentions } = require('../utils/hashtagUtils');
const { processAndSaveImage } = require('../services/mediaService');

/**
 * Helper to retrieve IDs of inactive/suspended users to exclude from all public feeds
 */
const getSuspendedUserIds = async () => {
  const suspended = await User.find({ $or: [{ isActive: false }, { isSuspended: true }] }).select('_id');
  return suspended.map((u) => u._id);
};

// ─── Four Intelligent Feed Systems ───────────────────────────────────────────
exports.getFeed = async (req, res, next) => {
  try {
    const tab = req.query.tab || 'latest'; // 'latest' | 'following' | 'trending' | 'for-you'
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(30, parseInt(req.query.limit) || 10);
    const skip = (page - 1) * limit;
    const tag = req.query.tag?.toLowerCase()?.replace(/^#/, '');
    const search = req.query.search?.trim();

    const suspendedIds = await getSuspendedUserIds();
    const baseFilter = { author: { $nin: suspendedIds } };

    if (tag) {
      baseFilter.hashtags = tag;
    }

    if (search) {
      baseFilter.$or = [
        { content: { $regex: search, $options: 'i' } },
        { hashtags: { $regex: search, $options: 'i' } },
      ];
    }

    let posts = [];
    let total = 0;

    // ──────────────────────────────────────────────────────────────────────────
    // FEED A: FOLLOWING (Posts from followed accounts only)
    // ──────────────────────────────────────────────────────────────────────────
    if (tab === 'following') {
      if (!req.user) throw ApiError.unauthorized('Please sign in to view your following feed');

      const followRecords = await Follow.find({ follower: req.user._id }).select('following');
      const followingIds = followRecords
        .map((f) => f.following)
        .filter((id) => !suspendedIds.some((s) => s.equals(id)));

      if (followingIds.length === 0) {
        return res.json({
          success: true,
          data: {
            posts: [],
            pagination: { page, limit, total: 0, pages: 0 },
            isFollowingEmpty: true,
          },
        });
      }

      const followingFilter = { ...baseFilter, author: { $in: followingIds } };
      [posts, total] = await Promise.all([
        Post.find(followingFilter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('author', 'username displayName avatar bio'),
        Post.countDocuments(followingFilter),
      ]);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // FEED B: TRENDING (Documented Engagement Algorithm)
    // Formula: Score = (Likes * 2 + Comments * 3) / (AgeInHours + 2)^1.5
    // ──────────────────────────────────────────────────────────────────────────
    else if (tab === 'trending') {
      const now = new Date();
      // Match posts from the last 14 days
      const windowStart = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      const trendingMatch = {
        ...baseFilter,
        createdAt: { $gte: windowStart },
      };

      const pipeline = [
        { $match: trendingMatch },
        {
          $addFields: {
            ageInHours: {
              $divide: [{ $subtract: [now, '$createdAt'] }, 3600000],
            },
          },
        },
        {
          $addFields: {
            trendingScore: {
              $divide: [
                {
                  $add: [
                    { $multiply: ['$likesCount', 2] },
                    { $multiply: ['$commentsCount', 3] },
                  ],
                },
                {
                  $pow: [{ $add: ['$ageInHours', 2] }, 1.5],
                },
              ],
            },
          },
        },
        { $sort: { trendingScore: -1, createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
        {
          $lookup: {
            from: 'users',
            localField: 'author',
            foreignField: '_id',
            as: 'author',
          },
        },
        { $unwind: '$author' },
        {
          $project: {
            'author.passwordHash': 0,
            'author.email': 0,
          },
        },
      ];

      const [trendResults, countResult] = await Promise.all([
        Post.aggregate(pipeline),
        Post.countDocuments(trendingMatch),
      ]);

      posts = trendResults;
      total = countResult;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // FEED C: FOR YOU (Personalized Affinity & Relevance Signals)
    // Boosts posts from accounts followed and tags frequently engaged with
    // ──────────────────────────────────────────────────────────────────────────
    else if (tab === 'for-you' && req.user) {
      const [following, userLikes] = await Promise.all([
        Follow.find({ follower: req.user._id }).select('following'),
        Like.find({ user: req.user._id }).limit(50).populate('post', 'hashtags author'),
      ]);

      const followedIds = new Set(following.map((f) => f.following.toString()));
      const preferredTags = new Set();
      userLikes.forEach((l) => {
        l.post?.hashtags?.forEach((t) => preferredTags.add(t));
      });

      // Fetch candidates from last 30 days
      const candidateFilter = {
        ...baseFilter,
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      };

      const candidates = await Post.find(candidateFilter)
        .sort({ createdAt: -1 })
        .limit(200)
        .populate('author', 'username displayName avatar bio');

      const now = Date.now();
      const scored = candidates.map((p) => {
        const ageHours = Math.max(0, (now - new Date(p.createdAt).getTime()) / 3600000);
        const isFollowed = followedIds.has(p.author?._id?.toString());
        const hasTagMatch = p.hashtags?.some((t) => preferredTags.has(t));

        let affinityBoost = 1.0;
        if (isFollowed) affinityBoost += 0.5; // +50% weight for followed authors
        if (hasTagMatch) affinityBoost += 0.3; // +30% weight for preferred topics

        const engagementBase = (p.likesCount || 0) * 1.5 + (p.commentsCount || 0) * 2 + 1;
        const timeDecay = Math.pow(ageHours + 2, 1.2);
        const forYouScore = (engagementBase * affinityBoost) / timeDecay;

        return { post: p, score: forYouScore };
      });

      scored.sort((a, b) => b.score - a.score);
      posts = scored.slice(skip, skip + limit).map((s) => s.post);
      total = candidates.length;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // FEED D: LATEST (Chronological stream, newest first)
    // ──────────────────────────────────────────────────────────────────────────
    else {
      [posts, total] = await Promise.all([
        Post.find(baseFilter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('author', 'username displayName avatar bio'),
        Post.countDocuments(baseFilter),
      ]);
    }

    // Augment with authenticated user interactions (isLikedByMe, isBookmarkedByMe)
    let likedPostIds = new Set();
    let bookmarkedPostIds = new Set();

    if (req.user && posts.length > 0) {
      const pIds = posts.map((p) => p._id);
      const [likes, bookmarks] = await Promise.all([
        Like.find({ post: { $in: pIds }, user: req.user._id }).select('post'),
        Bookmark.find({ post: { $in: pIds }, user: req.user._id }).select('post'),
      ]);
      likedPostIds = new Set(likes.map((l) => l.post.toString()));
      bookmarkedPostIds = new Set(bookmarks.map((b) => b.post.toString()));
    }

    const data = posts.map((p) => {
      const item = typeof p.toObject === 'function' ? p.toObject() : p;
      const strId = item._id.toString();
      return {
        ...item,
        isLikedByMe: likedPostIds.has(strId),
        isBookmarkedByMe: bookmarkedPostIds.has(strId),
      };
    });

    res.json({
      success: true,
      data: {
        posts: data,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── Get Trending Hashtags ────────────────────────────────────────────────────
exports.getTrendingTags = async (req, res, next) => {
  try {
    const windowStart = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const tags = await Post.aggregate([
      { $match: { createdAt: { $gte: windowStart } } },
      { $unwind: '$hashtags' },
      {
        $group: {
          _id: '$hashtags',
          count: { $sum: 1 },
          totalLikes: { $sum: '$likesCount' },
          totalComments: { $sum: '$commentsCount' },
        },
      },
      {
        $addFields: {
          score: {
            $add: ['$count', { $multiply: ['$totalLikes', 0.5] }, { $multiply: ['$totalComments', 1] }],
          },
        },
      },
      { $sort: { score: -1, count: -1 } },
      { $limit: 10 },
      {
        $project: {
          tag: '$_id',
          count: 1,
          score: 1,
          _id: 0,
        },
      },
    ]);

    res.json({ success: true, data: { tags } });
  } catch (err) {
    next(err);
  }
};

// ─── User Mentions Autocomplete ───────────────────────────────────────────────
exports.searchMentions = async (req, res, next) => {
  try {
    const query = req.query.q?.trim()?.replace(/^@/, '') || '';
    if (!query) {
      return res.json({ success: true, data: { users: [] } });
    }

    const users = await User.find({
      isActive: true,
      $or: [
        { username: { $regex: query, $options: 'i' } },
        { displayName: { $regex: query, $options: 'i' } },
      ],
    })
      .select('username displayName avatar followersCount')
      .limit(8);

    res.json({ success: true, data: { users } });
  } catch (err) {
    next(err);
  }
};

// ─── Create Post with Media, Hashtags & Mentions ──────────────────────────────
exports.createPost = async (req, res, next) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) {
      throw ApiError.badRequest('Post content is required');
    }

    // 1. Process and save uploaded images securely with Sharp
    const processedImages = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const imageInfo = await processAndSaveImage(file.buffer);
        processedImages.push(imageInfo);
      }
    }

    // 2. Extract Hashtags automatically
    const hashtags = extractHashtags(content);

    // 3. Extract and Resolve User Mentions
    const mentionNames = extractMentions(content);
    let mentionUserIds = [];

    if (mentionNames.length > 0) {
      const mentionedUsers = await User.find({
        username: { $in: mentionNames },
        isActive: true,
      }).select('_id username displayName');
      mentionUserIds = mentionedUsers.map((u) => u._id);
    }

    // 4. Create Post in Database
    const post = await Post.create({
      author: req.user._id,
      content: content.trim(),
      images: processedImages,
      mediaUrl: processedImages[0]?.url || null,
      mediaType: processedImages.length > 0 ? 'image' : null,
      hashtags,
      mentions: mentionUserIds,
    });

    await User.findByIdAndUpdate(req.user._id, { $inc: { postsCount: 1 } });
    const populated = await post.populate([
      { path: 'author', select: 'username displayName avatar bio' },
      { path: 'mentions', select: 'username displayName' },
    ]);

    // 5. Dispatch real-time notifications to mentioned users (skipping self-mention)
    for (const mentionedId of mentionUserIds) {
      if (!mentionedId.equals(req.user._id)) {
        const notif = await Notification.create({
          recipient: mentionedId,
          sender: req.user._id,
          type: 'mention',
          post: post._id,
          message: `${req.user.displayName || req.user.username} mentioned you in a post`,
        });
        req.app.get('io')?.to(mentionedId.toString()).emit('notification', notif);
      }
    }

    res.status(201).json({ success: true, data: { post: populated } });
  } catch (err) {
    next(err);
  }
};

// ─── Get Single Post ──────────────────────────────────────────────────────────
exports.getPost = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) throw ApiError.badRequest('Invalid post ID');

    const post = await Post.findById(id).populate([
      { path: 'author', select: 'username displayName avatar bio' },
      { path: 'mentions', select: 'username displayName' },
    ]);
    if (!post) throw ApiError.notFound('Post not found');

    let isLikedByMe = false;
    let isBookmarkedByMe = false;

    if (req.user) {
      const [l, b] = await Promise.all([
        Like.findOne({ post: id, user: req.user._id }),
        Bookmark.findOne({ post: id, user: req.user._id }),
      ]);
      isLikedByMe = !!l;
      isBookmarkedByMe = !!b;
    }

    res.json({
      success: true,
      data: {
        post: {
          ...post.toObject(),
          isLikedByMe,
          isBookmarkedByMe,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── Update Post ──────────────────────────────────────────────────────────────
exports.updatePost = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) throw ApiError.badRequest('Invalid post ID');

    const post = await Post.findById(id);
    if (!post) throw ApiError.notFound('Post not found');

    if (post.author.toString() !== req.user._id.toString()) {
      throw ApiError.forbidden('You are not authorized to edit this post');
    }

    const { content } = req.body;
    if (!content || !content.trim()) throw ApiError.badRequest('Post content cannot be empty');

    post.content = content.trim();
    post.hashtags = extractHashtags(content);
    post.isEdited = true;
    post.editedAt = new Date();
    await post.save();

    const populated = await post.populate('author', 'username displayName avatar bio');
    res.json({ success: true, data: { post: populated } });
  } catch (err) {
    next(err);
  }
};

// ─── Delete Post ──────────────────────────────────────────────────────────────
exports.deletePost = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) throw ApiError.badRequest('Invalid post ID');

    const post = await Post.findById(id);
    if (!post) throw ApiError.notFound('Post not found');

    if (post.author.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      throw ApiError.forbidden('You are not authorized to delete this post');
    }

    await Promise.all([
      Post.deleteOne({ _id: post._id }),
      Comment.deleteMany({ post: post._id }),
      Like.deleteMany({ post: post._id }),
      Bookmark.deleteMany({ post: post._id }),
      Notification.deleteMany({ post: post._id }),
      User.updateOne({ _id: post.author, postsCount: { $gt: 0 } }, { $inc: { postsCount: -1 } }),
    ]);

    res.json({ success: true, message: 'Post and associated data removed' });
  } catch (err) {
    next(err);
  }
};

// ─── Toggle Like ──────────────────────────────────────────────────────────────
exports.toggleLike = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) throw ApiError.badRequest('Invalid post ID');

    const post = await Post.findById(id);
    if (!post) throw ApiError.notFound('Post not found');

    const existing = await Like.findOne({ post: post._id, user: req.user._id });
    let liked = false;

    if (existing) {
      await Like.deleteOne({ _id: existing._id });
      await Post.updateOne({ _id: post._id, likesCount: { $gt: 0 } }, { $inc: { likesCount: -1 } });
      await Notification.deleteMany({ type: 'like', sender: req.user._id, post: post._id });
      liked = false;
    } else {
      try {
        await Like.create({ post: post._id, user: req.user._id });
        await Post.updateOne({ _id: post._id }, { $inc: { likesCount: 1 } });

        if (post.author.toString() !== req.user._id.toString()) {
          const notif = await Notification.create({
            recipient: post.author,
            sender: req.user._id,
            type: 'like',
            post: post._id,
            message: `${req.user.displayName || req.user.username} liked your post`,
          });
          req.app.get('io')?.to(post.author.toString()).emit('notification', notif);
        }
        liked = true;
      } catch (err) {
        if (err.code === 11000) liked = true; // Concurrent idempotent like
        else throw err;
      }
    }

    const updatedPost = await Post.findById(post._id).select('likesCount');
    res.json({ success: true, data: { liked, likesCount: Math.max(0, updatedPost.likesCount) } });
  } catch (err) {
    next(err);
  }
};

// ─── Toggle Bookmark ──────────────────────────────────────────────────────────
exports.toggleBookmark = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) throw ApiError.badRequest('Invalid post ID');

    const post = await Post.findById(id);
    if (!post) throw ApiError.notFound('Post not found');

    const existing = await Bookmark.findOne({ post: post._id, user: req.user._id });
    let isBookmarked = false;

    if (existing) {
      await Bookmark.deleteOne({ _id: existing._id });
      await Post.updateOne({ _id: post._id, bookmarksCount: { $gt: 0 } }, { $inc: { bookmarksCount: -1 } });
      isBookmarked = false;
    } else {
      try {
        await Bookmark.create({ post: post._id, user: req.user._id });
        await Post.updateOne({ _id: post._id }, { $inc: { bookmarksCount: 1 } });
        isBookmarked = true;
      } catch (err) {
        if (err.code === 11000) isBookmarked = true;
        else throw err;
      }
    }

    const updatedPost = await Post.findById(post._id).select('bookmarksCount');
    res.json({
      success: true,
      data: { isBookmarked, bookmarksCount: Math.max(0, updatedPost.bookmarksCount) },
    });
  } catch (err) {
    next(err);
  }
};

// ─── Get Comments ─────────────────────────────────────────────────────────────
exports.getComments = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) throw ApiError.badRequest('Invalid post ID');

    const comments = await Comment.find({ post: id })
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
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) throw ApiError.badRequest('Invalid post ID');

    const post = await Post.findById(id);
    if (!post) throw ApiError.notFound('Post not found');

    const { content } = req.body;
    if (!content || !content.trim()) throw ApiError.badRequest('Comment cannot be empty');

    const comment = await Comment.create({
      post: post._id,
      author: req.user._id,
      content: content.trim(),
    });

    await Post.updateOne({ _id: post._id }, { $inc: { commentsCount: 1 } });
    const populated = await comment.populate('author', 'username displayName avatar');

    // Notify post author if not self-comment
    if (post.author.toString() !== req.user._id.toString()) {
      const notif = await Notification.create({
        recipient: post.author,
        sender: req.user._id,
        type: 'comment',
        post: post._id,
        comment: comment._id,
        message: `${req.user.displayName || req.user.username} commented: "${content.slice(0, 50)}..."`,
      });
      req.app.get('io')?.to(post.author.toString()).emit('notification', notif);
    }

    // Process mentions in comments
    const mentionNames = extractMentions(content);
    if (mentionNames.length > 0) {
      const mentionedUsers = await User.find({ username: { $in: mentionNames }, isActive: true });
      for (const mUser of mentionedUsers) {
        if (!mUser._id.equals(req.user._id) && !mUser._id.equals(post.author)) {
          const mentionNotif = await Notification.create({
            recipient: mUser._id,
            sender: req.user._id,
            type: 'mention',
            post: post._id,
            comment: comment._id,
            message: `${req.user.displayName || req.user.username} mentioned you in a comment`,
          });
          req.app.get('io')?.to(mUser._id.toString()).emit('notification', mentionNotif);
        }
      }
    }

    res.status(201).json({ success: true, data: { comment: populated } });
  } catch (err) {
    next(err);
  }
};

// ─── Delete Comment ───────────────────────────────────────────────────────────
exports.deleteComment = async (req, res, next) => {
  try {
    const { postId, commentId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(postId) || !mongoose.Types.ObjectId.isValid(commentId)) {
      throw ApiError.badRequest('Invalid ID format');
    }

    const comment = await Comment.findById(commentId);
    if (!comment) throw ApiError.notFound('Comment not found');

    const post = await Post.findById(postId);
    const isCommentAuthor = comment.author.toString() === req.user._id.toString();
    const isPostAuthor = post && post.author.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isCommentAuthor && !isPostAuthor && !isAdmin) {
      throw ApiError.forbidden('You are not authorized to delete this comment');
    }

    await Promise.all([
      Comment.deleteOne({ _id: commentId }),
      Post.updateOne({ _id: postId, commentsCount: { $gt: 0 } }, { $inc: { commentsCount: -1 } }),
      Notification.deleteMany({ comment: commentId }),
    ]);

    res.json({ success: true, message: 'Comment deleted' });
  } catch (err) {
    next(err);
  }
};

// ─── Get User Posts ───────────────────────────────────────────────────────────
exports.getUserPosts = async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) throw ApiError.badRequest('Invalid user ID');

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(30, parseInt(req.query.limit) || 10);
    const skip = (page - 1) * limit;

    const [posts, total] = await Promise.all([
      Post.find({ author: userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('author', 'username displayName avatar bio'),
      Post.countDocuments({ author: userId }),
    ]);

    let likedPostIds = new Set();
    let bookmarkedPostIds = new Set();

    if (req.user && posts.length > 0) {
      const pIds = posts.map((p) => p._id);
      const [likes, bookmarks] = await Promise.all([
        Like.find({ post: { $in: pIds }, user: req.user._id }).select('post'),
        Bookmark.find({ post: { $in: pIds }, user: req.user._id }).select('post'),
      ]);
      likedPostIds = new Set(likes.map((l) => l.post.toString()));
      bookmarkedPostIds = new Set(bookmarks.map((b) => b.post.toString()));
    }

    const data = posts.map((p) => ({
      ...p.toObject(),
      isLikedByMe: likedPostIds.has(p._id.toString()),
      isBookmarkedByMe: bookmarkedPostIds.has(p._id.toString()),
    }));

    res.json({
      success: true,
      data: {
        posts: data,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (err) {
    next(err);
  }
};
