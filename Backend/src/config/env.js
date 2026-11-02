const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const config = {
  PORT: parseInt(process.env.PORT || '5000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  JWT_SECRET: process.env.JWT_SECRET || 'dwarka-dental-jwt-secret-change-in-production',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '8h',
  ML_SERVICE_URL: process.env.ML_SERVICE_URL || 'http://localhost:8000',
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

if (config.JWT_SECRET === 'dwarka-dental-jwt-secret-change-in-production') {
  if (config.NODE_ENV === 'production') {
    console.error('FATAL: Using the default JWT_SECRET is not allowed in production. Set a strong JWT_SECRET in .env.');
    process.exit(1);
  } else {
    console.warn('WARNING: Using default JWT_SECRET. Set JWT_SECRET in .env for production.');
  }
}

if (!config.SUPABASE_URL || !config.SUPABASE_SERVICE_ROLE_KEY) {
  if (config.NODE_ENV === 'production') {
    console.error('FATAL: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in production.');
    process.exit(1);
  } else {
    console.warn('WARNING: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set. Supabase features will fail.');
  }
}

module.exports = config;
