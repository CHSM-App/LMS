const fs = require('fs');
const os = require('os');
const path = require('path');

const { resolveFirst } = require('../../src/utils/paths');

describe('resolveFirst', () => {
  let dir;
  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lms-paths-'));
    fs.writeFileSync(path.join(dir, 'a.txt'), 'a');
    fs.writeFileSync(path.join(dir, 'b.txt'), 'b');
  });
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

  test('returns the first candidate that exists', () => {
    expect(resolveFirst([path.join(dir, 'missing.txt'), path.join(dir, 'b.txt'), path.join(dir, 'a.txt')])).toBe(path.join(dir, 'b.txt'));
  });

  test('returns null when none exist', () => {
    expect(resolveFirst([path.join(dir, 'x'), path.join(dir, 'y')])).toBeNull();
  });
});

describe('deploy layouts', () => {
  test('API spec is found in the monorepo layout (docs/ beside api/)', () => {
    const { SPEC_CANDIDATES } = require('../../src/utils/paths');
    const { resolveFirst: first } = require('../../src/utils/paths');
    expect(first(SPEC_CANDIDATES)).toMatch(/openapi\.yaml$/);
  });

  test('API spec candidates include docs/ inside the api root (backend-branch layout)', () => {
    const { SPEC_CANDIDATES } = require('../../src/utils/paths');
    const apiRoot = path.resolve(__dirname, '../..');
    expect(SPEC_CANDIDATES).toContain(path.join(apiRoot, 'docs', 'openapi.yaml'));
  });

  test('web build candidates include public/ inside the api root (backend-branch layout)', () => {
    const { webDistCandidates } = require('../../src/utils/paths');
    const apiRoot = path.resolve(__dirname, '../..');
    expect(webDistCandidates()).toContain(path.join(apiRoot, 'public'));
  });
});
