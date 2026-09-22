const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const env = {
  PORT: parseInt(process.env.PORT || '5000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/weathergpt',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  
  JWT_SECRET: process.env.JWT_SECRET || 'weathergpt-fallback-secret-sih-2024',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  
  AI_SERVICE_URL: process.env.AI_SERVICE_URL || 'http://localhost:8000',
  AI_SERVICE_API_KEY: process.env.AI_SERVICE_API_KEY || 'weathergpt-ai-secret-key',
  
  IMD_BASE_URL: process.env.IMD_BASE_URL || 'https://api.imd.gov.in/v1',
  IMD_API_KEY: process.env.IMD_API_KEY || '',
  MOCK_EXTERNAL_APIS: process.env.MOCK_EXTERNAL_APIS === 'true' || process.env.NODE_ENV === 'test',
  
  CORS_ORIGINS: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
    
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
};

module.exports = env;
