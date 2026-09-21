/**
 * intelligence.js
 * Express routes for WeatherGPT 2.0 ML Intelligence Service.
 * Proxies and augments calls to https://weathergpt2-0.onrender.com.
 */
const express = require('express');
const router = express.Router();
const mlClient = require('../services/mlClient');
const { generalLimiter } = require('../middleware/rateLimiter');
const logger = require('../config/logger');

// GET /api/intelligence/health & /model-info
router.get('/health', generalLimiter, async (req, res) => {
  const health = await mlClient.checkHealth();
  res.json({ success: true, data: health });
});

router.get('/model-info', generalLimiter, async (req, res) => {
  try {
    const info = await mlClient.getModelInfo();
    res.json({ success: true, data: info });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/intelligence/risk-score
router.post('/risk-score', generalLimiter, async (req, res) => {
  try {
    const { location, hazard = 'composite', weather_context, forecast_context, alert_context } = req.body;
    const result = await mlClient.calculateRiskScore({
      location,
      hazard,
      weather_context,
      forecast_context,
      alert_context,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error(`[API /risk-score] error: ${err.message}`);
    res.status(err.response?.status || 500).json({
      success: false,
      error: err.response?.data?.detail || err.message,
    });
  }
});

// POST /api/intelligence/risk-explain
router.post('/risk-explain', generalLimiter, async (req, res) => {
  try {
    const result = await mlClient.getRiskExplanation(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error(`[API /risk-explain] error: ${err.message}`);
    res.status(err.response?.status || 500).json({
      success: false,
      error: err.response?.data?.detail || err.message,
    });
  }
});

// POST /api/intelligence/advisory
router.post('/advisory', generalLimiter, async (req, res) => {
  try {
    const { location, domain = 'agriculture' } = req.body;
    const result = await mlClient.getDomainAdvisory({ location, domain });
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error(`[API /advisory] error: ${err.message}`);
    res.status(err.response?.status || 500).json({
      success: false,
      error: err.response?.data?.detail || err.message,
    });
  }
});

// POST /api/intelligence/anomaly
router.post('/anomaly', generalLimiter, async (req, res) => {
  try {
    const { location } = req.body;
    const result = await mlClient.detectAnomalies({ location });
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error(`[API /anomaly] error: ${err.message}`);
    res.status(err.response?.status || 500).json({
      success: false,
      error: err.response?.data?.detail || err.message,
    });
  }
});

// POST /api/intelligence/climate-analyze
router.post('/climate-analyze', generalLimiter, async (req, res) => {
  try {
    const { location } = req.body;
    const result = await mlClient.analyzeClimate({ location });
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error(`[API /climate-analyze] error: ${err.message}`);
    res.status(err.response?.status || 500).json({
      success: false,
      error: err.response?.data?.detail || err.message,
    });
  }
});

// POST /api/intelligence/nwp-hazard
router.post('/nwp-hazard', generalLimiter, async (req, res) => {
  try {
    const { location, role = 'citizen', hours = 48 } = req.body;
    const result = await mlClient.assessNWPHazards({ location, role, hours });
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error(`[API /nwp-hazard] error: ${err.message}`);
    res.status(err.response?.status || 500).json({
      success: false,
      error: err.response?.data?.detail || err.message,
    });
  }
});

// POST /api/intelligence/historical-analysis
router.post('/historical-analysis', generalLimiter, async (req, res) => {
  try {
    const result = await mlClient.getHistoricalAnalysis(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error(`[API /historical-analysis] error: ${err.message}`);
    res.status(err.response?.status || 500).json({
      success: false,
      error: err.response?.data?.detail || err.message,
    });
  }
});

// POST /api/intelligence/nwp-verification
router.post('/nwp-verification', generalLimiter, async (req, res) => {
  try {
    const result = await mlClient.verifyNWPForecast(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error(`[API /nwp-verification] error: ${err.message}`);
    res.status(err.response?.status || 500).json({
      success: false,
      error: err.response?.data?.detail || err.message,
    });
  }
});

module.exports = router;
