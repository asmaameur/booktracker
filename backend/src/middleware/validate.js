const HttpError = require('../utils/HttpError');

// Runs a validator on req.body (or req.query) and stores the cleaned input in
// req.validated. Rejects the request with 400 and per-field messages if needed.
function validate(validator, source = 'body') {
  return (req, res, next) => {
    const { errors, value } = validator(req[source] || {});
    if (Object.keys(errors).length > 0) {
      throw new HttpError(400, 'Please correct the highlighted fields.', { code: 'VALIDATION_ERROR', errors });
    }
    req.validated = value;
    next();
  };
}

// Reads a positive integer route parameter such as :id or :bookId.
function parseId(raw, label = 'id') {
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1 || id > 2147483647) {
    throw new HttpError(400, `Invalid ${label}.`, { code: 'INVALID_ID' });
  }
  return id;
}

module.exports = { validate, parseId };
