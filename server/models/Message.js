const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    role: {
      type: String,
      required: true,
      enum: ['user', 'assistant'],
    },
    content: {
      type: String,
      required: true,
      maxlength: [8000, 'Message content too long'],
    },
    // NLP analysis results (logged for debugging/demo)
    intent: {
      type: String,
      default: null,
    },
    entities: {
      location: { type: String, default: null },
      timeEntity: { type: String, default: null },
      language: { type: String, default: 'en' },
    },
    // Weather snapshot injected as context for this message
    weatherContext: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    // File/image attachment metadata (future use)
    attachments: [
      {
        filename: String,
        url: String,
        mimeType: String,
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Message', messageSchema);
