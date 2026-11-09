const { Router } = require('express');
const controller = require('../controllers/profileController');
const validators = require('../middleware/validators/authValidators');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { rawUpload } = require('../middleware/rawUpload');

const router = Router();

// Both roles manage their own profile.
router.use(authenticate);

router.get('/', controller.getProfile);
router.patch('/', validate(validators.updateProfile), controller.updateProfile);
router.put('/password', validate(validators.changePassword), controller.changePassword);

// Profile picture: the image itself is the request body (JPG, PNG or WebP, 2 MB max).
router.post('/avatar', rawUpload('avatar'), controller.uploadAvatar);
router.delete('/avatar', controller.removeAvatar);

module.exports = router;
