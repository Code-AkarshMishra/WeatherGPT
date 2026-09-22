const axios = require('axios');
const HistoricalWeather = require('../../models/HistoricalWeather');
const CacheService = require('../cache/cache.service');
const LocationService = require('../location/location.service');
const { CACHE_TTL } = require('../../utils/constants');
const logger = require('../../utils/logger');
const ApiError = require('../../utils/apiError');
const { ERROR_CODES } = require('../../utils/constants');

const ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive';

class ClimateService {
  /**
   * Live ERA5 daily history via Open-Meteo archive. Never synthesizes values.
   */
  async fetchArchiveDaily(lat, lon, start, end) {
    try {
      const response = await axios.get(ARCHIVE_URL, {
        params: {
          latitude: lat,
          longitude: lon,
          start_date: start,
          end_date: end,
          daily:
            'temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum,relative_humidity_2m_mean,wind_speed_10m_max',
          timezone: 'UTC',
        },
        timeout: 30000,
      });

      const d = response.data?.daily;
      if (!d?.time?.length) {
        return null;
      }

      const records = [];
      for (let i = 0; i < d.time.length; i++) {
        records.push({
          date: d.time[i],
          temperatureMax: d.temperature_2m_max?.[i] ?? null,
          temperatureMin: d.temperature_2m_min?.[i] ?? null,
          temperatureMean: d.temperature_2m_mean?.[i] ?? null,
          precipitation: d.precipitation_sum?.[i] ?? null,
          humidity: d.relative_humidity_2m_mean?.[i] ?? null,
          windSpeedMax: d.wind_speed_10m_max?.[i] ?? null,
        });
      }
      return records;
    } catch (err) {
      logger.warn('Open-Meteo archive climate fetch failed:', { error: err.message });
      return null;
    }
  }

  async getHistory(lat, lon, start, end) {
    const cacheKey = CacheService.makeKey('climate:history', lat, lon, start, end);
    const cached = await CacheService.get(cacheKey);
    if (cached) return cached;

    const locationInfo = await LocationService.resolveLocation(lat, lon);

    let records = await HistoricalWeather.find({
      'location.lat': { $gte: lat - 0.5, $lte: lat + 0.5 },
      'location.lon': { $gte: lon - 0.5, $lte: lon + 0.5 },
      date: { $gte: start, $lte: end },
    })
      .sort({ date: 1 })
      .lean();

    let source = 'MongoDB-HistoricalWeather';

    if (!records || records.length === 0) {
      const archiveRecords = await this.fetchArchiveDaily(lat, lon, start, end);
      if (!archiveRecords || archiveRecords.length === 0) {
        throw ApiError.providerTimeout(
          'Historical climate data is currently unavailable for this location and date range. ' +
            'WeatherGPT does not invent temperature, rainfall, or climate statistics.',
          ERROR_CODES.WEATHER_PROVIDER_ERROR
        );
      }
      records = archiveRecords;
      source = 'Open-Meteo Historical Weather API (ERA5)';
    }

    const result = {
      available: true,
      location: locationInfo,
      dateRange: { start, end },
      count: records.length,
      history: records.map((r) => ({
        date: r.date,
        temperatureMax: r.metrics?.temperatureMax ?? r.temperatureMax ?? null,
        temperatureMin: r.metrics?.temperatureMin ?? r.temperatureMin ?? null,
        temperatureMean: r.metrics?.temperatureMean ?? r.temperatureMean ?? null,
        precipitation: r.metrics?.precipitation ?? r.precipitation ?? null,
        humidity: r.metrics?.humidity ?? r.humidity ?? null,
        windSpeedMax: r.metrics?.windSpeedMax ?? r.windSpeedMax ?? null,
      })),
      source,
    };

    await CacheService.set(cacheKey, result, CACHE_TTL.CLIMATE_HISTORY);
    return result;
  }

  async getTrend(lat, lon, start, end, metric = 'temperature') {
    const cacheKey = CacheService.makeKey('climate:trend', lat, lon, start, end, metric);
    const cached = await CacheService.get(cacheKey);
    if (cached) return cached;

    const historyData = await this.getHistory(lat, lon, start, end);
    const dataPoints = historyData.history;

    if (dataPoints.length === 0) {
      throw ApiError.providerTimeout(
        'Climate trend unavailable: no historical observations for this period. ' +
          'WeatherGPT does not invent trends or p-values.',
        ERROR_CODES.WEATHER_PROVIDER_ERROR
      );
    }

    const values = dataPoints.map((p) => {
      if (metric === 'precipitation') return p.precipitation;
      if (metric === 'humidity') return p.humidity;
      if (metric === 'windSpeed') return p.windSpeedMax;
      return p.temperatureMean != null
        ? p.temperatureMean
        : p.temperatureMax != null && p.temperatureMin != null
          ? (p.temperatureMax + p.temperatureMin) / 2
          : null;
    });

    const usable = values
      .map((v, idx) => ({ v, idx, date: dataPoints[idx].date }))
      .filter((row) => row.v != null && !Number.isNaN(Number(row.v)));

    if (usable.length === 0) {
      throw ApiError.providerTimeout(
        `Climate trend unavailable: metric "${metric}" has no usable values in the live archive for this period.`,
        ERROR_CODES.WEATHER_PROVIDER_ERROR
      );
    }

    const nums = usable.map((row) => Number(row.v));
    const sum = nums.reduce((a, b) => a + b, 0);
    const mean = Math.round((sum / nums.length) * 10) / 10;
    const min = Math.min(...nums);
    const max = Math.max(...nums);

    let slope = 0;
    const n = nums.length;
    if (n > 1) {
      const xMean = (n - 1) / 2;
      let num = 0;
      let den = 0;
      for (let i = 0; i < n; i++) {
        num += (i - xMean) * (nums[i] - mean);
        den += (i - xMean) * (i - xMean);
      }
      slope = den !== 0 ? num / den : 0;
    }

    let trendDirection = 'STABLE';
    if (slope > 0.05) trendDirection = 'INCREASING';
    else if (slope < -0.05) trendDirection = 'DECREASING';

    const result = {
      available: true,
      location: historyData.location,
      metric,
      summary: {
        mean,
        min,
        max,
        slope: Math.round(slope * 1000) / 1000,
        trendDirection,
        sampleCount: n,
      },
      points: usable.map((row) => ({
        date: row.date,
        value: Number(row.v),
        anomalyFromMean: Math.round((Number(row.v) - mean) * 10) / 10,
      })),
      source: historyData.source,
      note: 'Descriptive archive statistics only — not a climate-change attribution or significance test.',
    };

    await CacheService.set(cacheKey, result, CACHE_TTL.CLIMATE_HISTORY);
    return result;
  }
}

module.exports = new ClimateService();
