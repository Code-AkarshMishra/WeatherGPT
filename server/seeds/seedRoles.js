/**
 * seedRoles.js
 * Idempotent seed script — populates the roles collection.
 * Run with: npm run seed
 * Safe to run multiple times (uses upsert).
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Role = require('../models/Role');
const logger = require('../config/logger');

const ROLES = [
  {
    roleId: 'farmer',
    name: 'Farmer / Crop Advisory',
    description: 'Weather-driven crop advisory, sowing windows, irrigation, and pest risk for farmers.',
    icon: '🌾',
    systemPromptTemplate: 'LOADED_FROM_PROMPT_BUILDER',
    apiKeyEnvVar: 'CROP_ADVISORY_API_KEY',
    sortOrder: 1,
    features: [
      { label: 'Crop Advisory', query: 'What crops should I sow this week given the weather?', icon: '🌱' },
      { label: 'Rain Forecast', query: 'Will it rain in the next 3 days? Is irrigation needed?', icon: '🌧️' },
      { label: 'Pest Risk', query: 'What is the pest/disease risk for my crops given current humidity?', icon: '🐛' },
      { label: 'Frost Alert', query: 'Is there a frost risk tonight? How should I protect my crops?', icon: '❄️' },
    ],
  },
  {
    roleId: 'citizen',
    name: 'Citizen',
    description: 'Everyday weather updates, safety tips, and simple forecasts for the general public.',
    icon: '👤',
    systemPromptTemplate: 'LOADED_FROM_PROMPT_BUILDER',
    apiKeyEnvVar: 'GEMINI_API_KEY',
    sortOrder: 2,
    features: [
      { label: 'Today\'s Weather', query: 'What is the weather like today? Should I carry an umbrella?', icon: '☂️' },
      { label: 'Week Forecast', query: 'What is the 7-day weather forecast?', icon: '📅' },
      { label: 'Storm Alert', query: 'Are there any storm or severe weather alerts for my area?', icon: '⛈️' },
      { label: 'Air Quality', query: 'What is the air quality like today?', icon: '💨' },
    ],
  },
  {
    roleId: 'researcher',
    name: 'Researcher',
    description: 'Technical meteorological analysis, climate data, and research support.',
    icon: '🔬',
    systemPromptTemplate: 'LOADED_FROM_PROMPT_BUILDER',
    apiKeyEnvVar: 'GEMINI_API_KEY',
    sortOrder: 3,
    features: [
      { label: 'Climate Trends', query: 'Analyze temperature and rainfall trends for this region.', icon: '📊' },
      { label: 'Anomaly Analysis', query: 'Are current conditions anomalous compared to historical baselines?', icon: '📈' },
      { label: 'Monsoon Analysis', query: 'Analyze the current monsoon pattern and compare to normal.', icon: '🌀' },
      { label: 'ENSO Impact', query: 'How is El Niño/La Niña affecting weather patterns here?', icon: '🌊' },
    ],
  },
  {
    roleId: 'aviation',
    name: 'Aviation',
    description: 'Pre-flight briefings, turbulence forecasts, visibility, and aviation hazard advisories.',
    icon: '✈️',
    systemPromptTemplate: 'LOADED_FROM_PROMPT_BUILDER',
    apiKeyEnvVar: 'AVIATION_API_KEY',
    sortOrder: 4,
    features: [
      { label: 'Pre-Flight Brief', query: 'Give me a pre-flight weather briefing for my route.', icon: '📋' },
      { label: 'Turbulence', query: 'What are the turbulence conditions at cruising altitude?', icon: '〰️' },
      { label: 'Icing Alert', query: 'Are there icing conditions at any altitude on my route?', icon: '🧊' },
      { label: 'Visibility', query: 'What is the current visibility and ceiling at my destination?', icon: '👁️' },
    ],
  },
  {
    roleId: 'marine',
    name: 'Marine',
    description: 'Sea state, marine winds, cyclone advisories, and maritime safety guidance.',
    icon: '⚓',
    systemPromptTemplate: 'LOADED_FROM_PROMPT_BUILDER',
    apiKeyEnvVar: 'MARINE_API_KEY',
    sortOrder: 5,
    features: [
      { label: 'Sea Conditions', query: 'What are the current sea state and wave height conditions?', icon: '🌊' },
      { label: 'Cyclone Alert', query: 'Are there any active cyclone or tropical storm alerts?', icon: '🌀' },
      { label: 'Fishing Safety', query: 'Is it safe for fishing boats to go out today?', icon: '🎣' },
      { label: 'Port Conditions', query: 'What are the wind and sea conditions at the nearest port?', icon: '🚢' },
    ],
  },
  {
    roleId: 'flood_disaster',
    name: 'Flood & Disaster Management',
    description: 'Flood risk assessment, evacuation guidance, and disaster management support for emergency responders.',
    icon: '🚨',
    systemPromptTemplate: 'LOADED_FROM_PROMPT_BUILDER',
    apiKeyEnvVar: 'FLOOD_API_KEY',
    sortOrder: 6,
    features: [
      { label: 'Flood Alerts', query: 'Are there any flood alerts or warnings for this region?', icon: '🔴' },
      { label: 'Kerala Risk', query: 'What is the current flood risk for Kerala? Any alerts?', icon: '⚠️' },
      { label: 'Nepal Floods', query: 'What is the flood situation in Nepal? Any danger zones?', icon: '🏔️' },
      { label: 'Evacuation Guide', query: 'Should residents evacuate? What are the evacuation priorities?', icon: '🏃' },
    ],
  },
  {
    roleId: 'climate_analyst',
    name: 'Climate Analyst',
    description: 'Long-term climate trends, anomaly detection, ENSO analysis, and climate change impact assessment.',
    icon: '🌍',
    systemPromptTemplate: 'LOADED_FROM_PROMPT_BUILDER',
    apiKeyEnvVar: 'CLIMATE_API_KEY',
    sortOrder: 7,
    features: [
      { label: 'Climate Trends', query: 'What are the long-term temperature trends for this region?', icon: '📈' },
      { label: 'ENSO Status', query: 'What is the current ENSO status and its impact on the monsoon?', icon: '🌊' },
      { label: 'Extreme Events', query: 'How has the frequency of extreme weather events changed?', icon: '⛈️' },
      { label: 'IOD Impact', query: 'What is the Indian Ocean Dipole status and monsoon impact?', icon: '🌡️' },
    ],
  },
  {
    roleId: 'urban_planner',
    name: 'Urban Planner',
    description: 'Urban heat islands, stormwater management, climate-resilient infrastructure guidance for city planners.',
    icon: '🏙️',
    systemPromptTemplate: 'LOADED_FROM_PROMPT_BUILDER',
    apiKeyEnvVar: 'GEMINI_API_KEY',
    sortOrder: 8,
    features: [
      { label: 'Urban Heat', query: 'What is the urban heat island intensity for this city today?', icon: '🌡️' },
      { label: 'Flood Risk', query: 'Which urban zones are at highest flood/waterlogging risk?', icon: '🏘️' },
      { label: 'Green Cover', query: 'What green infrastructure interventions would help most?', icon: '🌳' },
      { label: 'Storm Drain', query: 'Is the stormwater drainage system adequate for today\'s rainfall?', icon: '🔧' },
    ],
  },
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    logger.info('Connected to MongoDB for seeding...');

    let created = 0;
    let updated = 0;

    for (const role of ROLES) {
      const result = await Role.findOneAndUpdate(
        { roleId: role.roleId },
        { $set: role },
        { upsert: true, new: true, runValidators: true }
      );
      if (result.createdAt?.getTime() === result.updatedAt?.getTime()) {
        created++;
      } else {
        updated++;
      }
      logger.info(`  ✓ Role: ${role.name}`);
    }

    logger.info(`\nSeed complete: ${created} created, ${updated} updated.`);
  } catch (err) {
    logger.error(`Seed failed: ${err.message}`);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seed();
