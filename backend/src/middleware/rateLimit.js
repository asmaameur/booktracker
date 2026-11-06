const { rateLimit } = require('express-rate-limit');
const env = require('../config/env');

// Slows down password guessing and email spamming on the public auth routes.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.authRateLimitMax,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    message: 'Too many attempts. Please wait a few minutes and try again.',
    code: 'RATE_LIMITED',
  },
});

module.exports = { authLimiter };
