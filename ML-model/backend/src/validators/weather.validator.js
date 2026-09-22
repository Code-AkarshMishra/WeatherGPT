const { z } = require('zod');

const coordinateQuerySchema = {
  query: z.object({
    lat: z
      .string()
      .transform((v) => parseFloat(v))
      .refine((v) => !isNaN(v) && v >= -90 && v <= 90, {
        message: 'lat must be a valid number between -90 and 90',
      }),
    lon: z
      .string()
      .transform((v) => parseFloat(v))
      .refine((v) => !isNaN(v) && v >= -180 && v <= 180, {
        message: 'lon must be a valid number between -180 and 180',
      }),
  }),
};

const hourlyWeatherSchema = {
  query: z.object({
    lat: z
      .string()
      .transform((v) => parseFloat(v))
      .refine((v) => !isNaN(v) && v >= -90 && v <= 90, {
        message: 'lat must be a valid number between -90 and 90',
      }),
    lon: z
      .string()
      .transform((v) => parseFloat(v))
      .refine((v) => !isNaN(v) && v >= -180 && v <= 180, {
        message: 'lon must be a valid number between -180 and 180',
      }),
    hours: z
      .string()
      .optional()
      .transform((v) => (v ? parseInt(v, 10) : 24))
      .refine((v) => v >= 1 && v <= 168, { message: 'hours must be between 1 and 168' }),
  }),
};

const dailyWeatherSchema = {
  query: z.object({
    lat: z
      .string()
      .transform((v) => parseFloat(v))
      .refine((v) => !isNaN(v) && v >= -90 && v <= 90, {
        message: 'lat must be a valid number between -90 and 90',
      }),
    lon: z
      .string()
      .transform((v) => parseFloat(v))
      .refine((v) => !isNaN(v) && v >= -180 && v <= 180, {
        message: 'lon must be a valid number between -180 and 180',
      }),
    days: z
      .string()
      .optional()
      .transform((v) => (v ? parseInt(v, 10) : 7))
      .refine((v) => v >= 1 && v <= 16, { message: 'days must be between 1 and 16' }),
  }),
};

module.exports = {
  coordinateQuerySchema,
  hourlyWeatherSchema,
  dailyWeatherSchema,
};
