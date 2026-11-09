const HttpError = require('../utils/HttpError');
const env = require('../config/env');

// PostgreSQL error codes that come from bad input rather than a server bug.
const PG_ERRORS = {
  23505: { status: 409, message: 'This record already exists.', code: 'DUPLICATE' },
  23503: { status: 409, message: 'This action conflicts with related records.', code: 'CONFLICT' },
  23514: { status: 400, message: 'Some of the values are not allowed.', code: 'VALIDATION_ERROR' },
  '22P02': { status: 400, message: 'Some of the values have the wrong format.', code: 'VALIDATION_ERROR' },
  22003: { status: 400, message: 'A number is out of the allowed range.', code: 'VALIDATION_ERROR' },
};

function notFound(req, res) {
  res.status(404).json({ message: `Route ${req.method} ${req.originalUrl} does not exist.`, code: 'NOT_FOUND' });
}

// Express recognises an error handler by its four parameters, so `next` must
// stay in the signature even though it is unused.
function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    res.destroy();
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.status).json({
      message: err.message,
      ...(err.code && { code: err.code }),
      ...(err.errors && { errors: err.errors }),
      ...(err.details && err.details),
    });
    return;
  }

  if (err.type === 'entity.parse.failed') {
    res.status(400).json({ message: 'The request body is not valid JSON.', code: 'INVALID_JSON' });
    return;
  }
  if (err.type === 'entity.too.large') {
    res.status(413).json({ message: 'The request body is too large.', code: 'PAYLOAD_TOO_LARGE' });
    return;
  }

  const pgError = PG_ERRORS[err.code];
  if (pgError) {
    res.status(pgError.status).json({ message: pgError.message, code: pgError.code });
    return;
  }

  console.error(err);
  res.status(500).json({
    message: 'Something went wrong on our side. Please try again.',
    code: 'SERVER_ERROR',
    ...(!env.isProduction && { debug: err.message }),
  });
}

module.exports = { notFound, errorHandler };
