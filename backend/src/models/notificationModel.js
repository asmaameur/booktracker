const { pool } = require('../config/db');

function toNotification(row) {
  return {
    id: row.id,
    type: row.type,
    message: row.message,
    isRead: row.is_read,
    createdAt: row.created_at,
    // The book is read live, so a later change of cover or title shows here too.
    book: row.book_id
      ? { id: row.book_id, title: row.title, author: row.author, coverImageUrl: row.cover_image_url }
      : null,
  };
}

// One notification per reader account. Called inside the transaction that
// creates the book, so either both are saved or neither is.
async function notifyReadersOfNewBook(book, db = pool) {
  const { rowCount } = await db.query(
    `INSERT INTO notifications (user_id, book_id, type, message)
     SELECT id, $1, 'new_book', $2 FROM users WHERE role = 'user'`,
    [book.id, `New in the catalogue: "${book.title}" by ${book.author}.`]
  );
  return rowCount;
}

// One notification per admin account when a reader rates a book. Called
// inside the transaction that saves the review.
async function notifyAdminsOfReview({ review, book, readerName }, db = pool) {
  const stars = `${review.rating} star${review.rating === 1 ? '' : 's'}`;
  let message = `${readerName} rated "${book.title}" ${stars}.`;
  if (review.comment) {
    const excerpt = review.comment.length > 120 ? `${review.comment.slice(0, 117).trimEnd()}…` : review.comment;
    message += ` “${excerpt}”`;
  }
  const { rowCount } = await db.query(
    `INSERT INTO notifications (user_id, book_id, type, message)
     SELECT id, $1, 'new_review', $2 FROM users WHERE role = 'admin'`,
    [book.id, message]
  );
  return rowCount;
}

// Tells a reader that an admin removed their review, with the reason if given.
async function notifyReviewRemoved({ review, book, reason }, db = pool) {
  let message = `An administrator removed your review of "${book.title}".`;
  if (reason) message += ` Reason: ${reason}`;
  await db.query(
    `INSERT INTO notifications (user_id, book_id, type, message) VALUES ($1, $2, 'review_removed', $3)`,
    [review.userId, book.id, message]
  );
}

async function listForUser(userId, { limit, unreadOnly }, db = pool) {
  const { rows } = await db.query(
    `SELECT n.id, n.type, n.message, n.is_read, n.created_at, n.book_id,
            b.title, b.author, b.cover_image_url
     FROM notifications n
     LEFT JOIN books b ON b.id = n.book_id
     WHERE n.user_id = $1 ${unreadOnly ? 'AND NOT n.is_read' : ''}
     ORDER BY n.created_at DESC, n.id DESC
     LIMIT $2`,
    [userId, limit]
  );
  return rows.map(toNotification);
}

async function countUnread(userId, db = pool) {
  const { rows } = await db.query(
    'SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND NOT is_read',
    [userId]
  );
  return rows[0].count;
}

// Both updates filter on user_id: a reader can only touch their own notifications.
async function markRead(id, userId, db = pool) {
  const { rowCount } = await db.query('UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2', [
    id,
    userId,
  ]);
  return rowCount > 0;
}

async function markAllRead(userId, db = pool) {
  const { rowCount } = await db.query(
    'UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND NOT is_read',
    [userId]
  );
  return rowCount;
}

module.exports = { notifyReadersOfNewBook, notifyAdminsOfReview, notifyReviewRemoved, listForUser, countUnread, markRead, markAllRead };
