const fs = require('fs');
const path = require('path');
const { getPool, closePool, sql } = require('../src/db/pool');

const DIR = path.join(__dirname, '../migrations');

// Applies migrations/*.sql in name order; each file runs in one transaction and is
// recorded in dbo.schema_migrations. Returns the list of files applied this run.
async function migrate({ quiet = false } = {}) {
  const pool = await getPool();
  await pool.request().batch(`
    IF OBJECT_ID('dbo.schema_migrations') IS NULL
      CREATE TABLE dbo.schema_migrations (
        file_name  VARCHAR(200) NOT NULL CONSTRAINT PK_schema_migrations PRIMARY KEY,
        applied_at DATETIME2(3) NOT NULL CONSTRAINT DF_schema_migrations_at DEFAULT SYSUTCDATETIME()
      );`);
  const done = new Set((await pool.request().query('SELECT file_name FROM dbo.schema_migrations')).recordset.map((r) => r.file_name));
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();
  const applied = [];
  for (const file of files) {
    if (done.has(file)) continue;
    const batches = fs.readFileSync(path.join(DIR, file), 'utf8').split(/^\s*GO\s*$/im).map((b) => b.trim()).filter(Boolean);
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      for (const b of batches) await new sql.Request(tx).batch(b);
      await new sql.Request(tx).input('f', sql.VarChar(200), file).query('INSERT INTO dbo.schema_migrations (file_name) VALUES (@f)');
      await tx.commit();
      applied.push(file);
      if (!quiet) console.log(`applied ${file}`);
    } catch (err) {
      try { await tx.rollback(); } catch (_) { /* noop */ }
      throw new Error(`Migration ${file} failed: ${err.message}`);
    }
  }
  return applied;
}

module.exports = { migrate };

if (require.main === module) {
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
  migrate()
    .then((a) => console.log(a.length ? `${a.length} migration(s) applied` : 'Database is up to date'))
    .catch((e) => { console.error(e.message); process.exitCode = 1; })
    .finally(closePool);
}
