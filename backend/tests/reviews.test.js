const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setup, teardown, createUser, createBook, api } = require('./helpers');

let admin;
let alice;
let bob;
let carol;
let book;

before(async () => {
  await setup();
  admin = await createUser({ role: 'admin' });
  alice = await createUser({ name: 'Alice' });
  bob = await createUser({ name: 'Bob' });
  carol = await createUser({ name: 'Carol' });
  book = await createBook(admin.token);
});
after(teardown);

const post = (who, body, bookId = book.id) => api('POST', `/books/${bookId}/reviews`, { token: who.token, body });

test('ratings must be from 1 to 5, comments are optional', async () => {
  for (const rating of [0, 6, 'abc', 3.5]) {
    const { status, data } = await post(alice, { rating });
    assert.equal(status, 400, `rating ${rating}`);
    assert.ok(data.errors.rating);
  }
});

test('one review per reader per book; the average comes from the database', async () => {
  const a = await post(alice, { rating: 5, comment: 'Wonderful.' });
  assert.equal(a.status, 201);
  assert.equal(a.data.summary.averageRating, 5);

  const again = await post(alice, { rating: 4 });
  assert.equal(again.status, 409);
  assert.equal(again.data.code, 'REVIEW_EXISTS');

  const b = await post(bob, { rating: 2 });
  assert.equal(b.data.summary.averageRating, 3.5);
  assert.equal(b.data.summary.ratingCount, 2);

  const details = await api('GET', `/books/${book.id}`, { token: carol.token });
  assert.equal(details.data.book.averageRating, 3.5);
  assert.equal(details.data.book.ratingCount, 2);
});

test('admins cannot post reviews', async () => {
  const { status } = await post(admin, { rating: 1 });
  assert.equal(status, 403);
});

test('readers edit and delete only their own review', async () => {
  const mine = (await api('GET', `/books/${book.id}/reviews`, { token: alice.token })).data.myReview;
  assert.equal(mine.userName, 'Alice');

  assert.equal((await api('PUT', `/reviews/${mine.id}`, { token: bob.token, body: { rating: 1 } })).status, 403);
  assert.equal((await api('DELETE', `/reviews/${mine.id}`, { token: bob.token })).status, 403);

  const edit = await api('PUT', `/reviews/${mine.id}`, { token: alice.token, body: { rating: 4, comment: '' } });
  assert.equal(edit.status, 200);
  assert.equal(edit.data.review.comment, null);
  assert.equal(edit.data.summary.averageRating, 3);
});

test('reviews are paged and sorted, without the reader’s own review', async () => {
  const other = await createBook(admin.token);
  const readers = [alice, bob, carol];
  for (const [i, who] of readers.entries()) await post(who, { rating: i + 2 }, other.id);

  const page1 = await api('GET', `/books/${other.id}/reviews?sort=highest&limit=1`, { token: alice.token });
  assert.equal(page1.status, 200);
  assert.equal(page1.data.myReview.userName, 'Alice');
  assert.equal(page1.data.pagination.total, 2, 'Alice’s own review is not in the pages');
  assert.equal(page1.data.reviews.length, 1);
  assert.equal(page1.data.reviews[0].rating, 4);

  const page2 = await api('GET', `/books/${other.id}/reviews?sort=highest&limit=1&page=2`, { token: alice.token });
  assert.equal(page2.data.reviews[0].rating, 3);

  const lowest = await api('GET', `/books/${other.id}/reviews?sort=lowest`, { token: admin.token });
  assert.deepEqual(
    lowest.data.reviews.map((r) => r.rating),
    [2, 3, 4]
  );

  const bad = await api('GET', `/books/${other.id}/reviews?sort=random`, { token: alice.token });
  assert.equal(bad.status, 400);
});

test('readers mark other readers’ reviews as helpful, once, and can take it back', async () => {
  const other = await createBook(admin.token);
  const review = (await post(bob, { rating: 5, comment: 'Read it!' }, other.id)).data.review;

  const own = await api('PUT', `/reviews/${review.id}/helpful`, { token: bob.token });
  assert.equal(own.status, 400);
  assert.equal(own.data.code, 'CANNOT_VOTE_OWN_REVIEW');

  await api('PUT', `/reviews/${review.id}/helpful`, { token: alice.token });
  const twice = await api('PUT', `/reviews/${review.id}/helpful`, { token: alice.token });
  assert.deepEqual(twice.data, { helpfulCount: 1, votedByMe: true });
  await api('PUT', `/reviews/${review.id}/helpful`, { token: carol.token });

  const sorted = await api('GET', `/books/${other.id}/reviews?sort=helpful`, { token: alice.token });
  assert.equal(sorted.data.reviews[0].helpfulCount, 2);
  assert.equal(sorted.data.reviews[0].votedByMe, true);

  const undo = await api('DELETE', `/reviews/${review.id}/helpful`, { token: alice.token });
  assert.deepEqual(undo.data, { helpfulCount: 1, votedByMe: false });

  assert.equal((await api('PUT', `/reviews/${review.id}/helpful`, { token: admin.token })).status, 403);
});

test('admins remove any review, and its author is told why', async () => {
  const other = await createBook(admin.token);
  const review = (await post(carol, { rating: 1, comment: 'Spam spam' }, other.id)).data.review;

  const tooLong = await api('DELETE', `/reviews/${review.id}`, { token: admin.token, body: { reason: 'x'.repeat(501) } });
  assert.equal(tooLong.status, 400);

  const removed = await api('DELETE', `/reviews/${review.id}`, {
    token: admin.token,
    body: { reason: 'Reviews must be about the book.' },
  });
  assert.equal(removed.status, 200);
  assert.equal(removed.data.summary.ratingCount, 0);

  const notes = await api('GET', '/notifications?unread=true', { token: carol.token });
  const note = notes.data.notifications.find((n) => n.type === 'review_removed');
  assert.ok(note);
  assert.match(note.message, /Reviews must be about the book\./);
  assert.equal(note.book.id, other.id);

  assert.equal((await api('DELETE', `/reviews/${review.id}`, { token: admin.token })).status, 404);
});

test('deleting a book deletes its reviews', async () => {
  const other = await createBook(admin.token);
  const review = (await post(alice, { rating: 4 }, other.id)).data.review;
  assert.equal((await api('DELETE', `/books/${other.id}`, { token: admin.token })).status, 200);
  assert.equal((await api('PUT', `/reviews/${review.id}`, { token: alice.token, body: { rating: 5 } })).status, 404);
});
