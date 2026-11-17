// Deep-merges a { en, mr, hi } JSON patch into src/i18n/*.json.
// Usage: node scripts/add-i18n.mjs path/to/patch.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const patch = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/i18n');

const merge = (a, b) => {
  for (const [k, v] of Object.entries(b)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) a[k] = merge(a[k] && typeof a[k] === 'object' ? a[k] : {}, v);
    else a[k] = v;
  }
  return a;
};

for (const lang of ['en', 'mr', 'hi']) {
  if (!patch[lang]) throw new Error(`patch is missing ${lang}`);
  const file = path.join(dir, `${lang}.json`);
  const data = merge(JSON.parse(fs.readFileSync(file, 'utf8')), patch[lang]);
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}
console.log('i18n updated');
