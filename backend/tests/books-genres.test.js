const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setup, teardown, createUser, createBook, api } = require('./helpers');

let admin;
let reader;

before(async () => {
  await setup();
  admin = await createUser({ role: 'admin' });
  reader = await createUser();
});
after(teardown);

test('lists the 12 genres with book counts', async () => {
  const { status, data } = await api('GET', '/genres', { token: reader.token });
  assert.equal(status, 200);
  assert.equal(data.genres.length, 12);
  assert.ok(data.genres.every((g) => typeof g.count === 'number'));
});

test('a book needs a known genre', async () => {
  const missing = await api('POST', '/books', { token: admin.token, body: { title: 'X', author: 'Y' } });
  assert.equal(missing.status, 400);
  assert.ok(missing.data.errors.genre);

  const unknown = await api('POST', '/books', { token: admin.token, body: { title: 'X', author: 'Y', genre: 'Cooking' } });
  assert.equal(unknown.status, 400);
  assert.ok(unknown.data.errors.genre);
});

test('only admins add or edit books', async () => {
  const create = await api('POST', '/books', { token: reader.token, body: { title: 'X', author: 'Y', genre: 'Fiction' } });
  assert.equal(create.status, 403);

  const book = await createBook(admin.token, { genre: 'Mystery' });
  const edit = await api('PUT', `/books/${book.id}`, {
    token: reader.token,
    body: { title: 'Hacked', author: 'Y', genre: 'Fiction' },
  });
  assert.equal(edit.status, 403);
});

test('admins change a book genre, and books can be filtered by genre', async () => {
  const book = await createBook(admin.token, { genre: 'Mystery' });
  assert.equal(book.genre, 'Mystery');
  assert.equal(book.averageRating, null);
  assert.equal(book.ratingCount, 0);

  const edit = await api('PUT', `/books/${book.id}`, {
    token: admin.token,
    body: { title: book.title, author: book.author, genre: 'Thriller' },
  });
  assert.equal(edit.status, 200);
  assert.equal(edit.data.book.genre, 'Thriller');

  const filtered = await api('GET', '/books?genre=thriller', { token: reader.token });
  assert.equal(filtered.status, 200);
  assert.ok(filtered.data.books.length >= 1);
  assert.ok(filtered.data.books.every((b) => b.genre === 'Thriller'));
});

test('sorts and searches still work, including sort by rating', async () => {
  for (const sort of ['newest', 'oldest', 'title', 'author', 'year', 'rating']) {
    const { status } = await api('GET', `/books?sort=${sort}&search=test&genre=Fiction`, { token: reader.token });
    assert.equal(status, 200, `sort=${sort}`);
  }
  const bad = await api('GET', '/books?sort=popularity', { token: reader.token });
  assert.equal(bad.status, 400);
});

test('the admin dashboard counts books by genre', async () => {
  const { status, data } = await api('GET', '/admin/stats', { token: admin.token });
  assert.equal(status, 200);
  assert.ok(data.booksByGenre.length >= 1);
  assert.ok(data.booksByGenre.every((g) => g.count > 0));
  assert.ok(Array.isArray(data.latestReviews));
  assert.ok(Array.isArray(data.topRatedBooks));
  assert.equal(typeof data.totals.readersJoinedLast7Days, 'number');
});

test('"Most shelved" counts the readers who have each book', async () => {
  const book = await createBook(admin.token, { title: 'Popular Pick' });
  const second = await createUser();
  await api('POST', '/library', { token: reader.token, body: { bookId: book.id } });
  await api('POST', '/library', { token: second.token, body: { bookId: book.id } });
  const { data } = await api('GET', '/admin/stats', { token: admin.token });
  const popular = data.popularBooks.find((b) => b.id === book.id);
  assert.equal(popular.readerCount, 2);
});

test('"Lowest rated" only lists books averaging under 3 stars', async () => {
  const liked = await createBook(admin.token);
  const disliked = await createBook(admin.token);
  await api('POST', `/books/${liked.id}/reviews`, { token: reader.token, body: { rating: 5 } });
  await api('POST', `/books/${disliked.id}/reviews`, { token: reader.token, body: { rating: 2 } });
  const { data } = await api('GET', '/admin/stats', { token: admin.token });
  assert.deepEqual(
    data.lowestRatedBooks.map((b) => b.id),
    [disliked.id]
  );
  assert.equal(data.topRatedBooks[0].id, liked.id);
});
