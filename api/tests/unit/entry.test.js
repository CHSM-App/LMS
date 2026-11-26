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

test('src/server.js exists', () => {
  expect(fs.existsSync(path.join(__dirname, '../../src/server.js'))).toBe(true);
});
