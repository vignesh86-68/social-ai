const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const postController = require('../controllers/postController');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { updateProfileSchema } = require('../validators/postValidators');

// IMPORTANT: specific literal paths must precede wildcard params
router.patch(
  '/me/profile',
  authenticate,
  userController.upload.single('avatar'),
  userController.updateProfile
);

router.get('/:userId', authenticate, userController.getProfile);
router.get('/:userId/posts', authenticate, postController.getUserPosts);
router.post('/:userId/follow', authenticate, userController.toggleFollow);
router.get('/:userId/followers', authenticate, userController.getFollowers);
router.get('/:userId/following', authenticate, userController.getFollowing);
router.get('/:userId/follow-status', authenticate, userController.getFollowStatus);

module.exports = router;
