const { pool } = require('../config/db');
const { toBook } = require('./bookModel');

// Adds pages to today's reading activity (called when progress moves forward).
async function recordPages(userId, pages, db = pool) {
  if (!(pages > 0)) return;
  await db.query(
    `INSERT INTO reading_activity (user_id, day, pages) VALUES ($1, CURRENT_DATE, $2)
     ON CONFLICT (user_id, day) DO UPDATE SET pages = reading_activity.pages + EXCLUDED.pages`,
    [userId, pages]
  );
}

async function findGoal(userId, year, db = pool) {
  const { rows } = await db.query('SELECT target FROM reading_goals WHERE user_id = $1 AND year = $2', [userId, year]);
  return rows[0] ? rows[0].target : null;
}

async function setGoal(userId, year, target, db = pool) {
  await db.query(
    `INSERT INTO reading_goals (user_id, year, target) VALUES ($1, $2, $3)
     ON CONFLICT (user_id, year) DO UPDATE SET target = EXCLUDED.target`,
    [userId, year, target]
  );
}

async function deleteGoal(userId, year, db = pool) {
  const { rowCount } = await db.query('DELETE FROM reading_goals WHERE user_id = $1 AND year = $2', [userId, year]);
  return rowCount > 0;
}

// Everything the "My reading" page shows, for one reader and one year.
async function readingStats(userId, year, db = pool) {
  const [months, finished, pages, genres, shelf, ratings, target] = await Promise.all([
    // Books finished in each month of the year (1-12).
    db.query(
      `SELECT EXTRACT(MONTH FROM finished_at)::int AS month, COUNT(*)::int AS count
       FROM user_books
       WHERE user_id = $1 AND finished_at IS NOT NULL AND EXTRACT(YEAR FROM finished_at) = $2
       GROUP BY 1`,
      [userId, year]
    ),
    // The latest books finished that year.
    db.query(
      `SELECT b.*, g.name AS genre, ub.finished_at
       FROM user_books ub
       JOIN books b ON b.id = ub.book_id
       JOIN genres g ON g.id = b.genre_id
       WHERE ub.user_id = $1 AND ub.finished_at IS NOT NULL AND EXTRACT(YEAR FROM ub.finished_at) = $2
       ORDER BY ub.finished_at DESC
       LIMIT 6`,
      [userId, year]
    ),
    // Pages read on each of the last 7 days (days without reading are 0).
    db.query(
      `SELECT to_char(d, 'YYYY-MM-DD') AS day, COALESCE(ra.pages, 0)::int AS pages
       FROM generate_series(CURRENT_DATE - 6, CURRENT_DATE, INTERVAL '1 day') AS d
       LEFT JOIN reading_activity ra ON ra.user_id = $1 AND ra.day = d::date
       ORDER BY d`,
      [userId]
    ),
    // Genres of the books the reader has finished (all time).
    db.query(
      `SELECT g.name, COUNT(*)::int AS count
       FROM user_books ub
       JOIN books b ON b.id = ub.book_id
       JOIN genres g ON g.id = b.genre_id
       WHERE ub.user_id = $1 AND ub.reading_status = 'read'
       GROUP BY g.name
       ORDER BY count DESC, g.name
       LIMIT 5`,
      [userId]
    ),
    db.query(
      `SELECT COUNT(*) FILTER (WHERE reading_status = 'reading')::int AS reading,
              COUNT(*) FILTER (WHERE reading_status = 'read')::int AS read,
              COALESCE(SUM(current_page), 0)::int AS pages_total
       FROM user_books WHERE user_id = $1`,
      [userId]
    ),
    db.query(
      `SELECT COUNT(*)::int AS count, ROUND(AVG(rating)::numeric, 1)::float8 AS average
       FROM reviews WHERE user_id = $1`,
      [userId]
    ),
    findGoal(userId, year, db),
  ]);

  const byMonth = Array.from({ length: 12 }, (_, i) => months.rows.find((row) => row.month === i + 1)?.count ?? 0);
  const finishedThisYear = byMonth.reduce((sum, n) => sum + n, 0);
  const lastWeek = pages.rows.map((row) => ({ day: row.day, pages: row.pages }));
  const s = shelf.rows[0];
  const r = ratings.rows[0];

  return {
    year,
    goal: target ? { target, finished: finishedThisYear, percent: Math.min(100, Math.round((finishedThisYear / target) * 100)) } : null,
    finishedThisYear,
    byMonth,
    recentlyFinished: finished.rows.map((row) => ({ ...toBook(row), finishedAt: row.finished_at })),
    pages: {
      lastWeek,
      thisWeek: lastWeek.reduce((sum, d) => sum + d.pages, 0),
      total: s.pages_total,
    },
    topGenres: genres.rows.map((row) => ({ name: row.name, count: row.count })),
    shelf: { reading: s.reading, read: s.read },
    reviews: { count: r.count, averageGiven: r.average == null ? null : Number(r.average) },
  };
}

module.exports = { recordPages, findGoal, setGoal, deleteGoal, readingStats };
