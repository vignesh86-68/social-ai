const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticate, requireRole } = require('../middleware/auth');

const adminOnly = [authenticate, requireRole('admin')];

router.get('/stats', ...adminOnly, adminController.getStats);
router.get('/users', ...adminOnly, adminController.getUsers);
router.patch('/users/:userId/suspend', ...adminOnly, adminController.suspendUser);
router.patch('/users/:userId/reactivate', ...adminOnly, adminController.reactivateUser);
router.get('/posts', ...adminOnly, adminController.getAllPosts);
router.delete('/posts/:postId', ...adminOnly, adminController.deletePost);
router.delete('/comments/:commentId', ...adminOnly, adminController.deleteComment);
router.get('/audit-logs', ...adminOnly, adminController.getAuditLogs);

module.exports = router;
