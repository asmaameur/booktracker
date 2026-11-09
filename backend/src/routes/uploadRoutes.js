const { Router } = require('express');
const controller = require('../controllers/uploadController');
const { authenticate, authorize } = require('../middleware/auth');
const { rawUpload } = require('../middleware/rawUpload');

const router = Router();

// Only admins upload book files. The login check runs before the body is read.
router.use(authenticate, authorize('admin'));

router.post('/cover', rawUpload('cover'), controller.uploadCover);
router.post('/pdf', rawUpload('pdf'), controller.uploadPdf);

module.exports = router;
