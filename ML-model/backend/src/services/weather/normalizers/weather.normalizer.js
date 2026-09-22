const mapWmoCodeToCondition = (code) => {
  if (code === undefined || code === null) return 'Clear';
  const mapping = {
    0: 'Clear Sky',
    1: 'Mainly Clear',
    2: 'Partly Cloudy',
    3: 'Overcast',
    45: 'Fog',
    48: 'Depositing Rime Fog',
    51: 'Light Drizzle',
    53: 'Moderate Drizzle',
    55: 'Dense Drizzle',
    61: 'Slight Rain',
    63: 'Moderate Rain',
    65: 'Heavy Rain',
    71: 'Slight Snow',
    73: 'Moderate Snow',
    75: 'Heavy Snow',
    80: 'Slight Rain Showers',
    81: 'Moderate Rain Showers',
    82: 'Violent Rain Showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with Slight Hail',
    99: 'Thunderstorm with Heavy Hail',
  };
  return mapping[code] || 'Cloudy';
};

class WeatherNormalizer {
  static normalizeCurrent(raw, location, source = 'IMD') {
    return {
      location: {
        id: location.id || `${location.lat.toFixed(4)},${location.lon.toFixed(4)}`,
        name: location.name || 'Current Location',
        region: location.region || null,
        country: location.country || 'India',
        lat: Number(location.lat),
        lon: Number(location.lon),
      },
      current: {
        temperature: raw.temperature !== undefined ? Number(raw.temperature) : null,
        feelsLike: raw.feelsLike !== undefined ? Number(raw.feelsLike) : null,
        humidity: raw.humidity !== undefined ? Number(raw.humidity) : null,
        windSpeed: raw.windSpeed !== undefined ? Number(raw.windSpeed) : null,
        windDirection: raw.windDirection !== undefined ? Number(raw.windDirection) : null,
        pressure: raw.pressure !== undefined ? Number(raw.pressure) : null,
        visibility: raw.visibility !== undefined ? Number(raw.visibility) : null,
        precipitation: raw.precipitation !== undefined ? Number(raw.precipitation) : null,
        precipitationProbability: raw.precipitationProbability !== undefined ? Number(raw.precipitationProbability) : null,
        condition: raw.condition || (raw.weatherCode !== undefined ? mapWmoCodeToCondition(raw.weatherCode) : null),
        uvIndex: raw.uvIndex !== undefined ? Number(raw.uvIndex) : null,
        airQualityIndex: raw.airQualityIndex !== undefined ? Number(raw.airQualityIndex) : null,
      },
      source,
      dataUpdatedAt: raw.dataUpdatedAt || new Date().toISOString(),
    };
  }

  static normalizeHourly(rawHourlyList, location, source = 'IMD') {
    return {
      location: {
        id: location.id || `${location.lat.toFixed(4)},${location.lon.toFixed(4)}`,
        name: location.name || 'Current Location',
        region: location.region || null,
        country: location.country || 'India',
        lat: Number(location.lat),
        lon: Number(location.lon),
      },
      hourly: rawHourlyList.map((item) => ({
        time: item.time,
        temperature: item.temperature !== undefined ? Number(item.temperature) : null,
        feelsLike: item.feelsLike !== undefined ? Number(item.feelsLike) : null,
        humidity: item.humidity !== undefined ? Number(item.humidity) : null,
        precipitationProbability: item.precipitationProbability !== undefined ? Number(item.precipitationProbability) : null,
        precipitation: item.precipitation !== undefined ? Number(item.precipitation) : null,
        condition: item.condition || (item.weatherCode !== undefined ? mapWmoCodeToCondition(item.weatherCode) : null),
        windSpeed: item.windSpeed !== undefined ? Number(item.windSpeed) : null,
        windDirection: item.windDirection !== undefined ? Number(item.windDirection) : null,
      })),
      source,
      dataUpdatedAt: new Date().toISOString(),
    };
  }

  static normalizeDaily(rawDailyList, location, source = 'IMD') {
    return {
      location: {
        id: location.id || `${location.lat.toFixed(4)},${location.lon.toFixed(4)}`,
        name: location.name || 'Current Location',
        region: location.region || null,
        country: location.country || 'India',
        lat: Number(location.lat),
        lon: Number(location.lon),
      },
      daily: rawDailyList.map((item) => ({
        date: item.date,
        temperatureMax: item.temperatureMax !== undefined ? Number(item.temperatureMax) : null,
        temperatureMin: item.temperatureMin !== undefined ? Number(item.temperatureMin) : null,
        precipitationProbability: item.precipitationProbability !== undefined ? Number(item.precipitationProbability) : null,
        precipitationSum: item.precipitationSum !== undefined ? Number(item.precipitationSum) : null,
        condition: item.condition || (item.weatherCode !== undefined ? mapWmoCodeToCondition(item.weatherCode) : null),
        windSpeedMax: item.windSpeedMax !== undefined ? Number(item.windSpeedMax) : null,
        uvIndexMax: item.uvIndexMax !== undefined ? Number(item.uvIndexMax) : null,
        sunrise: item.sunrise || null,
        sunset: item.sunset || null,
      })),
      source,
      dataUpdatedAt: new Date().toISOString(),
    };
  }
}

module.exports = {
  WeatherNormalizer,
  mapWmoCodeToCondition,
};
