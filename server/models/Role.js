const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema(
  {
    roleId: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    icon: {
      type: String,
      default: '🌤️',
    },
    // System prompt template for this role.
    // Use {{WEATHER_CONTEXT}} and {{USER_MESSAGE}} as placeholders.
    systemPromptTemplate: {
      type: String,
      required: true,
    },
    // Quick-access feature chips shown in the sidebar for this role
    features: [
      {
        label: String,
        query: String, // pre-filled query when the chip is tapped
        icon: String,
      },
    ],
    // Environment variable name holding the API key for this role
    apiKeyEnvVar: {
      type: String,
      default: 'GEMINI_API_KEY',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Role', roleSchema);
