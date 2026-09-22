const cron = require('node-cron');
const weatherService = require('../services/weather/weather.service');
const locationService = require('../services/location/location.service');
const logger = require('../utils/logger');

let cacheJob = null;

const startCacheRefreshJob = (cronSchedule = '*/20 * * * *') => {
  logger.info(`Scheduling Weather Cache Refresh Job with cron: "${cronSchedule}"`);

  cacheJob = cron.schedule(cronSchedule, async () => {
    try {
      logger.info('Refreshing weather cache for major hubs...');
      const defaultCities = locationService.getDefaultLocations().slice(0, 5); // top 5 metro hubs

      for (const city of defaultCities) {
        try {
          await weatherService.getCurrentWeather(city.lat, city.lon);
          await weatherService.getHourlyForecast(city.lat, city.lon, 24);
          logger.debug(`Cache refreshed for ${city.name}`);
        } catch (err) {
          logger.warn(`Failed cache refresh for ${city.name}: ${err.message}`);
        }
      }
      logger.info('Cache refresh cycle completed.');
    } catch (err) {
      logger.error('Error during cache refresh job:', { error: err.message });
    }
  });

  return cacheJob;
};

const stopCacheRefreshJob = () => {
  if (cacheJob) {
    cacheJob.stop();
    logger.info('Cache Refresh Job stopped.');
  }
};

module.exports = {
  startCacheRefreshJob,
  stopCacheRefreshJob,
};
