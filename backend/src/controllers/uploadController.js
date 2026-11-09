const HttpError = require('../utils/HttpError');
const { KINDS, detectExtension, saveUpload } = require('../utils/uploads');

// POST /api/uploads/cover and /api/uploads/pdf (admin)
// The file is the raw request body, with its Content-Type (image/jpeg,
// image/png, image/webp or application/pdf). Answers with the URL to put in
// the book's coverImageUrl or pdfUrl field.
function uploadHandler(kind) {
  const { label } = KINDS[kind];
  return async function upload(req, res) {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      throw new HttpError(400, `Please choose ${label}.`, { code: 'INVALID_FILE' });
    }
    const extension = detectExtension(req.body);
    const valid = kind === 'pdf' ? extension === 'pdf' : ['jpg', 'png', 'webp'].includes(extension);
    if (!valid) {
      throw new HttpError(400, `This file is not ${label}.`, { code: 'INVALID_FILE' });
    }

    const relative = await saveUpload(kind, req.body);
    // An absolute URL, so it works like any external link in the frontend.
    const url = `${req.protocol}://${req.get('host')}${relative}`;
    res.status(201).json({ url, size: req.body.length, message: 'File uploaded.' });
  };
}

module.exports = { uploadCover: uploadHandler('cover'), uploadPdf: uploadHandler('pdf') };
