const env = require('../config/env');

// Turns a PostgreSQL connection error into a sentence that says what to fix.
// Connection-refused errors arrive as an AggregateError with an empty message.
function describeDbError(err) {
  const where = env.db.connectionString ? 'DATABASE_URL' : `${env.db.host}:${env.db.port}`;
  switch (err.code) {
    case 'ECONNREFUSED':
      return `nothing is answering at ${where}. Is PostgreSQL running, and are DB_HOST/DB_PORT right?`;
    case 'ENOTFOUND':
      return `the database host in ${where} could not be found.`;
    case '28P01':
      return `PostgreSQL rejected the password for user "${env.db.user}". Check DB_USER and DB_PASSWORD.`;
    case '3D000':
      return `database "${env.db.database}" does not exist yet. Run npm run db:init.`;
    default:
      return err.message || (err.errors && err.errors[0] && err.errors[0].message) || String(err.code || err);
  }
}

module.exports = describeDbError;
