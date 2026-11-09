const { Router } = require('express');
const controller = require('../controllers/notificationController');
const validators = require('../middleware/validators/readerValidators');
const { validate } = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');

const router = Router();

// Readers are notified of new books, admins of new ratings. Every query is
// limited to the logged-in user's own notifications.
router.use(authenticate, authorize('user', 'admin'));

router.get('/', validate(validators.notificationsQuery, 'query'), controller.listNotifications);
router.get('/unread-count', controller.unreadCount);
router.patch('/read-all', controller.markAllRead);
router.patch('/:id/read', controller.markRead);

module.exports = router;
