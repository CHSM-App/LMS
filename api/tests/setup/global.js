// Jest globalSetup: rebuild the test database once per run.
module.exports = async () => {
  require('./env');
  const { resetTestDb, closeAll } = require('./testDb');
  await resetTestDb();
  await closeAll();
};
