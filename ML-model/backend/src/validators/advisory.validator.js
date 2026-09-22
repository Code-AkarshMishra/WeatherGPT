const { z } = require('zod');
const { ADVISORY_DOMAINS, SUPPORTED_LANGUAGES } = require('../utils/constants');

const advisorySchema = {
  body: z.object({
    location: z.object({
      name: z.string().optional(),
      region: z.string().optional(),
      country: z.string().default('India'),
      lat: z.number().min(-90).max(90),
      lon: z.number().min(-180).max(180),
    }),
    domain: z.enum(Object.values(ADVISORY_DOMAINS)),
    context: z.record(z.any()).optional().default({}),
    language: z.enum(SUPPORTED_LANGUAGES).default('en'),
  }),
};

module.exports = {
  advisorySchema,
};
