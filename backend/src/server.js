const env = require('./config/env');

try {
  env.assertServerConfig();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

const app = require('./app');
const { pool } = require('./config/db');
const mailer = require('./config/mailer');
const describeDbError = require('./utils/describeDbError');

async function start() {
  try {
    await pool.query('SELECT 1');
  } catch (err) {
    console.error(`Could not connect to PostgreSQL: ${describeDbError(err)}`);
    process.exit(1);
  }

  if (mailer.smtpConfigured) {
    mailer.verifyConnection().catch((err) => {
      console.warn(`SMTP connection check failed, emails may not be delivered: ${err.message}`);
    });
  } else {
    console.warn('SMTP is not configured: verification emails will be printed in this console.');
  }

  const server = app.listen(env.port, () => {
    console.log(`BookTracker API running on http://localhost:${env.port}/api`);
  });

  const shutdown = () => {
    server.close(() => pool.end().finally(() => process.exit(0)));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start();
