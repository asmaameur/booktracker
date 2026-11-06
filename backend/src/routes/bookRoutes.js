const { Router } = require('express');
const controller = require('../controllers/bookController');
const validators = require('../validators/bookValidators');
const { validate } = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');

const router = Router();

router.use(authenticate);

// Readers and admins
router.get('/', validate(validators.listQuery, 'query'), controller.listBooks);
router.get('/categories', controller.listCategories);
router.get('/:id', controller.getBook);
router.get('/:id/pdf', controller.streamPdf);

// Admins only
router.post('/', authorize('admin'), validate(validators.book), controller.createBook);
router.put('/:id', authorize('admin'), validate(validators.book), controller.updateBook);
router.delete('/:id', authorize('admin'), controller.deleteBook);

module.exports = router;
