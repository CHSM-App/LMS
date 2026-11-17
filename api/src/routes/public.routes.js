const fs = require('fs');
const path = require('path');
const router = require('express').Router();
const { h } = require('../utils/http');
const { badRequest } = require('../utils/APIError');

const LEGAL_DIR = path.join(__dirname, '../../content/legal');

router.get('/public/legal/:doc', h((req) => {
  const { doc } = req.params;
  if (!['terms', 'privacy'].includes(doc)) throw badRequest('doc: must be terms or privacy');
  const lang = ['en', 'mr', 'hi'].includes(req.query.lang) ? req.query.lang : 'en';
  const file = [path.join(LEGAL_DIR, `${doc}.${lang}.md`), path.join(LEGAL_DIR, `${doc}.en.md`)].find((f) => fs.existsSync(f));
  return {
    doc,
    version: process.env.POLICY_VERSION || '1.0',
    support: process.env.SUPPORT_CONTACT || null,
    markdown: fs.readFileSync(file, 'utf8'),
  };
}));

router.get('/public/config', h(() => ({ supportContact: process.env.SUPPORT_CONTACT || null, policyVersion: process.env.POLICY_VERSION || '1.0' })));

module.exports = router;
