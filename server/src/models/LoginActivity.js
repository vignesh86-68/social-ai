const mongoose = require('mongoose');

const loginActivitySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    ip: { type: String, default: 'unknown' },
    userAgent: { type: String, default: 'unknown' },
    success: { type: Boolean, required: true },
    failureReason: { type: String, default: null }, // e.g., 'wrong_password', 'unverified'
  },
  { timestamps: true }
);

// TTL: auto-delete records older than 90 days
loginActivitySchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

module.exports = mongoose.model('LoginActivity', loginActivitySchema);
