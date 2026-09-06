/**
 * weatherController.js
 * GET /api/weather?lat=&lon=
 */
const { query, validationResult } = require('express-validator');
const { getWeather } = require('../services/weatherService');
const logger = require('../config/logger');

exports.validate = [
  query('lat')
    .notEmpty().withMessage('lat is required')
    .isFloat({ min: -90, max: 90 }).withMessage('lat must be between -90 and 90'),
  query('lon')
    .notEmpty().withMessage('lon is required')
    .isFloat({ min: -180, max: 180 }).withMessage('lon must be between -180 and 180'),
];

exports.getWeather = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { lat, lon } = req.query;
    logger.info(`Weather request: lat=${lat}, lon=${lon} from ${req.ip}`);

    const weather = await getWeather(parseFloat(lat), parseFloat(lon));

    res.json({ success: true, data: weather });
  } catch (err) {
    if (err.response?.status === 401) {
      return res.status(503).json({
        success: false,
        error: 'Weather service API key invalid. Please check WEATHER_API_KEY.',
      });
    }
    if (err.response?.status === 404) {
      return res.status(404).json({
        success: false,
        error: 'No weather data found for these coordinates.',
      });
    }
    next(err);
  }
};
