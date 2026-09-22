const imdProvider = require('./providers/imd.provider');
const openmeteoProvider = require('./providers/openmeteo.provider');
const { WeatherNormalizer } = require('./normalizers/weather.normalizer');
const CacheService = require('../cache/cache.service');
const WeatherCache = require('../../models/WeatherCache');
const Forecast = require('../../models/Forecast');
const LocationService = require('../location/location.service');
const logger = require('../../utils/logger');
const ApiError = require('../../utils/apiError');
const { CACHE_TTL, ERROR_CODES } = require('../../utils/constants');

class WeatherService {
  constructor() {
    this.primaryProvider = imdProvider;
    this.secondaryProvider = openmeteoProvider;
  }

  async _withProviders(primaryFn, secondaryFn, label) {
    let lastError = null;
    try {
      return { raw: await primaryFn(), provider: this.primaryProvider.name };
    } catch (err) {
      lastError = err;
      logger.warn(`Primary weather provider failed (${label}): ${err.message}`);
    }
    try {
      return { raw: await secondaryFn(), provider: this.secondaryProvider.name };
    } catch (err) {
      lastError = err;
      logger.warn(`Secondary weather provider failed (${label}): ${err.message}`);
    }
    throw ApiError.providerTimeout(
      `${label} is currently unavailable from configured live providers.`,
      ERROR_CODES.WEATHER_PROVIDER_ERROR
    );
  }

  async getCurrentWeather(lat, lon) {
    const cacheKey = CacheService.makeKey('weather:current', lat, lon);

    const cached = await CacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const locationInfo = await LocationService.resolveLocation(lat, lon);
    const { raw: rawData, provider: providerName } = await this._withProviders(
      () => this.primaryProvider.getCurrent(lat, lon),
      () => this.secondaryProvider.getCurrent(lat, lon),
      'Current weather'
    );

    const normalized = WeatherNormalizer.normalizeCurrent(rawData, locationInfo, providerName);
    await CacheService.set(cacheKey, normalized, CACHE_TTL.CURRENT_WEATHER);

    const expiresAt = new Date(Date.now() + CACHE_TTL.CURRENT_WEATHER * 1000);
    WeatherCache.findOneAndUpdate(
      { cacheKey },
      {
        cacheKey,
        location: normalized.location,
        data: normalized.current,
        source: normalized.source,
        retrievedAt: new Date(),
        expiresAt,
      },
      { upsert: true, new: true }
    ).catch((dbErr) => logger.warn('MongoDB WeatherCache upsert error:', { error: dbErr.message }));

    return normalized;
  }

  async getHourlyForecast(lat, lon, hours = 24) {
    const cacheKey = CacheService.makeKey('weather:hourly', lat, lon, hours);

    const cached = await CacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const locationInfo = await LocationService.resolveLocation(lat, lon);
    const { raw: rawData, provider: providerName } = await this._withProviders(
      () => this.primaryProvider.getHourly(lat, lon, hours),
      () => this.secondaryProvider.getHourly(lat, lon, hours),
      'Hourly forecast'
    );

    const normalized = WeatherNormalizer.normalizeHourly(rawData, locationInfo, providerName);
    await CacheService.set(cacheKey, normalized, CACHE_TTL.HOURLY_FORECAST);

    const expiresAt = new Date(Date.now() + CACHE_TTL.HOURLY_FORECAST * 1000);
    Forecast.findOneAndUpdate(
      { 'location.lat': lat, 'location.lon': lon, type: 'hourly' },
      {
        location: normalized.location,
        type: 'hourly',
        data: normalized.hourly,
        source: normalized.source,
        dataUpdatedAt: new Date(),
        expiresAt,
      },
      { upsert: true }
    ).catch((dbErr) => logger.warn('MongoDB Forecast upsert error:', { error: dbErr.message }));

    return normalized;
  }

  async getDailyForecast(lat, lon, days = 7) {
    const cacheKey = CacheService.makeKey('weather:daily', lat, lon, days);

    const cached = await CacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const locationInfo = await LocationService.resolveLocation(lat, lon);
    const { raw: rawData, provider: providerName } = await this._withProviders(
      () => this.primaryProvider.getDaily(lat, lon, days),
      () => this.secondaryProvider.getDaily(lat, lon, days),
      'Daily forecast'
    );

    const normalized = WeatherNormalizer.normalizeDaily(rawData, locationInfo, providerName);
    await CacheService.set(cacheKey, normalized, CACHE_TTL.DAILY_FORECAST);

    const expiresAt = new Date(Date.now() + CACHE_TTL.DAILY_FORECAST * 1000);
    Forecast.findOneAndUpdate(
      { 'location.lat': lat, 'location.lon': lon, type: 'daily' },
      {
        location: normalized.location,
        type: 'daily',
        data: normalized.daily,
        source: normalized.source,
        dataUpdatedAt: new Date(),
        expiresAt,
      },
      { upsert: true }
    ).catch((dbErr) => logger.warn('MongoDB Forecast upsert error:', { error: dbErr.message }));

    return normalized;
  }

  async getUnifiedForecast(lat, lon) {
    const [current, hourly, daily] = await Promise.all([
      this.getCurrentWeather(lat, lon),
      this.getHourlyForecast(lat, lon, 24),
      this.getDailyForecast(lat, lon, 7),
    ]);

    return {
      location: current.location,
      current: current.current,
      hourly: hourly.hourly,
      daily: daily.daily,
      source: current.source,
      dataUpdatedAt: current.dataUpdatedAt,
    };
  }
}

module.exports = new WeatherService();
