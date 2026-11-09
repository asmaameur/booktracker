const fs = require('fs');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');
const { withTransaction } = require('../config/db');
const HttpError = require('../utils/HttpError');
const { parseId } = require('../middleware/validate');
const bookModel = require('../models/bookModel');
const userBookModel = require('../models/userBookModel');
const genreModel = require('../models/genreModel');
const notificationModel = require('../models/notificationModel');
const { localPathFor, removeUnusedUploads } = require('../utils/uploads');
const { toPagination } = require('../views/paginationView');

const PDF_TIMEOUT_MS = 60 * 1000;
const PDF_MAX_BYTES = 100 * 1024 * 1024;

async function findBookOr404(rawId) {
  const book = await bookModel.findById(parseId(rawId, 'book id'));
  if (!book) {
    throw new HttpError(404, 'This book does not exist or has been removed.', { code: 'BOOK_NOT_FOUND' });
  }
  return book;
}

// Turns the validated genre name into its id, or rejects an unknown genre.
async function withGenreId(input) {
  const genre = await genreModel.findByName(input.genre);
  if (!genre) {
    throw new HttpError(400, 'Please correct the highlighted fields.', {
      code: 'VALIDATION_ERROR',
      errors: { genre: 'Please choose a genre from the list.' },
    });
  }
  return { ...input, genreId: genre.id };
}

// GET /api/books?search=&genre=&sort=&page=&limit=
async function listBooks(req, res) {
  const filters = req.validated;
  const { books, total } = await bookModel.list(filters);
  res.json({ books, pagination: toPagination(filters, total) });
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
// Every reader gets a notification; the book and the notifications are saved
// in one transaction so a failure leaves neither behind.
async function createBook(req, res) {
  const input = await withGenreId(req.validated);
  const { book, notified } = await withTransaction(async (client) => {
    const created = await bookModel.create(input, client);
    const count = await notificationModel.notifyReadersOfNewBook(created, client);
    return { book: created, notified: count };
  });
  res.status(201).json({ book, notifiedReaders: notified, message: `"${book.title}" has been added to the catalogue.` });
}

// PUT /api/books/:id (admin)
async function updateBook(req, res) {
  const before = await findBookOr404(req.params.id);
  const book = await bookModel.update(before.id, await withGenreId(req.validated));
  if (!book) {
    throw new HttpError(404, 'This book does not exist or has been removed.', { code: 'BOOK_NOT_FOUND' });
  }
  // A replaced uploaded cover or PDF is deleted from disk if nothing uses it.
  await removeUnusedUploads([before.coverImageUrl, before.pdfUrl]);
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
  await removeUnusedUploads([book.coverImageUrl, book.pdfUrl]);

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

  // A PDF uploaded to this server is read straight from disk.
  const localFile = localPathFor(book.pdfUrl);
  if (localFile) {
    let stat;
    try {
      stat = await fs.promises.stat(localFile);
    } catch {
      throw pdfError(404, 'The PDF file for this book is missing. Please tell the librarian.', 'PDF_MISSING');
    }
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="booktracker-${book.id}.pdf"`,
      'Content-Length': String(stat.size),
      'Cache-Control': 'private, max-age=3600',
      'Cross-Origin-Resource-Policy': 'cross-origin',
    });
    try {
      await pipeline(fs.createReadStream(localFile), res);
    } catch {
      res.destroy();
    }
    return;
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

module.exports = { listBooks, getBook, createBook, updateBook, deleteBook, streamPdf };
