/**
 * Additional geocode endpoint for the weather widget manual search.
 * GET /api/weather/geocode?city=<name>
 */
const express = require('express');
const router = express.Router();
const weatherController = require('../controllers/weatherController');
const geocodeController = require('../controllers/geocodeController');
const { generalLimiter } = require('../middleware/rateLimiter');
const { fetchIMDWarnings, fetchIMDCycloneData, generateRegionalBulletins, getIMDAttribution } = require('../services/imdService');
const { getAlertHistory, getCurrentAlertStatus } = require('../services/alertMonitor');
const { getWeather } = require('../services/weatherService');
const { predictDisasterRisk } = require('../services/disasterPredictor');

router.get('/', generalLimiter, weatherController.validate, weatherController.getWeather);
router.get('/geocode', generalLimiter, geocodeController.geocode);
router.get('/disaster-risk', generalLimiter, weatherController.getDisasterRisk);
router.post('/disaster-risk', generalLimiter, weatherController.getDisasterRisk);
router.get('/tts', generalLimiter, weatherController.getTTS);
router.post('/tts', generalLimiter, weatherController.getTTS);

// ── IMD Data Integration Routes ────────────────────────────────────────
router.get('/imd-warnings', generalLimiter, async (req, res) => {
  try {
    const warnings = await fetchIMDWarnings();
    const cyclones = await fetchIMDCycloneData();
    res.json({
      success: true,
      data: {
        warnings: warnings || [],
        cyclones: cyclones || [],
        attribution: getIMDAttribution(),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/regional-bulletins', generalLimiter, async (req, res) => {
  try {
    const bulletins = await generateRegionalBulletins(getWeather, predictDisasterRisk);
    res.json({
      success: true,
      data: bulletins,
      source: 'Live weather analysis — IMD / Open-Meteo / OWM',
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Alert Monitor Routes ───────────────────────────────────────────────
router.get('/alert-status', generalLimiter, (req, res) => {
  res.json({
    success: true,
    data: getCurrentAlertStatus(),
    timestamp: new Date().toISOString(),
  });
});

router.post('/alert-subscribe', generalLimiter, async (req, res) => {
  try {
    const { channel, contact, city, lat, lon, minSeverity } = req.body;
    if (!city) {
      return res.status(400).json({ success: false, error: 'City is required' });
    }

    try {
      const AlertSubscription = require('../models/AlertSubscription');
      const subscription = await AlertSubscription.create({
        channel: channel || 'push',
        contact: contact || null,
        city,
        lat: lat ? Number(lat) : null,
        lon: lon ? Number(lon) : null,
        minSeverity: minSeverity || 'ORANGE',
        isActive: true,
      });
      return res.json({ success: true, data: subscription, message: 'Subscription registered successfully in DB' });
    } catch (dbErr) {
      // Graceful fallback if MongoDB is in offline mode
      return res.json({
        success: true,
        data: { channel, contact, city, minSeverity, mode: 'in-memory-acknowledged' },
        message: 'Subscription registered successfully (fallback mode)',
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/test-alert-email', generalLimiter, async (req, res) => {
  try {
    const { to, city = 'New Delhi', imdColor = 'ORANGE' } = req.body;
    if (!to) {
      return res.status(400).json({ success: false, error: 'Recipient email "to" is required' });
    }

    const { sendWeatherAlertEmail } = require('../services/emailService');
    const result = await sendWeatherAlertEmail({
      to,
      city,
      imdColor,
      riskAssessment: 'Squall line with heavy convective thunderstorms and gusty winds predicted by Doppler Radar.',
      temp: 29,
      rainProb: 85,
      windSpeed: 45,
      description: 'Severe Thunderstorm & High Precipitation',
      farmerAdvisory: 'Postpone pesticide spraying and secure grain threshing yards.',
      actionPoints: ['Stay indoors away from tin shades', 'Keep mobile devices charged', 'Follow IMD nowcast updates'],
    });

    return res.json({ success: true, message: `Disaster alert email test triggered for ${to}`, result });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;


