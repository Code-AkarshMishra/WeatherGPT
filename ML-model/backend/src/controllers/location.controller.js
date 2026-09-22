const locationService = require('../services/location/location.service');
const ApiError = require('../utils/apiError');
const { sendSuccess } = require('../utils/response');

class LocationController {
  async search(req, res, next) {
    try {
      const { q, limit } = req.query;
      const locations = await locationService.search(q, limit);
      return sendSuccess(res, { locations });
    } catch (error) {
      next(error);
    }
  }

  async getLocationById(req, res, next) {
    try {
      const { id } = req.params;
      const location = await locationService.getLocationById(id);
      if (!location) {
        throw ApiError.notFound(`Location not found for id: ${id}`);
      }
      return sendSuccess(res, { location });
    } catch (error) {
      next(error);
    }
  }

  async reverseGeocode(req, res, next) {
    try {
      const { lat, lon } = req.query;
      const location = await locationService.resolveLocation(lat, lon);
      return sendSuccess(res, { location });
    } catch (error) {
      next(error);
    }
  }

  async getPopularLocations(req, res, next) {
    try {
      const popular = locationService.getDefaultLocations();
      return sendSuccess(res, { locations: popular });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new LocationController();
