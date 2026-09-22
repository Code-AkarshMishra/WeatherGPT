const Location = require('../../models/Location');
const CacheService = require('../cache/cache.service');
const logger = require('../../utils/logger');
const { CACHE_TTL } = require('../../utils/constants');

// Known Indian Cities default database for instantaneous local fallback
const DEFAULT_CITIES = [
  { name: 'Lucknow', region: 'Uttar Pradesh', country: 'India', lat: 26.8467, lon: 80.9462 },
  { name: 'New Delhi', region: 'Delhi', country: 'India', lat: 28.6139, lon: 77.2090 },
  { name: 'Mumbai', region: 'Maharashtra', country: 'India', lat: 19.0760, lon: 72.8777 },
  { name: 'Bengaluru', region: 'Karnataka', country: 'India', lat: 12.9716, lon: 77.5946 },
  { name: 'Kolkata', region: 'West Bengal', country: 'India', lat: 22.5726, lon: 88.3639 },
  { name: 'Chennai', region: 'Tamil Nadu', country: 'India', lat: 13.0827, lon: 80.2707 },
  { name: 'Hyderabad', region: 'Telangana', country: 'India', lat: 17.3850, lon: 78.4867 },
  { name: 'Ahmedabad', region: 'Gujarat', country: 'India', lat: 23.0225, lon: 72.5714 },
  { name: 'Jaipur', region: 'Rajasthan', country: 'India', lat: 26.9124, lon: 75.7873 },
  { name: 'Patna', region: 'Bihar', country: 'India', lat: 25.5941, lon: 85.1376 },
  { name: 'Bhopal', region: 'Madhya Pradesh', country: 'India', lat: 23.2599, lon: 77.4126 },
  { name: 'Chandigarh', region: 'Punjab', country: 'India', lat: 30.7333, lon: 76.7794 },
  { name: 'Guwahati', region: 'Assam', country: 'India', lat: 26.1445, lon: 91.7362 },
  { name: 'Bhubaneswar', region: 'Odisha', country: 'India', lat: 20.2961, lon: 85.8245 },
  { name: 'Dehradun', region: 'Uttarakhand', country: 'India', lat: 30.3165, lon: 78.0322 },
  { name: 'Shimla', region: 'Himachal Pradesh', country: 'India', lat: 31.1048, lon: 77.1734 },
  { name: 'Srinagar', region: 'Jammu and Kashmir', country: 'India', lat: 34.0837, lon: 74.7973 },
  { name: 'Ranchi', region: 'Jharkhand', country: 'India', lat: 23.3441, lon: 85.3096 },
  { name: 'Thiruvananthapuram', region: 'Kerala', country: 'India', lat: 8.5241, lon: 76.9366 },
  { name: 'Varanasi', region: 'Uttar Pradesh', country: 'India', lat: 25.3176, lon: 82.9739 },
];

class LocationService {
  async search(query, limit = 10) {
    const cacheKey = CacheService.makeKey('location:search', query.toLowerCase().trim());
    const cached = await CacheService.get(cacheKey);
    if (cached) return cached;

    // Search in MongoDB Location collection first
    let locations = [];
    try {
      locations = await Location.find({
        $or: [
          { name: { $regex: new RegExp(query, 'i') } },
          { region: { $regex: new RegExp(query, 'i') } },
        ],
      })
        .limit(limit)
        .lean();
    } catch (err) {
      logger.warn('MongoDB location search failed, falling back to builtin list:', { error: err.message });
    }

    // If MongoDB is empty or has no matches, match from builtin default list
    if (!locations || locations.length === 0) {
      const q = query.toLowerCase();
      locations = DEFAULT_CITIES.filter(
        (c) => c.name.toLowerCase().includes(q) || c.region.toLowerCase().includes(q)
      ).slice(0, limit);
    }

    const formatted = locations.map((loc) => ({
      id: loc._id ? loc._id.toString() : `${loc.lat},${loc.lon}`,
      name: loc.name,
      region: loc.region,
      country: loc.country || 'India',
      lat: loc.lat,
      lon: loc.lon,
    }));

    await CacheService.set(cacheKey, formatted, CACHE_TTL.LOCATION_SEARCH);
    return formatted;
  }

  async getLocationById(id) {
    // If it's a coordinate pair
    if (id.includes(',')) {
      const [lat, lon] = id.split(',').map(Number);
      if (!isNaN(lat) && !isNaN(lon)) {
        return this.resolveLocation(lat, lon);
      }
    }

    try {
      const location = await Location.findById(id).lean();
      if (location) {
        return {
          id: location._id.toString(),
          name: location.name,
          region: location.region,
          country: location.country,
          lat: location.lat,
          lon: location.lon,
        };
      }
    } catch (err) {
      logger.debug('Location not found in DB by id:', { id });
    }

    return null;
  }

  async resolveLocation(lat, lon) {
    const cacheKey = CacheService.makeKey('location:reverse', lat, lon);
    const cached = await CacheService.get(cacheKey);
    if (cached) return cached;

    // Find closest city in DEFAULT_CITIES or MongoDB
    let closest = null;
    let minDistance = Infinity;

    for (const city of DEFAULT_CITIES) {
      const d = Math.hypot(city.lat - lat, city.lon - lon);
      if (d < minDistance) {
        minDistance = d;
        closest = city;
      }
    }

    const result = {
      id: `${lat.toFixed(4)},${lon.toFixed(4)}`,
      name: minDistance < 0.5 && closest ? closest.name : `Location (${lat.toFixed(2)}°, ${lon.toFixed(2)}°)`,
      region: minDistance < 0.5 && closest ? closest.region : 'India',
      country: 'India',
      lat: Number(lat),
      lon: Number(lon),
    };

    await CacheService.set(cacheKey, result, CACHE_TTL.LOCATION_SEARCH);
    return result;
  }

  getDefaultLocations() {
    return DEFAULT_CITIES;
  }
}

module.exports = new LocationService();
