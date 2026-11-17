require('dotenv').config({ path: require('path').join(__dirname, '../../.env'), quiet: true });
process.env.NODE_ENV = 'test';
process.env.DB_NAME = process.env.DB_TEST_NAME || 'lms_test';
process.env.STORAGE_DIR = require('path').join(__dirname, '../../storage-test');
