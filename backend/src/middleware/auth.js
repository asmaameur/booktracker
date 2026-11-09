const HttpError = require('../utils/HttpError');
const { verifyAccessToken } = require('../utils/security');
const userModel = require('../models/userModel');

// Requires a valid "Authorization: Bearer <token>" header from a verified
// account, and loads the current user from the database into req.user so that
// role or verification changes take effect immediately.
async function authenticate(req, res, next) {
  const [scheme, token] = (req.get('Authorization') || '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw new HttpError(401, 'Please log in to continue.', { code: 'AUTH_REQUIRED' });
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new HttpError(401, 'Your session has expired. Please log in again.', { code: 'TOKEN_EXPIRED' });
    }
    throw new HttpError(401, 'Your session is not valid. Please log in again.', { code: 'INVALID_TOKEN' });
  }

  const user = await userModel.findById(Number(payload.sub));
  if (!user) {
    throw new HttpError(401, 'Your session is not valid. Please log in again.', { code: 'INVALID_TOKEN' });
  }

  if (user.passwordChangedAt && !(payload.issuedAtMs >= user.passwordChangedAt.getTime())) {
    throw new HttpError(401, 'Your password was changed. Please log in again.', { code: 'TOKEN_REVOKED' });
  }

  if (!user.isVerified) {
    throw new HttpError(403, 'Please verify your email address to continue.', { code: 'EMAIL_NOT_VERIFIED' });
  }

  req.user = user;
  next();
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new HttpError(403, 'You do not have permission to do this.', { code: 'FORBIDDEN' });
    }
    next();
  };
}

module.exports = { authenticate, authorize };
