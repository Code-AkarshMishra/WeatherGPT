/**
 * server/ping-db.js
 * Production-ready lightweight MongoDB Atlas keep-alive and health check script.
 *
 * Can be run:
 *   - Locally: node ping-db.js
 *   - In CI/CD / GitHub Actions: node server/ping-db.js
 *   - Via npm script: npm run db:ping
 *
 * Uses mongoose / native mongodb driver to issue a zero-I/O `ping` command.
 * Gracefully handles missing MONGO_URI and connection timeouts.
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI;

async function pingDatabase() {
  if (!MONGO_URI || !MONGO_URI.trim()) {
    console.warn('[PING-DB] Warning: MONGO_URI is not defined. Skipping database ping.');
    process.exit(0); // Exit cleanly so CI/CD doesn't fail if DB is intentionally omitted
  }

  const maskedUri = MONGO_URI.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
  console.log(`[PING-DB] Initiating lightweight ping to MongoDB Atlas (${maskedUri})...`);

  const startTime = Date.now();

  try {
    // Connect with a strict 8-second timeout to prevent hanging in CI
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 8000,
      socketTimeoutMS: 8000,
    });

    // Execute low-overhead admin ping (zero disk reads/writes)
    const pingResult = await mongoose.connection.db.command({ ping: 1 });
    const latencyMs = Date.now() - startTime;

    if (pingResult && pingResult.ok === 1) {
      console.log(`[PING-DB] SUCCESS: MongoDB Atlas is active and responsive (${latencyMs}ms latency).`);
      await mongoose.disconnect();
      process.exit(0);
    } else {
      console.error('[PING-DB] FAILED: Unexpected response from database command:', pingResult);
      await mongoose.disconnect();
      process.exit(1);
    }
  } catch (error) {
    const elapsedMs = Date.now() - startTime;
    console.error(`[PING-DB] ERROR: Failed to ping MongoDB Atlas after ${elapsedMs}ms:`, error.message);
    try {
      await mongoose.disconnect();
    } catch {}
    process.exit(1);
  }
}

pingDatabase();
