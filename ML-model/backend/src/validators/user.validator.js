const { z } = require('zod');
const { SUPPORTED_LANGUAGES, ADVISORY_DOMAINS } = require('../utils/constants');

const updatePreferencesSchema = {
  body: z.object({
    language: z.enum(SUPPORTED_LANGUAGES).optional(),
    units: z.enum(['metric', 'imperial']).optional(),
    advisoryPersona: z.enum(Object.values(ADVISORY_DOMAINS)).optional(),
    notificationPreferences: z
      .object({
        pushAlerts: z.boolean().optional(),
        emailAlerts: z.boolean().optional(),
        minSeverity: z.enum(['LOW', 'MODERATE', 'HIGH', 'EXTREME']).optional(),
      })
      .optional(),
    voicePreference: z.string().optional(),
  }),
};

const savedLocationSchema = {
  body: z.object({
    name: z.string().min(1, 'Location name is required'),
    region: z.string().optional(),
    country: z.string().default('India'),
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
    isDefault: z.boolean().optional(),
  }),
};

module.exports = {
  updatePreferencesSchema,
  savedLocationSchema,
};
