const request = require('supertest');
const mongoose = require('mongoose');

let mockGeneratedText = JSON.stringify({
  summary: 'The discussion supports a focused improvement.',
  themes: ['product quality'],
  supportiveViewpoints: ['The approach is useful.'],
  criticalViewpoints: ['The workflow needs clarity.'],
  questions: ['How will this scale?'],
  unansweredQuestions: ['How will this scale?'],
  suggestions: ['Document the workflow.'],
  takeaways: ['Clarity is a priority.'],
  evidence: [{ insight: 'The workflow needs clarity.', commentIds: [] }],
});
let mockGenerationResults = [];
let mockRequestedModels = [];

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn((options) => {
      mockRequestedModels.push(options.model);
      return {
        generateContent: jest.fn(async () => {
          if (mockGenerationResults.length) {
            const nextResult = mockGenerationResults.shift();
            if (nextResult instanceof Error) throw nextResult;
            return { response: { text: () => nextResult } };
          }
          if (mockGeneratedText instanceof Error) throw mockGeneratedText;
          return { response: { text: () => mockGeneratedText } };
        }),
      };
    }),
  })),
}));

const originalGeminiModel = process.env.GEMINI_MODEL;
process.env.GEMINI_MODEL = ' models/gemini-3.8-flash ';
const app = require('../app');
const { normalizeGeminiModel } = require('../src/controllers/aiController');
const User = require('../src/models/User');
const Post = require('../src/models/Post');
const Comment = require('../src/models/Comment');
const AIAnalysis = require('../src/models/AIAnalysis');
const { connectTestDatabase, stopTestDatabase } = require('./testDatabase');

jest.setTimeout(60000);

describe('Gemini model configuration', () => {
  test('normalizes a plain model ID and a single models/ prefix', () => {
    expect(normalizeGeminiModel('gemini-3.8-flash')).toBe('gemini-3.8-flash');
    expect(normalizeGeminiModel('  models/gemini-3.8-flash  ')).toBe('gemini-3.8-flash');
  });

  test.each([
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash',
    'models/models/gemini-3.8-flash',
    '',
    null,
  ])('rejects malformed model configuration: %s', (model) => {
    expect(() => normalizeGeminiModel(model)).toThrow('GEMINI_MODEL must be a model identifier');
  });
});

const signIn = async (email, username) => {
  const registration = await request(app).post('/api/auth/register').send({
    username,
    email,
    password: 'Password123',
  });
  const login = await request(app).post('/api/auth/login').send({ email, password: 'Password123' });
  const cookie = login.headers['set-cookie'].find((value) => value.startsWith('accessToken='));
  return { id: registration.body.data.userId, cookie };
};

describe('Signal Intelligence API', () => {
  let owner;
  let other;
  let post;
  let comment;

  beforeAll(async () => {
    await connectTestDatabase();
    process.env.GEMINI_API_KEY = 'test-key';
    owner = await signIn('signal-owner@example.com', 'signal_owner');
    other = await signIn('signal-other@example.com', 'signal_other');
    post = await Post.create({ author: owner.id, content: 'A post about better product workflows' });
    comment = await Comment.create({ post: post._id, author: other.id, content: 'The workflow needs clearer documentation.' });
  });

  afterEach(async () => {
    mockRequestedModels = [];
    mockGenerationResults = [];
    mockGeneratedText = JSON.stringify({
      summary: 'The discussion supports a focused improvement.',
      themes: ['product quality'],
      supportiveViewpoints: ['The approach is useful.'],
      criticalViewpoints: ['The workflow needs clarity.'],
      questions: ['How will this scale?'],
      unansweredQuestions: ['How will this scale?'],
      suggestions: ['Document the workflow.'],
      takeaways: ['Clarity is a priority.'],
      evidence: [{ insight: 'The workflow needs clarity.', commentIds: [comment._id.toString(), new mongoose.Types.ObjectId().toString()] }],
    });
  });

  afterAll(async () => {
    await stopTestDatabase();
    delete process.env.GEMINI_API_KEY;
    if (originalGeminiModel === undefined) delete process.env.GEMINI_MODEL;
    else process.env.GEMINI_MODEL = originalGeminiModel;
  });

  test('rejects unauthenticated and invalid post requests', async () => {
    await request(app).post('/api/ai/signal/community-pulse').send({ postId: post._id }).expect(401);
    await request(app).post('/api/ai/signal/community-pulse').set('Cookie', owner.cookie).send({ postId: 'invalid' }).expect(400);
  });

  test('analyzes actual comments and removes unsupported evidence IDs', async () => {
    const response = await request(app)
      .post('/api/ai/signal/community-pulse')
      .set('Cookie', owner.cookie)
      .send({ postId: post._id, save: true })
      .expect(200);
    expect(response.body.data.commentCount).toBe(1);
    expect(response.body.data.result.evidence[0].commentIds).toEqual([comment._id.toString()]);
    expect(await AIAnalysis.countDocuments({ user: owner.id })).toBe(1);
  });

  test('handles a post with no comments', async () => {
    const emptyPost = await Post.create({ author: owner.id, content: 'No discussion yet' });
    const response = await request(app)
      .post('/api/ai/signal/community-pulse')
      .set('Cookie', owner.cookie)
      .send({ postId: emptyPost._id })
      .expect(200);
    expect(response.body.data.commentCount).toBe(0);
  });

  test('keeps analysis history scoped to the authenticated user', async () => {
    await AIAnalysis.create({ user: other.id, type: 'community-pulse', post: post._id, result: {}, model: 'test' });
    const response = await request(app).get('/api/ai/signal/history').set('Cookie', owner.cookie).expect(200);
    expect(response.body.data.items.every((item) => item.user.toString() === owner.id)).toBe(true);
  });

  test('returns accurate creator metrics from stored posts', async () => {
    mockGeneratedText = JSON.stringify({
      suggestions: ['Document the workflow.'],
      followUps: ['Share a workflow checklist.'],
      questionsToAnswer: ['How will this scale?'],
      improvements: ['Clarify the next step.'],
      postIdeas: ['A practical workflow guide'],
    });
    await Post.deleteMany({ author: owner.id });
    await Post.create({ author: owner.id, content: 'First measured post', likesCount: 1, commentsCount: 1 });
    await Post.create({ author: owner.id, content: 'Second post', likesCount: 3, commentsCount: 2, hashtags: ['workflows'] });
    const response = await request(app).get('/api/ai/signal/creator-next-move').set('Cookie', owner.cookie).expect(200);
    expect(response.body.data.stats.totalPosts).toBe(2);
    expect(response.body.data.stats.totalLikes).toBe(4);
    expect(response.body.data.stats.totalComments).toBe(3);
    expect(response.body.data.stats.engagementPerPost).toBe(3.5);
  });

  test('returns provider and missing-key errors without fabricating output', async () => {
    const testPost = await Post.create({ author: owner.id, content: 'Provider error test post' });
    const previousKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    await request(app).post('/api/ai/signal/community-pulse').set('Cookie', owner.cookie).send({ postId: testPost._id }).expect(400);
    process.env.GEMINI_API_KEY = previousKey;
    mockGeneratedText = new Error('RESOURCE_EXHAUSTED quota exceeded');
    await request(app).post('/api/ai/signal/community-pulse').set('Cookie', owner.cookie).send({ postId: testPost._id }).expect(429);
    mockGeneratedText = 'not json';
    await request(app).post('/api/ai/signal/community-pulse').set('Cookie', owner.cookie).send({ postId: testPost._id }).expect(400);
  });

  test('uses the supported fallback when the primary Gemini model returns 404', async () => {
    const testPost = await Post.create({ author: owner.id, content: 'Model fallback test post' });
    mockGenerationResults = [
      new Error('404 Not Found: models/gemini-3.8-flash is unavailable'),
      JSON.stringify({
        summary: 'Fallback analysis completed.',
        themes: [],
        supportiveViewpoints: [],
        criticalViewpoints: [],
        questions: [],
        unansweredQuestions: [],
        suggestions: [],
        takeaways: [],
        evidence: [],
      }),
    ];

    await request(app)
      .post('/api/ai/signal/community-pulse')
      .set('Cookie', owner.cookie)
      .send({ postId: testPost._id })
      .expect(200);

    expect(mockRequestedModels).toEqual(['gemini-3.8-flash', 'gemini-2.5-flash']);
  });

  test('returns a concise actionable message if both configured models are unavailable', async () => {
    const testPost = await Post.create({ author: owner.id, content: 'Unavailable model test post' });
    mockGenerationResults = [
      new Error('404 Not Found: primary model'),
      new Error('404 Not Found: https://provider.example/model?key=secret'),
    ];

    const response = await request(app)
      .post('/api/ai/signal/community-pulse')
      .set('Cookie', owner.cookie)
      .send({ postId: testPost._id })
      .expect(400);

    expect(response.body.message).toMatch(/GEMINI_MODEL/);
    expect(response.body.message).not.toContain('provider.example');
    expect(response.body.message).not.toContain('secret');
  });

  test('covers the existing AI Studio workflows and Content DNA', async () => {
    mockGeneratedText = 'A polished draft for the community.';
    await request(app).post('/api/ai/content-studio').set('Cookie', owner.cookie)
      .send({ mode: 'generate', topic: 'product workflows' }).expect(200);
    await request(app).post('/api/ai/summarize').set('Cookie', owner.cookie)
      .send({ text: 'A discussion about product workflows.' }).expect(200);
    mockGeneratedText = '["A thoughtful reply", "A useful follow-up", "A clarifying question"]';
    await request(app).post('/api/ai/suggest-reply').set('Cookie', owner.cookie)
      .send({ postContext: 'Product workflows matter.', tone: 'friendly' }).expect(200);
    mockGeneratedText = JSON.stringify({
      professional: 'Professional version',
      conversational: 'Conversational version',
      educational: 'Educational version',
      headlines: ['A better workflow'],
      hashtags: ['#workflow'],
      shortVersion: 'Short version',
      expandedVersion: 'Expanded version',
      readability: 'Clear and concise.',
      improvements: ['Add a concrete example.'],
    });
    const response = await request(app).post('/api/ai/content-studio').set('Cookie', owner.cookie)
      .send({ mode: 'dna', content: 'A rough workflow draft.' }).expect(200);
    expect(response.body.data.result.professional).toBe('Professional version');
  });
});
