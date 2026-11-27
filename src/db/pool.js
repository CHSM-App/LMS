const sql = require('mssql');
const { config } = require('../config/env');

let poolPromise;

function getPool() {
  if (!poolPromise) {
    const c = config().db;
    const pool = new sql.ConnectionPool({
      server: c.server,
      port: c.port,
      database: c.database,
      user: c.user,
      password: c.password,
      // trustServerCertificate only for a known server with a self-signed certificate (DB_TRUST_SERVER_CERT=true).
      // Production should use a real certificate and leave it off.
      options: { encrypt: c.encrypt, trustServerCertificate: !c.encrypt || c.trustServerCertificate },
      pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
    });
    poolPromise = pool.connect().catch((err) => {
      poolPromise = undefined;
      throw err;
    });
  }
  return poolPromise;
}

async function closePool() {
  if (!poolPromise) return;
  const p = await poolPromise.catch(() => null);
  poolPromise = undefined;
  if (p) await p.close();
}

module.exports = { sql, getPool, closePool };
