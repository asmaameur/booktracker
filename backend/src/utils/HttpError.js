// An error with an HTTP status that is safe to show to the client.
// `code` lets the frontend react to specific cases (for example TOKEN_EXPIRED),
// and `errors` maps form field names to messages.
class HttpError extends Error {
  constructor(status, message, { code, errors, details } = {}) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.errors = errors;
    this.details = details;
  }
}

module.exports = HttpError;
