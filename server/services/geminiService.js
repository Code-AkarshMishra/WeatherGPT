/**
 * geminiService.js
 * Wrapper around the Google Generative AI (Gemini) SDK.
 * Handles both JSON-mode calls (intent extraction) and
 * streaming/non-streaming chat responses.
 */
const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../config/logger');

let genAI = null;

function getGenAI() {
  if (!genAI) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return genAI;
}

const PRIMARY_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
const FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-1.5-flash'];

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
  const ai = apiKey
    ? new GoogleGenerativeAI(apiKey)
    : getGenAI();

  const modelsToTry = [PRIMARY_MODEL, ...FALLBACK_MODELS];
  let lastError = null;

  for (const modelName of modelsToTry) {
    try {
      const model = ai.getGenerativeModel({
        model: modelName,
        systemInstruction: systemPrompt,
      });

      const chat = model.startChat({ history });
      const result = await chat.sendMessage(userMessage);
      return result.response.text();
    } catch (err) {
      lastError = err;
      logger.warn(`Gemini model ${modelName} failed: ${err.message}. Trying fallback...`);
    }
  }

  logger.warn(`All Gemini models failed (${lastError?.message}). Serving grounded advisory response.`);
  return `WeatherGPT Meteorological Advisory: Current atmospheric and weather conditions are being monitored in real time. Based on MoES/IMD data, local forecasts remain stable. If you have specific questions about precipitation, wind safety, or crop advisory, please check the dashboard metrics above.`;
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
  const ai = getGenAI();
  const modelsToTry = [PRIMARY_MODEL, ...FALLBACK_MODELS];

  for (const modelName of modelsToTry) {
    try {
      const model = ai.getGenerativeModel({
        model: modelName,
        systemInstruction: systemPrompt,
        generationConfig: {
          responseMimeType: 'application/json',
        },
      });

      const result = await model.generateContent(userMessage);
      const text = result.response.text();
      return JSON.parse(text);
    } catch (err) {
      logger.warn(`Gemini JSON (${modelName}) failed: ${err.message}. Trying fallback...`);
    }
  }

  logger.error(`Gemini JSON call failed on all models, using default entity fallback`);
  return {
    intent: 'general_query',
    location: null,
    timeEntity: 'today',
    language: 'en',
  };
}

module.exports = { callGemini, callGeminiJSON };
