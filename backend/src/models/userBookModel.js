const { pool } = require('../config/db');
const { toBook } = require('./bookModel');

const READING_STATUSES = ['to_read', 'reading', 'read'];

const ENTRY_COLUMNS =
  'ub.id, ub.user_id, ub.book_id, ub.reading_status, ub.current_page, ub.total_pages, ub.created_at, ub.updated_at';

function progressPercent(currentPage, totalPages) {
  if (!totalPages) return 0;
  return Math.min(100, Math.round((currentPage / totalPages) * 100));
}

function toEntry(row) {
  if (!row) return null;
  return {
    id: row.id,
    bookId: row.book_id,
    readingStatus: row.reading_status,
    currentPage: row.current_page,
    totalPages: row.total_pages,
    progressPercent: progressPercent(row.current_page, row.total_pages),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toEntryWithBook(row) {
  if (!row) return null;
  return {
    ...toEntry(row),
    book: toBook({
      id: row.book_id,
      title: row.title,
      author: row.author,
      description: row.description,
      genre: row.genre,
      cover_image_url: row.cover_image_url,
      pdf_url: row.pdf_url,
      publication_year: row.publication_year,
      rating_average: row.rating_average,
      rating_count: row.rating_count,
      created_at: row.book_created_at,
      updated_at: row.book_updated_at,
    }),
  };
}

const SELECT_WITH_BOOK = `
  SELECT ${ENTRY_COLUMNS},
         b.title, b.author, b.description, b.cover_image_url, b.pdf_url,
         b.publication_year, b.created_at AS book_created_at, b.updated_at AS book_updated_at,
         g.name AS genre, r.rating_average, r.rating_count
  FROM user_books ub
  JOIN books b ON b.id = ub.book_id
  JOIN genres g ON g.id = b.genre_id
  LEFT JOIN LATERAL (
    SELECT ROUND(AVG(rv.rating)::numeric, 1)::float8 AS rating_average, COUNT(*)::int AS rating_count
    FROM reviews rv WHERE rv.book_id = b.id
  ) r ON TRUE`;

// Every query below filters on user_id, so a reader can only ever see or
// change their own entries.

async function listForUser(userId, { status } = {}, db = pool) {
  const params = [userId];
  let where = 'WHERE ub.user_id = $1';
  if (status) {
    params.push(status);
    where += ` AND ub.reading_status = $${params.length}`;
  }
  const { rows } = await db.query(`${SELECT_WITH_BOOK} ${where} ORDER BY ub.updated_at DESC, ub.id DESC`, params);
  return rows.map(toEntryWithBook);
}

async function countForUser(userId, db = pool) {
  const { rows } = await db.query(
    `SELECT
       COUNT(*)::int                                            AS total,
       COUNT(*) FILTER (WHERE reading_status = 'to_read')::int AS to_read,
       COUNT(*) FILTER (WHERE reading_status = 'reading')::int AS reading,
       COUNT(*) FILTER (WHERE reading_status = 'read')::int    AS read
     FROM user_books WHERE user_id = $1`,
    [userId]
  );
  const row = rows[0];
  return { total: row.total, toRead: row.to_read, reading: row.reading, read: row.read };
}

async function findForUser(userId, bookId, db = pool) {
  const { rows } = await db.query(`${SELECT_WITH_BOOK} WHERE ub.user_id = $1 AND ub.book_id = $2`, [
    userId,
    bookId,
  ]);
  return toEntryWithBook(rows[0]);
}

async function add(userId, bookId, readingStatus, db = pool) {
  await db.query(
    `INSERT INTO user_books (user_id, book_id, reading_status) VALUES ($1, $2, $3)`,
    [userId, bookId, readingStatus]
  );
  return findForUser(userId, bookId, db);
}

async function updateStatus(userId, bookId, readingStatus, db = pool) {
  const { rowCount } = await db.query(
    `UPDATE user_books SET reading_status = $3 WHERE user_id = $1 AND book_id = $2`,
    [userId, bookId, readingStatus]
  );
  return rowCount ? findForUser(userId, bookId, db) : null;
}

async function remove(userId, bookId, db = pool) {
  const { rowCount } = await db.query('DELETE FROM user_books WHERE user_id = $1 AND book_id = $2', [
    userId,
    bookId,
  ]);
  return rowCount > 0;
}

// Saves the reader's position, adding the book to their library if needed.
// Status moves forward automatically: "to read" becomes "reading" once a page
// is saved, and reaching the last page marks the book as "read".
async function saveProgress(userId, bookId, { currentPage, totalPages }, db = pool) {
  await db.query(
    `INSERT INTO user_books AS ub (user_id, book_id, reading_status, current_page, total_pages)
     VALUES (
       $1, $2,
       CASE WHEN $4::int IS NOT NULL AND $3::int >= $4::int THEN 'read' ELSE 'reading' END,
       $3, $4
     )
     ON CONFLICT (user_id, book_id) DO UPDATE SET
       current_page = EXCLUDED.current_page,
       total_pages = COALESCE(EXCLUDED.total_pages, ub.total_pages),
       reading_status = CASE
         WHEN COALESCE(EXCLUDED.total_pages, ub.total_pages) IS NOT NULL
              AND EXCLUDED.current_page >= COALESCE(EXCLUDED.total_pages, ub.total_pages) THEN 'read'
         WHEN ub.reading_status = 'to_read' THEN 'reading'
         ELSE ub.reading_status
       END`,
    [userId, bookId, currentPage, totalPages ?? null]
  );
  return findForUser(userId, bookId, db);
}

async function countForBook(bookId, db = pool) {
  const { rows } = await db.query('SELECT COUNT(*)::int AS count FROM user_books WHERE book_id = $1', [bookId]);
  return rows[0].count;
}

async function deleteForBook(bookId, db = pool) {
  const { rowCount } = await db.query('DELETE FROM user_books WHERE book_id = $1', [bookId]);
  return rowCount;
}

async function countByStatus(db = pool) {
  const { rows } = await db.query(
    `SELECT
       COUNT(*)::int                                            AS total,
       COUNT(*) FILTER (WHERE reading_status = 'to_read')::int AS to_read,
       COUNT(*) FILTER (WHERE reading_status = 'reading')::int AS reading,
       COUNT(*) FILTER (WHERE reading_status = 'read')::int    AS read,
       COUNT(*) FILTER (WHERE updated_at >= NOW() - INTERVAL '7 days')::int AS active_last_7_days
     FROM user_books`
  );
  const row = rows[0];
  return {
    total: row.total,
    toRead: row.to_read,
    reading: row.reading,
    read: row.read,
    updatedLast7Days: row.active_last_7_days,
  };
}

module.exports = {
  READING_STATUSES,
  listForUser,
  countForUser,
  findForUser,
  add,
  updateStatus,
  remove,
  saveProgress,
  countForBook,
  deleteForBook,
  countByStatus,
};
