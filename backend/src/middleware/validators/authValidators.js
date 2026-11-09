const { text, normalizeEmail, isEmail, passwordProblem, isBlank } = require('./rules');

function validateName(name, errors) {
  if (name.length < 2 || name.length > 100) {
    errors.name = 'Name must be between 2 and 100 characters.';
  }
}

function register(body) {
  const errors = {};
  const name = text(body.name);
  const email = normalizeEmail(body.email);
  const password = typeof body.password === 'string' ? body.password : '';

  validateName(name, errors);
  if (!isEmail(email)) errors.email = 'Please enter a valid email address.';
  const problem = passwordProblem(password);
  if (problem) errors.password = problem;

  return { errors, value: { name, email, password } };
}

function login(body) {
  const errors = {};
  const email = normalizeEmail(body.email);
  const password = typeof body.password === 'string' ? body.password : '';

  if (!isEmail(email)) errors.email = 'Please enter a valid email address.';
  if (!password) errors.password = 'Please enter your password.';

  return { errors, value: { email, password } };
}

function emailOnly(body) {
  const errors = {};
  const email = normalizeEmail(body.email);
  if (!isEmail(email)) errors.email = 'Please enter a valid email address.';
  return { errors, value: { email } };
}

function verifyEmail(body) {
  const errors = {};
  const token = text(body.token);
  if (!/^[a-f0-9]{64}$/.test(token)) errors.token = 'This verification link is invalid.';
  return { errors, value: { token } };
}

const MIN_AGE = 5;
const MAX_AGE = 120;

// A real calendar date giving an age between MIN_AGE and MAX_AGE.
function birthDateProblem(raw) {
  if (isBlank(raw)) return null;
  const value = text(raw);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return 'Please enter a valid date of birth.';
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return 'Please enter a valid date of birth.';
  }
  const today = new Date();
  let age = today.getFullYear() - year;
  if (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day)) age -= 1;
  if (age < MIN_AGE || age > MAX_AGE) {
    return `Your age must be between ${MIN_AGE} and ${MAX_AGE} years.`;
  }
  return null;
}

function updateProfile(body) {
  const errors = {};
  const value = {};

  if (!isBlank(body.name)) {
    value.name = text(body.name);
    validateName(value.name, errors);
  }
  if (!isBlank(body.email)) {
    value.email = normalizeEmail(body.email);
    if (!isEmail(value.email)) errors.email = 'Please enter a valid email address.';
  }
  if (typeof body.currentPassword === 'string' && body.currentPassword) {
    value.currentPassword = body.currentPassword;
  }
  // Date of birth: 'YYYY-MM-DD', or null / '' to remove it.
  if (body.birthDate !== undefined) {
    const problem = birthDateProblem(body.birthDate);
    if (problem) errors.birthDate = problem;
    else value.birthDate = isBlank(body.birthDate) ? null : text(body.birthDate);
  }
  if (value.name === undefined && value.email === undefined && value.birthDate === undefined) {
    errors.name = 'Provide a new name, email address or date of birth to update.';
  }

  return { errors, value };
}

function changePassword(body) {
  const errors = {};
  const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

  if (!currentPassword) errors.currentPassword = 'Please enter your current password.';
  const problem = passwordProblem(newPassword);
  if (problem) errors.newPassword = problem;
  else if (newPassword === currentPassword) {
    errors.newPassword = 'Your new password must be different from the current one.';
  }

  return { errors, value: { currentPassword, newPassword } };
}

// POST /api/auth/reset-password { token, password }
function resetPassword(body) {
  const errors = {};
  const token = text(body.token);
  const password = typeof body.password === 'string' ? body.password : '';

  if (!/^[a-f0-9]{64}$/.test(token)) errors.token = 'This reset link is invalid.';
  const problem = passwordProblem(password);
  if (problem) errors.password = problem;

  return { errors, value: { token, password } };
}

module.exports = { register, login, emailOnly, verifyEmail, updateProfile, changePassword, resetPassword };
