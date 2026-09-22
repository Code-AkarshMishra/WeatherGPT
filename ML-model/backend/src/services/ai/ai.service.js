const axios = require('axios');
const env = require('../../config/env');
const logger = require('../../utils/logger');
const RiskScore = require('../../models/RiskScore');
const Advisory = require('../../models/Advisory');
const ApiError = require('../../utils/apiError');

class AIService {
  constructor() {
    const headers = {
      'Content-Type': 'application/json',
    };
    if (env.AI_SERVICE_API_KEY && env.AI_SERVICE_API_KEY !== 'weathergpt-ai-secret-key') {
      headers['X-Internal-Secret'] = env.AI_SERVICE_API_KEY;
    }

    this.client = axios.create({
      baseURL: env.AI_SERVICE_URL,
      timeout: 25000,
      headers,
    });
  }

  /**
   * Try weathergpt-2 paths first (/risk/score), then gpt-aiml-style (/api/v1/...).
   * Never invents weather or risk when the AI service is down.
   */
  async _postAi(paths, payload) {
    if (env.MOCK_EXTERNAL_APIS || !env.AI_SERVICE_URL) {
      throw ApiError.aiServiceError(
        'AI service is not configured. WeatherGPT does not invent answers when the intelligence service is unavailable.'
      );
    }

    let lastError = null;
    for (const path of paths) {
      try {
        const response = await this.client.post(path, payload);
        if (response.data) {
          return response.data;
        }
      } catch (err) {
        lastError = err;
        logger.warn(`AI service POST ${path} failed:`, { error: err.message });
      }
    }

    throw ApiError.aiServiceError(
      `AI service unavailable (${lastError?.message || 'no response'}). ` +
        'WeatherGPT does not invent risk scores, advisories, or chat answers as a fallback.'
    );
  }

  async calculateRisk(weatherData, alerts = [], location) {
    const geoLoc = {
      name: location.name || 'Location',
      state: location.region || 'India',
      country: location.country || 'India',
      lat: Number(location.lat),
      lon: Number(location.lon),
    };

    const riskPayload = {
      location: geoLoc,
      hazard: 'composite',
      weather_context: weatherData.current || weatherData || {},
      forecast_context: weatherData.daily || [],
      alert_context: alerts || [],
    };

    const remoteData = await this._postAi(['/risk/score', '/api/v1/risk/score'], riskPayload);

    if (remoteData.available === false || remoteData.score == null) {
      throw ApiError.aiServiceError(
        remoteData.explanation ||
          'Risk score unavailable: live meteorological inputs missing. Values are not invented.'
      );
    }

    const riskResult = {
      available: true,
      score: remoteData.score,
      level: remoteData.level,
      confidence: remoteData.confidence,
      factors: (remoteData.factors || []).map((f) => ({
        name: f.feature || f.name,
        value: f.observed_value !== undefined ? f.observed_value : f.value,
        impact: f.impact,
      })),
      sourceContext: ['WeatherGPT-AI-Engine', weatherData.source || 'live provider'].filter(Boolean),
      modelVersion: remoteData.model_version || 'rule-v1',
      explanation: remoteData.explanation,
      officialWarning: remoteData.official_warning === true,
      generatedAt: remoteData.evaluated_at || new Date().toISOString(),
    };

    RiskScore.create({
      location: geoLoc,
      score: riskResult.score,
      level: riskResult.level,
      factors: riskResult.factors,
      sourceContext: riskResult.sourceContext,
      modelVersion: riskResult.modelVersion,
      generatedAt: new Date(),
    }).catch((err) => logger.warn('MongoDB RiskScore persist error:', { error: err.message }));

    return riskResult;
  }

  async generateAdvisory({ location, domain, context = {}, language = 'en', weatherContext }) {
    const geoLoc = {
      name: location.name || 'Location',
      state: location.region || 'India',
      country: location.country || 'India',
      lat: Number(location.lat),
      lon: Number(location.lon),
    };

    let aiDomain = domain;
    if (domain === 'urban_planning' || domain === 'public_health' || domain === 'general') {
      aiDomain = 'urban_general';
    } else if (domain === 'aviation' || domain === 'marine' || domain === 'tourism') {
      aiDomain = 'travel';
    }

    const payload = {
      location: geoLoc,
      domain: aiDomain,
      weather_context: weatherContext?.current || {},
      alert_context: weatherContext?.activeAlerts || [],
      user_context: context,
    };

    const data = await this._postAi(['/advisory', '/api/v1/advisory'], payload);

    const unavailable =
      data.available === false ||
      (typeof data.title === 'string' && data.title.toLowerCase().includes('unavailable')) ||
      (typeof data.summary === 'string' &&
        data.summary.includes('does not invent') &&
        (!data.recommendations || data.recommendations.length <= 1));

    if (unavailable) {
      throw ApiError.aiServiceError(
        data.summary ||
          data.caveats ||
          'Advisory unavailable: live weather inputs missing. Values are not invented.'
      );
    }

    const advisoryResult = {
      available: true,
      output: {
        title: data.title,
        recommendation: data.summary,
        actionPoints: (data.recommendations || []).map((r) =>
          typeof r === 'string' ? r : `${r.action} (${r.reason})`
        ),
        factors: [
          { name: 'Severity', value: data.severity },
          { name: 'Valid Until', value: data.valid_until },
        ].filter((f) => f.value != null),
        limitations: data.caveats ? [data.caveats] : [],
      },
      sources: ['WeatherGPT AI Advisory Engine'],
      generatedAt: data.data_timestamp || new Date().toISOString(),
    };

    Advisory.create({
      location: geoLoc,
      domain,
      language,
      inputContext: context,
      output: advisoryResult.output,
      sources: advisoryResult.sources,
      generatedAt: new Date(),
    }).catch((err) => logger.warn('MongoDB Advisory persist error:', { error: err.message }));

    return advisoryResult;
  }

  async generateChatResponse(contextPackage) {
    const { query, location, currentWeather, forecast, activeAlerts, risk, language, role } =
      contextPackage;

    const chatPayload = {
      message: query,
      user_message: query,
      language: language || 'en',
      role: role || 'citizen',
      location: {
        name: location?.name || undefined,
        state: location?.region || undefined,
        country: location?.country || undefined,
        lat: location?.lat != null ? Number(location.lat) : null,
        lon: location?.lon != null ? Number(location.lon) : null,
      },
      context: {
        current_weather: currentWeather || {},
        forecast: forecast || [],
        alerts: activeAlerts || [],
        history: [],
      },
      weather_context: currentWeather || {},
      forecast_context: forecast || [],
      alert_context: activeAlerts || [],
    };

    logger.info(`Forwarding grounded chat query to AI service at ${env.AI_SERVICE_URL}`);
    const aiData = await this._postAi(['/chat', '/api/v1/chat'], chatPayload);

    const message = aiData.response || aiData.answer;
    if (!message) {
      throw ApiError.aiServiceError(
        'AI service returned an empty response. WeatherGPT does not invent chat answers.'
      );
    }

    return {
      message,
      structuredData: {
        current: aiData.weather_report || currentWeather || null,
        risk: aiData.risk || risk || null,
        advisory: aiData.advisory || null,
        intent: aiData.intent,
        role: aiData.role || role || 'citizen',
        language: aiData.language || language || 'en',
        confidence: aiData.confidence,
        followUpQuestions: aiData.follow_up_questions || [],
        disasterAssessment: aiData.disaster_assessment || null,
        historicalAnalysis: aiData.historical_analysis || null,
        modelVersion: aiData.model_version || 'weathergpt-v1.0',
      },
      sources: (aiData.sources || []).map(
        (s) => `${s.provider || 'WeatherGPT'}: ${s.title || 'Meteorological Data'}`
      ),
    };
  }
}

module.exports = new AIService();
