const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null, // null = guest session
      index: true,
    },
    // guest session id for unauthenticated users
    guestId: {
      type: String,
      default: null,
      index: true,
    },
    role: {
      type: String,
      required: true,
      default: 'citizen',
    },
    title: {
      type: String,
      default: 'New Conversation',
      maxlength: 120,
    },
    language: {
      type: String,
      default: 'en',
    },
    // Coordinates at the time the conversation was started
    location: {
      lat: { type: Number, default: null },
      lon: { type: Number, default: null },
      locationName: { type: String, default: null },
    },
    messageCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Conversation', conversationSchema);
