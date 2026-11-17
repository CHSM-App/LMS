const path = require('path');
const SwaggerParser = require('@apidevtools/swagger-parser');
const { createApp } = require('../../src/app');

const SPEC = path.join(__dirname, '../../../docs/openapi.yaml');

test('openapi.yaml is a valid OpenAPI 3 document', async () => {
  const api = await SwaggerParser.validate(SPEC);
  expect(api.openapi).toMatch(/^3\./);
});

// Every route mounted under /api/v1 must be documented in openapi.yaml.
test('every mounted route is documented', async () => {
  const api = await SwaggerParser.parse(SPEC);
  const documented = new Set();
  for (const [p, ops] of Object.entries(api.paths)) {
    for (const m of Object.keys(ops)) documented.add(`${m.toUpperCase()} ${p.replace(/\{(\w+)\}/g, ':$1')}`);
  }
  const listEndpoints = require('express-list-endpoints');
  const app = createApp({ getPool: async () => ({}) });
  const norm = (p) => p.replace(/:[A-Za-z]+/g, ':p');
  const docNorm = new Set([...documented].map(norm));
  const missing = [];
  for (const e of listEndpoints(app)) {
    if (!e.path.startsWith('/api/v1')) continue;
    for (const m of e.methods) {
      const key = norm(`${m} ${e.path.replace('/api/v1', '')}`);
      if (m !== 'HEAD' && !docNorm.has(key)) missing.push(key);
    }
  }
  expect(missing).toEqual([]);
});
