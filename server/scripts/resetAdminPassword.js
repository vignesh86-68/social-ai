require('dotenv').config();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const User = require('../src/models/User');

const BCRYPT_ROUNDS = 12;

const normalizeEmail = (email) => email.toLowerCase().trim();

const resetAdminPassword = async ({
  email = process.env.ADMIN_EMAIL,
  newPassword,
  UserModel = User,
} = {}) => {
  if (!email || typeof newPassword !== 'string') {
    throw new Error('Set ADMIN_EMAIL and provide a new administrator password');
  }
  if (newPassword.length < 12) {
    throw new Error('The administrator password must be at least 12 characters');
  }

  const normalizedEmail = normalizeEmail(email);
  const matchingUsers = await UserModel.find({ email: normalizedEmail }).select('+passwordHash');
  if (matchingUsers.length !== 1) {
    throw new Error('Exactly one account must match ADMIN_EMAIL');
  }

  const admin = matchingUsers[0];
  if (admin.role !== 'admin') {
    throw new Error('The matching account must have administrator role');
  }
  if (!admin.isVerified) {
    throw new Error('The administrator account must be verified');
  }
  if (!admin.isActive) {
    throw new Error('The administrator account must be active');
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  const result = await UserModel.updateOne(
    {
      _id: admin._id,
      email: normalizedEmail,
      role: 'admin',
      isVerified: true,
      isActive: true,
    },
    { $set: { passwordHash } },
  );
  if (result.modifiedCount !== 1) {
    throw new Error('Administrator changed during reset; password update refused');
  }

  return { action: 'updated', userId: admin._id };
};

const readHiddenPassword = (prompt) => new Promise((resolve, reject) => {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    reject(new Error('A secure interactive terminal is required to enter the password'));
    return;
  }

  const stdin = process.stdin;
  const stdout = process.stdout;
  let value = '';
  const cleanup = () => {
    stdin.removeListener('data', onData);
    stdin.setRawMode(false);
    stdin.pause();
  };
  const onData = (chunk) => {
    const key = chunk.toString('utf8');
    if (key === '\u0003') {
      cleanup();
      stdout.write('\n');
      reject(new Error('Password reset cancelled'));
      return;
    }
    if (key === '\r' || key === '\n') {
      cleanup();
      stdout.write('\n');
      resolve(value);
      return;
    }
    if (key === '\u007f' || key === '\b') {
      value = value.slice(0, -1);
      return;
    }
    if (key.length === 1 && key >= ' ') {
      value += key;
    }
  };

  stdout.write(prompt);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.on('data', onData);
});

const run = async () => {
  await connectDB();
  if (mongoose.connection.readyState !== 1) {
    throw new Error('MongoDB connection is required for administrator password reset');
  }

  const newPassword = await readHiddenPassword('New administrator password: ');
  const confirmation = await readHiddenPassword('Confirm new administrator password: ');
  if (newPassword !== confirmation) {
    throw new Error('The administrator passwords do not match');
  }

  await resetAdminPassword({ newPassword });
  console.log('Administrator password reset successfully.');
};

if (require.main === module) {
  run()
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
      }
    });
}

module.exports = { resetAdminPassword, normalizeEmail, readHiddenPassword };
