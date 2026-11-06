const { pool } = require('../config/db');

function toToken(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    email: row.email,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

async function create({ userId, tokenHash, email, expiresAt }, db = pool) {
  const { rows } = await db.query(
    `INSERT INTO email_verification_tokens (user_id, token, email, expires_at)
     VALUES ($1, $2, $3, $4)
     RETURNING id, user_id, email, expires_at, created_at`,
    [userId, tokenHash, email, expiresAt]
  );
  return toToken(rows[0]);
}

async function findByHash(tokenHash, db = pool) {
  const { rows } = await db.query(
    `SELECT id, user_id, email, expires_at, created_at
     FROM email_verification_tokens WHERE token = $1`,
    [tokenHash]
  );
  return toToken(rows[0]);
}

async function findLatestForEmail(userId, email, db = pool) {
  const { rows } = await db.query(
    `SELECT id, user_id, email, expires_at, created_at
     FROM email_verification_tokens
     WHERE user_id = $1 AND email = $2
     ORDER BY created_at DESC LIMIT 1`,
    [userId, email]
  );
  return toToken(rows[0]);
}

// An unexpired token for an address other than the account's current one
// means the user asked to change their email and has not confirmed it yet.
async function findPendingEmailChange(userId, currentEmail, db = pool) {
  const { rows } = await db.query(
    `SELECT id, user_id, email, expires_at, created_at
     FROM email_verification_tokens
     WHERE user_id = $1 AND email <> $2 AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 1`,
    [userId, currentEmail]
  );
  return toToken(rows[0]);
}

async function deleteById(id, db = pool) {
  await db.query('DELETE FROM email_verification_tokens WHERE id = $1', [id]);
}

async function deleteForEmail(userId, email, db = pool) {
  await db.query('DELETE FROM email_verification_tokens WHERE user_id = $1 AND email = $2', [userId, email]);
}

async function deleteEmailChanges(userId, currentEmail, db = pool) {
  await db.query('DELETE FROM email_verification_tokens WHERE user_id = $1 AND email <> $2', [
    userId,
    currentEmail,
  ]);
}

async function deleteAllForUser(userId, db = pool) {
  await db.query('DELETE FROM email_verification_tokens WHERE user_id = $1', [userId]);
}

module.exports = {
  create,
  findByHash,
  findLatestForEmail,
  findPendingEmailChange,
  deleteById,
  deleteForEmail,
  deleteEmailChanges,
  deleteAllForUser,
};
