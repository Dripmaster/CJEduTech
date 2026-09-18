// src/lib/http.js
import { TOKEN_KEY } from './tab-session.js';

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

async function request(path, opts = {}) {
  const {
    method = 'GET',
    headers = {},
    body = undefined,
    credentials = 'omit',
  } = opts;

  const url = `${API_BASE}${path}`;

  const init = {
    method,
    mode: 'cors',
    credentials,
    headers: { ...headers, ...(sessionStorage.getItem(TOKEN_KEY) ? { Authorization: `Bearer ${sessionStorage.getItem(TOKEN_KEY)}` } : {}) },
  };

  const isPlainObject = body && typeof body === 'object' && !(body instanceof FormData) && !(body instanceof Blob) && !(body instanceof ArrayBuffer);
  if (body !== undefined) {
    if (isPlainObject) {
      init.headers['Content-Type'] = init.headers['Content-Type'] || 'application/json';
      init.body = JSON.stringify(body);
    } else {
      init.body = body;
    }
  }

  let res;
  try {
    res = await fetch(url, init);
  } catch (err) {
    const e = new Error(`Network error (possible CORS): ${err?.message || err}`);
    e.cause = err;
    throw e;
  }

  let data = null;
  const text = await res.text().catch(() => '');
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }

  if (!res.ok) {
    const err = new Error((data && data.message) || `HTTP ${res.status}`);
    err.status = res.status;
    err.payload = data;
    throw err;
  }

  return data;
}

export const http = {
  get: (p, headers) => request(p, { method: 'GET', headers }),
  post: (p, b, headers) => request(p, { method: 'POST', body: b, headers }),
  put: (p, b, headers) => request(p, { method: 'PUT', body: b, headers }),
  del: (p, headers) => request(p, { method: 'DELETE', headers }),
};