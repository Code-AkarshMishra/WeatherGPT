const app = require('./app');
const env = require('./config/env');
const { connectDB, disconnectDB } = require('./config/db');
const { initRedis } = require('./config/redis');
const { startAlertIngestionJob, stopAlertIngestionJob } = require('./jobs/alertIngestion.job');
const { startCacheRefreshJob, stopCacheRefreshJob } = require('./jobs/cacheRefresh.job');
const alertIngestionService = require('./services/alerts/alertIngestion.service');
const logger = require('./utils/logger');

const startServer = async () => {
  try {
    logger.info(`Starting WeatherGPT Backend in [${env.NODE_ENV}] mode...`);

    // 1. Connect MongoDB
    await connectDB();

    // 2. Initialize Redis (with in-memory fallback)
    initRedis();

    // 3. Trigger initial alert synchronization
    try {
      await alertIngestionService.runIngestion();
    } catch (ingestErr) {
      logger.warn('Initial alert ingestion skipped/failed:', { message: ingestErr.message });
    }

    // 4. Start background cron jobs
    if (env.NODE_ENV !== 'test') {
      startAlertIngestionJob();
      startCacheRefreshJob();
    }

    // 5. Start HTTP Server
    const server = app.listen(env.PORT, () => {
      logger.info(`🚀 WeatherGPT Backend API Server is actively listening on port ${env.PORT}`);
      logger.info(`📡 Health: http://localhost:${env.PORT}/health`);
      logger.info(`🔍 Readiness: http://localhost:${env.PORT}/ready`);
      logger.info(`🌐 API Prefix: http://localhost:${env.PORT}/api`);
    });

    // Graceful Shutdown
    const shutdown = async (signal) => {
      logger.info(`Received ${signal}. Gracefully shutting down WeatherGPT Backend...`);

      stopAlertIngestionJob();
      stopCacheRefreshJob();

      server.close(async () => {
        logger.info('HTTP server closed.');
        await disconnectDB();
        logger.info('Clean shutdown completed.');
        process.exit(0);
      });

      // Force shutdown after timeout if hung
      setTimeout(() => {
        logger.error('Could not close connections in time, forcing exit.');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    return server;
  } catch (error) {
    logger.error('Fatal error during backend server startup:', { error: error.message, stack: error.stack });
    process.exit(1);
  }
};

if (require.main === module) {
  startServer();
}

module.exports = { startServer };
