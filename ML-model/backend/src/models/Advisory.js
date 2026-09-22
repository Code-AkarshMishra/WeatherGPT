const mongoose = require('mongoose');
const { ADVISORY_DOMAINS } = require('../utils/constants');

const advisorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    location: {
      id: String,
      name: String,
      region: String,
      country: { type: String, default: 'India' },
      lat: { type: Number, required: true },
      lon: { type: Number, required: true },
    },
    domain: {
      type: String,
      required: true,
      enum: Object.values(ADVISORY_DOMAINS),
    },
    language: {
      type: String,
      default: 'en',
    },
    inputContext: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    output: {
      title: { type: String, required: true },
      recommendation: { type: String, required: true },
      actionPoints: [{ type: String }],
      factors: [
        {
          name: String,
          value: mongoose.Schema.Types.Mixed,
        },
      ],
      limitations: [{ type: String }],
    },
    sources: [
      {
        type: String,
      },
    ],
    generatedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

advisorySchema.index({ 'location.lat': 1, 'location.lon': 1, domain: 1, generatedAt: -1 });

const Advisory = mongoose.model('Advisory', advisorySchema);

module.exports = Advisory;
