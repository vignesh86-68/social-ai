const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { authenticate } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimiter');
const validate = require('../middleware/validate');
const { aiContentSchema, aiSummarySchema, aiReplySchema } = require('../validators/postValidators');

router.post('/content-studio', authenticate, aiLimiter, validate(aiContentSchema), aiController.contentStudio);
router.post('/summarize', authenticate, aiLimiter, validate(aiSummarySchema), aiController.summarizeDiscussion);
router.post('/suggest-reply', authenticate, aiLimiter, validate(aiReplySchema), aiController.suggestReply);

module.exports = router;
