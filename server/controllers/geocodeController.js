/**
 * geocodeController.js
 * GET /api/weather/geocode?city=<name>
 * Resolves a city name to lat/lon using OpenWeatherMap geocoding API.
 */
const { query, validationResult } = require('express-validator');
const axios = require('axios');
const logger = require('../config/logger');

exports.validate = [
  query('city').notEmpty().trim().isLength({ min: 1, max: 100 }).withMessage('City name required'),
];

exports.geocode = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { city } = req.query;
    logger.info(`Geocoding city: "${city}"`);

    const response = await axios.get('https://api.openweathermap.org/geo/1.0/direct', {
      params: { q: city, limit: 1, appid: process.env.WEATHER_API_KEY },
      timeout: 5000,
    });

    if (!response.data || response.data.length === 0) {
      return res.status(404).json({ success: false, error: `No location found for "${city}".` });
    }

    const { lat, lon, name, country } = response.data[0];
    res.json({ success: true, data: { lat, lon, name, country } });
  } catch (err) {
    next(err);
  }
};
