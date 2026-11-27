const { sql, getPool } = require('./pool');

// Runs fn(tx) in a transaction and rolls back on any throw (XACT_ABORT semantics).
async function withTransaction(fn) {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  const after = [];
  // Side effects (WhatsApp, emails) registered here run only once the commit succeeds.
  tx.afterCommit = (cb) => after.push(cb);
  await tx.begin();
  try {
    await new sql.Request(tx).batch('SET XACT_ABORT ON');
    const result = await fn(tx);
    await tx.commit();
    for (const cb of after) await Promise.resolve().then(cb).catch(() => null);
    return result;
  } catch (err) {
    try {
      await tx.rollback();
    } catch (_) {
      /* already rolled back by XACT_ABORT */
    }
    throw err;
  }
}

// A request bound to tx when given, otherwise to the pool.
async function req(tx) {
  if (tx) return new sql.Request(tx);
  return (await getPool()).request();
}

module.exports = { withTransaction, req, sql };
