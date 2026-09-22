const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChatSession',
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['user', 'assistant', 'system', 'tool'],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    structuredData: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    sources: [
      {
        type: String,
      },
    ],
  },
  {
    timestamps: true,
  }
);

chatMessageSchema.index({ sessionId: 1, createdAt: 1 });

const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);

module.exports = ChatMessage;
