const mongoose = require('mongoose');

const refreshSessionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  tokenHash: {
    type: String,
    required: true,
    select: false,
  },
  ip: { type: String, default: 'unknown' },
  userAgent: { type: String, default: 'unknown' },
  expiresAt: {
    type: Date,
    required: true,
    index: { expireAfterSeconds: 0 }, // MongoDB TTL
  },
  isRevoked: { type: Boolean, default: false },
});

// Fast lookup for token rotation
refreshSessionSchema.index({ user: 1, isRevoked: 1 });

module.exports = mongoose.model('RefreshSession', refreshSessionSchema);
