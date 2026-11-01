const bcrypt = require('bcryptjs');
const User = require('../src/models/User');
const { provisionAdmin } = require('../scripts/bootstrapAdmin');
const { connectTestDatabase, stopTestDatabase } = require('./testDatabase');

jest.setTimeout(60000);

describe('controlled administrator provisioning', () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  beforeEach(async () => {
    await User.deleteMany({});
  });

  afterAll(async () => {
    await stopTestDatabase();
  });

  it('promotes the existing verified active account without replacing it', async () => {
    const user = await User.create({
      username: 'Xocic_Vicky',
      email: 'xocic.vicky@example.com',
      passwordHash: await bcrypt.hash('ExistingPassword123!', 12),
      role: 'user',
      isVerified: true,
      isActive: true,
    });

    const result = await provisionAdmin({
      email: 'xocic.vicky@example.com',
      password: 'ExistingPassword123!',
    });
    const promoted = await User.findById(user._id).select('+passwordHash');

    expect(result.action).toBe('promoted');
    expect(promoted._id.toString()).toBe(user._id.toString());
    expect(promoted.role).toBe('admin');
    expect(promoted.username).toBe('Xocic_Vicky');
    expect(await bcrypt.compare('ExistingPassword123!', promoted.passwordHash)).toBe(true);
  });

  it('refuses provisioning when an administrator already exists', async () => {
    await User.create({
      username: 'existing_admin',
      email: 'existing-admin@example.com',
      passwordHash: await bcrypt.hash('Password123!', 12),
      role: 'admin',
      isVerified: true,
      isActive: true,
    });

    await expect(provisionAdmin({
      email: 'new-admin@example.com',
      password: 'Password123!',
    })).rejects.toThrow('An administrator already exists');
  });

  it('refuses an unverified matching account', async () => {
    await User.create({
      username: 'unverified_user',
      email: 'unverified@example.com',
      passwordHash: await bcrypt.hash('Password123!', 12),
      isVerified: false,
      isActive: true,
    });

    await expect(provisionAdmin({
      email: 'unverified@example.com',
      password: 'Password123!',
    })).rejects.toThrow('must be verified');
  });

  it('refuses an inactive matching account', async () => {
    await User.create({
      username: 'inactive_user',
      email: 'inactive@example.com',
      passwordHash: await bcrypt.hash('Password123!', 12),
      isVerified: true,
      isActive: false,
    });

    await expect(provisionAdmin({
      email: 'inactive@example.com',
      password: 'Password123!',
    })).rejects.toThrow('must be active');
  });

  it('refuses incorrect credentials and leaves the account unchanged', async () => {
    const user = await User.create({
      username: 'credential_user',
      email: 'credential@example.com',
      passwordHash: await bcrypt.hash('CorrectPassword123!', 12),
      isVerified: true,
      isActive: true,
    });

    await expect(provisionAdmin({
      email: 'credential@example.com',
      password: 'WrongPassword123!',
    })).rejects.toThrow('does not match');

    const unchanged = await User.findById(user._id);
    expect(unchanged.role).toBe('user');
  });
});
