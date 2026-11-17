const { resetTestDb, closeAll } = require('../setup/testDb');
const { migrate } = require('../../scripts/migrate');
const { getPool } = require('../../src/db/pool');

beforeAll(async () => {
  await resetTestDb();
});
afterAll(closeAll);

const CORE_TABLES = [
  'users', 'teacher_profiles', 'student_profiles', 'teacher_requests', 'teacher_subscriptions',
  'otp_codes', 'refresh_tokens', 'notifications', 'admin_audit_log', 'legal_consents', 'mobile_change_requests',
];

test('core tables exist', async () => {
  const pool = await getPool();
  const r = await pool.request().query('SELECT name FROM sys.tables');
  const names = r.recordset.map((x) => x.name);
  for (const t of CORE_TABLES) expect(names).toContain(t);
});

test('second migrate run applies nothing', async () => {
  expect(await migrate()).toEqual([]);
});

test('Marathi text round-trips', async () => {
  const pool = await getPool();
  await pool.request().query(
    "INSERT INTO dbo.users (mobile, name, role, status) VALUES ('+919000000001', N'सुरेश पाटील', 'student', 'approved')",
  );
  const r = await pool.request().query("SELECT name FROM dbo.users WHERE mobile = '+919000000001'");
  expect(r.recordset[0].name).toBe('सुरेश पाटील');
});

test('all foreign keys are trusted', async () => {
  const pool = await getPool();
  const r = await pool.request().query('SELECT COUNT(*) AS n FROM sys.foreign_keys WHERE is_not_trusted = 1');
  expect(r.recordset[0].n).toBe(0);
});
