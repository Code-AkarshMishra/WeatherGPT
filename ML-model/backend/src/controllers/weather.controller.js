const weatherService = require('../services/weather/weather.service');
const { sendSuccess } = require('../utils/response');

class WeatherController {
  async getCurrent(req, res, next) {
    try {
      const { lat, lon } = req.query;
      const weather = await weatherService.getCurrentWeather(lat, lon);
      return sendSuccess(res, weather);
    } catch (error) {
      next(error);
    }
  }

  async getHourly(req, res, next) {
    try {
      const { lat, lon, hours } = req.query;
      const forecast = await weatherService.getHourlyForecast(lat, lon, hours);
      return sendSuccess(res, forecast);
    } catch (error) {
      next(error);
    }
  }

  async getDaily(req, res, next) {
    try {
      const { lat, lon, days } = req.query;
      const forecast = await weatherService.getDailyForecast(lat, lon, days);
      return sendSuccess(res, forecast);
    } catch (error) {
      next(error);
    }
  }

  async getUnifiedForecast(req, res, next) {
    try {
      const { lat, lon } = req.query;
      const unified = await weatherService.getUnifiedForecast(lat, lon);
      return sendSuccess(res, unified);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new WeatherController();
