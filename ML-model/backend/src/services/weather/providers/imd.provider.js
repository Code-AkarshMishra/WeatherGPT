const axios = require('axios');
const env = require('../../../config/env');
const logger = require('../../../utils/logger');
const ApiError = require('../../../utils/apiError');
const { ERROR_CODES } = require('../../../utils/constants');
const openmeteoProvider = require('./openmeteo.provider');

class IMDWeatherProvider {
  constructor() {
    this.name = 'IMD';
    this.client = axios.create({
      baseURL: env.IMD_BASE_URL || 'https://mausam.imd.gov.in/backend/api',
      timeout: 6000,
      headers: {
        Accept: 'application/json, text/plain, */*',
        'User-Agent': 'WeatherGPT-Backend/1.0.0 (SIH-PS-26068)',
        ...(env.IMD_API_KEY ? { Authorization: `Bearer ${env.IMD_API_KEY}` } : {}),
      },
    });
  }

  _unavailable(message) {
    throw ApiError.providerTimeout(message, ERROR_CODES.WEATHER_PROVIDER_ERROR);
  }

  async getCurrent(lat, lon) {
    if (env.MOCK_EXTERNAL_APIS) {
      this._unavailable(
        'MOCK_EXTERNAL_APIS is enabled: fabricated weather is disabled. Use live providers.'
      );
    }

    try {
      const response = await this.client.get('/city_forecast_api.php', {
        params: { lat, lon },
      });

      if (response.data && (response.data.temperature != null || response.data.temp != null)) {
        return {
          temperature: response.data.temperature ?? response.data.temp ?? null,
          feelsLike: response.data.feelsLike ?? response.data.temp ?? null,
          humidity: response.data.humidity ?? response.data.rh ?? null,
          windSpeed: response.data.windSpeed ?? response.data.ws ?? null,
          windDirection: response.data.windDirection ?? response.data.wd ?? null,
          pressure: response.data.pressure ?? null,
          visibility: response.data.visibility ?? null,
          precipitation: response.data.precipitation ?? null,
          precipitationProbability: response.data.precipitationProbability ?? null,
          condition: response.data.weather ?? response.data.condition ?? null,
          dataUpdatedAt: new Date().toISOString(),
        };
      }
    } catch (err) {
      logger.debug('IMD City API direct query notice:', { message: err.message });
    }

    // Legitimate secondary provider (live Open-Meteo) — not hardcoded data
    try {
      return await openmeteoProvider.getCurrent(lat, lon);
    } catch (fallbackErr) {
      logger.warn('IMD and Open-Meteo current unavailable:', { error: fallbackErr.message });
      this._unavailable('Current weather is currently unavailable from configured providers.');
    }
  }

  async getHourly(lat, lon, hours = 24) {
    if (env.MOCK_EXTERNAL_APIS) {
      this._unavailable(
        'MOCK_EXTERNAL_APIS is enabled: fabricated forecasts are disabled. Use live providers.'
      );
    }

    try {
      return await openmeteoProvider.getHourly(lat, lon, hours);
    } catch (err) {
      logger.warn('Hourly forecast unavailable:', { error: err.message });
      this._unavailable('Hourly forecast is currently unavailable from configured providers.');
    }
  }

  async getDaily(lat, lon, days = 7) {
    if (env.MOCK_EXTERNAL_APIS) {
      this._unavailable(
        'MOCK_EXTERNAL_APIS is enabled: fabricated forecasts are disabled. Use live providers.'
      );
    }

    try {
      return await openmeteoProvider.getDaily(lat, lon, days);
    } catch (err) {
      logger.warn('Daily forecast unavailable:', { error: err.message });
      this._unavailable('Daily forecast is currently unavailable from configured providers.');
    }
  }
}

module.exports = new IMDWeatherProvider();
