const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');

const BCRYPT_ROUNDS = 12;

// Compared against when an email is unknown, so a failed login takes the same
// time whether or not the account exists.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('booktracker-timing-guard', BCRYPT_ROUNDS);

function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

function comparePassword(password, hash) {
  return bcrypt.compare(password, hash || DUMMY_PASSWORD_HASH);
}

function generateEmailToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashEmailToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// `issuedAtMs` is compared with users.password_changed_at; the standard `iat`
// claim only has one-second precision.
function signAccessToken(user) {
  return jwt.sign({ sub: String(user.id), role: user.role, issuedAtMs: Date.now() }, env.jwt.secret, {
    algorithm: 'HS256',
    expiresIn: env.jwt.expiresIn,
  });
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.jwt.secret, { algorithms: ['HS256'] });
}

// What the client receives after logging in or changing its password.
function issueSession(user) {
  const token = signAccessToken(user);
  const { exp } = jwt.decode(token);
  return { token, expiresAt: new Date(exp * 1000).toISOString() };
}

module.exports = {
  hashPassword,
  comparePassword,
  generateEmailToken,
  hashEmailToken,
  verifyAccessToken,
  issueSession,
};
