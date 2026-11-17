// Fails when a colour literal (hex, rgb/rgba, hsl, Color(0x...), Colors.xxx) appears in
// web/src or mobile/lib outside the generated token files. Colours must come from tokens.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TARGETS = [
  { dir: 'web/src', exts: ['.js', '.jsx', '.css'] },
  { dir: 'mobile/lib', exts: ['.dart'] },
];
const ALLOWED = new Set([
  path.normalize('web/src/design/tokens.css'),
  path.normalize('web/src/design/tokens.js'),
  path.normalize('mobile/lib/core/theme/app_tokens.g.dart'),
]);
const PATTERNS = [
  /#[0-9a-fA-F]{3,8}\b(?![-\w])/,
  /\brgba?\(\s*\d/,
  /\bhsla?\(\s*\d/,
  /\bColor\(\s*0x[0-9a-fA-F]+\s*\)/,
  /\bColors\.(?!transparent\b)[a-z]+/,
];
const SKIP_DIRS = new Set(['node_modules', 'gen', 'test', '__tests__']);

function scan(root = ROOT) {
  const problems = [];
  for (const { dir, exts } of TARGETS) {
    const base = path.join(root, dir);
    if (!fs.existsSync(base)) continue;
    const walk = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const full = path.join(d, e.name);
        if (e.isDirectory()) {
          if (!SKIP_DIRS.has(e.name)) walk(full);
          continue;
        }
        const rel = path.normalize(path.relative(root, full));
        if (!exts.includes(path.extname(e.name)) || ALLOWED.has(rel) || /\.test\.|_test\./.test(e.name)) continue;
        fs.readFileSync(full, 'utf8').split('\n').forEach((line, i) => {
          const code = line.replace(/\/\/.*$/, '');
          if (PATTERNS.some((p) => p.test(code))) problems.push(`${rel}:${i + 1}: ${line.trim()}`);
        });
      }
    };
    walk(base);
  }
  return problems;
}

module.exports = { scan };

if (require.main === module) {
  const problems = scan();
  if (problems.length) {
    console.error('Raw colours found (use design tokens instead):\n' + problems.join('\n'));
    process.exitCode = 1;
  } else {
    console.log('No raw colours outside design tokens.');
  }
}
