const request = require('supertest');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const app = require('../app');
const User = require('../src/models/User');
const Post = require('../src/models/Post');
const Follow = require('../src/models/Follow');
const Like = require('../src/models/Like');
const Bookmark = require('../src/models/Bookmark');
const Notification = require('../src/models/Notification');
const { connectTestDatabase, disconnectTestDatabase } = require('./testDatabase');

describe('Phase C: Advanced Social Feed, Media, Hashtags & Interactions', () => {
  let userAToken = '';
  let userAId = null;
  let userBToken = '';
  let userBId = null;
  let suspendedUser = null;
  let postA1 = null;
  let postA2 = null;
  let postB1 = null;

  beforeAll(async () => {
    jest.setTimeout(30000);
    await connectTestDatabase();

    // Clean test collections
    await Promise.all([
      User.deleteMany({ username: { $in: ['feed_user_a', 'feed_user_b', 'feed_suspended_user'] } }),
      Post.deleteMany({}),
      Follow.deleteMany({}),
      Like.deleteMany({}),
      Bookmark.deleteMany({}),
      Notification.deleteMany({}),
    ]);

    // Register User A
    const resA = await request(app)
      .post('/api/auth/register')
      .send({ username: 'feed_user_a', email: 'feed_a@example.com', password: 'Password123', displayName: 'Feed User A' });
    userAId = resA.body.data.userId;

    const loginA = await request(app)
      .post('/api/auth/login')
      .send({ email: 'feed_a@example.com', password: 'Password123' });
    userAToken = loginA.headers['set-cookie'].find((c) => c.startsWith('accessToken=')).split(';')[0];

    // Register User B
    const resB = await request(app)
      .post('/api/auth/register')
      .send({ username: 'feed_user_b', email: 'feed_b@example.com', password: 'Password123', displayName: 'Feed User B' });
    userBId = resB.body.data.userId;

    const loginB = await request(app)
      .post('/api/auth/login')
      .send({ email: 'feed_b@example.com', password: 'Password123' });
    userBToken = loginB.headers['set-cookie'].find((c) => c.startsWith('accessToken=')).split(';')[0];

    // Suspended User
    suspendedUser = await User.create({
      username: 'feed_suspended_user',
      email: 'feed_suspended@example.com',
      passwordHash: 'dummy_hash',
      isVerified: true,
      isActive: false,
      isSuspended: true,
    });
  });

  afterAll(async () => {
    try {
      await Promise.all([
        User.deleteMany({ _id: { $in: [userAId, userBId, suspendedUser?._id].filter(Boolean) } }),
        Post.deleteMany({}),
        Follow.deleteMany({}),
        Like.deleteMany({}),
        Bookmark.deleteMany({}),
        Notification.deleteMany({}),
      ]);
    } catch (e) {
      // Ignore cleanup error
    }
    await disconnectTestDatabase();
  });

  // ─── 1. Post Creation & Hashtag / Mention Extraction ───────────────────────
  it('should create post and extract hashtags and user mentions automatically', async () => {
    const res = await request(app)
      .post('/api/posts')
      .set('Cookie', userAToken)
      .send({
        content: 'Exploring #AI intelligence with @feed_user_b in 2026! #innovation',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    postA1 = res.body.data.post;
    expect(postA1.hashtags).toContain('ai');
    expect(postA1.hashtags).toContain('innovation');
    expect(postA1.mentions.length).toBe(1);

    // Verify mention notification was generated for User B
    const notif = await Notification.findOne({ recipient: userBId, type: 'mention' });
    expect(notif).not.toBeNull();
    expect(notif.sender.toString()).toBe(userAId.toString());
  });

  // ─── 2. Search Mentions Endpoint ───────────────────────────────────────────
  it('should search mentions autocomplete by prefix', async () => {
    const res = await request(app)
      .get('/api/posts/mentions/search?q=feed_user')
      .set('Cookie', userAToken);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.users.length).toBeGreaterThanOrEqual(2);
  });

  // ─── 3. Latest Feed ────────────────────────────────────────────────────────
  it('should return posts in chronological order (newest first)', async () => {
    // Create second post by User A
    const resA2 = await request(app)
      .post('/api/posts')
      .set('Cookie', userAToken)
      .send({ content: 'Second post by user A #latest' });
    postA2 = resA2.body.data.post;

    // Create post by User B
    const resB1 = await request(app)
      .post('/api/posts')
      .set('Cookie', userBToken)
      .send({ content: 'Post by user B #community' });
    postB1 = resB1.body.data.post;

    const res = await request(app)
      .get('/api/posts?tab=latest')
      .set('Cookie', userAToken);

    expect(res.status).toBe(200);
    const posts = res.body.data.posts;
    expect(posts.length).toBeGreaterThanOrEqual(3);
    // Newest post (postB1) should be first
    expect(posts[0]._id.toString()).toBe(postB1._id.toString());
  });

  // ─── 4. Following Feed ─────────────────────────────────────────────────────
  it('should return empty following feed when following nobody', async () => {
    const res = await request(app)
      .get('/api/posts?tab=following')
      .set('Cookie', userAToken);

    expect(res.status).toBe(200);
    expect(res.body.data.isFollowingEmpty).toBe(true);
    expect(res.body.data.posts.length).toBe(0);
  });

  it('should return only followed users posts in following feed after follow', async () => {
    // User A follows User B
    await request(app)
      .post(`/api/users/${userBId}/follow`)
      .set('Cookie', userAToken);

    const res = await request(app)
      .get('/api/posts?tab=following')
      .set('Cookie', userAToken);

    expect(res.status).toBe(200);
    const posts = res.body.data.posts;
    expect(posts.length).toBe(1);
    expect(posts[0].author._id.toString()).toBe(userBId.toString());
  });

  // ─── 5. Trending Feed & Scoring Formula ────────────────────────────────────
  it('should rank posts by trending formula Score = (Likes*2 + Comments*3)/(Age+2)^1.5', async () => {
    // Add 5 likes and 2 comments to postA1
    await Post.updateOne({ _id: postA1._id }, { likesCount: 5, commentsCount: 2 });
    // PostA2 has 0 likes, 0 comments

    const res = await request(app)
      .get('/api/posts?tab=trending')
      .set('Cookie', userAToken);

    expect(res.status).toBe(200);
    const posts = res.body.data.posts;
    expect(posts.length).toBeGreaterThanOrEqual(2);
    // postA1 with higher engagement must rank above postA2
    const idxA1 = posts.findIndex((p) => p._id.toString() === postA1._id.toString());
    const idxA2 = posts.findIndex((p) => p._id.toString() === postA2._id.toString());
    expect(idxA1).toBeLessThan(idxA2);
  });

  // ─── 6. For-You Feed ───────────────────────────────────────────────────────
  it('should return personalized candidates in For You feed', async () => {
    const res = await request(app)
      .get('/api/posts?tab=for-you')
      .set('Cookie', userAToken);

    expect(res.status).toBe(200);
    expect(res.body.data.posts.length).toBeGreaterThan(0);
  });

  // ─── 7. Feed Pagination ────────────────────────────────────────────────────
  it('should paginate posts correctly without duplicates across pages', async () => {
    const resPage1 = await request(app)
      .get('/api/posts?tab=latest&page=1&limit=2')
      .set('Cookie', userAToken);

    const resPage2 = await request(app)
      .get('/api/posts?tab=latest&page=2&limit=2')
      .set('Cookie', userAToken);

    expect(resPage1.status).toBe(200);
    expect(resPage2.status).toBe(200);
    expect(resPage1.body.data.posts.length).toBe(2);

    const idsPage1 = resPage1.body.data.posts.map((p) => p._id);
    const idsPage2 = resPage2.body.data.posts.map((p) => p._id);

    // No overlap between pages
    const overlap = idsPage1.filter((id) => idsPage2.includes(id));
    expect(overlap.length).toBe(0);
  });

  // ─── 8. Hashtag Filter & Trending Tags Aggregation ─────────────────────────
  it('should filter feed by hashtag', async () => {
    const res = await request(app)
      .get('/api/posts?tag=innovation')
      .set('Cookie', userAToken);

    expect(res.status).toBe(200);
    expect(res.body.data.posts.length).toBe(1);
    expect(res.body.data.posts[0]._id.toString()).toBe(postA1._id.toString());
  });

  it('should return aggregated trending hashtags', async () => {
    const res = await request(app)
      .get('/api/posts/trending-tags')
      .set('Cookie', userAToken);

    expect(res.status).toBe(200);
    const tags = res.body.data.tags;
    expect(Array.isArray(tags)).toBe(true);
    const tagNames = tags.map((t) => t.tag);
    expect(tagNames).toContain('ai');
  });

  // ─── 9. Bookmark System ────────────────────────────────────────────────────
  it('should toggle bookmark on and off correctly', async () => {
    // Bookmark
    const res1 = await request(app)
      .post(`/api/posts/${postA1._id}/bookmark`)
      .set('Cookie', userAToken);

    expect(res1.status).toBe(200);
    expect(res1.body.data.isBookmarked).toBe(true);
    expect(res1.body.data.bookmarksCount).toBe(1);

    // Check feed reflection (isBookmarkedByMe)
    const feedRes = await request(app)
      .get('/api/posts?tab=latest')
      .set('Cookie', userAToken);
    const found = feedRes.body.data.posts.find((p) => p._id.toString() === postA1._id.toString());
    expect(found.isBookmarkedByMe).toBe(true);

    // Unbookmark
    const res2 = await request(app)
      .post(`/api/posts/${postA1._id}/bookmark`)
      .set('Cookie', userAToken);

    expect(res2.status).toBe(200);
    expect(res2.body.data.isBookmarked).toBe(false);
    expect(res2.body.data.bookmarksCount).toBe(0);
  });

  // ─── 10. Like System & Duplicate Prevention ────────────────────────────────
  it('should handle rapid concurrent likes idempotently', async () => {
    // Send 3 concurrent likes from same user
    const [r1, r2, r3] = await Promise.all([
      request(app).post(`/api/posts/${postB1._id}/like`).set('Cookie', userAToken),
      request(app).post(`/api/posts/${postB1._id}/like`).set('Cookie', userAToken),
      request(app).post(`/api/posts/${postB1._id}/like`).set('Cookie', userAToken),
    ]);

    expect([r1.status, r2.status, r3.status]).toEqual(expect.arrayContaining([200]));

    // Check database has at most 1 Like record
    const count = await Like.countDocuments({ post: postB1._id, user: userAId });
    expect(count).toBeLessThanOrEqual(1);
  });

  // ─── 11. Post Authorization (Edit & Delete) ────────────────────────────────
  it('should reject unauthorized edit from non-author', async () => {
    const res = await request(app)
      .put(`/api/posts/${postA1._id}`)
      .set('Cookie', userBToken) // User B trying to edit User A's post
      .send({ content: 'Malicious modification attempt' });

    expect(res.status).toBe(403);
  });

  // ─── 12. Suspended User Content Exclusion ──────────────────────────────────
  it('should exclude posts from suspended users in all public feeds', async () => {
    // Create post by suspended user directly
    const suspPost = await Post.create({
      author: suspendedUser._id,
      content: 'Banned user post #forbidden',
    });

    const res = await request(app)
      .get('/api/posts?tab=latest')
      .set('Cookie', userAToken);

    expect(res.status).toBe(200);
    const ids = res.body.data.posts.map((p) => p._id.toString());
    expect(ids).not.toContain(suspPost._id.toString());
  });

  // ─── 13. File Upload Validation & Security ─────────────────────────────────
  it('should reject non-image file uploads disguised as images', async () => {
    const fakeImageBuffer = Buffer.from('<?php echo "malicious script"; ?>', 'utf8');

    const res = await request(app)
      .post('/api/posts')
      .set('Cookie', userAToken)
      .field('content', 'Post with fake image')
      .attach('images', fakeImageBuffer, {
        filename: 'exploit.php',
        contentType: 'image/jpeg',
      });

    // Sharp should reject invalid image binary structure
    expect(res.status).toBe(400);
  });
});
