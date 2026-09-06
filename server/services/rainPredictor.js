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
  // TEMP_HEURISTIC: rule-based scoring system
  let score = 0;

  // Humidity component (0–35 pts)
  if (humidity >= 90) score += 35;
  else if (humidity >= 80) score += 25;
  else if (humidity >= 70) score += 15;
  else if (humidity >= 60) score += 8;
  else score += Math.max(0, (humidity - 40) * 0.2);

  // Pressure component — low pressure = higher rain likelihood (0–25 pts)
  if (pressure < 990) score += 25;
  else if (pressure < 1000) score += 18;
  else if (pressure < 1005) score += 10;
  else if (pressure < 1010) score += 5;
  // High pressure (> 1015) adds 0

  // Recent precipitation (0–25 pts)
  if (recentPrecip1h > 5) score += 25;
  else if (recentPrecip1h > 2) score += 20;
  else if (recentPrecip1h > 0.5) score += 15;
  else if (recentPrecip3h > 3) score += 12;
  else if (recentPrecip3h > 0) score += 8;

  // Cloud cover (0–10 pts)
  if (clouds >= 90) score += 10;
  else if (clouds >= 70) score += 7;
  else if (clouds >= 50) score += 4;

  // OWM weather condition override (0–5 pts boost or hard min)
  const mainLower = (weatherMain || '').toLowerCase();
  if (mainLower.includes('thunderstorm')) score = Math.max(score, 80);
  else if (mainLower.includes('rain') || mainLower.includes('drizzle')) score = Math.max(score, 60);
  else if (mainLower.includes('snow')) score = Math.max(score, 50);
  else if (mainLower === 'clear') score = Math.min(score, 20);

  // Clamp to [0, 100]
  return Math.min(100, Math.max(0, Math.round(score)));
}

module.exports = { predictRainProbability };
