// Shared setup for the API tests (run with `npm test`).
//
// The tests use their own database, booktracker_test by default (TEST_DB_NAME
// to change it), which is created and emptied automatically. They never touch
// the database from .env. Emails are printed instead of sent, and uploads go
// to a temporary folder.
const os = require('os');
const fs = require('fs');
const path = require('path');

// These must be set before anything loads src/config/env.js, which reads .env
// without overriding variables that are already set.
process.env.NODE_ENV = 'test';
process.env.DB_NAME = process.env.TEST_DB_NAME || 'booktracker_test';
process.env.DATABASE_URL = '';
process.env.SMTP_HOST = '';
process.env.AUTH_RATE_LIMIT_MAX = '100000';
process.env.UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'booktracker-test-uploads-'));
if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'test-only-secret-that-is-long-enough-1234567890';

const { Client } = require('pg');
const env = require('../src/config/env');

if (!env.db.database.endsWith('_test')) {
  throw new Error(`Refusing to run tests on "${env.db.database}": the test database name must end with "_test".`);
}

const { pool } = require('../src/config/db');
const app = require('../src/app');
const userModel = require('../src/models/userModel');
const { hashPassword, issueSession } = require('../src/utils/security');

const PASSWORD = 'TestPass123';
let server;
let baseUrl;
let passwordHash;
let counter = 0;

async function createDatabaseIfMissing() {
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
    if (rowCount === 0) await admin.query(`CREATE DATABASE ${admin.escapeIdentifier(env.db.database)}`);
  } finally {
    await admin.end();
  }
}

// Creates the test database and tables, empties every table except genres,
// and starts the API on a free port.
async function setup() {
  await createDatabaseIfMissing();
  const schema = fs.readFileSync(path.join(__dirname, '..', 'database', 'schema.sql'), 'utf8');
  await pool.query(schema);
  const { rows } = await pool.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = current_schema() AND tablename <> 'genres'`
  );
  await pool.query(`TRUNCATE ${rows.map((r) => `"${r.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`);

  passwordHash = passwordHash || (await hashPassword(PASSWORD));
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  baseUrl = `http://localhost:${server.address().port}`;
}

async function teardown() {
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
  fs.rmSync(process.env.UPLOAD_DIR, { recursive: true, force: true });
}

// A verified account and a login token for it.
async function createUser({ role = 'user', name, verified = true } = {}) {
  counter += 1;
  const user = await userModel.create({
    name: name || `${role === 'admin' ? 'Admin' : 'Reader'} ${counter}`,
    email: `${role}-${counter}-${Date.now()}@test.local`,
    passwordHash,
    role,
    isVerified: verified,
  });
  return { user, token: issueSession(user).token };
}

// Calls the API. `body` is sent as JSON; `file` (a Buffer) is sent raw with `type`.
async function api(method, url, { token, body, file, type } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (file) {
    headers['Content-Type'] = type;
    payload = new Blob([file]);
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${baseUrl}/api${url}`, { method, headers, body: payload });
  const isJson = (res.headers.get('content-type') || '').includes('application/json');
  return { status: res.status, headers: res.headers, data: isJson ? await res.json() : null, res };
}

// A book added by an admin (genre "Fiction" unless given).
async function createBook(adminToken, overrides = {}) {
  counter += 1;
  const { status, data } = await api('POST', '/books', {
    token: adminToken,
    body: { title: `Test Book ${counter}`, author: 'Test Author', genre: 'Fiction', ...overrides },
  });
  if (status !== 201) throw new Error(`createBook failed: ${status} ${JSON.stringify(data)}`);
  return data.book;
}

module.exports = {
  PASSWORD,
  setup,
  teardown,
  createUser,
  createBook,
  api,
  pool,
  url: (pathname) => `${baseUrl}${pathname}`,
};
