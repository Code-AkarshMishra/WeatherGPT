/**
 * chatController.js
 * POST /api/chat
 *
 * Flow:
 *   1. Validate input
 *   2. Extract intent & entities (NLP pass)
 *   3. Resolve location (use entity location if mentioned, else GPS)
 *   4. Fetch/cache weather for resolved location
 *   5. Build role-specific system prompt
 *   6. Call Gemini LLM
 *   7. Persist conversation + messages to MongoDB
 *   8. Return AI response with metadata
 */
const { body, validationResult } = require('express-validator');
const { extractIntent, suggestRole } = require('../services/intentService');
const { getWeather } = require('../services/weatherService');
const { buildPrompt } = require('../services/promptBuilder');
const { callGemini } = require('../services/geminiService');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Role = require('../models/Role');
const logger = require('../config/logger');
const axios = require('axios');
const mongoose = require('mongoose');

const isDbConnected = () => mongoose.connection.readyState === 1;

exports.validate = [
  body('message')
    .notEmpty().withMessage('Message is required')
    .isString().withMessage('Message must be a string')
    .isLength({ max: 2000 }).withMessage('Message too long (max 2000 chars)')
    .trim(),
  body('role')
    .optional({ values: 'falsy' })
    .isString()
    .isLength({ max: 50 }),
  body('lat')
    .optional({ values: 'falsy' })
    .isFloat({ min: -90, max: 90 }),
  body('lon')
    .optional({ values: 'falsy' })
    .isFloat({ min: -180, max: 180 }),
  body('conversationId')
    .optional({ values: 'falsy' })
    .isMongoId().withMessage('Invalid conversationId'),
  body('guestId')
    .optional({ values: 'falsy' })
    .isString()
    .isLength({ max: 100 }),
  body('lang')
    .optional({ values: 'falsy' })
    .isString()
    .isLength({ max: 15 }),
];

/**
 * Geocodes a city/place name to lat/lon using OWM geocoding API.
 * Returns null if lookup fails.
 */
async function geocodeLocation(locationName) {
  try {
    const res = await axios.get('https://api.openweathermap.org/geo/1.0/direct', {
      params: {
        q: locationName,
        limit: 1,
        appid: process.env.WEATHER_API_KEY,
      },
      timeout: 5000,
    });
    if (res.data && res.data.length > 0) {
      return { lat: res.data[0].lat, lon: res.data[0].lon, name: res.data[0].name };
    }
    return null;
  } catch {
    return null;
  }
}

exports.chat = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const {
      message,
      role: selectedRole = 'citizen',
      lat,
      lon,
      conversationId,
      guestId,
      lang = 'en',
    } = req.body;

    const userId = req.user?._id || null;

    logger.info(`[CHAT] User: ${userId || guestId || 'guest'} | Role: ${selectedRole} | Message: "${message.substring(0, 100)}..."`);

    // ── Step 1: Extract intent & entities ──────────────────────────────────
    const entities = await extractIntent(message);
    logger.info(`[CHAT] Intent extracted: ${JSON.stringify(entities)}`);

    // ── Step 2: Resolve location ────────────────────────────────────────────
    let resolvedLat = lat ? parseFloat(lat) : null;
    let resolvedLon = lon ? parseFloat(lon) : null;
    let locationOverride = null;

    if (entities.location) {
      // User mentioned a specific location in the message — geocode it
      const geo = await geocodeLocation(entities.location);
      if (geo) {
        resolvedLat = geo.lat;
        resolvedLon = geo.lon;
        locationOverride = geo.name;
        logger.info(`[CHAT] Location resolved via NLP: ${geo.name} (${geo.lat}, ${geo.lon})`);
      }
    }

    // ── Step 3: Fetch weather ───────────────────────────────────────────────
    let weatherData = null;
    if (resolvedLat !== null && resolvedLon !== null) {
      try {
        weatherData = await getWeather(resolvedLat, resolvedLon);
      } catch (weatherErr) {
        logger.warn(`[CHAT] Weather fetch failed: ${weatherErr.message}`);
      }
    }

    // ── Step 4: Build role prompt ───────────────────────────────────────────
    const systemPrompt = buildPrompt(selectedRole, weatherData, entities, lang);

    // ── Step 5: Load conversation history (last 10 turns) ──────────────────
    let conversation = null;
    let conversationHistory = [];

    if (conversationId && isDbConnected()) {
      try {
        conversation = await Conversation.findById(conversationId);
        if (conversation) {
          const recentMessages = await Message.find({ conversationId: conversation._id })
            .sort({ createdAt: -1 })
            .limit(10)
            .lean();

          conversationHistory = recentMessages.reverse().map((m) => ({
            role: m.role === 'user' ? 'user' : 'model',
            parts: [{ text: m.content }],
          }));
        }
      } catch (convErr) {
        logger.warn(`Conversation history lookup failed: ${convErr.message}`);
      }
    }

    // ── Step 6: Create conversation if new ─────────────────────────────────
    if (!conversation) {
      if (isDbConnected()) {
        try {
          conversation = await Conversation.create({
            userId,
            guestId: guestId || null,
            role: selectedRole,
            title: message.substring(0, 80),
            language: entities.language,
            location: {
              lat: resolvedLat,
              lon: resolvedLon,
              locationName: locationOverride || weatherData?.locationName || null,
            },
          });
        } catch (dbErr) {
          logger.warn(`Failed to create conversation doc: ${dbErr.message}`);
          conversation = { _id: new mongoose.Types.ObjectId() };
        }
      } else {
        conversation = { _id: new mongoose.Types.ObjectId() };
      }
    }

    // ── Step 7: Get role API key override ──────────────────────────────────
    let roleApiKey = null;
    if (isDbConnected()) {
      try {
        const roleDoc = await Role.findOne({ roleId: selectedRole });
        if (roleDoc?.apiKeyEnvVar && process.env[roleDoc.apiKeyEnvVar]) {
          roleApiKey = process.env[roleDoc.apiKeyEnvVar];
        }
      } catch {
        // Fallback to default GEMINI_API_KEY
      }
    }

    // ── Step 8: Call ML-1 Tool Calling or Grounded Role LLM ─────────────
    let aiResponse = null;
    let usedProvider = 'gemini-grounded-agent';

    const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'https://weathergpt-1-ike5.onrender.com';
    
    // Attempt fast local ML microservice tool calling
    try {
      const mlPayload = { message, role: selectedRole };
      if (resolvedLat !== null && resolvedLon !== null) {
        mlPayload.location = { lat: resolvedLat, lon: resolvedLon };
      }
      const mlRes = await axios.post(`${ML_SERVICE_URL}/chat`, mlPayload, { timeout: 6000 });
      if (
        mlRes.data?.response &&
        !mlRes.data.response.toLowerCase().includes('temporary service limit') &&
        !mlRes.data.response.toLowerCase().includes('unable to fetch')
      ) {
        aiResponse = mlRes.data.response;
        usedProvider = mlRes.data.provider || 'unified-ml-agent';
        logger.info(`[CHAT] Successfully answered via Unified ML service (${usedProvider})`);
      }
    } catch (mlErr) {
      logger.info(`[CHAT] ML microservice fallback (${mlErr.message}), proceeding with grounded Gemini LLM`);
    }


    if (!aiResponse) {
      aiResponse = await callGemini(systemPrompt, message, roleApiKey, conversationHistory);
    }

    // ── Step 9: Persist messages ────────────────────────────────────────────
    if (isDbConnected()) {
      try {
        await Promise.all([
          Message.create({
            conversationId: conversation._id,
            role: 'user',
            content: message,
            intent: entities.intent,
            entities: {
              location: entities.location,
              timeEntity: entities.timeEntity,
              language: entities.language,
            },
            weatherContext: weatherData,
          }),
          Message.create({
            conversationId: conversation._id,
            role: 'assistant',
            content: aiResponse,
          }),
        ]);

        await Conversation.findByIdAndUpdate(conversation._id, {
          $inc: { messageCount: 2 },
        });
      } catch (saveErr) {
        logger.warn(`Message persistence failed: ${saveErr.message}`);
      }
    }

    // ── Step 10: Check if role switch is suggested ─────────────────────────
    const suggestedRoleSwitch = suggestRole(entities.intent, selectedRole);

    // ── Step 11: Respond ────────────────────────────────────────────────────
    res.json({
      success: true,
      data: {
        response: aiResponse,
        conversationId: conversation._id,
        provider: usedProvider,
        nlp: {
          intent: entities.intent,
          location: entities.location || locationOverride,
          timeEntity: entities.timeEntity,
          language: entities.language,
        },
        suggestedRole: suggestedRoleSwitch,
        weather: weatherData
          ? {
              locationName: weatherData.locationName,
              temperature: weatherData.temperature,
              feelsLike: weatherData.feelsLike,
              condition: weatherData.condition,
              humidity: weatherData.humidity,
              windSpeed: weatherData.windSpeed,
              rainProbability: weatherData.rainProbability,
              disasterRisk: weatherData.disasterRisk || null,
            }
          : null,
      },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/chat/conversations — list user's conversations
exports.getConversations = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const conversations = await Conversation.find({ userId })
      .sort({ updatedAt: -1 })
      .limit(20)
      .lean();

    res.json({ success: true, data: conversations });
  } catch (err) {
    next(err);
  }
};

// GET /api/chat/conversations/:id/messages
exports.getMessages = async (req, res, next) => {
  try {
    const { id } = req.params;
    const conversation = await Conversation.findById(id);

    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found.' });
    }

    // Authorization: user must own the conversation (or it's a guest conv with no userId)
    if (conversation.userId && String(conversation.userId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, error: 'Access denied.' });
    }

    const messages = await Message.find({ conversationId: id })
      .sort({ createdAt: 1 })
      .lean();

    res.json({ success: true, data: messages });
  } catch (err) {
    next(err);
  }
};
