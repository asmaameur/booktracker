const fs = require('fs');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setup, teardown, createUser, createBook, api } = require('./helpers');
const { localPathFor } = require('../src/utils/uploads');

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 7)]);
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 8)]);

let reader;
let admin;

before(async () => {
  await setup();
  reader = await createUser({ name: 'Profile Reader' });
  admin = await createUser({ role: 'admin' });
});
after(teardown);

const patch = (body, who = reader) => api('PATCH', '/profile', { token: who.token, body });

// 'YYYY-MM-DD' for a birthday `years` years ago today (plus `days`).
function yearsAgo(years, days = 0) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

test('date of birth is saved as given and the age is calculated', async () => {
  const birthday = yearsAgo(30);
  const res = await patch({ birthDate: birthday });
  assert.equal(res.status, 200);
  assert.equal(res.data.user.birthDate, birthday, 'no time-zone shift');
  assert.equal(res.data.user.age, 30);

  const tomorrow = await patch({ birthDate: yearsAgo(30, 1) });
  assert.equal(tomorrow.data.user.age, 29, 'birthday not reached yet this year');

  const profile = await api('GET', '/profile', { token: reader.token });
  assert.equal(profile.data.user.age, 29);
});

test('invalid dates and ages are refused', async () => {
  for (const birthDate of ['2020-02-30', '31/12/1990', 'soon', yearsAgo(3), yearsAgo(130), yearsAgo(-1)]) {
    const res = await patch({ birthDate });
    assert.equal(res.status, 400, birthDate);
    assert.ok(res.data.errors.birthDate, birthDate);
  }
});

test('date of birth can be removed, and is not shown to admins', async () => {
  await patch({ birthDate: yearsAgo(40) });
  const list = await api('GET', '/admin/users', { token: admin.token });
  const account = list.data.users.find((u) => u.id === reader.user.id);
  assert.ok(account);
  assert.equal('birthDate' in account, false);
  assert.equal('age' in account, false);

  const cleared = await patch({ birthDate: '' });
  assert.equal(cleared.status, 200);
  assert.equal(cleared.data.user.birthDate, null);
  assert.equal(cleared.data.user.age, null);
});

test('a profile picture is uploaded, replaced and removed', async () => {
  const first = await api('POST', '/profile/avatar', { token: reader.token, file: PNG, type: 'image/png' });
  assert.equal(first.status, 201);
  const firstUrl = first.data.user.avatarUrl;
  assert.match(firstUrl, /\/uploads\/avatars\/[a-f0-9]{32}\.png$/);
  const image = await fetch(firstUrl);
  assert.equal(image.status, 200);
  assert.equal(image.headers.get('cross-origin-resource-policy'), 'cross-origin');

  const second = await api('POST', '/profile/avatar', { token: reader.token, file: JPG, type: 'image/jpeg' });
  assert.equal(second.status, 201);
  assert.equal(fs.existsSync(localPathFor(firstUrl)), false, 'the old picture is deleted');

  const removed = await api('DELETE', '/profile/avatar', { token: reader.token });
  assert.equal(removed.data.user.avatarUrl, null);
  assert.equal(fs.existsSync(localPathFor(second.data.user.avatarUrl)), false);
});

test('profile pictures are checked and limited to 2 MB', async () => {
  const fake = await api('POST', '/profile/avatar', { token: reader.token, file: Buffer.from('<svg/>'), type: 'image/png' });
  assert.equal(fake.status, 400);
  const big = await api('POST', '/profile/avatar', {
    token: reader.token,
    file: Buffer.concat([PNG, Buffer.alloc(3 * 1024 * 1024)]),
    type: 'image/png',
  });
  assert.equal(big.status, 413);
  assert.equal((await api('POST', '/profile/avatar', { file: PNG, type: 'image/png' })).status, 401);
});

test('admins can have a profile picture too, and reviews show the reviewer’s picture', async () => {
  assert.equal((await api('POST', '/profile/avatar', { token: admin.token, file: PNG, type: 'image/png' })).status, 201);

  const avatar = await api('POST', '/profile/avatar', { token: reader.token, file: PNG, type: 'image/png' });
  const book = await createBook(admin.token);
  await api('POST', `/books/${book.id}/reviews`, { token: reader.token, body: { rating: 4 } });
  const { data } = await api('GET', `/books/${book.id}/reviews`, { token: admin.token });
  assert.equal(data.reviews[0].userAvatarUrl, avatar.data.user.avatarUrl);
});
