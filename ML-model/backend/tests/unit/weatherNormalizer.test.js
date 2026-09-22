const { WeatherNormalizer, mapWmoCodeToCondition } = require('../../src/services/weather/normalizers/weather.normalizer');

describe('WeatherNormalizer Unit Tests', () => {
  const mockLocation = {
    id: '26.8467,80.9462',
    name: 'Lucknow',
    region: 'Uttar Pradesh',
    country: 'India',
    lat: 26.8467,
    lon: 80.9462,
  };

  test('should map WMO weather codes to human-readable conditions', () => {
    expect(mapWmoCodeToCondition(0)).toBe('Clear Sky');
    expect(mapWmoCodeToCondition(65)).toBe('Heavy Rain');
    expect(mapWmoCodeToCondition(95)).toBe('Thunderstorm');
    expect(mapWmoCodeToCondition(null)).toBe('Clear');
  });

  test('should normalize raw current weather data to canonical schema', () => {
    const raw = {
      temperature: 32.5,
      feelsLike: 36.2,
      humidity: 75,
      windSpeed: 16,
      windDirection: 180,
      pressure: 1005,
      visibility: 8,
      precipitation: 0,
      precipitationProbability: 40,
      weatherCode: 2,
    };

    const normalized = WeatherNormalizer.normalizeCurrent(raw, mockLocation, 'IMD');

    expect(normalized.location.name).toBe('Lucknow');
    expect(normalized.location.lat).toBe(26.8467);
    expect(normalized.current.temperature).toBe(32.5);
    expect(normalized.current.condition).toBe('Partly Cloudy');
    expect(normalized.source).toBe('IMD');
    expect(normalized.dataUpdatedAt).toBeDefined();
  });

  test('should preserve nulls for missing values instead of converting to zero', () => {
    const rawPartial = {
      temperature: 28,
    };

    const normalized = WeatherNormalizer.normalizeCurrent(rawPartial, mockLocation, 'IMD');

    expect(normalized.current.temperature).toBe(28);
    expect(normalized.current.humidity).toBeNull();
    expect(normalized.current.windSpeed).toBeNull();
    expect(normalized.current.pressure).toBeNull();
  });
});
