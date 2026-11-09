// Small helpers shared by the validators. Each validator returns
// `{ errors, value }`: `errors` maps field names to messages, and `value` is
// the cleaned-up input that controllers use instead of the raw request.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function optionalText(value) {
  const cleaned = text(value);
  return cleaned === '' ? null : cleaned;
}

function normalizeEmail(value) {
  return text(value).toLowerCase();
}

function isEmail(value) {
  return value.length <= 255 && EMAIL_PATTERN.test(value);
}

function passwordProblem(password) {
  if (typeof password !== 'string' || password.length < 8) {
    return 'Password must be at least 8 characters long.';
  }
  // bcrypt only uses the first 72 bytes of a password.
  if (Buffer.byteLength(password, 'utf8') > 72) {
    return 'Password is too long (72 characters maximum).';
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return 'Password must contain at least one letter and one number.';
  }
  return null;
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// Accepts numbers and numeric strings (HTML forms send strings).
function toInteger(value) {
  if (typeof value === 'number') return Number.isInteger(value) ? value : NaN;
  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) return Number(value.trim());
  return NaN;
}

function isBlank(value) {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

module.exports = {
  text,
  optionalText,
  normalizeEmail,
  isEmail,
  passwordProblem,
  isHttpUrl,
  toInteger,
  isBlank,
};
