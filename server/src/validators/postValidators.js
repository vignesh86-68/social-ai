const { z } = require('zod');

const createPostSchema = z.object({
  content: z
    .string()
    .min(1, 'Post content cannot be empty')
    .max(2000, 'Post cannot exceed 2000 characters')
    .trim(),
  mediaUrl: z.string().optional().nullable(),
  mediaType: z.enum(['image', 'video']).optional().nullable(),
});

const updatePostSchema = z.object({
  content: z
    .string()
    .min(1, 'Post content cannot be empty')
    .max(2000, 'Post cannot exceed 2000 characters')
    .trim(),
});

const createCommentSchema = z.object({
  content: z
    .string()
    .min(1, 'Comment cannot be empty')
    .max(500, 'Comment cannot exceed 500 characters')
    .trim(),
});

const updateProfileSchema = z.object({
  displayName: z.string().max(50).optional(),
  bio: z.string().max(300).optional(),
  location: z.string().max(100).optional(),
  website: z.string().url('Please enter a valid URL').max(200).optional().or(z.literal('')),
  coverImage: z.string().optional().nullable(),
});

const aiContentSchema = z.object({
  action: z.enum(['generate', 'improve', 'rewrite', 'grammar', 'shorten', 'expand', 'hashtags', 'headlines', 'quality', 'dna']).optional(),
  mode: z.string().optional(), // alias for action
  topic: z.string().max(1000).optional(),
  content: z.string().max(5000).optional(),
  currentContent: z.string().max(5000).optional(), // alias for content
  tone: z.string().optional(),
});

const aiSummarySchema = z.object({
  postId: z.string().optional(),
  text: z.string().max(15000).optional(),
});

const aiReplySchema = z.object({
  postContent: z.string().max(3000).optional(),
  postContext: z.string().max(3000).optional(), // alias for postContent
  commentContent: z.string().max(1000).optional(),
  tone: z.string().optional(),
});

const signalPostSchema = z.object({
  postId: z.string().regex(/^[a-f\d]{24}$/i, 'A valid post ID is required'),
  save: z.boolean().optional().default(false),
});

const signalHistorySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

module.exports = {
  createPostSchema,
  updatePostSchema,
  createCommentSchema,
  updateProfileSchema,
  aiContentSchema,
  aiSummarySchema,
  aiReplySchema,
  signalPostSchema,
  signalHistorySchema,
};
