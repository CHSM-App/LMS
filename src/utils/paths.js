const fs = require('fs');
const path = require('path');

// The API runs from two layouts:
//  1. monorepo:        <repo>/api/src/...   with <repo>/docs and <repo>/web/dist beside api/
//  2. backend branch:  <root>/src/...       (api/ contents at the root) with <root>/docs and <root>/public inside it
// The `backend` branch is built by .github/workflows/publish-backend.yml and is what Plesk deploys.
const API_ROOT = path.resolve(__dirname, '../..');

const SPEC_CANDIDATES = [
  path.join(API_ROOT, 'docs', 'openapi.yaml'),
  path.resolve(API_ROOT, '..', 'docs', 'openapi.yaml'),
];

function webDistCandidates() {
  return [path.join(API_ROOT, 'public'), path.resolve(API_ROOT, '..', 'web', 'dist')];
}

function resolveFirst(candidates) {
  return candidates.find((p) => fs.existsSync(p)) || null;
}

module.exports = { API_ROOT, SPEC_CANDIDATES, webDistCandidates, resolveFirst };
