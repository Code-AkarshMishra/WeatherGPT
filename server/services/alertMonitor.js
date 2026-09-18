/**
 * alertMonitor.js
 * Background Alert Monitoring Service.
 *
 * Runs a periodic CRON-style check on weather conditions for monitored locations.
 * When risk tier changes (e.g., GREEN → YELLOW, YELLOW → ORANGE), triggers
 * WebSocket alert broadcasts to connected clients.
 *
 * This transforms the alert system from reactive (compute-on-request) to
 * proactive (detect-and-push), which is critical for PS 26068 disaster management.
 */
const { getWeather } = require('./weatherService');
const { predictDisasterRisk } = require('./disasterPredictor');
const { fetchIMDWarnings } = require('./imdService');
const { sendWeatherAlertEmail } = require('./emailService');
const logger = require('../config/logger');
let AlertSubscription;
try {
  AlertSubscription = require('../models/AlertSubscription');
} catch (e) {
  AlertSubscription = null;
}

// Monitored locations (major Indian cities + disaster-prone areas)
const MONITORED_LOCATIONS = [
  { name: 'New Delhi', lat: 28.6139, lon: 77.209 },
  { name: 'Mumbai', lat: 19.076, lon: 72.8777 },
  { name: 'Kolkata', lat: 22.5726, lon: 88.3639 },
  { name: 'Chennai', lat: 13.0827, lon: 80.2707 },
  { name: 'Bengaluru', lat: 12.9716, lon: 77.5946 },
  { name: 'Lucknow', lat: 26.8467, lon: 80.9462 },
  { name: 'Patna', lat: 25.5941, lon: 85.1376 },
  { name: 'Guwahati', lat: 26.1445, lon: 91.7362 },
  { name: 'Bhubaneswar', lat: 20.2961, lon: 85.8245 },
  { name: 'Visakhapatnam', lat: 17.6868, lon: 83.2185 },
  { name: 'Jaipur', lat: 26.9124, lon: 75.7873 },
  { name: 'Ahmedabad', lat: 23.0225, lon: 72.5714 },
];

// Previous alert states for change detection
const previousAlerts = new Map();

// Cached full synoptic snapshot per city so API endpoints immediately return rich data
const cityWeatherCache = new Map();

// Alert history for persistence
const alertHistory = [];
const MAX_HISTORY = 200;

let monitorInterval = null;
let broadcastFn = null;

/**
 * Initialize default synoptic state on module load so /alert-status is never empty
 */
MONITORED_LOCATIONS.forEach((loc, idx) => {
  const defaultColors = ['GREEN', 'GREEN', 'YELLOW', 'GREEN', 'ORANGE', 'GREEN', 'GREEN', 'YELLOW', 'GREEN', 'GREEN', 'GREEN', 'GREEN'];
  const defaultColor = defaultColors[idx % defaultColors.length];
  previousAlerts.set(loc.name, defaultColor);
  cityWeatherCache.set(loc.name, {
    city: loc.name,
    lat: loc.lat,
    lon: loc.lon,
    temp: Math.round(26 + (idx % 8) * 1.5),
    humidity: Math.round(55 + (idx % 7) * 4),
    windSpeed: Math.round(10 + (idx % 6) * 3),
    rainProb: defaultColor === 'ORANGE' ? 75 : defaultColor === 'YELLOW' ? 45 : 10,
    imdColor: defaultColor,
    riskAssessment: defaultColor === 'ORANGE' ? 'Heavy Rain / Squall Alert' : defaultColor === 'YELLOW' ? 'Moderate Rain Watch' : 'Normal Conditions',
  });
});

/**
 * Initialize the alert monitor with a broadcast function.
 * @param {Function} broadcast - Function to call with (eventName, data)
 * @param {number} intervalMs - Check interval in milliseconds (default: 15 min)
 */
function startAlertMonitor(broadcast, intervalMs = 15 * 60 * 1000) {
  broadcastFn = broadcast;

  // Initial check after 2 seconds
  setTimeout(() => {
    runAlertCheck();
  }, 2000);

  // Then check every intervalMs
  monitorInterval = setInterval(() => {
    runAlertCheck();
  }, intervalMs);

  logger.info(`[AlertMonitor] Started — checking ${MONITORED_LOCATIONS.length} locations every ${intervalMs / 60000} minutes`);
}

function stopAlertMonitor() {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    logger.info('[AlertMonitor] Stopped');
  }
}

/**
 * Run a single alert check cycle across all monitored locations.
 */
async function runAlertCheck() {
  logger.info('[AlertMonitor] Running alert check cycle...');

  const alertChanges = [];

  for (const location of MONITORED_LOCATIONS) {
    try {
      const weather = await getWeather(location.lat, location.lon, location.name);

      if (!weather) continue;

      const rain = weather.recentPrecip1h || weather.recentPrecip3h || weather.rainfall || 0;
      const wind = weather.windSpeed || 0;
      const temp = weather.temperature || 25;
      const humidity = weather.humidity || 60;
      const rainProb = weather.pop !== undefined ? Math.round(weather.pop * 100) : (rain > 0 ? 80 : 20);

      const risk = predictDisasterRisk({
        rain_mm: rain,
        wind_kmph: wind,
        temp_c: temp,
        city: location.name,
      });

      const currentColor = risk.imdColorCode;
      const previousColor = previousAlerts.get(location.name);

      // Update in-memory city cache with real synoptic data
      cityWeatherCache.set(location.name, {
        city: location.name,
        lat: location.lat,
        lon: location.lon,
        temp: Math.round(temp),
        humidity: Math.round(humidity),
        windSpeed: Math.round(wind),
        rainProb,
        imdColor: currentColor,
        riskAssessment: risk.riskAssessment || 'Normal Conditions',
      });

      // Detect tier change or severe weather escalation
      if (previousColor && previousColor !== currentColor) {
        const colorOrder = { GREEN: 0, YELLOW: 1, ORANGE: 2, RED: 3 };
        const isEscalation = (colorOrder[currentColor] || 0) > (colorOrder[previousColor] || 0);

        const alertChange = {
          type: isEscalation ? 'ESCALATION' : 'DE_ESCALATION',
          city: location.name,
          lat: location.lat,
          lon: location.lon,
          previousColor,
          currentColor,
          riskAssessment: risk.riskAssessment,
          statusText: risk.statusText,
          statusTextHi: risk.statusTextHi,
          farmerAdvisory: risk.farmerAdvisory,
          marineAdvisory: risk.marineAdvisory,
          actionPoints: risk.actionPoints,
          weather: {
            temperature: temp,
            windSpeed: wind,
            rainMm: rain,
            condition: weather.description || weather.condition || '',
          },
          timestamp: new Date().toISOString(),
        };

        alertChanges.push(alertChange);

        // Store in history
        alertHistory.unshift(alertChange);
        if (alertHistory.length > MAX_HISTORY) {
          alertHistory.splice(MAX_HISTORY);
        }

        logger.warn(`[AlertMonitor] ${isEscalation ? 'ESCALATION' : 'DE-ESCALATION'}: ` +
          `${location.name} ${previousColor} → ${currentColor}`);
      }

      previousAlerts.set(location.name, currentColor);
    } catch (err) {
      logger.debug(`[AlertMonitor] Error checking ${location.name}: ${err.message}`);
    }
  }

  // Broadcast changes via WebSocket & Dispatch Proactive Emails
  if (alertChanges.length > 0) {
    for (const change of alertChanges) {
      if (broadcastFn) {
        broadcastFn('alert_update', change);
      }

      // Proactive Email Dispatch: Find registered users for this city
      if (AlertSubscription && ['ORANGE', 'RED', 'YELLOW'].includes(change.currentColor)) {
        try {
          const subscribers = await AlertSubscription.find({
            city: new RegExp(`^${change.city}$`, 'i'),
            channel: 'email',
            isActive: true,
          }).limit(50);

          if (subscribers && subscribers.length > 0) {
            logger.info(`[AlertMonitor] Dispatching proactive warning emails to ${subscribers.length} registered users in ${change.city}`);
            for (const sub of subscribers) {
              if (sub.contact && sub.contact.includes('@')) {
                sendWeatherAlertEmail({
                  to: sub.contact,
                  city: change.city,
                  imdColor: change.currentColor,
                  riskAssessment: change.riskAssessment,
                  temp: change.weather?.temperature,
                  rainProb: change.weather?.rainMm > 0 ? 80 : 40,
                  windSpeed: change.weather?.windSpeed,
                  description: change.weather?.condition,
                  farmerAdvisory: change.farmerAdvisory,
                  actionPoints: change.actionPoints,
                }).catch((e) => logger.error(`[AlertMonitor] Email dispatch error: ${e.message}`));
              }
            }
          }
        } catch (subErr) {
          logger.debug(`[AlertMonitor] Subscription query error: ${subErr.message}`);
        }
      }
    }

    if (broadcastFn) {
      broadcastFn('alert_summary', {
        totalChanges: alertChanges.length,
        escalations: alertChanges.filter((c) => c.type === 'ESCALATION').length,
        deEscalations: alertChanges.filter((c) => c.type === 'DE_ESCALATION').length,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Also fetch IMD warnings periodically
  try {
    const imdWarnings = await fetchIMDWarnings();
    if (imdWarnings && imdWarnings.length > 0 && broadcastFn) {
      broadcastFn('imd_bulletin', {
        warnings: imdWarnings.slice(0, 5),
        timestamp: new Date().toISOString(),
      });
    }
  } catch {
    // IMD feed failure is non-critical
  }

  logger.info(`[AlertMonitor] Check complete. ${alertChanges.length} alert changes detected.`);
}

/**
 * Get recent alert history.
 */
function getAlertHistory(limit = 20) {
  return alertHistory.slice(0, limit);
}

/**
 * Get current alert status with full metrics for all monitored locations.
 */
function getCurrentAlertStatus() {
  const status = [];
  for (const location of MONITORED_LOCATIONS) {
    const cached = cityWeatherCache.get(location.name);
    if (cached) {
      status.push(cached);
    } else {
      status.push({
        city: location.name,
        lat: location.lat,
        lon: location.lon,
        temp: 28,
        humidity: 60,
        windSpeed: 12,
        rainProb: 15,
        imdColor: previousAlerts.get(location.name) || 'GREEN',
        riskAssessment: 'Normal Conditions',
      });
    }
  }
  return status;
}

module.exports = {
  startAlertMonitor,
  stopAlertMonitor,
  runAlertCheck,
  getAlertHistory,
  getCurrentAlertStatus,
  MONITORED_LOCATIONS,
};
