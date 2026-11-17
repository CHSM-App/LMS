const { loadConfig } = require('../../src/config/env');
const base = { DB_SERVER: 'x', DB_NAME: 'd', DB_USER: 'u', DB_PASSWORD: 'p', JWT_ACCESS_SECRET: 'a', JWT_REFRESH_SECRET: 'r', OTP_SECRET: 'o', WEB_ORIGIN: 'http://w' };
test('throws on missing required key', () => {
  expect(() => loadConfig({})).toThrow('Missing env: DB_SERVER');
});
test('builds config with defaults', () => {
  const c = loadConfig(base);
  expect(c.port).toBe(4000);
  expect(c.db).toMatchObject({ server: 'x', database: 'd', user: 'u', password: 'p', encrypt: false });
  expect(c.jwt.accessSecret).toBe('a');
  expect(c.webOrigin).toBe('http://w');
});
