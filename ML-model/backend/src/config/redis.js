const Redis = require('ioredis');
const env = require('./env');
const logger = require('../utils/logger');

let redisClient = null;
let isRedisAvailable = false;

// In-memory fallback map when Redis is offline
const memoryStore = new Map();
const memoryExpiry = new Map();

const initRedis = () => {
  if (redisClient) return redisClient;

  try {
    redisClient = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      retryStrategy(times) {
        if (times > 3) {
          logger.warn('Redis unavailable after 3 attempts. Falling back to in-memory cache.');
          return null; // Stop retrying and use in-memory fallback
        }
        return Math.min(times * 100, 2000);
      },
      lazyConnect: true,
      enableOfflineQueue: false,
    });

    redisClient.on('connect', () => {
      isRedisAvailable = true;
      logger.info('Connected to Redis server.');
    });

    redisClient.on('error', (err) => {
      isRedisAvailable = false;
      logger.warn('Redis connection issue, continuing with memory cache:', { message: err.message });
    });

    redisClient.connect().catch((err) => {
      isRedisAvailable = false;
      logger.warn('Initial Redis connection failed, using in-memory store:', { message: err.message });
    });
  } catch (error) {
    isRedisAvailable = false;
    logger.warn('Could not initialize Redis client, fallback active:', { message: error.message });
  }

  return redisClient;
};

// Unified cache interface
const cacheClient = {
  get: async (key) => {
    if (isRedisAvailable && redisClient) {
      try {
        const val = await redisClient.get(key);
        return val ? JSON.parse(val) : null;
      } catch (err) {
        logger.debug('Redis GET error, checking memory:', { key, err: err.message });
      }
    }
    // Fallback to memory
    const now = Date.now();
    const exp = memoryExpiry.get(key);
    if (exp && exp < now) {
      memoryStore.delete(key);
      memoryExpiry.delete(key);
      return null;
    }
    const item = memoryStore.get(key);
    return item !== undefined ? item : null;
  },

  set: async (key, value, ttlSeconds = 300) => {
    if (isRedisAvailable && redisClient) {
      try {
        await redisClient.set(key, JSON.stringify(value), 'EX', ttlSeconds);
        return true;
      } catch (err) {
        logger.debug('Redis SET error, saving to memory:', { key, err: err.message });
      }
    }
    // Memory store fallback
    memoryStore.set(key, value);
    if (ttlSeconds) {
      memoryExpiry.set(key, Date.now() + ttlSeconds * 1000);
    }
    return true;
  },

  del: async (key) => {
    if (isRedisAvailable && redisClient) {
      try {
        await redisClient.del(key);
      } catch (err) {
        logger.debug('Redis DEL error:', { key, err: err.message });
      }
    }
    memoryStore.delete(key);
    memoryExpiry.delete(key);
    return true;
  },

  flush: async () => {
    if (isRedisAvailable && redisClient) {
      try {
        await redisClient.flushall();
      } catch (err) {
        logger.debug('Redis FLUSH error:', { err: err.message });
      }
    }
    memoryStore.clear();
    memoryExpiry.clear();
    return true;
  },

  isRedisConnected: () => isRedisAvailable,
};

module.exports = {
  initRedis,
  cacheClient,
};
