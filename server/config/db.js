/**
 * db.js
 * Mongoose connection with retry logic, event logging, and fail-fast buffer handling.
 */
const mongoose = require('mongoose');
const logger = require('./logger');

// Disable buffering globally so queries fail fast rather than hanging requests for 10s when DB is offline
mongoose.set('bufferCommands', false);

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2000;

async function connectDB(retries = MAX_RETRIES) {
  if (!process.env.MONGO_URI || !process.env.MONGO_URI.trim()) {
    logger.warn('MONGO_URI is not set. Running in database-disconnected mode.');
    return;
  }

  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 20000,
    });
    logger.info(`MongoDB connected: ${conn.connection.host} / db: ${conn.connection.name}`);
  } catch (err) {
    if (retries > 0) {
      logger.warn(`MongoDB connection attempt failed (${err.message}). Retrying in ${RETRY_DELAY_MS / 1000}s... (${retries} attempts left)`);
      await new Promise((res) => setTimeout(res, RETRY_DELAY_MS));
      return connectDB(retries - 1);
    }
    logger.warn(`MongoDB connection failed after retries: ${err.message}. Server will continue with fallback in-memory handling.`);
  }
}

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected. Attempting to reconnect...');
});

mongoose.connection.on('reconnected', () => {
  logger.info('MongoDB reconnected.');
});

module.exports = connectDB;

