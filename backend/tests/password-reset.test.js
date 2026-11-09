const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setup, teardown, createUser, api, pool, PASSWORD } = require('./helpers');
const { createResetToken } = require('../src/services/passwordReset');

let reader;

before(async () => {
  await setup();
  reader = await createUser({ name: 'Forgetful' });
});
after(teardown);

const login = (password) => api('POST', '/auth/login', { body: { email: reader.user.email, password } });
const reset = (token, password) => api('POST', '/auth/reset-password', { body: { token, password } });

test('asking for a link gives the same answer for known and unknown emails', async () => {
  const known = await api('POST', '/auth/forgot-password', { body: { email: reader.user.email } });
  const unknown = await api('POST', '/auth/forgot-password', { body: { email: 'nobody@test.local' } });
  assert.equal(known.status, 200);
  assert.equal(unknown.status, 200);
  const strip = (message) => message.replace(/\S+@\S+/, '');
  assert.equal(strip(known.data.message), strip(unknown.data.message));

  const { rows } = await pool.query('SELECT token FROM password_reset_tokens WHERE user_id = $1', [reader.user.id]);
  assert.equal(rows.length, 1);
  assert.match(rows[0].token, /^[a-f0-9]{64}$/, 'only a hash is stored');
});

test('a second request within a minute does not send another link', async () => {
  const before = await pool.query('SELECT created_at FROM password_reset_tokens WHERE user_id = $1', [reader.user.id]);
  await api('POST', '/auth/forgot-password', { body: { email: reader.user.email } });
  const afterwards = await pool.query('SELECT created_at FROM password_reset_tokens WHERE user_id = $1', [reader.user.id]);
  assert.equal(afterwards.rows[0].created_at.getTime(), before.rows[0].created_at.getTime());
});

test('unknown, malformed and expired links are refused', async () => {
  assert.equal((await reset('a'.repeat(64), 'NewPass456')).data.code, 'INVALID_RESET_TOKEN');
  assert.equal((await reset('not-a-token', 'NewPass456')).status, 400);

  const token = await createResetToken(reader.user.id);
  await pool.query("UPDATE password_reset_tokens SET expires_at = NOW() - INTERVAL '1 minute' WHERE user_id = $1", [
    reader.user.id,
  ]);
  const expired = await reset(token, 'NewPass456');
  assert.equal(expired.status, 400);
  assert.equal(expired.data.code, 'RESET_TOKEN_EXPIRED');
});

test('a valid link sets the new password once and signs out old sessions', async () => {
  const token = await createResetToken(reader.user.id);
  const weak = await reset(token, 'short');
  assert.equal(weak.status, 400);
  assert.ok(weak.data.errors.password);

  assert.equal((await reset(token, 'NewPass456')).status, 200);
  const oldSession = await api('GET', '/profile', { token: reader.token });
  assert.equal(oldSession.status, 401);
  assert.equal(oldSession.data.code, 'TOKEN_REVOKED');

  assert.equal((await login(PASSWORD)).status, 401);
  assert.equal((await login('NewPass456')).status, 200);
  assert.equal((await reset(token, 'Another789')).data.code, 'INVALID_RESET_TOKEN', 'links work only once');
});

test('resetting also verifies an unverified account', async () => {
  const pending = await createUser({ verified: false });
  const token = await createResetToken(pending.user.id);
  assert.equal((await reset(token, 'NewPass456')).status, 200);
  const res = await api('POST', '/auth/login', { body: { email: pending.user.email, password: 'NewPass456' } });
  assert.equal(res.status, 200);
});
