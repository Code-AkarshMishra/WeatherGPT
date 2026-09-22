const weatherService = require('../services/weather/weather.service');
const alertService = require('../services/alerts/alert.service');
const aiService = require('../services/ai/ai.service');
const locationService = require('../services/location/location.service');
const ChatSession = require('../models/ChatSession');
const ChatMessage = require('../models/ChatMessage');
const { sendSuccess } = require('../utils/response');
const logger = require('../utils/logger');

class ChatController {
  async sendMessage(req, res, next) {
    try {
      const { message, location, language = 'en', role = 'citizen', sessionId } = req.body;
      const userId = req.user ? req.user._id : null;

      // 1. Resolve Session
      let session;
      if (sessionId) {
        session = await ChatSession.findById(sessionId);
      }
      if (!session) {
        session = await ChatSession.create({
          userId,
          title: message.substring(0, 40) + '...',
          location,
          language,
          metadata: { role },
        });
      }

      // Save User Message
      await ChatMessage.create({
        sessionId: session._id,
        role: 'user',
        content: message,
      });

      // 2. Resolve coordinates — never invent a default city/weather location
      let resolvedLoc = location;
      if ((!resolvedLoc || resolvedLoc.lat == null || resolvedLoc.lon == null) && typeof message === 'string') {
        const matches = await locationService.search(message, 1).catch(() => []);
        if (matches && matches[0] && matches[0].lat != null && matches[0].lon != null) {
          resolvedLoc = matches[0];
        }
      }
      if (!resolvedLoc || resolvedLoc.lat == null || resolvedLoc.lon == null) {
        return sendSuccess(res, {
          sessionId: session._id,
          reply: 'Weather data is currently unavailable because no location coordinates were provided.',
          structuredData: {
            status: 'unavailable',
            data: null,
            message: 'Location required. WeatherGPT does not assume a default city.',
          },
          sources: [],
          timestamp: new Date().toISOString(),
        });
      }

      const currentWeather = await weatherService.getCurrentWeather(resolvedLoc.lat, resolvedLoc.lon);
      const [forecast, alerts, risk] = await Promise.all([
        weatherService.getDailyForecast(resolvedLoc.lat, resolvedLoc.lon, 3),
        alertService.getAlertsForLocation(resolvedLoc.name, resolvedLoc.lat, resolvedLoc.lon),
        aiService.calculateRisk(currentWeather, [], resolvedLoc),
      ]);

      const contextPackage = {
        query: message,
        location: currentWeather.location,
        currentWeather: currentWeather.current,
        forecast: forecast.daily,
        activeAlerts: alerts,
        risk,
        language,
        role,
      };

      // 3. Generate AI Answer
      const aiResponse = await aiService.generateChatResponse(contextPackage);

      // Save Assistant Message
      const assistantMsg = await ChatMessage.create({
        sessionId: session._id,
        role: 'assistant',
        content: aiResponse.message,
        structuredData: aiResponse.structuredData,
        sources: aiResponse.sources,
      });

      return sendSuccess(res, {
        sessionId: session._id,
        messageId: assistantMsg._id,
        reply: aiResponse.message,
        structuredData: aiResponse.structuredData,
        sources: aiResponse.sources,
        timestamp: assistantMsg.createdAt,
      });
    } catch (error) {
      next(error);
    }
  }

  async streamChat(req, res, next) {
    try {
      const { message, location, language = 'en', role = 'citizen', sessionId } = req.body;
      const userId = req.user ? req.user._id : null;

      // Setup Server-Sent Events headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();

      const sendEvent = (event, data) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      sendEvent('status', { status: 'INITIALIZING', message: 'Analyzing meteorological context...' });

      // Resolve Session
      let session;
      if (sessionId) {
        session = await ChatSession.findById(sessionId).catch(() => null);
      }
      if (!session) {
        session = await ChatSession.create({
          userId,
          title: message.substring(0, 40) + '...',
          location,
          language,
          metadata: { role },
        });
      }

      await ChatMessage.create({
        sessionId: session._id,
        role: 'user',
        content: message,
      });

      let resolvedLoc = location;
      if ((!resolvedLoc || resolvedLoc.lat == null || resolvedLoc.lon == null) && typeof message === 'string') {
        const matches = await locationService.search(message, 1).catch(() => []);
        if (matches && matches[0] && matches[0].lat != null && matches[0].lon != null) {
          resolvedLoc = matches[0];
        }
      }
      if (!resolvedLoc || resolvedLoc.lat == null || resolvedLoc.lon == null) {
        sendEvent('error', {
          status: 'unavailable',
          message: 'Location required. WeatherGPT does not assume a default city.',
        });
        sendEvent('done', {
          reply: 'Weather data is currently unavailable because no location coordinates were provided.',
        });
        return res.end();
      }

      sendEvent('tool', { tool: 'METEOROLOGICAL_LOOKUP', target: resolvedLoc.name || 'coordinates' });

      const [currentWeather, forecast, alerts] = await Promise.all([
        weatherService.getCurrentWeather(resolvedLoc.lat, resolvedLoc.lon),
        weatherService.getDailyForecast(resolvedLoc.lat, resolvedLoc.lon, 3),
        alertService.getAlertsForLocation(resolvedLoc.name, resolvedLoc.lat, resolvedLoc.lon),
      ]);

      const risk = await aiService.calculateRisk(currentWeather, alerts, resolvedLoc);

      sendEvent('status', { status: 'SYNTHESIZING', message: 'Generating intelligent weather advisory...' });

      const contextPackage = {
        query: message,
        location: currentWeather.location,
        currentWeather: currentWeather.current,
        forecast: forecast.daily,
        activeAlerts: alerts,
        risk,
        language,
        role,
      };

      const aiResponse = await aiService.generateChatResponse(contextPackage);

      // Stream tokens sequentially
      const words = aiResponse.message.split(' ');
      for (const word of words) {
        sendEvent('token', { token: word + ' ' });
        // Tiny non-blocking micro-delay for realistic stream experience
        await new Promise((resolve) => setTimeout(resolve, 20));
      }

      // Persist assistant message
      const assistantMsg = await ChatMessage.create({
        sessionId: session._id,
        role: 'assistant',
        content: aiResponse.message,
        structuredData: aiResponse.structuredData,
        sources: aiResponse.sources,
      });

      sendEvent('result', {
        sessionId: session._id,
        messageId: assistantMsg._id,
        structuredData: aiResponse.structuredData,
        sources: aiResponse.sources,
      });

      sendEvent('done', { status: 'COMPLETED' });
      res.end();
    } catch (error) {
      logger.error('Error in chat SSE streaming:', { error: error.message });
      res.write(`event: error\ndata: ${JSON.stringify({ message: error.message })}\n\n`);
      res.end();
    }
  }

  async getSessionHistory(req, res, next) {
    try {
      const { sessionId } = req.params;
      const messages = await ChatMessage.find({ sessionId }).sort({ createdAt: 1 }).lean();
      return sendSuccess(res, { messages });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ChatController();
