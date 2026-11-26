const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');
const { createApp } = require('../../src/app');

const pool = { request: () => ({ query: async () => ({ recordset: [{ ok: 1 }] }) }) };
let dist;
let prev;

beforeAll(() => {
  dist = fs.mkdtempSync(path.join(os.tmpdir(), 'lms-web-'));
  fs.writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>LMS</title>');
  fs.mkdirSync(path.join(dist, 'assets'));
  fs.writeFileSync(path.join(dist, 'assets', 'app.js'), 'console.log(1)');
  prev = process.env.WEB_DIST_DIR;
  process.env.WEB_DIST_DIR = dist;
});

afterAll(() => {
  if (prev === undefined) delete process.env.WEB_DIST_DIR; else process.env.WEB_DIST_DIR = prev;
  fs.rmSync(dist, { recursive: true, force: true });
});

const app = () => createApp({ getPool: async () => pool });

test('serves index.html at /', async () => {
  const res = await request(app()).get('/');
  expect(res.status).toBe(200);
  expect(res.text).toContain('<title>LMS</title>');
});

test('serves a built asset', async () => {
  const res = await request(app()).get('/assets/app.js');
  expect(res.status).toBe(200);
  expect(res.text).toBe('console.log(1)');
});

test('SPA fallback: a client route returns index.html', async () => {
  const res = await request(app()).get('/student/courses/12');
  expect(res.status).toBe(200);
  expect(res.text).toContain('<title>LMS</title>');
});

test('the API still works and unknown API paths stay JSON 404', async () => {
  const ok = await request(app()).get('/api/v1/health');
  expect(ok.status).toBe(200);
  const nope = await request(app()).get('/api/v1/nope');
  expect(nope.status).toBe(404);
  expect(nope.body).toEqual({ success: false, error: 'Not found' });
});

test('POST to a non-API path is not answered with the web page', async () => {
  const res = await request(app()).post('/student/courses/12');
  expect(res.status).toBe(404);
});

test('without a web build the API behaves as before', async () => {
  delete process.env.WEB_DIST_DIR;
  process.env.WEB_DIST_DIR = path.join(dist, 'missing');
  const res = await request(app()).get('/');
  expect(res.status).toBe(404);
  expect(res.body).toEqual({ success: false, error: 'Not found' });
  process.env.WEB_DIST_DIR = dist;
});
