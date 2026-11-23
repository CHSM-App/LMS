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

test('007 makes the live class Meet link optional', async () => {
  const pool = await getPool();
  const r = await pool.request().query("SELECT IS_NULLABLE n FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'live_classes' AND COLUMN_NAME = 'meet_link'");
  expect(r.recordset[0].n).toBe('YES');
});

test('006 adds live lesson columns', async () => {
  const pool = await getPool();
  const r = await pool.request().query(`SELECT TABLE_NAME t, COLUMN_NAME c FROM INFORMATION_SCHEMA.COLUMNS
    WHERE (TABLE_NAME = 'contents' AND COLUMN_NAME = 'live_class_id')
       OR (TABLE_NAME = 'live_classes' AND COLUMN_NAME = 'reminder2_sent_at')`);
  expect(r.recordset).toHaveLength(2);
});

test('010 adds contents.live_slot_id with its index and a live-only check', async () => {
  const pool = await getPool();
  const col = await pool.request().query("SELECT DATA_TYPE d, IS_NULLABLE n FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'contents' AND COLUMN_NAME = 'live_slot_id'");
  expect(col.recordset).toEqual([{ d: 'uniqueidentifier', n: 'YES' }]);
  const idx = await pool.request().query("SELECT name FROM sys.indexes WHERE name = 'IX_contents_live_slot'");
  expect(idx.recordset).toHaveLength(1);
  const ck = await pool.request().query("SELECT name FROM sys.check_constraints WHERE name = 'CK_contents_live_slot'");
  expect(ck.recordset).toHaveLength(1);
});
