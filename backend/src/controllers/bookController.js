const { Readable } = require('stream');
const { pipeline } = require('stream/promises');
const { withTransaction } = require('../config/db');
const HttpError = require('../utils/HttpError');
const { parseId } = require('../middleware/validate');
const bookModel = require('../models/bookModel');
const userBookModel = require('../models/userBookModel');

const PDF_TIMEOUT_MS = 60 * 1000;
const PDF_MAX_BYTES = 100 * 1024 * 1024;

async function findBookOr404(rawId) {
  const book = await bookModel.findById(parseId(rawId, 'book id'));
  if (!book) {
    throw new HttpError(404, 'This book does not exist or has been removed.', { code: 'BOOK_NOT_FOUND' });
  }
  return book;
}

// GET /api/books?search=&category=&sort=&page=&limit=
async function listBooks(req, res) {
  const filters = req.validated;
  const { books, total } = await bookModel.list(filters);
  res.json({
    books,
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / filters.limit)),
    },
  });
}

// GET /api/books/categories
async function listCategories(req, res) {
  res.json({ categories: await bookModel.listCategories() });
}

// GET /api/books/:id
// Readers also get their own library entry for the book (or null); admins get
// how many readers have it, which matters before deleting it.
async function getBook(req, res) {
  const book = await findBookOr404(req.params.id);

  if (req.user.role === 'admin') {
    res.json({ book, readerCount: await userBookModel.countForBook(book.id) });
    return;
  }

  const entry = await userBookModel.findForUser(req.user.id, book.id);
  if (entry) delete entry.book;
  res.json({ book, libraryEntry: entry });
}

// POST /api/books (admin)
async function createBook(req, res) {
  const book = await bookModel.create(req.validated);
  res.status(201).json({ book, message: `"${book.title}" has been added to the catalogue.` });
}

// PUT /api/books/:id (admin)
async function updateBook(req, res) {
  const book = await bookModel.update(parseId(req.params.id, 'book id'), req.validated);
  if (!book) {
    throw new HttpError(404, 'This book does not exist or has been removed.', { code: 'BOOK_NOT_FOUND' });
  }
  res.json({ book, message: `"${book.title}" has been updated.` });
}

// DELETE /api/books/:id[?force=true] (admin)
// A book that readers have in their library is only deleted when the admin
// confirms with ?force=true; their entries and progress are removed with it.
async function deleteBook(req, res) {
  const book = await findBookOr404(req.params.id);
  const readerCount = await userBookModel.countForBook(book.id);
  const force = req.query.force === 'true';

  if (readerCount > 0 && !force) {
    const readers = readerCount === 1 ? "1 reader's library" : `${readerCount} readers' libraries`;
    throw new HttpError(
      409,
      `"${book.title}" is in ${readers}. Deleting it will also remove it from there, including reading progress.`,
      { code: 'BOOK_IN_LIBRARIES', details: { readerCount } }
    );
  }

  const removedFromLibraries = await withTransaction(async (client) => {
    const removed = force ? await userBookModel.deleteForBook(book.id, client) : 0;
    await bookModel.remove(book.id, client);
    return removed;
  });

  res.json({ message: `"${book.title}" has been deleted.`, removedFromLibraries });
}

function pdfError(status, message, code) {
  return new HttpError(status, message, { code });
}

// GET /api/books/:id/pdf
// Streams the book's PDF through the API. Browsers block PDF.js from reading
// most external PDF links directly (CORS), and this also keeps the file behind
// login.
async function streamPdf(req, res) {
  const book = await findBookOr404(req.params.id);
  if (!book.pdfUrl) {
    throw pdfError(404, 'No PDF is available for this book yet.', 'PDF_MISSING');
  }

  let upstream;
  try {
    upstream = await fetch(book.pdfUrl, { redirect: 'follow', signal: AbortSignal.timeout(PDF_TIMEOUT_MS) });
  } catch {
    throw pdfError(502, 'The PDF could not be reached. Please try again later.', 'PDF_UNAVAILABLE');
  }

  const contentType = (upstream.headers.get('content-type') || '').toLowerCase();
  const contentLength = Number(upstream.headers.get('content-length')) || null;
  let problem = null;
  if (!upstream.ok || !upstream.body) {
    problem = pdfError(502, 'The PDF could not be loaded from its source.', 'PDF_UNAVAILABLE');
  } else if (contentType && !contentType.includes('pdf') && !contentType.includes('octet-stream')) {
    problem = pdfError(502, "This book's PDF link does not point to a PDF file.", 'PDF_INVALID');
  } else if (contentLength && contentLength > PDF_MAX_BYTES) {
    problem = pdfError(502, 'This PDF is too large to open in the reader.', 'PDF_TOO_LARGE');
  }
  if (problem) {
    if (upstream.body) await upstream.body.cancel().catch(() => {});
    throw problem;
  }

  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `inline; filename="booktracker-${book.id}.pdf"`,
    'Cache-Control': 'private, max-age=3600',
    'Cross-Origin-Resource-Policy': 'cross-origin',
  });
  // fetch() decompresses gzip bodies, so the upstream length is only right
  // when the response was not compressed.
  if (contentLength && !upstream.headers.get('content-encoding')) {
    res.set('Content-Length', String(contentLength));
  }

  try {
    await pipeline(Readable.fromWeb(upstream.body), res);
  } catch {
    // The reader closed the page or the source dropped mid-download; the
    // response has already started, so there is nothing left to send.
    res.destroy();
  }
}

module.exports = { listBooks, listCategories, getBook, createBook, updateBook, deleteBook, streamPdf };
