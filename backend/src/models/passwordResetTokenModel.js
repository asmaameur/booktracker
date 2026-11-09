const { pool } = require('../config/db');

function toToken(row) {
  if (!row) return null;
  return { id: row.id, userId: row.user_id, expiresAt: row.expires_at, createdAt: row.created_at };
}

async function create({ userId, tokenHash, expiresAt }, db = pool) {
  const { rows } = await db.query(
    `INSERT INTO password_reset_tokens (user_id, token, expires_at)
     VALUES ($1, $2, $3)
     RETURNING id, user_id, expires_at, created_at`,
    [userId, tokenHash, expiresAt]
  );
  return toToken(rows[0]);
}

async function findByHash(tokenHash, db = pool) {
  const { rows } = await db.query(
    'SELECT id, user_id, expires_at, created_at FROM password_reset_tokens WHERE token = $1',
    [tokenHash]
  );
  return toToken(rows[0]);
}

async function findLatestForUser(userId, db = pool) {
  const { rows } = await db.query(
    `SELECT id, user_id, expires_at, created_at FROM password_reset_tokens
     WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );
  return toToken(rows[0]);
}

async function deleteAllForUser(userId, db = pool) {
  await db.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [userId]);
}

module.exports = { create, findByHash, findLatestForUser, deleteAllForUser };
