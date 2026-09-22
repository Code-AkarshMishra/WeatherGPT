const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    region: {
      type: String,
      trim: true,
      index: true,
    },
    country: {
      type: String,
      default: 'India',
      trim: true,
    },
    lat: {
      type: Number,
      required: true,
      min: -90,
      max: 90,
    },
    lon: {
      type: Number,
      required: true,
      min: -180,
      max: 180,
    },
    coordinates: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
      },
    },
    providerId: {
      type: String,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

locationSchema.index({ coordinates: '2dsphere' });
locationSchema.index({ name: 'text', region: 'text' });
locationSchema.index({ lat: 1, lon: 1 });

// Ensure coordinates sync with lat and lon before saving
locationSchema.pre('validate', function (next) {
  if (this.lat !== undefined && this.lon !== undefined) {
    this.coordinates = {
      type: 'Point',
      coordinates: [this.lon, this.lat],
    };
  }
  next();
});

const Location = mongoose.model('Location', locationSchema);

module.exports = Location;
