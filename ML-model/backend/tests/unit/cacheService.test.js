const CacheService = require('../../src/services/cache/cache.service');

describe('CacheService Unit Tests', () => {
  test('should generate uniform formatted cache keys', () => {
    const key = CacheService.makeKey('weather:current', 26.846711, 80.946233);
    expect(key).toBe('weather:current:26.8467:80.9462');
  });

  test('should set, get, and delete values cleanly in memory fallback', async () => {
    const testKey = 'test:key:1';
    const testValue = { temp: 30, city: 'Lucknow' };

    await CacheService.set(testKey, testValue, 10);
    const retrieved = await CacheService.get(testKey);

    expect(retrieved).toEqual(testValue);

    await CacheService.del(testKey);
    const afterDel = await CacheService.get(testKey);
    expect(afterDel).toBeNull();
  });
});
