const env = require('../config/env');
const { sendMail } = require('../config/mailer');
const tokenModel = require('../models/verificationTokenModel');
const { generateEmailToken, hashEmailToken } = require('../utils/security');
const { verificationEmail, emailChangeEmail } = require('../views/emailView');

function verificationLink(token) {
  return `${env.clientUrls[0]}/verify-email?token=${token}`;
}

// Replaces any previous token for this address with a fresh one and stores
// only its hash. Returns the raw token, which must go out by email only.
async function createToken(userId, email, db) {
  await tokenModel.deleteForEmail(userId, email, db);
  const token = generateEmailToken();
  const expiresAt = new Date(Date.now() + env.emailTokenTtlHours * 60 * 60 * 1000);
  await tokenModel.create({ userId, tokenHash: hashEmailToken(token), email, expiresAt }, db);
  return token;
}

// Sends the link to `email`. `purpose` is "signup" for a new account or
// "email-change" when an existing user confirms a new address.
// Returns false instead of throwing when the email could not be delivered,
// so the account change is kept and the user can ask for a new link.
async function sendVerificationEmail({ user, email, token, purpose }) {
  const build = purpose === 'email-change' ? emailChangeEmail : verificationEmail;
  const message = build({ name: user.name, link: verificationLink(token), hours: env.emailTokenTtlHours });
  try {
    await sendMail({ to: email, ...message });
    return true;
  } catch (err) {
    console.error(`Could not send the verification email to ${email}:`, err.message);
    return false;
  }
}

module.exports = { createToken, sendVerificationEmail };
