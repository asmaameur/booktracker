const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setup, teardown, createUser, createBook, api } = require('./helpers');

let admin;
let reader;
let other;
const year = new Date().getFullYear();
const month = new Date().getMonth();

before(async () => {
  await setup();
  admin = await createUser({ role: 'admin' });
  reader = await createUser();
  other = await createUser();
});
after(teardown);

const stats = async (who) => (await api('GET', '/stats/reading', { token: who.token })).data.stats;

test('an empty year has no goal and zero everywhere', async () => {
  const s = await stats(reader);
  assert.equal(s.year, year);
  assert.equal(s.goal, null);
  assert.equal(s.finishedThisYear, 0);
  assert.equal(s.byMonth.length, 12);
  assert.equal(s.pages.lastWeek.length, 7);
  assert.equal(s.pages.thisWeek, 0);
});

test('a yearly goal is validated, set, changed and removed', async () => {
  for (const target of [0, 1001, 'ten', 2.5]) {
    const { status } = await api('PUT', '/stats/goal', { token: reader.token, body: { target } });
    assert.equal(status, 400, `target ${target}`);
  }
  const set = await api('PUT', '/stats/goal', { token: reader.token, body: { target: 4 } });
  assert.equal(set.status, 200);
  assert.deepEqual(set.data.stats.goal, { target: 4, finished: 0, percent: 0 });

  const changed = await api('PUT', '/stats/goal', { token: reader.token, body: { target: 2 } });
  assert.equal(changed.data.stats.goal.target, 2);
  assert.equal((await stats(other)).goal, null, 'goals are per reader');
});

test('finishing books counts towards this month and the goal', async () => {
  const a = await createBook(admin.token, { genre: 'Mystery' });
  const b = await createBook(admin.token, { genre: 'Mystery' });
  await api('POST', '/library', { token: reader.token, body: { bookId: a.id, readingStatus: 'read' } });
  await api('POST', '/library', { token: reader.token, body: { bookId: b.id } });
  await api('PATCH', `/library/${b.id}`, { token: reader.token, body: { readingStatus: 'read' } });

  const s = await stats(reader);
  assert.equal(s.finishedThisYear, 2);
  assert.equal(s.byMonth[month], 2);
  assert.deepEqual(s.goal, { target: 2, finished: 2, percent: 100 });
  assert.deepEqual(s.topGenres[0], { name: 'Mystery', count: 2 });
  assert.equal(s.recentlyFinished.length, 2);

  // Moving a book back to "reading" takes it out of the finished count.
  await api('PATCH', `/library/${b.id}`, { token: reader.token, body: { readingStatus: 'reading' } });
  assert.equal((await stats(reader)).finishedThisYear, 1);
});

test('pages read are counted from saved progress, forward only', async () => {
  const book = await createBook(admin.token);
  const save = (currentPage) =>
    api('PUT', `/library/${book.id}/progress`, { token: reader.token, body: { currentPage, totalPages: 300 } });
  await save(20);
  await save(50);
  await save(30); // going back is not reading
  await save(40); // 10 more pages
  const s = await stats(reader);
  assert.equal(s.pages.thisWeek, 60);
  assert.equal(s.pages.lastWeek.at(-1).pages, 60);
  assert.equal((await stats(other)).pages.thisWeek, 0);
});

test('stats are for readers only, and the goal can be removed', async () => {
  assert.equal((await api('GET', '/stats/reading', { token: admin.token })).status, 403);
  const removed = await api('DELETE', '/stats/goal', { token: reader.token });
  assert.equal(removed.status, 200);
  assert.equal(removed.data.stats.goal, null);
});
