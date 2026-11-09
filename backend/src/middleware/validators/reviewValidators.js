const { optionalText, toInteger } = require('./rules');

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

module.exports = { review, removal, COMMENT_MAX, REASON_MAX };
