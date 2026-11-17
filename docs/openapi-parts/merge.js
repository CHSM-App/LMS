// Merges a phase's paths/schemas into docs/openapi.yaml (text-level, keeps comments).
// Usage: node docs/openapi-parts/merge.js <phase>   e.g. phase5
const fs = require('fs');
const path = require('path');

const phase = process.argv[2];
const dir = __dirname;
const specPath = path.join(dir, '..', 'openapi.yaml');
let spec = fs.readFileSync(specPath, 'utf8');

const read = (name) => {
  const p = path.join(dir, `${phase}-${name}.yaml`);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8').replace(/\s+$/, '') : '';
};

const schemas = read('schemas');
if (schemas && !spec.includes(schemas.split('\n')[0])) spec = spec.replace('    Pagination:', `${schemas}\n    Pagination:`);
const params = read('parameters');
if (params && !spec.includes(params.split('\n')[0])) spec = spec.replace('  parameters:\n    Page:', `  parameters:\n${params}\n    Page:`);
const paths = read('paths');
if (paths && !spec.includes(paths.split('\n')[0])) spec = `${spec.replace(/\s+$/, '')}\n${paths}\n`;

fs.writeFileSync(specPath, spec);
console.log(`merged ${phase}`);
