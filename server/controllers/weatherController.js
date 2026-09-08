const axios = require('axios');
const { query, validationResult } = require('express-validator');
const { getWeather } = require('../services/weatherService');
const { predictDisasterRisk } = require('../services/disasterPredictor');
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

/**
 * TTS Audio synthesis proxy to ML-2 regional voice engine.
 */
exports.getTTS = async (req, res) => {
  try {
    const { text, lang = 'hi' } = req.body || req.query;
    if (!text) {
      return res.status(400).json({ success: false, error: 'Text parameter required' });
    }

    const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000';
    try {
      const mlRes = await axios.post(`${ML_SERVICE_URL}/tts`, { text }, { timeout: 3000 });
      return res.json({ success: true, data: mlRes.data });
    } catch {
      // Fallback for client-side Web Speech synthesis
      return res.json({
        success: true,
        data: {
          status: 'client_speech_synth',
          text,
          lang: lang === 'hi' ? 'hi-IN' : 'en-IN',
          message: 'Client-side neural speech synthesis active',
        },
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Direct ML-2 MoES disaster risk prediction endpoint.
 * Accepts query or body: { rain_mm, wind_kmph, temp_c, city }
 */
exports.getDisasterRisk = async (req, res) => {
  try {
    const params = { ...req.query, ...req.body };
    const rain = parseFloat(params.rain_mm || params.rainMm || 0) || 0;
    const wind = parseFloat(params.wind_kmph || params.windKmph || params.windSpeed || 0) || 0;
    const temp = parseFloat(params.temp_c || params.tempC || params.temp || 25) || 25;
    const city = params.city || 'Your Area';

    const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';
    try {
      const mlRes = await axios.post(`${ML_SERVICE_URL}/disaster-risk?rain_mm=${rain}&wind_kmph=${wind}&temp_c=${temp}&city=${encodeURIComponent(city)}`, {}, { timeout: 3000 });
      if (mlRes.data) {
        const d = mlRes.data;
        const normalized = {
          city: d.city || city,
          rainMm: d.rain_mm ?? rain,
          windKmph: d.wind_kmph ?? wind,
          tempC: d.temp_c ?? temp,
          imdColorCode: d.imd_color_code || d.imdColorCode || 'GREEN',
          riskAssessment: d.risk_assessment || d.riskAssessment || 'Low',
          statusText: d.status_text || d.statusText || 'No Warning / All Clear',
          statusTextHi: d.status_text_hi || d.statusTextHi || 'कोई चेतावनी नहीं / सामान्य',
          farmerAdvisory: d.farmer_advisory || d.farmerAdvisory || {},
          marineAdvisory: d.marine_advisory || d.marineAdvisory || {},
          actionPoints: d.action_points || d.actionPoints || [],
          spokenTextHi: d.spoken_text_hi || d.spokenTextHi || '',
          spokenTextEn: d.spoken_text_en || d.spokenTextEn || '',
        };
        return res.json({ success: true, data: normalized });
      }
    } catch (mlErr) {
      logger.debug(`ML service disaster risk fallback: ${mlErr.message}`);
    }

    const prediction = predictDisasterRisk({
      rain_mm: rain,
      wind_kmph: wind,
      temp_c: temp,
      city,
    });
    res.json({ success: true, data: prediction });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

