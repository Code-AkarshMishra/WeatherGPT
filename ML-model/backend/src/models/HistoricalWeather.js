const mongoose = require('mongoose');

const historicalWeatherSchema = new mongoose.Schema(
  {
    location: {
      name: { type: String, required: true },
      region: String,
      country: { type: String, default: 'India' },
      lat: { type: Number, required: true },
      lon: { type: Number, required: true },
    },
    date: {
      type: String, // YYYY-MM-DD
      required: true,
      index: true,
    },
    metrics: {
      temperatureMax: Number,
      temperatureMin: Number,
      temperatureMean: Number,
      precipitation: Number,
      humidity: Number,
      windSpeedMax: Number,
      pressure: Number,
    },
    source: {
      type: String,
      default: 'IMD-Climate-Archive',
    },
    recordedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

historicalWeatherSchema.index({ 'location.lat': 1, 'location.lon': 1, date: 1 }, { unique: true });

const HistoricalWeather = mongoose.model('HistoricalWeather', historicalWeatherSchema);

module.exports = HistoricalWeather;
