const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createPostSchema, updatePostSchema, createCommentSchema } = require('../validators/postValidators');
const { uploadPostMedia } = require('../services/mediaService');

// ─── Static / Discovery Endpoints (Registered before /:id) ───────────────────
router.get('/trending-tags', authenticate, postController.getTrendingTags);
router.get('/mentions/search', authenticate, postController.searchMentions);
router.get('/user/:userId', authenticate, postController.getUserPosts);

// ─── Feed & Post CRUD ────────────────────────────────────────────────────────
router.get('/', authenticate, postController.getFeed);
router.get('/:id', authenticate, postController.getPost);
router.post('/', authenticate, uploadPostMedia.array('images', 4), validate(createPostSchema), postController.createPost);
router.put('/:id', authenticate, validate(updatePostSchema), postController.updatePost);
router.delete('/:id', authenticate, postController.deletePost);

// ─── Interactions: Likes & Bookmarks ──────────────────────────────────────────
router.post('/:id/like', authenticate, postController.toggleLike);
router.post('/:id/bookmark', authenticate, postController.toggleBookmark);

// ─── Comments ─────────────────────────────────────────────────────────────────
router.get('/:id/comments', authenticate, postController.getComments);
router.post('/:id/comments', authenticate, validate(createCommentSchema), postController.addComment);
router.delete('/:postId/comments/:commentId', authenticate, postController.deleteComment);

module.exports = router;
