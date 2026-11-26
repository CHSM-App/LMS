const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Tests read api/.env, then api/.env.test overrides it (so tests can use a different server/login).
dotenv.config({ path: path.join(__dirname, '../../.env'), quiet: true });
const testEnv = path.join(__dirname, '../../.env.test');
if (fs.existsSync(testEnv)) dotenv.config({ path: testEnv, override: true, quiet: true });

// The test suite wipes its database, so it must be named explicitly. No fallback.
if (!process.env.DB_TEST_NAME) {
  throw new Error('DB_TEST_NAME is not set. Set it in api/.env.test (or api/.env) to an EMPTY database the tests may wipe.');
}
process.env.NODE_ENV = 'test';
// A developer's .env may point at real providers (SMSALA, Meta, Google). Tests must never send real messages.
process.env.OTP_PROVIDER = 'console';
process.env.WHATSAPP_PROVIDER = 'console';
// COOKIE_SECURE=false is for local http development; tests expect the production default (Secure cookie).
delete process.env.COOKIE_SECURE;
process.env.DB_NAME = process.env.DB_TEST_NAME;
process.env.STORAGE_DIR = path.join(__dirname, '../../storage-test');
