const { z } = require('zod');

const searchLocationSchema = {
  query: z.object({
    q: z.string().min(1, 'Search query q is required').max(100),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 10)),
  }),
};

const getLocationByIdSchema = {
  params: z.object({
    id: z.string().min(1, 'Location ID is required'),
  }),
};

const reverseGeocodeSchema = {
  query: z.object({
    lat: z.string().transform((val) => parseFloat(val)),
    lon: z.string().transform((val) => parseFloat(val)),
  }),
};

module.exports = {
  searchLocationSchema,
  getLocationByIdSchema,
  reverseGeocodeSchema,
};
