const { Pool, types } = require('pg');

// DATE columns (such as users.birth_date) stay as 'YYYY-MM-DD' text instead of
// becoming a JavaScript Date at local midnight, which could shift the day.
types.setTypeParser(types.builtins.DATE, (value) => value);
const env = require('./env');

const pool = new Pool(
  env.db.connectionString
    ? { connectionString: env.db.connectionString }
    : {
        host: env.db.host,
        port: env.db.port,
        user: env.db.user,
        password: env.db.password,
        database: env.db.database,
      }
);

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL error on an idle connection:', err.message);
});

function query(text, params) {
  return pool.query(text, params);
}

// Runs `work(client)` inside a transaction. Model functions accept the client
// as their last argument so several of them can share one transaction.
async function withTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withTransaction };
