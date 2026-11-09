const { Router } = require('express');
const controller = require('../controllers/statsController');
const validators = require('../middleware/validators/readerValidators');
const { validate } = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');

const router = Router();

// Reading statistics and yearly goals belong to readers.
router.use(authenticate, authorize('user'));

router.get('/reading', validate(validators.statsQuery, 'query'), controller.getReadingStats);
router.put('/goal', validate(validators.readingGoal), controller.setGoal);
router.delete('/goal', validate(validators.statsQuery, 'query'), controller.deleteGoal);

module.exports = router;
