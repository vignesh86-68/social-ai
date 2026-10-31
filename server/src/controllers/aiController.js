const { GoogleGenerativeAI } = require('@google/generative-ai');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const ApiError = require('../utils/ApiError');

const getModel = () => {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY.includes('YOUR_GEMINI')) {
    throw ApiError.badRequest('Google Gemini API Key is not configured. Please add GEMINI_API_KEY to server/.env');
  }
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    generationConfig: { maxOutputTokens: 1024 },
  });
};

const safeParse = (text) => text?.trim() || '';

// ─── AI Content Studio ────────────────────────────────────────────────────────
exports.contentStudio = async (req, res, next) => {
  try {
    const act = req.body.action || req.body.mode || 'generate';
    const topic = req.body.topic;
    const cnt = req.body.content || req.body.currentContent;
    const tone = req.body.tone || 'engaging';

    const model = getModel();
    let prompt;

    switch (act) {
      case 'generate':
        prompt = `You are a high-engagement social media content architect. Generate a compelling, high-quality post about: "${topic}". Tone: ${tone}. Include natural spacing and 2 relevant hashtags. Keep it under 280 words. Return ONLY the text of the post.`;
        break;
      case 'improve':
        prompt = `Enhance the following social media post for higher engagement, clarity, flow and punchiness while preserving its core intent. Tone: ${tone}.\n\nPost:\n${cnt}\n\nReturn ONLY the improved post text.`;
        break;
      case 'rewrite':
        prompt = `Rewrite the following social media post strictly in a ${tone} tone. Return ONLY the rewritten text.\n\nPost:\n${cnt}`;
        break;
      case 'grammar':
        prompt = `Correct all grammar, spelling, punctuation and sentence cadence in the following post. Return ONLY the polished text.\n\nPost:\n${cnt}`;
        break;
      case 'shorten':
        prompt = `Condense the following post into a concise, punchy version while retaining the primary takeaway. Return ONLY the condensed text.\n\nPost:\n${cnt}`;
        break;
      case 'expand':
        prompt = `Expand the following post into a richer, more detailed discussion post with valuable insights and an open question for audience engagement. Return ONLY the expanded text.\n\nPost:\n${cnt}`;
        break;
      default:
        prompt = `Polish and improve this social media text: "${cnt || topic}". Tone: ${tone}. Return ONLY the final text.`;
    }

    const result = await model.generateContent(prompt);
    const text = safeParse(result.response.text());
    res.json({ success: true, data: { result: text, suggestion: text } });
  } catch (err) {
    next(err);
  }
};

// ─── Discussion Intelligence ──────────────────────────────────────────────────
exports.summarizeDiscussion = async (req, res, next) => {
  try {
    const { postId, text: directText } = req.body;
    let discussion = '';
    let commentCount = 0;

    if (postId) {
      const [post, comments] = await Promise.all([
        Post.findById(postId).populate('author', 'username displayName'),
        Comment.find({ post: postId }).sort({ createdAt: 1 }).limit(100).populate('author', 'username displayName'),
      ]);
      if (!post) throw ApiError.notFound('Post not found');
      commentCount = comments.length;
      discussion = `Post by ${post.author.displayName || post.author.username}: ${post.content}\n\nComments:\n` +
        comments.map((c) => `${c.author.displayName || c.author.username}: ${c.content}`).join('\n');
    } else if (directText) {
      discussion = directText;
    } else {
      throw ApiError.badRequest('Either postId or text is required to summarize');
    }

    const model = getModel();
    const prompt = `You are a social intelligence analyst. Analyze and summarize the following social discussion concisely and accurately.\n\nFormat your output cleanly as:\n**Summary:** (2-3 sentences providing high-level overview)\n\n**Key Discussion Points:**\n- [point 1]\n- [point 2]\n\n**Community Consensus & Takeaways:**\n- [consensus point]\n\nDiscussion:\n${discussion}`;

    const result = await model.generateContent(prompt);
    const summary = safeParse(result.response.text());
    res.json({ success: true, data: { summary, commentCount } });
  } catch (err) {
    next(err);
  }
};

// ─── Smart Reply ──────────────────────────────────────────────────────────────
exports.suggestReply = async (req, res, next) => {
  try {
    const postContent = req.body.postContent || req.body.postContext || '';
    const commentContent = req.body.commentContent || '';
    const tone = req.body.tone || 'friendly';

    if (!postContent && !commentContent) {
      throw ApiError.badRequest('Post or comment context is required');
    }

    const model = getModel();
    const context = commentContent
      ? `Main Post: ${postContent}\n\nSpecific Comment to reply to: ${commentContent}`
      : `Post to reply to: ${postContent}`;

    const prompt = `You are a thoughtful, constructive social media user. Suggest 3 distinct, high-quality, friendly replies to the following content in a ${tone} tone. Keep them natural, engaging, and ready-to-post.\n\nReturn ONLY a JSON array of 3 strings without markdown fences or additional explanation.\n\nContent:\n${context}`;

    const result = await model.generateContent(prompt);
    const raw = safeParse(result.response.text());

    let suggestions = [];
    try {
      const cleaned = raw.replace(/```json?/g, '').replace(/```/g, '').trim();
      suggestions = JSON.parse(cleaned);
    } catch {
      suggestions = raw.split('\n').map((l) => l.replace(/^[-*0-9.]+\s*/, '').trim()).filter(Boolean).slice(0, 3);
    }

    res.json({
      success: true,
      data: {
        replies: suggestions,
        reply: suggestions[0] || '',
        suggestions,
      },
    });
  } catch (err) {
    next(err);
  }
};
