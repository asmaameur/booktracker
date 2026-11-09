const { withTransaction } = require('../config/db');
const HttpError = require('../utils/HttpError');
const { parseId } = require('../middleware/validate');
const bookModel = require('../models/bookModel');
const reviewModel = require('../models/reviewModel');
const notificationModel = require('../models/notificationModel');
const { toPagination } = require('../views/paginationView');

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

// GET /api/books/:id/reviews?sort=&page=&limit= (any)
// One page of the other readers' reviews, the rating summary, and the current
// user's own review (or null), which is never part of the pages.
async function listReviews(req, res) {
  const bookId = parseId(req.params.id, 'book id');
  await assertBookExists(bookId);
  const filters = req.validated;
  const [{ reviews, total }, summary, myReview] = await Promise.all([
    reviewModel.listForBook(bookId, req.user.id, filters),
    reviewModel.summaryForBook(bookId),
    reviewModel.findForUserAndBook(req.user.id, bookId),
  ]);
  res.json({ summary, reviews, myReview, pagination: toPagination(filters, total) });
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

// PUT /api/reviews/:id/helpful and DELETE /api/reviews/:id/helpful (reader)
// Marks another reader's review as helpful, or takes the vote back.
function helpfulVote(add) {
  return async function vote(req, res) {
    const review = await reviewModel.findById(parseId(req.params.id, 'review id'), req.user.id);
    if (!review) {
      throw new HttpError(404, 'This review does not exist or has been deleted.', { code: 'REVIEW_NOT_FOUND' });
    }
    if (review.userId === req.user.id) {
      throw new HttpError(400, 'You cannot vote for your own review.', { code: 'CANNOT_VOTE_OWN_REVIEW' });
    }
    if (add) await reviewModel.addVote(review.id, req.user.id);
    else await reviewModel.removeVote(review.id, req.user.id);
    const updated = await reviewModel.findById(review.id, req.user.id);
    res.json({ helpfulCount: updated.helpfulCount, votedByMe: updated.votedByMe });
  };
}

module.exports = {
  listReviews,
  createReview,
  updateReview,
  deleteReview,
  markHelpful: helpfulVote(true),
  unmarkHelpful: helpfulVote(false),
};
