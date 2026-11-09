const HttpError = require('../utils/HttpError');
const { parseId } = require('../middleware/validate');
const bookModel = require('../models/bookModel');
const userModel = require('../models/userModel');
const userBookModel = require('../models/userBookModel');
const genreModel = require('../models/genreModel');
const { toStats, toAccount } = require('../views/adminView');
const { toPagination } = require('../views/paginationView');

// GET /api/admin/stats
async function getStats(req, res) {
  const [books, users, library, genres, recentBooks, recentReaders, popularBooks] = await Promise.all([
    bookModel.countAll(),
    userModel.countByRole(),
    userBookModel.countByStatus(),
    genreModel.listWithCounts(),
    bookModel.findRecent(5),
    userModel.findRecent(5),
    bookModel.findMostAdded(5),
  ]);

  res.json(toStats({ books, users, library, genres, recentBooks, recentReaders, popularBooks }));
}

// GET /api/admin/users?search=&role=&page=&limit=
async function listUsers(req, res) {
  const filters = req.validated;
  const { users, total } = await userModel.list(filters);
  res.json({ users: users.map(toAccount), pagination: toPagination(filters, total) });
}

// DELETE /api/admin/users/:id
// Only reader accounts can be deleted, so the library can never be left
// without an administrator.
async function deleteUser(req, res) {
  const id = parseId(req.params.id, 'user id');
  const user = await userModel.findById(id);
  if (!user) {
    throw new HttpError(404, 'This account does not exist or has already been deleted.', { code: 'USER_NOT_FOUND' });
  }
  if (user.id === req.user.id) {
    throw new HttpError(400, 'You cannot delete your own account.', { code: 'CANNOT_DELETE_SELF' });
  }
  if (user.role === 'admin') {
    throw new HttpError(403, 'Administrator accounts cannot be deleted here.', { code: 'CANNOT_DELETE_ADMIN' });
  }

  const { total: removedLibraryEntries } = await userBookModel.countForUser(user.id);
  await userModel.remove(user.id);

  res.json({ message: `${user.name}'s account has been deleted.`, removedLibraryEntries });
}

module.exports = { getStats, listUsers, deleteUser };
