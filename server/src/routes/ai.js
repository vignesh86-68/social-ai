const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { authenticate } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimiter');
const validate = require('../middleware/validate');
const {
  aiContentSchema,
  aiSummarySchema,
  aiReplySchema,
  signalPostSchema,
  signalHistorySchema,
} = require('../validators/postValidators');

router.post('/content-studio', authenticate, aiLimiter, validate(aiContentSchema), aiController.contentStudio);
router.post('/summarize', authenticate, aiLimiter, validate(aiSummarySchema), aiController.summarizeDiscussion);
router.post('/suggest-reply', authenticate, aiLimiter, validate(aiReplySchema), aiController.suggestReply);
router.post('/signal/community-pulse', authenticate, aiLimiter, validate(signalPostSchema), aiController.communityPulse);
router.post('/signal/audience-insights', authenticate, aiLimiter, validate(signalPostSchema), aiController.audienceInsights);
router.get('/signal/creator-next-move', authenticate, aiLimiter, aiController.creatorNextMove);
router.get('/signal/history', authenticate, validate(signalHistorySchema), aiController.analysisHistory);

module.exports = router;
