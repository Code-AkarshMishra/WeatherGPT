const cron = require('node-cron');
const alertIngestionService = require('../services/alerts/alertIngestion.service');
const logger = require('../utils/logger');

let alertJob = null;

const startAlertIngestionJob = (cronSchedule = '*/15 * * * *') => {
  logger.info(`Scheduling Alert Ingestion Job with cron: "${cronSchedule}"`);

  alertJob = cron.schedule(cronSchedule, async () => {
    try {
      logger.info('Running scheduled alert ingestion...');
      await alertIngestionService.runIngestion();
    } catch (err) {
      logger.error('Error in scheduled alert ingestion job:', { error: err.message });
    }
  });

  return alertJob;
};

const stopAlertIngestionJob = () => {
  if (alertJob) {
    alertJob.stop();
    logger.info('Alert Ingestion Job stopped.');
  }
};

module.exports = {
  startAlertIngestionJob,
  stopAlertIngestionJob,
};
