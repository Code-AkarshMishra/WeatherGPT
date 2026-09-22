/**
 * Dev seed script — locations and optional demo USER account only.
 * Does NOT invent historical weather, climate metrics, or fake IMD alerts.
 */
const mongoose = require('mongoose');
const env = require('../config/env');
const User = require('../models/User');
const Location = require('../models/Location');
const locationService = require('../services/location/location.service');
const alertIngestionService = require('../services/alerts/alertIngestion.service');
const logger = require('../utils/logger');

const seed = async () => {
  try {
    logger.info('Connecting to MongoDB for seeding...');
    await mongoose.connect(env.MONGODB_URI);
    logger.info('Connected.');

    logger.info('Seeding locations (geocode directory only)...');
    const defaultCities = locationService.getDefaultLocations();
    for (const city of defaultCities) {
      await Location.findOneAndUpdate(
        { name: city.name, region: city.region },
        {
          name: city.name,
          region: city.region,
          country: city.country,
          lat: city.lat,
          lon: city.lon,
          coordinates: {
            type: 'Point',
            coordinates: [city.lon, city.lat],
          },
        },
        { upsert: true }
      );
    }
    logger.info(`Seeded ${defaultCities.length} major Indian locations.`);

    logger.info('Seeding optional demo user account (not weather data)...');
    const existingDemoUser = await User.findOne({ email: 'demo@weathergpt.ai' });
    if (!existingDemoUser) {
      await User.create({
        name: 'Aarav Sharma',
        email: 'demo@weathergpt.ai',
        password: 'Password@123',
        preferences: {
          language: 'en',
          units: 'metric',
          advisoryPersona: 'agriculture',
          notificationPreferences: {
            pushAlerts: true,
            emailAlerts: true,
            minSeverity: 'MODERATE',
          },
        },
        savedLocations: [
          {
            name: 'Lucknow',
            region: 'Uttar Pradesh',
            country: 'India',
            lat: 26.8467,
            lon: 80.9462,
            isDefault: true,
          },
        ],
      });
      logger.info('Demo user created: demo@weathergpt.ai / Password@123');
    } else {
      logger.info('Demo user already exists.');
    }

    logger.info('Attempting live IMD alert ingestion (no fabricated alerts)...');
    await alertIngestionService.runIngestion();

    logger.info(
      'Skipping historical climate seed — use live Open-Meteo/ERA5 archive; fabricated metrics are not stored.'
    );

    logger.info('✅ Seeding completed successfully!');
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    logger.error('Error during database seed:', { error: error.message });
    process.exit(1);
  }
};

if (require.main === module) {
  seed();
}

module.exports = seed;
