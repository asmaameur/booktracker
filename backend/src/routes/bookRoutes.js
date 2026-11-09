const { Router } = require('express');
const controller = require('../controllers/bookController');
const reviewController = require('../controllers/reviewController');
const validators = require('../middleware/validators/bookValidators');
const reviewValidators = require('../middleware/validators/reviewValidators');
const { validate } = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');

const router = Router();

router.use(authenticate);

// Readers and admins
router.get('/', validate(validators.listQuery, 'query'), controller.listBooks);
router.get('/:id', controller.getBook);
router.get('/:id/pdf', controller.streamPdf);
router.get('/:id/reviews', validate(reviewValidators.listQuery, 'query'), reviewController.listReviews);
router.get('/:id/similar', controller.similarBooks);

// Readers only: one review per book (edit or delete it through /api/reviews/:id)
router.post('/:id/reviews', authorize('user'), validate(reviewValidators.review), reviewController.createReview);

// Admins only
router.post('/', authorize('admin'), validate(validators.book), controller.createBook);
router.put('/:id', authorize('admin'), validate(validators.book), controller.updateBook);
router.delete('/:id', authorize('admin'), controller.deleteBook);

module.exports = router;
