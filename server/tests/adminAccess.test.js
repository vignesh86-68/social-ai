const request = require('supertest');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const app = require('../app');
const User = require('../src/models/User');
const AdminInvitation = require('../src/models/AdminInvitation');
const { connectTestDatabase, disconnectTestDatabase } = require('./testDatabase');

jest.setTimeout(60000);

describe('Admin authentication and access management', () => {
  let adminCookie;
  let userCookie;
  let admin;

  beforeAll(async () => {
    await connectTestDatabase();
    admin = await User.create({
      username: 'command_admin',
      email: 'command-admin@example.com',
      passwordHash: await bcrypt.hash('Password123', 12),
      role: 'admin',
      isVerified: true,
    });
    await User.create({
      username: 'command_user',
      email: 'command-user@example.com',
      passwordHash: await bcrypt.hash('Password123', 12),
      role: 'user',
      isVerified: true,
    });

    const adminLogin = await request(app).post('/api/auth/login').send({
      email: 'command-admin@example.com',
      password: 'Password123',
    });
    adminCookie = adminLogin.headers['set-cookie'].find((value) => value.startsWith('accessToken='));

    const userLogin = await request(app).post('/api/auth/login').send({
      email: 'command-user@example.com',
      password: 'Password123',
    });
    userCookie = userLogin.headers['set-cookie'].find((value) => value.startsWith('accessToken='));
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it('rejects unauthenticated and normal-user admin API access', async () => {
    const unauthenticated = await request(app).get('/api/admin/stats');
    const normalUser = await request(app).get('/api/admin/stats').set('Cookie', userCookie);
    const admin = await request(app).get('/api/admin/stats').set('Cookie', adminCookie);

    expect(unauthenticated.status).toBe(401);
    expect(normalUser.status).toBe(403);
    expect(admin.status).toBe(200);
    expect(admin.body.data.stats).toEqual(expect.objectContaining({
      activeUsers: expect.any(Number),
      suspendedUsers: expect.any(Number),
      newUsers: expect.any(Number),
      engagement: expect.any(Object),
    }));
  });

  it('allows an admin to create and revoke an invitation without exposing its token', async () => {
    const created = await request(app)
      .post('/api/admin/invitations')
      .set('Cookie', adminCookie)
      .send({ email: 'invited-admin@example.com' });

    expect(created.status).toBe(201);
    expect(created.body.data.invitation).not.toHaveProperty('token');
    expect(created.body.data.invitation.email).toBe('invited-admin@example.com');

    const invitation = await AdminInvitation.findOne({ email: 'invited-admin@example.com' }).select('+tokenHash');
    expect(invitation.tokenHash).toHaveLength(64);

    const revoked = await request(app)
      .delete(`/api/admin/invitations/${invitation._id}`)
      .set('Cookie', adminCookie);
    expect(revoked.status).toBe(200);
  });

  it('accepts a valid invitation once and rejects reuse', async () => {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const invitation = await AdminInvitation.create({
      email: 'accepted-admin@example.com',
      tokenHash: crypto.createHash('sha256').update(rawToken).digest('hex'),
      invitedBy: admin._id,
      expiresAt: new Date(Date.now() + 60_000),
    });

    const accepted = await request(app).post('/api/auth/admin-invitations/accept').send({
      token: rawToken,
      username: 'accepted_admin',
      password: 'Password123',
    });
    const reused = await request(app).post('/api/auth/admin-invitations/accept').send({
      token: rawToken,
      username: 'accepted_admin_2',
      password: 'Password123',
    });

    expect(accepted.status).toBe(201);
    expect(reused.status).toBe(400);
    expect((await User.findOne({ email: invitation.email })).role).toBe('admin');
  });
});
