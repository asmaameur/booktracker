// A reader's progress in one book. A book that is not in their library yet
// answers page 0.
function toProgress(bookId, entry) {
  return {
    bookId,
    inLibrary: Boolean(entry),
    readingStatus: entry ? entry.readingStatus : null,
    currentPage: entry ? entry.currentPage : 0,
    totalPages: entry ? entry.totalPages : null,
    progressPercent: entry ? entry.progressPercent : 0,
    updatedAt: entry ? entry.updatedAt : null,
  };
}

module.exports = { toProgress };
