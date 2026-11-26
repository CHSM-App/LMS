const fs = require('fs');
const path = require('path');

// Plesk (like the hotel project) starts the app from app.js in the root of the deployed backend branch.
// app.js must only hand over to src/server.js, which owns startup.
test('root app.js starts the API through src/server.js', () => {
  const file = path.join(__dirname, '../../app.js');
  expect(fs.existsSync(file)).toBe(true);
  const src = fs.readFileSync(file, 'utf8');
  expect(src).toMatch(/require\(['"]\.\/src\/server['"]\)/);
});

// Plesk on Windows runs Node through IIS + iisnode: web.config must hand every request to app.js,
// otherwise IIS answers /api/... with its own empty 404 and Express never sees it.
test('web.config rewrites every request to app.js through iisnode', () => {
  const xml = fs.readFileSync(path.join(__dirname, '../../web.config'), 'utf8');
  expect(xml).toMatch(/<add name="iisnode" path="app\.js"[^>]*modules="iisnode"/);
  expect(xml).toMatch(/<match url="\(\.\*\)"\s*\/>\s*<action type="Rewrite" url="app\.js"/);
  expect(xml).toMatch(/httpErrors existingResponse="PassThrough"/);
  // Stack traces and server paths must not be sent to visitors by default.
  expect(xml).toMatch(/devErrorsEnabled="false"/);
});

test('src/server.js exists', () => {
  expect(fs.existsSync(path.join(__dirname, '../../src/server.js'))).toBe(true);
});
