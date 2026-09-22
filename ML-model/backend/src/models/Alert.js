const mongoose = require('mongoose');
const { ALERT_SEVERITIES, ALERT_TYPES } = require('../utils/constants');

const alertSchema = new mongoose.Schema(
  {
    sourceAlertId: {
      type: String,
      required: true,
      index: true,
    },
    source: {
      type: String,
      required: true,
      default: 'IMD',
    },
    type: {
      type: String,
      required: true,
      enum: Object.values(ALERT_TYPES),
      default: ALERT_TYPES.OTHER,
    },
    severity: {
      type: String,
      required: true,
      enum: Object.values(ALERT_SEVERITIES),
      default: ALERT_SEVERITIES.MODERATE,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    affectedAreas: [
      {
        type: String,
        trim: true,
      },
    ],
    issuedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    validFrom: {
      type: Date,
      required: true,
      default: Date.now,
    },
    validUntil: {
      type: Date,
      required: true,
    },
    geometry: {
      type: {
        type: String,
        enum: ['Polygon', 'MultiPolygon', 'Point'],
      },
      coordinates: mongoose.Schema.Types.Mixed,
    },
    sourceUrl: {
      type: String,
    },
    retrievedAt: {
      type: Date,
      default: Date.now,
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

alertSchema.index({ sourceAlertId: 1, source: 1 }, { unique: true });
alertSchema.index({ active: 1, severity: 1 });
alertSchema.index({ validUntil: 1 });
alertSchema.index({ affectedAreas: 1 });
alertSchema.index({ geometry: '2dsphere' });

const Alert = mongoose.model('Alert', alertSchema);

module.exports = Alert;
