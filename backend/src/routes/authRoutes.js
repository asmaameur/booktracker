const { Router } = require('express');
const controller = require('../controllers/authController');
const validators = require('../validators/authValidators');
const { validate } = require('../middleware/validate');
const { authLimiter } = require('../middleware/rateLimit');

const router = Router();

router.use(authLimiter);

router.post('/register', validate(validators.register), controller.register);
router.post('/login', validate(validators.login), controller.login);
router.post('/verify-email', validate(validators.verifyEmail), controller.verifyEmail);
router.post('/resend-verification', validate(validators.emailOnly), controller.resendVerification);

module.exports = router;
