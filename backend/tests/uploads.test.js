const fs = require('fs');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setup, teardown, createUser, api } = require('./helpers');
const { localPathFor } = require('../src/utils/uploads');

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)]);
const PNG_2 = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 2)]);
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 3)]);
const PDF = Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n');

let admin;
let reader;

before(async () => {
  await setup();
  admin = await createUser({ role: 'admin' });
  reader = await createUser();
});
after(teardown);

const upload = (kind, file, type, token = admin.token) => api('POST', `/uploads/${kind}`, { token, file, type });

test('only admins upload', async () => {
  assert.equal((await upload('cover', PNG, 'image/png', reader.token)).status, 403);
  assert.equal((await upload('cover', PNG, 'image/png', null)).status, 401);
});

test('files are checked by their contents, type and size', async () => {
  const fake = await upload('cover', Buffer.from('not an image at all'), 'image/png');
  assert.equal(fake.status, 400);
  assert.equal(fake.data.code, 'INVALID_FILE');
  assert.equal((await upload('cover', PNG, 'text/plain')).status, 400);
  assert.equal((await upload('cover', PDF, 'image/png')).status, 400, 'a PDF is not a cover');
  assert.equal((await upload('pdf', PNG, 'application/pdf')).status, 400, 'an image is not a PDF');

  const huge = await upload('cover', Buffer.concat([PNG, Buffer.alloc(6 * 1024 * 1024)]), 'image/png');
  assert.equal(huge.status, 413);
  assert.equal(huge.data.code, 'FILE_TOO_LARGE');
});

test('covers are public images; PDFs only open through the API, behind login', async () => {
  const cover = await upload('cover', JPG, 'image/jpeg');
  assert.equal(cover.status, 201);
  assert.match(cover.data.url, /\/uploads\/covers\/[a-f0-9]{32}\.jpg$/);
  const image = await fetch(cover.data.url);
  assert.equal(image.status, 200);
  assert.equal(image.headers.get('cross-origin-resource-policy'), 'cross-origin');
  assert.ok(Buffer.from(await image.arrayBuffer()).equals(JPG));

  const pdf = await upload('pdf', PDF, 'application/pdf');
  assert.equal(pdf.status, 201);
  assert.equal((await fetch(pdf.data.url)).status, 404, 'not served publicly');

  const book = (
    await api('POST', '/books', {
      token: admin.token,
      body: { title: 'Uploaded', author: 'A', genre: 'Technology', coverImageUrl: cover.data.url, pdfUrl: pdf.data.url },
    })
  ).data.book;

  const read = await api('GET', `/books/${book.id}/pdf`, { token: reader.token });
  assert.equal(read.status, 200);
  assert.equal(read.headers.get('content-type'), 'application/pdf');
  assert.ok(Buffer.from(await read.res.arrayBuffer()).equals(PDF));
  assert.equal((await api('GET', `/books/${book.id}/pdf`)).status, 401);
});

test('replaced and deleted files are removed from disk, files still in use are kept', async () => {
  const first = (await upload('cover', PNG, 'image/png')).data.url;
  const second = (await upload('cover', PNG_2, 'image/png')).data.url;
  const pdf = (await upload('pdf', PDF, 'application/pdf')).data.url;
  const body = { title: 'Changing', author: 'A', genre: 'Fiction', coverImageUrl: first, pdfUrl: pdf };
  const book = (await api('POST', '/books', { token: admin.token, body })).data.book;

  await api('PUT', `/books/${book.id}`, { token: admin.token, body: { ...body, coverImageUrl: second } });
  assert.equal(fs.existsSync(localPathFor(first)), false, 'old cover deleted');
  assert.equal(fs.existsSync(localPathFor(pdf)), true, 'PDF still used');

  assert.equal((await api('DELETE', `/books/${book.id}`, { token: admin.token })).status, 200);
  assert.equal(fs.existsSync(localPathFor(second)), false);
  assert.equal(fs.existsSync(localPathFor(pdf)), false);
});
