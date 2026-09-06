/**
 * validateEnv.js
 * Validates all required environment variables on server startup.
 * The server will EXIT with a clear error if any required key is missing.
 */

const REQUIRED_ENV_VARS = [
  { key: 'MONGO_URI', description: 'MongoDB connection string' },
  { key: 'JWT_SECRET', description: 'JWT access token signing secret (min 32 chars)' },
  { key: 'JWT_REFRESH_SECRET', description: 'JWT refresh token signing secret (min 32 chars)' },
  { key: 'WEATHER_API_KEY', description: 'OpenWeatherMap API key (https://openweathermap.org/api)' },
  { key: 'GEMINI_API_KEY', description: 'Google Gemini API key (https://aistudio.google.com/app/apikey)' },
];

function validateEnv() {
  const missing = [];

  for (const { key, description } of REQUIRED_ENV_VARS) {
    if (!process.env[key] || process.env[key].trim() === '') {
      missing.push({ key, description });
    }
  }

  if (missing.length > 0) {
    console.error('\n╔══════════════════════════════════════════════════════════╗');
    console.error('║         WeatherGPT — STARTUP FAILED: Missing ENV Vars    ║');
    console.error('╚══════════════════════════════════════════════════════════╝\n');
    console.error('The following required environment variables are not set:\n');
    missing.forEach(({ key, description }) => {
      console.error(`  ❌  ${key}`);
      console.error(`      → ${description}\n`);
    });
    console.error('Please copy .env.example to .env and fill in all required values.');
    console.error('Server is exiting now.\n');
    process.exit(1);
  }

  // Warn about short secrets
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    console.warn('⚠️  WARNING: JWT_SECRET is shorter than 32 characters. Use a longer secret in production.');
  }
  if (process.env.JWT_REFRESH_SECRET && process.env.JWT_REFRESH_SECRET.length < 32) {
    console.warn('⚠️  WARNING: JWT_REFRESH_SECRET is shorter than 32 characters.');
  }

  console.log('✅  Environment variables validated successfully.');
}

module.exports = validateEnv;
