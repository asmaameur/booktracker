const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const env = require('./config/env');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { UPLOAD_ROOT, ensureUploadFolders } = require('./utils/uploads');

const app = express();

ensureUploadFolders();

app.use(helmet());
app.use(cors({ origin: env.clientUrls }));
app.use(express.json({ limit: '100kb' }));

// Uploaded covers are public images (the frontend runs on another origin, so
// they need a cross-origin resource policy). Uploaded PDFs are not served
// here: readers get them through GET /api/books/:id/pdf, behind login.
app.use(
  '/uploads/covers',
  express.static(path.join(UPLOAD_ROOT, 'covers'), {
    immutable: true,
    maxAge: '30d',
    setHeaders: (res) => res.set('Cross-Origin-Resource-Policy', 'cross-origin'),
  })
);

// Profile pictures are public images too.
app.use(
  '/uploads/avatars',
  express.static(path.join(UPLOAD_ROOT, 'avatars'), {
    immutable: true,
    maxAge: '30d',
    setHeaders: (res) => res.set('Cross-Origin-Resource-Policy', 'cross-origin'),
  })
);

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
