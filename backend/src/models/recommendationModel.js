const { pool } = require('../config/db');
const { BOOK_SELECT, toBook } = require('./bookModel');

// Scores every catalogue book for one reader, using only what is stored:
//   - favourite genres (+10): the strongest signal, chosen by the reader;
//   - reading history: genres of books on their shelves (+1 to read, +2
//     reading/read, capped at +6);
//   - their own ratings: each review moves its genre by (rating - 3) x 1.5,
//     so 5 stars pulls a genre up and 1 star pushes it down (capped at ±6);
//   - other readers' average rating (up to +3) breaks ties.
// Books the reader has already read, is reading or has reviewed come last, and
// books already waiting on their To Read shelf come just before them, so they
// are only suggested when nothing else is left.
const RECOMMENDATIONS_SQL = `
  WITH prefs AS (
    SELECT genre_id FROM user_genre_preferences WHERE user_id = $1
  ),
  history AS (
    SELECT b.genre_id,
           SUM(CASE ub.reading_status WHEN 'to_read' THEN 1 ELSE 2 END)::int AS weight
    FROM user_books ub JOIN books b ON b.id = ub.book_id
    WHERE ub.user_id = $1
    GROUP BY b.genre_id
  ),
  rated AS (
    SELECT b.genre_id, SUM(rv.rating - 3)::int AS weight
    FROM reviews rv JOIN books b ON b.id = rv.book_id
    WHERE rv.user_id = $1
    GROUP BY b.genre_id
  ),
  seen AS (
    SELECT book_id, MAX(level) AS level FROM (
      SELECT book_id, CASE reading_status WHEN 'to_read' THEN 1 ELSE 2 END AS level
      FROM user_books WHERE user_id = $1
      UNION ALL
      SELECT book_id, 2 FROM reviews WHERE user_id = $1
    ) s GROUP BY book_id
  ),
  catalogue AS (${BOOK_SELECT}),
  scored AS (
    SELECT c.*,
           (c.genre_id IN (SELECT genre_id FROM prefs)) AS preferred,
           COALESCE(h.weight, 0) AS history_weight,
           COALESCE(rt.weight, 0) AS rated_weight,
           COALESCE(s.level, 0) AS seen_level,
           (CASE WHEN c.genre_id IN (SELECT genre_id FROM prefs) THEN 10 ELSE 0 END)
             + LEAST(COALESCE(h.weight, 0), 6)
             + GREATEST(LEAST(COALESCE(rt.weight, 0) * 1.5, 6), -6)
             + COALESCE(c.rating_average, 0) * 0.6 AS score
    FROM catalogue c
    LEFT JOIN history h ON h.genre_id = c.genre_id
    LEFT JOIN rated rt ON rt.genre_id = c.genre_id
    LEFT JOIN seen s ON s.book_id = c.id
  )
  SELECT * FROM scored
  ORDER BY seen_level ASC, score DESC, rating_count DESC, created_at DESC, id DESC
  LIMIT $2`;

function reasonFor(row) {
  if (row.preferred) return `Because you like ${row.genre}`;
  if (row.rated_weight > 0) return `You rated ${row.genre} books highly`;
  if (row.history_weight > 0) return `Similar to books in your library`;
  if (row.rating_average != null && row.rating_average >= 4) return 'Highly rated by readers';
  return 'New to discover';
}

async function forUser(userId, limit, db = pool) {
  const { rows } = await db.query(RECOMMENDATIONS_SQL, [userId, limit]);
  return rows.map((row) => ({
    ...toBook(row),
    recommendation: {
      reason: reasonFor(row),
      matchesPreferences: row.preferred,
      alreadyInLibrary: row.seen_level > 0,
    },
  }));
}

// "Readers also liked" for one book: books rated 4 or 5 stars by the readers
// who rated this one 4 or 5 stars, most shared fans first. When there are not
// enough, books of the same genre fill the list (best rated first).
const ALSO_LIKED_SQL = `
  WITH fans AS (
    SELECT user_id FROM reviews WHERE book_id = $1 AND rating >= 4
  ),
  liked AS (
    SELECT rv.book_id, COUNT(*)::int AS shared_fans
    FROM reviews rv JOIN fans f ON f.user_id = rv.user_id
    WHERE rv.book_id <> $1 AND rv.rating >= 4
    GROUP BY rv.book_id
  ),
  this_book AS (SELECT genre_id FROM books WHERE id = $1),
  catalogue AS (${BOOK_SELECT})
  SELECT c.*, COALESCE(l.shared_fans, 0) AS shared_fans
  FROM catalogue c
  LEFT JOIN liked l ON l.book_id = c.id
  WHERE c.id <> $1 AND (l.shared_fans IS NOT NULL OR c.genre_id = (SELECT genre_id FROM this_book))
  ORDER BY shared_fans DESC, rating_average DESC NULLS LAST, rating_count DESC, created_at DESC, id DESC
  LIMIT $2`;

async function alsoLiked(bookId, limit, db = pool) {
  const { rows } = await db.query(ALSO_LIKED_SQL, [bookId, limit]);
  return rows.map((row) => ({
    ...toBook(row),
    similarity: {
      sharedFans: row.shared_fans,
      reason:
        row.shared_fans > 0
          ? `${row.shared_fans} reader${row.shared_fans === 1 ? '' : 's'} who liked this also liked it`
          : `Also ${row.genre}`,
    },
  }));
}

// Whether the reader has anything to base recommendations on besides genres.
async function hasHistory(userId, db = pool) {
  const { rows } = await db.query(
    `SELECT EXISTS (SELECT 1 FROM user_books WHERE user_id = $1)
         OR EXISTS (SELECT 1 FROM reviews WHERE user_id = $1) AS has_history`,
    [userId]
  );
  return rows[0].has_history;
}

module.exports = { forUser, alsoLiked, hasHistory };
