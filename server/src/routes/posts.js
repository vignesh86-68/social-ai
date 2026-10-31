const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createPostSchema, updatePostSchema, createCommentSchema } = require('../validators/postValidators');

// Feed – accessible to authenticated users (optionally public)
router.get('/', authenticate, postController.getFeed);
router.get('/:id', authenticate, postController.getPost);
router.post('/', authenticate, validate(createPostSchema), postController.createPost);
router.put('/:id', authenticate, validate(updatePostSchema), postController.updatePost);
router.delete('/:id', authenticate, postController.deletePost);

// Likes
router.post('/:id/like', authenticate, postController.toggleLike);

// Comments
router.get('/:id/comments', authenticate, postController.getComments);
router.post('/:id/comments', authenticate, validate(createCommentSchema), postController.addComment);
router.delete('/:id/comments/:commentId', authenticate, postController.deleteComment);

module.exports = router;
