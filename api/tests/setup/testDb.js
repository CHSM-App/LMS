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

// Deletes all rows (keeps schema) — fast reset between test files.
async function truncateAll() {
  const pool = await getPool();
  await pool.request().batch(`
    EXEC sp_MSforeachtable 'ALTER TABLE ? NOCHECK CONSTRAINT ALL';
    EXEC sp_MSforeachtable 'IF OBJECT_ID(''?'') <> OBJECT_ID(''dbo.schema_migrations'') DELETE FROM ?';
    EXEC sp_MSforeachtable 'ALTER TABLE ? WITH CHECK CHECK CONSTRAINT ALL';
  `);
}

async function closeAll() {
  await closePool();
}

module.exports = { resetTestDb, truncateAll, closeAll };
