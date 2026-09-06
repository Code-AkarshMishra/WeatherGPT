const mongoose = require('mongoose');

const weatherCacheSchema = new mongoose.Schema(
  {
    // Store key as "lat_lon" rounded to 2 decimal places for cache efficiency
    cacheKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    lat: { type: Number, required: true },
    lon: { type: Number, required: true },
    // Full weather API response + enriched data
    data: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    fetchedAt: {
      type: Date,
      default: Date.now,
      // TTL index: documents expire after 10 minutes
      expires: 600,
    },
  },
  { timestamps: false }
);

module.exports = mongoose.model('WeatherCache', weatherCacheSchema);
