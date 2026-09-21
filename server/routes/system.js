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

const mlClient = require('../services/mlClient');

router.get('/status', async (req, res) => {
  let mlServiceStatus = { status: 'offline', details: 'Unable to reach WeatherGPT 2.0 Cloud ML service' };

  try {
    const health = await mlClient.checkHealth();
    if (health.online) {
      const modelInfo = await mlClient.getModelInfo();
      mlServiceStatus = {
        status: 'online',
        details: {
          ...health.data,
          ...modelInfo,
          serviceUrl: mlClient.getBaseUrl(),
        },
      };
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
