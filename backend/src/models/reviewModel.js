const { pool } = require('../config/db');

const SELECT_REVIEW = `
  SELECT rv.id, rv.user_id, rv.book_id, rv.rating, rv.comment, rv.created_at, rv.updated_at,
         u.name AS user_name
  FROM reviews rv
  JOIN users u ON u.id = rv.user_id`;

function toReview(row) {
  if (!row) return null;
  return {
    id: row.id,
    bookId: row.book_id,
    userId: row.user_id,
    userName: row.user_name,
    rating: row.rating,
    comment: row.comment,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function listForBook(bookId, db = pool) {
  const { rows } = await db.query(`${SELECT_REVIEW} WHERE rv.book_id = $1 ORDER BY rv.updated_at DESC, rv.id DESC`, [
    bookId,
  ]);
  return rows.map(toReview);
}

// Average and count straight from the reviews table, plus how many reviews
// gave each number of stars (for the breakdown bars).
async function summaryForBook(bookId, db = pool) {
  const { rows } = await db.query(
    `SELECT ROUND(AVG(rating)::numeric, 1)::float8 AS average,
            COUNT(*)::int AS count,
            COUNT(*) FILTER (WHERE rating = 5)::int AS r5,
            COUNT(*) FILTER (WHERE rating = 4)::int AS r4,
            COUNT(*) FILTER (WHERE rating = 3)::int AS r3,
            COUNT(*) FILTER (WHERE rating = 2)::int AS r2,
            COUNT(*) FILTER (WHERE rating = 1)::int AS r1
     FROM reviews WHERE book_id = $1`,
    [bookId]
  );
  const row = rows[0];
  return {
    averageRating: row.average == null ? null : Number(row.average),
    ratingCount: row.count,
    distribution: { 5: row.r5, 4: row.r4, 3: row.r3, 2: row.r2, 1: row.r1 },
  };
}

async function findById(id, db = pool) {
  const { rows } = await db.query(`${SELECT_REVIEW} WHERE rv.id = $1`, [id]);
  return toReview(rows[0]);
}

async function create(userId, bookId, { rating, comment }, db = pool) {
  const { rows } = await db.query(
    'INSERT INTO reviews (user_id, book_id, rating, comment) VALUES ($1, $2, $3, $4) RETURNING id',
    [userId, bookId, rating, comment]
  );
  return findById(rows[0].id, db);
}

// The user_id condition makes sure a reader can only change their own review.
async function updateOwn(id, userId, { rating, comment }, db = pool) {
  const { rowCount } = await db.query(
    'UPDATE reviews SET rating = $3, comment = $4 WHERE id = $1 AND user_id = $2',
    [id, userId, rating, comment]
  );
  return rowCount ? findById(id, db) : null;
}

async function removeOwn(id, userId, db = pool) {
  const { rowCount } = await db.query('DELETE FROM reviews WHERE id = $1 AND user_id = $2', [id, userId]);
  return rowCount > 0;
}

// Admins only (moderation): removes any review.
async function removeById(id, db = pool) {
  const { rowCount } = await db.query('DELETE FROM reviews WHERE id = $1', [id]);
  return rowCount > 0;
}

module.exports = { toReview, listForBook, summaryForBook, findById, create, updateOwn, removeOwn, removeById };
