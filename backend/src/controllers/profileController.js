const { withTransaction } = require('../config/db');
const HttpError = require('../utils/HttpError');
const userModel = require('../models/userModel');
const tokenModel = require('../models/verificationTokenModel');
const { hashPassword, comparePassword, issueSession } = require('../utils/security');
const { createToken, sendVerificationEmail } = require('../services/emailVerification');
const { toPublicUser } = require('../views/userView');
const { detectExtension, saveUpload, deleteUpload } = require('../utils/uploads');

async function profilePayload(user) {
  const pending = await tokenModel.findPendingEmailChange(user.id, user.email);
  return { user: toPublicUser(user), pendingEmail: pending ? pending.email : null };
}

async function assertCurrentPassword(userId, currentPassword) {
  const user = await userModel.findByIdWithPassword(userId);
  if (!(await comparePassword(currentPassword, user.passwordHash))) {
    throw new HttpError(400, 'Your current password is incorrect.', {
      code: 'INCORRECT_PASSWORD',
      errors: { currentPassword: 'Your current password is incorrect.' },
    });
  }
}

// GET /api/profile
async function getProfile(req, res) {
  res.json(await profilePayload(req.user));
}

// PATCH /api/profile
// A new email address only replaces the current one after the user clicks the
// link sent to it, so a typo can never lock them out of their account.
async function updateProfile(req, res) {
  const { name, email, currentPassword, birthDate } = req.validated;
  const wantsNewEmail = email !== undefined && email !== req.user.email;

  if (wantsNewEmail) {
    if (!currentPassword) {
      throw new HttpError(400, 'Please enter your current password to change your email address.', {
        code: 'VALIDATION_ERROR',
        errors: { currentPassword: 'Enter your current password to change your email address.' },
      });
    }
    await assertCurrentPassword(req.user.id, currentPassword);
    if (await userModel.findByEmail(email)) {
      throw new HttpError(409, 'This email address is already used by another account.', {
        code: 'EMAIL_TAKEN',
        errors: { email: 'This email address is already used by another account.' },
      });
    }
  }

  let user = req.user;
  if (name !== undefined && name !== user.name) {
    user = await userModel.updateName(user.id, name);
  }
  if (birthDate !== undefined && birthDate !== user.birthDate) {
    user = await userModel.updateBirthDate(user.id, birthDate);
  }

  let message = 'Your profile has been updated.';
  let emailSent = null;
  if (wantsNewEmail) {
    const token = await withTransaction(async (client) => {
      await tokenModel.deleteEmailChanges(user.id, user.email, client);
      return createToken(user.id, email, client);
    });
    emailSent = await sendVerificationEmail({ user, email, token, purpose: 'email-change' });
    message = emailSent
      ? `We sent a confirmation link to ${email}. Your email address will change once you confirm it.`
      : 'We could not send the confirmation email to your new address. Please try again.';
  }

  res.json({ ...(await profilePayload(user)), message, emailSent });
}

// PUT /api/profile/password
// Login tokens issued before the change stop working, so other devices are
// signed out; this device gets a fresh token in the response.
async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.validated;
  await assertCurrentPassword(req.user.id, currentPassword);

  const passwordHash = await hashPassword(newPassword);
  const user = await userModel.updatePassword(req.user.id, passwordHash, new Date());

  res.json({
    message: 'Your password has been changed. Other devices have been signed out.',
    ...issueSession(user),
    user: toPublicUser(user),
  });
}

// POST /api/profile/avatar — the image is the raw request body (JPG, PNG or
// WebP, up to 2 MB). Replaces the previous picture, whose file is deleted.
async function uploadAvatar(req, res) {
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    throw new HttpError(400, 'Please choose a JPG, PNG or WebP image.', { code: 'INVALID_FILE' });
  }
  if (!['jpg', 'png', 'webp'].includes(detectExtension(req.body))) {
    throw new HttpError(400, 'This file is not a JPG, PNG or WebP image.', { code: 'INVALID_FILE' });
  }
  const previous = req.user.avatarUrl;
  const relative = await saveUpload('avatar', req.body);
  const user = await userModel.updateAvatar(req.user.id, `${req.protocol}://${req.get('host')}${relative}`);
  await deleteUpload(previous);
  res.status(201).json({ ...(await profilePayload(user)), message: 'Your profile picture has been updated.' });
}

// DELETE /api/profile/avatar
async function removeAvatar(req, res) {
  const previous = req.user.avatarUrl;
  const user = await userModel.updateAvatar(req.user.id, null);
  await deleteUpload(previous);
  res.json({ ...(await profilePayload(user)), message: 'Your profile picture has been removed.' });
}

module.exports = { getProfile, updateProfile, changePassword, uploadAvatar, removeAvatar };
