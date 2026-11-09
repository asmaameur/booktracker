const { withTransaction } = require('../config/db');
const HttpError = require('../utils/HttpError');
const genreModel = require('../models/genreModel');
const recommendationModel = require('../models/recommendationModel');

// GET /api/genres (any)
async function listGenres(req, res) {
  res.json({ genres: await genreModel.listWithCounts() });
}

// GET /api/preferences/genres (reader)
async function getGenrePreferences(req, res) {
  res.json({ genres: await genreModel.listPreferred(req.user.id) });
}

// PUT /api/preferences/genres (reader)
// Replaces the whole set; an empty list clears it.
async function updateGenrePreferences(req, res) {
  const { genres: names } = req.validated;
  const found = await genreModel.findByNames(names);
  if (found.length !== names.length) {
    const known = new Set(found.map((genre) => genre.name.toLowerCase()));
    const unknown = names.filter((name) => !known.has(name.toLowerCase()));
    throw new HttpError(400, 'Please correct the highlighted fields.', {
      code: 'VALIDATION_ERROR',
      errors: { genres: `Unknown genre: ${unknown.join(', ')}.` },
    });
  }

  await withTransaction((client) =>
    genreModel.replacePreferred(
      req.user.id,
      found.map((genre) => genre.id),
      client
    )
  );
  res.json({
    genres: found.map((genre) => genre.name),
    message: found.length ? 'Your favourite genres have been saved.' : 'Your favourite genres have been cleared.',
  });
}

// GET /api/recommendations?limit= (reader)
async function getRecommendations(req, res) {
  const [books, preferredGenres, hasHistory] = await Promise.all([
    recommendationModel.forUser(req.user.id, req.validated.limit),
    genreModel.listPreferred(req.user.id),
    recommendationModel.hasHistory(req.user.id),
  ]);
  res.json({ books, preferredGenres, hasPreferences: preferredGenres.length > 0, hasHistory });
}

module.exports = { listGenres, getGenrePreferences, updateGenrePreferences, getRecommendations };
