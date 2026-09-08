/**
 * rainPredictor.js
 *
 * TEMP_HEURISTIC — Replace with ML model output once the ML team delivers it.
 *
 * This module exports a single function: predictRainProbability()
 * Swapping in the real model later is a one-line change — just replace
 * the function body with a call to the ML model's inference endpoint.
 *
 * Current heuristic uses humidity, atmospheric pressure, and recent
 * precipitation from the OpenWeatherMap API response.
 */

/**
 * Predicts the probability of rain as a percentage (0–100).
 *
 * @param {Object} params
 * @param {number} params.humidity         - Relative humidity (%)
 * @param {number} params.pressure         - Atmospheric pressure (hPa)
 * @param {number} params.recentPrecip1h   - Precipitation volume last 1h (mm), 0 if none
 * @param {number} params.recentPrecip3h   - Precipitation volume last 3h (mm), 0 if none
 * @param {number} params.clouds           - Cloud cover (%)
 * @param {string} params.weatherMain      - OpenWeatherMap weather.main (e.g. "Rain", "Clouds")
 * @returns {number} Rain probability estimate (0–100)
 */
function predictRainProbability({
  humidity = 50,
  pressure = 1013,
  recentPrecip1h = 0,
  recentPrecip3h = 0,
  clouds = 0,
  weatherMain = '',
}) {
  let score = 0;

  // Humidity component (0–30 pts)
  if (humidity >= 95) score += 30;
  else if (humidity >= 85) score += 22;
  else if (humidity >= 75) score += 14;
  else if (humidity >= 65) score += 8;
  else score += Math.max(0, (humidity - 40) * 0.15);

  // Pressure component — low pressure indicates convective uplift (0–20 pts)
  if (pressure < 995) score += 20;
  else if (pressure < 1005) score += 14;
  else if (pressure < 1010) score += 8;
  else if (pressure < 1013) score += 4;

  // Recent precipitation (0–25 pts)
  if (recentPrecip1h > 5) score += 25;
  else if (recentPrecip1h > 2) score += 18;
  else if (recentPrecip1h > 0.2) score += 12;
  else if (recentPrecip3h > 3) score += 10;
  else if (recentPrecip3h > 0) score += 6;

  // Cloud cover (0–10 pts)
  if (clouds >= 90) score += 10;
  else if (clouds >= 70) score += 7;
  else if (clouds >= 40) score += 3;

  // Meteorological condition alignment
  const mainLower = (weatherMain || '').toLowerCase();
  if (mainLower.includes('thunderstorm')) score = Math.max(score, 75);
  else if (mainLower.includes('rain') || mainLower.includes('drizzle')) score = Math.max(score, 55);
  else if (mainLower.includes('snow')) score = Math.max(score, 45);
  else if (mainLower === 'clear') score = Math.min(score, 10);
  else if (mainLower.includes('cloud') || mainLower.includes('mist') || mainLower.includes('haze')) score = Math.min(score, 35);

  // Realistic bounds [0, 85]
  return Math.min(85, Math.max(0, Math.round(score)));
}

module.exports = { predictRainProbability };
