const { Router } = require('express');
const controller = require('../controllers/libraryController');
const validators = require('../middleware/validators/libraryValidators');
const { validate } = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');

const router = Router();

// The personal library and reading progress belong to readers only.
router.use(authenticate, authorize('user'));

router.get('/', validate(validators.listQuery, 'query'), controller.listLibrary);
router.post('/', validate(validators.addBook), controller.addToLibrary);
router.patch('/:bookId', validate(validators.updateStatus), controller.updateStatus);
router.delete('/:bookId', controller.removeFromLibrary);
router.get('/:bookId/progress', controller.getProgress);
router.put('/:bookId/progress', validate(validators.progress), controller.saveProgress);

module.exports = router;
