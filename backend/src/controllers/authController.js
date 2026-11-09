const { withTransaction } = require('../config/db');
const HttpError = require('../utils/HttpError');
const userModel = require('../models/userModel');
const tokenModel = require('../models/verificationTokenModel');
const { hashPassword, comparePassword, hashEmailToken, issueSession } = require('../utils/security');
const { createToken, sendVerificationEmail } = require('../services/emailVerification');
const resetTokenModel = require('../models/passwordResetTokenModel');
const { createResetToken, sendPasswordResetEmail, RESET_TOKEN_TTL_MINUTES } = require('../services/passwordReset');
const { toPublicUser } = require('../views/userView');

const RESEND_COOLDOWN_MS = 60 * 1000;

// POST /api/auth/register
async function register(req, res) {
  const { name, email, password } = req.validated;

  if (await userModel.findByEmail(email)) {
    throw new HttpError(409, 'An account with this email already exists.', {
      code: 'EMAIL_TAKEN',
      errors: { email: 'An account with this email already exists.' },
    });
  }

  const passwordHash = await hashPassword(password);
  const { user, token } = await withTransaction(async (client) => {
    const created = await userModel.create({ name, email, passwordHash }, client);
    return { user: created, token: await createToken(created.id, email, client) };
  });

  const emailSent = await sendVerificationEmail({ user, email, token, purpose: 'signup' });

  res.status(201).json({
    message: emailSent
      ? `Your account has been created. We sent a verification link to ${email}.`
      : 'Your account has been created, but we could not send the verification email. Please request a new link.',
    emailSent,
    user: toPublicUser(user),
  });
}

// POST /api/auth/verify-email
async function verifyEmail(req, res) {
  const tokenHash = hashEmailToken(req.validated.token);

  const { user, purpose } = await withTransaction(async (client) => {
    const record = await tokenModel.findByHash(tokenHash, client);
    if (!record) {
      throw new HttpError(400, 'This verification link is invalid or has already been used.', {
        code: 'INVALID_VERIFICATION_TOKEN',
      });
    }
    if (record.expiresAt <= new Date()) {
      throw new HttpError(400, 'This verification link has expired. Please request a new one.', {
        code: 'VERIFICATION_TOKEN_EXPIRED',
      });
    }

    const current = await userModel.findById(record.userId, client);
    const isEmailChange = record.email !== current.email;
    if (isEmailChange && (await userModel.findByEmail(record.email, client))) {
      throw new HttpError(409, 'This email address is now used by another account.', { code: 'EMAIL_TAKEN' });
    }

    const verified = await userModel.markVerified(current.id, record.email, client);
    await tokenModel.deleteAllForUser(current.id, client);
    return { user: verified, purpose: isEmailChange ? 'email-change' : 'signup' };
  });

  res.json({
    message:
      purpose === 'email-change'
        ? 'Your new email address is confirmed.'
        : 'Your email address is verified. You can now log in.',
    purpose,
    user: toPublicUser(user),
  });
}

// POST /api/auth/resend-verification
// Always answers the same way so it cannot be used to discover which emails
// have accounts.
async function resendVerification(req, res) {
  const { email } = req.validated;
  const user = await userModel.findByEmail(email);

  if (user && !user.isVerified) {
    const latest = await tokenModel.findLatestForEmail(user.id, email);
    const sentRecently = latest && Date.now() - latest.createdAt.getTime() < RESEND_COOLDOWN_MS;
    if (!sentRecently) {
      const token = await createToken(user.id, email);
      await sendVerificationEmail({ user, email, token, purpose: 'signup' });
    }
  }

  res.json({
    message: 'If an unverified account exists for this email, a new verification link is on its way.',
  });
}

// POST /api/auth/login
async function login(req, res) {
  const { email, password } = req.validated;
  const user = await userModel.findByEmailWithPassword(email);
  const passwordMatches = await comparePassword(password, user && user.passwordHash);

  if (!user || !passwordMatches) {
    throw new HttpError(401, 'Incorrect email or password.', { code: 'INVALID_CREDENTIALS' });
  }
  if (!user.isVerified) {
    throw new HttpError(403, 'Please verify your email address before logging in. Check your inbox for the link.', {
      code: 'EMAIL_NOT_VERIFIED',
    });
  }

  res.json({ ...issueSession(user), user: toPublicUser(user) });
}

// POST /api/auth/forgot-password
// Always answers the same way so it cannot be used to discover which emails
// have accounts. A new link is sent at most once a minute per account.
async function forgotPassword(req, res) {
  const { email } = req.validated;
  const user = await userModel.findByEmail(email);

  if (user) {
    const latest = await resetTokenModel.findLatestForUser(user.id);
    const sentRecently = latest && Date.now() - latest.createdAt.getTime() < RESEND_COOLDOWN_MS;
    if (!sentRecently) {
      const token = await createResetToken(user.id);
      await sendPasswordResetEmail({ user, token });
    }
  }

  res.json({
    message: `If an account exists for ${email}, we sent it a link to choose a new password. The link is valid for ${RESET_TOKEN_TTL_MINUTES} minutes.`,
  });
}

// POST /api/auth/reset-password
// Sets the new password, signs the account out everywhere (older login
// tokens stop working) and uses up the link. Opening the emailed link also
// proves the address belongs to the user, so the account counts as verified.
async function resetPassword(req, res) {
  const { token, password } = req.validated;
  const passwordHash = await hashPassword(password);

  await withTransaction(async (client) => {
    const record = await resetTokenModel.findByHash(hashEmailToken(token), client);
    if (!record) {
      throw new HttpError(400, 'This reset link is invalid or has already been used. Please request a new one.', {
        code: 'INVALID_RESET_TOKEN',
      });
    }
    if (record.expiresAt <= new Date()) {
      await resetTokenModel.deleteAllForUser(record.userId, client);
      throw new HttpError(400, 'This reset link has expired. Please request a new one.', {
        code: 'RESET_TOKEN_EXPIRED',
      });
    }

    const user = await userModel.findById(record.userId, client);
    await userModel.updatePassword(user.id, passwordHash, new Date(), client);
    if (!user.isVerified) await userModel.markVerified(user.id, user.email, client);
    await resetTokenModel.deleteAllForUser(user.id, client);
  });

  res.json({ message: 'Your password has been changed. You can now log in with your new password.' });
}

module.exports = { register, verifyEmail, resendVerification, login, forgotPassword, resetPassword };
