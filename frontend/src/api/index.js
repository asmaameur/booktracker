// One function per backend endpoint. See backend/API.md for the request and
// response formats.
import { request, requestFile } from './client';

export const authApi = {
  register: (data) => request('/auth/register', { method: 'POST', body: data }),
  login: (data) => request('/auth/login', { method: 'POST', body: data }),
  verifyEmail: (token) => request('/auth/verify-email', { method: 'POST', body: { token } }),
  resendVerification: (email) => request('/auth/resend-verification', { method: 'POST', body: { email } }),
};

export const profileApi = {
  get: (signal) => request('/profile', { signal }),
  update: (data) => request('/profile', { method: 'PATCH', body: data }),
  changePassword: (data) => request('/profile/password', { method: 'PUT', body: data }),
};

export const booksApi = {
  list: (query, signal) => request('/books', { query, signal }),
  categories: (signal) => request('/books/categories', { signal }),
  get: (id, signal) => request(`/books/${id}`, { signal }),
  create: (data) => request('/books', { method: 'POST', body: data }),
  update: (id, data) => request(`/books/${id}`, { method: 'PUT', body: data }),
  remove: (id, { force = false } = {}) =>
    request(`/books/${id}`, { method: 'DELETE', query: force ? { force: 'true' } : undefined }),
  pdf: (id, options) => requestFile(`/books/${id}/pdf`, options),
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
