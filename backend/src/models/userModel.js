const { pool } = require('../config/db');

const PUBLIC_COLUMNS = 'id, name, email, role, is_verified, password_changed_at, created_at, updated_at';

function toUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    isVerified: row.is_verified,
    passwordChangedAt: row.password_changed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.password !== undefined && { passwordHash: row.password }),
  };
}

async function create({ name, email, passwordHash, role = 'user', isVerified = false }, db = pool) {
  const { rows } = await db.query(
    `INSERT INTO users (name, email, password, role, is_verified)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${PUBLIC_COLUMNS}`,
    [name, email, passwordHash, role, isVerified]
  );
  return toUser(rows[0]);
}

async function findById(id, db = pool) {
  const { rows } = await db.query(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = $1`, [id]);
  return toUser(rows[0]);
}

async function findByIdWithPassword(id, db = pool) {
  const { rows } = await db.query(`SELECT ${PUBLIC_COLUMNS}, password FROM users WHERE id = $1`, [id]);
  return toUser(rows[0]);
}

async function findByEmail(email, db = pool) {
  const { rows } = await db.query(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE email = $1`, [email]);
  return toUser(rows[0]);
}

async function findByEmailWithPassword(email, db = pool) {
  const { rows } = await db.query(`SELECT ${PUBLIC_COLUMNS}, password FROM users WHERE email = $1`, [email]);
  return toUser(rows[0]);
}

async function updateName(id, name, db = pool) {
  const { rows } = await db.query(
    `UPDATE users SET name = $2 WHERE id = $1 RETURNING ${PUBLIC_COLUMNS}`,
    [id, name]
  );
  return toUser(rows[0]);
}

async function markVerified(id, email, db = pool) {
  const { rows } = await db.query(
    `UPDATE users SET email = $2, is_verified = TRUE WHERE id = $1 RETURNING ${PUBLIC_COLUMNS}`,
    [id, email]
  );
  return toUser(rows[0]);
}

async function updatePassword(id, passwordHash, changedAt, db = pool) {
  const { rows } = await db.query(
    `UPDATE users SET password = $2, password_changed_at = $3 WHERE id = $1 RETURNING ${PUBLIC_COLUMNS}`,
    [id, passwordHash, changedAt]
  );
  return toUser(rows[0]);
}

async function promoteToAdmin(id, db = pool) {
  const { rows } = await db.query(
    `UPDATE users SET role = 'admin', is_verified = TRUE WHERE id = $1 RETURNING ${PUBLIC_COLUMNS}`,
    [id]
  );
  return toUser(rows[0]);
}

async function countByRole(db = pool) {
  const { rows } = await db.query(
    `SELECT
       COUNT(*) FILTER (WHERE role = 'user')::int                     AS readers,
       COUNT(*) FILTER (WHERE role = 'user' AND is_verified)::int     AS verified_readers,
       COUNT(*) FILTER (WHERE role = 'admin')::int                    AS admins,
       COUNT(*) FILTER (WHERE role = 'user' AND created_at >= NOW() - INTERVAL '30 days')::int AS joined_last_30_days
     FROM users`
  );
  const row = rows[0];
  return {
    readers: row.readers,
    verifiedReaders: row.verified_readers,
    admins: row.admins,
    joinedLast30Days: row.joined_last_30_days,
  };
}

function escapeLikePattern(text) {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}

// Accounts for the admin's user management page, with how many books each
// reader has on their shelves.
async function list({ search, role, page, limit }, db = pool) {
  const conditions = [];
  const params = [];
  if (search) {
    params.push(`%${escapeLikePattern(search)}%`);
    conditions.push(`(u.name ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
  }
  if (role) {
    params.push(role);
    conditions.push(`u.role = $${params.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await db.query(`SELECT COUNT(*)::int AS total FROM users u ${where}`, params);
  const { rows } = await db.query(
    `SELECT ${PUBLIC_COLUMNS.split(', ').map((c) => `u.${c}`).join(', ')},
            (SELECT COUNT(*)::int FROM user_books ub WHERE ub.user_id = u.id) AS library_count
     FROM users u ${where}
     ORDER BY u.created_at DESC, u.id DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, (page - 1) * limit]
  );
  return {
    users: rows.map((row) => ({ ...toUser(row), libraryCount: row.library_count })),
    total: countResult.rows[0].total,
  };
}

// The user's library entries and verification tokens are removed with them
// (ON DELETE CASCADE).
async function remove(id, db = pool) {
  const { rowCount } = await db.query('DELETE FROM users WHERE id = $1', [id]);
  return rowCount > 0;
}

async function findRecent(limit, db = pool) {
  const { rows } = await db.query(
    `SELECT ${PUBLIC_COLUMNS} FROM users WHERE role = 'user' ORDER BY created_at DESC, id DESC LIMIT $1`,
    [limit]
  );
  return rows.map(toUser);
}

module.exports = {
  create,
  findById,
  findByIdWithPassword,
  findByEmail,
  findByEmailWithPassword,
  updateName,
  markVerified,
  updatePassword,
  promoteToAdmin,
  countByRole,
  findRecent,
  list,
  remove,
};
