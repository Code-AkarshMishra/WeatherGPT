const alertService = require('../services/alerts/alert.service');
const { sendSuccess } = require('../utils/response');

class MapController {
  async getMapAlerts(req, res, next) {
    try {
      const { bbox, severity } = req.query;
      const alerts = await alertService.getMapAlerts(bbox, severity);
      return sendSuccess(res, {
        type: 'FeatureCollection',
        features: alerts
          .filter((alert) => alert.geometry)
          .map((alert) => ({
          type: 'Feature',
          geometry: alert.geometry,
          properties: {
            id: alert.id,
            sourceAlertId: alert.sourceAlertId,
            source: alert.source,
            title: alert.title,
            description: alert.description,
            severity: alert.severity,
            type: alert.type,
            affectedAreas: alert.affectedAreas,
            issuedAt: alert.issuedAt,
            validUntil: alert.validUntil,
          },
        })),
        meta: {
          totalFeatures: alerts.filter((alert) => alert.geometry).length,
          omittedWithoutGeometry: alerts.filter((alert) => !alert.geometry).length,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getMapLayers(req, res, next) {
    try {
      const layers = [
        { id: 'radar-rain', name: 'Doppler Radar Precipitation', type: 'raster', enabled: true },
        { id: 'imd-warnings', name: 'IMD Official District Warnings', type: 'geojson', enabled: true },
        { id: 'wind-stream', name: 'Surface Wind Vectors', type: 'vector', enabled: true },
        { id: 'cyclone-track', name: 'Tropical Cyclone Trajectories', type: 'geojson', enabled: true },
        { id: 'lightning-strike', name: 'Realtime Lightning Detection (DAMINI)', type: 'points', enabled: true },
      ];
      return sendSuccess(res, { layers });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new MapController();
