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

    const { lat, lon, city } = req.query;
    logger.info(`Weather request: lat=${lat}, lon=${lon}, city=${city || 'none'} from ${req.ip}`);

    const weather = await getWeather(parseFloat(lat), parseFloat(lon), city);

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
 * TTS Audio synthesis proxy to regional voice engine.
 */
exports.getTTS = async (req, res) => {
  try {
    const { text, lang = 'hi' } = req.body || req.query;
    if (!text) {
      return res.status(400).json({ success: false, error: 'Text parameter required' });
    }

    const ML_SERVICE_URL = (process.env.ML_SERVICE_URL || 'https://weathergpt2-0.onrender.com').trim();
    try {
      const mlRes = await axios.post(`${ML_SERVICE_URL}/tts`, { text }, { timeout: 4000 });
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
 * MoES disaster risk prediction endpoint powered by deployed ML 2.0 Engine.
 * Accepts query or body: { rain_mm, wind_kmph, temp_c, city, lat, lon }
 */
exports.getDisasterRisk = async (req, res) => {
  try {
    const params = { ...req.query, ...req.body };
    const rain = parseFloat(params.rain_mm || params.rainMm || 0) || 0;
    const wind = parseFloat(params.wind_kmph || params.windKmph || params.windSpeed || 0) || 0;
    const temp = parseFloat(params.temp_c || params.tempC || params.temp || 25) || 25;
    const city = params.city || 'Your Area';
    const lat = params.lat ? parseFloat(params.lat) : undefined;
    const lon = params.lon ? parseFloat(params.lon) : undefined;

    const mlClient = require('../services/mlClient');
    try {
      const mlScore = await mlClient.calculateRiskScore({
        location: { name: city, lat, lon },
        hazard: params.hazard || 'composite',
        weather_context: {
          temperature: temp,
          rainfall_rate: rain,
          wind_speed: wind,
        },
      });

      if (mlScore && mlScore.score !== undefined) {
        const imdColor = mlScore.level === 'EXTREME' ? 'RED' : mlScore.level === 'HIGH' ? 'ORANGE' : mlScore.level === 'MODERATE' ? 'YELLOW' : 'GREEN';
        const fallbackLocal = predictDisasterRisk({ rain_mm: rain, wind_kmph: wind, temp_c: temp, city });

        return res.json({
          success: true,
          data: {
            city,
            rainMm: rain,
            windKmph: wind,
            tempC: temp,
            score: mlScore.score,
            level: mlScore.level,
            confidence: mlScore.confidence,
            factors: mlScore.factors || [],
            inputVariables: mlScore.input_variables || {},
            featureWeights: mlScore.feature_weights || {},
            explanation: mlScore.explanation,
            imdColorCode: imdColor,
            riskAssessment: mlScore.level,
            statusText: fallbackLocal.statusText,
            statusTextHi: fallbackLocal.statusTextHi,
            farmerAdvisory: fallbackLocal.farmerAdvisory,
            marineAdvisory: fallbackLocal.marineAdvisory,
            actionPoints: fallbackLocal.actionPoints,
            spokenTextHi: fallbackLocal.spokenTextHi,
            spokenTextEn: fallbackLocal.spokenTextEn,
            provider: 'weathergpt-ml2.0-cloud',
          },
        });
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
    res.json({ success: true, data: { ...prediction, provider: 'node-disaster-engine' } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

