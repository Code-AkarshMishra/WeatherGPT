const axios = require('axios');
const Alert = require('../../models/Alert');
const env = require('../../config/env');
const logger = require('../../utils/logger');
const { ALERT_SEVERITIES, ALERT_TYPES } = require('../../utils/constants');

class AlertIngestionService {
  constructor() {
    this.imdClient = axios.create({
      baseURL: env.IMD_BASE_URL || 'https://mausam.imd.gov.in/backend/api',
      timeout: 8000,
      headers: {
        Accept: 'application/json, text/plain, */*',
        'User-Agent': 'WeatherGPT-Backend/1.0.0 (SIH-PS-26068)',
      },
    });
  }

  async runIngestion() {
    logger.info('Starting IMD alert ingestion cycle...');
    const now = new Date();
    let ingestedCount = 0;
    let updatedCount = 0;
    let failedCount = 0;

    let alertsToProcess = [];

    if (env.MOCK_EXTERNAL_APIS) {
      logger.warn(
        'MOCK_EXTERNAL_APIS enabled: skipping fabricated IMD alerts. Official warnings remain unavailable.'
      );
      return {
        success: true,
        available: false,
        message: 'Official warning feed unavailable (mock mode does not invent alerts).',
        stats: { ingestedCount: 0, updatedCount: 0, failedCount: 0, expiredDeactivated: 0 },
      };
    }

    try {
      const response = await this.imdClient.get('/district_warning_api.php');
      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
        alertsToProcess = response.data.map((item, idx) => {
          const color = (item.warning_color || item.color || '').toUpperCase();
          let severity = ALERT_SEVERITIES.LOW;
          if (color.includes('RED') || color === '4') severity = ALERT_SEVERITIES.EXTREME;
          else if (color.includes('ORANGE') || color === '3') severity = ALERT_SEVERITIES.HIGH;
          else if (color.includes('YELLOW') || color === '2') severity = ALERT_SEVERITIES.MODERATE;

          return {
            sourceAlertId: item.id || `IMD-LIVE-${item.district_id || idx}-${now.toISOString().slice(0, 10)}`,
            source: 'IMD',
            type: ALERT_TYPES.HEAVY_RAIN,
            severity,
            title:
              item.warning_text ||
              item.title ||
              `IMD District Warning for ${item.district_name || 'Region'}`,
            description:
              item.description || item.warning_text || 'Official Meteorological Warning from IMD.',
            affectedAreas: [item.district_name || item.state_name || 'India'].filter(Boolean),
            validHoursFromNow: 24,
            sourceUrl: 'https://mausam.imd.gov.in/alerts',
          };
        });
        logger.info(`Fetched ${alertsToProcess.length} live district alerts from IMD.`);
      }
    } catch (err) {
      logger.warn('Live IMD district warning API unreachable:', { message: err.message });
    }

    if (alertsToProcess.length === 0) {
      logger.info('No live IMD alerts available; not inventing mock warnings.');
      const expiredResult = await Alert.updateMany(
        { validUntil: { $lt: now }, active: true },
        { $set: { active: false } }
      );
      return {
        success: true,
        available: false,
        message: 'Official warnings unavailable from IMD at this time.',
        stats: {
          ingestedCount: 0,
          updatedCount: 0,
          failedCount: 0,
          expiredDeactivated: expiredResult.modifiedCount,
        },
      };
    }

    try {
      for (const item of alertsToProcess) {
        try {
          const validUntil = new Date(now.getTime() + (item.validHoursFromNow || 24) * 3600 * 1000);
          const alertDoc = {
            sourceAlertId: item.sourceAlertId,
            source: item.source || 'IMD',
            type: item.type || ALERT_TYPES.OTHER,
            severity: item.severity || ALERT_SEVERITIES.MODERATE,
            title: item.title,
            description: item.description,
            affectedAreas: item.affectedAreas || [],
            issuedAt: now,
            validFrom: now,
            validUntil,
            geometry: item.geometry || null,
            sourceUrl: item.sourceUrl,
            retrievedAt: now,
            active: true,
          };

          const result = await Alert.findOneAndUpdate(
            { sourceAlertId: item.sourceAlertId, source: alertDoc.source },
            alertDoc,
            { upsert: true, new: true, rawResult: true }
          );

          if (result.lastErrorObject && result.lastErrorObject.updatedExisting) {
            updatedCount++;
          } else {
            ingestedCount++;
          }
        } catch (err) {
          failedCount++;
          logger.error(`Failed to ingest alert ${item.sourceAlertId}:`, { error: err.message });
        }
      }

      const expiredResult = await Alert.updateMany(
        { validUntil: { $lt: now }, active: true },
        { $set: { active: false } }
      );

      logger.info('IMD alert ingestion cycle completed.', {
        ingestedCount,
        updatedCount,
        failedCount,
        expiredDeactivated: expiredResult.modifiedCount,
      });

      return {
        success: true,
        available: true,
        stats: {
          ingestedCount,
          updatedCount,
          failedCount,
          expiredDeactivated: expiredResult.modifiedCount,
        },
      };
    } catch (error) {
      logger.error('Fatal error during alert ingestion job:', { error: error.message });
      return { success: false, error: error.message };
    }
  }
}

module.exports = new AlertIngestionService();
