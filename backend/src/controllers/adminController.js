const HttpError = require('../utils/HttpError');
const { parseId } = require('../middleware/validate');
const bookModel = require('../models/bookModel');
const userModel = require('../models/userModel');
const userBookModel = require('../models/userBookModel');

// GET /api/admin/stats
async function getStats(req, res) {
  const [books, users, library, categories, recentBooks, recentReaders, popularBooks] = await Promise.all([
    bookModel.countAll(),
    userModel.countByRole(),
    userBookModel.countByStatus(),
    bookModel.listCategories(),
    bookModel.findRecent(5),
    userModel.findRecent(5),
    bookModel.findMostAdded(5),
  ]);

  res.json({
    totals: {
      books: books.total,
      booksWithPdf: books.withPdf,
      categories: categories.length,
      users: users.readers + users.admins,
      readers: users.readers,
      verifiedReaders: users.verifiedReaders,
      admins: users.admins,
      readersJoinedLast30Days: users.joinedLast30Days,
      libraryEntries: library.total,
    },
    readingStatus: { toRead: library.toRead, reading: library.reading, read: library.read },
    libraryUpdatesLast7Days: library.updatedLast7Days,
    booksByCategory: categories,
    recentBooks,
    recentReaders,
    popularBooks,
  });
}

// GET /api/admin/users?search=&role=&page=&limit=
async function listUsers(req, res) {
  const filters = req.validated;
  const { users, total } = await userModel.list(filters);
  res.json({
    users,
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / filters.limit)),
    },
  });
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
