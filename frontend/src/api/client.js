// Central HTTP client. Every request to the BookTracker API goes through
// `request`, which adds the login token, parses JSON and turns error responses
// into ApiError objects with the server's message, code and field errors.

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace(/\/+$/, '');

// Error codes meaning the stored login is no longer valid.
const SESSION_ENDED_CODES = new Set(['AUTH_REQUIRED', 'INVALID_TOKEN', 'TOKEN_EXPIRED', 'TOKEN_REVOKED']);

export class ApiError extends Error {
  constructor(message, { status = 0, code = null, errors = {}, data = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.errors = errors || {};
    this.data = data;
  }
}

let authToken = null;
let sessionEndedHandler = null;

export function setAuthToken(token) {
  authToken = token;
}

export function getAuthToken() {
  return authToken;
}

export function onSessionEnded(handler) {
  sessionEndedHandler = handler;
}

export function buildUrl(path, query) {
  const url = new URL(`${API_URL}${path}`, window.location.origin);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

function authHeaders() {
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}

async function toApiError(response) {
  const isJson = (response.headers.get('content-type') || '').includes('application/json');
  const data = isJson ? await response.json().catch(() => null) : null;
  const error = new ApiError(data?.message || `The server answered with an error (${response.status}).`, {
    status: response.status,
    code: data?.code ?? null,
    errors: data?.errors,
    data,
  });
  if (response.status === 401 && authToken && SESSION_ENDED_CODES.has(error.code)) {
    sessionEndedHandler?.(error);
  }
  return error;
}

const NETWORK_MESSAGE = 'We could not reach BookTracker. Check your connection and that the server is running.';

export async function request(path, { method = 'GET', body, query, signal, keepalive } = {}) {
  let response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      signal,
      keepalive,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...authHeaders(),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError(NETWORK_MESSAGE, { code: 'NETWORK_ERROR' });
  }

  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return null;
  return response.json();
}

// Downloads a binary file (a book's PDF) and reports progress from 0 to 1
// when the server sends the file size.
export async function requestFile(path, { signal, onProgress } = {}) {
  let response;
  try {
    response = await fetch(buildUrl(path), { signal, headers: authHeaders() });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError(NETWORK_MESSAGE, { code: 'NETWORK_ERROR' });
  }
  if (!response.ok) throw await toApiError(response);

  const total = Number(response.headers.get('content-length')) || 0;
  if (!response.body || !total || !onProgress) {
    return new Uint8Array(await response.arrayBuffer());
  }

  const reader = response.body.getReader();
  const chunks = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onProgress(Math.min(1, received / total));
  }
  const data = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.length;
  }
  return data;
}
