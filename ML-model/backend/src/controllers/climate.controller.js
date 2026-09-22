const climateService = require('../services/climate/climate.service');
const { sendSuccess } = require('../utils/response');

class ClimateController {
  async getHistory(req, res, next) {
    try {
      const { lat, lon, start, end } = req.query;
      const history = await climateService.getHistory(lat, lon, start, end);
      return sendSuccess(res, history);
    } catch (error) {
      next(error);
    }
  }

  async getTrend(req, res, next) {
    try {
      const { lat, lon, start, end, metric } = req.query;
      const trend = await climateService.getTrend(lat, lon, start, end, metric);
      return sendSuccess(res, trend);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ClimateController();
