const { z } = require('zod');
const { ALERT_SEVERITIES, ALERT_TYPES } = require('../utils/constants');

const listAlertsSchema = {
  query: z.object({
    severity: z.enum(Object.values(ALERT_SEVERITIES)).optional(),
    type: z.enum(Object.values(ALERT_TYPES)).optional(),
    active: z
      .string()
      .optional()
      .transform((val) => (val !== undefined ? val === 'true' : undefined)),
    location: z.string().optional(),
    page: z
      .string()
      .optional()
      .transform((v) => (v ? parseInt(v, 10) : 1)),
    limit: z
      .string()
      .optional()
      .transform((v) => (v ? parseInt(v, 10) : 20)),
  }),
};

const alertLocationSchema = {
  params: z.object({
    locationId: z.string().min(1, 'locationId is required'),
  }),
};

const alertIdSchema = {
  params: z.object({
    alertId: z.string().min(1, 'alertId is required'),
  }),
};

const mapAlertsSchema = {
  query: z.object({
    bbox: z
      .string()
      .optional()
      .refine(
        (val) => {
          if (!val) return true;
          const parts = val.split(',').map(Number);
          return parts.length === 4 && parts.every((n) => !isNaN(n));
        },
        { message: 'bbox must be minLon,minLat,maxLon,maxLat' }
      ),
    severity: z.enum(Object.values(ALERT_SEVERITIES)).optional(),
  }),
};

module.exports = {
  listAlertsSchema,
  alertLocationSchema,
  alertIdSchema,
  mapAlertsSchema,
};
