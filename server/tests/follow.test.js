const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../src/models/User');
const Follow = require('../src/models/Follow');

const TEST_URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/social-ai-test';

describe('Phase B: Follow & Profile Endpoints', () => {
  let user1Token = '';
  let user1Id = null;
  let user2Token = '';
  let user2Id = null;

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    await mongoose.connect(TEST_URI);

    // Clean test users
    await User.deleteMany({ username: { $in: ['test_user_a', 'test_user_b'] } });

    // Register User A
    const resA = await request(app)
      .post('/api/auth/register')
      .send({ username: 'test_user_a', email: 'test_user_a@example.com', password: 'Password123' });
    user1Id = resA.body.data.userId;

    // Login User A
    const loginA = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test_user_a@example.com', password: 'Password123' });
    const cookiesA = loginA.headers['set-cookie'];
    user1Token = cookiesA.find((c) => c.startsWith('accessToken=')).split(';')[0];

    // Register User B
    const resB = await request(app)
      .post('/api/auth/register')
      .send({ username: 'test_user_b', email: 'test_user_b@example.com', password: 'Password123' });
    user2Id = resB.body.data.userId;

    // Login User B
    const loginB = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test_user_b@example.com', password: 'Password123' });
    const cookiesB = loginB.headers['set-cookie'];
    user2Token = cookiesB.find((c) => c.startsWith('accessToken=')).split(';')[0];
  });

  afterAll(async () => {
    if (user1Id && user2Id) {
      await Follow.deleteMany({
        $or: [
          { follower: user1Id },
          { following: user1Id },
          { follower: user2Id },
          { following: user2Id },
        ],
      });
      await User.deleteMany({ _id: { $in: [user1Id, user2Id] } });
    }
    await mongoose.disconnect();
  });

  it('should prevent a user from following themselves', async () => {
    const res = await request(app)
      .post(`/api/users/${user1Id}/follow`)
      .set('Cookie', user1Token);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/cannot follow yourself/i);
  });

  it('should allow User A to follow User B and update counters', async () => {
    const res = await request(app)
      .post(`/api/users/${user2Id}/follow`)
      .set('Cookie', user1Token);

    expect(res.status).toBe(200);
    expect(res.body.data.isFollowing).toBe(true);
    expect(res.body.data.followersCount).toBe(1);

    const uA = await User.findById(user1Id);
    expect(uA.followingCount).toBe(1);

    const uB = await User.findById(user2Id);
    expect(uB.followersCount).toBe(1);
  });

  it('should correctly report follow status', async () => {
    const res = await request(app)
      .get(`/api/users/${user2Id}/follow-status`)
      .set('Cookie', user1Token);

    expect(res.status).toBe(200);
    expect(res.body.data.isFollowing).toBe(true);
    expect(res.body.data.followsYou).toBe(false);
  });

  it('should list User A in User B followers list', async () => {
    const res = await request(app)
      .get(`/api/users/${user2Id}/followers`)
      .set('Cookie', user2Token);

    expect(res.status).toBe(200);
    expect(res.body.data.followers.length).toBe(1);
    expect(res.body.data.followers[0].username).toBe('test_user_a');
  });

  it('should allow User A to unfollow User B and decrement counters', async () => {
    const res = await request(app)
      .post(`/api/users/${user2Id}/follow`)
      .set('Cookie', user1Token);

    expect(res.status).toBe(200);
    expect(res.body.data.isFollowing).toBe(false);
    expect(res.body.data.followersCount).toBe(0);

    const uA = await User.findById(user1Id);
    expect(uA.followingCount).toBe(0);
  });
});
