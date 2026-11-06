const { Router } = require('express');
const controller = require('../controllers/profileController');
const validators = require('../validators/authValidators');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');

const router = Router();

// Both roles manage their own profile.
router.use(authenticate);

router.get('/', controller.getProfile);
router.patch('/', validate(validators.updateProfile), controller.updateProfile);
router.put('/password', validate(validators.changePassword), controller.changePassword);

module.exports = router;
