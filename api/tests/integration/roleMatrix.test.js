// SECURITY.md §3 / docs/ROLES.md: deny by default. Every mounted route is checked:
// - protected routes answer 401 without a token,
// - role areas (/admin, /teacher, /student) answer 403 to every other role.
const listEndpoints = require('express-list-endpoints');
const { app, request, reset, closeAll, asUser } = require('../setup/helpers');

beforeAll(reset);
afterAll(closeAll);

const PUBLIC_PREFIXES = ['/health', '/public/', '/auth/', '/teacher-requests', '/files/'];
const AREA_ROLE = { '/admin/': 'admin', '/teacher/': 'teacher', '/student/': 'student' };

const UUID = '00000000-0000-4000-8000-000000000001';
const fill = (p) => p.replace(/:([A-Za-z]+)/g, (_, name) => (/public|attempt|uuid/i.test(name) ? UUID : name === 'key' ? 'x' : name === 'deviceId' ? 'dev-123456' : '1'));

const routes = [];
for (const e of listEndpoints(app)) {
  if (!e.path.startsWith('/api/v1')) continue;
  const p = e.path.replace('/api/v1', '');
  if (PUBLIC_PREFIXES.some((x) => p === x.replace(/\/$/, '') || p.startsWith(x))) continue;
  for (const m of e.methods) if (m !== 'HEAD') routes.push({ method: m.toLowerCase(), path: p });
}

test('the route list is not empty (sanity)', () => {
  expect(routes.length).toBeGreaterThan(80);
});

test('every protected route answers 401 without a login', async () => {
  const wrong = [];
  for (const r of routes) {
    const res = await request(app)[r.method](`/api/v1${fill(r.path)}`).send({});
    if (res.status !== 401) wrong.push(`${r.method.toUpperCase()} ${r.path} → ${res.status}`);
  }
  expect(wrong).toEqual([]);
});

test('role areas answer 403 to every other role', async () => {
  const users = {};
  for (const role of ['admin', 'teacher', 'student']) users[role] = await asUser({ role });
  const wrong = [];
  for (const r of routes) {
    const area = Object.keys(AREA_ROLE).find((a) => r.path.startsWith(a));
    if (!area) continue;
    for (const [role, u] of Object.entries(users)) {
      if (role === AREA_ROLE[area]) continue;
      const res = await u.raw(r.method, `/api/v1${fill(r.path)}`).send({});
      if (res.status !== 403) wrong.push(`${role} ${r.method.toUpperCase()} ${r.path} → ${res.status}`);
    }
  }
  expect(wrong).toEqual([]);
});
