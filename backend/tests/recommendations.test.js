const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setup, teardown, createUser, createBook, api } = require('./helpers');

let admin;
let reader;
const books = {};

before(async () => {
  await setup();
  admin = await createUser({ role: 'admin' });
  reader = await createUser();
  books.horror1 = await createBook(admin.token, { genre: 'Horror', title: 'Horror One' });
  books.horror2 = await createBook(admin.token, { genre: 'Horror', title: 'Horror Two' });
  books.thriller = await createBook(admin.token, { genre: 'Thriller', title: 'Thriller One' });
  books.romance1 = await createBook(admin.token, { genre: 'Romance', title: 'Romance One' });
  books.romance2 = await createBook(admin.token, { genre: 'Romance', title: 'Romance Two' });
  books.fiction = await createBook(admin.token, { genre: 'Fiction', title: 'Fiction One' });
});
after(teardown);

test('favourite genres are validated, saved and cleared', async () => {
  const unknown = await api('PUT', '/preferences/genres', { token: reader.token, body: { genres: ['Cooking'] } });
  assert.equal(unknown.status, 400);
  const notList = await api('PUT', '/preferences/genres', { token: reader.token, body: { genres: 'Horror' } });
  assert.equal(notList.status, 400);

  const saved = await api('PUT', '/preferences/genres', { token: reader.token, body: { genres: ['Thriller', 'horror'] } });
  assert.equal(saved.status, 200);
  assert.deepEqual((await api('GET', '/preferences/genres', { token: reader.token })).data.genres, ['Horror', 'Thriller']);

  await api('PUT', '/preferences/genres', { token: reader.token, body: { genres: [] } });
  assert.deepEqual((await api('GET', '/preferences/genres', { token: reader.token })).data.genres, []);
});

test('without favourite genres, the reader is invited to choose some', async () => {
  const { data } = await api('GET', '/recommendations', { token: reader.token });
  assert.equal(data.hasPreferences, false);
  assert.ok(data.books.length > 0);
});

test('favourite genres come first, and books already read come last', async () => {
  await api('PUT', '/preferences/genres', { token: reader.token, body: { genres: ['Horror', 'Thriller'] } });
  await api('POST', '/library', { token: reader.token, body: { bookId: books.horror1.id, readingStatus: 'read' } });

  const { data } = await api('GET', '/recommendations?limit=24', { token: reader.token });
  assert.equal(data.hasPreferences, true);
  const titles = data.books.map((b) => b.title);
  assert.deepEqual(new Set(titles.slice(0, 2)), new Set(['Horror Two', 'Thriller One']));
  assert.equal(titles.at(-1), 'Horror One');
  assert.match(data.books[0].recommendation.reason, /^Because you like/);
  assert.equal(data.books.at(-1).recommendation.alreadyInLibrary, true);
});

test('low ratings push a genre down', async () => {
  const other = await createUser();
  await api('POST', `/books/${books.romance1.id}/reviews`, { token: other.token, body: { rating: 1 } });
  const { data } = await api('GET', '/recommendations?limit=24', { token: other.token });
  const titles = data.books.map((b) => b.title);
  assert.ok(titles.indexOf('Romance Two') > titles.indexOf('Fiction One'));
});

test('“Readers also liked” uses shared fans first, then the same genre', async () => {
  const fans = [await createUser(), await createUser()];
  for (const fan of fans) {
    await api('POST', `/books/${books.horror2.id}/reviews`, { token: fan.token, body: { rating: 5 } });
    await api('POST', `/books/${books.romance2.id}/reviews`, { token: fan.token, body: { rating: 4 } });
  }
  const { status, data } = await api('GET', `/books/${books.horror2.id}/similar`, { token: reader.token });
  assert.equal(status, 200);
  assert.equal(data.basedOnReaders, true);
  assert.equal(data.books[0].title, 'Romance Two');
  assert.equal(data.books[0].similarity.sharedFans, 2);
  assert.ok(data.books.some((b) => b.title === 'Horror One'), 'same genre fills the list');
  assert.ok(data.books.every((b) => b.id !== books.horror2.id));

  const lonely = await api('GET', `/books/${books.thriller.id}/similar`, { token: reader.token });
  assert.equal(lonely.data.basedOnReaders, false);
  assert.equal((await api('GET', '/books/999999/similar', { token: reader.token })).status, 404);
});
