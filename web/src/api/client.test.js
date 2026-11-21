import { api, setAccessToken, ApiError } from './client';

const json = (status, body) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));

afterEach(() => vi.restoreAllMocks());

test('two parallel 401 TOKEN_EXPIRED trigger exactly one refresh, then both retry', async () => {
  setAccessToken('old');
  let refreshCalls = 0;
  vi.spyOn(globalThis, 'fetch').mockImplementation((url, init) => {
    if (url.endsWith('/auth/refresh')) {
      refreshCalls += 1;
      return json(200, { success: true, data: { accessToken: 'new' } });
    }
    const auth = init.headers.Authorization;
    if (auth === 'Bearer old') return json(401, { success: false, error: 'expired', code: 'TOKEN_EXPIRED' });
    return json(200, { success: true, data: { ok: url } });
  });
  const [a, b] = await Promise.all([api.get('/a'), api.get('/b')]);
  expect(refreshCalls).toBe(1);
  expect(a.data.ok).toMatch(/\/a$/);
  expect(b.data.ok).toMatch(/\/b$/);
});

test('errors carry status, message and code', async () => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(() => json(409, { success: false, error: 'A request is already pending', code: 'REQUEST_PENDING' }));
  await expect(api.post('/x', {})).rejects.toMatchObject({ status: 409, message: 'A request is already pending', code: 'REQUEST_PENDING' });
  await expect(api.post('/x', {})).rejects.toBeInstanceOf(ApiError);
});

test('network failure becomes a friendly error', async () => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.reject(new TypeError('Failed to fetch')));
  await expect(api.get('/x')).rejects.toMatchObject({ status: 0, code: 'NETWORK' });
});

test('query values with spaces or symbols are percent-encoded (%20, never +) so the API validator accepts them', async () => {
  const f = vi.spyOn(globalThis, 'fetch').mockImplementation(() => json(200, { success: true, data: [] }));
  await api.get('/public/courses', { subject: 'Web Development', q: 'c++ & माहिती', page: 1, skip: '' });
  const url = f.mock.calls[0][0];
  expect(url).toContain('subject=Web%20Development');
  expect(url).toContain(`q=${encodeURIComponent('c++ & माहिती')}`);
  expect(url).not.toContain('+');
  expect(url).not.toContain('skip');
});
