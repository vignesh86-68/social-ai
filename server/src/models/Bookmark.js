const mongoose = require('mongoose');

const bookmarkSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
      index: true,
    },
    collectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Collection',
      default: null,
    },
  },
  { timestamps: true }
);

// Prevent duplicate bookmarks by the same user for the same post
bookmarkSchema.index({ user: 1, post: 1 }, { unique: true });

module.exports = mongoose.model('Bookmark', bookmarkSchema);

