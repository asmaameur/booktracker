// Files uploaded by admins (book covers and PDFs), stored on the server's disk
// under backend/uploads/ (or UPLOAD_DIR). Each file gets a random name; the book keeps the
// file's full URL in cover_image_url or pdf_url, like an external link.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const env = require('../config/env');
const { pool } = require('../config/db');

const UPLOAD_ROOT = path.resolve(env.uploadDir);

const KINDS = {
  cover: {
    folder: 'covers',
    maxBytes: 5 * 1024 * 1024,
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    label: 'a JPG, PNG or WebP image',
  },
  avatar: {
    folder: 'avatars',
    maxBytes: 2 * 1024 * 1024,
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    label: 'a JPG, PNG or WebP image',
  },
  pdf: {
    folder: 'pdfs',
    maxBytes: 100 * 1024 * 1024,
    mimeTypes: ['application/pdf'],
    label: 'a PDF file',
  },
};

// Matches the URLs this server hands out, e.g. http://host/uploads/covers/<32 hex>.jpg
const UPLOAD_URL_PATTERN = /\/uploads\/(covers|avatars|pdfs)\/([a-f0-9]{32}\.(?:jpg|png|webp|pdf))$/;

function ensureUploadFolders() {
  for (const { folder } of Object.values(KINDS)) {
    fs.mkdirSync(path.join(UPLOAD_ROOT, folder), { recursive: true });
  }
}

// Identifies the file type from its first bytes, so a renamed file cannot
// pass for an image or a PDF. Returns the file extension, or null.
function detectExtension(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'png';
  }
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return 'webp';
  }
  if (buffer.length >= 5 && buffer.toString('ascii', 0, 5) === '%PDF-') return 'pdf';
  return null;
}

async function saveUpload(kind, buffer) {
  const name = `${crypto.randomBytes(16).toString('hex')}.${detectExtension(buffer)}`;
  const folder = KINDS[kind].folder;
  await fs.promises.writeFile(path.join(UPLOAD_ROOT, folder, name), buffer, { flag: 'wx' });
  return `/uploads/${folder}/${name}`;
}

// The file on disk behind one of our upload URLs, or null for external links.
function localPathFor(url) {
  if (!url) return null;
  let pathname;
  try {
    pathname = new URL(url).pathname;
  } catch {
    return null;
  }
  const match = UPLOAD_URL_PATTERN.exec(pathname);
  return match ? path.join(UPLOAD_ROOT, match[1], match[2]) : null;
}

// Deletes uploaded files that no book uses any more (after a book is edited
// or deleted). External links and files still in use are left alone.
async function removeUnusedUploads(urls, db = pool) {
  for (const url of new Set(urls.filter(Boolean))) {
    const file = localPathFor(url);
    if (!file) continue;
    const { rowCount } = await db.query('SELECT 1 FROM books WHERE cover_image_url = $1 OR pdf_url = $1 LIMIT 1', [url]);
    if (rowCount === 0) {
      await fs.promises.unlink(file).catch(() => {});
    }
  }
}

// Deletes one uploaded file (for example a replaced profile picture).
async function deleteUpload(url) {
  const file = localPathFor(url);
  if (file) await fs.promises.unlink(file).catch(() => {});
}

module.exports = { deleteUpload, UPLOAD_ROOT, KINDS, ensureUploadFolders, detectExtension, saveUpload, localPathFor, removeUnusedUploads };
