require('dotenv').config();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const User = require('../src/models/User');

const normalizeEmail = (email) => email.toLowerCase().trim();

const correctAdminEmail = async ({
  currentEmail = process.env.ADMIN_CURRENT_EMAIL,
  newEmail = process.env.ADMIN_NEW_EMAIL,
  password = process.env.ADMIN_PASSWORD,
  UserModel = User,
} = {}) => {
  if (!currentEmail || !newEmail || !password) {
    throw new Error('Set ADMIN_CURRENT_EMAIL, ADMIN_NEW_EMAIL, and ADMIN_PASSWORD runtime values');
  }

  const normalizedCurrentEmail = normalizeEmail(currentEmail);
  const normalizedNewEmail = normalizeEmail(newEmail);
  if (normalizedCurrentEmail === normalizedNewEmail) {
    throw new Error('The intended administrator email must differ from the current email');
  }

  const currentUsers = await UserModel.find({ email: normalizedCurrentEmail }).select('+passwordHash');
  if (currentUsers.length !== 1) {
    throw new Error('Exactly one account must match ADMIN_CURRENT_EMAIL');
  }

  const admin = currentUsers[0];
  if (admin.role !== 'admin' || !admin.isVerified || !admin.isActive) {
    throw new Error('The matching account must be a verified and active administrator');
  }
  if (!admin.passwordHash || !(await bcrypt.compare(password, admin.passwordHash))) {
    throw new Error('ADMIN_PASSWORD does not match the existing administrator credentials');
  }

  const targetUsers = await UserModel.find({ email: normalizedNewEmail }).select('_id');
  if (targetUsers.length > 0) {
    throw new Error('ADMIN_NEW_EMAIL is already used by another account');
  }

  try {
    const result = await UserModel.updateOne(
      {
        _id: admin._id,
        email: normalizedCurrentEmail,
        role: 'admin',
        isVerified: true,
        isActive: true,
      },
      { $set: { email: normalizedNewEmail } },
    );
    if (result.modifiedCount !== 1) {
      throw new Error('Administrator changed during correction; email update refused');
    }
  } catch (error) {
    if (error?.code === 11000) {
      throw new Error('ADMIN_NEW_EMAIL is already used by another account');
    }
    throw error;
  }

  return { action: 'updated', userId: admin._id };
};

const run = async () => {
  await connectDB();
  await correctAdminEmail();
  console.log('Administrator email corrected successfully.');
};

if (require.main === module) {
  run()
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      await mongoose.disconnect();
    });
}

module.exports = { correctAdminEmail, normalizeEmail };
