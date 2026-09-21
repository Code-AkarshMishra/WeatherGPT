/**
 * mlClient.js
 * Client wrapper for the deployed WeatherGPT 2.0 ML Intelligence Service.
 * Remote URL: https://weathergpt2-0.onrender.com
 */
const axios = require('axios');
const logger = require('../config/logger');

const getBaseUrl = () => {
  return (process.env.ML_SERVICE_URL || 'https://weathergpt2-0.onrender.com').trim().replace(/\/+$/, '');
};

const client = axios.create({
  timeout: 25000,
  headers: {
    'Content-Type': 'application/json',
    'User-Agent': 'WeatherGPT-NodeServer/2.0',
  },
});

/**
 * Health check
 */
async function checkHealth() {
  const url = `${getBaseUrl()}/health`;
  try {
    const res = await client.get(url, { timeout: 6000 });
    return { online: true, data: res.data };
  } catch (err) {
    logger.warn(`[ML Client] Health check failed at ${url}: ${err.message}`);
    return { online: false, error: err.message };
  }
}

/**
 * Model info and capability metadata
 */
async function getModelInfo() {
  const url = `${getBaseUrl()}/model-info`;
  try {
    const res = await client.get(url, { timeout: 8000 });
    return res.data;
  } catch (err) {
    logger.warn(`[ML Client] Failed to fetch model-info: ${err.message}`);
    return {
      service: 'weathergpt-ai-offline',
      risk_engine: { model_version: 'rule-v1', supported_hazards: ['heat', 'heavy_rain', 'thunderstorm', 'high_wind', 'fog_visibility', 'cold_wave', 'composite'] },
      multilingual_support: ['en', 'hi', 'bn', 'te', 'mr', 'ta', 'ur', 'gu', 'kn', 'ml', 'pa', 'or'],
      status: 'offline',
    };
  }
}

/**
 * Unified Chat with Agent
 */
async function sendChat({ message, role = 'citizen', location = null, lang = 'en', history = [] }) {
  const url = `${getBaseUrl()}/chat`;
  try {
    const payload = {
      message,
      role,
      location: location
        ? {
            lat: Number(location.lat) || undefined,
            lon: Number(location.lon) || undefined,
            name: location.name || undefined,
          }
        : undefined,
      lang,
    };
    const res = await client.post(url, payload, { timeout: 18000 });
    return res.data;
  } catch (err) {
    logger.warn(`[ML Client] Chat endpoint failed (${err.message})`);
    return null;
  }
}

/**
 * Multi-hazard Risk Scoring
 */
async function calculateRiskScore({ location, hazard = 'composite', weather_context = null, forecast_context = null, alert_context = null }) {
  const url = `${getBaseUrl()}/risk/score`;
  try {
    const payload = {
      hazard,
      location: location ? {
        name: location.name || location.city || 'Current Location',
        lat: location.lat ? Number(location.lat) : undefined,
        lon: location.lon ? Number(location.lon) : undefined,
      } : undefined,
      weather_context: weather_context || undefined,
      forecast_context: forecast_context || undefined,
      alert_context: alert_context || undefined,
    };
    const res = await client.post(url, payload);
    return res.data;
  } catch (err) {
    logger.warn(`[ML Client] Risk score failed: ${err.message}`);
    throw err;
  }
}

/**
 * Risk Score Explanation
 */
async function getRiskExplanation(params) {
  const url = `${getBaseUrl()}/risk/explain`;
  try {
    const res = await client.post(url, params);
    return res.data;
  } catch (err) {
    logger.warn(`[ML Client] Risk explain failed: ${err.message}`);
    throw err;
  }
}

/**
 * Multi-domain Advisory Engine
 */
async function getDomainAdvisory({ location, domain = 'agriculture' }) {
  const url = `${getBaseUrl()}/advisory`;
  try {
    const payload = {
      domain,
      location: {
        name: location?.name || location?.city || 'Local Region',
        lat: location?.lat ? Number(location.lat) : undefined,
        lon: location?.lon ? Number(location.lon) : undefined,
      },
    };
    const res = await client.post(url, payload);
    return res.data;
  } catch (err) {
    logger.warn(`[ML Client] Advisory generation failed: ${err.message}`);
    throw err;
  }
}

/**
 * ERA5 Anomaly Detection
 */
async function detectAnomalies({ location }) {
  const url = `${getBaseUrl()}/anomaly/detect`;
  try {
    const payload = {
      location: {
        name: location?.name || location?.city || 'Selected Region',
        lat: location?.lat ? Number(location.lat) : undefined,
        lon: location?.lon ? Number(location.lon) : undefined,
      },
    };
    const res = await client.post(url, payload);
    return res.data;
  } catch (err) {
    logger.warn(`[ML Client] Anomaly detection failed: ${err.message}`);
    throw err;
  }
}

/**
 * Multi-year ERA5 Climate Trend Analysis
 */
async function analyzeClimate({ location }) {
  const url = `${getBaseUrl()}/climate/analyze`;
  try {
    const payload = {
      location: {
        name: location?.name || location?.city || 'Selected Region',
        lat: location?.lat ? Number(location.lat) : undefined,
        lon: location?.lon ? Number(location.lon) : undefined,
      },
    };
    const res = await client.post(url, payload);
    return res.data;
  } catch (err) {
    logger.warn(`[ML Client] Climate analysis failed: ${err.message}`);
    throw err;
  }
}

/**
 * Multi-model NWP Hazard Assessment (GFS + ECMWF IFS)
 */
async function assessNWPHazards({ location, role = 'citizen', hours = 48 }) {
  const url = `${getBaseUrl()}/nwp/hazard-assessment`;
  try {
    const payload = {
      location: {
        name: location?.name || location?.city || 'Selected Region',
        lat: location?.lat ? Number(location.lat) : undefined,
        lon: location?.lon ? Number(location.lon) : undefined,
      },
      role,
      hours: Number(hours) || 48,
    };
    const res = await client.post(url, payload);
    return res.data;
  } catch (err) {
    logger.warn(`[ML Client] NWP hazard assessment failed: ${err.message}`);
    throw err;
  }
}

/**
 * Historical Analysis & Multi-City Comparison
 */
async function getHistoricalAnalysis(payload) {
  const url = `${getBaseUrl()}/climate/historical-analysis`;
  try {
    const res = await client.post(url, payload);
    return res.data;
  } catch (err) {
    logger.warn(`[ML Client] Historical analysis failed: ${err.message}`);
    throw err;
  }
}

/**
 * NWP Forecast Verification (24h lead)
 */
async function verifyNWPForecast(payload) {
  const url = `${getBaseUrl()}/climate/nwp-verification`;
  try {
    const res = await client.post(url, payload);
    return res.data;
  } catch (err) {
    logger.warn(`[ML Client] NWP verification failed: ${err.message}`);
    throw err;
  }
}

module.exports = {
  getBaseUrl,
  checkHealth,
  getModelInfo,
  sendChat,
  calculateRiskScore,
  getRiskExplanation,
  getDomainAdvisory,
  detectAnomalies,
  analyzeClimate,
  assessNWPHazards,
  getHistoricalAnalysis,
  verifyNWPForecast,
};
