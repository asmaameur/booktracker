const { optionalText, text, toInteger, isBlank } = require('./rules');
const { REVIEW_SORTS } = require('../../models/reviewModel');

const COMMENT_MAX = 2000;

// A rating from 1 to 5 stars, with an optional comment.
function review(body) {
  const errors = {};
  const rating = toInteger(body.rating);
  const comment = optionalText(body.comment);

  if (Number.isNaN(rating) || rating < 1 || rating > 5) {
    errors.rating = 'Please choose a rating from 1 to 5 stars.';
  }
  if (comment && comment.length > COMMENT_MAX) {
    errors.comment = `Your comment must be ${COMMENT_MAX} characters or fewer.`;
  }

  return { errors, value: { rating, comment } };
}

const REASON_MAX = 500;

// DELETE /api/reviews/:id { reason } — the reason is optional and only used
// when an admin removes someone else's review.
function removal(body) {
  const errors = {};
  const reason = optionalText(body.reason);
  if (reason && reason.length > REASON_MAX) {
    errors.reason = `The reason must be ${REASON_MAX} characters or fewer.`;
  }
  return { errors, value: { reason } };
}

// GET /api/books/:id/reviews?sort=&page=&limit=
function listQuery(query) {
  const errors = {};
  const value = { sort: text(query.sort) || 'newest', page: 1, limit: 10 };
  if (!REVIEW_SORTS.includes(value.sort)) errors.sort = `Sort must be one of: ${REVIEW_SORTS.join(', ')}.`;
  if (!isBlank(query.page)) {
    const page = toInteger(query.page);
    if (Number.isNaN(page) || page < 1) errors.page = 'Page must be a positive whole number.';
    else value.page = page;
  }
  if (!isBlank(query.limit)) {
    const limit = toInteger(query.limit);
    if (Number.isNaN(limit) || limit < 1 || limit > 50) errors.limit = 'Limit must be between 1 and 50.';
    else value.limit = limit;
  }
  return { errors, value };
}

module.exports = { review, removal, listQuery, COMMENT_MAX, REASON_MAX };
