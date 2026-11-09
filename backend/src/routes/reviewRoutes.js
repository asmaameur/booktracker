const { Router } = require('express');
const controller = require('../controllers/reviewController');
const validators = require('../middleware/validators/reviewValidators');
const { validate } = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');

const router = Router();

router.use(authenticate);

// Readers edit their own reviews only; the controller checks ownership.
router.put('/:id', authorize('user'), validate(validators.review), controller.updateReview);

// Readers delete their own reviews; admins can delete any review (moderation),
// optionally giving a reason that is sent to its author.
router.delete('/:id', authorize('user', 'admin'), validate(validators.removal), controller.deleteReview);

module.exports = router;
