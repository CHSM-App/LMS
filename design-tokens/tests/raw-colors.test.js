const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { scan } = require('../../scripts/check-no-raw-colors');

function fixture(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rawcol-'));
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  return root;
}

test('flags hex, rgb and Flutter Color literals in screen code', () => {
  const root = fixture({
    'web/src/features/a.jsx': 'const s = { color: "#F45803" };',
    'web/src/features/b.css': '.x { background: rgba(0, 0, 0, .1); }',
    'mobile/lib/screens/c.dart': 'final c = Color(0xFF000000);',
    'mobile/lib/screens/d.dart': 'final c = Colors.red;',
  });
  assert.strictEqual(scan(root).length, 4);
});

test('allows generated token files and token variable usage', () => {
  const root = fixture({
    'web/src/design/tokens.css': ':root { --color-brand-orange: #F45803; }',
    'web/src/features/a.css': '.x { color: var(--color-text); }',
    'mobile/lib/core/theme/app_tokens.g.dart': 'static const Color a = Color(0xFFF45803);',
    'mobile/lib/screens/e.dart': 'color: AppTokens.text, Colors.transparent',
  });
  assert.deepStrictEqual(scan(root), []);
});
