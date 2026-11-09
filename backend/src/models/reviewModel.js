const { pool } = require('../config/db');

const SORT_ORDERS = {
  newest: 'rv.updated_at DESC, rv.id DESC',
  highest: 'rv.rating DESC, rv.updated_at DESC, rv.id DESC',
  lowest: 'rv.rating ASC, rv.updated_at DESC, rv.id DESC',
  helpful: 'helpful_count DESC, rv.updated_at DESC, rv.id DESC',
};
const REVIEW_SORTS = Object.keys(SORT_ORDERS);

// $1 is always the viewer's id, used for "did I vote for this review?".
const SELECT_REVIEW = `
  SELECT rv.id, rv.user_id, rv.book_id, rv.rating, rv.comment, rv.created_at, rv.updated_at,
         u.name AS user_name, u.avatar_url AS user_avatar_url,
         (SELECT COUNT(*)::int FROM review_votes v WHERE v.review_id = rv.id) AS helpful_count,
         EXISTS (SELECT 1 FROM review_votes v WHERE v.review_id = rv.id AND v.user_id = $1) AS voted_by_me
  FROM reviews rv
  JOIN users u ON u.id = rv.user_id`;

function toReview(row) {
  if (!row) return null;
  return {
    id: row.id,
    bookId: row.book_id,
    userId: row.user_id,
    userName: row.user_name,
    userAvatarUrl: row.user_avatar_url ?? null,
    rating: row.rating,
    comment: row.comment,
    helpfulCount: row.helpful_count ?? 0,
    votedByMe: Boolean(row.voted_by_me),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// One page of a book's reviews, without the viewer's own review (the page
// shows that one separately, at the top).
async function listForBook(bookId, viewerId, { sort, page, limit }, db = pool) {
  const orderBy = SORT_ORDERS[sort] || SORT_ORDERS.newest;
  const [countResult, { rows }] = await Promise.all([
    db.query('SELECT COUNT(*)::int AS total FROM reviews WHERE book_id = $1 AND user_id <> $2', [bookId, viewerId]),
    db.query(
      `${SELECT_REVIEW}
       WHERE rv.book_id = $2 AND rv.user_id <> $1
       ORDER BY ${orderBy}
       LIMIT $3 OFFSET $4`,
      [viewerId, bookId, limit, (page - 1) * limit]
    ),
  ]);
  return { reviews: rows.map(toReview), total: countResult.rows[0].total };
}

async function findForUserAndBook(userId, bookId, db = pool) {
  const { rows } = await db.query(`${SELECT_REVIEW} WHERE rv.user_id = $1 AND rv.book_id = $2`, [userId, bookId]);
  return toReview(rows[0]);
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

async function findById(id, viewerId = 0, db = pool) {
  const { rows } = await db.query(`${SELECT_REVIEW} WHERE rv.id = $2`, [viewerId, id]);
  return toReview(rows[0]);
}

async function create(userId, bookId, { rating, comment }, db = pool) {
  const { rows } = await db.query(
    'INSERT INTO reviews (user_id, book_id, rating, comment) VALUES ($1, $2, $3, $4) RETURNING id',
    [userId, bookId, rating, comment]
  );
  return findById(rows[0].id, userId, db);
}

// The user_id condition makes sure a reader can only change their own review.
async function updateOwn(id, userId, { rating, comment }, db = pool) {
  const { rowCount } = await db.query(
    'UPDATE reviews SET rating = $3, comment = $4 WHERE id = $1 AND user_id = $2',
    [id, userId, rating, comment]
  );
  return rowCount ? findById(id, userId, db) : null;
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

// "Helpful" votes: adding twice or removing a missing vote changes nothing.
async function addVote(reviewId, userId, db = pool) {
  await db.query('INSERT INTO review_votes (review_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [
    reviewId,
    userId,
  ]);
}

async function removeVote(reviewId, userId, db = pool) {
  await db.query('DELETE FROM review_votes WHERE review_id = $1 AND user_id = $2', [reviewId, userId]);
}

// Admin dashboard: the latest reviews across the catalogue.
async function findLatest(limit, db = pool) {
  const { rows } = await db.query(
    `SELECT rv.id, rv.rating, rv.comment, rv.created_at, u.name AS user_name,
            b.id AS book_id, b.title, b.author, b.cover_image_url
     FROM reviews rv
     JOIN users u ON u.id = rv.user_id
     JOIN books b ON b.id = rv.book_id
     ORDER BY rv.created_at DESC, rv.id DESC
     LIMIT $1`,
    [limit]
  );
  return rows.map((row) => ({
    id: row.id,
    rating: row.rating,
    comment: row.comment,
    createdAt: row.created_at,
    userName: row.user_name,
    book: { id: row.book_id, title: row.title, author: row.author, coverImageUrl: row.cover_image_url },
  }));
}

async function countSince(days, db = pool) {
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS count FROM reviews WHERE created_at >= NOW() - make_interval(days => $1)`,
    [days]
  );
  return rows[0].count;
}

module.exports = {
  REVIEW_SORTS,
  toReview,
  listForBook,
  findForUserAndBook,
  summaryForBook,
  findById,
  create,
  updateOwn,
  removeOwn,
  removeById,
  addVote,
  removeVote,
  findLatest,
  countSince,
};
