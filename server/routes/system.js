/**
 * system.js
 * GET /api/system/status
 * System health, database connection, AI microservice & Gemini key status monitoring.
 */
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const axios = require('axios');
const { getKeyStatus } = require('../services/geminiService');

router.get('/status', async (req, res) => {
  const ML_SERVICE_URL = (process.env.ML_SERVICE_URL || 'http://localhost:8000').trim();
  let mlServiceStatus = { status: 'offline', details: 'Unable to reach Python ML service' };

  try {
    const mlRes = await axios.get(`${ML_SERVICE_URL}/system-status`, { timeout: 3000 });
    if (mlRes.data) {
      mlServiceStatus = { status: 'online', details: mlRes.data };
    }
  } catch {
    // Keep offline state
  }

  const dbState = mongoose.connection.readyState;
  const dbStatusMap = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };

  res.json({
    success: true,
    data: {
      serverTime: new Date().toISOString(),
      database: dbStatusMap[dbState] || 'unknown',
      weatherApi: process.env.WEATHER_API_KEY ? 'configured' : 'missing_key',
      aiKeys: getKeyStatus(),
      mlMicroservice: mlServiceStatus,
      websocket: 'active',
    },
  });
});

module.exports = router;
