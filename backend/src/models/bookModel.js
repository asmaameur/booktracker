const { pool } = require('../config/db');

const SORT_ORDERS = {
  newest: 'b.created_at DESC, b.id DESC',
  oldest: 'b.created_at ASC, b.id ASC',
  title: 'LOWER(b.title) ASC, b.id ASC',
  author: 'LOWER(b.author) ASC, LOWER(b.title) ASC, b.id ASC',
  year: 'b.publication_year DESC NULLS LAST, b.id DESC',
  rating: 'rating_average DESC NULLS LAST, rating_count DESC, b.id DESC',
};

// Every book is returned with its genre name and its rating, calculated from
// the reviews table (rating_average is NULL while nobody has rated it).
const BOOK_SELECT = `
  SELECT b.*, g.name AS genre, r.rating_average, r.rating_count
  FROM books b
  JOIN genres g ON g.id = b.genre_id
  LEFT JOIN LATERAL (
    SELECT ROUND(AVG(rv.rating)::numeric, 1)::float8 AS rating_average, COUNT(*)::int AS rating_count
    FROM reviews rv WHERE rv.book_id = b.id
  ) r ON TRUE`;

function toBook(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    description: row.description,
    genre: row.genre ?? null,
    coverImageUrl: row.cover_image_url,
    pdfUrl: row.pdf_url,
    hasPdf: Boolean(row.pdf_url),
    publicationYear: row.publication_year,
    averageRating: row.rating_average == null ? null : Number(row.rating_average),
    ratingCount: row.rating_count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function escapeLikePattern(text) {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}

async function list({ search, genre, sort, page, limit }, db = pool) {
  const conditions = [];
  const params = [];

  if (search) {
    params.push(`%${escapeLikePattern(search)}%`);
    conditions.push(`(b.title ILIKE $${params.length} OR b.author ILIKE $${params.length})`);
  }
  if (genre) {
    params.push(genre);
    conditions.push(`LOWER(g.name) = LOWER($${params.length})`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const orderBy = SORT_ORDERS[sort] || SORT_ORDERS.newest;

  const countResult = await db.query(
    `SELECT COUNT(*)::int AS total FROM books b JOIN genres g ON g.id = b.genre_id ${where}`,
    params
  );
  const { rows } = await db.query(
    `${BOOK_SELECT} ${where} ORDER BY ${orderBy}
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, (page - 1) * limit]
  );

  return { books: rows.map(toBook), total: countResult.rows[0].total };
}

async function findById(id, db = pool) {
  const { rows } = await db.query(`${BOOK_SELECT} WHERE b.id = $1`, [id]);
  return toBook(rows[0]);
}

async function create(book, db = pool) {
  const { rows } = await db.query(
    `INSERT INTO books (title, author, description, cover_image_url, pdf_url, publication_year, genre_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      book.title,
      book.author,
      book.description,
      book.coverImageUrl,
      book.pdfUrl,
      book.publicationYear,
      book.genreId,
    ]
  );
  return findById(rows[0].id, db);
}

async function update(id, book, db = pool) {
  const { rows } = await db.query(
    `UPDATE books
     SET title = $2, author = $3, description = $4,
         cover_image_url = $5, pdf_url = $6, publication_year = $7, genre_id = $8
     WHERE id = $1
     RETURNING id`,
    [
      id,
      book.title,
      book.author,
      book.description,
      book.coverImageUrl,
      book.pdfUrl,
      book.publicationYear,
      book.genreId,
    ]
  );
  return rows[0] ? findById(id, db) : null;
}

async function remove(id, db = pool) {
  const { rowCount } = await db.query('DELETE FROM books WHERE id = $1', [id]);
  return rowCount > 0;
}

async function existsWithTitleAndAuthor(title, author, db = pool) {
  const { rows } = await db.query(
    'SELECT 1 FROM books WHERE LOWER(title) = LOWER($1) AND LOWER(author) = LOWER($2) LIMIT 1',
    [title, author]
  );
  return rows.length > 0;
}

async function countAll(db = pool) {
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE pdf_url IS NOT NULL)::int AS with_pdf
     FROM books`
  );
  return { total: rows[0].total, withPdf: rows[0].with_pdf };
}

async function findRecent(limit, db = pool) {
  const { rows } = await db.query(`${BOOK_SELECT} ORDER BY b.created_at DESC, b.id DESC LIMIT $1`, [limit]);
  return rows.map(toBook);
}

async function findMostAdded(limit, db = pool) {
  const { rows } = await db.query(
    `SELECT book.*, ub.reader_count
     FROM (${BOOK_SELECT}) book
     JOIN (SELECT book_id, COUNT(*)::int AS reader_count FROM user_books GROUP BY book_id) ub ON ub.book_id = book.id
     ORDER BY ub.reader_count DESC, LOWER(book.title) ASC
     LIMIT $1`,
    [limit]
  );
  return rows.map((row) => ({ ...toBook(row), readerCount: row.reader_count }));
}

// Rated books, best first ("top"), or worst first for books averaging under
// 3 stars ("lowest"), so a well-liked book never shows up as "lowest rated".
async function findByRating(direction, limit, db = pool) {
  const top = direction === 'top';
  const { rows } = await db.query(
    `${BOOK_SELECT} WHERE r.rating_count > 0 ${top ? '' : 'AND r.rating_average < 3'}
     ORDER BY r.rating_average ${top ? 'DESC' : 'ASC'}, r.rating_count DESC, b.id DESC
     LIMIT $1`,
    [limit]
  );
  return rows.map(toBook);
}

module.exports = {
  BOOK_SELECT,
  findByRating,
  toBook,
  list,
  findById,
  create,
  update,
  remove,
  existsWithTitleAndAuthor,
  countAll,
  findRecent,
  findMostAdded,
};
