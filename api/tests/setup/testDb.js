const { getPool, closePool } = require('../../src/db/pool');
const { migrate } = require('../../scripts/migrate');

// Drops every table in the test database (FK-safe), then runs all migrations.
async function resetTestDb() {
  if (!/test/i.test(process.env.DB_NAME || '')) throw new Error('Refusing to reset a non-test database');
  const pool = await getPool();
  await pool.request().batch(`
    DECLARE @sql NVARCHAR(MAX) = N'';
    SELECT @sql += N'ALTER TABLE ' + QUOTENAME(SCHEMA_NAME(t.schema_id)) + N'.' + QUOTENAME(t.name)
                 + N' DROP CONSTRAINT ' + QUOTENAME(f.name) + N';'
    FROM sys.foreign_keys f JOIN sys.tables t ON t.object_id = f.parent_object_id;
    EXEC sp_executesql @sql;
    SET @sql = N'';
    SELECT @sql += N'DROP TABLE ' + QUOTENAME(SCHEMA_NAME(schema_id)) + N'.' + QUOTENAME(name) + N';' FROM sys.tables;
    EXEC sp_executesql @sql;
  `);
  await migrate({ quiet: true });
}

let deleteOrder;

// Children before parents, computed once from sys.foreign_keys.
async function computeDeleteOrder(pool) {
  const tables = (await pool.request().query("SELECT name FROM sys.tables WHERE name <> 'schema_migrations'")).recordset.map((r) => r.name);
  const fks = (await pool.request().query(`
    SELECT OBJECT_NAME(parent_object_id) AS child, OBJECT_NAME(referenced_object_id) AS parent
    FROM sys.foreign_keys WHERE parent_object_id <> referenced_object_id`)).recordset;
  const order = [];
  const remaining = new Set(tables);
  while (remaining.size) {
    const leaf = [...remaining].find((t) => !fks.some((f) => f.parent === t && remaining.has(f.child)));
    if (!leaf) throw new Error('FK cycle; cannot compute delete order');
    order.push(leaf);
    remaining.delete(leaf);
  }
  return order;
}

// Deletes all rows (keeps schema) — fast reset between tests.
async function truncateAll() {
  const pool = await getPool();
  if (!deleteOrder) deleteOrder = await computeDeleteOrder(pool);
  await pool.request().batch(deleteOrder.map((t) => `DELETE FROM dbo.[${t}];`).join('\n'));
}

async function closeAll() {
  await closePool();
}

module.exports = { resetTestDb, truncateAll, closeAll };
