const { Router } = require('express');
const controller = require('../controllers/genreController');
const validators = require('../middleware/validators/readerValidators');
const { validate } = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');

// Genres, a reader's favourite genres, and the recommendations built from them.
// Mounted at /api, so each route spells out its full path.
const router = Router();
const reader = [authenticate, authorize('user')];

router.get('/genres', authenticate, controller.listGenres);

router.get('/preferences/genres', ...reader, controller.getGenrePreferences);
router.put('/preferences/genres', ...reader, validate(validators.genrePreferences), controller.updateGenrePreferences);

router.get(
  '/recommendations',
  ...reader,
  validate(validators.recommendationsQuery, 'query'),
  controller.getRecommendations
);

module.exports = router;
