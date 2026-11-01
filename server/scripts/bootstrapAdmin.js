require('dotenv').config();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const User = require('../src/models/User');

const provisionAdmin = async ({
  email = process.env.ADMIN_EMAIL,
  password = process.env.ADMIN_PASSWORD,
  UserModel = User,
} = {}) => {
  if (!email || !password || email.includes('social-ai.app') || password.includes('ChangeMe')) {
    throw new Error('Set unique ADMIN_EMAIL and ADMIN_PASSWORD runtime values before bootstrapping');
  }
  if (password.length < 8) throw new Error('ADMIN_PASSWORD must be at least 8 characters');

  if (await UserModel.exists({ role: 'admin' })) {
    throw new Error('An administrator already exists; bootstrap is one-time only');
  }

  const normalizedEmail = email.toLowerCase().trim();
  const matchingUsers = await UserModel.find({ email: normalizedEmail }).select('+passwordHash');
  if (matchingUsers.length > 1) {
    throw new Error('Multiple accounts match ADMIN_EMAIL; provisioning refused');
  }

  if (matchingUsers.length === 1) {
    const existingUser = matchingUsers[0];
    if (!existingUser.isVerified) {
      throw new Error('Existing account must be verified before administrator provisioning');
    }
    if (!existingUser.isActive) {
      throw new Error('Existing account must be active before administrator provisioning');
    }
    if (!existingUser.passwordHash || !(await bcrypt.compare(password, existingUser.passwordHash))) {
      throw new Error('ADMIN_PASSWORD does not match the existing account credentials');
    }

    const result = await UserModel.updateOne(
      { _id: existingUser._id, role: 'user', isVerified: true, isActive: true },
      { $set: { role: 'admin' } },
    );
    if (result.modifiedCount !== 1) {
      throw new Error('Existing account changed during provisioning; administrator promotion refused');
    }
    return { action: 'promoted', userId: existingUser._id };
  }

  const user = await UserModel.create({
    username: `admin_${crypto.randomUUID().slice(0, 8)}`,
    email: normalizedEmail,
    passwordHash: await bcrypt.hash(password, 12),
    displayName: 'SOCIAL AI Administrator',
    role: 'admin',
    isVerified: true,
  });
  return { action: 'created', userId: user._id };
};

const run = async () => {
  await connectDB();
  const result = await provisionAdmin();
  console.log(result.action === 'promoted'
    ? 'Existing account promoted to administrator successfully.'
    : 'Initial administrator created successfully.');
};

if (require.main === module) {
  run()
    .catch((err) => {
      console.error(err.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      await mongoose.disconnect();
    });
}

module.exports = { provisionAdmin };
