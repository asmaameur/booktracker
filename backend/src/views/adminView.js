const { toPublicUser } = require('./userView');

// GET /api/admin/stats: the dashboard figures, built from the model queries.
function toStats({ books, users, library, genres, recentBooks, recentReaders, popularBooks, activity }) {
  return {
    totals: {
      books: books.total,
      booksWithPdf: books.withPdf,
      genres: genres.filter((genre) => genre.count > 0).length,
      users: users.readers + users.admins,
      readers: users.readers,
      verifiedReaders: users.verifiedReaders,
      admins: users.admins,
      readersJoinedLast30Days: users.joinedLast30Days,
      readersJoinedLast7Days: users.joinedLast7Days,
      reviewsLast7Days: activity.reviewsLast7Days,
      libraryEntries: library.total,
    },
    readingStatus: { toRead: library.toRead, reading: library.reading, read: library.read },
    libraryUpdatesLast7Days: library.updatedLast7Days,
    // Only genres that have books, for the dashboard chart.
    booksByGenre: genres.filter((genre) => genre.count > 0).map(({ name, count }) => ({ name, count })),
    recentBooks,
    recentReaders: recentReaders.map(toPublicUser),
    popularBooks,
    // Recent reader activity and the best / lowest rated books.
    latestReviews: activity.latestReviews,
    topRatedBooks: activity.topRatedBooks,
    lowestRatedBooks: activity.lowestRatedBooks,
  };
}

// One row of the admin's accounts list: the account and how many books it has
// on its shelves.
function toAccount(user) {
  return { ...toPublicUser(user), libraryCount: user.libraryCount };
}

module.exports = { toStats, toAccount };
