const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { loadTokens, resolveColor, contrast, build } = require('../build');

const tokens = loadTokens();

test('palette is locked to the BRAND-THEME values', () => {
  assert.deepStrictEqual(tokens.color.brand, {
    orange: '#F45803', ice: '#EEF4FF', lime: '#72CF10', blue: '#5C8FF7', white: '#FFFFFF', navy: '#14264C',
  });
  assert.deepStrictEqual(tokens.color.functional, { error: '#C62828' });
});

test('semantic colours only reference palette colours', () => {
  for (const [name, def] of Object.entries(tokens.color.semantic)) {
    assert.ok(def.ref, `${name} must use ref`);
    const [group, key] = def.ref.split('.');
    assert.ok(tokens.color[group] && tokens.color[group][key], `${name} references unknown ${def.ref}`);
    if (def.alpha !== undefined) assert.ok(def.alpha > 0 && def.alpha <= 1, `${name} alpha out of range`);
  }
});

test('page background is white, not the light blue (DECISIONS "White page background")', () => {
  assert.strictEqual(resolveColor(tokens, 'bgPage').hex, '#FFFFFF');
  assert.notStrictEqual(tokens.color.semantic.bgSection.ref, 'brand.ice');
});

for (const [fg, bg, min, note] of tokens.contrastPairs) {
  test(`contrast ${fg} on ${bg} >= ${min} (${note})`, () => {
    const ratio = contrast(resolveColor(tokens, fg), resolveColor(tokens, bg));
    assert.ok(ratio >= min, `${fg} on ${bg} = ${ratio.toFixed(2)}, needs ${min}`);
  });
}

test('generator writes identical values to CSS, JS and Dart', () => {
  const out = fs.mkdtempSync(path.join(require('os').tmpdir(), 'tokens-'));
  const files = build({ cssPath: path.join(out, 't.css'), jsPath: path.join(out, 't.js'), dartPath: path.join(out, 't.dart') });
  const css = fs.readFileSync(files.cssPath, 'utf8');
  const js = fs.readFileSync(files.jsPath, 'utf8');
  const dart = fs.readFileSync(files.dartPath, 'utf8');
  assert.match(css, /--color-brand-orange: #F45803;/);
  assert.match(css, /--color-text-secondary: rgba\(20, 38, 76, 0\.72\);/);
  assert.match(js, /"brandOrange": "#F45803"/);
  assert.match(dart, /static const Color brandOrange = Color\(0xFFF45803\);/);
  assert.match(dart, /static const Color textSecondary = Color\(0xB814264C\);/);
  assert.match(css, /--text-md: 19px;/);
  assert.match(dart, /static const double textMd = 19;/);
});

test('web uses its own font stack; mobile keeps the bundled font', () => {
  const out = fs.mkdtempSync(path.join(require('os').tmpdir(), 'tokens-'));
  const files = build({ cssPath: path.join(out, 't.css'), jsPath: path.join(out, 't.js'), dartPath: path.join(out, 't.dart') });
  const css = fs.readFileSync(files.cssPath, 'utf8');
  const dart = fs.readFileSync(files.dartPath, 'utf8');
  assert.ok(tokens.font.familyWeb, 'font.familyWeb is required');
  assert.ok(css.includes(`--font-family: ${tokens.font.familyWeb};`));
  assert.match(css, /--letter-spacing-heading: -0\.02em;/);
  assert.match(css, /--shadow-card: 0 1px 2px var\(--color-shadow\)/);
  assert.match(dart, new RegExp(`fontFamily = '${tokens.font.familyName}'`));
});
