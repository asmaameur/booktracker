const { text, optionalText, isHttpUrl, toInteger, isBlank } = require('./rules');

const SORTS = ['newest', 'oldest', 'title', 'author', 'year'];

function book(body) {
  const errors = {};
  const value = {
    title: text(body.title),
    author: text(body.author),
    description: optionalText(body.description),
    category: optionalText(body.category),
    coverImageUrl: optionalText(body.coverImageUrl),
    pdfUrl: optionalText(body.pdfUrl),
    publicationYear: null,
  };

  if (!value.title) errors.title = 'Title is required.';
  else if (value.title.length > 255) errors.title = 'Title must be 255 characters or fewer.';

  if (!value.author) errors.author = 'Author is required.';
  else if (value.author.length > 255) errors.author = 'Author must be 255 characters or fewer.';

  if (value.description && value.description.length > 5000) {
    errors.description = 'Description must be 5000 characters or fewer.';
  }
  if (value.category && value.category.length > 100) {
    errors.category = 'Category must be 100 characters or fewer.';
  }

  for (const field of ['coverImageUrl', 'pdfUrl']) {
    const url = value[field];
    if (url && (url.length > 2048 || !isHttpUrl(url))) {
      errors[field] = 'Please enter a full web address starting with http:// or https://.';
    }
  }

  if (!isBlank(body.publicationYear)) {
    const year = toInteger(body.publicationYear);
    const maxYear = new Date().getFullYear() + 1;
    if (Number.isNaN(year) || year < 1 || year > maxYear) {
      errors.publicationYear = `Publication year must be a whole number between 1 and ${maxYear}.`;
    } else {
      value.publicationYear = year;
    }
  }

  return { errors, value };
}

function listQuery(query) {
  const errors = {};
  const value = {
    search: text(query.search).slice(0, 100),
    category: text(query.category).slice(0, 100),
    sort: text(query.sort) || 'newest',
    page: 1,
    limit: 12,
  };

  if (!SORTS.includes(value.sort)) errors.sort = `Sort must be one of: ${SORTS.join(', ')}.`;

  if (!isBlank(query.page)) {
    const page = toInteger(query.page);
    if (Number.isNaN(page) || page < 1) errors.page = 'Page must be a positive whole number.';
    else value.page = page;
  }
  if (!isBlank(query.limit)) {
    const limit = toInteger(query.limit);
    if (Number.isNaN(limit) || limit < 1 || limit > 50) errors.limit = 'Limit must be between 1 and 50.';
    else value.limit = limit;
  }

  return { errors, value };
}

module.exports = { book, listQuery };
