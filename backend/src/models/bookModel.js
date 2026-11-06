const { pool } = require('../config/db');

const SORT_ORDERS = {
  newest: 'created_at DESC, id DESC',
  oldest: 'created_at ASC, id ASC',
  title: 'LOWER(title) ASC, id ASC',
  author: 'LOWER(author) ASC, LOWER(title) ASC, id ASC',
  year: 'publication_year DESC NULLS LAST, id DESC',
};

function toBook(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    description: row.description,
    category: row.category,
    coverImageUrl: row.cover_image_url,
    pdfUrl: row.pdf_url,
    hasPdf: Boolean(row.pdf_url),
    publicationYear: row.publication_year,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function escapeLikePattern(text) {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}

async function list({ search, category, sort, page, limit }, db = pool) {
  const conditions = [];
  const params = [];

  if (search) {
    params.push(`%${escapeLikePattern(search)}%`);
    conditions.push(`(title ILIKE $${params.length} OR author ILIKE $${params.length})`);
  }
  if (category) {
    params.push(category);
    conditions.push(`LOWER(category) = LOWER($${params.length})`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const orderBy = SORT_ORDERS[sort] || SORT_ORDERS.newest;

  const countResult = await db.query(`SELECT COUNT(*)::int AS total FROM books ${where}`, params);
  const { rows } = await db.query(
    `SELECT * FROM books ${where} ORDER BY ${orderBy}
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, (page - 1) * limit]
  );

  return { books: rows.map(toBook), total: countResult.rows[0].total };
}

async function findById(id, db = pool) {
  const { rows } = await db.query('SELECT * FROM books WHERE id = $1', [id]);
  return toBook(rows[0]);
}

async function create(book, db = pool) {
  const { rows } = await db.query(
    `INSERT INTO books (title, author, description, category, cover_image_url, pdf_url, publication_year)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      book.title,
      book.author,
      book.description,
      book.category,
      book.coverImageUrl,
      book.pdfUrl,
      book.publicationYear,
    ]
  );
  return toBook(rows[0]);
}

async function update(id, book, db = pool) {
  const { rows } = await db.query(
    `UPDATE books
     SET title = $2, author = $3, description = $4, category = $5,
         cover_image_url = $6, pdf_url = $7, publication_year = $8
     WHERE id = $1
     RETURNING *`,
    [
      id,
      book.title,
      book.author,
      book.description,
      book.category,
      book.coverImageUrl,
      book.pdfUrl,
      book.publicationYear,
    ]
  );
  return toBook(rows[0]);
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

async function listCategories(db = pool) {
  const { rows } = await db.query(
    `SELECT MIN(category) AS category, COUNT(*)::int AS count
     FROM books
     WHERE category IS NOT NULL AND category <> ''
     GROUP BY LOWER(category)
     ORDER BY MIN(category)`
  );
  return rows.map((row) => ({ name: row.category, count: row.count }));
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
  const { rows } = await db.query('SELECT * FROM books ORDER BY created_at DESC, id DESC LIMIT $1', [limit]);
  return rows.map(toBook);
}

async function findMostAdded(limit, db = pool) {
  const { rows } = await db.query(
    `SELECT b.*, COUNT(ub.id)::int AS reader_count
     FROM books b
     JOIN user_books ub ON ub.book_id = b.id
     GROUP BY b.id
     ORDER BY reader_count DESC, LOWER(b.title) ASC
     LIMIT $1`,
    [limit]
  );
  return rows.map((row) => ({ ...toBook(row), readerCount: row.reader_count }));
}

module.exports = {
  toBook,
  list,
  findById,
  create,
  update,
  remove,
  existsWithTitleAndAuthor,
  listCategories,
  countAll,
  findRecent,
  findMostAdded,
};
