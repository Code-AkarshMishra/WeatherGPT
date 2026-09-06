/**
 * db.js
 * Mongoose connection with retry logic and event logging.
 */
const mongoose = require('mongoose');
const logger = require('./logger');

const MAX_RETRIES = 1;
const RETRY_DELAY_MS = 1000;

async function connectDB(retries = MAX_RETRIES) {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 2000,
    });
    logger.info(`MongoDB connected: ${conn.connection.host} / db: ${conn.connection.name}`);
  } catch (err) {
    if (retries > 0) {
      logger.warn(`MongoDB connection failed. Retrying in ${RETRY_DELAY_MS / 1000}s... (${retries} attempts left)`);
      await new Promise((res) => setTimeout(res, RETRY_DELAY_MS));
      return connectDB(retries - 1);
    }
    logger.warn(`MongoDB connection failed after retries: ${err.message}. Server will continue in in-memory mode.`);
  }
}

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected. Attempting to reconnect...');
});

mongoose.connection.on('reconnected', () => {
  logger.info('MongoDB reconnected.');
});

module.exports = connectDB;
