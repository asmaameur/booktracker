const HttpError = require('../utils/HttpError');
const { parseId } = require('../middleware/validate');
const bookModel = require('../models/bookModel');
const userBookModel = require('../models/userBookModel');
const { toProgress } = require('../views/libraryView');

// Every handler uses req.user.id from the verified login token, never an id
// sent by the client, so readers can only reach their own library.

async function assertBookExists(bookId) {
  if (!(await bookModel.findById(bookId))) {
    throw new HttpError(404, 'This book does not exist or has been removed.', { code: 'BOOK_NOT_FOUND' });
  }
}

function notInLibrary() {
  return new HttpError(404, 'This book is not in your library.', { code: 'NOT_IN_LIBRARY' });
}

// GET /api/library?status=
async function listLibrary(req, res) {
  const [items, counts] = await Promise.all([
    userBookModel.listForUser(req.user.id, req.validated),
    userBookModel.countForUser(req.user.id),
  ]);
  res.json({ items, counts });
}

// POST /api/library
async function addToLibrary(req, res) {
  const { bookId, readingStatus } = req.validated;
  await assertBookExists(bookId);

  let entry;
  try {
    entry = await userBookModel.add(req.user.id, bookId, readingStatus);
  } catch (err) {
    if (err.code === '23505') {
      throw new HttpError(409, 'This book is already in your library.', { code: 'ALREADY_IN_LIBRARY' });
    }
    throw err;
  }
  res.status(201).json({ entry, message: 'Book added to your library.' });
}

// PATCH /api/library/:bookId
async function updateStatus(req, res) {
  const bookId = parseId(req.params.bookId, 'book id');
  const entry = await userBookModel.updateStatus(req.user.id, bookId, req.validated.readingStatus);
  if (!entry) throw notInLibrary();
  res.json({ entry, message: 'Reading status updated.' });
}

// DELETE /api/library/:bookId
async function removeFromLibrary(req, res) {
  const bookId = parseId(req.params.bookId, 'book id');
  if (!(await userBookModel.remove(req.user.id, bookId))) throw notInLibrary();
  res.json({ message: 'Book removed from your library.' });
}

// GET /api/library/:bookId/progress
// Works for any catalogue book: one the reader never opened returns page 0.
async function getProgress(req, res) {
  const bookId = parseId(req.params.bookId, 'book id');
  await assertBookExists(bookId);
  const entry = await userBookModel.findForUser(req.user.id, bookId);
  res.json({ progress: toProgress(bookId, entry) });
}

// PUT /api/library/:bookId/progress
// Adds the book to the reader's library if it is not there yet.
async function saveProgress(req, res) {
  const bookId = parseId(req.params.bookId, 'book id');
  await assertBookExists(bookId);

  let entry;
  try {
    entry = await userBookModel.saveProgress(req.user.id, bookId, req.validated);
  } catch (err) {
    if (err.code === '23514') {
      throw new HttpError(400, 'Current page cannot be greater than the total number of pages.', {
        code: 'VALIDATION_ERROR',
        errors: { currentPage: 'Current page cannot be greater than the total number of pages.' },
      });
    }
    throw err;
  }
  res.json({ progress: toProgress(bookId, entry), message: 'Progress saved.' });
}

module.exports = { listLibrary, addToLibrary, updateStatus, removeFromLibrary, getProgress, saveProgress };
