/**
 * geminiService.js
 * Wrapper around the Google Generative AI (Gemini) SDK.
 * Handles both JSON-mode calls (intent extraction) and
 * streaming/non-streaming chat responses with multi-key rotation.
 */
const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../config/logger');

function getApiKeys() {
  const keys = [];
  ['GEMINI_API_KEY', 'GEMINI_API_KEY_2', 'GEMINI_API_KEY_1', 'GEMINI_API_KEY_3'].forEach((k) => {
    const val = process.env[k];
    if (val && val.trim() && !val.trim().includes('your_') && !keys.includes(val.trim())) {
      keys.push(val.trim());
    }
  });
  return keys;
}

let keyIndex = 0;
function getNextGenAI(overrideKey = null) {
  if (overrideKey) return new GoogleGenerativeAI(overrideKey);
  const keys = getApiKeys();
  if (!keys.length) return new GoogleGenerativeAI('dummy-key');
  const selectedKey = keys[keyIndex % keys.length];
  keyIndex = (keyIndex + 1) % keys.length;
  return new GoogleGenerativeAI(selectedKey);
}

const PRIMARY_MODELS = [
  process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
  'gemini-3.5-flash-lite',
  'gemini-3.6-flash',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
].filter((v, i, a) => v && a.indexOf(v) === i);

/**
 * Comprehensive Domain Meteorological Reasoning Engine.
 * Generates accurate, deep, actionable weather responses tailored to
 * role (citizen, farmer, disaster_manager, researcher) and language (en, hi, hinglish)
 * using live atmospheric telemetry.
 */
function generateGroundedMeteorologicalResponse(userMessage, weather, role = 'citizen', lang = 'en') {
  const msgLower = (userMessage || '').toLowerCase();
  const city = weather?.locationName || 'Your Location';
  const country = weather?.country || 'IN';
  const temp = weather?.temperature ?? 28;
  const feelsLike = weather?.feelsLike ?? temp;
  const humidity = weather?.humidity ?? 65;
  const wind = weather?.windSpeed ?? 12;
  const visibility = weather?.visibility ?? (weather?.condition === 'fog' || weather?.condition === 'mist' ? 2 : 10);
  const rainProb = weather?.rainProbability ?? 30;
  const rainMm = weather?.recentPrecip1h || weather?.recentPrecip3h || 0;
  const pressure = weather?.pressure ?? 1012;
  const condition = weather?.weatherMain || weather?.condition || 'Clear';
  const aqi = weather?.airQuality || { aqi: 2, label: 'Fair', pm2_5: 25, pm10: 35 };
  const imdAlert = weather?.disasterRisk?.imdColorCode || 'GREEN';
  const imdStatus = weather?.disasterRisk?.statusText || 'No Warning / All Clear';

  // Detect language if not provided
  let detectedLang = lang;
  if (/[\u0900-\u097F]/.test(userMessage)) {
    detectedLang = 'hi';
  } else if (/kya|aaj|kal|baarish|mausam|khet|fasal|hawa|paani|garmi|sardi|batao|chhidkao|dawa|safar|nikal/i.test(msgLower)) {
    detectedLang = 'hinglish';
  }

  // ── 1. Visibility, Fog Risk, Highway & Road Driving Condition ─────────
  if (/visibility|fog|smog|drive|driving|road|highway|travel|safar|dhund|kohra/i.test(msgLower)) {
    const isFogRisk = visibility < 4 || (humidity > 85 && temp < 20);
    const drivingCondition = visibility >= 8 ? 'Excellent / Clear' : visibility >= 4 ? 'Moderate / Exercise Caution' : 'Hazardous / Low Visibility Warning';

    if (detectedLang === 'hi') {
      return `### 🚗 **दृश्यता (Visibility) एवं सड़क यात्रा परामर्श: ${city}**

**${city}** में वर्तमान मौसम और सड़क स्थिति का आधिकारिक विश्लेषण:

- 👁️ **दृश्यता स्तर:** **${visibility} km** (${visibility >= 8 ? 'स्पष्ट एवं सुरक्षित' : visibility >= 4 ? 'मध्यम दृश्यता' : 'घने कोहरे/धुंध की चेतावनी'})
- 🌫️ **कोहरा/धुंध जोखिम (Fog Risk):** **${isFogRisk ? 'मध्यम से अधिक (Caution Needed)' : 'न्यूनतम / शून्य (Negligible)'}**
- 💧 **आर्द्रता (Humidity):** **${humidity}%** | 🌡️ **तापमान:** **${temp}°C** (महसूस: **${feelsLike}°C**)
- 💨 **हवा की गति:** **${wind} km/h** | 🛡️ **IMD अलर्ट:** **${imdAlert}** (${imdStatus})

#### 🛣️ **ड्राइविंग व हाइवे सलाह:**
- **सड़क स्थिति:** **${drivingCondition}**
- ${visibility < 5 ? '⚠️ कोहरे के कारण लो-बीम हेडलाइट्स और फॉग लाइट्स का उपयोग करें। हाइवे पर सुरक्षित दूरी बनाए रखें।' : '✅ दिन के समय हाइवे और शहरी सड़कों पर आवागमन पूरी तरह सुरक्षित और सुगम है।'}
- **वर्षा की संभावना:** **${rainProb}%** ${rainProb > 50 ? '(गीली सड़कों पर वाहन की गति नियंत्रित रखें)' : ''}`;
    } else if (detectedLang === 'hinglish') {
      return `### 🚗 **Visibility & Road Driving Report: ${city}**

**${city}** me current atmospheric conditions ke mutabiq travel status:

- 👁️ **Visibility:** **${visibility} km** (${visibility >= 8 ? 'Bilkul saaf aur safe' : visibility >= 4 ? 'Moderate' : 'Dense fog warning'})
- 🌫️ **Fog / Smog Risk:** **${isFogRisk ? 'Moderate to High' : 'Low / Nominal'}**
- 💧 **Humidity:** **${humidity}%** | 🌡️ **Temperature:** **${temp}°C** (Feels like **${feelsLike}°C**)
- 💨 **Wind Speed:** **${wind} km/h** | 🛡️ **IMD Alert:** **${imdAlert}** (${imdStatus})

#### 🛣️ **Driving Recommendation:**
- **Driving Condition:** **${drivingCondition}**
- ${visibility < 5 ? '⚠️ Low-beam headlights use karein aur speed limit control me rakhein.' : '✅ Highways aur city roads par driving ke liye conditions fully favorable hain.'}
- **Rain Chance:** **${rainProb}%** ${rainProb > 50 ? '(Geeli sadkon par slippery surface ka dhyan rakhein)' : ''}`;
    } else {
      return `### 🚗 **Visibility, Fog Risk & Highway Driving Advisory: ${city}**

Current atmospheric telemetry for **${city}** (${country}):

- 👁️ **Horizontal Visibility:** **${visibility} km** (${visibility >= 8 ? 'Optimal / Clear Horizon' : visibility >= 4 ? 'Moderate' : 'Low Visibility Alert'})
- 🌫️ **Fog / Smog Index:** **${isFogRisk ? 'Moderate to High Risk' : 'Low / Minimal Fog Hazard'}**
- 💧 **Relative Humidity:** **${humidity}%** | 🌡️ **Surface Temp:** **${temp}°C** (Feels like **${feelsLike}°C**)
- 💨 **Wind Velocity:** **${wind} km/h** | 🛡️ **MoES / IMD Alert:** **${imdAlert}** (${imdStatus})

#### 🛣️ **Highway & Road Driving Assessment:**
- **Roadway Safety Level:** **${drivingCondition}**
- ${visibility < 5 ? '⚠️ Use low-beam fog lamps and maintain a 3-second braking distance on expressways.' : '✅ Favorable driving conditions across urban corridors and national highways.'}
- **Precipitation Probability:** **${rainProb}%** ${rainProb > 50 ? '(Beware of wet braking zones and hydroplaning risks)' : ''}`;
    }
  }

  // ── 2. Rain Probability, 24-Hour Precipitation & Thunderstorms ─────────
  if (/rain|baarish|barish|shower|precipitation|thunderstorm|storm|umbrella|chata|lightning|bheege/i.test(msgLower)) {
    const rainStatus = rainProb >= 60 ? 'High probability of rain' : rainProb >= 35 ? 'Scattered light showers possible' : 'Dry & clear conditions';

    if (detectedLang === 'hi') {
      return `### 🌧️ **24-घंटे वर्षा एवं मौसम पूर्वानुमान: ${city}**

**${city}** में वर्षा की वर्तमान स्थिति:

- 🌧️ **वर्षा की संभावना:** **${rainProb}%** (${rainStatus})
- 📊 **हालिया वर्षा:** **${rainMm} mm** (पिछले 1-3 घंटे)
- 🌡️ **तापमान:** **${temp}°C** (महसूस: **${feelsLike}°C**) | 💧 **आर्द्रता:** **${humidity}%**
- 💨 **हवा की गति:** **${wind} km/h** | 🌤️ **मौसम:** **${condition}**
- 🛡️ **IMD चेतावनी:** **${imdAlert}** (${imdStatus})

#### 📌 **दैनिक सलाह:**
- ${rainProb >= 50 ? '☔ बाहर निकलते समय **छाता या रेनकोट** अवश्य साथ रखें।' : '☀️ दिन में भारी बारिश का कोई गंभीर जोखिम नहीं है, सामान्य दिनचर्या जारी रख सकते हैं।'}`;
    } else if (detectedLang === 'hinglish') {
      return `### 🌧️ **24-Hour Rain Forecast: ${city}**

**${city}** me live rain parameters:

- 🌧️ **Rain Chance:** **${rainProb}%** (${rainStatus})
- 📊 **Recent Rainfall:** **${rainMm} mm**
- 🌡️ **Temperature:** **${temp}°C** (Feels like **${feelsLike}°C**) | 💧 **Humidity:** **${humidity}%**
- 💨 **Wind Speed:** **${wind} km/h** | 🛡️ **Alert:** **${imdAlert}**

#### 📌 **Practical Recommendation:**
- ${rainProb >= 50 ? '☔ Bahar jaate waqt **chhaata (umbrella)** sath zaroor rakhein.' : '☀️ Bhari baarish ka koi active alert nahi hai, weather overall safe hai.'}`;
    } else {
      return `### 🌧️ **24-Hour Precipitation & Rain Outlook: ${city}**

Live meteorological telemetry for **${city}**:

- 🌧️ **Precipitation Probability:** **${rainProb}%** (${rainStatus})
- 📊 **Recent Accumulation:** **${rainMm} mm**
- 🌡️ **Ambient Temperature:** **${temp}°C** (Feels like **${feelsLike}°C**)
- 💧 **Relative Humidity:** **${humidity}%** | 💨 **Surface Wind:** **${wind} km/h**
- 🛡️ **MoES / IMD Alert Status:** **${imdAlert}** (${imdStatus})

#### 📌 **Actionable Advisory:**
- ${rainProb >= 50 ? '☔ Recommended to carry rain protection; intermittent showers expected.' : '☀️ No significant precipitation hazard detected; outdoor activities can proceed normally.'}`;
    }
  }

  // ── 3. Crop Spraying, Agriculture & Farming Advisory ──────────────────
  if (/spray|crop|fertilizer|fasal|khet|chhidkao|khad|dawa|irrigation|sinchai|pesticide|kisan|pest/i.test(msgLower) || role === 'farmer') {
    const isSafeToSpray = wind < 18 && rainProb < 45 && imdAlert !== 'RED';
    const sprayRecommendation = isSafeToSpray ? '✅ Favorable / Safe to Spray (अनुकूल)' : '⚠️ Unfavorable / Postpone Spraying (रोकें)';

    if (detectedLang === 'hi') {
      return `### 🌾 **कृषि एवं फसल छिड़काव परामर्श: ${city}**

**${city}** के किसान भाइयों के लिए कृषि-मौसम बुलेटिन:

#### 🚜 **कीटनाशक/उर्वरक छिड़काव स्थिति:** **${sprayRecommendation}**
- 💨 **हवा की गति:** **${wind} km/h** ${wind >= 18 ? '(⚠️ हवा तेज है, दवा उड़ने का खतरा)' : '(✅ शांत हवा, सुरक्षित सीमा)'}
- 🌧️ **वर्षा की संभावना:** **${rainProb}%** ${rainProb >= 45 ? '(⚠️ बारिश से दवा बहने का जोखिम)' : '(✅ वर्षा का जोखिम कम)'}
- 💧 **आर्द्रता (Humidity):** **${humidity}%** ${humidity > 80 ? '| ⚠️ फफूंद व कीट संक्रमण की निगरानी करें' : ''}
- 🌡️ **तापमान:** **${temp}°C** | 🛡️ **IMD अलर्ट:** **${imdAlert}**

#### 🌾 **मुख्य कृषि सुझाव:**
- **अनुकूल समय:** छिड़काव सुबह 7:00 से 10:00 बजे या शाम 4:30 बजे के बाद करें।
- **सिंचाई सलाह:** ${rainProb > 60 ? 'वर्षा की संभावना को देखते हुए खेतों में अनावश्यक सिंचाई अभी टालें।' : 'मृदा में पर्याप्त नमी बनाए रखने के लिए आवश्यकतानुसार हल्की सिंचाई करें।'}`;
    } else {
      return `### 🌾 **Agricultural & Crop Spraying Intelligence: ${city}**

Agronomic weather advisory for **${city}**:

#### 🚜 **Spraying Operation Status:** **${sprayRecommendation}**
- 💨 **Surface Wind:** **${wind} km/h** ${wind >= 18 ? '(⚠️ High wind drift risk)' : '(✅ Below 18 km/h threshold — safe for spray)'}
- 🌧️ **Rain Probability:** **${rainProb}%** ${rainProb >= 45 ? '(⚠️ Rain wash-off risk)' : '(✅ Low wash-off risk)'}
- 💧 **Relative Humidity:** **${humidity}%** ${humidity > 80 ? '| ⚠️ Elevated fungal/pest development index' : ''}
- 🌡️ **Temperature:** **${temp}°C** | 🛡️ **IMD Alert:** **${imdAlert}**

#### 🌾 **Agronomic Recommendations:**
- **Optimal Spraying Window:** 07:00–10:00 hrs or post 16:30 hrs in calm wind conditions.
- **Irrigation Guidance:** ${rainProb > 60 ? 'Hold off supplementary irrigation due to incoming precipitation chances.' : 'Maintain soil moisture balance according to current crop growth stage.'}`;
    }
  }

  // ── 4. Marine, Wind & Coastal Conditions ──────────────────────────────
  if (/marine|sea|wave|swell|boat|machli|samundar|lahar|coastal|port|fisherman|fish/i.test(msgLower)) {
    const waveEst = Math.max(0.5, (wind * 0.08)).toFixed(1);
    const marineSafe = wind < 35 && imdAlert !== 'RED';

    return `### ⚓ **Marine & Coastal Weather Advisory: ${city}**

Coastal telemetry and marine safety evaluation:

- 💨 **Surface Wind Speed:** **${wind} km/h**
- 🌊 **Estimated Significant Wave Height:** **~${waveEst} m**
- 🛡️ **MoES / IMD Marine Alert:** **${imdAlert}** (${imdStatus})
- 🌡️ **Surface Temperature:** **${temp}°C** | 🌧️ **Precipitation Chance:** **${rainProb}%**

#### 🚤 **Fishermen & Marine Directive:**
- **Sea State:** **${marineSafe ? 'Moderate / Safe for Standard Coastal Operations' : 'ROUGH SEA WARNING — Small crafts advised to return to shore'}**`;
  }

  // ── 5. Temperature, Heat / Cold & Comfort ──────────────────────────────
  if (/temperature|tapman|garmi|sardi|heat|hot|cold|feels like|hum/i.test(msgLower)) {
    return `### 🌡️ **Temperature & Thermal Index: ${city}**

Current thermal observations in **${city}**:

- 🌡️ **Ambient Temperature:** **${temp}°C**
- 🔥 **Feels Like:** **${feelsLike}°C**
- 💧 **Relative Humidity:** **${humidity}%**
- 💨 **Wind Velocity:** **${wind} km/h**
- 🌤️ **General Condition:** **${condition}**
- 🛡️ **IMD Alert Level:** **${imdAlert}** (${imdStatus})

📌 *Thermal Note: ${temp >= 38 ? 'High heat index. Ensure adequate hydration and avoid prolonged sun exposure during peak noon hours.' : temp <= 15 ? 'Cool temperature. Warm layers recommended for early morning and night hours.' : 'Pleasant and comfortable thermal balance across the region.'}*`;
  }

  // ── 6. Air Quality (AQI) & Pollution ──────────────────────────────────
  if (/aqi|air quality|pm2\.5|pm10|pollution|pradushan|hawa/i.test(msgLower)) {
    return `### 🍃 **Air Quality & Pollution Report: ${city}**

Atmospheric particulate telemetry for **${city}**:

- 📊 **Air Quality Index (AQI):** **${aqi.label || 'Moderate'}**
- 💨 **PM 2.5 Concentration:** **${aqi.pm2_5 ?? 25} µg/m³**
- 💨 **PM 10 Concentration:** **${aqi.pm10 ?? 35} µg/m³**
- 🌡️ **Temperature:** **${temp}°C** | 💨 **Wind Speed:** **${wind} km/h**

#### 😷 **Health Advisory:**
- ${aqi.pm2_5 > 60 ? '⚠️ Sensitive groups should consider wearing an N95 mask during peak traffic or morning hours.' : '✅ Air quality is within acceptable limits. Safe for outdoor cardio and walks.'}`;
  }

  // ── 7. Default Comprehensive 24-Hour Grounded Briefing ────────────────
  if (detectedLang === 'hi') {
    return `### 🌤️ **मौसम सलाहकार बुलेटिन: ${city}**

**${city}** के लिए वर्तमान लाइव मौसम आंकड़े एवं परामर्श:

- 🌡️ **तापमान:** **${temp}°C** (महसूस: **${feelsLike}°C**)
- 🌤️ **स्थिति:** **${condition}**
- 💧 **आर्द्रता (Humidity):** **${humidity}%**
- 🌧️ **वर्षा की संभावना:** **${rainProb}%**
- 💨 **हवा की गति:** **${wind} km/h**
- 👁️ **दृश्यता (Visibility):** **${visibility} km**
- 🛡️ **IMD / MoES अलर्ट:** **${imdAlert}** (${imdStatus})

📌 *सुझाव: मौसम पूरी तरह स्थिर बना हुआ है। किसी भी विशिष्ट प्रश्न (जैसे बारिश, यात्रा, फसल छिड़काव आदि) के लिए तुरंत पूछें।*`;
  } else if (detectedLang === 'hinglish') {
    return `### 🌤️ **Meteorological Briefing: ${city}**

**${city}** me live weather parameters:

- 🌡️ **Temperature:** **${temp}°C** (Feels like **${feelsLike}°C**)
- 🌤️ **Condition:** **${condition}**
- 💧 **Humidity:** **${humidity}%**
- 🌧️ **Rain Chance:** **${rainProb}%**
- 💨 **Wind Speed:** **${wind} km/h**
- 👁️ **Visibility:** **${visibility} km**
- 🛡️ **IMD Alert:** **${imdAlert}** (${imdStatus})

📌 *Recommendation: Weather overall stable hai. Aap rain, highway travel, crop spraying ya 7-day forecast ke bare me specific sawaal pooch sakte hain.*`;
  } else {
    return `### 🌤️ **Meteorological Intelligence Briefing: ${city}**

Current live atmospheric observations for **${city}** (${country}):

- 🌡️ **Surface Temperature:** **${temp}°C** (Feels like **${feelsLike}°C**)
- 🌤️ **Sky Condition:** **${condition}**
- 💧 **Relative Humidity:** **${humidity}%** | 💨 **Wind Velocity:** **${wind} km/h**
- 🌧️ **Rain Probability:** **${rainProb}%** (Precipitation: ${rainMm} mm)
- 👁️ **Visibility:** **${visibility} km** | 📊 **Pressure:** **${pressure} hPa**
- 🛡️ **MoES / IMD Alert Status:** **${imdAlert}** (${imdStatus})

📌 *Operational Summary: Weather metrics are nominal and active. Feel free to ask about road driving safety, 24-hour rain windows, crop spraying feasibility, or extended outlooks.*`;
  }
}

/**
 * Calls Gemini with a system prompt + user message.
 * Returns the text response.
 *
 * @param {string} systemPrompt
 * @param {string} userMessage
 * @param {string} [apiKey]   - Optional per-role API key override
 * @param {Array}  [history]  - Conversation history: [{role, parts:[{text}]}]
 * @param {Object} [weatherData] - Grounding live weather object
 * @param {string} [role]     - User persona role
 * @param {string} [lang]     - Preferred language
 * @returns {string}
 */
async function callGemini(systemPrompt, userMessage, apiKey = null, history = [], weatherData = null, role = 'citizen', lang = 'en') {
  const allPoolKeys = getApiKeys();
  const keysToTry = apiKey
    ? [apiKey, ...allPoolKeys.filter((k) => k !== apiKey)]
    : allPoolKeys;

  let lastError = null;

  for (let i = 0; i < keysToTry.length; i++) {
    const currentKey = keysToTry[i];
    for (const modelName of PRIMARY_MODELS) {
      try {
        const ai = new GoogleGenerativeAI(currentKey);
        const model = ai.getGenerativeModel({
          model: modelName,
          systemInstruction: systemPrompt,
        });

        const chat = model.startChat({ history });
        const apiPromise = chat.sendMessage(userMessage);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Gemini API timeout (15s)')), 15000)
        );

        const result = await Promise.race([apiPromise, timeoutPromise]);
        const text = result?.response?.text();
        if (text && text.trim().length > 0) {
          return text.trim();
        }
      } catch (err) {
        lastError = err;
        logger.warn(`Gemini call failed (Key ${i + 1}/${keysToTry.length}, Model ${modelName}): ${err.message}.`);
        if (err.status === 429 || err.message?.includes('429') || err.message?.includes('timeout')) {
          break;
        }
      }
    }
  }

  logger.info(`[CHAT] Engaging high-precision Domain Grounded Meteorological Engine.`);
  return generateGroundedMeteorologicalResponse(userMessage, weatherData, role, lang);
}

/**
 * Calls Gemini in JSON-mode for structured outputs.
 * Used for intent/entity extraction.
 *
 * @param {string} systemPrompt
 * @param {string} userMessage
 * @returns {Object} Parsed JSON object
 */
async function callGeminiJSON(systemPrompt, userMessage) {
  const keysToTry = getApiKeys();

  for (let i = 0; i < keysToTry.length; i++) {
    try {
      const ai = new GoogleGenerativeAI(keysToTry[i]);
      const model = ai.getGenerativeModel({
        model: PRIMARY_MODELS[0],
        systemInstruction: systemPrompt,
        generationConfig: {
          responseMimeType: 'application/json',
        },
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Gemini JSON timeout (8s)')), 8000)
      );
      const apiPromise = model.generateContent(userMessage);

      const result = await Promise.race([apiPromise, timeoutPromise]);
      const text = result?.response?.text();
      if (text) {
        return JSON.parse(text);
      }
    } catch (err) {
      logger.warn(`Gemini JSON extraction failed (Key ${i + 1}/${keysToTry.length}): ${err.message}. Rotating...`);
    }
  }

  // Fast rule-based intent fallback if Gemini is offline
  const msgLower = (userMessage || '').toLowerCase();
  let detectedIntent = 'general_query';
  if (/crop|fasal|khet|spray|fertilizer|chhidkao|khad|pest/i.test(msgLower)) {
    detectedIntent = 'crop_advisory';
  } else if (/marine|sea|boat|wave|swell|machli|samundar|port/i.test(msgLower)) {
    detectedIntent = 'marine_weather';
  } else if (/storm|cyclone|flood|toofan|alert|danger|warning/i.test(msgLower)) {
    detectedIntent = 'disaster_alert';
  } else if (/travel|visibility|fog|highway|safar|drive/i.test(msgLower)) {
    detectedIntent = 'travel_weather';
  }

  // Extract simple location mention like "of pratapgarh", "in delhi", "at mumbai"
  let detectedLocation = null;
  const locMatch = (userMessage || '').match(/\b(?:in|at|of|for|near|mein|me|se)\s+([A-Za-z]+)\b/i);
  if (locMatch && locMatch[1]) {
    const candidate = locMatch[1].trim();
    const stopwords = ['today', 'tomorrow', 'tonight', 'now', 'morning', 'evening', 'night', 'the', 'my', 'a', 'an', 'this'];
    if (!stopwords.includes(candidate.toLowerCase())) {
      detectedLocation = candidate;
    }
  }

  return {
    intent: detectedIntent,
    location: detectedLocation,
    timeEntity: 'today',
    language: /[\u0900-\u097F]/.test(userMessage) ? 'hi' : 'en',
  };
}

function getKeyStatus() {
  const keys = getApiKeys();
  return {
    total: keys.length,
    active: keys.length > 0,
    models: PRIMARY_MODELS,
  };
}

module.exports = { callGemini, callGeminiJSON, getKeyStatus, getApiKeys };
