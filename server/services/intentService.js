/**
 * intentService.js
 * NLP intent and entity extraction using Gemini in JSON-mode.
 *
 * Runs BEFORE the main chat call to understand:
 *   - intent: what the user wants
 *   - location: any place name mentioned (overrides GPS)
 *   - timeEntity: temporal reference
 *   - language: detected input language (for response language matching)
 *
 * Results are logged for debugging and stored with each message in MongoDB.
 */
const { callGeminiJSON } = require('./geminiService');
const logger = require('../config/logger');

const INTENT_SYSTEM_PROMPT = `You are a weather query intent and entity extractor. 
Your task is to analyze user messages (which may be in English, Hindi, Hinglish, 
Romanized Hindi, or code-mixed Hindi-English) and extract structured information.

IMPORTANT: You understand Hinglish — mixed Hindi and English, Romanized Hindi 
(e.g. "baarish", "mausam", "tufaan"), and Indian regional language mixing.

Return ONLY a valid JSON object with this exact structure:
{
  "intent": "<one of the intents below>",
  "location": "<city/district/region name if explicitly mentioned, else null>",
  "timeEntity": "<today|tomorrow|this_week|specific_date|null>",
  "language": "<en|hi|hinglish>"
}

Valid intents:
- current_weather: asking about current weather conditions
- forecast: asking about future weather (tomorrow, this week, etc.)
- rain_probability: specifically asking about rain chances
- flood_alert: asking about flood risk, flood alerts, flood-prone areas
- crop_advisory: asking about farming, crops, irrigation, sowing
- climate_trend: asking about long-term climate patterns or historical data
- aviation_briefing: asking about flight conditions, turbulence, visibility for aviation
- marine_weather: asking about sea conditions, waves, maritime weather
- disaster_management: asking about evacuation, shelter, disaster preparedness
- general_query: anything that doesn't fit the above categories

Examples:
- "Kerala mein baarish kab hogi?" → intent: rain_probability, location: Kerala, language: hinglish
- "What is the temperature in Mumbai?" → intent: current_weather, location: Mumbai, language: en
- "Kya aaj flood ka khatre hai?" → intent: flood_alert, location: null, language: hinglish
- "Show me 7-day forecast for Delhi" → intent: forecast, location: Delhi, language: en
- "Is it safe to fly to Chennai tomorrow?" → intent: aviation_briefing, location: Chennai, language: en`;

/**
 * Extracts intent and entities from a user message.
 *
 * @param {string} message - Raw user message
 * @returns {Object} { intent, location, timeEntity, language }
 */
async function extractIntent(message) {
  const result = await callGeminiJSON(INTENT_SYSTEM_PROMPT, message);

  // Validate and sanitize the result
  const validIntents = [
    'current_weather', 'forecast', 'rain_probability', 'flood_alert',
    'crop_advisory', 'climate_trend', 'aviation_briefing', 'marine_weather',
    'disaster_management', 'general_query',
  ];

  const extracted = {
    intent: validIntents.includes(result.intent) ? result.intent : 'general_query',
    location: typeof result.location === 'string' ? result.location.trim() : null,
    timeEntity: result.timeEntity || null,
    language: ['en', 'hi', 'hinglish'].includes(result.language) ? result.language : 'en',
  };

  logger.info(`[NLP] Intent extracted: ${JSON.stringify(extracted)}`);
  return extracted;
}

/**
 * Maps intent to the best-matching role if the current role doesn't match.
 * Used to auto-suggest role switching in the UI.
 */
const INTENT_TO_ROLE = {
  flood_alert: 'flood_disaster',
  disaster_management: 'flood_disaster',
  crop_advisory: 'farmer',
  aviation_briefing: 'aviation',
  marine_weather: 'marine',
  climate_trend: 'climate_analyst',
};

function suggestRole(intent, currentRole) {
  const suggestedRole = INTENT_TO_ROLE[intent];
  if (suggestedRole && suggestedRole !== currentRole) {
    return suggestedRole;
  }
  return null;
}

module.exports = { extractIntent, suggestRole };
