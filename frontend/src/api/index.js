// One function per backend endpoint. See backend/API.md for the request and
// response formats.
import { request, requestFile, uploadFile } from './client';

export const authApi = {
  register: (data) => request('/auth/register', { method: 'POST', body: data }),
  login: (data) => request('/auth/login', { method: 'POST', body: data }),
  verifyEmail: (token) => request('/auth/verify-email', { method: 'POST', body: { token } }),
  resendVerification: (email) => request('/auth/resend-verification', { method: 'POST', body: { email } }),
  forgotPassword: (email) => request('/auth/forgot-password', { method: 'POST', body: { email } }),
  resetPassword: (data) => request('/auth/reset-password', { method: 'POST', body: data }),
};

export const profileApi = {
  get: (signal) => request('/profile', { signal }),
  update: (data) => request('/profile', { method: 'PATCH', body: data }),
  changePassword: (data) => request('/profile/password', { method: 'PUT', body: data }),
  uploadAvatar: (file) => uploadFile('/profile/avatar', file),
  removeAvatar: () => request('/profile/avatar', { method: 'DELETE' }),
};

export const booksApi = {
  list: (query, signal) => request('/books', { query, signal }),
  get: (id, signal) => request(`/books/${id}`, { signal }),
  create: (data) => request('/books', { method: 'POST', body: data }),
  update: (id, data) => request(`/books/${id}`, { method: 'PUT', body: data }),
  remove: (id, { force = false } = {}) =>
    request(`/books/${id}`, { method: 'DELETE', query: force ? { force: 'true' } : undefined }),
  pdf: (id, options) => requestFile(`/books/${id}/pdf`, options),
  similar: (id, signal) => request(`/books/${id}/similar`, { signal }),
};

export const libraryApi = {
  list: (status, signal) => request('/library', { query: { status }, signal }),
  add: (bookId, readingStatus = 'to_read') =>
    request('/library', { method: 'POST', body: { bookId, readingStatus } }),
  updateStatus: (bookId, readingStatus) =>
    request(`/library/${bookId}`, { method: 'PATCH', body: { readingStatus } }),
  remove: (bookId) => request(`/library/${bookId}`, { method: 'DELETE' }),
  getProgress: (bookId, signal) => request(`/library/${bookId}/progress`, { signal }),
  saveProgress: (bookId, data, { keepalive } = {}) =>
    request(`/library/${bookId}/progress`, { method: 'PUT', body: data, keepalive }),
};

export const adminApi = {
  stats: (signal) => request('/admin/stats', { signal }),
  users: (query, signal) => request('/admin/users', { query, signal }),
  deleteUser: (id) => request(`/admin/users/${id}`, { method: 'DELETE' }),
};

export const genresApi = {
  list: (signal) => request('/genres', { signal }),
  preferences: (signal) => request('/preferences/genres', { signal }),
  savePreferences: (genres) => request('/preferences/genres', { method: 'PUT', body: { genres } }),
};

export const reviewsApi = {
  list: (bookId, query, signal) => request(`/books/${bookId}/reviews`, { query, signal }),
  create: (bookId, data) => request(`/books/${bookId}/reviews`, { method: 'POST', body: data }),
  update: (reviewId, data) => request(`/reviews/${reviewId}`, { method: 'PUT', body: data }),
  remove: (reviewId, reason) =>
    request(`/reviews/${reviewId}`, { method: 'DELETE', body: reason ? { reason } : undefined }),
  markHelpful: (reviewId) => request(`/reviews/${reviewId}/helpful`, { method: 'PUT' }),
  unmarkHelpful: (reviewId) => request(`/reviews/${reviewId}/helpful`, { method: 'DELETE' }),
};

export const notificationsApi = {
  list: (query, signal) => request('/notifications', { query, signal }),
  unreadCount: (signal) => request('/notifications/unread-count', { signal }),
  markRead: (id) => request(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllRead: () => request('/notifications/read-all', { method: 'PATCH' }),
};

export const recommendationsApi = {
  list: (limit, signal) => request('/recommendations', { query: { limit }, signal }),
};

export const uploadsApi = {
  cover: (file) => uploadFile('/uploads/cover', file),
  pdf: (file) => uploadFile('/uploads/pdf', file),
};

export const statsApi = {
  reading: (year, signal) => request('/stats/reading', { query: { year }, signal }),
  setGoal: (target) => request('/stats/goal', { method: 'PUT', body: { target } }),
  deleteGoal: () => request('/stats/goal', { method: 'DELETE' }),
};
