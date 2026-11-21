const BASE = (import.meta.env && import.meta.env.VITE_API_BASE_URL) || '/api/v1';

let accessToken = null;
let refreshing = null;
const listeners = new Set();

export function setAccessToken(token) {
  accessToken = token;
}
export const getAccessToken = () => accessToken;
export const onSessionEnded = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export class ApiError extends Error {
  constructor(status, message, code, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function buildUrl(path, query) {
  const url = `${BASE}${path}`;
  if (!query) return url;
  // %20 for spaces (URLSearchParams would write "+", which the API's validator rejects as a reserved character).
  const qs = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return qs ? `${url}?${qs}` : url;
}

async function raw(method, path, { body, query, form, binary, contentRange } = {}) {
  const headers = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  let payload;
  if (binary) {
    headers['Content-Type'] = 'application/octet-stream';
    headers['Content-Range'] = contentRange;
    payload = binary;
  } else if (form) payload = form;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(buildUrl(path, query), { method, headers, body: payload, credentials: 'include' });
  } catch {
    throw new ApiError(0, "You're offline. Check your connection and try again.", 'NETWORK');
  }
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  if (!res.ok || (json && json.success === false)) {
    throw new ApiError(res.status, (json && json.error) || 'Something went wrong. Try again.', json && json.code, json && json.details);
  }
  return json;
}

// One refresh at a time; concurrent 401s wait for the same promise.
export function refreshSession() {
  if (!refreshing) {
    refreshing = raw('POST', '/auth/refresh')
      .then((r) => {
        setAccessToken(r.data.accessToken);
        return r.data.accessToken;
      })
      .catch((e) => {
        setAccessToken(null);
        throw e;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

async function request(method, path, opts) {
  try {
    return await raw(method, path, opts);
  } catch (e) {
    if (e.status === 401 && e.code === 'TOKEN_EXPIRED') {
      try {
        await refreshSession();
      } catch (refreshErr) {
        listeners.forEach((fn) => fn(refreshErr));
        throw refreshErr;
      }
      return raw(method, path, opts);
    }
    if (e.status === 401 && ['ACCOUNT_BLOCKED', 'SESSION_ENDED', 'TOKEN_REUSED'].includes(e.code)) {
      setAccessToken(null);
      listeners.forEach((fn) => fn(e));
    }
    throw e;
  }
}

export const api = {
  get: (path, query) => request('GET', path, { query }),
  post: (path, body) => request('POST', path, { body: body ?? {} }),
  put: (path, body) => request('PUT', path, { body: body ?? {} }),
  patch: (path, body) => request('PATCH', path, { body: body ?? {} }),
  del: (path) => request('DELETE', path),
  form: (path, formData, method = 'POST') => request(method, path, { form: formData }),
  putChunk: (path, blob, contentRange) => request('PUT', path, { binary: blob, contentRange }),
};

export function fileUrl(url) {
  if (!url) return url;
  if (/^https?:/.test(url)) return url;
  const base = BASE.replace(/\/api\/v1$/, '');
  return `${base}${url}`;
}
