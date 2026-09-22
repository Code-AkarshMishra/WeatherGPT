const { z } = require('zod');
const { SUPPORTED_LANGUAGES, USER_ROLES } = require('../utils/constants');

const chatMessageSchema = {
  body: z.object({
    message: z.string().min(1, 'Message is required').max(2000, 'Message cannot exceed 2000 characters'),
    location: z
      .object({
        name: z.string().optional(),
        region: z.string().optional(),
        country: z.string().default('India'),
        lat: z.number().min(-90).max(90),
        lon: z.number().min(-180).max(180),
      })
      .optional(),
    language: z.enum(SUPPORTED_LANGUAGES).default('en'),
    // SELECT ROLE from UI — shapes AIML persona (citizen, farmer, aviation, …)
    role: z.enum(USER_ROLES).default('citizen'),
    sessionId: z.string().optional(),
  }),
};

module.exports = {
  chatMessageSchema,
};
