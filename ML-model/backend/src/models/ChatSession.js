const mongoose = require('mongoose');

const chatSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
      default: null,
    },
    title: {
      type: String,
      default: 'Weather Assistant Chat',
      trim: true,
    },
    location: {
      name: String,
      region: String,
      country: { type: String, default: 'India' },
      lat: Number,
      lon: Number,
    },
    language: {
      type: String,
      default: 'en',
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

const ChatSession = mongoose.model('ChatSession', chatSessionSchema);

module.exports = ChatSession;
