const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setup, teardown, createUser, createBook, api } = require('./helpers');

let admin;
let alice;
let bob;

before(async () => {
  await setup();
  admin = await createUser({ role: 'admin' });
  alice = await createUser({ name: 'Alice' });
  bob = await createUser({ name: 'Bob' });
});
after(teardown);

const unread = async (who) => (await api('GET', '/notifications/unread-count', { token: who.token })).data.unreadCount;

test('a new book notifies every reader, not admins', async () => {
  const before = { alice: await unread(alice), bob: await unread(bob), admin: await unread(admin) };
  const res = await api('POST', '/books', {
    token: admin.token,
    body: { title: 'Fresh Arrival', author: 'New Author', genre: 'Fantasy', coverImageUrl: 'https://example.com/c.jpg' },
  });
  assert.equal(res.status, 201);
  assert.equal(res.data.notifiedReaders, 2);

  assert.equal(await unread(alice), before.alice + 1);
  assert.equal(await unread(bob), before.bob + 1);
  assert.equal(await unread(admin), before.admin);

  const { data } = await api('GET', '/notifications', { token: alice.token });
  const note = data.notifications.find((n) => n.book?.id === res.data.book.id);
  assert.equal(note.type, 'new_book');
  assert.equal(note.book.title, 'Fresh Arrival');
  assert.equal(note.book.coverImageUrl, 'https://example.com/c.jpg');
  assert.equal(note.isRead, false);
});

test('a new rating notifies admins with the reader, stars and comment; edits do not', async () => {
  const book = await createBook(admin.token);
  const before = await unread(admin);
  const created = await api('POST', `/books/${book.id}/reviews`, { token: alice.token, body: { rating: 5, comment: 'Superb.' } });
  assert.equal(await unread(admin), before + 1);

  const { data } = await api('GET', '/notifications?unread=true', { token: admin.token });
  const note = data.notifications.find((n) => n.type === 'new_review' && n.book.id === book.id);
  assert.match(note.message, /Alice rated ".+" 5 stars\. “Superb\.”/);

  await api('PUT', `/reviews/${created.data.review.id}`, { token: alice.token, body: { rating: 4 } });
  assert.equal(await unread(admin), before + 1);
  assert.equal((await api('GET', '/notifications', { token: bob.token })).data.notifications.some((n) => n.type === 'new_review'), false);
});

test('users only read and mark their own notifications', async () => {
  const { data } = await api('GET', '/notifications', { token: alice.token });
  const note = data.notifications[0];

  assert.equal((await api('PATCH', `/notifications/${note.id}/read`, { token: bob.token })).status, 404);
  assert.equal((await api('PATCH', `/notifications/${note.id}/read`, { token: admin.token })).status, 404);

  const before = await unread(alice);
  const mark = await api('PATCH', `/notifications/${note.id}/read`, { token: alice.token });
  assert.equal(mark.status, 200);
  assert.equal(mark.data.unreadCount, before - 1);

  const all = await api('PATCH', '/notifications/read-all', { token: alice.token });
  assert.equal(all.data.unreadCount, 0);
  assert.equal(await unread(alice), 0);
  assert.ok((await unread(bob)) > 0, 'Bob’s notifications are untouched');
});

test('notifications need a login', async () => {
  assert.equal((await api('GET', '/notifications')).status, 401);
});
