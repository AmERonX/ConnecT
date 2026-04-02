import { getAccessToken } from './auth.js';

const API_BASE = window.CONNECT_API_BASE || 'http://localhost:8000';

export class ApiError extends Error {
  constructor(message, code = 'INTERNAL_ERROR', status = 500) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export async function apiFetch(path, options = {}) {
  const token = await getAccessToken();
  if (!token) {
    window.location.href = '/login.html';
    return null;
  }

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const error = payload?.error || {};
    throw new ApiError(error.message || 'Request failed.', error.code || 'INTERNAL_ERROR', response.status);
  }

  return payload?.data;
}
