const alertService = require('../services/alerts/alert.service');
const alertIngestionService = require('../services/alerts/alertIngestion.service');
const locationService = require('../services/location/location.service');
const ApiError = require('../utils/apiError');
const { sendSuccess } = require('../utils/response');

class AlertController {
  async listAlerts(req, res, next) {
    try {
      const { severity, type, active, location, page, limit } = req.query;
      const result = await alertService.getAlerts({
        severity,
        type,
        active,
        location,
        page,
        limit,
      });
      return sendSuccess(res, result.alerts, { pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  async getAlertById(req, res, next) {
    try {
      const { alertId } = req.params;
      const alert = await alertService.getAlertById(alertId);
      if (!alert) {
        throw ApiError.notFound(`Alert not found with id: ${alertId}`);
      }
      return sendSuccess(res, { alert });
    } catch (error) {
      next(error);
    }
  }

  async getAlertsByLocation(req, res, next) {
    try {
      const { locationId } = req.params;
      const loc = await locationService.getLocationById(locationId);
      const locName = loc ? loc.name : locationId;
      const lat = loc ? loc.lat : null;
      const lon = loc ? loc.lon : null;

      const alerts = await alertService.getAlertsForLocation(locName, lat, lon);
      return sendSuccess(res, {
        location: loc || { id: locationId, name: locName },
        alerts,
      });
    } catch (error) {
      next(error);
    }
  }

  async triggerIngestion(req, res, next) {
    try {
      const result = await alertIngestionService.runIngestion();
      return sendSuccess(res, result, { message: 'Alert ingestion executed' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AlertController();
