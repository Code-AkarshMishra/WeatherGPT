const weatherService = require('../services/weather/weather.service');
const alertService = require('../services/alerts/alert.service');
const aiService = require('../services/ai/ai.service');
const { sendSuccess } = require('../utils/response');

class AdvisoryController {
  async generateAdvisory(req, res, next) {
    try {
      const { location, domain, context, language } = req.body;

      // 1. Gather weather context
      const [currentWeather, alerts] = await Promise.all([
        weatherService.getCurrentWeather(location.lat, location.lon),
        alertService.getAlertsForLocation(location.name, location.lat, location.lon),
      ]);

      const weatherContext = {
        current: currentWeather.current,
        activeAlerts: alerts,
      };

      // 2. Generate specialized advisory
      const advisory = await aiService.generateAdvisory({
        location,
        domain,
        context,
        language,
        weatherContext,
      });

      return sendSuccess(res, {
        domain,
        language,
        location: currentWeather.location,
        ...advisory.output,
        sources: advisory.sources,
        generatedAt: advisory.generatedAt,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AdvisoryController();
