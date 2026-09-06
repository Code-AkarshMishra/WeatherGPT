/**
 * server.js
 * Application entry point.
 * Validates env → connects DB → starts HTTP server.
 */
require('dotenv').config();
const validateEnv = require('./config/validateEnv');
const connectDB = require('./config/db');
const logger = require('./config/logger');
const app = require('./app');

// Validate environment variables FIRST — fail fast if anything is missing
validateEnv();

const PORT = process.env.PORT || 5001;

async function start() {
  // Connect to MongoDB
  await connectDB();

  // Start HTTP server
  const server = app.listen(PORT, () => {
    logger.info(`
╔══════════════════════════════════════════════════════════╗
║           WeatherGPT API Server — RUNNING                ║
╠══════════════════════════════════════════════════════════╣
║  Port:        ${PORT}                                       ║
║  Environment: ${process.env.NODE_ENV || 'development'}                            ║
║  Health:      http://localhost:${PORT}/health               ║
╚══════════════════════════════════════════════════════════╝
    `);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received. Shutting down gracefully...');
    server.close(() => {
      logger.info('HTTP server closed.');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    logger.info('SIGINT received. Shutting down...');
    server.close(() => process.exit(0));
  });

  // Unhandled promise rejection guard
  process.on('unhandledRejection', (reason) => {
    logger.error(`Unhandled Promise Rejection: ${reason}`);
  });
}

start();
