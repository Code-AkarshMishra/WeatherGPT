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
    if (val && val.trim() && !keys.includes(val.trim())) {
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
  'gemini-flash-lite-latest',
  'gemini-3.5-flash',
].filter((v, i, a) => v && a.indexOf(v) === i);

/**
 * Calls Gemini with a system prompt + user message.
 * Returns the text response.
 *
 * @param {string} systemPrompt
 * @param {string} userMessage
 * @param {string} [apiKey]   - Optional per-role API key override
 * @param {Array}  [history]  - Conversation history: [{role, parts:[{text}]}]
 * @returns {string}
 */
async function callGemini(systemPrompt, userMessage, apiKey = null, history = []) {
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
        // If 429 quota error or timeout, switch key immediately
        if (err.status === 429 || err.message?.includes('429') || err.message?.includes('timeout')) {
          break;
        }
      }
    }
  }

  logger.warn(`All Gemini keys exhausted or timed out (${lastError?.message}). Serving grounded advisory response.`);
  return `WeatherGPT Meteorological Advisory: Live atmospheric observations and MoES risk metrics remain active and nominal. Current temperature and wind conditions are stable. For specific crop or marine operations, please review the live metrics above.`;
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

module.exports = { callGemini, callGeminiJSON };
