/**
 * weatherService.js
 * Fetches weather data from OpenWeatherMap, enriches with rain probability,
 * and caches results in MongoDB (10-minute TTL).
 */
const axios = require('axios');
const WeatherCache = require('../models/WeatherCache');
const { predictRainProbability } = require('./rainPredictor');
const logger = require('../config/logger');

const OWM_BASE = 'https://api.openweathermap.org/data/2.5';

/**
 * Rounds lat/lon to 2 decimal places for cache key consistency.
 */
function makeCacheKey(lat, lon) {
  return `${parseFloat(lat).toFixed(2)}_${parseFloat(lon).toFixed(2)}`;
}

/**
 * Maps OWM weather condition to a UI-friendly condition string.
 */
function mapCondition(weatherMain) {
  const m = (weatherMain || '').toLowerCase();
  if (m.includes('thunderstorm')) return 'storm';
  if (m.includes('rain') || m.includes('drizzle')) return 'rain';
  if (m.includes('snow')) return 'snow';
  if (m.includes('clear')) return 'clear';
  if (m.includes('cloud') || m.includes('mist') || m.includes('fog') || m.includes('haze')) return 'cloudy';
  return 'clear';
}

/**
 * Fetches weather data for the given coordinates.
 * Returns cached data if available (< 10 min old).
 *
 * @param {number} lat
 * @param {number} lon
 * @returns {Object} Enriched weather object
 */
async function getWeather(lat, lon) {
  const cacheKey = makeCacheKey(lat, lon);

  // Check cache first
  try {
    const cached = await WeatherCache.findOne({ cacheKey });
    if (cached) {
      logger.debug(`Weather cache HIT for ${cacheKey}`);
      return cached.data;
    }
  } catch (cacheErr) {
    logger.warn(`Weather cache lookup failed: ${cacheErr.message}`);
  }

  // Fetch from OpenWeatherMap
  logger.info(`Fetching weather from OWM for lat=${lat}, lon=${lon}`);
  const [currentRes, forecastRes] = await Promise.all([
    axios.get(`${OWM_BASE}/weather`, {
      params: {
        lat,
        lon,
        appid: process.env.WEATHER_API_KEY,
        units: 'metric',
      },
      timeout: 8000,
    }),
    axios.get(`${OWM_BASE}/forecast`, {
      params: {
        lat,
        lon,
        appid: process.env.WEATHER_API_KEY,
        units: 'metric',
        cnt: 8, // next 24h in 3h intervals
      },
      timeout: 8000,
    }).catch(() => null), // non-blocking — forecast is optional
  ]);

  const current = currentRes.data;

  // Extract rain data
  const recentPrecip1h = current.rain?.['1h'] || 0;
  const recentPrecip3h = current.rain?.['3h'] || 0;

  // Build rain probability (TEMP_HEURISTIC)
  const rainProbability = predictRainProbability({
    humidity: current.main?.humidity,
    pressure: current.main?.pressure,
    recentPrecip1h,
    recentPrecip3h,
    clouds: current.clouds?.all,
    weatherMain: current.weather?.[0]?.main,
  });

  // Build 24h forecast summary
  const forecast24h = forecastRes
    ? forecastRes.data.list.map((item) => ({
        time: item.dt_txt,
        temp: item.main?.temp,
        description: item.weather?.[0]?.description,
        rainPop: Math.round((item.pop || 0) * 100), // OWM provides PoP in forecast
      }))
    : [];

  const enrichedData = {
    locationName: current.name || 'Your Location',
    country: current.sys?.country || '',
    lat: current.coord?.lat || lat,
    lon: current.coord?.lon || lon,
    temperature: Math.round(current.main?.temp),
    feelsLike: Math.round(current.main?.feels_like),
    humidity: current.main?.humidity,
    pressure: current.main?.pressure,
    windSpeed: Math.round((current.wind?.speed || 0) * 3.6), // m/s → km/h
    windDirection: current.wind?.deg || 0,
    description: current.weather?.[0]?.description || '',
    weatherMain: current.weather?.[0]?.main || '',
    weatherIcon: current.weather?.[0]?.icon || '01d',
    clouds: current.clouds?.all || 0,
    visibility: current.visibility ? Math.round(current.visibility / 1000) : null, // m → km
    sunrise: current.sys?.sunrise,
    sunset: current.sys?.sunset,
    rainProbability,
    recentPrecip1h,
    recentPrecip3h,
    condition: mapCondition(current.weather?.[0]?.main),
    forecast24h,
    fetchedAt: new Date().toISOString(),
  };

  // Cache the result
  try {
    await WeatherCache.findOneAndUpdate(
      { cacheKey },
      { cacheKey, lat: parseFloat(lat), lon: parseFloat(lon), data: enrichedData, fetchedAt: new Date() },
      { upsert: true, new: true }
    );
  } catch (cacheErr) {
    logger.warn(`Weather cache write failed: ${cacheErr.message}`);
  }

  return enrichedData;
}

module.exports = { getWeather };
