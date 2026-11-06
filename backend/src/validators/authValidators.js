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
  if (value.name === undefined && value.email === undefined) {
    errors.name = 'Provide a new name or email address to update.';
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

module.exports = { register, login, emailOnly, verifyEmail, updateProfile, changePassword };
