const bcrypt = require('bcryptjs');
const User = require('../src/models/User');
const { correctAdminEmail } = require('../scripts/correctAdminEmail');
const { connectTestDatabase, stopTestDatabase } = require('./testDatabase');

jest.setTimeout(60000);

describe('controlled administrator email correction', () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  beforeEach(async () => {
    await User.deleteMany({});
  });

  afterAll(async () => {
    await stopTestDatabase();
  });

  const createAdmin = () => User.create({
    username: 'admin_36e9f88d',
    email: 'vigneshsakthivel8668@gmail.com',
    passwordHash: bcrypt.hashSync('ExistingPassword123!', 12),
    role: 'admin',
    isVerified: true,
    isActive: true,
  });

  it('corrects the email while preserving the existing account identity and credentials', async () => {
    const admin = await createAdmin();

    const result = await correctAdminEmail({
      currentEmail: ' VigneshSakthivel8668@Gmail.com ',
      newEmail: 'VIGNESHLAMBORGHINI@GMAIL.COM',
      password: 'ExistingPassword123!',
    });
    const updated = await User.findById(admin._id).select('+passwordHash');

    expect(result.action).toBe('updated');
    expect(updated._id.toString()).toBe(admin._id.toString());
    expect(updated.email).toBe('vigneshlamborghini@gmail.com');
    expect(updated.username).toBe('admin_36e9f88d');
    expect(updated.role).toBe('admin');
    expect(await bcrypt.compare('ExistingPassword123!', updated.passwordHash)).toBe(true);
  });

  it('refuses correction when the intended email belongs to another account', async () => {
    const admin = await createAdmin();
    await User.create({
      username: 'other_user',
      email: 'vigneshlamborghini@gmail.com',
      passwordHash: bcrypt.hashSync('OtherPassword123!', 12),
      role: 'user',
      isVerified: true,
      isActive: true,
    });

    await expect(correctAdminEmail({
      currentEmail: admin.email,
      newEmail: 'vigneshlamborghini@gmail.com',
      password: 'ExistingPassword123!',
    })).rejects.toThrow('already used');

    const unchanged = await User.findById(admin._id);
    expect(unchanged.email).toBe('vigneshsakthivel8668@gmail.com');
  });
});
