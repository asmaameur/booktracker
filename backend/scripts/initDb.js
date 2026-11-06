// Creates the database if it does not exist yet, then creates the tables.
// Usage: npm run db:init
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const env = require('../src/config/env');
const describeDbError = require('../src/utils/describeDbError');

async function createDatabaseIfMissing() {
  if (env.db.connectionString) return; // hosted databases are created by the provider

  const admin = new Client({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: 'postgres',
  });
  await admin.connect();
  try {
    const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [env.db.database]);
    if (rowCount === 0) {
      await admin.query(`CREATE DATABASE ${admin.escapeIdentifier(env.db.database)}`);
      console.log(`Created database "${env.db.database}".`);
    } else {
      console.log(`Database "${env.db.database}" already exists.`);
    }
  } finally {
    await admin.end();
  }
}

async function createTables() {
  const { pool } = require('../src/config/db');
  const schema = fs.readFileSync(path.join(__dirname, '..', 'database', 'schema.sql'), 'utf8');
  try {
    await pool.query(schema);
    console.log('Tables, constraints, indexes and triggers are ready.');
  } finally {
    await pool.end();
  }
}

createDatabaseIfMissing()
  .then(createTables)
  .catch((err) => {
    console.error(`Database setup failed: ${describeDbError(err)}`);
    process.exit(1);
  });
