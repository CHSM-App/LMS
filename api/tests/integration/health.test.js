const request = require('supertest');
const { createApp } = require('../../src/app');
const okPool = { request: () => ({ query: async () => ({ recordset: [{ ok: 1 }] }) }) };
const badPool = { request: () => ({ query: async () => { throw new Error('down'); } }) };
test('health up', async () => {
  const res = await request(createApp({ getPool: async () => okPool })).get('/api/v1/health');
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ success: true, data: { db: 'up' } });
  expect(res.headers['x-powered-by']).toBeUndefined();
});
test('health db down -> 503', async () => {
  const res = await request(createApp({ getPool: async () => badPool })).get('/api/v1/health');
  expect(res.status).toBe(503);
  expect(res.body).toEqual({ success: false, error: 'Database unavailable' });
});
test('unknown route -> json 404', async () => {
  const res = await request(createApp({ getPool: async () => okPool })).get('/api/v1/nope');
  expect(res.status).toBe(404);
  expect(res.body).toEqual({ success: false, error: 'Not found' });
});
