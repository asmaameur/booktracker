const { text, toInteger, isBlank } = require('./rules');

function boundedLimit(raw, fallback, max, errors) {
  if (isBlank(raw)) return fallback;
  const limit = toInteger(raw);
  if (Number.isNaN(limit) || limit < 1 || limit > max) {
    errors.limit = `Limit must be between 1 and ${max}.`;
    return fallback;
  }
  return limit;
}

// GET /api/notifications?limit=&unread=true
function notificationsQuery(query) {
  const errors = {};
  const limit = boundedLimit(query.limit, 20, 50, errors);
  return { errors, value: { limit, unreadOnly: text(query.unread) === 'true' } };
}

// GET /api/recommendations?limit=
function recommendationsQuery(query) {
  const errors = {};
  return { errors, value: { limit: boundedLimit(query.limit, 6, 24, errors) } };
}

// PUT /api/preferences/genres  { "genres": ["Fantasy", "Mystery"] }
// An empty list clears the preferences. Names are checked against the genres
// table by the controller.
function genrePreferences(body) {
  const errors = {};
  let genres = [];
  if (!Array.isArray(body.genres)) {
    errors.genres = 'Genres must be a list of genre names.';
  } else if (body.genres.length > 20) {
    errors.genres = 'Please choose fewer genres.';
  } else if (body.genres.some((genre) => typeof genre !== 'string' || !genre.trim() || genre.length > 50)) {
    errors.genres = 'Each genre must be a genre name from the list.';
  } else {
    genres = [...new Set(body.genres.map((genre) => genre.trim()))];
  }
  return { errors, value: { genres } };
}


// ?year= for reading stats: defaults to the current year.
function readYear(raw, errors) {
  const current = new Date().getFullYear();
  if (isBlank(raw)) return current;
  const year = toInteger(raw);
  if (Number.isNaN(year) || year < 2000 || year > current + 1) {
    errors.year = `Year must be between 2000 and ${current + 1}.`;
    return current;
  }
  return year;
}

// GET /api/stats/reading?year= and DELETE /api/stats/goal?year=
function statsQuery(query) {
  const errors = {};
  return { errors, value: { year: readYear(query.year, errors) } };
}

// PUT /api/stats/goal { target, year? }
function readingGoal(body) {
  const errors = {};
  const year = readYear(body.year, errors);
  const target = toInteger(body.target);
  if (Number.isNaN(target) || target < 1 || target > 1000) {
    errors.target = 'Your goal must be a whole number of books between 1 and 1000.';
  }
  return { errors, value: { year, target } };
}

module.exports = { notificationsQuery, recommendationsQuery, genrePreferences, statsQuery, readingGoal };
