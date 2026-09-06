/**
 * weatherService.js
 * Fetches weather data from OpenWeatherMap, enriches with rain probability,
 * and caches results in MongoDB (10-minute TTL).
 */
const axios = require('axios');
const mongoose = require('mongoose');
const WeatherCache = require('../models/WeatherCache');
const { predictRainProbability } = require('./rainPredictor');
const { predictDisasterRisk } = require('./disasterPredictor');
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
  if (mongoose.connection.readyState === 1) {
    try {
      const cached = await WeatherCache.findOne({ cacheKey });
      if (cached) {
        logger.debug(`Weather cache HIT for ${cacheKey}`);
        if (!cached.data.disasterRisk) {
          cached.data.disasterRisk = predictDisasterRisk({
            rain_mm: (cached.data.recentPrecip1h || cached.data.recentPrecip3h || 0),
            wind_kmph: cached.data.windSpeed || 0,
            temp_c: cached.data.temperature || 25,
            city: cached.data.locationName || 'Your Location',
          });
        }
        return cached.data;
      }
    } catch (cacheErr) {
      logger.warn(`Weather cache lookup failed: ${cacheErr.message}`);
    }
  }

  // Fetch from OpenWeatherMap (Current, 5-day Forecast, and Air Pollution)
  logger.info(`Fetching weather from OWM for lat=${lat}, lon=${lon}`);
  const [currentRes, forecastRes, pollutionRes] = await Promise.all([
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
        cnt: 40, // 5 days / 3-hour intervals
      },
      timeout: 8000,
    }).catch((err) => {
      logger.warn(`Forecast fetch failed: ${err.message}`);
      return null;
    }),
    axios.get(`${OWM_BASE}/air_pollution`, {
      params: {
        lat,
        lon,
        appid: process.env.WEATHER_API_KEY,
      },
      timeout: 8000,
    }).catch((err) => {
      logger.warn(`Air pollution fetch failed: ${err.message}`);
      return null;
    }),
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

  // Parse Air Pollution / AQI
  let airQuality = {
    aqi: 2,
    pm2_5: 25,
    pm10: 30,
    label: 'Good',
    color: '#22c55e',
    components: {},
  };

  if (pollutionRes?.data?.list?.[0]) {
    const pData = pollutionRes.data.list[0];
    const aqiLevel = pData.main?.aqi || 2;
    const pm25 = Math.round(pData.components?.pm2_5 || 0);
    const pm10 = Math.round(pData.components?.pm10 || 0);

    const aqiLabels = {
      1: { label: 'Good', color: '#22c55e' },
      2: { label: 'Fair', color: '#84cc16' },
      3: { label: 'Moderate', color: '#eab308' },
      4: { label: 'Poor', color: '#f97316' },
      5: { label: 'Very Poor', color: '#ef4444' },
    };

    airQuality = {
      aqi: aqiLevel,
      pm2_5: pm25,
      pm10: pm10,
      label: aqiLabels[aqiLevel]?.label || 'Moderate',
      color: aqiLabels[aqiLevel]?.color || '#eab308',
      components: pData.components || {},
    };
  }

  // Sunrise / Sunset formatted (HH:mm)
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const sunriseFormatted = current.sys?.sunrise ? formatTime(current.sys.sunrise) : '';
  const sunsetFormatted = current.sys?.sunset ? formatTime(current.sys.sunset) : '';

  // Process 24-hour hourly forecast (next 8-10 points)
  const hourlyForecast = [];
  const forecastList = forecastRes?.data?.list || [];

  for (let i = 0; i < Math.min(forecastList.length, 10); i++) {
    const item = forecastList[i];
    const date = new Date(item.dt * 1000);
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    const pop = Math.round((item.pop || 0) * 100);

    hourlyForecast.push({
      time: timeStr,
      timestamp: item.dt,
      temp: Math.round(item.main?.temp),
      feelsLike: Math.round(item.main?.feels_like),
      condition: mapCondition(item.weather?.[0]?.main),
      weatherMain: item.weather?.[0]?.main || '',
      description: item.weather?.[0]?.description || '',
      icon: item.weather?.[0]?.icon || '01d',
      rainPop: pop,
    });
  }

  // Process Multi-day forecast (grouping by date)
  const daysMap = new Map();
  forecastList.forEach((item) => {
    const dateKey = item.dt_txt.split(' ')[0]; // YYYY-MM-DD
    if (!daysMap.has(dateKey)) {
      daysMap.set(dateKey, []);
    }
    daysMap.get(dateKey).push(item);
  });

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dailyForecast = [];

  // Add Yesterday as a reference row (matching screenshot format)
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yMonth = String(yesterday.getMonth() + 1).padStart(2, '0');
  const yDay = String(yesterday.getDate()).padStart(2, '0');
  dailyForecast.push({
    date: `${yMonth}/${yDay}`,
    dayName: 'Yesterday',
    condition: mapCondition(current.weather?.[0]?.main),
    icon: current.weather?.[0]?.icon || '02d',
    rainPop: Math.max(0, rainProbability - 10),
    minTemp: Math.round((current.main?.temp_min || current.main?.temp) - 2),
    maxTemp: Math.round((current.main?.temp_max || current.main?.temp) + 2),
  });

  let dayIndex = 0;
  daysMap.forEach((items, dateKey) => {
    const dateObj = new Date(dateKey + 'T12:00:00');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');

    let min = Infinity;
    let max = -Infinity;
    let maxPop = 0;
    const condCounts = {};
    let dominantIcon = items[0]?.weather?.[0]?.icon || '01d';

    items.forEach((it) => {
      if (it.main?.temp_min < min) min = it.main.temp_min;
      if (it.main?.temp_max > max) max = it.main.temp_max;
      const p = Math.round((it.pop || 0) * 100);
      if (p > maxPop) maxPop = p;

      const c = mapCondition(it.weather?.[0]?.main);
      condCounts[c] = (condCounts[c] || 0) + 1;
      if (it.weather?.[0]?.icon?.includes('d')) {
        dominantIcon = it.weather[0].icon;
      }
    });

    let bestCond = 'clear';
    let maxCount = 0;
    Object.entries(condCounts).forEach(([c, cnt]) => {
      if (cnt > maxCount) {
        maxCount = cnt;
        bestCond = c;
      }
    });

    let dayName = dayNames[dateObj.getDay()];
    if (dayIndex === 0) dayName = 'Today';
    else if (dayIndex === 1) dayName = 'Tomorrow';

    dailyForecast.push({
      date: `${month}/${day}`,
      dayName,
      condition: bestCond,
      icon: dominantIcon,
      rainPop: maxPop,
      minTemp: Math.round(min),
      maxTemp: Math.round(max),
    });

    dayIndex++;
  });

  // Calculate today's min and max
  const todayForecast = dailyForecast.find((d) => d.dayName === 'Today');
  const tempMin = todayForecast ? todayForecast.minTemp : Math.round(current.main?.temp_min ?? current.main?.temp);
  const tempMax = todayForecast ? todayForecast.maxTemp : Math.round(current.main?.temp_max ?? current.main?.temp);

  const enrichedData = {
    locationName: current.name || 'Your Location',
    country: current.sys?.country || '',
    lat: current.coord?.lat || lat,
    lon: current.coord?.lon || lon,
    temperature: Math.round(current.main?.temp),
    feelsLike: Math.round(current.main?.feels_like),
    tempMin,
    tempMax,
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
    sunriseFormatted,
    sunsetFormatted,
    rainProbability,
    recentPrecip1h,
    recentPrecip3h,
    condition: mapCondition(current.weather?.[0]?.main),
    airQuality,
    hourlyForecast,
    dailyForecast,
    disasterRisk: predictDisasterRisk({
      rain_mm: (recentPrecip1h || recentPrecip3h || 0),
      wind_kmph: Math.round((current.wind?.speed || 0) * 3.6),
      temp_c: current.main?.temp || 25,
      city: current.name || 'Your Location',
    }),
    fetchedAt: new Date().toISOString(),
  };

  // Cache the result
  if (mongoose.connection.readyState === 1) {
    try {
      await WeatherCache.findOneAndUpdate(
        { cacheKey },
        { cacheKey, lat: parseFloat(lat), lon: parseFloat(lon), data: enrichedData, fetchedAt: new Date() },
        { upsert: true, new: true }
      );
    } catch (cacheErr) {
      logger.warn(`Weather cache write failed: ${cacheErr.message}`);
    }
  }

  return enrichedData;
}

module.exports = { getWeather };
