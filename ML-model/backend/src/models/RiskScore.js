const mongoose = require('mongoose');

const riskScoreSchema = new mongoose.Schema(
  {
    location: {
      id: String,
      name: String,
      region: String,
      country: { type: String, default: 'India' },
      lat: { type: Number, required: true },
      lon: { type: Number, required: true },
    },
    score: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    level: {
      type: String,
      enum: ['LOW', 'MODERATE', 'HIGH', 'EXTREME'],
      required: true,
    },
    factors: [
      {
        name: { type: String, required: true },
        value: { type: mongoose.Schema.Types.Mixed, required: true },
      },
    ],
    sourceContext: [
      {
        type: String,
      },
    ],
    modelVersion: {
      type: String,
      default: 'WeatherGPT-Risk-v1.2',
    },
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

riskScoreSchema.index({ 'location.lat': 1, 'location.lon': 1, generatedAt: -1 });

const RiskScore = mongoose.model('RiskScore', riskScoreSchema);

module.exports = RiskScore;
