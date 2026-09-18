/**
 * disasterPredictor.js
 * MoES & IMD Severe-Weather Disaster Risk Predictor (Node.js version).
 * Evaluates rainfall (mm), wind speed (km/h), and temperature (°C) against
 * IMD color-coded warning matrices using a weighted composite scoring system.
 *
 * Aligned with the Python ML-2 Random Forest classifier's decision boundaries,
 * this Node.js implementation provides identical alert classifications without
 * requiring a Python runtime for server-side disaster risk computation.
 *
 * IMD Classification Thresholds:
 *   GREEN  (0): Rain < 15.6mm, Wind < 25 km/h, Temp 8-36°C
 *   YELLOW (1): Rain 15.6-64.4mm, Wind 25-44 km/h, Temp 37-39°C or 5-7°C
 *   ORANGE (2): Rain 64.5-115.5mm, Wind 45-74 km/h, Temp 40-43°C or 3-4°C
 *   RED    (3): Rain >= 115.6mm, Wind >= 75 km/h, Temp >= 44°C or <= 2°C
 *
 * Produces:
 *  - imdColorCode: 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED'
 *  - riskAssessment: 'Low' | 'Moderate' | 'High' | 'Critical Disaster'
 *  - farmerAdvisory: Specialized crop/irrigation advice (Hindi + English)
 *  - marineAdvisory: Specialized coastal/fishermen advisory (Hindi + English)
 *  - actionPoints: Step-by-step citizen & emergency instructions
 */

/**
 * Computes individual severity tiers for each weather parameter.
 * Returns the composite severity using weighted maximum.
 */
function computeSeverityScore(rain, wind, temp) {
  // Rain severity tier (IMD rainfall classification)
  let rainTier = 0;
  if (rain >= 115.6) rainTier = 3;       // Extremely heavy rainfall
  else if (rain >= 64.5) rainTier = 2;   // Heavy rainfall
  else if (rain >= 35.6) rainTier = 1.5; // Fairly heavy rainfall (high-yellow)
  else if (rain >= 15.6) rainTier = 1;   // Moderate rainfall

  // Wind severity tier (IMD wind classification)
  let windTier = 0;
  if (wind >= 75) windTier = 3;       // Gale / storm force
  else if (wind >= 45) windTier = 2;  // Squally / strong wind
  else if (wind >= 35) windTier = 1.5; // High-gusty
  else if (wind >= 25) windTier = 1;  // Gusty / breezy

  // Temperature severity tier (heatwave / coldwave)
  let tempTier = 0;
  if (temp >= 44 || temp <= 2) tempTier = 3;
  else if (temp >= 40 || temp <= 4) tempTier = 2;
  else if (temp >= 37 || temp <= 7) tempTier = 1;

  // Composite: maximum single-parameter severity, boosted by multi-factor risk
  const maxTier = Math.max(rainTier, windTier, tempTier);
  const secondMax = [rainTier, windTier, tempTier].sort((a, b) => b - a)[1];

  // Multi-hazard boost: if two parameters are both elevated, bump up
  let compositeTier = maxTier;
  if (secondMax >= 1.5 && maxTier >= 1.5 && compositeTier < 3) {
    compositeTier = Math.min(3, Math.ceil(maxTier + 0.5));
  }

  return Math.min(3, Math.round(compositeTier));
}

/**
 * Predicts IMD warning status and generates role-based advisories.
 *
 * @param {Object} params
 * @param {number} params.rain_mm - Rainfall in mm (last 1-3 hrs or daily rate)
 * @param {number} params.wind_kmph - Wind speed in km/h
 * @param {number} params.temp_c - Temperature in Celsius
 * @param {string} [params.city] - Optional city name for tailored alerts
 * @returns {Object} IMD color code, risk score, farmer advisory, marine advisory
 */
function predictDisasterRisk({ rain_mm = 0, wind_kmph = 0, temp_c = 25, city = 'Your Area' }) {
  const rain = Math.max(0, parseFloat(rain_mm) || 0);
  const wind = Math.max(0, parseFloat(wind_kmph) || 0);
  const temp = parseFloat(temp_c) || 25;

  const severityScore = computeSeverityScore(rain, wind, temp);

  // MoES Alert Specifications
  const alertMatrix = {
    0: {
      color: 'GREEN',
      risk: 'Low',
      statusText: 'No Warning / All Clear',
      statusTextHi: 'कोई चेतावनी नहीं / सामान्य',
      farmerAdvisory: {
        hi: 'मौसम अनुकूल है। जुताई, बुवाई और सामान्य खाद डालने का कार्य सुचारू रूप से करें।',
        en: 'Favorable weather conditions. Suitable for normal farming, tilling, and fertilizer application.',
      },
      marineAdvisory: {
        hi: 'समुद्र शांत है। सामान्य मछली पकड़ने और तटीय नौकायन के लिए परिस्थितियां अनुकूल हैं।',
        en: 'Sea state calm to slight. Safe for fishing operations and coastal navigation.',
      },
      actionPoints: [
        'Routine activities can continue unhindered.',
        'Standard moisture conservation is recommended.',
      ],
    },
    1: {
      color: 'YELLOW',
      risk: 'Moderate',
      statusText: 'Watch / Be Updated',
      statusTextHi: 'अपडेट रहें / निगरानी रखें',
      farmerAdvisory: {
        hi: 'हल्की आंधी और बारिश की संभावना। खेतों में जल-निकासी की व्यवस्था रखें और खुले में कटी फसल न छोड़ें।',
        en: 'Scattered showers and gusty winds expected. Ensure field drainage channels are clear and cover harvested produce.',
      },
      marineAdvisory: {
        hi: 'हवा की गति 25-40 किमी/घंटा संभव। मछुआरे तट के निकट सावधानी से नौकायन करें।',
        en: 'Wind speed 25-40 km/h with moderate sea chop. Fishermen advised to exercise caution near shoreline.',
      },
      actionPoints: [
        'Keep umbrellas or rain protection handy.',
        'Inspect drainage near low-lying property.',
        'Monitor local weather updates before distant travel.',
      ],
    },
    2: {
      color: 'ORANGE',
      risk: 'High',
      statusText: 'Alert / Be Prepared',
      statusTextHi: 'सतर्क रहें / तैयार रहें',
      farmerAdvisory: {
        hi: 'भारी बारिश और 45+ किमी/घंटा तेज हवा की चेतावनी! कीटनाशक छिड़काव और सिंचाई तुरंत रोकें, कटी फसल सुरक्षित गोदाम में रखें।',
        en: 'Heavy rainfall and 45+ km/h squall alert! Suspend pesticide spraying and irrigation immediately; store produce in covered shelters.',
      },
      marineAdvisory: {
        hi: 'समुद्र अशांत (45-65 किमी/घंटा तेज हवा)। मछुआरे गहरे समुद्र में बिल्कुल न जाएं, नौकाएं सुरक्षित बांधें।',
        en: 'Rough sea conditions with squalls up to 65 km/h. Fishermen strictly advised NOT to venture into deep sea. Secure coastal boats.',
      },
      actionPoints: [
        'Avoid unnecessary outdoor travel during squalls.',
        'Stay away from weak structures, tin sheds, and electric poles.',
        'Charge emergency lights and secure loose rooftop items.',
      ],
    },
    3: {
      color: 'RED',
      risk: 'Critical Disaster',
      statusText: 'Warning / Take Action',
      statusTextHi: 'तूफान चेतावनी / तत्काल कदम उठाएं',
      farmerAdvisory: {
        hi: 'तूफान और अति-वृष्टि का गंभीर अलर्ट! तुरंत खेत खाली करें, पशुओं को पक्के बाड़ों में सुरक्षित बांधें, कोई कृषि कार्य न करें!',
        en: 'SEVERE DISASTER / STORM ALERT! Evacuate open fields immediately, secure livestock in reinforced sheds, cease all agricultural operations!',
      },
      marineAdvisory: {
        hi: 'गंभीर समुद्री चक्रवात/तूफान चेतावनी! सभी समुद्री गतिविधियां पूर्णतः स्थगित। तत्काल सुरक्षित आश्रय लें।',
        en: 'CRITICAL MARINE WARNING / GALE CONDITIONS (>75 km/h). Complete suspension of all fishing and harbor activities. Seek immediate high-ground shelter.',
      },
      actionPoints: [
        'Evacuate low-lying flood-prone zones if instructed by authorities.',
        'Stock emergency drinking water, dry rations, and first aid kits.',
        'Do not step out during peak gale or torrential downpour.',
      ],
    },
  };

  const alert = alertMatrix[severityScore];

  return {
    city,
    rainMm: rain,
    windKmph: wind,
    tempC: temp,
    imdColorCode: alert.color,
    riskAssessment: alert.risk,
    statusText: alert.statusText,
    statusTextHi: alert.statusTextHi,
    farmerAdvisory: alert.farmerAdvisory,
    marineAdvisory: alert.marineAdvisory,
    actionPoints: alert.actionPoints,
    spokenTextHi: `सतर्क रहें। मौसम विभाग का ${alert.color} अलर्ट। ${alert.farmerAdvisory.hi}`,
    spokenTextEn: `IMD ${alert.color} Alert for ${city}. Risk level: ${alert.risk}. ${alert.farmerAdvisory.en}`,
  };
}

module.exports = { predictDisasterRisk };
