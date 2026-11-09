const express = require('express');
const controller = require('../controllers/uploadController');
const { authenticate, authorize } = require('../middleware/auth');
const { KINDS } = require('../utils/uploads');
const HttpError = require('../utils/HttpError');

const router = express.Router();

// Only admins upload files. The login check runs before the body is read.
router.use(authenticate, authorize('admin'));

function rawBody(kind) {
  const { mimeTypes, maxBytes } = KINDS[kind];
  const parse = express.raw({ type: mimeTypes, limit: maxBytes });
  // A clearer message than the generic "request body is too large".
  return (req, res, next) =>
    parse(req, res, (err) => {
      if (err?.type === 'entity.too.large') {
        const mb = Math.round(maxBytes / 1024 / 1024);
        next(new HttpError(413, `This file is too large. The limit is ${mb} MB.`, { code: 'FILE_TOO_LARGE' }));
        return;
      }
      next(err);
    });
}

router.post('/cover', rawBody('cover'), controller.uploadCover);
router.post('/pdf', rawBody('pdf'), controller.uploadPdf);

module.exports = router;
