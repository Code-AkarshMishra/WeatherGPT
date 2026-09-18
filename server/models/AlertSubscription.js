const mongoose = require('mongoose');

const AlertSubscriptionSchema = new mongoose.Schema(
  {
    channel: {
      type: String,
      enum: ['push', 'sms', 'whatsapp', 'email'],
      default: 'push',
      required: true,
    },
    contact: {
      type: String,
      trim: true,
      default: null,
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    lat: {
      type: Number,
      default: null,
    },
    lon: {
      type: Number,
      default: null,
    },
    minSeverity: {
      type: String,
      enum: ['YELLOW', 'ORANGE', 'RED'],
      default: 'ORANGE',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

AlertSubscriptionSchema.index({ city: 1, isActive: 1 });
AlertSubscriptionSchema.index({ channel: 1, contact: 1 });

module.exports = mongoose.model('AlertSubscription', AlertSubscriptionSchema);
