const { cacheClient } = require('../../config/redis');
const logger = require('../../utils/logger');
const { CACHE_TTL } = require('../../utils/constants');

class CacheService {
  static makeKey(prefix, ...parts) {
    return `${prefix}:${parts.map((p) => (typeof p === 'number' ? p.toFixed(4) : p)).join(':')}`;
  }

  static async get(key) {
    try {
      const data = await cacheClient.get(key);
      if (data) {
        logger.debug(`Cache HIT for key: ${key}`);
        return data;
      }
      logger.debug(`Cache MISS for key: ${key}`);
      return null;
    } catch (err) {
      logger.warn(`Cache get failed for key: ${key}`, { error: err.message });
      return null;
    }
  }

  static async set(key, value, ttlSeconds = CACHE_TTL.CURRENT_WEATHER) {
    try {
      await cacheClient.set(key, value, ttlSeconds);
      return true;
    } catch (err) {
      logger.warn(`Cache set failed for key: ${key}`, { error: err.message });
      return false;
    }
  }

  static async del(key) {
    try {
      await cacheClient.del(key);
      return true;
    } catch (err) {
      logger.warn(`Cache del failed for key: ${key}`, { error: err.message });
      return false;
    }
  }
}

module.exports = CacheService;
