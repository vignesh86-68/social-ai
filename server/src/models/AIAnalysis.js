const mongoose = require('mongoose');

const aiAnalysisSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', default: null, index: true },
    type: {
      type: String,
      enum: ['community-pulse', 'audience-insights', 'creator-next-move'],
      required: true,
    },
    result: { type: mongoose.Schema.Types.Mixed, required: true },
    model: { type: String, required: true },
    usage: {
      inputCharacters: { type: Number, min: 0 },
      outputCharacters: { type: Number, min: 0 },
    },
  },
  { timestamps: true }
);

aiAnalysisSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('AIAnalysis', aiAnalysisSchema);
