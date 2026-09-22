const axios = require('axios');
const logger = require('../../../utils/logger');
const ApiError = require('../../../utils/apiError');
const { ERROR_CODES } = require('../../../utils/constants');

class OpenMeteoProvider {
  constructor() {
    this.name = 'Open-Meteo';
    this.client = axios.create({
      baseURL: 'https://api.open-meteo.com/v1',
      timeout: 8000,
    });
  }

  async getCurrent(lat, lon) {
    try {
      const response = await this.client.get('/forecast', {
        params: {
          latitude: lat,
          longitude: lon,
          current: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m',
          timezone: 'auto',
        },
      });

      const current = response.data.current;
      return {
        temperature: current.temperature_2m ?? null,
        feelsLike: current.apparent_temperature ?? null,
        humidity: current.relative_humidity_2m ?? null,
        windSpeed: current.wind_speed_10m ?? null,
        windDirection: current.wind_direction_10m ?? null,
        pressure: current.surface_pressure ?? null,
        precipitation: current.precipitation ?? null,
        weatherCode: current.weather_code ?? null,
        dataUpdatedAt: current.time,
      };
    } catch (err) {
      logger.warn('OpenMeteo current error:', { error: err.message });
      throw ApiError.providerTimeout(
        'Live current weather unavailable from Open-Meteo.',
        ERROR_CODES.WEATHER_PROVIDER_ERROR
      );
    }
  }

  async getHourly(lat, lon, hours = 24) {
    try {
      const response = await this.client.get('/forecast', {
        params: {
          latitude: lat,
          longitude: lon,
          hourly: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_direction_10m',
          forecast_days: Math.ceil(hours / 24) || 2,
          timezone: 'auto',
        },
      });

      const h = response.data.hourly;
      const results = [];
      const count = Math.min(hours, h.time.length);

      for (let i = 0; i < count; i++) {
        results.push({
          time: h.time[i],
          temperature: h.temperature_2m[i] ?? null,
          feelsLike: h.apparent_temperature[i] ?? null,
          humidity: h.relative_humidity_2m[i] ?? null,
          precipitationProbability: h.precipitation_probability
            ? h.precipitation_probability[i]
            : null,
          precipitation: h.precipitation[i] ?? null,
          weatherCode: h.weather_code[i] ?? null,
          windSpeed: h.wind_speed_10m[i] ?? null,
          windDirection: h.wind_direction_10m[i] ?? null,
        });
      }
      return results;
    } catch (err) {
      logger.warn('OpenMeteo hourly error:', { error: err.message });
      throw ApiError.providerTimeout(
        'Live hourly forecast unavailable from Open-Meteo.',
        ERROR_CODES.WEATHER_PROVIDER_ERROR
      );
    }
  }

  async getDaily(lat, lon, days = 7) {
    try {
      const response = await this.client.get('/forecast', {
        params: {
          latitude: lat,
          longitude: lon,
          daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,uv_index_max,sunrise,sunset',
          forecast_days: days,
          timezone: 'auto',
        },
      });

      const d = response.data.daily;
      const results = [];
      for (let i = 0; i < d.time.length; i++) {
        results.push({
          date: d.time[i],
          temperatureMax: d.temperature_2m_max[i] ?? null,
          temperatureMin: d.temperature_2m_min[i] ?? null,
          precipitationProbability: d.precipitation_probability_max
            ? d.precipitation_probability_max[i]
            : null,
          precipitationSum: d.precipitation_sum[i] ?? null,
          weatherCode: d.weather_code[i] ?? null,
          windSpeedMax: d.wind_speed_10m_max[i] ?? null,
          uvIndexMax: d.uv_index_max ? d.uv_index_max[i] : null,
          sunrise: d.sunrise ? d.sunrise[i] : null,
          sunset: d.sunset ? d.sunset[i] : null,
        });
      }
      return results;
    } catch (err) {
      logger.warn('OpenMeteo daily error:', { error: err.message });
      throw ApiError.providerTimeout(
        'Live daily forecast unavailable from Open-Meteo.',
        ERROR_CODES.WEATHER_PROVIDER_ERROR
      );
    }
  }
}

module.exports = new OpenMeteoProvider();
