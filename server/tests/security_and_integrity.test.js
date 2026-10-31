const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../src/models/User');
const Follow = require('../src/models/Follow');
const Notification = require('../src/models/Notification');

// Isolated local test database
const TEST_URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/social-ai-security-test';

describe('Security & QA Integrity Audit: Phase A & Phase B', () => {
  let userAToken = '';
  let userAId = null;
  let userBToken = '';
  let userBId = null;
  let suspendedUserId = null;

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    await mongoose.connect(TEST_URI);

    // Clean test collections
    await Promise.all([
      User.deleteMany({ username: { $in: ['sec_user_a', 'sec_user_b', 'sec_user_suspended'] } }),
      Follow.deleteMany({}),
      Notification.deleteMany({}),
    ]);

    // Register User A
    const resA = await request(app)
      .post('/api/auth/register')
      .send({ username: 'sec_user_a', email: 'sec_a@example.com', password: 'Password123' });
    userAId = resA.body.data.userId;

    const loginA = await request(app)
      .post('/api/auth/login')
      .send({ email: 'sec_a@example.com', password: 'Password123' });
    userAToken = loginA.headers['set-cookie'].find((c) => c.startsWith('accessToken=')).split(';')[0];

    // Register User B
    const resB = await request(app)
      .post('/api/auth/register')
      .send({ username: 'sec_user_b', email: 'sec_b@example.com', password: 'Password123' });
    userBId = resB.body.data.userId;

    const loginB = await request(app)
      .post('/api/auth/login')
      .send({ email: 'sec_b@example.com', password: 'Password123' });
    userBToken = loginB.headers['set-cookie'].find((c) => c.startsWith('accessToken=')).split(';')[0];

    // Create a suspended user directly
    const suspended = await User.create({
      username: 'sec_user_suspended',
      email: 'sec_suspended@example.com',
      passwordHash: 'dummy_hash',
      isVerified: true,
      isActive: false,
      suspendedAt: new Date(),
      suspendedReason: 'Security Policy Violation',
    });
    suspendedUserId = suspended._id;
  });

  afterAll(async () => {
    await Promise.all([
      User.deleteMany({ _id: { $in: [userAId, userBId, suspendedUserId] } }),
      Follow.deleteMany({}),
      Notification.deleteMany({}),
    ]);
    await mongoose.disconnect();
  });

  // ─── 1. Authentication & Authorization Guards ──────────────────────────────
  describe('Authentication & Authorization', () => {
    it('should reject unauthenticated follow requests with 401', async () => {
      const res = await request(app).post(`/api/users/${userBId}/follow`);
      expect(res.status).toBe(401);
    });

    it('should reject unauthenticated profile updates with 401', async () => {
      const res = await request(app).patch('/api/users/me/profile').send({ displayName: 'Hacker' });
      expect(res.status).toBe(401);
    });

    it('should silently ignore attempts to elevate role or modify unwhitelisted fields', async () => {
      const res = await request(app)
        .patch('/api/users/me/profile')
        .set('Cookie', userAToken)
        .send({ role: 'admin', isVerified: false, postsCount: 9999 });

      expect(res.status).toBe(200);
      const user = await User.findById(userAId);
      expect(user.role).toBe('user'); // Unchanged
      expect(user.postsCount).toBe(0); // Unchanged
    });

    it('should return 400 for malformed user ID', async () => {
      const res = await request(app)
        .get('/api/users/invalid-object-id-123')
        .set('Cookie', userAToken);

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/invalid.*id/i);
    });
  });

  // ─── 2. Follow System Integrity & Edge Cases ───────────────────────────────
  describe('Follow System Integrity', () => {
    it('should reject following a suspended user account with 403', async () => {
      const res = await request(app)
        .post(`/api/users/${suspendedUserId}/follow`)
        .set('Cookie', userAToken);

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/suspended/i);
    });

    it('should reject self-following with 400', async () => {
      const res = await request(app)
        .post(`/api/users/${userAId}/follow`)
        .set('Cookie', userAToken);

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/cannot follow yourself/i);
    });

    it('should handle concurrent follow requests without duplicating records or corrupting counters', async () => {
      // Fire 3 simultaneous follow requests
      const responses = await Promise.all([
        request(app).post(`/api/users/${userBId}/follow`).set('Cookie', userAToken).send({ action: 'follow' }),
        request(app).post(`/api/users/${userBId}/follow`).set('Cookie', userAToken).send({ action: 'follow' }),
        request(app).post(`/api/users/${userBId}/follow`).set('Cookie', userAToken).send({ action: 'follow' }),
      ]);

      // All requests should succeed gracefully
      responses.forEach((r) => expect(r.status).toBe(200));

      // Exactly ONE Follow record must exist in DB
      const followCount = await Follow.countDocuments({ follower: userAId, following: userBId });
      expect(followCount).toBe(1);

      // Counters must reflect exactly 1 follow
      const uA = await User.findById(userAId);
      const uB = await User.findById(userBId);
      expect(uA.followingCount).toBe(1);
      expect(uB.followersCount).toBe(1);
    });

    it('unfollowing when no relationship exists must NOT decrement counters below 0', async () => {
      // User B is not following User A
      const res = await request(app)
        .post(`/api/users/${userAId}/follow`)
        .set('Cookie', userBToken)
        .send({ action: 'unfollow' });

      expect(res.status).toBe(200);
      expect(res.body.data.isFollowing).toBe(false);

      const uB = await User.findById(userBId);
      expect(uB.followingCount).toBe(0); // Never negative
    });
  });

  // ─── 3. File Upload & Input Security ───────────────────────────────────────
  describe('File Upload Security', () => {
    it('should reject non-image file uploads (e.g. text/html script)', async () => {
      const res = await request(app)
        .patch('/api/users/me/profile')
        .set('Cookie', userAToken)
        .attach('avatar', Buffer.from('<script>alert("xss")</script>'), 'exploit.html');

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/unsupported format|allowed/i);
    });

    it('should reject fake image files with invalid magic byte headers', async () => {
      // Spoof image/png MIME but send corrupted/plain text payload
      const fakePngBuffer = Buffer.from('NOT_A_REAL_PNG_HEADER_PAYLOAD');
      const res = await request(app)
        .patch('/api/users/me/profile')
        .set('Cookie', userAToken)
        .attach('avatar', fakePngBuffer, { filename: 'avatar.png', contentType: 'image/png' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/corrupted|invalid image/i);
    });

    it('should reject malicious coverImage URL protocols like javascript:', async () => {
      const res = await request(app)
        .patch('/api/users/me/profile')
        .set('Cookie', userAToken)
        .send({ coverImage: 'javascript:alert(document.cookie)' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/invalid cover image url/i);
    });
  });

  // ─── 4. Notification Ownership & Delivery Reliability ──────────────────────
  describe('Notification Ownership', () => {
    it('should verify User B received follow notification and User A cannot read it', async () => {
      // User B fetches their notifications
      const resB = await request(app).get('/api/notifications').set('Cookie', userBToken);
      expect(resB.status).toBe(200);
      expect(resB.body.data.notifications.length).toBeGreaterThanOrEqual(1);

      const notifId = resB.body.data.notifications[0]._id;

      // User A attempts to mark User B notification as read
      const resA = await request(app)
        .patch('/api/notifications/mark-read')
        .set('Cookie', userAToken)
        .send({ ids: [notifId] });

      expect(resA.status).toBe(200);

      // Verify the notification remains UNREAD for User B because User A does not own it
      const notif = await Notification.findById(notifId);
      expect(notif.isRead).toBe(false);
    });
  });
});
