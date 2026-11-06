const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

function readInteger(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value)) {
    throw new Error(`Environment variable ${name} must be a whole number (got "${raw}").`);
  }
  return value;
}

const nodeEnv = process.env.NODE_ENV || 'development';

const env = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  port: readInteger('PORT', 4000),

  // The first URL is used to build links in emails; all of them are allowed by CORS.
  clientUrls: (process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map((url) => url.trim().replace(/\/+$/, ''))
    .filter(Boolean),

  db: {
    connectionString: process.env.DATABASE_URL || undefined,
    host: process.env.DB_HOST || 'localhost',
    port: readInteger('DB_PORT', 5432),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'booktracker',
  },

  jwt: {
    secret: process.env.JWT_SECRET || '',
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  },

  emailTokenTtlHours: readInteger('EMAIL_TOKEN_EXPIRES_HOURS', 24),

  smtp: {
    host: process.env.SMTP_HOST || '',
    port: readInteger('SMTP_PORT', 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
  mailFrom: process.env.MAIL_FROM || 'BookTracker <no-reply@booktracker.local>',

  authRateLimitMax: readInteger('AUTH_RATE_LIMIT_MAX', 20),
};

// Only the API server needs these; database scripts can run without them.
function assertServerConfig() {
  const problems = [];
  if (env.jwt.secret.length < 32) {
    problems.push('JWT_SECRET must be set and at least 32 characters long.');
  }
  if (env.isProduction && !env.smtp.host) {
    problems.push('SMTP_HOST must be set in production so verification emails can be sent.');
  }
  if (problems.length) {
    throw new Error(`Invalid configuration:\n  - ${problems.join('\n  - ')}\nSee .env.example.`);
  }
}

module.exports = { ...env, assertServerConfig };
