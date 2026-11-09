const express = require('express');
const HttpError = require('../utils/HttpError');
const { KINDS } = require('../utils/uploads');

// Reads an uploaded file (the raw request body) for one kind of upload
// (cover, avatar or pdf), with that kind's allowed types and size limit.
function rawUpload(kind) {
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

module.exports = { rawUpload };
