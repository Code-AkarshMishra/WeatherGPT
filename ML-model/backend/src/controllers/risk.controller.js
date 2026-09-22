const weatherService = require('../services/weather/weather.service');
const alertService = require('../services/alerts/alert.service');
const aiService = require('../services/ai/ai.service');
const locationService = require('../services/location/location.service');
const CacheService = require('../services/cache/cache.service');
const { CACHE_TTL } = require('../utils/constants');
const { sendSuccess } = require('../utils/response');

class RiskController {
  async getRiskScore(req, res, next) {
    try {
      const { lat, lon } = req.query;
      const cacheKey = CacheService.makeKey('risk:score', lat, lon);

      const cached = await CacheService.get(cacheKey);
      if (cached) {
        return sendSuccess(res, cached);
      }

      // Gather weather + location + alerts context
      const [weather, location] = await Promise.all([
        weatherService.getCurrentWeather(lat, lon),
        locationService.resolveLocation(lat, lon),
      ]);

      const alerts = await alertService.getAlertsForLocation(location.name, lat, lon);

      // Compute multi-factor risk via AI service (no local invented fallback)
      const riskData = await aiService.calculateRisk(weather, alerts, location);

      const result = {
        available: riskData.available !== false,
        location: weather.location,
        score: riskData.score,
        level: riskData.level,
        factors: riskData.factors,
        sourceContext: riskData.sourceContext,
        modelVersion: riskData.modelVersion,
        explanation: riskData.explanation,
        officialWarning: riskData.officialWarning === true,
        generatedAt: riskData.generatedAt,
      };

      await CacheService.set(cacheKey, result, CACHE_TTL.RISK_SCORE);

      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new RiskController();
