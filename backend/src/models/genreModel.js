const { pool } = require('../config/db');

// The genres with how many books each one has (0 for empty genres, so admins
// and readers always see the full list).
async function listWithCounts(db = pool) {
  const { rows } = await db.query(
    `SELECT g.id, g.name, COUNT(b.id)::int AS count
     FROM genres g
     LEFT JOIN books b ON b.genre_id = g.id
     GROUP BY g.id
     ORDER BY g.name`
  );
  return rows.map((row) => ({ id: row.id, name: row.name, count: row.count }));
}

async function findByName(name, db = pool) {
  const { rows } = await db.query('SELECT id, name FROM genres WHERE LOWER(name) = LOWER($1)', [name]);
  return rows[0] || null;
}

// Resolves a list of genre names; unknown names are simply not returned.
async function findByNames(names, db = pool) {
  if (!names.length) return [];
  const { rows } = await db.query(
    'SELECT id, name FROM genres WHERE LOWER(name) = ANY($1::text[]) ORDER BY name',
    [names.map((name) => name.toLowerCase())]
  );
  return rows;
}

async function listPreferred(userId, db = pool) {
  const { rows } = await db.query(
    `SELECT g.id, g.name
     FROM user_genre_preferences p
     JOIN genres g ON g.id = p.genre_id
     WHERE p.user_id = $1
     ORDER BY g.name`,
    [userId]
  );
  return rows.map((row) => row.name);
}

// Replaces the reader's whole set of favourite genres. Run inside a
// transaction so the old set is never lost if the insert fails.
async function replacePreferred(userId, genreIds, db = pool) {
  await db.query('DELETE FROM user_genre_preferences WHERE user_id = $1', [userId]);
  if (genreIds.length) {
    await db.query(
      `INSERT INTO user_genre_preferences (user_id, genre_id)
       SELECT $1, UNNEST($2::int[])`,
      [userId, genreIds]
    );
  }
}

module.exports = { listWithCounts, findByName, findByNames, listPreferred, replacePreferred };
