const Alert = require('../../models/Alert');
const CacheService = require('../cache/cache.service');
const { CACHE_TTL } = require('../../utils/constants');
const logger = require('../../utils/logger');

class AlertService {
  async getAlerts({ severity, type, active = true, location, page = 1, limit = 20 }) {
    const query = {};

    if (active !== undefined) {
      query.active = active;
      if (active) {
        query.validUntil = { $gte: new Date() };
      }
    }

    if (severity) {
      query.severity = severity;
    }

    if (type) {
      query.type = type;
    }

    if (location) {
      query.affectedAreas = { $regex: new RegExp(location, 'i') };
    }

    const skip = (page - 1) * limit;

    const [alerts, total] = await Promise.all([
      Alert.find(query).sort({ severity: -1, issuedAt: -1 }).skip(skip).limit(limit).lean(),
      Alert.countDocuments(query),
    ]);

    const formattedAlerts = alerts.map((a) => this.formatAlert(a));

    return {
      alerts: formattedAlerts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async getAlertById(alertId) {
    const alert = await Alert.findById(alertId).lean();
    if (!alert) return null;
    return this.formatAlert(alert);
  }

  async getAlertsForLocation(locationName, lat, lon) {
    const now = new Date();
    const query = {
      active: true,
      validUntil: { $gte: now },
      $or: [],
    };

    if (locationName) {
      query.$or.push({ affectedAreas: { $regex: new RegExp(locationName, 'i') } });
    }

    // Include national or multi-district alerts if present
    query.$or.push({ affectedAreas: 'All India' });

    const alerts = await Alert.find(query).sort({ severity: -1, issuedAt: -1 }).limit(10).lean();
    return alerts.map((a) => this.formatAlert(a));
  }

  async getMapAlerts(bbox, severity) {
    const query = {
      active: true,
      validUntil: { $gte: new Date() },
    };

    if (severity) {
      query.severity = severity;
    }

    const alerts = await Alert.find(query).lean();
    return alerts.map((a) => this.formatAlert(a));
  }

  formatAlert(doc) {
    return {
      id: doc._id ? doc._id.toString() : doc.sourceAlertId,
      sourceAlertId: doc.sourceAlertId,
      source: doc.source || 'IMD',
      type: doc.type,
      severity: doc.severity,
      title: doc.title,
      description: doc.description,
      affectedAreas: doc.affectedAreas || [],
      issuedAt: doc.issuedAt ? doc.issuedAt.toISOString() : new Date().toISOString(),
      validFrom: doc.validFrom ? doc.validFrom.toISOString() : new Date().toISOString(),
      validUntil: doc.validUntil ? doc.validUntil.toISOString() : new Date().toISOString(),
      geometry: doc.geometry || null,
      sourceUrl: doc.sourceUrl || null,
      retrievedAt: doc.retrievedAt ? doc.retrievedAt.toISOString() : new Date().toISOString(),
      active: doc.active,
    };
  }
}

module.exports = new AlertService();
