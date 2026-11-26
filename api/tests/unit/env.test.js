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
test('PORT: a number stays a number, an iisnode named pipe stays a string', () => {
  expect(loadConfig({ ...base, PORT: '5000' }).port).toBe(5000);
  const pipe = '\\\\.\\pipe\\3a1f0f64-1c4e-4a38-9b0e-1d1f1a2b3c4d';
  expect(loadConfig({ ...base, PORT: pipe }).port).toBe(pipe);
});
test('fixed OTP is off by default', () => {
  expect(loadConfig(base).otpFixedCode).toBeNull();
});
test('fixed OTP can be set outside production', () => {
  expect(loadConfig({ ...base, NODE_ENV: 'development', OTP_FIXED_CODE: '123456' }).otpFixedCode).toBe('123456');
});
test('fixed OTP must be 6 digits', () => {
  expect(() => loadConfig({ ...base, OTP_FIXED_CODE: '1234' })).toThrow('OTP_FIXED_CODE must be 6 digits');
});
test('fixed OTP is refused in production', () => {
  expect(() => loadConfig({ ...base, NODE_ENV: 'production', OTP_FIXED_CODE: '123456' })).toThrow('OTP_FIXED_CODE is not allowed in production');
});
