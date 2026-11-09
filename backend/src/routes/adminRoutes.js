const { Router } = require('express');
const controller = require('../controllers/adminController');
const validators = require('../middleware/validators/adminValidators');
const { validate } = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');

const router = Router();

router.use(authenticate, authorize('admin'));

router.get('/stats', controller.getStats);
router.get('/users', validate(validators.usersQuery, 'query'), controller.listUsers);
router.delete('/users/:id', controller.deleteUser);

module.exports = router;
