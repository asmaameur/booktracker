const { text, toInteger, isBlank } = require('./rules');
const { READING_STATUSES } = require('../../models/userBookModel');

const STATUS_MESSAGE = `Reading status must be one of: ${READING_STATUSES.join(', ')}.`;

function addBook(body) {
  const errors = {};
  const bookId = toInteger(body.bookId);
  const readingStatus = text(body.readingStatus) || 'to_read';

  if (Number.isNaN(bookId) || bookId < 1) errors.bookId = 'A valid book id is required.';
  if (!READING_STATUSES.includes(readingStatus)) errors.readingStatus = STATUS_MESSAGE;

  return { errors, value: { bookId, readingStatus } };
}

function updateStatus(body) {
  const errors = {};
  const readingStatus = text(body.readingStatus);
  if (!READING_STATUSES.includes(readingStatus)) errors.readingStatus = STATUS_MESSAGE;
  return { errors, value: { readingStatus } };
}

function listQuery(query) {
  const errors = {};
  const status = text(query.status);
  if (status && !READING_STATUSES.includes(status)) errors.status = STATUS_MESSAGE;
  return { errors, value: { status: status || null } };
}

function progress(body) {
  const errors = {};
  const currentPage = toInteger(body.currentPage);
  let totalPages = null;

  if (Number.isNaN(currentPage) || currentPage < 1) {
    errors.currentPage = 'Current page must be a whole number of at least 1.';
  }
  if (!isBlank(body.totalPages)) {
    totalPages = toInteger(body.totalPages);
    if (Number.isNaN(totalPages) || totalPages < 1) {
      errors.totalPages = 'Total pages must be a whole number of at least 1.';
    } else if (!errors.currentPage && currentPage > totalPages) {
      errors.currentPage = 'Current page cannot be greater than the total number of pages.';
    }
  }

  return { errors, value: { currentPage, totalPages } };
}

module.exports = { addBook, updateStatus, listQuery, progress };
