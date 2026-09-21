/**
 * server.js
 * Application entry point.
 * Validates env → connects DB → starts HTTP server.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
require('dotenv').config();
const validateEnv = require('./config/validateEnv');
const connectDB = require('./config/db');
const logger = require('./config/logger');
const app = require('./app');
const socketService = require('./services/socketService');
const { startAlertMonitor, stopAlertMonitor } = require('./services/alertMonitor');

// Validate environment variables FIRST — fail fast if anything is missing
validateEnv();

const PORT = process.env.PORT || 5001;

async function start() {
  // Connect to MongoDB
  await connectDB();

  // Start HTTP server & WebSocket
  const server = app.listen(PORT, () => {
    socketService.init(server);

    // Start proactive alert monitoring (checks every 15 minutes)
    startAlertMonitor((eventName, data) => {
      const io = socketService.getIO();
      if (io) {
        io.emit(eventName, {
          ...data,
          timestamp: new Date().toISOString(),
        });
      }
    }, 15 * 60 * 1000);

    logger.info(`
╔══════════════════════════════════════════════════════════╗
║           WeatherGPT API Server — RUNNING                ║
╠══════════════════════════════════════════════════════════╣
║  Port:        ${PORT}                                       ║
║  Environment: ${process.env.NODE_ENV || 'development'}                            ║
║  Health:      http://localhost:${PORT}/health               ║
║  WebSocket:   ws://localhost:${PORT}                        ║
║  AlertMonitor: ACTIVE (15-min cycle)                     ║
╚══════════════════════════════════════════════════════════╝
    `);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received. Shutting down gracefully...');
    stopAlertMonitor();
    server.close(() => {
      logger.info('HTTP server closed.');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    logger.info('SIGINT received. Shutting down...');
    stopAlertMonitor();
    server.close(() => process.exit(0));
  });

  // Unhandled promise rejection guard
  process.on('unhandledRejection', (reason) => {
    logger.error(`Unhandled Promise Rejection: ${reason}`);
  });
}

start();
