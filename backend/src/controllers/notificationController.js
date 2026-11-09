const HttpError = require('../utils/HttpError');
const { parseId } = require('../middleware/validate');
const notificationModel = require('../models/notificationModel');

// Every handler uses req.user.id, so readers and admins only ever see or change their own
// notifications.

// GET /api/notifications?limit=&unread=true
async function listNotifications(req, res) {
  const [notifications, unreadCount] = await Promise.all([
    notificationModel.listForUser(req.user.id, req.validated),
    notificationModel.countUnread(req.user.id),
  ]);
  res.json({ notifications, unreadCount });
}

// GET /api/notifications/unread-count
// Small and cheap: the navbar bell polls it.
async function unreadCount(req, res) {
  res.json({ unreadCount: await notificationModel.countUnread(req.user.id) });
}

// PATCH /api/notifications/:id/read
async function markRead(req, res) {
  const id = parseId(req.params.id, 'notification id');
  if (!(await notificationModel.markRead(id, req.user.id))) {
    throw new HttpError(404, 'This notification does not exist.', { code: 'NOTIFICATION_NOT_FOUND' });
  }
  res.json({ unreadCount: await notificationModel.countUnread(req.user.id) });
}

// PATCH /api/notifications/read-all
async function markAllRead(req, res) {
  const updated = await notificationModel.markAllRead(req.user.id);
  res.json({ updated, unreadCount: 0 });
}

module.exports = { listNotifications, unreadCount, markRead, markAllRead };
