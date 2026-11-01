const bcrypt = require('bcryptjs');
const User = require('../src/models/User');
const { resetAdminPassword } = require('../scripts/resetAdminPassword');
const { connectTestDatabase, stopTestDatabase } = require('./testDatabase');

jest.setTimeout(60000);

describe('controlled administrator password reset', () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  beforeEach(async () => {
    await User.deleteMany({});
  });

  afterAll(async () => {
    await stopTestDatabase();
  });

  const createUser = (overrides = {}) => User.create({
    username: 'admin_36e9f88d',
    email: 'admin@example.com',
    passwordHash: bcrypt.hashSync('OldPassword123!', 12),
    role: 'admin',
    isVerified: true,
    isActive: true,
    ...overrides,
  });

  it('updates only the password hash for the normalized administrator email', async () => {
    const admin = await createUser({ displayName: 'Existing Administrator' });
    const oldUpdatedAt = admin.updatedAt;

    const result = await resetAdminPassword({
      email: ' ADMIN@EXAMPLE.COM ',
      newPassword: 'NewSecurePassword123!',
    });
    const updated = await User.findById(admin._id).select('+passwordHash');

    expect(result.action).toBe('updated');
    expect(updated._id.toString()).toBe(admin._id.toString());
    expect(updated.email).toBe('admin@example.com');
    expect(updated.username).toBe('admin_36e9f88d');
    expect(updated.role).toBe('admin');
    expect(updated.displayName).toBe('Existing Administrator');
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(oldUpdatedAt.getTime());
    expect(await bcrypt.compare('NewSecurePassword123!', updated.passwordHash)).toBe(true);
    expect(await bcrypt.compare('OldPassword123!', updated.passwordHash)).toBe(false);
  });

  it('rejects a missing email or password', async () => {
    await expect(resetAdminPassword({ newPassword: 'NewSecurePassword123!' }))
      .rejects.toThrow('ADMIN_EMAIL');
    await expect(resetAdminPassword({ email: 'admin@example.com' }))
      .rejects.toThrow('new administrator password');
  });

  it('rejects a password shorter than 12 characters', async () => {
    await createUser();

    await expect(resetAdminPassword({
      email: 'admin@example.com',
      newPassword: 'ShortPass12',
    })).rejects.toThrow('at least 12 characters');
  });

  it('rejects zero matching accounts', async () => {
    await expect(resetAdminPassword({
      email: 'missing@example.com',
      newPassword: 'NewSecurePassword123!',
    })).rejects.toThrow('Exactly one account');
  });

  it('rejects multiple matching accounts before updating', async () => {
    const matchingUser = {
      _id: 'matching-id',
      role: 'admin',
      isVerified: true,
      isActive: true,
    };
    const UserModel = {
      find: jest.fn(() => ({
        select: jest.fn().mockResolvedValue([matchingUser, matchingUser]),
      })),
      updateOne: jest.fn(),
    };

    await expect(resetAdminPassword({
      email: 'admin@example.com',
      newPassword: 'NewSecurePassword123!',
      UserModel,
    })).rejects.toThrow('Exactly one account');
    expect(UserModel.updateOne).not.toHaveBeenCalled();
  });

  it('rejects non-admin, unverified, and inactive accounts', async () => {
    await createUser({ role: 'user' });
    await expect(resetAdminPassword({
      email: 'admin@example.com',
      newPassword: 'NewSecurePassword123!',
    })).rejects.toThrow('administrator role');

    await User.deleteMany({});
    await createUser({ isVerified: false });
    await expect(resetAdminPassword({
      email: 'admin@example.com',
      newPassword: 'NewSecurePassword123!',
    })).rejects.toThrow('must be verified');

    await User.deleteMany({});
    await createUser({ isActive: false });
    await expect(resetAdminPassword({
      email: 'admin@example.com',
      newPassword: 'NewSecurePassword123!',
    })).rejects.toThrow('must be active');
  });
});
