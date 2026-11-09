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

module.exports = { notificationsQuery, recommendationsQuery, genrePreferences };
