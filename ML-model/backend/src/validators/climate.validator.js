const { z } = require('zod');

const climateHistorySchema = {
  query: z.object({
    lat: z
      .string()
      .transform((v) => parseFloat(v))
      .refine((v) => !isNaN(v) && v >= -90 && v <= 90, {
        message: 'lat must be between -90 and 90',
      }),
    lon: z
      .string()
      .transform((v) => parseFloat(v))
      .refine((v) => !isNaN(v) && v >= -180 && v <= 180, {
        message: 'lon must be between -180 and 180',
      }),
    start: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'start date must be in YYYY-MM-DD format' }),
    end: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'end date must be in YYYY-MM-DD format' }),
  }),
};

const climateTrendSchema = {
  query: z.object({
    lat: z
      .string()
      .transform((v) => parseFloat(v))
      .refine((v) => !isNaN(v) && v >= -90 && v <= 90, {
        message: 'lat must be between -90 and 90',
      }),
    lon: z
      .string()
      .transform((v) => parseFloat(v))
      .refine((v) => !isNaN(v) && v >= -180 && v <= 180, {
        message: 'lon must be between -180 and 180',
      }),
    start: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'start date must be in YYYY-MM-DD format' }),
    end: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'end date must be in YYYY-MM-DD format' }),
    metric: z.enum(['temperature', 'precipitation', 'humidity', 'windSpeed']).default('temperature'),
  }),
};

module.exports = {
  climateHistorySchema,
  climateTrendSchema,
};
