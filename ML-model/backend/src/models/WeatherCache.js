const mongoose = require('mongoose');

const weatherCacheSchema = new mongoose.Schema(
  {
    cacheKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    location: {
      id: String,
      name: { type: String, required: true },
      region: String,
      country: { type: String, default: 'India' },
      lat: { type: Number, required: true },
      lon: { type: Number, required: true },
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
    retrievedAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // TTL index
    },
  },
  {
    timestamps: true,
  }
);

const WeatherCache = mongoose.model('WeatherCache', weatherCacheSchema);

module.exports = WeatherCache;
