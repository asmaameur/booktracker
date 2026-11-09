const { withTransaction } = require('../config/db');
const HttpError = require('../utils/HttpError');
const { parseId } = require('../middleware/validate');
const bookModel = require('../models/bookModel');
const reviewModel = require('../models/reviewModel');
const notificationModel = require('../models/notificationModel');

async function assertBookExists(bookId) {
  const book = await bookModel.findById(bookId);
  if (!book) {
    throw new HttpError(404, 'This book does not exist or has been removed.', { code: 'BOOK_NOT_FOUND' });
  }
  return book;
}

// Loads a review and checks it belongs to the current reader. Another
// reader's review answers 403, so nobody can edit or delete it.
async function findOwnReview(rawId, userId) {
  const review = await reviewModel.findById(parseId(rawId, 'review id'));
  if (!review) {
    throw new HttpError(404, 'This review does not exist or has been deleted.', { code: 'REVIEW_NOT_FOUND' });
  }
  if (review.userId !== userId) {
    throw new HttpError(403, 'You can only change your own reviews.', { code: 'FORBIDDEN' });
  }
  return review;
}

// GET /api/books/:id/reviews (any)
// All reviews, the rating summary, and the current user's own review (or null).
async function listReviews(req, res) {
  const bookId = parseId(req.params.id, 'book id');
  await assertBookExists(bookId);
  const [reviews, summary] = await Promise.all([
    reviewModel.listForBook(bookId),
    reviewModel.summaryForBook(bookId),
  ]);
  const myReview = reviews.find((review) => review.userId === req.user.id) || null;
  res.json({ summary, reviews, myReview });
}

// POST /api/books/:id/reviews (reader)
// Every admin is notified of the new rating. The review and the notifications
// are saved in one transaction, so a failure leaves neither behind.
async function createReview(req, res) {
  const bookId = parseId(req.params.id, 'book id');
  const book = await assertBookExists(bookId);

  let review;
  try {
    review = await withTransaction(async (client) => {
      const created = await reviewModel.create(req.user.id, bookId, req.validated, client);
      await notificationModel.notifyAdminsOfReview({ review: created, book, readerName: req.user.name }, client);
      return created;
    });
  } catch (err) {
    if (err.code === '23505') {
      throw new HttpError(409, 'You have already reviewed this book. Edit your review instead.', {
        code: 'REVIEW_EXISTS',
      });
    }
    throw err;
  }
  res.status(201).json({ review, summary: await reviewModel.summaryForBook(bookId), message: 'Thank you for your review.' });
}

// PUT /api/reviews/:id (reader, own review only)
async function updateReview(req, res) {
  const existing = await findOwnReview(req.params.id, req.user.id);
  const review = await reviewModel.updateOwn(existing.id, req.user.id, req.validated);
  res.json({ review, summary: await reviewModel.summaryForBook(existing.bookId), message: 'Your review has been updated.' });
}

// DELETE /api/reviews/:id
// Readers: their own review only. Admins: any review (moderation); its author
// gets a notification with the optional reason, in the same transaction.
async function deleteReview(req, res) {
  if (req.user.role !== 'admin') {
    const existing = await findOwnReview(req.params.id, req.user.id);
    await reviewModel.removeOwn(existing.id, req.user.id);
    res.json({ summary: await reviewModel.summaryForBook(existing.bookId), message: 'Your review has been deleted.' });
    return;
  }

  const review = await reviewModel.findById(parseId(req.params.id, 'review id'));
  if (!review) {
    throw new HttpError(404, 'This review does not exist or has been deleted.', { code: 'REVIEW_NOT_FOUND' });
  }
  const book = await bookModel.findById(review.bookId);
  await withTransaction(async (client) => {
    await reviewModel.removeById(review.id, client);
    await notificationModel.notifyReviewRemoved({ review, book, reason: req.validated.reason }, client);
  });
  res.json({
    summary: await reviewModel.summaryForBook(review.bookId),
    message: `${review.userName}'s review has been removed and they have been notified.`,
  });
}

module.exports = { listReviews, createReview, updateReview, deleteReview };
