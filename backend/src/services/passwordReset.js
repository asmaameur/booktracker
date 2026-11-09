const env = require('../config/env');
const { sendMail } = require('../config/mailer');
const resetTokenModel = require('../models/passwordResetTokenModel');
const { generateEmailToken, hashEmailToken } = require('../utils/security');
const { passwordResetEmail } = require('../views/emailView');

// Reset links are short-lived: they give full access to the account.
const RESET_TOKEN_TTL_MINUTES = 60;

function resetLink(token) {
  return `${env.clientUrls[0]}/reset-password?token=${token}`;
}

// Replaces any previous reset link for this user and stores only its hash.
// Returns the raw token, which must go out by email only.
async function createResetToken(userId, db) {
  await resetTokenModel.deleteAllForUser(userId, db);
  const token = generateEmailToken();
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);
  await resetTokenModel.create({ userId, tokenHash: hashEmailToken(token), expiresAt }, db);
  return token;
}

// Returns false instead of throwing when the email could not be delivered.
async function sendPasswordResetEmail({ user, token }) {
  const message = passwordResetEmail({ name: user.name, link: resetLink(token), minutes: RESET_TOKEN_TTL_MINUTES });
  try {
    await sendMail({ to: user.email, ...message });
    return true;
  } catch (err) {
    console.error(`Could not send the password reset email to ${user.email}:`, err.message);
    return false;
  }
}

module.exports = { createResetToken, sendPasswordResetEmail, RESET_TOKEN_TTL_MINUTES };
