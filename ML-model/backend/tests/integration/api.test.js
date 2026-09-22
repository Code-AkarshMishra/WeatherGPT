const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const env = require('../../src/config/env');

beforeAll(async () => {
  // Connect to MongoDB if available or run with mock
  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 2000 });
    }
  } catch (e) {
    // If local MongoDB is not running, mock mode allows tests to continue
  }
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
});

describe('WeatherGPT API Integration Suite', () => {
  // 1. Health & Readiness
  describe('Health Endpoints', () => {
    test('GET /health returns 200 and standard envelope', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('UP');
      expect(res.body.meta.timestamp).toBeDefined();
    });

    test('GET /ready returns readiness status', async () => {
      const res = await request(app).get('/ready');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.services).toBeDefined();
    });
  });

  // 2. Weather APIs
  describe('Weather APIs', () => {
    test('GET /api/weather/current returns canonical schema', async () => {
      const res = await request(app)
        .get('/api/weather/current')
        .query({ lat: '26.8467', lon: '80.9462' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.location).toBeDefined();
      expect(res.body.data.current.temperature).toBeDefined();
      expect(res.body.data.source).toBeDefined();
      expect(res.body.data.dataUpdatedAt).toBeDefined();
    });

    test('GET /api/weather/forecast returns unified forecast', async () => {
      const res = await request(app)
        .get('/api/weather/forecast')
        .query({ lat: '26.8467', lon: '80.9462' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.current).toBeDefined();
      expect(res.body.data.hourly).toBeInstanceOf(Array);
      expect(res.body.data.daily).toBeInstanceOf(Array);
    });

    test('GET /api/weather/current validates invalid coordinates', async () => {
      const res = await request(app)
        .get('/api/weather/current')
        .query({ lat: '120.5', lon: '80.9462' }); // lat > 90

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // 3. Location APIs
  describe('Location APIs', () => {
    test('GET /api/location/search returns matching locations', async () => {
      const res = await request(app)
        .get('/api/location/search')
        .query({ q: 'Lucknow' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.locations.length).toBeGreaterThan(0);
      expect(res.body.data.locations[0].name).toBe('Lucknow');
    });

    test('GET /api/location/popular returns default Indian cities', async () => {
      const res = await request(app).get('/api/location/popular');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.locations.length).toBeGreaterThan(5);
    });
  });

  // 4. Risk Score API
  describe('Risk Score API', () => {
    test('GET /api/risk calculates multi-factor score', async () => {
      const res = await request(app)
        .get('/api/risk')
        .query({ lat: '26.8467', lon: '80.9462' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(typeof res.body.data.score).toBe('number');
      expect(['LOW', 'MODERATE', 'HIGH', 'EXTREME']).toContain(res.body.data.level);
      expect(res.body.data.factors).toBeInstanceOf(Array);
    });
  });

  // 5. Advisory API
  describe('Advisory API', () => {
    test('POST /api/advisory generates domain-specific advisory', async () => {
      const res = await request(app)
        .post('/api/advisory')
        .send({
          location: { name: 'Lucknow', lat: 26.8467, lon: 80.9462 },
          domain: 'agriculture',
          language: 'en',
          context: { crop: 'Paddy' },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.domain).toBe('agriculture');
      expect(res.body.data.recommendation).toBeDefined();
      expect(res.body.data.actionPoints).toBeInstanceOf(Array);
    });
  });

  // 6. Chat API
  describe('Chat API', () => {
    test('POST /api/chat synthesizes intelligent response', async () => {
      const res = await request(app)
        .post('/api/chat')
        .send({
          message: 'Will it rain today in Lucknow?',
          location: { lat: 26.8467, lon: 80.9462, name: 'Lucknow' },
          language: 'en',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.reply).toBeDefined();
      expect(res.body.data.sources).toBeDefined();
    });

    test('POST /api/chat/stream streams SSE events', async () => {
      const res = await request(app)
        .post('/api/chat/stream')
        .send({
          message: 'Give me a brief forecast for Lucknow',
          location: { lat: 26.8467, lon: 80.9462, name: 'Lucknow' },
          language: 'en',
        });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/event-stream');
      expect(res.text).toContain('event: status');
      expect(res.text).toContain('event: done');
    });
  });

  // 7. Climate API
  describe('Climate APIs', () => {
    test('GET /api/climate/history returns historical series', async () => {
      const res = await request(app)
        .get('/api/climate/history')
        .query({
          lat: '26.8467',
          lon: '80.9462',
          start: '2026-08-01',
          end: '2026-08-10',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.history).toBeInstanceOf(Array);
      expect(res.body.data.count).toBe(10);
    });

    test('GET /api/climate/trend returns trend regression and anomalies', async () => {
      const res = await request(app)
        .get('/api/climate/trend')
        .query({
          lat: '26.8467',
          lon: '80.9462',
          start: '2026-08-01',
          end: '2026-08-10',
          metric: 'temperature',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.summary.mean).toBeDefined();
      expect(res.body.data.summary.trendDirection).toBeDefined();
    });
  });

  // 8. Map API
  describe('Disaster Map API', () => {
    test('GET /api/map/alerts returns GeoJSON FeatureCollection', async () => {
      const res = await request(app).get('/api/map/alerts');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.type).toBe('FeatureCollection');
      expect(res.body.data.features).toBeInstanceOf(Array);
    });

    test('GET /api/map/layers returns available map visualization layers', async () => {
      const res = await request(app).get('/api/map/layers');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.layers.length).toBeGreaterThan(0);
    });
  });
});
