const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { SUPPORTED_LANGUAGES, ADVISORY_DOMAINS } = require('../utils/constants');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters long'],
      select: false,
    },
    preferences: {
      language: {
        type: String,
        enum: SUPPORTED_LANGUAGES,
        default: 'en',
      },
      units: {
        type: String,
        enum: ['metric', 'imperial'],
        default: 'metric',
      },
      advisoryPersona: {
        type: String,
        enum: Object.values(ADVISORY_DOMAINS),
        default: 'general',
      },
      notificationPreferences: {
        pushAlerts: { type: Boolean, default: true },
        emailAlerts: { type: Boolean, default: false },
        minSeverity: {
          type: String,
          enum: ['LOW', 'MODERATE', 'HIGH', 'EXTREME'],
          default: 'MODERATE',
        },
      },
      voicePreference: {
        type: String,
        default: 'female-clear',
      },
    },
    savedLocations: [
      {
        name: { type: String, required: true },
        region: { type: String },
        country: { type: String, default: 'India' },
        lat: { type: Number, required: true },
        lon: { type: Number, required: true },
        isDefault: { type: Boolean, default: false },
      },
    ],
  },
  {
    timestamps: true,
  }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toSafeObject = function () {
  const user = this.toObject();
  delete user.password;
  return user;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
