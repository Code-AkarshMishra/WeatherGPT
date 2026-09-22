const mongoose = require('mongoose');

const forecastSchema = new mongoose.Schema(
  {
    location: {
      lat: { type: Number, required: true },
      lon: { type: Number, required: true },
      name: String,
      region: String,
      country: { type: String, default: 'India' },
    },
    type: {
      type: String,
      enum: ['hourly', 'daily', 'unified'],
      required: true,
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    source: {
      type: String,
      required: true,
      default: 'IMD',
    },
    dataUpdatedAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
  },
  {
    timestamps: true,
  }
);

forecastSchema.index({ 'location.lat': 1, 'location.lon': 1, type: 1 });

const Forecast = mongoose.model('Forecast', forecastSchema);

module.exports = Forecast;
